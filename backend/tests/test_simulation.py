import pytest
from backend.app.planning.warehouse_graph import create_warehouse, get_rack_locations, node_by_id, edge_between
from backend.app.planning.path_planner import plan_route, estimate_route_time
from backend.app.simulation.simulation_engine import SimulationEngine
from backend.app.agents.robot_agent import RobotAgent

def test_warehouse_graph_initialization():
    nodes, edges = create_warehouse()
    assert len(nodes) == 54  # 9 cols x 6 rows
    assert len(edges) == 81  # Valid aisle topology edges (12 vertical shelf-crossing edges excluded)

    c17 = next((e for e in edges if e.id == "C-17"), None)
    assert c17 is not None
    assert c17.narrow is False
    assert c17.capacity == 3
    assert c17.risk == 0.12

def test_path_planner():
    nodes, edges = create_warehouse()
    plan = plan_route("N-0-0", "N-5-8", nodes, edges)
    assert plan is not None
    assert plan.nodes[0] == "N-0-0"
    assert plan.nodes[-1] == "N-5-8"
    assert plan.distance > 0.0

def test_simulation_engine_step():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=10, task_count=10)
    engine.start()
    assert engine.running is True
    assert len(engine.agents) == 10

    # Step simulation 50 ticks (5 seconds simulated time)
    for _ in range(50):
        engine.step(0.1)

    assert engine.sim_time > 0.0
    snapshot = engine.get_snapshot()
    assert len(snapshot.robots) == 10
    assert snapshot.metrics.avgBattery > 0.0

def test_aisle_blocking_and_rerouting():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=6, task_count=6)
    engine.start()
    engine.block_aisle("C-17")
    assert "C-17" in engine.blocked_edges

    for _ in range(30):
        engine.step(0.1)

    snapshot = engine.get_snapshot()
    assert "C-17" in snapshot.blockedEdges

def test_benchmark_execution():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=4, task_count=4)
    result = engine.run_benchmark()
    assert result.timeReduction >= 0.0
    assert result.baseline.completionTime > 0.0
    assert result.nexus.completionTime > 0.0
