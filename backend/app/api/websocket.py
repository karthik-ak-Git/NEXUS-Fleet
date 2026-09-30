import asyncio
import json
from typing import List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..simulation.simulation_engine import SimulationEngine

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, data: dict):
        if not self.active_connections:
            return
        message = json.dumps(data)
        to_remove = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                to_remove.add(connection)
        for conn in to_remove:
            self.active_connections.discard(conn)

manager = ConnectionManager()

def get_websocket_manager() -> ConnectionManager:
    return manager
