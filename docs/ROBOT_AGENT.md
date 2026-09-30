# RobotAgent Autonomy & Operational Lifecycle

## 1. Core Principle
Every Autonomous Mobile Robot (AMR) is an independent decision-making agent. The robot maintains its own local world model, cached peer radio states, active reservations, and local blocked aisle maps.

---

## 2. Autonomous Agent Loop

Every tick step (10 Hz), the `RobotAgent` executes:

1. **OBSERVE:** Collect peer radio packets (`HEARTBEAT`, `STATE_UPDATE`, `EDGE_BLOCKED`, `STATE_SYNC`) from the peer message queue.
2. **UPDATE LOCAL WORLD MODEL:** Refresh cached positions, intentions, and priority scores of nearby peers. Prune stale peer entries (> 4.5s).
3. **PREDICT:** Evaluate upcoming intersection and narrow-corridor traversals against peer ETAs. Detect predicted conflicts before entering shared space.
4. **PLAN:** Compute optimal A* path to current destination. Factor in travel time, congestion, risk, energy weight, and active peer leases.
5. **COMMUNICATE:** Broadcast local position, destination, battery, priority score, and route intent to peer mesh network.
6. **NEGOTIATE:** Open peer-to-peer right-of-way negotiation upon predicted conflict. If peer priority is higher, yield; if lower, proceed.
7. **RESERVE:** Request time-bounded node and edge leases via the reservation manager.
8. **ACT:** Kinematic progress along target edge. Update velocity, acceleration, heading angle, and position.
9. **VERIFY:** Check local obstacle clearance envelope (0.9m threshold). Trigger emergency stop if obstacle or unsafe following distance occurs.
10. **RECOVER:** If a deadlock wait-for cycle is detected or an aisle becomes blocked, cancel invalid route segments and execute an alternative path plan.

---

## 3. State Machine

- `IDLE`: Ready for task assignment.
- `MOVING`: Traversal along planned route.
- `WAITING`: Yielding shared node/edge to higher priority peer or clearing obstacle.
- `NEGOTIATING`: Priority evaluation and lease request in progress.
- `YIELDING`: Yielding right-of-way to peer.
- `REROUTING`: Alternate path calculation active due to blockage or congestion.
- `BLOCKED`: Path obstructed without immediate alternative.
- `CHARGING`: Autonomous return-to-dock charging cycle.
- `COMMUNICATION_LOST`: Degraded mode operating from local world model.
- `FAILED`: Unit hardware failure injected; work re-auctioned.
- `RECOVERING`: Clearing deadlock or resuming after safety stop.
- `COMPLETED`: Work package delivered to packing station.
