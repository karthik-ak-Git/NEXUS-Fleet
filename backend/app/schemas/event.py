from typing import Optional
from pydantic import BaseModel

class SimEventSchema(BaseModel):
    id: str
    time: float
    robotId: Optional[str] = None
    type: str
    reason: str
    resource: Optional[str] = None
    result: str = ""
