# Backend REST & WebSocket API Reference

Base URL: `http://localhost:8000`

---

## 1. REST Endpoints

### Health Check
- `GET /api/health`
- **Response:** `{"status": "ok", "service": "NEXUS-Fleet Autonomous Backend Engine"}`

### Fleet Telemetry & State
- `GET /api/fleet` -> Returns full `SimulationSnapshotSchema`
- `GET /api/robots` -> Returns array of `RobotStateSchema`
- `GET /api/robots/{robot_id}` -> Returns single robot state
- `GET /api/tasks` -> Returns task list
- `GET /api/events` -> Returns last 240 event logs
- `GET /api/negotiations` -> Returns active & recent conflict negotiations
- `GET /api/reservations` -> Returns active resource leases

### Simulation & Control Commands
- `POST /api/tasks` -> Dispatches new order task, triggers auction. Body: `{"pickup": "N-1-2", "priority": 0.8}`
- `POST /api/scenarios/{id}/start` -> Resumes simulation
- `POST /api/scenarios/{id}/stop` -> Pauses simulation
- `POST /api/scenarios/reset` -> Resets simulation state with optional seed
- `POST /api/environment/block-aisle` -> Blocks target edge (`C-17` default)
- `POST /api/environment/clear-aisle` -> Clears target edge
- `POST /api/robots/{robot_id}/fail` -> Injects hardware failure
- `POST /api/robots/{robot_id}/communication-loss` -> Toggles radio loss (`offline=True`)

### Benchmarks & Gemini AI Explanation
- `POST /api/benchmarks/run` -> Executes comparison trial between Baseline vs. NEXUS
- `POST /api/ai/explain` -> Body: `{"question": "Why did AMR-04 reroute?"}`

---

## 2. WebSocket Interface

- **URL:** `ws://localhost:8000/ws/fleet`
- **Stream Format:** `{"type": "FLEET_SNAPSHOT", "payload": SimulationSnapshotSchema}`
- **Update Frequency:** 10 Hz (100ms interval)
