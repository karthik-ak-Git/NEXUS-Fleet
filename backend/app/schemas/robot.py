from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

RobotStatus = Literal[
    "IDLE",
    "MOVING",
    "WAITING",
    "NEGOTIATING",
    "YIELDING",
    "REROUTING",
    "BLOCKED",
    "CHARGING",
    "COMMUNICATION_LOST",
    "FAILED",
    "RECOVERING",
    "COMPLETED",
]

TaskStatus = Literal[
    "WAITING",
    "ASSIGNED",
    "PICKING",
    "DELIVERING",
    "COMPLETED",
    "REASSIGNED",
]

CommunicationStatus = Literal["ONLINE", "DEGRADED", "OFFLINE"]

class DecisionEntry(BaseModel):
    time: float
    action: str
    reason: str

class RobotStateSchema(BaseModel):
    id: str
    x: float
    y: float
    heading: float = 0.0
    velocity: float = 0.0
    acceleration: float = 0.0
    battery: float = 100.0
    batteryCapacity: float = 100.0
    currentTaskId: Optional[str] = None
    taskQueue: List[str] = Field(default_factory=list)
    taskPriority: float = 0.0
    route: List[str] = Field(default_factory=list)
    plannedRoute: List[str] = Field(default_factory=list)
    alternativeRoute: List[str] = Field(default_factory=list)
    currentWaypoint: Optional[str] = None
    currentNode: str
    fromNode: Optional[str] = None
    edgeProgress: float = 0.0
    destination: Optional[str] = None
    eta: float = 0.0
    intent: str = "AVAILABLE"
    status: RobotStatus = "IDLE"
    communication: CommunicationStatus = "ONLINE"
    communicationFreshness: float = 0.0
    health: Literal["HEALTHY", "DEGRADED", "FAILED"] = "HEALTHY"
    currentReservation: Optional[str] = None
    waitingFor: Optional[str] = None
    reason: str = "Initialized"
    distanceTravelled: float = 0.0
    rerouteCount: int = 0
    waitSeconds: float = 0.0
    safety: Literal["NORMAL", "SLOW", "STOP", "EMERGENCY_STOP"] = "NORMAL"
    decisionHistory: List[DecisionEntry] = Field(default_factory=list)
