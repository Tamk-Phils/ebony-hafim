import os
import sys
import types

# Ensure current backend directory and parent directory are on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)

for path in [PARENT_DIR, CURRENT_DIR]:
    if os.path.exists(path) and path not in sys.path:
        sys.path.insert(0, path)

# Add bundled subpackages (agent, tee) to sys.path
for sub in ["agent", "tee"]:
    sub_path = os.path.join(CURRENT_DIR, sub)
    if os.path.exists(sub_path) and sub_path not in sys.path:
        sys.path.insert(0, sub_path)

# Alias 'backend' module so 'from backend.app...' imports work regardless of working directory
if "backend" not in sys.modules:
    try:
        import app
        backend_pkg = types.ModuleType("backend")
        backend_pkg.app = app
        sys.modules["backend"] = backend_pkg
        sys.modules["backend.app"] = app
    except Exception:
        pass

# Import the initialized FastAPI app
from backend.app.main import app

# Explicitly bind app at module level for Vercel ASGI runner
app = app
