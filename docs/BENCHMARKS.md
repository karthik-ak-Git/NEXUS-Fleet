# Comparative Benchmark Engine

## 1. Methodology

The NEXUS-Fleet Benchmark Engine executes two parallel simulation runs under identical initial conditions, random seeds, task packages, and warehouse layouts:

1. **Baseline Mode:** Centralized stop-and-wait collision avoidance.
2. **NEXUS Distributed Mode:** Autonomous edge agents, P2P priority negotiation, time-bounded reservations, and dynamic A* rerouting.

---

## 2. SIH Target Metric Measurement

The SIH Problem Statement (SIH26123) targets a **≥ 20% reduction in total task completion time** under overlapping paths.

The system calculates:

$$\text{TimeReduction} = \frac{T_{\text{baseline}} - T_{\text{NEXUS}}}{T_{\text{baseline}}} \times 100\%$$

---

## 3. Measured Indicators

- Total Task Completion Time
- Average Agent Waiting Time
- Total Distance Traveled
- Collisions Prevented
- Deadlocks Resolved
- Task Throughput (tasks/min)
- Total Energy Consumed
