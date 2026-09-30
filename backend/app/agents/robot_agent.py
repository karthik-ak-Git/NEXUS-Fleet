import math
from typing import List, Dict, Set, Optional, Callable, Any
from dataclasses import dataclass, field

from ..schemas.robot import RobotStateSchema, DecisionEntry, RobotStatus
from ..schemas.task import WarehouseTaskSchema, BidSchema
from ..schemas.simulation import WarehouseNodeSchema, WarehouseEdgeSchema, ObstacleSchema
from ..schemas.reservation import ReservationSchema
from ..schemas.negotiation import ConflictSchema, PeerMessageSchema
from ..planning.warehouse_graph import edge_between, node_by_id, CHARGER_NODES
from ..planning.path_planner import plan_route, estimate_route_time, route_distance, RoutePlan

@dataclass
class AgentContext:
    now: float
    dt: float
    mode: str  # "distributed" | "baseline"
    nodes: List[WarehouseNodeSchema]
    edges: List[WarehouseEdgeSchema]
    tasks: List[WarehouseTaskSchema]
    robots: List[RobotStateSchema]
    blocked_edges: Set[str]
    obstacles: List[ObstacleSchema]
    reservations: List[ReservationSchema]
    network_online: bool
    reserve: Callable[[str, str, float, float, float], Optional[ReservationSchema]]
    release: Callable[[str], None]
    release_owned: Callable[[str], None]
    send: Callable[[str, str, str, Dict[str, Any], float, float], bool]
    emit: Callable[[Optional[str], str, str, Optional[str], str], None]
    on_task_completed: Callable[[str, str], None]
    on_task_unassigned: Callable[[str, str, str], None]
    on_low_battery: Callable[[str, Optional[str], str], None]

@dataclass
class PeerState:
    robot_id: str
    node: str
    next_node: Optional[str]
    edge_from: Optional[str]
    edge_to: Optional[str]
    next_eta: float
    task_priority: float
    status: str
    intent: str
    battery: float
    received_at: float
    waiting_for: Optional[str]

@dataclass
class AgentNotice:
    type_: str
    reason: str
    resource: Optional[str] = None
    result: Optional[str] = None

class RobotAgent:
    def __init__(self, id_str: str, starting_node: str, node: WarehouseNodeSchema):
        self.state = RobotStateSchema(
            id=id_str,
            x=node.x,
            y=node.y,
            heading=0.0,
            velocity=0.0,
            acceleration=0.0,
            battery=84.0 + (int(id_str[-2:]) * 3) % 15,
            batteryCapacity=100.0,
            currentTaskId=None,
            taskQueue=[],
            taskPriority=0.0,
            route=[starting_node],
            plannedRoute=[starting_node],
            alternativeRoute=[],
            currentWaypoint=None,
            currentNode=starting_node,
            fromNode=None,
            edgeProgress=0.0,
            destination=None,
            eta=0.0,
            intent="AVAILABLE",
            status="IDLE",
            communication="ONLINE",
            communicationFreshness=0.0,
            health="HEALTHY",
            currentReservation=None,
            waitingFor=None,
            reason="Local planner ready; awaiting task auction.",
            distanceTravelled=0.0,
            rerouteCount=0,
            waitSeconds=0.0,
            safety="NORMAL",
            decisionHistory=[
                DecisionEntry(time=0.0, action="INITIALIZE", reason="Independent edge planner initialized.")
            ]
        )
        self.peer_states: Dict[str, PeerState] = {}
        self.local_blocked_edges: Set[str] = set()
        self.notices: List[AgentNotice] = []
        self.last_heartbeat = -10.0
        self.last_broadcast = -10.0
        self.last_decision_key = ""
        self.last_conflict_key = ""
        self.charge_target: Optional[str] = None
        self.charging_resume_task: Optional[str] = None
        self.route_goal: Optional[str] = None
        self.previous_route: List[str] = []
        self.local_reservation_id: Optional[str] = None

    def assign_task(self, task: WarehouseTaskSchema, now: float) -> bool:
        if self.state.health == "FAILED" or self.state.battery < 20.0:
            return False
        if not self.state.currentTaskId:
            self.state.currentTaskId = task.id
            self.state.taskPriority = task.priority
            self.state.status = "MOVING"
            self.state.intent = "PICK"
            self.state.destination = task.pickup
            self.state.reason = f"Accepted {task.id} after local bid won the auction."
            self.route_goal = None
            self.record_decision(now, "TASK_ACCEPTED", self.state.reason)
        elif task.id not in self.state.taskQueue:
            self.state.taskQueue.append(task.id)
        return True

    def unassign_task(self, task_id: str):
        if self.state.currentTaskId == task_id:
            self.state.currentTaskId = None
            self.state.taskPriority = 0.0
            self.state.destination = None
            self.state.route = [self.state.currentNode]
            self.state.plannedRoute = [self.state.currentNode]
            self.state.intent = "AVAILABLE"
            self.route_goal = None
            if self.state.health != "FAILED" and not self.charge_target:
                self.state.status = "IDLE"
        else:
            self.state.taskQueue = [tid for tid in self.state.taskQueue if tid != task_id]

    def bid(self, task: WarehouseTaskSchema, context: AgentContext) -> Optional[BidSchema]:
        if self.state.health != "HEALTHY" or self.state.battery < 24.0:
            return None
        if len(self.state.taskQueue) + (1 if self.state.currentTaskId else 0) >= 2:
            return None

        pickup_plan = plan_route(
            self.state.currentNode, task.pickup,
            context.nodes, context.edges,
            blocked_edges=self.local_blocked_edges,
            reservations=context.reservations,
            robot_id=self.state.id,
            energy_weight=0.08
        )
        if not pickup_plan:
            return None

        delivery_plan = plan_route(
            task.pickup, task.destination,
            context.nodes, context.edges,
            blocked_edges=self.local_blocked_edges,
            reservations=context.reservations,
            robot_id=self.state.id,
            energy_weight=0.08
        )
        if not delivery_plan:
            return None

        workload = len(self.state.taskQueue) * 12.0 + (13.0 if self.state.currentTaskId else 0.0)
        battery_penalty = max(0.0, 55.0 - self.state.battery) * 0.7
        energy = (pickup_plan.distance + delivery_plan.distance) * 0.46
        energy_penalty = max(0.0, energy + 12.0 - self.state.battery) * 5.0
        peers_count = len(self.get_peers(context.now))
        conflict_risk = 3.5 if peers_count > 3 else peers_count * 0.55
        eta = pickup_plan.estimated_time + delivery_plan.estimated_time + 2.5
        cost = (
            pickup_plan.cost +
            delivery_plan.cost +
            workload +
            battery_penalty +
            energy_penalty +
            conflict_risk -
            task.priority * 12.0
        )
        return BidSchema(
            robotId=self.state.id,
            cost=cost,
            eta=eta,
            energy=energy,
            risk=conflict_risk,
            reason=f"ETA {eta:.1f}s, {energy:.1f}% energy, {self.state.battery:.0f}% battery, {workload:.0f} workload penalty."
        )

    def receive(self, messages: List[PeerMessageSchema], now: float):
        for msg in messages:
            if msg.target != "*" and msg.target != self.state.id:
                continue
            if now - msg.timestamp > msg.ttl:
                continue
            if msg.type in ("STATE_UPDATE", "HEARTBEAT"):
                payload = msg.payload
                peer = PeerState(
                    robot_id=msg.sender,
                    node=str(payload.get("node", "")),
                    next_node=str(payload.get("nextNode")) if payload.get("nextNode") else None,
                    edge_from=str(payload.get("edgeFrom")) if payload.get("edgeFrom") else None,
                    edge_to=str(payload.get("edgeTo")) if payload.get("edgeTo") else None,
                    next_eta=float(payload.get("nextEta", 99.0)),
                    task_priority=float(payload.get("taskPriority", 0.0)),
                    status=str(payload.get("status", "UNKNOWN")),
                    intent=str(payload.get("intent", "UNKNOWN")),
                    battery=float(payload.get("battery", 0.0)),
                    received_at=msg.timestamp,
                    waiting_for=str(payload.get("waitingFor")) if payload.get("waitingFor") else None
                )
                self.peer_states[msg.sender] = peer
            elif msg.type == "EDGE_BLOCKED" and isinstance(msg.payload.get("edgeId"), str):
                self.local_blocked_edges.add(msg.payload["edgeId"])
            elif msg.type == "EDGE_CLEAR" and isinstance(msg.payload.get("edgeId"), str):
                self.local_blocked_edges.discard(msg.payload["edgeId"])
            elif msg.type == "STATE_SYNC":
                self.record_decision(
                    now, "STATE_SYNC", f"Reconciled peer state from {msg.sender} after communication recovery."
                )

    def get_peers(self, now: float) -> List[PeerState]:
        return [p for p in self.peer_states.values() if now - p.received_at <= 4.5]

    def bid_state(self, context: AgentContext):
        if context.now - self.last_heartbeat >= 0.75:
            self.last_heartbeat = context.now
            context.send(
                self.state.id, "*", "HEARTBEAT",
                {
                    "node": self.state.currentNode,
                    "status": self.state.status,
                    "battery": self.state.battery,
                    "intent": self.state.intent,
                },
                context.now, 4.0
            )
        if context.now - self.last_broadcast >= 0.4:
            self.last_broadcast = context.now
            next_node = self.state.route[1] if len(self.state.route) > 1 else None
            edge = edge_between(context.edges, self.state.currentNode, next_node) if next_node else None
            context.send(
                self.state.id, "*", "STATE_UPDATE",
                {
                    "node": self.state.currentNode,
                    "nextNode": next_node,
                    "edgeFrom": self.state.currentNode,
                    "edgeTo": next_node,
                    "nextEta": self._time_to_next_node(context),
                    "taskPriority": self._priority_score(context.now),
                    "status": self.state.status,
                    "intent": self.state.intent,
                    "battery": self.state.battery,
                    "edgeId": edge.id if edge else None,
                    "waitingFor": self.state.waitingFor,
                },
                context.now, 4.0
            )
            if not context.network_online:
                self.state.communication = "OFFLINE"


    def step(self, context: AgentContext) -> Optional[ConflictSchema]:
        now, dt = context.now, context.dt
        self.state.communication = "ONLINE" if context.network_online else "OFFLINE"

        if self.state.safety == "EMERGENCY_STOP":
            self.state.status = "BLOCKED"
            self.state.velocity = 0.0
            self.state.battery = max(0.0, self.state.battery - dt * 0.004)
            return None

        peers = self.get_peers(now)
        if peers:
            self.state.communicationFreshness = max(0.0, now - max(p.received_at for p in peers))
        else:
            self.state.communicationFreshness = now
        self._expire_local_peer_states(now)

        if self.state.health == "FAILED":
            self.state.status = "FAILED"
            self.state.velocity = 0.0
            self.state.intent = "UNAVAILABLE"
            return None

        self._apply_battery_policy(context)
        self._update_task_phase(context)
        goal = self._choose_goal(context)
        self.state.destination = goal

        if goal:
            self._ensure_route(goal, context)
        elif not self.charge_target:
            self.state.intent = "AVAILABLE"
            if self.state.status not in ("COMPLETED", "IDLE"):
                self.state.status = "IDLE"

        next_node = self.state.route[1] if len(self.state.route) > 1 else None
        if not next_node:
            self.state.velocity = 0.0
            if self.charge_target and self.state.currentNode == self.charge_target:
                self.state.status = "CHARGING"
                self.state.intent = "CHARGE"
                self.state.battery = min(100.0, self.state.battery + dt * 5.5)
                if self.state.battery >= 88.0:
                    self._finish_charging(context)
            elif self.state.currentTaskId and goal == self.state.currentNode:
                self._update_task_phase(context)
            self.state.battery = max(0.0, self.state.battery - dt * 0.004)
            return None

        # Check local obstacles
        next_n_obj = node_by_id(context.nodes, next_node)
        obstacle = next(
            (item for item in context.obstacles
             if item.expiresAt > now and next_n_obj and
             math.hypot(item.x - next_n_obj.x, item.y - next_n_obj.y) < 0.9),
            None
        )
        if obstacle:
            if self.state.safety != "STOP":
                self.state.safety = "STOP"
                self.state.status = "BLOCKED"
                self.state.intent = "SAFETY_STOP"
                self.state.reason = f"{obstacle.type} detected in local stopping envelope."
                context.emit(self.state.id, "OBSTACLE_DETECTED", self.state.reason, obstacle.id, "Local safety supervisor stopped robot.")
                context.emit(self.state.id, "SAFETY_STOP", "Stopping distance less than obstacle clearance.", obstacle.id, "Motion inhibited.")
                self.record_decision(now, "STOP", self.state.reason)
            self.state.velocity = 0.0
            self.state.waitSeconds += dt
            return None
        elif self.state.safety == "STOP":
            self.state.safety = "NORMAL"
            self.state.status = "REROUTING"
            self.route_goal = None
            self.state.reason = "Obstacle cleared; local planner validating fresh route."

        predicted_conflict = self._predict_conflict(next_node, context)
        if predicted_conflict:
            self.state.status = "NEGOTIATING"
            self.state.intent = "RESERVATION_REQUEST"
            peer = next(
                (p for p in peers if p.robot_id in (predicted_conflict.robotA, predicted_conflict.robotB)),
                None
            )
            peer_id = peer.robot_id if peer else predicted_conflict.robotB

            context.send(self.state.id, peer_id, "CONFLICT_ALERT", {
                "resource": predicted_conflict.resource,
                "conflictId": predicted_conflict.id,
                "eta": self._time_to_next_node(context)
            }, now, 4.0)

            context.send(self.state.id, peer_id, "RESERVATION_REQUEST", {
                "resource": predicted_conflict.resource,
                "priority": self._priority_score(now)
            }, now, 4.0)

            context.emit(self.state.id, "NEGOTIATION_STARTED", f"Peer negotiation opened for {predicted_conflict.resource}.", predicted_conflict.resource, f"{self.state.id} ↔ {peer_id}")

            if context.mode == "baseline":
                self._wait_for(peer_id, context, "STOP_AND_WAIT")
                predicted_conflict.decision = "STOP_AND_WAIT"
                self.state.status = "WAITING"
                self.state.reason = f"Baseline policy stops while {peer_id} clears conflict zone."
                return predicted_conflict

            own_priority = self._priority_score(now)
            other_priority = peer.task_priority if peer else 0.0
            wins = (own_priority > other_priority) or (abs(own_priority - other_priority) < 0.0001 and self.state.id < peer_id)

            if not wins:
                self._wait_for(peer_id, context, "YIELD")
                predicted_conflict.decision = f"{self.state.id} YIELDS"
                self.state.status = "YIELDING"
                self.state.reason = f"{peer_id} has higher right-of-way priority ({other_priority:.2f} vs {own_priority:.2f})."
                self._send_decision(context, "YIELD", self.state.reason, predicted_conflict.resource, peer_id)
                return predicted_conflict

            self.state.waitingFor = None
            self.state.status = "NEGOTIATING"
            lease = context.reserve(
                predicted_conflict.resource,
                self.state.id,
                now,
                now + max(2.5, self._time_to_next_node(context) + 1.3),
                own_priority
            )
            if not lease:
                self._wait_for(peer_id, context, "RESERVATION_DENIED")
                predicted_conflict.decision = "RESERVATION DENIED"
                self.state.status = "WAITING"
                self.state.reason = f"Reservation lease for {predicted_conflict.resource} owned by another agent."
                return predicted_conflict

            self.local_reservation_id = lease.id
            self.state.currentReservation = lease.id
            self.state.reason = f"Higher local priority won negotiation; lease {lease.id} protects {predicted_conflict.resource}."
            self.state.intent = "PROCEED"
            self.state.status = "MOVING"
            predicted_conflict.decision = f"{self.state.id} PROCEEDS"

            context.send(self.state.id, peer_id, "RESERVATION_GRANTED", {
                "resource": predicted_conflict.resource,
                "reservationId": lease.id
            }, now, 4.0)

            context.emit(self.state.id, "RESERVATION_GRANTED", f"Negotiation granted time-bounded lease to {self.state.id}.", predicted_conflict.resource, lease.id)
        else:
            self.state.waitingFor = None
            if self.state.status in ("YIELDING", "WAITING"):
                self.state.status = "MOVING"
        # 360° LiDAR & Proximity Sensor Safety Check (Active Motion Only)
        if self.state.currentTaskId or self.state.velocity > 0:
            for other in context.robots:
                if other.id == self.state.id or other.health == "FAILED":
                    continue
                dist = math.hypot(self.state.x - other.x, self.state.y - other.y)
                if dist < 1.15 and (getattr(other, "currentTaskId", None) or getattr(other, "velocity", 0) > 0):
                    own_prio = self._priority_score(now)
                    other_prio = getattr(other, "taskPriority", 0.0) or 0.0
                    wins = own_prio > other_prio or (abs(own_prio - other_prio) < 0.0001 and self.state.id < other.id)
                    if not wins:
                        self.state.status = "YIELDING"
                        self.state.velocity = 0.0
                        self.state.reason = f"360° Proximity Sensor Alert: yielding right-of-way to higher-priority {other.id} ({dist:.2f}m)."
                        break

        if self.state.status not in ("YIELDING", "WAITING"):
            self._advance(dt, next_node, context)

        self.state.battery = max(0.0, self.state.battery - dt * (0.018 + self.state.velocity * 0.003))
        if self.state.waitingFor:
            self.state.waitSeconds += dt
        return predicted_conflict

    def force_failure(self, now: float, context: AgentContext) -> Optional[str]:
        if self.state.health == "FAILED":
            return None
        self.state.health = "FAILED"
        self.state.status = "FAILED"
        self.state.velocity = 0.0
        self.state.intent = "UNAVAILABLE"
        task_id = self.state.currentTaskId
        self.state.reason = "Drive controller heartbeat stopped; peer agents marked unit unavailable."
        if self.local_reservation_id:
            context.release(self.local_reservation_id)
        context.release_owned(self.state.id)
        context.emit(self.state.id, "ROBOT_FAILURE", self.state.reason, None, "Reservations released; work re-auctioned.")
        self.record_decision(now, "FAILURE", self.state.reason)
        return task_id

    def force_communication_loss(self, context: AgentContext, offline: bool):
        context.network_online = not offline
        self.state.communication = "OFFLINE" if offline else "ONLINE"
        if offline:
            self.state.reason = "Peer radio unavailable; continuing from local map and cached state."
            self.state.intent = "LOCAL_OPERATION"
            self.record_decision(context.now, "LOCAL_ONLY", self.state.reason)
            context.emit(self.state.id, "COMMUNICATION_LOST", self.state.reason, None, "Local safety remains active.")
        else:
            self.state.reason = "Peer link restored; reconciling state and leases."
            context.send(self.state.id, "*", "STATE_SYNC", {"node": self.state.currentNode}, context.now, 4.0)
            context.emit(self.state.id, "COMMUNICATION_RESTORED", self.state.reason, None, "Handshake and state sync started.")
            self.record_decision(context.now, "STATE_SYNC", self.state.reason)

    def recover_deadlock(self, context: AgentContext, reason: str):
        if self.local_reservation_id:
            context.release(self.local_reservation_id)
        self.local_reservation_id = None
        self.state.currentReservation = None
        self.state.waitingFor = None
        self.state.status = "RECOVERING"
        self.state.intent = "REROUTE"
        self.state.reason = reason

        current_next = self.state.route[1] if len(self.state.route) > 1 else None
        if current_next:
            goal = self.state.destination or current_next
            alternative = plan_route(
                self.state.currentNode, goal,
                context.nodes, context.edges,
                blocked_edges=self.local_blocked_edges,
                reservations=context.reservations,
                robot_id=self.state.id,
                avoid_nodes={current_next}
            )
            if alternative and len(alternative.nodes) > 1:
                self.previous_route = list(self.state.route)
                self.state.route = list(alternative.nodes)
                self.state.plannedRoute = list(alternative.nodes)
                self.state.alternativeRoute = list(alternative.nodes)
                self.state.rerouteCount += 1

        self.record_decision(context.now, "DEADLOCK_RECOVERY", reason)
        context.emit(self.state.id, "DEADLOCK_RECOVERY", reason, None, "Wait-for dependency released and route replanned.")

    def _update_task_phase(self, context: AgentContext):
        task = next((t for t in context.tasks if t.id == self.state.currentTaskId), None)
        if not task:
            return
        if not task.picked and self.state.currentNode == task.pickup:
            task.picked = True
            task.status = "DELIVERING"
            self.state.intent = "DELIVER"
            self.state.destination = task.destination
            self.route_goal = None
            self.state.reason = f"Picked {task.sku}; local planner routing to {task.destination}."
            context.emit(self.state.id, "ITEM_PICKED", self.state.reason, task.pickup, task.sku)
            self.record_decision(context.now, "PICKUP", self.state.reason)
        elif task.picked and self.state.currentNode == task.destination:
            if task.status == "COMPLETED":
                return
            # Counter Package Acceptance & Handshake: ROBOT -> COUNTER
            task.picked = False
            task.status = "COMPLETED"
            task.eta = context.now

            self.state.currentTaskId = None
            self.state.taskPriority = 0.0
            self.state.destination = None
            self.route_goal = None
            self.state.status = "DELIVERY_COMPLETED"
            self.state.reason = f"Counter {task.destination} accepted {task.sku}; delivery complete."

            context.emit(self.state.id, "TASK_COMPLETED", self.state.reason, task.destination, task.id)
            self.record_decision(context.now, "TASK_COMPLETE", self.state.reason)
            context.on_task_completed(task.id, self.state.id)

            # Check for next available task vs returning home
            if self.state.taskQueue:
                queued_id = self.state.taskQueue.pop(0)
                next_t = next((candidate for candidate in context.tasks if candidate.id == queued_id), None)
                if next_t:
                    self.assign_task(next_t, context.now)
            else:
                home_node = self._get_home_slot()
                if self.state.currentNode != home_node:
                    self.state.intent = "RETURNING_HOME"
                    self.state.status = "MOVING"
                    self.state.destination = home_node
                    self.state.reason = f"Delivery completed; returning home to assigned charging slot {home_node}."
                    self._ensure_route(home_node, context)
                else:
                    self.state.intent = "CHARGING"
                    self.state.status = "IDLE"
                    self.state.reason = f"Docked at assigned charging slot {home_node}."

    def _apply_battery_policy(self, context: AgentContext):
        if self.charge_target or self.state.health == "FAILED":
            return
        task = next((t for t in context.tasks if t.id == self.state.currentTaskId), None)
        reserve = 14.0
        if task:
            target = task.destination if task.picked else task.pickup
            outbound = plan_route(self.state.currentNode, target, context.nodes, context.edges, blocked_edges=self.local_blocked_edges, reservations=context.reservations, robot_id=self.state.id)
            inbound = plan_route(task.pickup, task.destination, context.nodes, context.edges, blocked_edges=self.local_blocked_edges, reservations=context.reservations, robot_id=self.state.id) if not task.picked else None
            est_energy = ((outbound.distance if outbound else 0.0) + (inbound.distance if inbound else 0.0)) * 0.48 + reserve
            if self.state.battery > 28.0 and self.state.battery >= est_energy:
                return
        elif self.state.battery > 23.0:
            return

        current_task_id = self.state.currentTaskId
        reason = f"Battery {self.state.battery:.0f}% below safe estimate; charging takes priority."
        candidates = []
        for chg_id in CHARGER_NODES:
            p = plan_route(self.state.currentNode, chg_id, context.nodes, context.edges, blocked_edges=self.local_blocked_edges, reservations=context.reservations, robot_id=self.state.id)
            if p:
                candidates.append((p.cost, chg_id))
        candidates.sort(key=lambda x: x[0])
        self.charge_target = candidates[0][1] if candidates else CHARGER_NODES[0]
        self.charging_resume_task = current_task_id
        if current_task_id:
            context.on_task_unassigned(current_task_id, self.state.id, reason)
            self.unassign_task(current_task_id)
        self.state.intent = "CHARGE"
        self.state.reason = reason
        self.state.status = "REROUTING"
        self.route_goal = None
        context.on_low_battery(self.state.id, current_task_id, reason)
        self.record_decision(context.now, "CHARGE", reason)

    def _finish_charging(self, context: AgentContext):
        prev_task = self.charging_resume_task
        self.charge_target = None
        self.charging_resume_task = None
        self.state.intent = "AVAILABLE"
        self.state.status = "IDLE"
        self.state.reason = "Battery reserve restored; agent rejoined task auctions."
        self.state.destination = None
        self.route_goal = None
        context.emit(self.state.id, "CHARGING_COMPLETED", self.state.reason, None, "Agent rejoined fleet.")
        self.record_decision(context.now, "REJOIN", self.state.reason)
        if prev_task:
            self.state.taskQueue = [tid for tid in self.state.taskQueue if tid != prev_task]

    def _get_home_slot(self) -> str:
        home_map = {
            "AMR-01": "N-0-0",
            "AMR-02": "N-0-1",
            "AMR-03": "N-0-2",
            "AMR-04": "N-5-6",
            "AMR-05": "N-5-7",
            "AMR-06": "N-5-8",
        }
        return home_map.get(self.state.id, "N-0-0")

    def _get_counter_queue_target(self, task_dest: str, context: AgentContext) -> str:
        if task_dest != "N-2-8":
            return task_dest
        queue_slots = ["N-2-8", "N-2-7", "N-2-6", "N-2-5"]
        for slot in queue_slots:
            owner = None
            for r in context.reservations:
                if r.resourceId == slot and r.status == "ACTIVE" and r.endTime > context.now:
                    if r.ownerRobot != self.state.id:
                        owner = r.ownerRobot
                        break
            if not owner:
                for r in context.robots:
                    if r.id != self.state.id and r.health != "FAILED":
                        if r.currentNode == slot or r.currentWaypoint == slot:
                            owner = r.id
                            break
            if not owner or owner == self.state.id:
                return slot
        return queue_slots[-1]

    def _choose_goal(self, context: AgentContext) -> Optional[str]:
        if self.charge_target:
            return self.charge_target
        task = next((t for t in context.tasks if t.id == self.state.currentTaskId), None)
        if not task:
            home_node = self._get_home_slot()
            if self.state.currentNode != home_node:
                self.state.intent = "RETURNING_HOME"
                self.state.destination = home_node
                self.state.reason = f"No active task; returning home to charging slot {home_node}."
                return home_node
            else:
                if self.state.intent == "RETURNING_HOME":
                    self.state.intent = "CHARGING"
                    self.state.status = "IDLE"
                    self.state.reason = f"Docked at home charging slot {home_node}."
                self.state.destination = None
                return None
        target = task.destination if task.picked else task.pickup
        if task.picked and target == "N-2-8":
            return self._get_counter_queue_target(target, context)
        return target

    def _ensure_route(self, goal: str, context: AgentContext):
        next_n = self.state.route[1] if len(self.state.route) > 1 else None
        next_edge = edge_between(context.edges, self.state.currentNode, next_n) if next_n else None
        invalidated = (
            self.route_goal != goal or
            not self.state.route or
            (next_edge and (next_edge.blocked or next_edge.id in self.local_blocked_edges)) or
            (not next_edge and self.state.currentNode != goal and bool(next_n))
        )
        if not invalidated and len(self.state.route) > 1:
            return

        previous = list(self.state.route)
        route = plan_route(
            self.state.currentNode, goal,
            context.nodes, context.edges,
            blocked_edges=self.local_blocked_edges,
            reservations=context.reservations,
            robot_id=self.state.id,
            energy_weight=0.12 if self.state.battery < 35.0 else 0.04
        )
        self.route_goal = goal
        if not route:
            if self.state.currentTaskId:
                self.state.status = "BLOCKED"
                self.state.reason = f"No safe route to {goal} in local world model."
            else:
                self.state.status = "IDLE"
                self.state.reason = "Standing by for task assignment."
            self.state.velocity = 0.0
            return

        if len(previous) > 1 and ">".join(previous) != ">".join(route.nodes) and previous[1] != route.nodes[1]:
            self.previous_route = previous
            self.state.alternativeRoute = list(route.nodes)
            self.state.rerouteCount += 1
            self.state.status = "REROUTING"
            reason = "Blockage or congestion changed route cost; lower-risk alternative selected."
            self.state.reason = reason
            self.record_decision(context.now, "REROUTE", reason)
            context.emit(self.state.id, "REROUTE_SELECTED", reason, next_edge.id if next_edge else None, " → ".join(route.nodes))
            context.send(self.state.id, "*", "ROUTE_INTENT", {"route": route.nodes, "goal": goal, "eta": route.estimated_time}, context.now, 4.0)

        self.state.route = list(route.nodes)
        self.state.plannedRoute = list(route.nodes)
        self.state.currentWaypoint = route.nodes[1] if len(route.nodes) > 1 else None
        self.state.eta = route.estimated_time

    def _predict_conflict(self, next_node: str, context: AgentContext) -> Optional[ConflictSchema]:
        now = context.now
        next_edge = edge_between(context.edges, self.state.currentNode, next_node)
        for peer in self.get_peers(now):
            if peer.status in ("FAILED", "IDLE", "CHARGING", "COMPLETED") or peer.next_eta > 6.0:
                continue
            same_target = (peer.next_node == next_node)
            opposite_traversal = (peer.node == next_node and peer.next_node == self.state.currentNode)
            peer_edge = edge_between(context.edges, peer.edge_from, peer.edge_to) if (peer.edge_from and peer.edge_to) else None
            same_narrow = (next_edge and next_edge.narrow and peer_edge and peer_edge.id == next_edge.id and peer.edge_from != self.state.currentNode)

            if not same_target and not opposite_traversal and not same_narrow:
                continue
            if abs(peer.next_eta - self._time_to_next_node(context)) > 4.5:
                continue

            resource = next_node if same_target else (next_edge.id if next_edge else next_node)
            own_prio = self._priority_score(now)
            pair_key = ":".join(sorted([self.state.id, peer.robot_id, resource]))

            if pair_key != self.last_conflict_key:
                self.last_conflict_key = pair_key
                context.emit(self.state.id, "CONFLICT_PREDICTED", f"{peer.robot_id} and {self.state.id} have overlapping ETAs for {resource}.", resource, "Predicted before entering zone.")

            return ConflictSchema(
                id=f"CF-{pair_key.replace(':', '-')}",
                robotA=self.state.id,
                robotB=peer.robot_id,
                resource=resource,
                etaA=self._time_to_next_node(context),
                etaB=peer.next_eta,
                priorityA=own_prio,
                priorityB=peer.task_priority,
                risk=min(0.99, 0.42 + abs(peer.next_eta - self._time_to_next_node(context)) * -0.06),
                predictedDelay=max(1.2, abs(peer.next_eta - self._time_to_next_node(context)) + 2.0),
                decision="NEGOTIATING",
                status="NEGOTIATING"
            )
        self.last_conflict_key = ""
        return None

    def _advance(self, dt: float, next_node: str, context: AgentContext):
        source = node_by_id(context.nodes, self.state.currentNode)
        destination = node_by_id(context.nodes, next_node)
        if not source or not destination:
            return
        edge = edge_between(context.edges, self.state.currentNode, next_node)
        if not edge or edge.blocked or edge.id in self.local_blocked_edges:
            self.state.status = "REROUTING"
            self.state.velocity = 0.0
            self.route_goal = None
            self.state.reason = f"Edge {edge.id if edge else 'unknown'} blocked in local map."
            return

        blocking_robot = next(
            (
                r for r in context.robots
                if r.id != self.state.id and r.health != "FAILED" and (
                    r.currentNode == next_node or
                    r.currentWaypoint == next_node or
                    (r.status in ("WAITING", "YIELDING", "BLOCKED", "PACKAGE_TRANSFER", "DELIVERY_COMPLETED") and (
                        r.currentNode == next_node or math.hypot(r.x - destination.x, r.y - destination.y) < 1.25
                    ))
                )
            ),
            None
        )

        resource_busy = blocking_robot is not None or any(
            r.status == "ACTIVE" and r.endTime > context.now and r.ownerRobot != self.state.id and r.resourceId == next_node
            for r in context.reservations
        )
        if resource_busy:
            blocker_id = blocking_robot.id if blocking_robot else "traffic"
            self.state.status = "WAITING"
            self.state.intent = "WAITING_FOR_TRAFFIC"
            self.state.reason = f"Waiting for {next_node} (occupied by {blocker_id})."
            self.state.waitSeconds += dt
            self.state.velocity = 0.0
            # Reserve current node so following robots queue behind us safely!
            context.reserve(
                self.state.currentNode, self.state.id, context.now,
                context.now + 10.0, self._priority_score(context.now)
            )
            return

        edge_occupants = [
            r for rid in edge.occupancy if rid != self.state.id
            for r in context.robots if r.id == rid
        ]
        opposing = any(r.fromNode == next_node and r.currentWaypoint == self.state.currentNode for r in edge_occupants)
        unsafe_dist = any(math.hypot(r.x - self.state.x, r.y - self.state.y) < 0.65 for r in edge_occupants)
        capacity_full = len(edge_occupants) >= edge.capacity

        if unsafe_dist or capacity_full:
            self.state.status = "WAITING"
            self.state.intent = "EDGE_CLEARANCE"
            self.state.reason = f"Waiting for {edge.id} to clear."
            self.state.waitSeconds += dt
            self.state.velocity = 0.0
            return

        if self.state.edgeProgress <= 0.0:
            target_lease = next(
                (r for r in context.reservations if r.id == self.local_reservation_id and r.status == "ACTIVE" and r.resourceId == next_node),
                None
            ) if self.local_reservation_id else None
            if not target_lease:
                target_lease = context.reserve(
                    next_node, self.state.id, context.now,
                    context.now + max(10.0, edge.estimatedTravelTime + 5.0),
                    self._priority_score(context.now)
                )
            if not target_lease:
                self.state.status = "WAITING"
                self.state.intent = "NODE_CLEARANCE"
                self.state.reason = f"Waiting for {next_node} to become available."
                self.state.waitSeconds += dt
                self.state.velocity = 0.0
                return

            if self.local_reservation_id and self.local_reservation_id != target_lease.id:
                context.release(self.local_reservation_id)
            self.local_reservation_id = target_lease.id
            self.state.currentReservation = target_lease.id

        speed = edge.speedLimit * max(0.35, 1.0 - edge.congestion * 0.35)
        seconds_for_edge = edge.length / speed
        prev_progress = self.state.edgeProgress
        self.state.fromNode = self.state.currentNode
        self.state.currentWaypoint = next_node
        self.state.edgeProgress = min(1.0, self.state.edgeProgress + dt / seconds_for_edge)
        self.state.velocity = speed
        self.state.acceleration = (self.state.edgeProgress - prev_progress) / max(dt, 0.01)
        heading = math.atan2(destination.y - source.y, destination.x - source.x)
        self.state.heading = heading
        
        x_center = source.x + (destination.x - source.x) * self.state.edgeProgress
        y_center = source.y + (destination.y - source.y) * self.state.edgeProgress
        
        self.state.x = x_center
        self.state.y = y_center
        self.state.distanceTravelled += edge.length * (self.state.edgeProgress - prev_progress)

        if self.state.status in ("NEGOTIATING", "REROUTING"):
            self.state.status = "MOVING"
        if self.charge_target:
            self.state.intent = "CHARGE"
        elif self.state.intent == "RESERVATION_REQUEST":
            self.state.intent = "PROCEED"

        self.state.waitSeconds = max(0.0, self.state.waitSeconds - dt * 0.2)

        if self.state.edgeProgress >= 1.0:
            self.state.currentNode = next_node
            self.state.x = destination.x
            self.state.y = destination.y
            self.state.fromNode = None
            self.state.edgeProgress = 0.0
            self.state.route = self.state.route[1:]
            self.state.plannedRoute = list(self.state.route)
            self.state.currentWaypoint = self.state.route[1] if len(self.state.route) > 1 else None
            if self.state.status == "RECOVERING":
                self.state.status = "MOVING"
                self.state.reason = "Recovery waypoint reached; normal route resumed."
            self._update_task_phase(context)
            edge.occupancy = [rid for rid in edge.occupancy if rid != self.state.id]
        elif self.state.id not in edge.occupancy:
            edge.occupancy.append(self.state.id)

        self.state.eta = estimate_route_time(self.state.route, context.nodes, context.edges)

    def _wait_for(self, peer_id: str, context: AgentContext, action: str):
        self.state.waitingFor = peer_id
        self.state.velocity = 0.0
        self.state.intent = action
        self.state.waitSeconds += context.dt
        if self.local_reservation_id:
            context.release(self.local_reservation_id)
        self.local_reservation_id = None
        self.state.currentReservation = None
        self.state.reason = f"{action}: yielding shared resource to {peer_id}."
        self._send_decision(context, action, self.state.reason, self.state.route[1] if len(self.state.route) > 1 else None, peer_id)

    def _send_decision(self, context: AgentContext, action: str, reason: str, resource: Optional[str], peer_id: Optional[str]):
        key = f"{action}:{peer_id}:{resource}"
        if self.last_decision_key == key:
            return
        self.last_decision_key = key
        self.record_decision(context.now, action, reason)
        context.send(self.state.id, peer_id or "*", "YIELD_REQUEST" if action == "YIELD" else "INTENT_UPDATE", {
            "action": action, "reason": reason, "resource": resource
        }, context.now, 4.0)
        context.emit(self.state.id, "YIELD_DECISION" if action == "YIELD" else "AGENT_DECISION", reason, resource, action)

    def _priority_score(self, now: float) -> float:
        return (
            self.state.taskPriority +
            min(0.2, self.state.waitSeconds * 0.01) +
            max(0.0, 45.0 - self.state.battery) * 0.002 +
            max(0.0, now / 10000.0)
        )

    def _time_to_next_node(self, context: AgentContext) -> float:
        next_node = self.state.route[1] if len(self.state.route) > 1 else None
        if not next_node:
            return 99.0
        edge = edge_between(context.edges, self.state.currentNode, next_node)
        if not edge:
            return 99.0
        return (edge.length / edge.speedLimit) * (1.0 - self.state.edgeProgress)

    def _expire_local_peer_states(self, now: float):
        expired = [pid for pid, p in self.peer_states.items() if now - p.received_at > 12.0]
        for pid in expired:
            del self.peer_states[pid]

    def record_decision(self, time_: float, action: str, reason: str):
        if self.state.decisionHistory:
            prev = self.state.decisionHistory[-1]
            if prev.action == action and prev.reason == reason:
                return
        self.state.decisionHistory.append(DecisionEntry(time=time_, action=action, reason=reason))
        if len(self.state.decisionHistory) > 30:
            self.state.decisionHistory = self.state.decisionHistory[-30:]
