import os
import sys
import time
import ctypes
import struct
import select
import threading
import hashlib
from pathlib import Path
from typing import Dict, List, Set, Optional, Callable
from datetime import datetime, timezone

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

libc = ctypes.CDLL("libc.so.6", use_errno=True)

class HostMonitoringAgent:
    """
    Host-side File Integrity Monitoring Agent.
    
    Monitors designated roots using Linux inotify events and scheduled
    reconciliation scans. Reads observed file content, computes SHA-256 hashes,
    and forwards verification requests across the narrow TEE communication channel.
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
        self._monitored_paths: Set[str] = set()

    def get_next_sequence(self) -> int:
        with self._seq_lock:
            self._sequence_no += 1
            return self._sequence_no

    def add_root(self, root_path: str):
        resolved = str(Path(root_path).resolve())
        # Check against approved roots policy
        is_approved = any(
            resolved == app or resolved.startswith(app + os.sep)
            for app in self.approved_roots
        )
        if not is_approved:
            # Also allow if approved_roots is empty
            if self.approved_roots:
                raise PermissionError(f"Path '{resolved}' is outside approved monitoring roots: {self.approved_roots}")

        self._monitored_paths.add(resolved)
        if self._running and self._inotify_fd >= 0:
            self._watch_directory_tree(resolved)

    def remove_root(self, root_path: str):
        resolved = str(Path(root_path).resolve())
        if resolved in self._monitored_paths:
            self._monitored_paths.remove(resolved)
            # Remove watch descriptors
            for wd, p in list(self._watch_descriptors.items()):
                if p == resolved or p.startswith(resolved + os.sep):
                    libc.inotify_rm_watch(self._inotify_fd, wd)
                    del self._watch_descriptors[wd]
                    if p in self._path_to_wd:
                        del self._path_to_wd[p]

    def _safe_compute_sha256(self, file_path: str, chunk_size: int = 65536) -> Optional[str]:
        """Safely compute SHA-256 preventing symlink traversal and race conditions."""
        try:
            # Check if symlink points outside approved roots
            real_path = os.path.realpath(file_path)
            is_valid = any(
                real_path == r or real_path.startswith(r + os.sep)
                for r in self.approved_roots
            ) if self.approved_roots else True

            if not is_valid:
                return None

            if not os.path.isfile(file_path) or os.path.islink(file_path):
                # Don't follow symlinks
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

    def _get_file_metadata(self, file_path: str) -> Dict:
        try:
            st = os.stat(file_path, follow_symlinks=False)
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
        """Dispatches file state to TEE verifier."""
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

        # Trigger event callback if violation or state change
        if self.event_callback:
            self.event_callback(result, meta)

    def _watch_directory_tree(self, path: str):
        if self._inotify_fd < 0 or not os.path.isdir(path):
            return
        
        mask = (
            IN_MODIFY | IN_ATTRIB | IN_CLOSE_WRITE |
            IN_MOVED_FROM | IN_MOVED_TO | IN_CREATE |
            IN_DELETE | IN_DELETE_SELF | IN_MOVE_SELF
        )

        for root, dirs, _ in os.walk(path):
            real_root = os.path.realpath(root)
            if real_root in self._path_to_wd:
                continue
            wd = libc.inotify_add_watch(self._inotify_fd, real_root.encode("utf-8"), mask)
            if wd >= 0:
                self._watch_descriptors[wd] = real_root
                self._path_to_wd[real_root] = wd

    def _inotify_loop(self):
        """Worker thread processing Linux inotify events."""
        poll = select.poll()
        poll.register(self._inotify_fd, select.POLLIN)

        EVENT_STRUCT_FMT = "iIII"
        EVENT_STRUCT_SIZE = struct.calcsize(EVENT_STRUCT_FMT)

        while self._running:
            events = poll.poll(500) # 500ms timeout
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

                    # New directory created: watch it
                    if (mask & IN_CREATE) and (mask & IN_ISDIR) and os.path.isdir(full_path):
                        self._watch_directory_tree(full_path)

                    # Trigger file verification
                    self.verify_single_file(full_path)

            except Exception as e:
                if self._running:
                    time.sleep(0.1)

    def _reconciliation_loop(self):
        """Worker thread performing periodic sweep to reconcile missed inotify events."""
        while self._running:
            try:
                # 1. Send heartbeat
                if self.heartbeat_callback:
                    self.heartbeat_callback(self.agent_id, len(self._monitored_paths), len(self._known_files))

                # 2. Reconcile all monitored roots
                for root in list(self._monitored_paths):
                    if not os.path.exists(root):
                        continue
                    if os.path.isfile(root):
                        self.verify_single_file(root)
                    elif os.path.isdir(root):
                        self._watch_directory_tree(root)
                        for dirpath, _, filenames in os.walk(root):
                            for fname in filenames:
                                fpath = os.path.join(dirpath, fname)
                                self.verify_single_file(fpath)

                # Check for deleted files in cache
                for cached_path in list(self._known_files.keys()):
                    if not os.path.exists(cached_path):
                        self.verify_single_file(cached_path)

            except Exception as e:
                pass

            # Sleep reconciliation interval
            for _ in range(self.reconciliation_interval):
                if not self._running:
                    break
                time.sleep(1)

    def start(self):
        if self._running:
            return
        self._running = True
        self._inotify_fd = libc.inotify_init1(IN_NONBLOCK | IN_CLOEXEC)

        for root in self._monitored_paths:
            if os.path.exists(root):
                self._watch_directory_tree(root)

        # Launch inotify thread
        t_inotify = threading.Thread(target=self._inotify_loop, daemon=True, name="agent-inotify")
        t_reconcile = threading.Thread(target=self._reconciliation_loop, daemon=True, name="agent-reconcile")
        self._threads = [t_inotify, t_reconcile]
        for t in self._threads:
            t.start()

    def stop(self):
        self._running = False
        if self._inotify_fd >= 0:
            try:
                os.close(self._inotify_fd)
            except OSError:
                pass
            self._inotify_fd = -1
        self._watch_descriptors.clear()
        self._path_to_wd.clear()
