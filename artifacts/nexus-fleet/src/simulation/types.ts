export type RobotMode = "distributed" | "baseline";

export type RobotStatus =
  | "IDLE"
  | "MOVING"
  | "WAITING"
  | "NEGOTIATING"
  | "YIELDING"
  | "REROUTING"
  | "BLOCKED"
  | "CHARGING"
  | "COMMUNICATION_LOST"
  | "FAILED"
  | "RECOVERING"
  | "COMPLETED";

export type TaskStatus =
  | "WAITING"
  | "ASSIGNED"
  | "PICKING"
  | "DELIVERING"
  | "COMPLETED"
  | "REASSIGNED";

export type CommunicationStatus = "ONLINE" | "DEGRADED" | "OFFLINE";

export interface WarehouseNode {
  id: string;
  x: number;
  y: number;
  kind: "intersection" | "rack" | "packing" | "charger" | "staging" | "loading";
  label: string;
}

export interface WarehouseEdge {
  id: string;
  from: string;
  to: string;
  length: number;
  estimatedTravelTime: number;
  capacity: number;
  direction: "both" | "forward" | "reverse";
  speedLimit: number;
  congestion: number;
  blocked: boolean;
  risk: number;
  occupancy: string[];
  narrow: boolean;
}

export interface RobotState {
  id: string;
  x: number;
  y: number;
  heading: number;
  velocity: number;
  acceleration: number;
  battery: number;
  batteryCapacity: number;
  currentTaskId: string | null;
  taskQueue: string[];
  taskPriority: number;
  route: string[];
  plannedRoute: string[];
  alternativeRoute: string[];
  currentWaypoint: string | null;
  currentNode: string;
  fromNode: string | null;
  edgeProgress: number;
  destination: string | null;
  eta: number;
  intent: string;
  status: RobotStatus;
  communication: CommunicationStatus;
  communicationFreshness: number;
  health: "HEALTHY" | "DEGRADED" | "FAILED";
  currentReservation: string | null;
  waitingFor: string | null;
  reason: string;
  distanceTravelled: number;
  rerouteCount: number;
  waitSeconds: number;
  safety: "NORMAL" | "SLOW" | "STOP" | "EMERGENCY_STOP";
  decisionHistory: Array<{ time: number; action: string; reason: string }>;
}

export interface WarehouseTask {
  id: string;
  orderId: string;
  sku: string;
  pickup: string;
  destination: string;
  priority: number;
  deadline: number;
  workload: number;
  estimatedDistance: number;
  energyEstimate: number;
  status: TaskStatus;
  assignedRobotId: string | null;
  createdAt: number;
  picked: boolean;
  eta: number;
  reassignments: number;
  bids: Array<{ robotId: string; cost: number; eta: number; reason: string }>;
}

export interface SimEvent {
  id: string;
  time: number;
  robotId: string | null;
  type: string;
  reason: string;
  resource: string | null;
  result: string;
}

export interface Conflict {
  id: string;
  robotA: string;
  robotB: string;
  resource: string;
  etaA: number;
  etaB: number;
  priorityA: number;
  priorityB: number;
  risk: number;
  predictedDelay: number;
  decision: string;
  status: "NEGOTIATING" | "RESOLVED";
}

export interface Reservation {
  id: string;
  resourceId: string;
  ownerRobot: string;
  startTime: number;
  endTime: number;
  priority: number;
  status: "ACTIVE" | "RELEASED" | "EXPIRED";
}

export interface Obstacle {
  id: string;
  type: "PALLET" | "BOX" | "FORKLIFT" | "WORKER";
  x: number;
  y: number;
  expiresAt: number;
  detectedBy: string | null;
}

export interface Metrics {
  activeRobots: number;
  completedTasks: number;
  activeTasks: number;
  conflicts: number;
  deadlocks: number;
  blockedAisles: number;
  avgBattery: number;
  communicationHealth: number;
  throughput: number;
  distanceTravelled: number;
  reroutes: number;
  collisions: number;
  averageWait: number;
  energyUsed: number;
}

export interface BenchmarkResult {
  baseline: {
    completionTime: number;
    averageWait: number;
    distance: number;
    tasksCompleted: number;
    deadlocks: number;
    reroutes: number;
    collisions: number;
    throughput: number;
    energy: number;
  };
  nexus: {
    completionTime: number;
    averageWait: number;
    distance: number;
    tasksCompleted: number;
    deadlocks: number;
    reroutes: number;
    collisions: number;
    throughput: number;
    energy: number;
  };
  timeReduction: number;
  seed: number;
}

export interface LatestDecision {
  robotId: string;
  action: string;
  reason: string;
  resource: string | null;
  peerId: string | null;
  eta: number;
  rerouteCost: number;
  waitCost: number;
  selectedAction: string;
}

export interface SimulationSnapshot {
  running: boolean;
  time: number;
  mode: RobotMode;
  speed: number;
  robots: RobotState[];
  tasks: WarehouseTask[];
  events: SimEvent[];
  conflicts: Conflict[];
  blockedEdges: string[];
  reservations: Reservation[];
  obstacles: Obstacle[];
  metrics: Metrics;
  selectedRobotId: string | null;
  benchmark: BenchmarkResult | null;
  latestDecision: LatestDecision | null;
  nodes: WarehouseNode[];
  edges: WarehouseEdge[];
  communicationMessages: number;
  deadlockCycles: string[][];
  demoPhase: string | null;
}

export interface PeerMessage {
  sender: string;
  target: string | "*";
  timestamp: number;
  type: string;
  payload: Record<string, unknown>;
  ttl: number;
  sequence: number;
}

export interface Bid {
  robotId: string;
  cost: number;
  eta: number;
  energy: number;
  risk: number;
  reason: string;
}