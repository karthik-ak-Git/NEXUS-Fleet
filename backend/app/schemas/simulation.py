from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

from .robot import RobotStateSchema
from .task import WarehouseTaskSchema
from .negotiation import ConflictSchema
from .reservation import ReservationSchema
from .event import SimEventSchema

class WarehouseNodeSchema(BaseModel):
    id: str
    x: float
    y: float
    kind: Literal["intersection", "rack", "packing", "charger", "staging", "loading"]
    label: str

class WarehouseEdgeSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    from_node: str = Field(..., alias="from")
    to_node: str = Field(..., alias="to")
    length: float
    estimatedTravelTime: float
    capacity: int = 2
    direction: Literal["both", "forward", "reverse"] = "both"
    speedLimit: float = 2.0
    congestion: float = 0.0
    blocked: bool = False
    risk: float = 0.04
    occupancy: List[str] = Field(default_factory=list)
    narrow: bool = False

class ObstacleSchema(BaseModel):
    id: str
    type: Literal["PALLET", "BOX", "FORKLIFT", "WORKER"]
    x: float
    y: float
    expiresAt: float
    detectedBy: Optional[str] = None

class MetricsSchema(BaseModel):
    activeRobots: int = 0
    completedTasks: int = 0
    activeTasks: int = 0
    conflicts: int = 0
    deadlocks: int = 0
    blockedAisles: int = 0
    avgBattery: float = 0.0
    communicationHealth: float = 1.0
    throughput: float = 0.0
    distanceTravelled: float = 0.0
    reroutes: int = 0
    collisions: int = 0
    averageWait: float = 0.0
    energyUsed: float = 0.0

class TrialMetricsSchema(BaseModel):
    completionTime: float
    averageWait: float
    distance: float
    tasksCompleted: int
    deadlocks: int
    reroutes: int
    collisions: int
    throughput: float
    energy: float

class BenchmarkResultSchema(BaseModel):
    baseline: TrialMetricsSchema
    nexus: TrialMetricsSchema
    timeReduction: float
    seed: int

class LatestDecisionSchema(BaseModel):
    robotId: str
    action: str
    reason: str
    resource: Optional[str] = None
    peerId: Optional[str] = None
    eta: float = 0.0
    rerouteCost: float = 0.0
    waitCost: float = 0.0
    selectedAction: str

class SimulationSnapshotSchema(BaseModel):
    running: bool
    time: float
    mode: Literal["distributed", "baseline"]
    speed: float
    robots: List[RobotStateSchema]
    tasks: List[WarehouseTaskSchema]
    events: List[SimEventSchema]
    conflicts: List[ConflictSchema]
    blockedEdges: List[str]
    reservations: List[ReservationSchema]
    obstacles: List[ObstacleSchema]
    metrics: MetricsSchema
    selectedRobotId: Optional[str] = None
    benchmark: Optional[BenchmarkResultSchema] = None
    latestDecision: Optional[LatestDecisionSchema] = None
    nodes: List[WarehouseNodeSchema]
    edges: List[WarehouseEdgeSchema]
    communicationMessages: int = 0
    deadlockCycles: List[List[str]] = Field(default_factory=list)
    demoPhase: Optional[str] = None
