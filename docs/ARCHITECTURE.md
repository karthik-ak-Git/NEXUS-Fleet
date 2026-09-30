# NEXUS-Fleet System Architecture

> **SIH Problem Statement:** SIH26123 — Edge-AI Based Distributed Fleet Coordination for Autonomous Mobile Robots (AMRs) in Smart Warehouses  
> **Core Principle:** THE ROBOT IS THE AGENT.

---

## 1. High-Level Architecture Diagram

```
                 EXISTING FRONTEND (React + Three.js)
                                  |
                                  | REST API + WebSockets (/ws/fleet)
                                  v
                       FASTAPI BACKEND SYSTEM
                                  |
             +--------------------+--------------------+
             |                    |                    |
             v                    v                    v
      Simulation Engine      Event Engine       Gemini AI Service
             |
             v
      Robot Agent Runtime
             |
      +------+------+------+
      |      |      |      |
     AMR01  AMR02  AMR03  AMRN
      |      |      |      |
      +------+------+------+
             |
             v
      Peer-to-Peer Message Bus (Ad-Hoc Radio Simulator)
             |
             v
    Coordination / Priority Negotiation Layer
             |
             v
    Time-Bounded Resource Reservations & Deadlock Cycle Recovery
             |
             v
      Warehouse World Model (Graph: 35 Nodes, 58 Edges)
```

---

## 2. Decoupling & Agent Autonomy Guarantee

In accordance with SIH Problem Statement SIH26123:
- **No Central Fleet Brain:** The backend host container does NOT make centralized control decisions like `central_controller.decide_all_robots()`.
- **Robot Edge Autonomy:** Each `RobotAgent` instance runs its own local operational state machine, executing:
  `OBSERVE -> UPDATE WORLD MODEL -> PREDICT -> PLAN -> COMMUNICATE -> NEGOTIATE -> RESERVE -> ACT -> VERIFY -> RECOVER`
- **Frontend Presentation Layer:** The React + Three.js visual frontend functions strictly as an observability digital twin. It interpolates render positions based on backend telemetry updates streamed over WebSockets (`/ws/fleet`).

---

## 3. Technology Stack

- **Backend:** Python 3.13, FastAPI, Pydantic v2, asyncio, WebSockets.
- **Pathfinding:** A* Graph Search with multi-factor edge cost function (distance, congestion, risk, active reservations, energy weight).
- **Intelligence Layer:** Google Gemini 2.5 Flash (`google-genai` SDK) for structured natural-language telemetry explanations.
- **Testing:** Pytest with deterministic seeds.
