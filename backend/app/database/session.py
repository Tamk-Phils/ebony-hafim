import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.core.config import settings

# For SQLite, check_same_thread=False is needed for multi-threaded FastAPI workers
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

_initialized = False

def init_db():
    """Ensure database tables and initial baseline seeds are created even under serverless environments."""
    global _initialized
    if _initialized:
        return
    try:
        import backend.app.models.all_models  # noqa: Ensure models are registered on Base
        Base.metadata.create_all(bind=engine)

        from backend.app.models.all_models import Admin, MonitoringTarget
        from backend.app.core.security import hash_password

        db = SessionLocal()
        try:
            # Seed default research admin if none exists
            if db.query(Admin).count() == 0:
                default_admin = Admin(
                    username="admin",
                    hashed_password=hash_password("CyberSecResearch2026!"),
                    is_active=True
                )
                db.add(default_admin)
                db.commit()

            # Seed default sandbox target
            sandbox_path = "/tmp/sandbox" if os.environ.get("VERCEL") else os.path.abspath("sandbox")
            os.makedirs(sandbox_path, exist_ok=True)
            sample_file = os.path.join(sandbox_path, "system_auth.conf")
            if not os.path.exists(sample_file):
                with open(sample_file, "w") as f:
                    f.write("# Authorized HA-FIM Monitored System Auth Configuration\nAUTH_POLICY=STRICT_TEE_VERIFIED\n")

            if db.query(MonitoringTarget).count() == 0:
                target = MonitoringTarget(
                    path=sandbox_path,
                    is_recursive=True,
                    is_active=True,
                    description="Default HA-FIM Secure Demonstration Sandbox"
                )
                db.add(target)
                db.commit()
        except Exception as e:
            db.rollback()
            print(f"Notice: Initial record check/seed: {e}")
        finally:
            db.close()

        _initialized = True
    except Exception as e:
        print(f"Notice: init_db execution: {e}")

def get_db():
    init_db()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
