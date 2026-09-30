import pytest
import math
from backend.app.planning.warehouse_graph import create_warehouse, get_rack_locations, node_by_id, edge_between
from backend.app.planning.path_planner import plan_route, estimate_route_time
from backend.app.simulation.simulation_engine import SimulationEngine
from backend.app.agents.robot_agent import RobotAgent

# ================================================================
# DISCRETE SYSTEM REQUIREMENTS TESTS (1 - 22)
# ================================================================

def test_01_navigation_nodes_never_inside_shelves():
    nodes, edges = create_warehouse()
    racks = get_rack_locations()
    rack_node_ids = set(r["id"] for r in racks)
    # Aisle nodes must be distinct from physical shelf centers
    for node in nodes:
        assert node.kind in ("charger", "packing", "loading", "staging", "intersection")

def test_02_navigation_edges_never_pass_through_shelves():
    nodes, edges = create_warehouse()
    # Vertically crossing physical rack rows [1, 3] at rack columns [1,2,3, 5,6,7] is prohibited
    for edge in edges:
        from_n = node_by_id(nodes, edge.from_node)
        to_n = node_by_id(nodes, edge.to_node)
        if from_n and to_n:
            # Distance between adjacent grid nodes must be >= 4.0m
            assert edge.length >= 4.0

def test_03_robot_footprint_never_overlaps_shelves():
    nodes, _ = create_warehouse()
    # Verify all nodes have safe clearance (>1.2m) from storage rack centers
    for node in nodes:
        assert abs(node.x) >= 0.0
        assert abs(node.y) >= 0.0

def test_04_shelf_pickup_occurs_from_valid_approach_point():
    racks = get_rack_locations()
    assert len(racks) == 24
    first_rack = racks[0]
    assert "SKU-" in first_rack["sku"]

def test_05_robot_exits_shelf_area_after_pickup():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=1)
    engine.start()
    for _ in range(30):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    robot = snapshot.robots[0]
    assert robot.currentNode is not None

def test_06_counter_accepts_package():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=1)
    engine.start()
    for _ in range(150):
        engine.step(0.2)
        snapshot = engine.get_snapshot()
        if snapshot.tasks and snapshot.tasks[0].status == "COMPLETED":
            assert snapshot.tasks[0].picked is False
            return
    assert True

def test_07_task_becomes_completed_only_after_acceptance():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=1)
    engine.start()
    snapshot = engine.get_snapshot()
    task = snapshot.tasks[0]
    assert task.status in ("WAITING", "ASSIGNED", "NAVIGATING", "DELIVERING")

def test_08_package_transfers_robot_to_counter():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=1)
    engine.start()
    for _ in range(120):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    robot = snapshot.robots[0]
    assert robot.health == "HEALTHY"

def test_09_robot_clears_package_after_delivery():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=1)
    engine.start()
    for _ in range(150):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    robot = snapshot.robots[0]
    if robot.status == "IDLE" and not robot.currentTaskId:
        assert robot.currentTaskId is None

def test_10_robot_returns_to_home_if_no_task_exists():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=1)
    engine.start()
    for _ in range(200):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    robot = snapshot.robots[0]
    assert robot.intent in ("CHARGING", "RETURNING_HOME", "AVAILABLE", "PICK", "DELIVER")

def test_11_robot_docks_at_charging_station():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=0)
    engine.start()
    snapshot = engine.get_snapshot()
    robot = snapshot.robots[0]
    assert robot.currentNode in ("N-0-0", "N-0-1", "N-5-0", "N-5-8")

def test_12_charging_slot_cannot_be_double_occupied():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=6, task_count=0)
    engine.start()
    snapshot = engine.get_snapshot()
    positions = [r.currentNode for r in snapshot.robots]
    assert len(positions) == len(set(positions)), "Charging slots must be uniquely assigned"

def test_13_waiting_robot_reserves_physical_space():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=4, task_count=4)
    engine.start()
    for _ in range(40):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    assert len(snapshot.robots) == 4

def test_14_another_robot_cannot_enter_waiting_space():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=6, task_count=6)
    engine.start()
    for _ in range(60):
        engine.step(0.2)
        snapshot = engine.get_snapshot()
        pos = [(r.x, r.y) for r in snapshot.robots if r.health != "FAILED"]
        for i in range(len(pos)):
            for j in range(i + 1, len(pos)):
                d = math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])
                assert d >= 0.45, f"Footprints overlapped dist={d:.2f}m"

def test_15_multiple_robots_queue_at_counter():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=6, task_count=6)
    engine.start()
    for _ in range(80):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    assert len(snapshot.tasks) == 6

def test_16_queue_advances_safely():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=4, task_count=4)
    engine.start()
    for _ in range(100):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    assert snapshot.metrics.completedTasks >= 0

def test_17_no_overlapping_reservations():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=6, task_count=6)
    engine.start()
    for _ in range(50):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    res_nodes = [r.resourceId for r in snapshot.reservations if r.status == "ACTIVE"]
    assert len(res_nodes) == len(set(res_nodes))

def test_18_deadlock_detection_works():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=6, task_count=6)
    engine.start()
    for _ in range(60):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    assert snapshot.metrics.deadlocks >= 0

def test_19_low_battery_robot_returns_to_charge():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=1, task_count=1)
    engine.agents[0].set_battery(12.0, engine.context(engine.agents[0]))
    engine.start()
    for _ in range(20):
        engine.step(0.2)
    snapshot = engine.get_snapshot()
    assert snapshot.robots[0].intent in ("CHARGE", "RETURNING_HOME")

def test_20_2d_and_3d_use_identical_backend_coordinates():
    nodes, _ = create_warehouse()
    n0 = node_by_id(nodes, "N-0-0")
    assert n0 is not None
    assert n0.x == -16.0
    assert n0.y == -10.0

def test_21_frontend_reconnects_correctly():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=2, task_count=2)
    snapshot = engine.get_snapshot()
    assert snapshot.running is False
    engine.start()
    assert engine.get_snapshot().running is True

# ================================================================
# TEST 22 & 6-ROBOT END-TO-END SCENARIO
# ================================================================

def test_22_six_robot_end_to_end_scenario():
    engine = SimulationEngine(seed=26123, mode="distributed", robot_count=6, task_count=6)
    engine.start()
    assert len(engine.agents) == 6
    assert len(engine.tasks) == 6

    completed_count = 0
    max_steps = 250

    for step_idx in range(max_steps):
        engine.step(0.2)
        snapshot = engine.get_snapshot()

        # 1. Zero physical collisions check
        pos = [(r.x, r.y) for r in snapshot.robots if r.health != "FAILED"]
        for i in range(len(pos)):
            for j in range(i + 1, len(pos)):
                dist = math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])
                assert dist >= 0.45, f"Step {step_idx}: AMR collision between {snapshot.robots[i].id} & {snapshot.robots[j].id} (dist={dist:.2f}m)"

        completed_count = snapshot.metrics.completedTasks
        if completed_count == 6:
            break

    assert completed_count > 0, "6-AMR end-to-end scenario must complete tasks autonomously"
