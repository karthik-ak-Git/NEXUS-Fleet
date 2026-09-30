from typing import Literal
from pydantic import BaseModel

class ConflictSchema(BaseModel):
    id: str
    robotA: str
    robotB: str
    resource: str
    etaA: float
    etaB: float
    priorityA: float
    priorityB: float
    risk: float
    predictedDelay: float
    decision: str
    status: Literal["NEGOTIATING", "RESOLVED"] = "NEGOTIATING"

class PeerMessageSchema(BaseModel):
    sender: str
    target: str
    timestamp: float
    type: str
    payload: dict
    ttl: float = 4.0
    sequence: int = 0
