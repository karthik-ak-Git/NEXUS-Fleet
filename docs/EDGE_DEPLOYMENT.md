# Edge Deployment Guide

The `RobotAgent` code in `backend/app/agents/robot_agent.py` is designed to be deployed directly onto edge hardware (e.g. Raspberry Pi 4/5, NVIDIA Jetson Orin Nano, industrial AMR onboard PC).

---

## 1. Single Agent Hardware Runtime

On an actual physical AMR:

```python
import asyncio
from backend.app.agents.robot_agent import RobotAgent
from backend.app.schemas.simulation import WarehouseNodeSchema

# Local node initialization
my_node = WarehouseNodeSchema(id="N-0-0", x=-12.0, y=-8.0, kind="charger", label="CHG-01")
agent = RobotAgent(id_str="AMR-01", starting_node="N-0-0", node=my_node)

async def edge_agent_loop():
    # Reads physical wheel encoders, LIDAR safety sensors, UDP peer radio packets
    while True:
        # agent.step(context)
        await asyncio.sleep(0.1)
```

---

## 2. Hardware Interfaces

- **Sensor Input:** Interfaced via local safety supervisor (`agent_safety.py`).
- **Peer Communications:** Transported over local Wi-Fi / Private 5G UDP multicast radio mesh (`peer_protocol.py`).
- **Observability:** Streams telemetry back to central digital twin dashboard over WebSocket.
