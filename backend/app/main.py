import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router, global_engine
from .api.websocket import manager as ws_manager
from .database import db_manager
from .supabase_client import supabase_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")
logger = logging.getLogger("nexusfleet.main")

simulation_task = None

async def simulation_loop():
    tick_rate = 0.1  # 100ms tick (10 Hz)
    logger.info("Background 10 Hz Simulation loop running.")
    while True:
        try:
            if global_engine.running:
                global_engine.step(tick_rate)
                snapshot = global_engine.get_snapshot().model_dump()
                await ws_manager.broadcast({"type": "FLEET_SNAPSHOT", "payload": snapshot})
            await asyncio.sleep(tick_rate)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[SimulationLoop] Exception: {e}")
            await asyncio.sleep(tick_rate)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global simulation_task
    # Start background simulation loop automatically
    global_engine.start()
    simulation_task = asyncio.create_task(simulation_loop())
    db_manager.add_audit_log("SYSTEM", "NEXUS-Fleet FastAPI Backend & Simulation Engine online.")
    logger.info(f"[NEXUS-Fleet] Backend active. Supabase status: {'Configured' if supabase_service.is_configured() else 'Local Database Persistence Active'}")
    yield
    if simulation_task:
        simulation_task.cancel()
        try:
            await simulation_task
        except asyncio.CancelledError:
            pass
    db_manager.add_audit_log("SYSTEM", "NEXUS-Fleet Backend shutdown cleanly.")
    logger.info("[NEXUS-Fleet] Backend shutdown complete.")

app = FastAPI(
    title="NEXUS-Fleet Autonomous Backend Engine",
    description="Edge-AI Based Distributed Fleet Coordination Engine for Autonomous Mobile Robots (SIH26123)",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")

@app.websocket("/ws/fleet")
async def websocket_fleet_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    # Send initial snapshot immediately on connect
    snapshot = global_engine.get_snapshot().model_dump()
    await websocket.send_json({"type": "FLEET_SNAPSHOT", "payload": snapshot})
    try:
        while True:
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                if cmd.get("action") == "START":
                    global_engine.start()
                elif cmd.get("action") == "PAUSE":
                    global_engine.pause()
                elif cmd.get("action") == "RESET":
                    global_engine.reset(cmd.get("seed"))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
