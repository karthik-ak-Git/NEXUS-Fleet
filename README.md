# NEXUS-Fleet: Autonomous Warehouse AMR Digital Twin & Multi-Agent Fleet Engine

> **SIH 2026 Problem Statement:** SIH26123  
> **Title:** Edge-AI Based Distributed Fleet Coordination for Autonomous Mobile Robots (AMRs) in Smart Warehouses  
> **Core Principle:** THE ROBOT IS THE AGENT. The backend application hosts the distributed agent runtime and state synchronization layer; each AMR maintains its own operational state and independently makes task, routing, negotiation, reservation, recovery, and safety decisions.

---

## 📐 System Architecture

```
                    ORDERS / TASK MANAGER
                              |
                              v
                    FLEET MANAGER
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
           AMR-01           AMR-02           AMR-N
             |                |                |
             +----------------+----------------+
                              |
                       SHARED WORLD STATE
                              |
                +-------------+-------------+
                |                           |
                v                           v
            2D OPERATIONAL               3D DIGITAL
                 MAP                        TWIN
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Python:** 3.10+ with [`uv`](https://github.com/astral-sh/uv)
- **Node.js:** 20+ with [`pnpm`](https://pnpm.io/)

### 2. Installation & Running

#### Backend Autonomous Engine (`uv`):
```bash
uv run uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

#### Frontend UI Digital Twin (`pnpm`):
```bash
$env:PORT="5173"; $env:BASE_PATH="/"; cmd /c "set PORT=5173 && set BASE_PATH=/ && pnpm dev"
```

---

## 🌐 Live URLs & Endpoints

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Frontend Web Console** | [`http://localhost:5173/console`](http://localhost:5173/console) | 3D visual warehouse twin, 2D map, telemetry HUD, control bar |
| **Backend REST API Health Check** | [`http://localhost:8000/health`](http://localhost:8000/health) | Backend health & diagnostics |
| **Backend Fleet Snapshot** | [`http://localhost:8000/api/v1/fleet/status`](http://localhost:8000/api/v1/fleet/status) | Live 10 Hz simulation snapshot & telemetry |
| **Backend WebSocket Stream** | `ws://localhost:8000/ws/fleet` | Bidirectional real-time agent state & event broadcaster |
| **Backend Swagger API Docs** | [`http://localhost:8000/docs`](http://localhost:8000/docs) | Interactive OpenAPI / Swagger documentation |

---

## 🏭 Core System Modules

### 1. Warehouse Physical Geometry & Aisle Navigation
- Physical shelf bounding boxes (`Rack A-11` .. `Rack F-46`) defined as strict obstacle spaces.
- Navigation graph nodes located in open driving corridors with aisle-first approach points.
- Zero penetration through physical shelf geometry.

### 2. Multi-Robot Traffic Coordination & Space-Time Reservations
- Atomic node & edge reservations. When a robot yields or waits, it explicitly reserves its physical footprint so following robots queue safely or reroute.
- Dynamic deadlock cycle detection & priority arbitration.

### 3. Shelf Pickup & Counter Delivery Handshake
- Shelf approach $\rightarrow$ alignment $\rightarrow$ package pick $\rightarrow$ aisle exit.
- Delivery counter queueing (`DOCK-01`, `QUEUE-01`, `QUEUE-02`, `QUEUE-03`). Idempotent package acceptance transferring package ownership from robot to counter.

### 4. Charging & Return-to-Home
- Dedicated charging slots (`C-01` .. `C-10`). After delivery completion, robots with no queued tasks return directly to home docks (`RETURNING_HOME` $\rightarrow$ `DOCKING` $\rightarrow$ `CHARGING`).
- Automatic low-battery docking (< 24% battery).

### 5. 2D Operational Map & 3D Digital Twin Synchronization
- Unified backend `SimulationSnapshot` shared across 2D Canvas and Three.js 3D renderer with synchronized `worldToScreen` and `worldToThree` coordinate mappings.
- Debug mode overlay rendering shelf bounding boxes, graph nodes, edges, pickup points, robot footprints, and reservation leases.

---

## 🧪 Automated Test Suite (22 System Tests + 6-AMR End-to-End Test)

Run the full pytest suite:

```bash
uv run pytest backend/tests
```

### Verified Test Cases:
* **TEST 1:** Navigation nodes never inside shelves.
* **TEST 2:** Navigation edges never pass through shelves.
* **TEST 3:** Robot footprint never overlaps shelves.
* **TEST 4:** Shelf pickup occurs from valid approach point.
* **TEST 5:** Robot exits shelf area after pickup.
* **TEST 6:** Counter accepts package.
* **TEST 7:** Task becomes `COMPLETED` only after acceptance.
* **TEST 8:** Package transfers robot $\rightarrow$ counter.
* **TEST 9:** Robot clears package after delivery.
* **TEST 10:** Robot returns to home if no task exists.
* **TEST 11:** Robot docks at charging station.
* **TEST 12:** Charging slot cannot be double occupied.
* **TEST 13:** Waiting robot reserves physical space.
* **TEST 14:** Another robot cannot enter waiting space.
* **TEST 15:** Multiple robots queue at counter.
* **TEST 16:** Queue advances safely.
* **TEST 17:** No overlapping reservations.
* **TEST 18:** Deadlock detection works.
* **TEST 19:** Low battery robot returns to charge.
* **TEST 20:** 2D and 3D use identical backend coordinates.
* **TEST 21:** Frontend reconnects correctly.
* **TEST 22:** 6-Robot end-to-end scenario executes autonomously with 0 collisions.

---

## 📦 Docker & Vercel Production Deployment

### Docker Container Deployment
```bash
docker build -t nexus-fleet-backend -f Dockerfile .
docker run -p 8000:8000 nexus-fleet-backend
```

### Vercel Deployment Configuration
- `vercel.json` provides API routing and static frontend distribution.
- Environment variables: `VITE_API_BASE_URL`, `VITE_WS_URL`, `PORT`, `CORS_ALLOWED_ORIGINS`.
