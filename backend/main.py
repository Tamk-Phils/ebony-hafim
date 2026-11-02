import os
import sys
import types

# 1. Ensure current backend directory and parent directory are on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)

for path in [PARENT_DIR, CURRENT_DIR]:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)

# 2. Add bundled subpackages (agent, tee) to sys.path for isolated Vercel serverless packaging
for sub in ["agent", "tee"]:
    sub_path = os.path.join(CURRENT_DIR, sub)
    if os.path.exists(sub_path) and sub_path not in sys.path:
        sys.path.insert(0, sub_path)

# 3. Alias 'backend' module so 'from backend.app...' imports work regardless of working directory
if "backend" not in sys.modules:
    try:
        import app
        backend_pkg = types.ModuleType("backend")
        backend_pkg.app = app
        sys.modules["backend"] = backend_pkg
        sys.modules["backend.app"] = app
    except Exception:
        pass

# 4. Import the initialized FastAPI app
from backend.app.main import app

# Expose app for Vercel ASGI runner
__all__ = ["app"]
