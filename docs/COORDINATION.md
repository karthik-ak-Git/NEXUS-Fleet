# Decentralized Coordination, Negotiation & Deadlock Resolution

## 1. Priority Scoring Function

Right-of-way right is determined dynamically by each agent using the formula:

$$\text{Priority} = P_{\text{task}} + \min(0.2, T_{\text{wait}} \times 0.01) + \max(0, 45 - B_{\text{percent}}) \times 0.002 + \text{TimePenalty}$$

Where:
- $P_{\text{task}}$: Base order urgency priority (0.55 - 0.92).
- $T_{\text{wait}}$: Fairness / starvation prevention bonus for accumulated wait time.
- $B_{\text{percent}}$: Low battery urgency boost.

---

## 2. Right-of-Way Negotiation

When two AMRs predict a spatial/temporal conflict at an intersection or narrow aisle (`C-17`):
1. **Higher Priority Agent:** Receives time-bounded reservation lease and proceeds (`PROCEED`).
2. **Lower Priority Agent:** Yields right-of-way, stops outside intersection, and transitions to `YIELDING` or replans around the conflict.

---

## 3. Time-Bounded Reservation Leases

- Reservations lock shared resources (nodes or narrow edges) for a specific duration ($T_{\text{start}}$ to $T_{\text{end}}$).
- **Preemption:** If an agent with significantly higher task priority requires a node, lower priority reservations are preempted with `RESERVATION_MODIFIED` events.

---

## 4. Deadlock Detection & Recovery

- **Wait-For Graph Cycle Detection:** The engine builds a directed graph of dependencies (`AMR_A -> waitingFor -> AMR_B`).
- **DFS Cycle Search:** Identifies closed dependency loops (e.g. `AMR-01 -> AMR-02 -> AMR-03 -> AMR-01`).
- **Victim Selection:** Selects the agent in the cycle with lowest task priority.
- **Cycle Breaking:** Triggers `victim.recover_deadlock()` which releases leases and calculates an alternative A* route avoiding the deadlock node.
