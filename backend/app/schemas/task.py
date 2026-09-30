from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

class BidSchema(BaseModel):
    robotId: str
    cost: float
    eta: float
    energy: float = 0.0
    risk: float = 0.0
    reason: str

class WarehouseTaskSchema(BaseModel):
    id: str
    orderId: str
    sku: str
    pickup: str
    destination: str
    priority: float
    deadline: float
    workload: float
    estimatedDistance: float
    energyEstimate: float
    status: Literal["WAITING", "ASSIGNED", "PICKING", "DELIVERING", "COMPLETED", "REASSIGNED"] = "WAITING"
    assignedRobotId: Optional[str] = None
    createdAt: float
    picked: bool = False
    eta: float = 0.0
    reassignments: int = 0
    bids: List[BidSchema] = Field(default_factory=list)
