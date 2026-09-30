import { edgeBetween, nodeById, CHARGER_NODES } from "./warehouse";
import { estimateRouteTime, planRoute, routeDistance } from "./planner";
import type {
  Conflict,
  LatestDecision,
  Obstacle,
  PeerMessage,
  Reservation,
  RobotState,
  SimEvent,
  WarehouseEdge,
  WarehouseNode,
  WarehouseTask,
} from "./types";

export interface AgentContext {
  now: number;
  dt: number;
  mode: "distributed" | "baseline";
  nodes: WarehouseNode[];
  edges: WarehouseEdge[];
  tasks: WarehouseTask[];
  robots: RobotState[];
  blockedEdges: Set<string>;
  obstacles: Obstacle[];
  reservations: Reservation[];
  networkOnline: boolean;
  reserve: (
    resourceId: string,
    ownerRobot: string,
    startTime: number,
    endTime: number,
    priority: number,
  ) => Reservation | null;
  release: (reservationId: string) => void;
  releaseOwned: (ownerRobot: string) => void;
  send: (
    sender: string,
    target: string | "*",
    type: string,
    payload: Record<string, unknown>,
    now: number,
    ttl?: number,
  ) => boolean;
  emit: (
    robotId: string | null,
    type: string,
    reason: string,
    resource?: string | null,
    result?: string,
  ) => void;
  onTaskCompleted: (taskId: string, robotId: string) => void;
  onTaskUnassigned: (taskId: string, robotId: string, reason: string) => void;
  onLowBattery: (robotId: string, taskId: string | null, reason: string) => void;
}

interface PeerState {
  robotId: string;
  node: string;
  nextNode: string | null;
  edgeFrom: string | null;
  edgeTo: string | null;
  nextEta: number;
  taskPriority: number;
  status: string;
  intent: string;
  battery: number;
  receivedAt: number;
  waitingFor: string | null;
}

interface AgentNotice {
  type: string;
  reason: string;
  resource?: string | null;
  result?: string;
}

export class RobotAgent {
  readonly state: RobotState;
  private readonly peerStates = new Map<string, PeerState>();
  private readonly localBlockedEdges = new Set<string>();
  private readonly notices: AgentNotice[] = [];
  private lastHeartbeat = -10;
  private lastBroadcast = -10;
  private lastDecisionKey = "";
  private lastConflictKey = "";
  private chargeTarget: string | null = null;
  private chargingResumeTask: string | null = null;
  private routeGoal: string | null = null;
  private previousRoute: string[] = [];
  private localReservationId: string | null = null;

  constructor(id: string, startingNode: string, node: WarehouseNode) {
    this.state = {
      id,
      x: node.x,
      y: node.y,
      heading: 0,
      velocity: 0,
      acceleration: 0,
      battery: 84 + (Number(id.slice(-2)) * 3) % 15,
      batteryCapacity: 100,
      currentTaskId: null,
      taskQueue: [],
      taskPriority: 0,
      route: [startingNode],
      plannedRoute: [startingNode],
      alternativeRoute: [],
      currentWaypoint: null,
      currentNode: startingNode,
      fromNode: null,
      edgeProgress: 0,
      destination: null,
      eta: 0,
      intent: "AVAILABLE",
      status: "IDLE",
      communication: "ONLINE",
      communicationFreshness: 0,
      health: "HEALTHY",
      currentReservation: null,
      waitingFor: null,
      reason: "Local planner ready; awaiting a task auction.",
      distanceTravelled: 0,
      rerouteCount: 0,
      waitSeconds: 0,
      safety: "NORMAL",
      decisionHistory: [
        {
          time: 0,
          action: "INITIALIZE",
          reason: "Independent edge planner initialized.",
        },
      ],
    };
  }

  assignTask(task: WarehouseTask, now: number) {
    if (this.state.health === "FAILED" || this.state.battery < 20) return false;
    if (!this.state.currentTaskId) {
      this.state.currentTaskId = task.id;
      this.state.taskPriority = task.priority;
      this.state.status = "MOVING";
      this.state.intent = "PICK";
      this.state.destination = task.pickup;
      this.state.reason = `Accepted ${task.id} after local bid won the auction.`;
      this.routeGoal = null;
      this.recordDecision(now, "TASK_ACCEPTED", this.state.reason);
    } else if (!this.state.taskQueue.includes(task.id)) {
      this.state.taskQueue.push(task.id);
    }
    return true;
  }

  unassignTask(taskId: string) {
    if (this.state.currentTaskId === taskId) {
      this.state.currentTaskId = null;
      this.state.taskPriority = 0;
      this.state.destination = null;
      this.state.route = [this.state.currentNode];
      this.state.plannedRoute = [this.state.currentNode];
      this.state.intent = "AVAILABLE";
      this.routeGoal = null;
      if (this.state.health !== "FAILED" && !this.chargeTarget) {
        this.state.status = "IDLE";
      }
    } else {
      this.state.taskQueue = this.state.taskQueue.filter((id) => id !== taskId);
    }
  }

  bid(task: WarehouseTask, context: AgentContext) {
    if (this.state.health !== "HEALTHY" || this.state.battery < 24) return null;
    if (this.state.taskQueue.length + (this.state.currentTaskId ? 1 : 0) >= 2) {
      return null;
    }
    const pickupPlan = planRoute(this.state.currentNode, task.pickup, {
      nodes: context.nodes,
      edges: context.edges,
      blockedEdges: this.localBlockedEdges,
      reservations: context.reservations,
      robotId: this.state.id,
      energyWeight: 0.08,
    });
    if (!pickupPlan) return null;
    const deliveryPlan = planRoute(task.pickup, task.destination, {
      nodes: context.nodes,
      edges: context.edges,
      blockedEdges: this.localBlockedEdges,
      reservations: context.reservations,
      robotId: this.state.id,
      energyWeight: 0.08,
    });
    if (!deliveryPlan) return null;
    const workload = this.state.taskQueue.length * 12 + (this.state.currentTaskId ? 13 : 0);
    const batteryPenalty = Math.max(0, 55 - this.state.battery) * 0.7;
    const energy = (pickupPlan.distance + deliveryPlan.distance) * 0.46;
    const energyPenalty = Math.max(0, energy + 12 - this.state.battery) * 5;
    const conflictRisk = this.peerStates.size > 3 ? 3.5 : this.peerStates.size * 0.55;
    const eta = pickupPlan.estimatedTime + deliveryPlan.estimatedTime + 2.5;
    const cost =
      pickupPlan.cost +
      deliveryPlan.cost +
      workload +
      batteryPenalty +
      energyPenalty +
      conflictRisk -
      task.priority * 12;
    return {
      robotId: this.state.id,
      cost,
      eta,
      energy,
      risk: conflictRisk,
      reason: `ETA ${eta.toFixed(1)}s, ${energy.toFixed(1)}% energy, ${this.state.battery.toFixed(0)}% battery, ${workload.toFixed(0)} workload penalty.`,
    };
  }

  receive(messages: PeerMessage[], now: number) {
    for (const message of messages) {
      if (message.target !== "*" && message.target !== this.state.id) continue;
      if (now - message.timestamp > message.ttl) continue;
      if (message.type === "STATE_UPDATE" || message.type === "HEARTBEAT") {
        const payload = message.payload;
        const peer: PeerState = {
          robotId: message.sender,
          node: typeof payload.node === "string" ? payload.node : "",
          nextNode: typeof payload.nextNode === "string" ? payload.nextNode : null,
          edgeFrom: typeof payload.edgeFrom === "string" ? payload.edgeFrom : null,
          edgeTo: typeof payload.edgeTo === "string" ? payload.edgeTo : null,
          nextEta: typeof payload.nextEta === "number" ? payload.nextEta : 99,
          taskPriority:
            typeof payload.taskPriority === "number" ? payload.taskPriority : 0,
          status: typeof payload.status === "string" ? payload.status : "UNKNOWN",
          intent: typeof payload.intent === "string" ? payload.intent : "UNKNOWN",
          battery: typeof payload.battery === "number" ? payload.battery : 0,
          receivedAt: message.timestamp,
          waitingFor:
            typeof payload.waitingFor === "string" ? payload.waitingFor : null,
        };
        this.peerStates.set(message.sender, peer);
      } else if (
        message.type === "EDGE_BLOCKED" &&
        typeof message.payload.edgeId === "string"
      ) {
        this.localBlockedEdges.add(message.payload.edgeId);
      } else if (
        message.type === "EDGE_CLEAR" &&
        typeof message.payload.edgeId === "string"
      ) {
        this.localBlockedEdges.delete(message.payload.edgeId);
      } else if (message.type === "STATE_SYNC") {
        this.recordDecision(
          now,
          "STATE_SYNC",
          `Reconciled peer state from ${message.sender} after communication recovery.`,
        );
      }
    }
  }

  holdInitialNode(reservation: Reservation) {
    this.localReservationId = reservation.id;
    this.state.currentReservation = reservation.id;
  }

  bidState(context: AgentContext) {
    if (context.now - this.lastHeartbeat >= 0.75) {
      this.lastHeartbeat = context.now;
      context.send(
        this.state.id,
        "*",
        "HEARTBEAT",
        {
          node: this.state.currentNode,
          status: this.state.status,
          battery: this.state.battery,
          intent: this.state.intent,
        },
        context.now,
      );
    }
    if (context.now - this.lastBroadcast >= 0.4) {
      this.lastBroadcast = context.now;
      const nextNode = this.state.route[1] ?? null;
      const edge = nextNode ? edgeBetween(context.edges, this.state.currentNode, nextNode) : null;
      context.send(
        this.state.id,
        "*",
        "STATE_UPDATE",
        {
          node: this.state.currentNode,
          nextNode,
          edgeFrom: this.state.currentNode,
          edgeTo: nextNode,
          nextEta: this.timeToNextNode(context),
          taskPriority: this.priorityScore(context.now),
          status: this.state.status,
          intent: this.state.intent,
          battery: this.state.battery,
          edgeId: edge?.id ?? null,
          waitingFor: this.state.waitingFor,
        },
        context.now,
      );
      if (!context.networkOnline) this.state.communication = "OFFLINE";
    }
  }

  getPeers(now: number) {
    return Array.from(this.peerStates.values()).filter(
      (peer) => now - peer.receivedAt <= 4.5,
    );
  }

  step(context: AgentContext): Conflict | null {
    const { now, dt } = context;
    this.state.communication = context.networkOnline ? "ONLINE" : "OFFLINE";
    if (this.state.safety === "EMERGENCY_STOP") {
      this.state.status = "BLOCKED";
      this.state.velocity = 0;
      this.state.battery = Math.max(0, this.state.battery - dt * 0.004);
      return null;
    }
    this.state.communicationFreshness = this.peerStates.size
      ? Math.max(0, now - Math.max(...Array.from(this.peerStates.values()).map((peer) => peer.receivedAt)))
      : now;
    this.expireLocalPeerStates(now);

    if (this.state.health === "FAILED") {
      this.state.status = "FAILED";
      this.state.velocity = 0;
      this.state.intent = "UNAVAILABLE";
      return null;
    }

    this.applyBatteryPolicy(context);
    this.updateTaskPhase(context);
    const goal = this.chooseGoal(context);
    this.state.destination = goal;

    if (goal) this.ensureRoute(goal, context);
    else if (!this.chargeTarget) {
      this.state.intent = "AVAILABLE";
      if (!["COMPLETED", "IDLE"].includes(this.state.status)) {
        this.state.status = "IDLE";
      }
    }

    const nextNode = this.state.route[1] ?? null;
    if (!nextNode) {
      this.state.velocity = 0;
      if (this.chargeTarget && this.state.currentNode === this.chargeTarget) {
        this.state.status = "CHARGING";
        this.state.intent = "CHARGE";
        this.state.battery = Math.min(100, this.state.battery + dt * 5.5);
        if (this.state.battery >= 88) this.finishCharging(context);
      } else if (this.state.currentTaskId && goal === this.state.currentNode) {
        this.updateTaskPhase(context);
      }
      this.state.battery = Math.max(0, this.state.battery - dt * 0.004);
      return null;
    }

    const obstacle = context.obstacles.find(
      (item) =>
        item.expiresAt > now &&
        Math.hypot(
          item.x - (nodeById(context.nodes, nextNode)?.x ?? item.x),
          item.y - (nodeById(context.nodes, nextNode)?.y ?? item.y),
        ) < 0.9,
    );
    if (obstacle) {
      if (this.state.safety !== "STOP") {
        this.state.safety = "STOP";
        this.state.status = "BLOCKED";
        this.state.intent = "SAFETY_STOP";
        this.state.reason = `${obstacle.type} detected in the local stopping envelope.`;
        context.emit(
          this.state.id,
          "OBSTACLE_DETECTED",
          this.state.reason,
          obstacle.id,
          "Local safety supervisor stopped the robot.",
        );
        context.emit(
          this.state.id,
          "SAFETY_STOP",
          "Stopping distance is less than the obstacle clearance.",
          obstacle.id,
          "Motion inhibited until the obstacle clears.",
        );
        this.recordDecision(now, "STOP", this.state.reason);
      }
      this.state.velocity = 0;
      this.state.waitSeconds += dt;
      return null;
    } else if (this.state.safety === "STOP") {
      this.state.safety = "NORMAL";
      this.state.status = "REROUTING";
      this.routeGoal = null;
      this.state.reason = "Obstacle cleared; local planner is validating a fresh route.";
    }

    const predictedConflict = this.predictConflict(nextNode, context);
    if (predictedConflict) {
      this.state.status = "NEGOTIATING";
      this.state.intent = "RESERVATION_REQUEST";
      const peer = this.getPeers(now).find(
        (item) =>
          item.robotId === predictedConflict.robotA ||
          item.robotId === predictedConflict.robotB,
      );
      const peerId = peer?.robotId ?? predictedConflict.robotB;
      context.send(
        this.state.id,
        peerId,
        "CONFLICT_ALERT",
        {
          resource: predictedConflict.resource,
          conflictId: predictedConflict.id,
          eta: this.timeToNextNode(context),
        },
        now,
      );
      context.send(
        this.state.id,
        peerId,
        "RESERVATION_REQUEST",
        {
          resource: predictedConflict.resource,
          priority: this.priorityScore(now),
        },
        now,
      );
      context.emit(
        this.state.id,
        "NEGOTIATION_STARTED",
        `Peer negotiation opened for ${predictedConflict.resource}.`,
        predictedConflict.resource,
        `${this.state.id} ↔ ${peerId}`,
      );

      if (context.mode === "baseline") {
        this.waitFor(peerId, context, "STOP_AND_WAIT");
        predictedConflict.decision = "STOP_AND_WAIT";
        this.state.status = "WAITING";
        this.state.reason = `Baseline policy stops while ${peerId} clears the shared conflict zone.`;
        return predictedConflict;
      }

      const ownPriority = this.priorityScore(now);
      const other = peer ?? this.peerStates.get(peerId);
      const otherPriority = other?.taskPriority ?? 0;
      const wins = ownPriority > otherPriority ||
        (Math.abs(ownPriority - otherPriority) < 0.0001 &&
          this.state.id.localeCompare(peerId) < 0);
      if (!wins) {
        this.waitFor(peerId, context, "YIELD");
        predictedConflict.decision = `${this.state.id} YIELDS`;
        this.state.status = "YIELDING";
        this.state.reason = `${peerId} has higher right-of-way priority (${otherPriority.toFixed(2)} vs ${ownPriority.toFixed(2)}).`;
        this.sendDecision(context, "YIELD", this.state.reason, predictedConflict.resource, peerId);
        return predictedConflict;
      }
      this.state.waitingFor = null;
      this.state.status = "NEGOTIATING";
      const lease = context.reserve(
        predictedConflict.resource,
        this.state.id,
        now,
        now + Math.max(2.5, this.timeToNextNode(context) + 1.3),
        ownPriority,
      );
      if (!lease) {
        this.waitFor(peerId, context, "RESERVATION_DENIED");
        predictedConflict.decision = "RESERVATION DENIED";
        this.state.status = "WAITING";
        this.state.reason = `Reservation lease for ${predictedConflict.resource} is currently owned by another agent.`;
        return predictedConflict;
      }
      this.localReservationId = lease.id;
      this.state.currentReservation = lease.id;
      this.state.reason = `Higher local priority won negotiation; lease ${lease.id} protects ${predictedConflict.resource}.`;
      this.state.intent = "PROCEED";
      this.state.status = "MOVING";
      predictedConflict.decision = `${this.state.id} PROCEEDS`;
      context.send(
        this.state.id,
        peerId,
        "RESERVATION_GRANTED",
        { resource: predictedConflict.resource, reservationId: lease.id },
        now,
      );
      context.emit(
        this.state.id,
        "RESERVATION_GRANTED",
        `Negotiation granted a time-bounded lease to ${this.state.id}.`,
        predictedConflict.resource,
        lease.id,
      );
    } else {
      this.state.waitingFor = null;
      if (this.state.status === "YIELDING" || this.state.status === "WAITING") {
        this.state.status = "MOVING";
        this.state.reason = "The conflict zone cleared; local route is safe to resume.";
        this.recordDecision(now, "RESUME", this.state.reason);
      }
    }

    // 360° LiDAR & Proximity Sensor Safety Check (Active Motion Only)
    if (this.state.currentTaskId || this.state.velocity > 0) {
      for (const other of context.robots) {
        if (other.id === this.state.id || other.health === "FAILED") continue;
        const dist = Math.hypot(this.state.x - other.x, this.state.y - other.y);
        if (dist < 1.15 && (other.currentTaskId || (other.velocity ?? 0) > 0)) {
          const ownPriority = this.priorityScore(now);
          const otherPriority = other.taskPriority ?? 0;
          const wins = ownPriority > otherPriority ||
            (Math.abs(ownPriority - otherPriority) < 0.0001 && this.state.id.localeCompare(other.id) < 0);
          if (!wins) {
            this.state.status = "YIELDING";
            this.state.velocity = 0;
            this.state.reason = `360° Proximity Sensor Alert: yielding right-of-way to ${other.id} (${dist.toFixed(2)}m).`;
            break;
          }
        }
      }
    }

    if (!["YIELDING", "WAITING"].includes(this.state.status as string)) {
      this.advance(dt, nextNode, context);
    }
    this.state.battery = Math.max(0, this.state.battery - dt * (0.018 + this.state.velocity * 0.003));
    if (this.state.waitingFor) this.state.waitSeconds += dt;
    return predictedConflict;
  }

  get lastKnownPeers() {
    return Array.from(this.peerStates.values());
  }

  drainNotices() {
    const pending = this.notices.splice(0, this.notices.length);
    return pending;
  }

  forceFailure(now: number, context: AgentContext) {
    if (this.state.health === "FAILED") return null;
    this.state.health = "FAILED";
    this.state.status = "FAILED";
    this.state.velocity = 0;
    this.state.intent = "UNAVAILABLE";
    const taskId = this.state.currentTaskId;
    this.state.reason = "Drive controller heartbeat stopped; peer agents marked this unit unavailable.";
    if (this.localReservationId) context.release(this.localReservationId);
    context.releaseOwned(this.state.id);
    context.emit(
      this.state.id,
      "ROBOT_FAILURE",
      this.state.reason,
      null,
      "Reservations released; outstanding work is re-auctioned.",
    );
    this.recordDecision(now, "FAILURE", this.state.reason);
    return taskId;
  }

  forceCommunicationLoss(context: AgentContext, offline: boolean) {
    context.networkOnline = !offline;
    this.state.communication = offline ? "OFFLINE" : "ONLINE";
    if (offline) {
      this.state.reason = "Peer radio unavailable; continuing from local map and cached state.";
      this.state.intent = "LOCAL_OPERATION";
      this.recordDecision(context.now, "LOCAL_ONLY", this.state.reason);
      context.emit(this.state.id, "COMMUNICATION_LOST", this.state.reason, null, "Local safety remains active.");
    } else {
      this.state.reason = "Peer link restored; reconciling state and leases.";
      context.send(this.state.id, "*", "STATE_SYNC", { node: this.state.currentNode }, context.now);
      context.emit(this.state.id, "COMMUNICATION_RESTORED", this.state.reason, null, "Handshake and state sync started.");
      this.recordDecision(context.now, "STATE_SYNC", this.state.reason);
    }
  }

  setBattery(percent: number, context: AgentContext) {
    this.state.battery = Math.max(1, Math.min(100, percent));
    this.applyBatteryPolicy(context);
  }

  forceDeadlockWait(peerId: string, context: AgentContext) {
    this.state.waitingFor = peerId;
    this.state.status = "WAITING";
    this.state.intent = "DEADLOCK_WAIT";
    this.state.velocity = 0;
    this.state.reason = `Waiting for ${peerId}; the local wait-for graph contains a dependency cycle.`;
    this.state.waitSeconds += 0.5;
    context.send(this.state.id, peerId, "DEADLOCK_ALERT", { waitingFor: peerId }, context.now);
  }

  recoverDeadlock(context: AgentContext, reason: string) {
    if (this.localReservationId) context.release(this.localReservationId);
    this.localReservationId = null;
    this.state.currentReservation = null;
    this.state.waitingFor = null;
    this.state.status = "RECOVERING";
    this.state.intent = "REROUTE";
    this.state.reason = reason;
    const currentNext = this.state.route[1];
    if (currentNext) {
      const alternative = planRoute(this.state.currentNode, this.state.destination ?? currentNext, {
        nodes: context.nodes,
        edges: context.edges,
        blockedEdges: this.localBlockedEdges,
        reservations: context.reservations,
        robotId: this.state.id,
        avoidNodes: new Set([currentNext]),
      });
      if (alternative && alternative.nodes.length > 1) {
        this.previousRoute = [...this.state.route];
        this.state.route = alternative.nodes;
        this.state.plannedRoute = [...alternative.nodes];
        this.state.alternativeRoute = [...alternative.nodes];
        this.state.rerouteCount += 1;
      }
    }
    this.recordDecision(context.now, "DEADLOCK_RECOVERY", reason);
    context.emit(this.state.id, "DEADLOCK_RECOVERY", reason, null, "Wait-for dependency released and route replanned.");
  }

  private updateTaskPhase(context: AgentContext) {
    const task = context.tasks.find((item) => item.id === this.state.currentTaskId);
    if (!task) return;
    if (!task.picked && this.state.currentNode === task.pickup) {
      task.picked = true;
      task.status = "DELIVERING";
      this.state.intent = "DELIVER";
      this.state.destination = task.destination;
      this.routeGoal = null;
      this.state.reason = `Picked ${task.sku}; local planner is routing to ${task.destination}.`;
      context.emit(this.state.id, "ITEM_PICKED", this.state.reason, task.pickup, task.sku);
      this.recordDecision(context.now, "PICKUP", this.state.reason);
    } else if (task.picked && this.state.currentNode === task.destination) {
      task.status = "COMPLETED";
      task.eta = context.now;
      this.state.currentTaskId = null;
      this.state.taskPriority = 0;
      this.state.destination = null;
      this.state.intent = "AVAILABLE";
      this.state.status = "COMPLETED";
      this.state.reason = `Delivered ${task.sku} to packing; agent is available for the next auction.`;
      context.emit(this.state.id, "TASK_COMPLETED", this.state.reason, task.destination, task.id);
      this.recordDecision(context.now, "TASK_COMPLETE", this.state.reason);
      context.onTaskCompleted(task.id, this.state.id);
      const queued = this.state.taskQueue.shift();
      const next = queued ? context.tasks.find((candidate) => candidate.id === queued) : null;
      if (next) this.assignTask(next, context.now);
    }
  }

  private applyBatteryPolicy(context: AgentContext) {
    if (this.chargeTarget || this.state.health === "FAILED") return;
    const task = context.tasks.find((item) => item.id === this.state.currentTaskId);
    let reserve = 14;
    if (task) {
      const outbound = planRoute(this.state.currentNode, task.picked ? task.destination : task.pickup, {
        nodes: context.nodes,
        edges: context.edges,
        blockedEdges: this.localBlockedEdges,
        reservations: context.reservations,
        robotId: this.state.id,
      });
      const inbound = !task.picked
        ? planRoute(task.pickup, task.destination, {
            nodes: context.nodes,
            edges: context.edges,
            blockedEdges: this.localBlockedEdges,
            reservations: context.reservations,
            robotId: this.state.id,
          })
        : null;
      const estimatedEnergy =
        ((outbound?.distance ?? 0) + (inbound?.distance ?? 0)) * 0.48 + reserve;
      if (this.state.battery > 28 && this.state.battery >= estimatedEnergy) return;
    } else if (this.state.battery > 23) {
      return;
    }

    const currentTaskId = this.state.currentTaskId;
    const reason = `Battery ${this.state.battery.toFixed(0)}% is below the safe task-plus-reserve estimate; charging takes priority.`;
    this.chargeTarget = CHARGER_NODES
      .map((id) => ({
        id,
        plan: planRoute(this.state.currentNode, id, {
          nodes: context.nodes,
          edges: context.edges,
          blockedEdges: this.localBlockedEdges,
          reservations: context.reservations,
          robotId: this.state.id,
        }),
      }))
      .filter((candidate) => candidate.plan)
      .sort((a, b) => (a.plan?.cost ?? Infinity) - (b.plan?.cost ?? Infinity))[0]?.id ?? CHARGER_NODES[0];
    this.chargingResumeTask = currentTaskId;
    if (currentTaskId) {
      context.onTaskUnassigned(currentTaskId, this.state.id, reason);
      this.unassignTask(currentTaskId);
    }
    this.state.intent = "CHARGE";
    this.state.reason = reason;
    this.state.status = "REROUTING";
    this.routeGoal = null;
    context.onLowBattery(this.state.id, currentTaskId, reason);
    this.recordDecision(context.now, "CHARGE", reason);
  }

  private finishCharging(context: AgentContext) {
    const previousTask = this.chargingResumeTask;
    this.chargeTarget = null;
    this.chargingResumeTask = null;
    this.state.intent = "AVAILABLE";
    this.state.status = "IDLE";
    this.state.reason = "Battery reserve restored; agent rejoined local task auctions.";
    this.state.destination = null;
    this.routeGoal = null;
    context.emit(this.state.id, "CHARGING_COMPLETED", this.state.reason, null, "Agent rejoined the fleet.");
    this.recordDecision(context.now, "REJOIN", this.state.reason);
    if (previousTask) this.state.taskQueue = this.state.taskQueue.filter((id) => id !== previousTask);
  }

  private getHomeSlot(): string {
    const homeMap: Record<string, string> = {
      "AMR-01": "N-0-0",
      "AMR-02": "N-0-1",
      "AMR-03": "N-0-2",
      "AMR-04": "N-5-6",
      "AMR-05": "N-5-7",
      "AMR-06": "N-5-8",
    };
    return homeMap[this.state.id] ?? "N-0-0";
  }

  private chooseGoal(context: AgentContext) {
    if (this.chargeTarget) return this.chargeTarget;
    const task = context.tasks.find((item) => item.id === this.state.currentTaskId);
    if (!task) {
      const homeNode = this.getHomeSlot();
      if (this.state.currentNode !== homeNode) {
        this.state.intent = "RETURNING_HOME";
        this.state.destination = homeNode;
        this.state.reason = `No active task; returning home to charging slot ${homeNode}.`;
        return homeNode;
      } else {
        if (this.state.intent === "RETURNING_HOME") {
          this.state.intent = "CHARGING";
          this.state.status = "IDLE";
          this.state.reason = `Docked at home charging slot ${homeNode}.`;
        }
        this.state.destination = null;
        return null;
      }
    }
    return task.picked ? task.destination : task.pickup;
  }

  private ensureRoute(goal: string, context: AgentContext) {
    const nextNode = this.state.route[1];
    const nextEdge = nextNode
      ? edgeBetween(context.edges, this.state.currentNode, nextNode)
      : null;
    const invalidated =
      this.routeGoal !== goal ||
      !this.state.route.length ||
      (nextEdge && (nextEdge.blocked || this.localBlockedEdges.has(nextEdge.id))) ||
      (!nextEdge && this.state.currentNode !== goal && Boolean(nextNode));
    if (!invalidated && this.state.route.length > 1) return;
    const previous = [...this.state.route];
    const route = planRoute(this.state.currentNode, goal, {
      nodes: context.nodes,
      edges: context.edges,
      blockedEdges: this.localBlockedEdges,
      reservations: context.reservations,
      robotId: this.state.id,
      energyWeight: this.state.battery < 35 ? 0.12 : 0.04,
    });
    this.routeGoal = goal;
    if (!route) {
      if (this.state.currentTaskId) {
        this.state.status = "BLOCKED";
        this.state.reason = `No safe route to ${goal} exists in the local world model.`;
      } else {
        this.state.status = "IDLE";
        this.state.reason = "Standing by for task assignment.";
      }
      this.state.velocity = 0;
      return;
    }
    if (
      previous.length > 1 &&
      previous.join(">") !== route.nodes.join(">") &&
      previous[1] !== route.nodes[1]
    ) {
      this.previousRoute = previous;
      this.state.alternativeRoute = [...route.nodes];
      this.state.rerouteCount += 1;
      this.state.status = "REROUTING";
      const reason =
        "Known blockage or congestion changed route cost; the lower-risk alternative was selected.";
      this.state.reason = reason;
      this.recordDecision(context.now, "REROUTE", reason);
      context.emit(this.state.id, "REROUTE_SELECTED", reason, nextEdge?.id ?? null, route.nodes.join(" → "));
      context.send(
        this.state.id,
        "*",
        "ROUTE_INTENT",
        { route: route.nodes, goal, eta: route.estimatedTime },
        context.now,
      );
    }
    this.state.route = route.nodes;
    this.state.plannedRoute = [...route.nodes];
    this.state.currentWaypoint = route.nodes[1] ?? null;
    this.state.eta = route.estimatedTime;
  }

  private predictConflict(nextNode: string, context: AgentContext): Conflict | null {
    const now = context.now;
    const nextEdge = edgeBetween(context.edges, this.state.currentNode, nextNode);
    for (const peer of this.getPeers(now)) {
      if (
        ["FAILED", "IDLE", "CHARGING", "COMPLETED"].includes(peer.status) ||
        peer.nextEta > 6
      ) {
        continue;
      }
      const sameTarget = peer.nextNode === nextNode;
      const oppositeTraversal =
        peer.node === nextNode && peer.nextNode === this.state.currentNode;
      const peerEdge = peer.edgeFrom && peer.edgeTo
        ? edgeBetween(context.edges, peer.edgeFrom, peer.edgeTo)
        : null;
      const sameNarrowEdge =
        nextEdge?.narrow &&
        peerEdge?.id === nextEdge.id &&
        peer.edgeFrom !== this.state.currentNode;
      if (!sameTarget && !oppositeTraversal && !sameNarrowEdge) continue;
      if (Math.abs(peer.nextEta - this.timeToNextNode(context)) > 4.5) continue;
      const resource = sameTarget ? nextNode : nextEdge?.id ?? nextNode;
      const ownPriority = this.priorityScore(now);
      const key = [this.state.id, peer.robotId, resource].sort().join(":");
      if (key !== this.lastConflictKey) {
        this.lastConflictKey = key;
        context.emit(
          this.state.id,
          "CONFLICT_PREDICTED",
          `${peer.robotId} and ${this.state.id} have overlapping ETAs for ${resource}.`,
          resource,
          "Predicted before entering the shared zone.",
        );
      }
      return {
        id: `CF-${key.replaceAll(":", "-")}`,
        robotA: this.state.id,
        robotB: peer.robotId,
        resource,
        etaA: this.timeToNextNode(context),
        etaB: peer.nextEta,
        priorityA: ownPriority,
        priorityB: peer.taskPriority,
        risk: Math.min(0.99, 0.42 + Math.abs(peer.nextEta - this.timeToNextNode(context)) * -0.06),
        predictedDelay: Math.max(1.2, Math.abs(peer.nextEta - this.timeToNextNode(context)) + 2),
        decision: "NEGOTIATING",
        status: "NEGOTIATING",
      };
    }
    this.lastConflictKey = "";
    return null;
  }

  private advance(dt: number, nextNode: string, context: AgentContext) {
    const source = nodeById(context.nodes, this.state.currentNode);
    const destination = nodeById(context.nodes, nextNode);
    if (!source || !destination) return;
    const edge = edgeBetween(context.edges, this.state.currentNode, nextNode);
    if (!edge || edge.blocked || this.localBlockedEdges.has(edge.id)) {
      this.state.status = "REROUTING";
      this.state.velocity = 0;
      this.routeGoal = null;
      this.state.reason = `Edge ${edge?.id ?? "unknown"} is blocked in the local map.`;
      return;
    }
    const resourceBusy = context.reservations.some(
      (reservation) =>
        reservation.status === "ACTIVE" &&
        reservation.endTime > context.now &&
        reservation.ownerRobot !== this.state.id &&
        reservation.resourceId === nextNode,
    );
    if (resourceBusy) {
      this.state.status = "WAITING";
      this.state.intent = "RESERVATION_WAIT";
      this.state.waitSeconds += dt;
      this.state.velocity = 0;
      return;
    }
    const edgeOccupants = edge.occupancy
      .filter((robotId) => robotId !== this.state.id)
      .map((robotId) => context.robots.find((robot) => robot.id === robotId))
      .filter((robot): robot is RobotState => Boolean(robot));
    const opposingTraffic = edgeOccupants.some(
      (robot) =>
        robot.fromNode === nextNode &&
        robot.currentWaypoint === this.state.currentNode,
    );
    const unsafeFollowingDistance = edgeOccupants.some(
      (robot) => Math.hypot(robot.x - this.state.x, robot.y - this.state.y) < 1.1,
    );
    const edgeAtCapacity = edgeOccupants.length >= edge.capacity;
    if (unsafeFollowingDistance || edgeAtCapacity) {
      this.state.status = "WAITING";
      this.state.intent = "EDGE_CLEARANCE";
      this.state.reason = `Waiting for ${edge.id} to clear before entering the shared lane.`;
      this.state.waitSeconds += dt;
      this.state.velocity = 0;
      return;
    }
    if (this.state.edgeProgress <= 0) {
      let targetLease = this.localReservationId
        ? context.reservations.find(
            (reservation) =>
              reservation.id === this.localReservationId &&
              reservation.status === "ACTIVE" &&
              reservation.resourceId === nextNode,
          )
        : undefined;
      if (!targetLease) {
        targetLease = context.reserve(
          nextNode,
          this.state.id,
          context.now,
          context.now + Math.max(10, edge.estimatedTravelTime + 5),
          this.priorityScore(context.now),
        ) ?? undefined;
      }
      if (!targetLease) {
        this.state.status = "WAITING";
        this.state.intent = "NODE_CLEARANCE";
        this.state.reason = `Waiting for ${nextNode} to become available.`;
        this.state.waitSeconds += dt;
        this.state.velocity = 0;
        return;
      }
      if (this.localReservationId && this.localReservationId !== targetLease.id) {
        context.release(this.localReservationId);
      }
      this.localReservationId = targetLease.id;
      this.state.currentReservation = targetLease.id;
    }
    const speed = edge.speedLimit * Math.max(0.35, 1 - edge.congestion * 0.35);
    const secondsForEdge = edge.length / speed;
    const previousProgress = this.state.edgeProgress;
    this.state.fromNode = this.state.currentNode;
    this.state.currentWaypoint = nextNode;
    this.state.edgeProgress = Math.min(1, this.state.edgeProgress + dt / secondsForEdge);
    this.state.velocity = speed;
    this.state.acceleration = (this.state.edgeProgress - previousProgress) / Math.max(dt, 0.01);
    const heading = Math.atan2(destination.y - source.y, destination.x - source.x);
    this.state.heading = heading;

    const xCenter = source.x + (destination.x - source.x) * this.state.edgeProgress;
    const yCenter = source.y + (destination.y - source.y) * this.state.edgeProgress;

    this.state.x = xCenter;
    this.state.y = yCenter;
    this.state.distanceTravelled += edge.length * (this.state.edgeProgress - previousProgress);
    this.state.status =
      this.state.status === "NEGOTIATING" || this.state.status === "REROUTING"
        ? "MOVING"
        : this.state.status;
    this.state.intent = this.chargeTarget ? "CHARGE" : this.state.intent === "RESERVATION_REQUEST" ? "PROCEED" : this.state.intent;
    this.state.waitSeconds = Math.max(0, this.state.waitSeconds - dt * 0.2);
    if (this.state.edgeProgress >= 1) {
      this.state.currentNode = nextNode;
      this.state.x = destination.x;
      this.state.y = destination.y;
      this.state.fromNode = null;
      this.state.edgeProgress = 0;
      this.state.route = this.state.route.slice(1);
      this.state.plannedRoute = [...this.state.route];
      this.state.currentWaypoint = this.state.route[1] ?? null;
      if (this.state.status === "RECOVERING") {
        this.state.status = "MOVING";
        this.state.reason = "Recovery waypoint reached; normal task route resumed.";
      }
      this.updateTaskPhase(context);
      edge.occupancy = edge.occupancy.filter((id) => id !== this.state.id);
    } else if (!edge.occupancy.includes(this.state.id)) {
      edge.occupancy.push(this.state.id);
    }
    this.state.eta = estimateRouteTime(this.state.route, context.nodes, context.edges);
  }

  private waitFor(peerId: string, context: AgentContext, action: string) {
    this.state.waitingFor = peerId;
    this.state.velocity = 0;
    this.state.intent = action;
    this.state.waitSeconds += context.dt;
    if (this.localReservationId) context.release(this.localReservationId);
    this.localReservationId = null;
    this.state.currentReservation = null;
    this.state.reason = `${action}: yielding the shared resource to ${peerId}.`;
    this.sendDecision(context, action, this.state.reason, this.state.route[1] ?? null, peerId);
  }

  private sendDecision(
    context: AgentContext,
    action: string,
    reason: string,
    resource: string | null,
    peerId: string | null,
  ) {
    const key = `${action}:${peerId}:${resource}`;
    if (this.lastDecisionKey === key) return;
    this.lastDecisionKey = key;
    this.recordDecision(context.now, action, reason);
    context.send(
      this.state.id,
      peerId ?? "*",
      action === "YIELD" ? "YIELD_REQUEST" : "INTENT_UPDATE",
      { action, reason, resource },
      context.now,
    );
    context.emit(
      this.state.id,
      action === "YIELD" ? "YIELD_DECISION" : "AGENT_DECISION",
      reason,
      resource,
      action,
    );
  }

  private priorityScore(now: number) {
    return (
      this.state.taskPriority +
      Math.min(0.2, this.state.waitSeconds * 0.01) +
      Math.max(0, 45 - this.state.battery) * 0.002 +
      Math.max(0, now / 10_000)
    );
  }

  private timeToNextNode(context: AgentContext) {
    const nextNode = this.state.route[1];
    if (!nextNode) return 99;
    const edge = edgeBetween(context.edges, this.state.currentNode, nextNode);
    if (!edge) return 99;
    return (edge.length / edge.speedLimit) * (1 - this.state.edgeProgress);
  }

  private expireLocalPeerStates(now: number) {
    for (const [id, peer] of this.peerStates) {
      if (now - peer.receivedAt > 12) this.peerStates.delete(id);
    }
  }

  private recordDecision(time: number, action: string, reason: string) {
    const previous = this.state.decisionHistory.at(-1);
    if (previous?.action === action && previous.reason === reason) return;
    this.state.decisionHistory.push({ time, action, reason });
    this.state.decisionHistory = this.state.decisionHistory.slice(-30);
  }
}

export function taskBidExplanation(
  bids: Array<{ robotId: string; cost: number; eta: number; reason: string }>,
) {
  return [...bids].sort((a, b) => a.cost - b.cost);
}

export function createLatestDecision(
  robotId: string,
  action: string,
  reason: string,
  resource: string | null,
  peerId: string | null,
  eta: number,
  rerouteCost: number,
  waitCost: number,
): LatestDecision {
  return {
    robotId,
    action,
    reason,
    resource,
    peerId,
    eta,
    rerouteCost,
    waitCost,
    selectedAction: action,
  };
}

export function estimatedTaskDistance(
  task: WarehouseTask,
  agent: RobotState,
  nodes: WarehouseNode[],
  edges: WarehouseEdge[],
) {
  const out = planRoute(agent.currentNode, task.pickup, { nodes, edges });
  const inPlan = planRoute(task.pickup, task.destination, { nodes, edges });
  return (out ? routeDistance(out.nodes, edges) : 0) +
    (inPlan ? routeDistance(inPlan.nodes, edges) : 0);
}