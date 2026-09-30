# Demonstration & Test Scenarios

NEXUS-Fleet includes reproducible test scenarios:

1. **Normal Warehouse Operation:** Fleet executing pickup and delivery tasks under standard traffic conditions.
2. **Head-on Conflict:** Two AMRs approaching each other on a single-lane corridor. Verified priority yield & reservation request.
3. **Shared Intersection:** 3 AMRs arriving at node `N-2-3` simultaneously. Verified sequential reservation granting.
4. **Narrow Aisle Obstruction:** Disturbance on special aisle `C-17`. Affected agents detect invalid route and recalculate around the blockage.
5. **Deadlock Cycle:** 3-way circular wait dependency (`AMR-01 -> AMR-02 -> AMR-03 -> AMR-01`). Verified wait-for cycle detection and victim yielding.
6. **Communication Loss:** Radio link failure injected on `AMR-03`. Agent continues navigating safely using local world model and cached safety clearance envelope.
7. **Robot Hardware Failure:** Hardware fault injected on `AMR-02`. Immediate reservation release and task re-auction to active peers.
8. **Battery Critical:** AMR battery drops below safe reserve. Current task unassigned and agent navigates to `CHG-01` dock.
9. **Full Stress Test:** 6 AMRs, high task burst, dynamic obstacles, blocked aisle, and comm degradation.
