# Peer-to-Peer Message Protocol

## 1. Message Structure

```json
{
  "sender": "AMR-01",
  "target": "*",
  "timestamp": 14.2,
  "type": "STATE_UPDATE",
  "payload": {
    "node": "N-2-1",
    "nextNode": "N-2-2",
    "nextEta": 2.4,
    "taskPriority": 0.92,
    "status": "MOVING",
    "intent": "PICK",
    "battery": 87.0
  },
  "ttl": 4.0,
  "sequence": 42
}
```

---

## 2. Message Types

| Message Type | Purpose | Broadcast Target |
|--------------|---------|------------------|
| `HEARTBEAT` | Regular ping (every 0.75s) asserting robot liveness | `*` (All Peers) |
| `STATE_UPDATE` | Kinematic telemetry & route intent (every 0.4s) | `*` (All Peers) |
| `CONFLICT_ALERT` | Notifies peer of predicted intersection overlap | Specific Peer |
| `RESERVATION_REQUEST` | Requests priority lease on shared node/edge | Specific Peer |
| `RESERVATION_GRANTED` | Confirms lease grant to winner | Specific Peer |
| `YIELD_REQUEST` | Signals intention to yield right-of-way | Specific Peer |
| `EDGE_BLOCKED` | Broadcasts physical aisle obstruction | `*` (All Peers) |
| `EDGE_CLEAR` | Broadcasts obstruction removal | `*` (All Peers) |
| `STATE_SYNC` | Reconciles state after radio connection restoration | `*` (All Peers) |

---

## 3. Radio Network Characteristics

- **Simulated Latency:** Dynamic 35ms - 100ms jitter based on sequence hash.
- **Degraded/Offline Mode:** When radio connection drops (`COMMUNICATION_LOST`), agents continue navigating safely using cached peer maps and local safety clearance envelopes.
- **Re-connection Handshake:** Upon reconnection (`COMMUNICATION_RESTORED`), agents issue `STATE_SYNC` packets to update world models.
