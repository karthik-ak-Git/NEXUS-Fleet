import math
import heapq
from typing import List, Dict, Set, Optional
from dataclasses import dataclass
from ..schemas.simulation import WarehouseNodeSchema, WarehouseEdgeSchema, ReservationSchema
from .warehouse_graph import edge_between, node_by_id

@dataclass
class RoutePlan:
    nodes: List[str]
    cost: float
    estimated_time: float
    distance: float

def plan_route(
    start: str,
    goal: str,
    nodes: List[WarehouseNodeSchema],
    edges: List[WarehouseEdgeSchema],
    blocked_nodes: Optional[Set[str]] = None,
    blocked_edges: Optional[Set[str]] = None,
    reservations: Optional[List[ReservationSchema]] = None,
    robot_id: Optional[str] = None,
    avoid_nodes: Optional[Set[str]] = None,
    energy_weight: float = 0.04
) -> Optional[RoutePlan]:
    if start == goal:
        return RoutePlan(nodes=[start], cost=0.0, estimated_time=0.0, distance=0.0)

    node_map = {n.id: n for n in nodes}
    blocked_nodes = blocked_nodes or set()
    blocked_edges = blocked_edges or set()
    reservations = reservations or []
    avoid_nodes = avoid_nodes or set()

    # Priority queue storing tuples of (f_score, node_id)
    frontier = []
    heapq.heappush(frontier, (0.0, start))

    came_from: Dict[str, str] = {}
    cost_so_far: Dict[str, float] = {start: 0.0}
    travel_so_far: Dict[str, float] = {start: 0.0}
    distance_so_far: Dict[str, float] = {start: 0.0}

    goal_node = node_map.get(goal)

    while frontier:
        _, current_id = heapq.heappop(frontier)

        if current_id == goal:
            break

        for edge in edges:
            if edge.from_node == current_id:
                nxt = edge.to_node
            elif edge.to_node == current_id:
                nxt = edge.from_node
            else:
                nxt = None

            if not nxt or edge.blocked or edge.id in blocked_edges or nxt in blocked_nodes:
                continue

            direction_allowed = (
                edge.direction == "both" or
                (edge.direction == "forward" and edge.from_node == current_id) or
                (edge.direction == "reverse" and edge.to_node == current_id)
            )
            if not direction_allowed:
                continue

            is_reserved = any(
                r.status == "ACTIVE" and r.endTime > 0 and r.ownerRobot != robot_id and r.resourceId == nxt
                for r in reservations
            )
            avoided = nxt in avoid_nodes

            travel_time = edge.estimatedTravelTime * (1.0 + max(0.0, edge.congestion) * 1.6 + edge.risk * 0.5)
            occupants = [rid for rid in edge.occupancy if rid != robot_id]
            
            edge_cost = (
                travel_time +
                edge.length * 0.045 +
                edge.congestion * 2.4 +
                edge.risk * 3.0 +
                (22.0 if is_reserved else 0.0) +
                (35.0 if avoided else 0.0) +
                len(occupants) * 4.0 +
                edge.length * energy_weight
            )

            next_cost = cost_so_far[current_id] + edge_cost

            if nxt not in cost_so_far or next_cost < cost_so_far[nxt]:
                came_from[nxt] = current_id
                cost_so_far[nxt] = next_cost
                travel_so_far[nxt] = travel_so_far[current_id] + travel_time
                distance_so_far[nxt] = distance_so_far[current_id] + edge.length

                node_nxt = node_map.get(nxt)
                heuristic = (
                    math.hypot(goal_node.x - node_nxt.x, goal_node.y - node_nxt.y) * 0.25
                    if node_nxt and goal_node else 0.0
                )
                heapq.heappush(frontier, (next_cost + heuristic, nxt))

    if goal not in came_from:
        return None

    path = [goal]
    cursor = goal
    while cursor != start:
        prev = came_from.get(cursor)
        if not prev:
            return None
        path.append(prev)
        cursor = prev
    path.reverse()

    return RoutePlan(
        nodes=path,
        cost=cost_so_far[goal],
        estimated_time=travel_so_far[goal],
        distance=distance_so_far[goal]
    )

def estimate_route_time(route: List[str], nodes: List[WarehouseNodeSchema], edges: List[WarehouseEdgeSchema]) -> float:
    total = 0.0
    for i in range(len(route) - 1):
        edge = edge_between(edges, route[i], route[i+1])
        if edge:
            total += edge.estimatedTravelTime * (1.0 + max(0.0, edge.congestion) * 1.6 + edge.risk * 0.5)
        else:
            a = node_by_id(nodes, route[i])
            b = node_by_id(nodes, route[i+1])
            if a and b:
                total += math.hypot(a.x - b.x, a.y - b.y) / 2.0
    return total

def route_distance(route: List[str], edges: List[WarehouseEdgeSchema]) -> float:
    dist = 0.0
    for i in range(len(route) - 1):
        edge = edge_between(edges, route[i], route[i+1])
        if edge:
            dist += edge.length
    return dist
