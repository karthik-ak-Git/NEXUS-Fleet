from typing import Literal
from pydantic import BaseModel

class ReservationSchema(BaseModel):
    id: str
    resourceId: str
    ownerRobot: str
    startTime: float
    endTime: float
    priority: float
    status: Literal["ACTIVE", "RELEASED", "EXPIRED"] = "ACTIVE"
