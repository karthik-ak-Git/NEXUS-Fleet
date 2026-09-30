# NEXUS-Fleet: Edge-AI Based Distributed AMR Coordination Engine

> **Smart India Hackathon 2026 Problem Statement:** SIH26123  
> **Title:** Edge-AI Based Distributed Fleet Coordination for Autonomous Mobile Robots (AMRs) in Smart Warehouses  
> **Core Principle:** THE ROBOT IS THE AGENT. The backend application hosts the distributed agent runtime and state synchronization layer; each AMR maintains its own operational state and independently makes task, routing, negotiation, reservation, recovery, and safety decisions.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python:** 3.10+ with [`uv`](https://github.com/astral-sh/uv)
- **Node.js:** 20+ with [`pnpm`](https://pnpm.io/)

### 2. Installation

```bash
# Install Python backend dependencies using uv
uv sync

# Install Node.js frontend dependencies using pnpm
pnpm install --ignore-scripts
```

### 3. Running the Application

#### Backend Autonomous Engine (`uv`):
```bash
uv run uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

#### Frontend UI Digital Twin (`pnpm`):
```bash
$env:PORT="5173"; $env:BASE_PATH="/"; npx vite --host 0.0.0.0 --port 5173
```

---

## 🌐 Live URLs & Endpoints

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Frontend UI (Digital Twin & Dashboard)** | [`http://localhost:5173`](http://localhost:5173) | 3D visual warehouse twin, metrics, event stream, agent inspector |
| **Backend REST API Health Check** | [`http://localhost:8000/api/health`](http://localhost:8000/api/health) | Backend health verification |
| **Backend Fleet Snapshot** | [`http://localhost:8000/api/fleet`](http://localhost:8000/api/fleet) | Live 10 Hz simulation snapshot & telemetry |
| **Backend WebSocket Stream** | `ws://localhost:8000/ws/fleet` | Bidirectional real-time agent state & event broadcaster |
| **Backend Swagger API Docs** | [`http://localhost:8000/docs`](http://localhost:8000/docs) | Interactive OpenAPI / Swagger documentation |

---

## 📐 Architecture & System Principles

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

### Key Highlights:
1. **Decentralized Robot Autonomy:** Every robot agent (`RobotAgent`) independently executes a 10-step autonomous loop (`OBSERVE -> UPDATE WORLD MODEL -> PREDICT -> PLAN -> COMMUNICATE -> NEGOTIATE -> RESERVE -> ACT -> VERIFY -> RECOVER`).
2. **Deterministic A* Path Planning:** Multi-factor cost function evaluating travel distance, congestion penalties, traversal risk, active peer leases, and low-battery energy weights.
3. **P2P Negotiation & Priority Leases:** Conflicts at narrow aisles or intersections are resolved through right-of-way priority scoring. The winner acquires a time-bounded lease; the lower priority agent yields or reroutes.
4. **Deadlock Cycle Recovery:** Construct wait-for dependency graphs, perform DFS cycle detection, select the lowest priority victim, and execute automated alternative path replanning.
5. **High-Reach Cart AMR Digital Twin:** Visual 3D scene renders High-Reach Cart AMRs featuring straight twin vertical mast rods, sliding lift carriages, and container tote box lifting animations during pickup & delivery.
6. **Gemini Intelligence Layer:** Server-side natural-language telemetry explanations powered by Google Gemini (`google-genai` SDK) with clean fallback if `GEMINI_API_KEY` is omitted.

---

## 🧪 Testing & Verification

Run automated test suites using `uv`:

```bash
# Run backend pytest suite
uv run pytest backend/tests
```

---

## 📚 Detailed Documentation

All detailed architectural documentation is available in `/docs/`:

- [`docs/ARCHITECTURE_AUDIT.md`](docs/ARCHITECTURE_AUDIT.md) — Initial codebase audit & protection boundaries
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System architecture & sequence diagrams
- [`docs/ROBOT_AGENT.md`](docs/ROBOT_AGENT.md) — Agent state machine & 10-step loop
- [`docs/PEER_PROTOCOL.md`](docs/PEER_PROTOCOL.md) — Peer-to-peer radio protocol specs
- [`docs/COORDINATION.md`](docs/COORDINATION.md) — Priority scoring, negotiation & deadlock recovery
- [`docs/API.md`](docs/API.md) — REST & WebSocket API specification
- [`docs/DEMO_SCENARIOS.md`](docs/DEMO_SCENARIOS.md) — Reproducible test scenarios
- [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) — Target SIH metric measurement methodology
- [`docs/EDGE_DEPLOYMENT.md`](docs/EDGE_DEPLOYMENT.md) — Raspberry Pi / NVIDIA Jetson hardware deployment guide
- [`docs/GEMINI_INTEGRATION.md`](docs/GEMINI_INTEGRATION.md) — Gemini AI layer configuration & security
