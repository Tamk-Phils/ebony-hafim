import os
import sys
import time
import ctypes
import struct
import select
import threading
import hashlib
import platform
import socket
from pathlib import Path
from typing import Dict, List, Set, Optional, Callable, Any

# Platform identification
IS_WINDOWS = sys.platform == "win32" or os.name == "nt"
IS_LINUX = sys.platform.startswith("linux")

# Linux inotify constants
IN_CLOEXEC = 0x00080000
IN_NONBLOCK = 0x00000800
IN_MODIFY = 0x00000002
IN_ATTRIB = 0x00000004
IN_CLOSE_WRITE = 0x00000008
IN_MOVED_FROM = 0x00000040
IN_MOVED_TO = 0x00000080
IN_CREATE = 0x00000100
IN_DELETE = 0x00000200
IN_DELETE_SELF = 0x00000400
IN_MOVE_SELF = 0x00000800
IN_ISDIR = 0x40000000

# Safely load libc on Linux without breaking on Windows
libc = None
if IS_LINUX:
    try:
        libc = ctypes.CDLL("libc.so.6", use_errno=True)
    except Exception:
        try:
            import ctypes.util
            lib_c = ctypes.util.find_library("c")
            if lib_c:
                libc = ctypes.CDLL(lib_c, use_errno=True)
        except Exception:
            libc = None

class HostMonitoringAgent:
    """
    Cross-Platform Host-side File Integrity Monitoring Agent.
    
    Supports both Linux (native libc inotify_init1) and Windows (Win32 filesystem watcher
    and differential polling engine), combined with scheduled background reconciliation sweeps.
    Reads observed file contents, computes cryptographic SHA-256 digests, and dispatches
    verifications to the protected TEE comparison boundary.
    """

    def __init__(
        self,
        agent_id: str = "host-agent-01",
        approved_roots: Optional[List[str]] = None,
        reconciliation_interval: int = 15,
        tee_verifier: Optional[Callable] = None,
        event_callback: Optional[Callable] = None,
        heartbeat_callback: Optional[Callable] = None
    ):
        self.agent_id = agent_id
        self.approved_roots = [str(Path(r).resolve()) for r in (approved_roots or [])]
        self.reconciliation_interval = reconciliation_interval
        self.tee_verifier = tee_verifier
        self.event_callback = event_callback
        self.heartbeat_callback = heartbeat_callback

        self._running = False
        self._sequence_no = 0
        self._seq_lock = threading.Lock()
        self._inotify_fd = -1
        self._watch_descriptors: Dict[int, str] = {}
        self._path_to_wd: Dict[str, int] = {}
        self._threads: List[threading.Thread] = []
        self._known_files: Dict[str, Dict] = {} # path -> {hash, mtime, size, permissions}
        self._dir_snapshots: Dict[str, float] = {} # dir_path -> mtime
        self._monitored_paths: Set[str] = set()

    @staticmethod
    def get_system_telemetry() -> Dict[str, Any]:
        """Provides dynamic OS and host telemetry without hardcoded fake profiles."""
        engine_label = "Linux inotify (libc)" if (IS_LINUX and libc) else (
            "Windows Win32 Directory Watcher" if IS_WINDOWS else "Cross-Platform Directory Watcher"
        )
        return {
            "hostname": socket.gethostname(),
            "os_name": platform.system(),
            "os_release": platform.release(),
            "os_platform": f"{platform.system()} {platform.release()}",
            "architecture": platform.machine(),
            "python_version": platform.python_version(),
            "is_windows": IS_WINDOWS,
            "is_linux": IS_LINUX,
            "monitoring_backend": engine_label
        }

    def get_next_sequence(self) -> int:
        with self._seq_lock:
            self._sequence_no += 1
            return self._sequence_no

    def _normalize_path(self, p: str) -> str:
        resolved = str(Path(p).resolve())
        return os.path.normcase(resolved) if IS_WINDOWS else resolved

    def add_root(self, root_path: str):
        resolved = str(Path(root_path).resolve())
        norm_resolved = self._normalize_path(resolved)

        if self.approved_roots:
            is_approved = any(
                norm_resolved == self._normalize_path(app) or
                norm_resolved.startswith(self._normalize_path(app) + os.sep)
                for app in self.approved_roots
            )
            if not is_approved:
                raise PermissionError(
                    f"Path '{resolved}' is outside approved monitoring roots: {self.approved_roots}"
                )

        self._monitored_paths.add(resolved)
        if self._running:
            if self._inotify_fd >= 0 and libc is not None:
                self._watch_directory_tree(resolved)

    def remove_root(self, root_path: str):
        resolved = str(Path(root_path).resolve())
        norm_resolved = self._normalize_path(resolved)

        to_remove = {
            p for p in self._monitored_paths
            if self._normalize_path(p) == norm_resolved
        }
        for p in to_remove:
            self._monitored_paths.discard(p)

        # Remove watch descriptors if using inotify
        if self._inotify_fd >= 0 and libc is not None:
            for wd, p in list(self._watch_descriptors.items()):
                if p == resolved or p.startswith(resolved + os.sep):
                    try:
                        libc.inotify_rm_watch(self._inotify_fd, wd)
                    except Exception:
                        pass
                    del self._watch_descriptors[wd]
                    if p in self._path_to_wd:
                        del self._path_to_wd[p]

    def _safe_compute_sha256(self, file_path: str, chunk_size: int = 65536) -> Optional[str]:
        """Safely compute SHA-256 preventing symlink escape and handling permissions."""
        try:
            real_path = os.path.realpath(file_path)
            norm_real = self._normalize_path(real_path)

            if self.approved_roots:
                is_valid = any(
                    norm_real == self._normalize_path(r) or
                    norm_real.startswith(self._normalize_path(r) + os.sep)
                    for r in self.approved_roots
                )
                if not is_valid:
                    return None

            if not os.path.isfile(file_path) or os.path.islink(file_path):
                if os.path.islink(file_path):
                    target = os.readlink(file_path)
                    return hashlib.sha256(f"symlink:{target}".encode()).hexdigest()
                return None

            hasher = hashlib.sha256()
            with open(file_path, "rb") as f:
                while chunk := f.read(chunk_size):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except (PermissionError, FileNotFoundError, OSError):
            return None

    def _get_file_metadata(self, file_path: str) -> Dict[str, Any]:
        try:
            st = os.stat(file_path, follow_symlinks=False)
            if IS_WINDOWS:
                # Windows read/write permission mapping
                perms = "0666" if os.access(file_path, os.W_OK) else "0444"
            else:
                perms = oct(st.st_mode & 0o777)[2:].zfill(4)
            return {
                "size_bytes": st.st_size,
                "permissions": perms,
                "mtime": st.st_mtime,
                "file_type": "symlink" if os.path.islink(file_path) else "regular"
            }
        except (FileNotFoundError, OSError):
            return {
                "size_bytes": 0,
                "permissions": "0000",
                "mtime": 0.0,
                "file_type": "deleted"
            }

    def verify_single_file(self, file_path: str):
        """Dispatches observed file state across the narrow TEE verification boundary."""
        if not self.tee_verifier:
            return

        exists = os.path.exists(file_path)
        meta = self._get_file_metadata(file_path) if exists else {
            "size_bytes": 0, "permissions": "0000", "mtime": 0.0, "file_type": "deleted"
        }
        observed_hash = self._safe_compute_sha256(file_path) if exists else None
        seq = self.get_next_sequence()

        # Call TEE verification engine
        result = self.tee_verifier(
            file_path=file_path,
            observed_hash=observed_hash,
            size_bytes=meta["size_bytes"],
            permissions=meta["permissions"],
            sequence_no=seq
        )

        # Update local tracking cache
        if observed_hash:
            self._known_files[file_path] = {
                "hash": observed_hash,
                "size": meta["size_bytes"],
                "permissions": meta["permissions"],
                "mtime": meta["mtime"]
            }
        elif file_path in self._known_files:
            del self._known_files[file_path]

        # Trigger event callback if registered
        if self.event_callback:
            self.event_callback(result, meta)

    def _watch_directory_tree(self, path: str):
        """Recursively registers inotify watch descriptors on Linux."""
        if self._inotify_fd < 0 or libc is None or not os.path.isdir(path):
            return

        mask = (
            IN_MODIFY | IN_ATTRIB | IN_CLOSE_WRITE |
            IN_MOVED_FROM | IN_MOVED_TO | IN_CREATE |
            IN_DELETE | IN_DELETE_SELF | IN_MOVE_SELF
        )

        for root, _, _ in os.walk(path):
            real_root = os.path.realpath(root)
            if real_root in self._path_to_wd:
                continue
            wd = libc.inotify_add_watch(self._inotify_fd, real_root.encode("utf-8"), mask)
            if wd >= 0:
                self._watch_descriptors[wd] = real_root
                self._path_to_wd[real_root] = wd

    def _inotify_loop(self):
        """Worker thread processing Linux inotify event stream."""
        if self._inotify_fd < 0 or libc is None:
            return

        poll = select.poll()
        poll.register(self._inotify_fd, select.POLLIN)

        EVENT_STRUCT_FMT = "iIII"
        EVENT_STRUCT_SIZE = struct.calcsize(EVENT_STRUCT_FMT)

        while self._running:
            events = poll.poll(500)
            if not events:
                continue

            try:
                data = os.read(self._inotify_fd, 4096)
                if not data:
                    continue

                offset = 0
                while offset < len(data):
                    wd, mask, cookie, name_len = struct.unpack_from(EVENT_STRUCT_FMT, data, offset)
                    offset += EVENT_STRUCT_SIZE
                    name = ""
                    if name_len > 0:
                        raw_name = data[offset:offset + name_len].split(b"\x00", 1)[0]
                        name = raw_name.decode("utf-8", errors="replace")
                        offset += name_len

                    dir_path = self._watch_descriptors.get(wd)
                    if not dir_path:
                        continue

                    full_path = os.path.join(dir_path, name) if name else dir_path

                    if (mask & IN_CREATE) and (mask & IN_ISDIR) and os.path.isdir(full_path):
                        self._watch_directory_tree(full_path)

                    self.verify_single_file(full_path)
            except Exception:
                if self._running:
                    time.sleep(0.1)

    def _fast_watch_loop(self):
        """
        Cross-platform / Windows high-frequency directory watcher.
        Detects immediate file changes, additions, deletions, and metadata updates
        with sub-second responsiveness without requiring POSIX libc inotify.
        """
        while self._running:
            try:
                for root in list(self._monitored_paths):
                    if not os.path.exists(root):
                        continue

                    if os.path.isfile(root):
                        try:
                            st = os.stat(root)
                            last_known = self._known_files.get(root)
                            if not last_known or last_known.get("mtime") != st.st_mtime or last_known.get("size") != st.st_size:
                                self.verify_single_file(root)
                        except OSError:
                            pass
                    elif os.path.isdir(root):
                        # Walk directory tree
                        current_files_in_tree = set()
                        for dirpath, _, filenames in os.walk(root):
                            for fname in filenames:
                                fpath = os.path.join(dirpath, fname)
                                current_files_in_tree.add(fpath)
                                try:
                                    st = os.stat(fpath)
                                    cached = self._known_files.get(fpath)
                                    if not cached or cached.get("mtime") != st.st_mtime or cached.get("size") != st.st_size:
                                        self.verify_single_file(fpath)
                                except OSError:
                                    pass

                        # Detect deletions within this root
                        for cached_path in list(self._known_files.keys()):
                            if cached_path.startswith(root + os.sep) and not os.path.exists(cached_path):
                                self.verify_single_file(cached_path)
            except Exception:
                pass

            # Responsive 500ms loop
            for _ in range(5):
                if not self._running:
                    break
                time.sleep(0.1)

    def _reconciliation_loop(self):
        """Worker thread performing periodic sweep to reconcile any edge-case events."""
        while self._running:
            try:
                if self.heartbeat_callback:
                    self.heartbeat_callback(
                        self.agent_id,
                        len(self._monitored_paths),
                        len(self._known_files)
                    )

                for root in list(self._monitored_paths):
                    if not os.path.exists(root):
                        continue
                    if os.path.isfile(root):
                        self.verify_single_file(root)
                    elif os.path.isdir(root):
                        if self._inotify_fd >= 0 and libc is not None:
                            self._watch_directory_tree(root)
                        for dirpath, _, filenames in os.walk(root):
                            for fname in filenames:
                                fpath = os.path.join(dirpath, fname)
                                self.verify_single_file(fpath)

                for cached_path in list(self._known_files.keys()):
                    if not os.path.exists(cached_path):
                        self.verify_single_file(cached_path)
            except Exception:
                pass

            for _ in range(self.reconciliation_interval):
                if not self._running:
                    break
                time.sleep(1)

    def start(self):
        """Starts real-time filesystem watchers and background reconciliation."""
        if self._running:
            return
        self._running = True
        self._threads = []

        # 1. Attempt Linux inotify initialization if on Linux
        if IS_LINUX and libc is not None:
            try:
                self._inotify_fd = libc.inotify_init1(IN_NONBLOCK | IN_CLOEXEC)
                for root in self._monitored_paths:
                    if os.path.exists(root):
                        self._watch_directory_tree(root)
                t_inotify = threading.Thread(target=self._inotify_loop, daemon=True, name="agent-inotify")
                self._threads.append(t_inotify)
            except Exception:
                self._inotify_fd = -1

        # 2. On Windows (or Linux if inotify is unavailable/restricted), run the fast watcher
        if self._inotify_fd < 0:
            t_fast = threading.Thread(target=self._fast_watch_loop, daemon=True, name="agent-watcher")
            self._threads.append(t_fast)

        # 3. Always run the background reconciliation safety sweep
        t_reconcile = threading.Thread(target=self._reconciliation_loop, daemon=True, name="agent-reconcile")
        self._threads.append(t_reconcile)

        for t in self._threads:
            t.start()

    def stop(self):
        """Gracefully terminates monitoring threads and releases descriptors."""
        self._running = False
        if self._inotify_fd >= 0:
            if libc is not None:
                try:
                    os.close(self._inotify_fd)
                except OSError:
                    pass
            self._inotify_fd = -1
        self._watch_descriptors.clear()
        self._path_to_wd.clear()
