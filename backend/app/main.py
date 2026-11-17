import os
import sys
import types
import socket
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager

CURRENT_FILE = os.path.abspath(__file__)
APP_DIR = os.path.dirname(CURRENT_FILE)
BACKEND_DIR = os.path.abspath(os.path.join(APP_DIR, ".."))
REPO_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))

for path in [REPO_ROOT, BACKEND_DIR]:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)

for sub in ["agent", "tee"]:
    sub_path = os.path.join(BACKEND_DIR, sub)
    if os.path.exists(sub_path) and sub_path not in sys.path:
        sys.path.insert(0, sub_path)

if "backend" not in sys.modules:
    try:
        import app
        backend_pkg = types.ModuleType("backend")
        backend_pkg.app = app
        sys.modules["backend"] = backend_pkg
        sys.modules["backend.app"] = app
    except Exception:
        pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.database.session import engine, Base, SessionLocal
from backend.app.models.all_models import Admin, MonitoringTarget, AgentStatusRecord
from backend.app.core.security import hash_password
from backend.app.api.v1 import (
    auth,
    dashboard,
    monitored_files,
    baselines,
    events,
    tee,
    tests,
    evaluations,
    audit
)
from backend.app.services.websocket_manager import ws_manager
from backend.app.services.tee_service import tee_service
from backend.app.services.fim_service import fim_service
from agent.src.agent import HostMonitoringAgent

logger = logging.getLogger("hafim.backend")

# Global monitoring agent instance
host_agent: HostMonitoringAgent = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: 1. Create tables
    Base.metadata.create_all(bind=engine)
    
    # 2. Seed initial admin & initial target if not present
    db: Session = SessionLocal()
    try:
        admin_count = db.query(Admin).count()
        if admin_count == 0:
            # Seed default research admin
            default_admin = Admin(
                username="admin",
                hashed_password=hash_password("CyberSecResearch2026!"),
                is_active=True
            )
            db.add(default_admin)
            db.commit()

        # Seed initial sandbox root
        if os.environ.get("VERCEL"):
            sandbox_path = "/tmp/sandbox"
        else:
            sandbox_path = os.path.abspath("sandbox")
        os.makedirs(sandbox_path, exist_ok=True)
        # Create a sample monitored file in sandbox
        sample_file = os.path.join(sandbox_path, "system_auth.conf")
        if not os.path.exists(sample_file):
            with open(sample_file, "w") as f:
                f.write("# Authorized HA-FIM Monitored System Auth Configuration\nAUTH_POLICY=STRICT_TEE_VERIFIED\n")

        target_exists = db.query(MonitoringTarget).filter(MonitoringTarget.path == sandbox_path).first()
        if not target_exists:
            target = MonitoringTarget(
                path=sandbox_path,
                is_recursive=True,
                is_active=True,
                description="Default HA-FIM Secure Demonstration Sandbox"
            )
            db.add(target)
            db.commit()

        # Seed Agent Status with dynamic host platform telemetry
        telemetry = HostMonitoringAgent.get_system_telemetry()
        agent_rec = db.query(AgentStatusRecord).first()
        if not agent_rec:
            agent_rec = AgentStatusRecord(
                agent_id="host-agent-01",
                hostname=telemetry["hostname"],
                status="ACTIVE",
                monitored_paths_count=1,
                events_generated_count=0
            )
            db.add(agent_rec)
            db.commit()
        else:
            agent_rec.hostname = telemetry["hostname"]
            agent_rec.status = "ACTIVE"
            db.commit()

        # Sync TEE DB status
        tee_service.sync_db_status(db)
    finally:
        db.close()

    # 3. Define agent verification & telemetry callbacks
    def agent_verifier(file_path: str, observed_hash: Optional[str], size_bytes: int, permissions: str, sequence_no: int):
        db_session = SessionLocal()
        try:
            return fim_service.verify_file_against_tee(
                db=db_session,
                file_path=file_path,
                observed_hash=observed_hash,
                size_bytes=size_bytes,
                permissions=permissions
            )
        except Exception as err:
            logger.error(f"Agent verification error for {file_path}: {err}")
            return None
        finally:
            db_session.close()

    def agent_heartbeat(agent_id: str, paths_count: int, files_count: int):
        db_session = SessionLocal()
        try:
            rec = db_session.query(AgentStatusRecord).filter(AgentStatusRecord.agent_id == agent_id).first()
            if rec:
                rec.last_heartbeat = datetime.now(timezone.utc)
                rec.monitored_paths_count = paths_count
                rec.hostname = socket.gethostname()
                rec.status = "ACTIVE"
                db_session.commit()
        except Exception:
            pass
        finally:
            db_session.close()

    def agent_event_cb(result, meta):
        if not result:
            return
        db_session = SessionLocal()
        try:
            rec = db_session.query(AgentStatusRecord).first()
            if rec and getattr(result, "verdict", None) not in ("MATCH", "CLEAN"):
                rec.events_generated_count += 1
                db_session.commit()
        except Exception:
            pass
        finally:
            db_session.close()

    # 4. Start Host Monitoring Agent in background
    global host_agent
    host_agent = HostMonitoringAgent(
        agent_id="host-agent-01",
        approved_roots=settings.APPROVED_ROOTS,
        reconciliation_interval=settings.RECONCILIATION_INTERVAL_SECONDS,
        tee_verifier=agent_verifier,
        event_callback=agent_event_cb,
        heartbeat_callback=agent_heartbeat
    )
    # Add active targets to agent
    db = SessionLocal()
    try:
        targets = db.query(MonitoringTarget).filter(MonitoringTarget.is_active == True).all()
        for t in targets:
            try:
                host_agent.add_root(t.path)
            except Exception:
                pass
    finally:
        db.close()

    try:
        host_agent.start()
    except Exception as e:
        print(f"Warning: Could not start host agent inotify loop: {e}")

    yield

    # Shutdown: Stop agent
    if host_agent:
        host_agent.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Hardware-Assisted File Integrity Monitoring (HA-FIM) using TEEs in Cloud Infrastructure.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register v1 Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(monitored_files.router, prefix=settings.API_V1_STR)
app.include_router(baselines.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(tee.router, prefix=settings.API_V1_STR)
app.include_router(tests.router, prefix=settings.API_V1_STR)
app.include_router(evaluations.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)

# Live WebSocket stream
@app.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)

# Serve production frontend SPA if built
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

dist_dir = os.path.abspath(os.path.join(REPO_ROOT, "frontend", "dist"))
if os.path.exists(dist_dir) and os.path.exists(os.path.join(dist_dir, "index.html")):
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            return None
        candidate = os.path.join(dist_dir, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(dist_dir, "index.html"))
