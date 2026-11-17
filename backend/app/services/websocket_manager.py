import json
import asyncio
from typing import List, Optional
from fastapi import WebSocket
import logging

logger = logging.getLogger("hafim.ws")

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    def broadcast_from_any_thread(self, event_data: dict):
        """Dispatches event broadcast safely across threads into the asyncio event loop."""
        if not self.active_connections:
            return
        if self._loop and self._loop.is_running():
            try:
                asyncio.run_coroutine_threadsafe(self.broadcast_event(event_data), self._loop)
            except Exception as e:
                logger.error(f"Error dispatching thread-safe WS broadcast: {e}")
        else:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(self.broadcast_event(event_data))
            except Exception:
                pass

    async def broadcast_event(self, event_data: dict):
        if not self.active_connections:
            return
        payload = json.dumps({"type": "INTEGRITY_EVENT", "data": event_data})
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)
        for d in disconnected:
            self.disconnect(d)

    async def broadcast_status(self, status_data: dict):
        if not self.active_connections:
            return
        payload = json.dumps({"type": "STATUS_UPDATE", "data": status_data})
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)
        for d in disconnected:
            self.disconnect(d)

ws_manager = WebSocketManager()
