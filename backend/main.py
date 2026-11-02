import os
import sys

# Ensure repository root and backend directory are in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(CURRENT_DIR)

for path in [REPO_ROOT, CURRENT_DIR]:
    if path not in sys.path:
        sys.path.insert(0, path)

from backend.app.main import app

# Expose app for Vercel ASGI runner
__all__ = ["app"]
