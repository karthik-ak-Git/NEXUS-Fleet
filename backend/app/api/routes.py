from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from ..schemas.simulation import SimulationSnapshotSchema, BenchmarkResultSchema
from ..schemas.task import WarehouseTaskSchema
from ..simulation.simulation_engine import SimulationEngine
from ..ai_service import ai_explanation_service
from ..database import db_manager
from ..supabase_client import supabase_service

router = APIRouter()

# Global singleton simulation engine instance
global_engine = SimulationEngine(seed=26123, mode="distributed", robot_count=10, task_count=10)

def get_engine() -> SimulationEngine:
    return global_engine

class TaskCreateRequest(BaseModel):
    pickup: Optional[str] = None
    destination: Optional[str] = None
    priority: float = 0.8

class AIExplainRequest(BaseModel):
    question: str
    robotId: Optional[str] = None

class KnowledgeQueryRequest(BaseModel):
    query: str
    limit: int = 3

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "NEXUS-Fleet Autonomous Backend Engine",
        "database": {"connected": True, "supabase_configured": supabase_service.is_configured()},
        "fleet_size": len(global_engine.agents),
        "simulation_running": global_engine.running,
    }

@router.get("/fleet", response_model=SimulationSnapshotSchema)
def get_fleet_snapshot(engine: SimulationEngine = Depends(get_engine)):
    return engine.get_snapshot()

@router.get("/robots")
def get_robots(engine: SimulationEngine = Depends(get_engine)):
    return [a.state for a in engine.agents]

@router.get("/robots/{robot_id}")
def get_robot(robot_id: str, engine: SimulationEngine = Depends(get_engine)):
    agent = next((a for a in engine.agents if a.state.id == robot_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail="Robot not found")
    return agent.state

@router.get("/tasks")
def get_tasks(engine: SimulationEngine = Depends(get_engine)):
    return engine.tasks

@router.post("/tasks", response_model=WarehouseTaskSchema)
def create_task(req: TaskCreateRequest, engine: SimulationEngine = Depends(get_engine)):
    task = engine.create_task(req.pickup, req.destination, req.priority)
    
    # Audit log & Supabase sync
    task_dict = task.model_dump()
    db_manager.add_audit_log(
        category="TASK",
        action=f"Task {task.id} created",
        actor="operator",
        details=f"Pickup: {task.pickup}, Dest: {task.destination}, Priority: {task.priority}"
    )
    supabase_service.sync_task({
        "id": task.id,
        "order_id": task.orderId,
        "sku": task.sku,
        "pickup": task.pickup,
        "destination": task.destination,
        "priority": task.priority,
        "status": task.status,
    })
    return task

@router.get("/events")
def get_events(engine: SimulationEngine = Depends(get_engine)):
    return engine.events

@router.get("/negotiations")
def get_negotiations(engine: SimulationEngine = Depends(get_engine)):
    return engine.conflicts

@router.get("/reservations")
def get_reservations(engine: SimulationEngine = Depends(get_engine)):
    return [r for r in engine.reservations if r.status == "ACTIVE"]

@router.get("/audit")
def get_audit_trail(limit: int = Query(default=100, ge=1, le=500), category: Optional[str] = None):
    return db_manager.list_audit_logs(limit=limit, category=category)

@router.post("/scenarios/{scenario_id}/start")
def start_scenario(scenario_id: str, engine: SimulationEngine = Depends(get_engine)):
    engine.start()
    db_manager.add_audit_log("FLEET", f"Scenario {scenario_id} started")
    return {"status": "started", "scenario": scenario_id}

@router.post("/scenarios/{scenario_id}/stop")
def stop_scenario(scenario_id: str, engine: SimulationEngine = Depends(get_engine)):
    engine.pause()
    db_manager.add_audit_log("FLEET", f"Scenario {scenario_id} paused")
    return {"status": "paused", "scenario": scenario_id}

@router.post("/scenarios/reset")
def reset_simulation(seed: Optional[int] = None, engine: SimulationEngine = Depends(get_engine)):
    engine.reset(seed)
    db_manager.add_audit_log("FLEET", f"Simulation reset with seed {engine.seed}")
    return {"status": "reset", "seed": engine.seed}

@router.post("/environment/block-aisle")
def block_aisle(edge_id: str = "C-17", engine: SimulationEngine = Depends(get_engine)):
    engine.block_aisle(edge_id)
    db_manager.add_audit_log("FLEET", f"Aisle {edge_id} blocked")
    return {"status": "blocked", "edgeId": edge_id}

@router.post("/environment/clear-aisle")
def clear_aisle(edge_id: str = "C-17", engine: SimulationEngine = Depends(get_engine)):
    engine.clear_aisle(edge_id)
    db_manager.add_audit_log("FLEET", f"Aisle {edge_id} cleared")
    return {"status": "cleared", "edgeId": edge_id}

@router.post("/robots/{robot_id}/fail")
def fail_robot(robot_id: str, engine: SimulationEngine = Depends(get_engine)):
    agent = next((a for a in engine.agents if a.state.id == robot_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail="Robot not found")
    from ..agents.robot_agent import AgentContext
    unassigned_task = agent.force_failure(engine.sim_time, AgentContext(
        now=engine.sim_time, dt=0.1, mode=engine.mode, nodes=engine.nodes, edges=engine.edges,
        tasks=engine.tasks, robots=[a.state for a in engine.agents], blocked_edges=engine.blocked_edges,
        obstacles=engine.obstacles, reservations=engine.reservations, network_online=True,
        reserve=engine.reserve, release=engine.release_reservation, release_owned=engine.release_owned_reservations,
        send=engine.network.send, emit=engine.emit_event, on_task_completed=engine._on_task_completed,
        on_task_unassigned=engine._on_task_unassigned, on_low_battery=engine._on_low_battery
    ))
    db_manager.add_audit_log("FLEET", f"Robot {robot_id} fault simulated", details=f"Task unassigned: {unassigned_task}")
    return {"status": "failed", "robotId": robot_id, "unassignedTask": unassigned_task}

@router.post("/robots/{robot_id}/communication-loss")
def comm_loss(robot_id: str, offline: bool = True, engine: SimulationEngine = Depends(get_engine)):
    agent = next((a for a in engine.agents if a.state.id == robot_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail="Robot not found")
    from ..agents.robot_agent import AgentContext
    agent.force_communication_loss(AgentContext(
        now=engine.sim_time, dt=0.1, mode=engine.mode, nodes=engine.nodes, edges=engine.edges,
        tasks=engine.tasks, robots=[a.state for a in engine.agents], blocked_edges=engine.blocked_edges,
        obstacles=engine.obstacles, reservations=engine.reservations, network_online=not offline,
        reserve=engine.reserve, release=engine.release_reservation, release_owned=engine.release_owned_reservations,
        send=engine.network.send, emit=engine.emit_event, on_task_completed=engine._on_task_completed,
        on_task_unassigned=engine._on_task_unassigned, on_low_battery=engine._on_low_battery
    ), offline)
    db_manager.add_audit_log("FLEET", f"Robot {robot_id} communication loss set to {offline}")
    return {"status": "updated", "robotId": robot_id, "offline": offline}

@router.post("/benchmarks/run", response_model=BenchmarkResultSchema)
def run_benchmark(engine: SimulationEngine = Depends(get_engine)):
    res = engine.run_benchmark()
    db_manager.add_audit_log("BENCHMARK", "Benchmark policy comparison run executed")
    return res

@router.post("/ai/explain")
def ai_explain(req: AIExplainRequest, engine: SimulationEngine = Depends(get_engine)):
    snapshot = engine.get_snapshot().model_dump()
    answer = ai_explanation_service.explain_fleet_event(req.question, snapshot)
    db_manager.add_audit_log("AI", f"AI Explain query: {req.question[:50]}", details=answer[:200])
    return {"question": req.question, "explanation": answer}

@router.post("/knowledge/query")
def query_knowledge(req: KnowledgeQueryRequest):
    results = db_manager.search_knowledge(req.query, limit=req.limit)
    return {"query": req.query, "results": results}
