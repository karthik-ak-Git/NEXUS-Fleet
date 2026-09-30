import { RobotAgent, createLatestDecision, taskBidExplanation } from "./robot-agent";
import { PeerNetwork } from "./peer-network";
import {
  CHARGER_NODES,
  PACKING_NODE,
  createWarehouse,
  getRackLocations,
  nodeById,
  nodeId,
} from "./warehouse";
import { planRoute } from "./planner";
import type {
  BenchmarkResult,
  Conflict,
  LatestDecision,
  Metrics,
  Obstacle,
  Reservation,
  RobotMode,
  RobotState,
  SimEvent,
  SimulationSnapshot,
  WarehouseEdge,
  WarehouseNode,
  WarehouseTask,
} from "./types";
import type { AgentContext } from "./robot-agent";

interface EngineOptions {
  seed?: number;
  mode?: RobotMode;
  robotCount?: number;
  taskCount?: number;
}

const DEFAULT_SEED = 26123;
const EVENT_LIMIT = 240;
const ROBOT_IDS = ["AMR-01", "AMR-02", "AMR-03", "AMR-04", "AMR-05", "AMR-06"];
const PRIORITIES = [0.92, 0.76, 0.84, 0.64, 0.72, 0.55];

export class SimulationEngine {
  private seed: number;
  private randomState: number;
  private mode: RobotMode;
  private nodes: WarehouseNode[] = [];
  private edges: WarehouseEdge[] = [];
  private agents: RobotAgent[] = [];
  private tasks: WarehouseTask[] = [];
  private events: SimEvent[] = [];
  private conflicts: Conflict[] = [];
  private obstacles: Obstacle[] = [];
  private reservations: Reservation[] = [];
  private network = new PeerNetwork();
  private time = 0;
  private running = false;
  private speed = 1;
  private selectedRobotId: string | null = "AMR-01";
  private benchmark: BenchmarkResult | null = null;
  private latestDecision: LatestDecision | null = null;
  private taskSequence = 1001;
  private eventSequence = 1;
  private reservationSequence = 8821;
  private conflictSequence = 21;
  private totalConflictCount = 0;
  private totalDeadlocks = 0;
  private totalReroutes = 0;
  private totalCollisions = 0;
  private activeCollisionPairs = new Set<string>();
  private initialEnergy = 0;
  private lastAuctionAt = -5;
  private lastMetrics: Metrics = this.emptyMetrics();
  private deadlockCycles: string[][] = [];
  private seenDeadlockCycles = new Set<string>();
  private highCongestion = false;
  private demoStartedAt: number | null = null;
  private demoPhase: string | null = null;
  private stressStartedAt: number | null = null;
  private firedStressPhases = new Set<string>();
  private readonly robotCount: number;
  private readonly taskCount: number;

  constructor(options: EngineOptions = {}) {
    this.seed = options.seed ?? DEFAULT_SEED;
    this.randomState = this.seed;
    this.mode = options.mode ?? "distributed";
    this.robotCount = options.robotCount ?? 6;
    this.taskCount = options.taskCount ?? 12;
    this.initialize("normal");
  }

  private initialize(scenario: string) {
    this.time = 0;
    this.running = false;
    this.speed = 1;
    this.benchmark = null;
    this.latestDecision = null;
    this.events = [];
    this.conflicts = [];
    this.obstacles = [];
    this.reservations = [];
    this.totalConflictCount = 0;
    this.totalDeadlocks = 0;
    this.totalReroutes = 0;
    this.totalCollisions = 0;
    this.activeCollisionPairs.clear();
    this.eventSequence = 1;
    this.reservationSequence = 8821;
    this.conflictSequence = 21;
    this.taskSequence = 1001;
    this.randomState = this.seed;
    this.deadlockCycles = [];
    this.seenDeadlockCycles.clear();
    this.highCongestion = false;
    this.demoStartedAt = null;
    this.demoPhase = null;
    this.stressStartedAt = null;
    this.firedStressPhases.clear();
    const warehouse = createWarehouse();
    this.nodes = warehouse.nodes;
    this.edges = warehouse.edges;
    this.network = new PeerNetwork();
    this.agents = [];
    this.tasks = [];

    const starts = [
      nodeId(0, 3),
      nodeId(2, 1),
      nodeId(4, 3),
      nodeId(2, 5),
      nodeId(0, 5),
      nodeId(4, 1),
    ];
    for (let index = 0; index < this.robotCount; index += 1) {
      const id = ROBOT_IDS[index] ?? `AMR-${String(index + 1).padStart(2, "0")}`;
      const start = starts[index % starts.length];
      const startNode = nodeById(this.nodes, start);
      if (!startNode) continue;
      this.agents.push(new RobotAgent(id, start, startNode));
      this.network.setOnline(id, true);
    }
    for (const agent of this.agents) {
      const initialLease = this.reserve(
        agent.state.currentNode,
        agent.state.id,
        this.time,
        this.time + 10_000,
        agent.state.taskPriority,
      );
      if (initialLease) agent.holdInitialNode(initialLease);
    }

    this.tasks = this.createTaskSet(this.taskCount);
    this.initialEnergy = this.agents.reduce((sum, agent) => sum + agent.state.battery, 0);
    this.emit(null, "SIMULATION_READY", "Seeded warehouse and independent edge agents initialized.", null, `${this.agents.length} local planners; seed ${this.seed}.`);
    if (scenario === "normal") this.auctionTasks();
    else this.applyScenario(scenario);
    this.updateMetrics();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.emit(null, "SIMULATION_STARTED", "Shared simulation clock started; robot decisions remain local.", null, "Autonomy active.");
    this.auctionTasks();
  }

  pause() {
    this.running = false;
    this.emit(null, "SIMULATION_PAUSED", "Clock paused; robot state and reservations are retained.", null, "Paused by observer.");
  }

  reset() {
    this.seed = DEFAULT_SEED;
    this.mode = "distributed";
    this.initialize("normal");
  }

  setSpeed(speed: number) {
    this.speed = Math.max(0.5, Math.min(4, speed));
  }

  selectRobot(robotId: string | null) {
    this.selectedRobotId = robotId;
  }

  setScenario(name: string) {
    const scenario = name.toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
    this.initialize(scenario);
    this.running = true;
    this.emit(null, "SCENARIO_STARTED", `Environment loaded scenario: ${scenario}.`, null, "Agents resolve disturbances autonomously.");
    this.auctionTasks();
  }

  runStressTest() {
    this.setScenario("stress-test");
  }

  runDemo() {
    this.setScenario("normal");
    this.demoStartedAt = this.time;
    this.demoPhase = "PHASE 1 · NORMAL OPERATIONS";
    this.emit(null, "DEMO_STARTED", "Automated autonomy sequence started; no robot-level inputs are scheduled.", null, "Environmental events will be injected over time.");
  }

  createTask(pickupOverride?: string, skuOverride?: string) {
    const task = this.makeTask(0, pickupOverride, skuOverride);
    this.tasks.push(task);
    this.emit(null, "TASK_CREATED", `${task.id} entered the warehouse task auction.`, task.pickup, `${task.orderId} · ${task.sku}`);
    this.broadcast("*", "TASK_BID", { taskId: task.id, phase: "OPEN" });
    this.auctionTasks();
    return task.id;
  }

  inject(kind: string) {
    const normalized = kind.toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
    if (normalized === "conflict" || normalized === "intersection-conflict") {
      this.setScenario("intersection");
      return;
    }
    if (normalized === "block-aisle" || normalized === "blocked-aisle") {
      this.blockAisle("C-17");
    } else if (normalized === "communication-loss" || normalized === "comm-loss") {
      const robot = this.findRobot(this.selectedRobotId) ?? this.findRobot("AMR-02");
      if (!robot) return;
      const offline = robot.state.communication !== "OFFLINE";
      this.network.setOnline(robot.state.id, !offline);
      robot.forceCommunicationLoss(this.context(robot), offline);
      if (!offline) {
        this.broadcast(robot.state.id, "STATE_SYNC", {
          node: robot.state.currentNode,
          reservationIds: this.reservations
            .filter((reservation) => reservation.ownerRobot === robot.state.id)
            .map((reservation) => reservation.id),
        });
      }
    } else if (normalized === "robot-failure" || normalized === "failure") {
      this.failRobot(this.findRobot(this.selectedRobotId) ?? this.findRobot("AMR-03"));
    } else if (normalized === "low-battery" || normalized === "battery") {
      const robot = this.findRobot(this.selectedRobotId) ?? this.findRobot("AMR-05");
      if (robot) robot.setBattery(8, this.context(robot));
    } else if (normalized === "obstacle" || normalized === "unexpected-obstacle") {
      this.spawnObstacle();
    } else if (normalized === "high-congestion") {
      this.setHighCongestion(true);
    } else {
      this.emit(null, "DISTURBANCE_IGNORED", `Unknown environment disturbance: ${kind}.`, null, "No state changed.");
    }
  }

  step(dt = 0.2) {
    const delta = Math.min(1, Math.max(0.01, dt));
    this.time += delta;
    this.expireReservations();
    this.expireObstacles();
    this.updateCongestion();
    this.network.deliver(this.time);

    for (const agent of this.agents) {
      const context = this.context(agent, delta);
      agent.receive(this.network.drain(agent.state.id), this.time);
      agent.bidState(context);
    }

    const tickConflicts: Conflict[] = [];
    for (const agent of this.agents) {
      const context = this.context(agent, delta);
      const conflict = agent.step(context);
      for (const notice of agent.drainNotices()) {
        this.emit(agent.state.id, notice.type, notice.reason, notice.resource ?? null, notice.result ?? "");
      }
      if (conflict) tickConflicts.push(conflict);
    }

    this.updateConflicts(tickConflicts);
    this.detectDeadlocks();
    this.detectCollisions();
    this.auctionTasks();
    this.checkHeartbeats();
    this.updateMetrics();
    this.advanceDemo();
    this.advanceStress();
  }

  getSnapshot(): SimulationSnapshot {
    return {
      running: this.running,
      time: this.time,
      mode: this.mode,
      speed: this.speed,
      robots: this.agents.map((agent) => this.cloneRobot(agent.state)),
      tasks: this.tasks.map((task) => ({
        ...task,
        bids: task.bids.map((bid) => ({ ...bid })),
      })),
      events: this.events.map((event) => ({ ...event })),
      conflicts: this.conflicts
        .filter((conflict) => conflict.status === "NEGOTIATING")
        .map((conflict) => ({ ...conflict })),
      blockedEdges: this.edges.filter((edge) => edge.blocked).map((edge) => edge.id),
      reservations: this.reservations.map((reservation) => {
        const node = nodeById(this.nodes, reservation.resourceId);
        return { ...reservation, x: node?.x, y: node?.y };
      }),
      obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
      metrics: { ...this.lastMetrics },
      selectedRobotId: this.selectedRobotId,
      benchmark: this.benchmark ? structuredClone(this.benchmark) : null,
      latestDecision: this.latestDecision ? { ...this.latestDecision } : null,
      nodes: this.nodes.map((node) => ({ ...node })),
      edges: this.edges.map((edge) => ({ ...edge, occupancy: [...edge.occupancy] })),
      communicationMessages: this.network.totalMessages,
      deadlockCycles: this.deadlockCycles.map((cycle) => [...cycle]),
      demoPhase: this.demoPhase,
    };
  }

  runBenchmark() {
    const benchmarkSeed = this.seed;
    const baseline = this.runTrial("baseline", benchmarkSeed);
    const nexus = this.runTrial("distributed", benchmarkSeed);
    const baselineTime = baseline.completionTime;
    const timeReduction =
      baselineTime > 0
        ? ((baselineTime - nexus.completionTime) / baselineTime) * 100
        : 0;
    this.benchmark = { baseline, nexus, timeReduction, seed: benchmarkSeed };
    this.emit(
      null,
      "BENCHMARK_COMPLETED",
      "Same seeded task set executed in both policies; all values are from measured simulation state.",
      null,
      `Stop-and-wait ${baselineTime.toFixed(1)}s · distributed ${nexus.completionTime.toFixed(1)}s · ${timeReduction.toFixed(1)}% time reduction.`,
    );
    return this.benchmark;
  }

  private runTrial(mode: RobotMode, seed: number): BenchmarkResult["baseline"] {
    const engine = new SimulationEngine({
      seed,
      mode,
      robotCount: 6,
      taskCount: 12,
    });
    engine.start();
    const maxSeconds = 260;
    while (
      engine.time < maxSeconds &&
      engine.tasks.some((task) => task.status !== "COMPLETED")
    ) {
      engine.step(0.25);
    }
    const metrics = engine.calculateMetrics();
    const allComplete = engine.tasks.every((task) => task.status === "COMPLETED");
    const completionTime = allComplete
      ? Math.max(0, ...engine.tasks.map((task) => task.eta))
      : maxSeconds;
    return {
      completionTime,
      averageWait: metrics.averageWait,
      distance: metrics.distanceTravelled,
      tasksCompleted: metrics.completedTasks,
      deadlocks: metrics.deadlocks,
      reroutes: metrics.reroutes,
      collisions: metrics.collisions,
      throughput: metrics.throughput,
      energy: metrics.energyUsed,
    };
  }

  private createTaskSet(count: number) {
    const tasks: WarehouseTask[] = [];
    for (let index = 0; index < count; index += 1) tasks.push(this.makeTask(index));
    return tasks;
  }

  private makeTask(index = 0, pickupOverride?: string, skuOverride?: string): WarehouseTask {
    const racks = getRackLocations();
    const rack = racks[(this.randomInt(racks.length) + index) % racks.length];
    return {
      id: `TASK-${this.taskSequence++}`,
      orderId: `ORD-${String(78421 + this.taskSequence % 999).padStart(5, "0")}`,
      sku: skuOverride ?? rack.sku,
      pickup: pickupOverride ?? rack.id,
      destination: PACKING_NODE,
      priority: PRIORITIES[(index + this.randomInt(PRIORITIES.length)) % PRIORITIES.length],
      deadline: this.time + 45 + this.randomInt(55),
      workload: 1 + this.randomInt(4),
      estimatedDistance: 0,
      energyEstimate: 0,
      status: "WAITING",
      assignedRobotId: null,
      createdAt: this.time,
      picked: false,
      eta: 0,
      reassignments: 0,
      bids: [],
    };
  }

  private auctionTasks() {
    if (this.time - this.lastAuctionAt < 0.7) return;
    this.lastAuctionAt = this.time;
    const pending = this.tasks
      .filter((task) => task.status === "WAITING" || task.status === "REASSIGNED")
      .sort((a, b) => b.priority - a.priority);
    for (const task of pending) {
      const bids = this.agents
        .map((agent) => {
          const context = this.context(agent);
          const bid = agent.bid(task, context);
          return bid;
        })
        .filter((bid): bid is NonNullable<typeof bid> => Boolean(bid));
      task.bids = taskBidExplanation(
        bids.map((bid) => ({
          robotId: bid.robotId,
          cost: bid.cost,
          eta: bid.eta,
          reason: bid.reason,
        })),
      );
      for (const bid of bids) {
        this.broadcast(bid.robotId, "TASK_BID", {
          taskId: task.id,
          cost: bid.cost,
          eta: bid.eta,
          energy: bid.energy,
          conflictRisk: bid.risk,
        });
      }
      const winner = bids.sort((a, b) => a.cost - b.cost)[0];
      if (!winner) continue;
      const agent = this.findRobot(winner.robotId);
      if (!agent || !agent.assignTask(task, this.time)) continue;
      task.assignedRobotId = winner.robotId;
      task.status = "ASSIGNED";
      task.eta = this.time + winner.eta;
      task.estimatedDistance = this.routeDistanceForTask(task, agent.state.currentNode);
      task.energyEstimate = task.estimatedDistance * 0.46;
      this.broadcast(winner.robotId, "TASK_AWARD", {
        taskId: task.id,
        reason: `Lowest predicted completion cost (${winner.cost.toFixed(1)}) among ${bids.length} eligible agent bids.`,
      });
      this.emit(
        winner.robotId,
        "TASK_ASSIGNED",
        `${task.id} awarded to ${winner.robotId} after ${bids.length} local bids.`,
        task.pickup,
        `ETA ${winner.eta.toFixed(1)}s · cost ${winner.cost.toFixed(1)}.`,
      );
    }
  }

  private routeDistanceForTask(task: WarehouseTask, from: string) {
    const pickup = planRoute(from, task.pickup, { nodes: this.nodes, edges: this.edges });
    const delivery = planRoute(task.pickup, task.destination, { nodes: this.nodes, edges: this.edges });
    return (pickup?.distance ?? 0) + (delivery?.distance ?? 0);
  }

  private context(agent: RobotAgent, dt = 0.2): AgentContext {
    return {
      now: this.time,
      dt,
      mode: this.mode,
      nodes: this.nodes,
      edges: this.edges,
      tasks: this.tasks,
      robots: this.agents.map((candidate) => candidate.state),
      blockedEdges: new Set(this.edges.filter((edge) => edge.blocked).map((edge) => edge.id)),
      obstacles: this.obstacles,
      reservations: this.reservations,
      networkOnline: this.network.isOnline(agent.state.id),
      reserve: (resourceId, ownerRobot, startTime, endTime, priority) =>
        this.reserve(resourceId, ownerRobot, startTime, endTime, priority),
      release: (reservationId) => this.release(reservationId),
      releaseOwned: (ownerRobot) => this.releaseOwned(ownerRobot),
      send: (sender, target, type, payload, now, ttl) =>
        this.network.send(sender, target, type, payload, now, ttl),
      emit: (robotId, type, reason, resource, result) =>
        this.emit(robotId, type, reason, resource ?? null, result ?? ""),
      onTaskCompleted: (taskId, robotId) => {
        const task = this.tasks.find((candidate) => candidate.id === taskId);
        if (task) {
          task.assignedRobotId = robotId;
          task.eta = this.time;
        }
      },
      onTaskUnassigned: (taskId, robotId, reason) =>
        this.unassignTask(taskId, robotId, reason),
      onLowBattery: (robotId, taskId, reason) => {
        this.emit(robotId, "LOW_BATTERY", reason, null, taskId ? `${taskId} re-auctioned.` : "Charging prioritized.");
      },
    };
  }

  private reserve(
    resourceId: string,
    ownerRobot: string,
    startTime: number,
    endTime: number,
    priority: number,
  ) {
    const existing = this.reservations.find(
      (reservation) =>
        reservation.status === "ACTIVE" &&
        reservation.resourceId === resourceId &&
        reservation.ownerRobot !== ownerRobot &&
        reservation.endTime > startTime,
    );
    if (existing) {
      const ownerAtResource = this.agents.some(
        (agent) =>
          agent.state.id === existing.ownerRobot &&
          (agent.state.currentNode === resourceId ||
            agent.state.currentWaypoint === resourceId),
      );
      if (ownerAtResource || existing.priority >= priority) return null;
      existing.status = "RELEASED";
      this.emit(
        ownerRobot,
        "RESERVATION_MODIFIED",
        `${resourceId} lease transferred to the higher-priority local request.`,
        resourceId,
        `${existing.ownerRobot} → ${ownerRobot}`,
      );
    }
    const reservation: Reservation = {
      id: `R-${this.reservationSequence++}`,
      resourceId,
      ownerRobot,
      startTime,
      endTime,
      priority,
      status: "ACTIVE",
    };
    this.reservations.push(reservation);
    this.emit(
      ownerRobot,
      "RESERVATION_REQUESTED",
      `${ownerRobot} requested a lease for ${resourceId}.`,
      resourceId,
      "Peer lease checked.",
    );
    return reservation;
  }

  private release(reservationId: string) {
    const reservation = this.reservations.find((item) => item.id === reservationId);
    if (!reservation || reservation.status !== "ACTIVE") return;
    reservation.status = "RELEASED";
    this.emit(
      reservation.ownerRobot,
      "RESERVATION_RELEASED",
      `${reservation.ownerRobot} left ${reservation.resourceId}; lease released.`,
      reservation.resourceId,
      reservation.id,
    );
  }

  private releaseOwned(ownerRobot: string) {
    for (const reservation of this.reservations) {
      if (reservation.ownerRobot === ownerRobot && reservation.status === "ACTIVE") {
        this.release(reservation.id);
      }
    }
  }

  private expireReservations() {
    for (const reservation of this.reservations) {
      if (reservation.status === "ACTIVE" && reservation.endTime <= this.time) {
        reservation.status = "EXPIRED";
        this.emit(
          reservation.ownerRobot,
          "RESERVATION_EXPIRED",
          `Lease for ${reservation.resourceId} expired and was removed from the shared resource table.`,
          reservation.resourceId,
          reservation.id,
        );
      }
    }
    this.reservations = this.reservations.slice(-100);
  }

  private updateConflicts(tickConflicts: Conflict[]) {
    const activeMap = new Map<string, Conflict>();
    for (const conflict of tickConflicts) {
      const key = [conflict.robotA, conflict.robotB].sort().join(":") + `:${conflict.resource}`;
      const existing = activeMap.get(key);
      if (!existing || conflict.priorityA > existing.priorityA) {
        activeMap.set(key, { ...conflict, id: `CF-${key.replaceAll(":", "-")}` });
      }
    }
    const activeIds = new Set(Array.from(activeMap.values(), (item) => item.id));
    const previousActive = this.conflicts.filter((conflict) => conflict.status === "NEGOTIATING");
    for (const previous of previousActive) {
      if (!activeIds.has(previous.id)) {
        previous.status = "RESOLVED";
        previous.decision = previous.decision || "Resource cleared; both agents resumed.";
        this.emit(
          previous.robotA,
          "NEGOTIATION_RESOLVED",
          `Resource ${previous.resource} cleared after peer negotiation.`,
          previous.resource,
          previous.decision,
        );
      }
    }
    const next = Array.from(activeMap.values());
    const known = new Set(this.conflicts.map((conflict) => conflict.id));
    for (const conflict of next) {
      if (!known.has(conflict.id)) this.totalConflictCount += 1;
      this.conflicts = [
        conflict,
        ...this.conflicts.filter((item) => item.id !== conflict.id),
      ];
    }
    this.conflicts = [
      ...next,
      ...this.conflicts.filter(
        (conflict) => conflict.status === "RESOLVED" && !activeIds.has(conflict.id),
      ),
    ].slice(0, 30);
  }

  private detectDeadlocks() {
    const cycles = this.findWaitCycles();
    this.deadlockCycles = cycles;
    for (const cycle of cycles) {
      const cycleKey = [...cycle].sort().join(">");
      if (this.seenDeadlockCycles.has(cycleKey)) continue;
      this.seenDeadlockCycles.add(cycleKey);
      this.totalDeadlocks += 1;
      const ids = cycle.join(" → ");
      this.emit(null, "DEADLOCK_DETECTED", `Wait-for cycle detected: ${ids} → ${cycle[0]}.`, null, "Recovery selection started.");
      const victimId = cycle
        .map((id) => this.findRobot(id))
        .filter((agent): agent is RobotAgent => Boolean(agent))
        .sort((a, b) => a.state.taskPriority - b.state.taskPriority || b.state.id.localeCompare(a.state.id))[0]?.state.id;
      const victim = victimId ? this.findRobot(victimId) : null;
      if (!victim) continue;
      const reason = `${victimId} releases its wait dependency; a local alternative route breaks the cycle ${ids}.`;
      victim.recoverDeadlock(this.context(victim), reason);
      const remaining = this.findWaitCycles();
      if (remaining.length === 0) {
        this.deadlockCycles = [];
        this.emit(
          null,
          "DEADLOCK_RESOLVED",
          `Cycle ${ids} → ${cycle[0]} was removed from the wait-for graph.`,
          null,
          "Recovery action verified; traffic resumes.",
        );
      } else {
        this.deadlockCycles = remaining;
      }
    }
  }

  private findWaitCycles() {
    const waitMap = new Map<string, string>();
    for (const agent of this.agents) {
      if (agent.state.waitingFor) waitMap.set(agent.state.id, agent.state.waitingFor);
    }
    const cycles: string[][] = [];
    const globallyVisited = new Set<string>();
    for (const start of waitMap.keys()) {
      if (globallyVisited.has(start)) continue;
      const path: string[] = [];
      const indexById = new Map<string, number>();
      let current: string | undefined = start;
      while (current && waitMap.has(current) && !globallyVisited.has(current)) {
        const existingIndex = indexById.get(current);
        if (existingIndex !== undefined) {
          cycles.push(path.slice(existingIndex));
          break;
        }
        indexById.set(current, path.length);
        path.push(current);
        current = waitMap.get(current);
      }
      for (const id of path) globallyVisited.add(id);
    }
    return cycles;
  }

  private detectCollisions() {
    const activePairs = new Set<string>();
    for (let i = 0; i < this.agents.length; i += 1) {
      for (let j = i + 1; j < this.agents.length; j += 1) {
        const a = this.agents[i];
        const b = this.agents[j];
        const pairKey = [a.state.id, b.state.id].sort().join(":");
        if (
          a.state.health === "FAILED" ||
          b.state.health === "FAILED" ||
          Math.hypot(a.state.x - b.state.x, a.state.y - b.state.y) >= 0.76
        ) {
          continue;
        }
        activePairs.add(pairKey);
        if (!this.activeCollisionPairs.has(pairKey)) {
          this.totalCollisions += 1;
          const stopped =
            a.state.taskPriority < b.state.taskPriority ||
            (a.state.taskPriority === b.state.taskPriority && a.state.id > b.state.id)
              ? a
              : b;
          stopped.state.velocity = 0;
          stopped.state.safety = "EMERGENCY_STOP";
          stopped.state.status = "BLOCKED";
          stopped.state.reason = `Safety envelope triggered within ${a.state.id} / ${b.state.id}; emergency stop applied.`;
          this.emit(stopped.state.id, "SAFETY_STOP", stopped.state.reason, null, "Emergency stop.");
        }
      }
    }
    for (const agent of this.agents) {
      if (
        agent.state.safety === "EMERGENCY_STOP" &&
        !Array.from(activePairs).some((pair) => pair.split(":").includes(agent.state.id))
      ) {
        agent.state.safety = "NORMAL";
        agent.state.status = "RECOVERING";
        agent.state.reason = "Safety clearance restored; local planner is resuming after the stop.";
        this.emit(agent.state.id, "SAFETY_CLEAR", agent.state.reason, null, "Agent released for replanning.");
      }
    }
    this.activeCollisionPairs = activePairs;
  }

  private checkHeartbeats() {
    for (const agent of this.agents) {
      if (agent.state.health === "FAILED") continue;
      if (!this.network.isOnline(agent.state.id)) {
        for (const peer of this.agents) {
          if (peer.state.id === agent.state.id) continue;
          const known = peer.lastKnownPeers.find((item) => item.robotId === agent.state.id);
          if (known && this.time - known.receivedAt > 2.5) {
            peer.state.reason = `Peer ${agent.state.id} heartbeat is stale; keeping conservative clearance from last known position.`;
          }
        }
      }
    }
  }

  private updateCongestion() {
    for (const edge of this.edges) {
      const occupancy = edge.occupancy.length;
      edge.congestion = this.highCongestion
        ? Math.min(0.9, 0.62 + occupancy * 0.06)
        : Math.min(0.72, occupancy * 0.16 + (edge.narrow ? 0.06 : 0));
    }
  }

  private setHighCongestion(enabled: boolean) {
    this.highCongestion = enabled;
    for (const edge of this.edges) {
      edge.congestion = enabled ? 0.68 : edge.occupancy.length * 0.15;
    }
    this.emit(
      null,
      enabled ? "CONGESTION_INJECTED" : "CONGESTION_CLEARED",
      enabled ? "High traffic injected into shared aisles." : "Traffic returned to observed levels.",
      null,
      "Local route costs updated.",
    );
  }

  private blockAisle(edgeId: string) {
    const edge = this.edges.find((item) => item.id === edgeId);
    if (!edge) return;
    edge.blocked = true;
    const affected = this.agents.filter((agent) => agent.state.route.includes(edge.from) && agent.state.route.includes(edge.to));
    this.emit(
      null,
      "AISLE_BLOCKED",
      `Physical obstruction closed ${edgeId}; agents received an edge-blocked broadcast.`,
      edgeId,
      affected.map((agent) => agent.state.id).join(", ") || "No active route uses this segment.",
    );
    const broadcaster = this.agents.find((agent) => this.network.isOnline(agent.state.id));
    if (broadcaster) {
      this.network.send(broadcaster.state.id, "*", "EDGE_BLOCKED", { edgeId }, this.time, 20);
    }
    for (const agent of affected) {
      this.emit(
        agent.state.id,
        "ROUTE_INVALIDATED",
        `${edgeId} intersects the current route; local planner will select an alternative.`,
        edgeId,
        "Replanning.",
      );
    }
  }

  private spawnObstacle() {
    const robot = this.findRobot(this.selectedRobotId) ?? this.agents.find((agent) => agent.state.currentTaskId);
    if (!robot) return;
    const task = this.tasks.find((item) => item.id === robot.state.currentTaskId);
    const goal = task ? (task.picked ? task.destination : task.pickup) : null;
    const planned = goal
      ? planRoute(robot.state.currentNode, goal, {
          nodes: this.nodes,
          edges: this.edges,
          robotId: robot.state.id,
        })?.nodes
      : undefined;
    const next = robot.state.route[1] ?? planned?.[1];
    const target = nodeById(this.nodes, next);
    if (!target) return;
    const obstacle: Obstacle = {
      id: `OBS-${this.eventSequence}`,
      type: ["PALLET", "BOX", "FORKLIFT", "WORKER"][this.randomInt(4)] as Obstacle["type"],
      x: target.x,
      y: target.y,
      expiresAt: this.time + 9,
      detectedBy: robot.state.id,
    };
    this.obstacles.push(obstacle);
    this.emit(
      robot.state.id,
      "OBSTACLE_INJECTED",
      `${obstacle.type} entered the path at ${target.label}; the local safety supervisor will react.`,
      obstacle.id,
      `Temporary obstacle; clears at ${obstacle.expiresAt.toFixed(1)}s.`,
    );
  }

  private expireObstacles() {
    const active: Obstacle[] = [];
    for (const obstacle of this.obstacles) {
      if (obstacle.expiresAt <= this.time) {
        this.emit(
          obstacle.detectedBy,
          "OBSTACLE_CLEARED",
          `${obstacle.type} cleared from the aisle.`,
          obstacle.id,
          "Local obstacle map updated.",
        );
      } else {
        active.push(obstacle);
      }
    }
    this.obstacles = active;
  }

  private failRobot(agent: RobotAgent | null) {
    if (!agent) return;
    const taskId = agent.forceFailure(this.time, this.context(agent));
    if (taskId) this.unassignTask(taskId, agent.state.id, "Assigned robot failed; task is back in the peer auction.");
    this.network.setOnline(agent.state.id, false);
    this.auctionTasks();
  }

  private unassignTask(taskId: string, robotId: string, reason: string) {
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task || task.status === "COMPLETED") return;
    task.assignedRobotId = null;
    task.status = "REASSIGNED";
    task.reassignments += 1;
    this.broadcast(robotId, "TASK_REASSIGN", { taskId, reason });
    this.emit(
      robotId,
      "TASK_REASSIGNED",
      reason,
      task.pickup,
      `${taskId} returned to eligible-agent auction.`,
    );
  }

  private injectDeadlock() {
    const ids = this.agents.slice(0, 3).map((agent) => agent.state.id);
    if (ids.length < 3) return;
    this.deadlockCycles = [ids];
    ids.forEach((id, index) => {
      const agent = this.findRobot(id);
      const next = ids[(index + 1) % ids.length];
      if (agent) agent.forceDeadlockWait(next, this.context(agent));
    });
    this.detectDeadlocks();
  }

  private applyScenario(scenario: string) {
    if (scenario === "head-on" || scenario === "intersection" || scenario === "narrow-aisle") {
      this.tasks = [];
      const nodeLeft = scenario === "narrow-aisle" ? nodeId(1, 2) : nodeId(2, 2);
      const nodeRight = scenario === "narrow-aisle" ? nodeId(1, 4) : nodeId(1, 3);
      const conflictNode = scenario === "narrow-aisle" ? nodeId(1, 3) : nodeId(2, 3);
      const left = this.findRobot("AMR-01");
      const right = this.findRobot("AMR-02");
      if (left) this.placeAgent(left, nodeLeft);
      if (right) this.placeAgent(right, nodeRight);
      const first = this.makeTask(0, conflictNode);
      const second = this.makeTask(1, conflictNode);
      first.destination = nodeId(2, 6);
      second.destination = nodeId(0, 0);
      this.tasks.push(first, second);
      if (left) this.awardScenarioTask(left, first);
      if (right) this.awardScenarioTask(right, second);
      this.tasks.push(...this.createTaskSet(6));
    } else {
      this.tasks = this.createTaskSet(
        scenario === "stress-test" || scenario === "task-burst" ? 24 : this.taskCount,
      );
    }

    this.auctionTasks();
    if (scenario === "blocked-aisle" || scenario === "blocked") {
      this.blockAisle("C-17");
    } else if (scenario === "deadlock") {
      this.injectDeadlock();
    } else if (scenario === "communication-loss") {
      const robot = this.findRobot("AMR-02");
      if (robot) {
        this.network.setOnline(robot.state.id, false);
        robot.forceCommunicationLoss(this.context(robot), true);
      }
    } else if (scenario === "robot-failure") {
      this.failRobot(this.findRobot("AMR-03"));
    } else if (scenario === "low-battery") {
      this.findRobot("AMR-05")?.setBattery(8, this.context(this.findRobot("AMR-05")!));
    } else if (scenario === "obstacle") {
      this.spawnObstacle();
    } else if (scenario === "high-congestion") {
      this.setHighCongestion(true);
    } else if (scenario === "task-burst") {
      this.emit(null, "TASK_BURST", "Twenty-four warehouse tasks entered the distributed auction.", null, `${this.tasks.length} tasks.`);
    } else if (scenario === "multi-failure" || scenario === "stress-test") {
      this.stressStartedAt = this.time;
      this.demoPhase = "PHASE 1 · TASKS DISPATCHED";
      this.emit(null, "STRESS_TEST_STARTED", "Multi-disturbance warehouse run started; agents remain autonomous.", null, `${this.agents.length} AMRs · ${this.tasks.length} tasks.`);
    }
    this.auctionTasks();
  }

  private advanceDemo() {
    if (this.demoStartedAt === null) return;
    const elapsed = this.time - this.demoStartedAt;
    const phases: Array<{ at: number; name: string; action: () => void }> = [
      { at: 8, name: "PHASE 2 · CONFLICT NEGOTIATION", action: () => this.configureIntersectionWithoutReset() },
      { at: 19, name: "PHASE 3 · BLOCKED AISLE REROUTE", action: () => this.blockAisle("C-17") },
      {
        at: 32,
        name: "PHASE 4 · PEER LINK RECOVERY",
        action: () => this.inject("communication-loss"),
      },
      { at: 47, name: "PHASE 5 · DEADLOCK RECOVERY", action: () => this.injectDeadlock() },
      { at: 63, name: "PHASE 6 · FAILURE / TASK RE-AUCTION", action: () => this.failRobot(this.findRobot("AMR-06")) },
      { at: 78, name: "PHASE 7 · BATTERY RESERVE", action: () => this.findRobot("AMR-04")?.setBattery(13, this.context(this.findRobot("AMR-04")!)) },
      { at: 94, name: "PHASE 8 · SAFETY SUPERVISION", action: () => this.spawnObstacle() },
      { at: 112, name: "PHASE 9 · MEASURED BENCHMARK", action: () => { this.runBenchmark(); } },
    ];
    for (const phase of phases) {
      if (elapsed >= phase.at && this.demoPhase !== phase.name) {
        this.demoPhase = phase.name;
        phase.action();
        this.emit(null, "DEMO_PHASE", phase.name, null, "Automated sequence.");
      }
    }
    if (elapsed > 130) {
      this.demoPhase = "COMPLETE · FLEET OVERVIEW";
      this.demoStartedAt = null;
      this.emit(null, "DEMO_COMPLETED", "Autonomous sequence finished; final fleet state remains live.", null, "Demo complete.");
    }
  }

  private advanceStress() {
    if (this.stressStartedAt === null) return;
    const elapsed = this.time - this.stressStartedAt;
    const phases: Array<{ at: number; name: string; action: () => void }> = [
      { at: 4, name: "PHASE 2 · HIGH TRAFFIC LOAD", action: () => this.setHighCongestion(true) },
      { at: 10, name: "PHASE 3 · AISLE CLOSURE", action: () => this.blockAisle("C-17") },
      {
        at: 17,
        name: "PHASE 4 · PEER LINK LOSS",
        action: () => {
          const robot = this.findRobot("AMR-02");
          if (!robot || robot.state.communication === "OFFLINE") return;
          this.network.setOnline(robot.state.id, false);
          robot.forceCommunicationLoss(this.context(robot), true);
        },
      },
      { at: 25, name: "PHASE 5 · ROBOT FAILURE", action: () => this.failRobot(this.findRobot("AMR-03")) },
      { at: 33, name: "PHASE 6 · BATTERY RESERVE", action: () => this.findRobot("AMR-05")?.setBattery(9, this.context(this.findRobot("AMR-05")!)) },
      { at: 41, name: "PHASE 7 · DYNAMIC OBSTACLE", action: () => this.spawnObstacle() },
      { at: 49, name: "PHASE 8 · DEADLOCK RECOVERY", action: () => this.injectDeadlock() },
      { at: 63, name: "PHASE 9 · TRAFFIC NORMALIZED", action: () => this.setHighCongestion(false) },
    ];
    for (const phase of phases) {
      if (elapsed >= phase.at && !this.firedStressPhases.has(phase.name)) {
        this.firedStressPhases.add(phase.name);
        this.demoPhase = phase.name;
        phase.action();
        this.emit(null, "STRESS_PHASE", phase.name, null, "Environment changed; local agents continue replanning.");
      }
    }
    if (elapsed >= 72) {
      this.demoPhase = "STRESS COMPLETE · FLEET OVERVIEW";
      this.stressStartedAt = null;
      this.emit(null, "STRESS_TEST_COMPLETED", "All scheduled disturbances were applied; final measured fleet state is live.", null, "Environment sequence complete.");
    }
  }

  private configureIntersectionWithoutReset() {
    const left = this.findRobot("AMR-01");
    const right = this.findRobot("AMR-02");
    if (!left || !right) return;
    const shared = nodeId(2, 3);
    this.placeAgent(left, nodeId(1, 3));
    this.placeAgent(right, nodeId(2, 2));
    for (const agent of [left, right]) {
      const task = this.makeTask(agent === left ? 1 : 2, shared);
      task.destination = agent === left ? nodeId(2, 6) : nodeId(0, 0);
      this.tasks.push(task);
      agent.unassignTask(agent.state.currentTaskId ?? "");
      agent.assignTask(task, this.time);
      task.assignedRobotId = agent.state.id;
      task.status = "ASSIGNED";
    }
    this.emit(null, "CONFLICT_SCENARIO", "Two autonomous routes now converge on the same intersection.", shared, "Peer ETA negotiation expected.");
  }

  private placeAgent(agent: RobotAgent, node: string) {
    const position = nodeById(this.nodes, node);
    if (!position) return;
    this.releaseOwned(agent.state.id);
    for (const edge of this.edges) {
      edge.occupancy = edge.occupancy.filter((robotId) => robotId !== agent.state.id);
    }
    agent.state.currentNode = node;
    agent.state.x = position.x;
    agent.state.y = position.y;
    agent.state.route = [node];
    agent.state.plannedRoute = [node];
    agent.state.edgeProgress = 0;
    agent.state.fromNode = null;
    agent.state.destination = null;
    agent.state.status = "IDLE";
    agent.state.waitingFor = null;
    const lease = this.reserve(
      node,
      agent.state.id,
      this.time,
      this.time + 10_000,
      agent.state.taskPriority,
    );
    if (lease) agent.holdInitialNode(lease);
  }

  private awardScenarioTask(agent: RobotAgent, task: WarehouseTask) {
    agent.assignTask(task, this.time);
    task.assignedRobotId = agent.state.id;
    task.status = "ASSIGNED";
    task.eta = this.time + 5;
  }

  private broadcast(sender: string | "*", type: string, payload: Record<string, unknown>) {
    if (sender === "*") {
      const source = this.agents.find((agent) => this.network.isOnline(agent.state.id));
      if (source) this.network.send(source.state.id, "*", type, payload, this.time, 20);
      return;
    }
    this.network.send(sender, "*", type, payload, this.time, 20);
  }

  private findRobot(id: string | null | undefined) {
    if (!id) return null;
    return this.agents.find((agent) => agent.state.id === id) ?? null;
  }

  private emit(
    robotId: string | null,
    type: string,
    reason: string,
    resource: string | null = null,
    result = "",
  ) {
    const event: SimEvent = {
      id: `EV-${this.eventSequence++}`,
      time: this.time,
      robotId,
      type,
      reason,
      resource,
      result,
    };
    this.events.unshift(event);
    this.events = this.events.slice(0, EVENT_LIMIT);
    if (
      [
        "YIELD_DECISION",
        "REROUTE_SELECTED",
        "TASK_REASSIGNED",
        "DEADLOCK_RECOVERY",
        "LOW_BATTERY",
        "SAFETY_STOP",
        "RESERVATION_GRANTED",
      ].includes(type)
    ) {
      this.latestDecision = createLatestDecision(
        robotId ?? "FLEET",
        type.replaceAll("_", " "),
        reason,
        resource,
        null,
        this.findRobot(robotId)?.state.eta ?? 0,
        this.findRobot(robotId)?.state.alternativeRoute.length ?? 0,
        this.findRobot(robotId)?.state.waitSeconds ?? 0,
      );
    }
  }

  private updateMetrics() {
    this.lastMetrics = this.calculateMetrics();
  }

  private calculateMetrics(): Metrics {
    const activeRobots = this.agents.filter(
      (agent) => agent.state.health !== "FAILED",
    ).length;
    const batteries = this.agents.map((agent) => agent.state.battery);
    const avgBattery = batteries.length
      ? batteries.reduce((sum, item) => sum + item, 0) / batteries.length
      : 0;
    const completedTasks = this.tasks.filter((task) => task.status === "COMPLETED").length;
    const activeTasks = this.tasks.filter(
      (task) => !["COMPLETED"].includes(task.status),
    ).length;
    const distanceTravelled = this.agents.reduce(
      (sum, agent) => sum + agent.state.distanceTravelled,
      0,
    );
    const energyUsed = Math.max(
      0,
      this.initialEnergy - this.agents.reduce((sum, agent) => sum + agent.state.battery, 0),
    );
    const waits = this.agents.reduce(
      (sum, agent) => sum + agent.state.waitSeconds,
      0,
    );
    return {
      activeRobots,
      completedTasks,
      activeTasks,
      conflicts: this.totalConflictCount,
      deadlocks: this.totalDeadlocks,
      blockedAisles: this.edges.filter((edge) => edge.blocked).length,
      avgBattery,
      communicationHealth: this.agents.length
        ? (this.agents.filter((agent) => this.network.isOnline(agent.state.id)).length / this.agents.length) * 100
        : 0,
      throughput: this.time > 0 ? (completedTasks / this.time) * 60 : 0,
      distanceTravelled,
      reroutes: this.agents.reduce((sum, agent) => sum + agent.state.rerouteCount, 0),
      collisions: this.totalCollisions,
      averageWait: this.agents.length ? waits / this.agents.length : 0,
      energyUsed,
    };
  }

  private emptyMetrics(): Metrics {
    return {
      activeRobots: 0,
      completedTasks: 0,
      activeTasks: 0,
      conflicts: 0,
      deadlocks: 0,
      blockedAisles: 0,
      avgBattery: 0,
      communicationHealth: 0,
      throughput: 0,
      distanceTravelled: 0,
      reroutes: 0,
      collisions: 0,
      averageWait: 0,
      energyUsed: 0,
    };
  }

  private cloneRobot(robot: RobotState): RobotState {
    return {
      ...robot,
      route: [...robot.route],
      plannedRoute: [...robot.plannedRoute],
      alternativeRoute: [...robot.alternativeRoute],
      taskQueue: [...robot.taskQueue],
      decisionHistory: robot.decisionHistory.map((decision) => ({ ...decision })),
    };
  }

  private randomInt(max: number) {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0;
    return Math.floor((this.randomState / 0x100000000) * max);
  }
}