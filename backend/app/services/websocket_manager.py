import json
from typing import List
from fastapi import WebSocket
import logging

logger = logging.getLogger("hafim.ws")

class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

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
