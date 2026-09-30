from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from .database import db_manager

logger = logging.getLogger("nexusfleet.ai")

class LocalRAGExplanationService:
    def __init__(self):
        logger.info("Local RAG Telemetry Explanation Engine initialized (Offline, 0 API Key required).")

    def explain_fleet_event(self, question: str, telemetry_context: Dict[str, Any]) -> str:
        # 1. Search knowledge base for relevant SOPs
        sop_results = db_manager.search_knowledge(question, limit=2)
        sop_context = ""
        if sop_results:
            top_sop = sop_results[0]
            sop_context = f"[Reference {top_sop['source_name']}]: {top_sop['content']}"

        q_lower = question.lower()
        robots: List[Dict[str, Any]] = telemetry_context.get("robots", [])
        metrics: Dict[str, Any] = telemetry_context.get("metrics", {})
        conflicts: List[Dict[str, Any]] = telemetry_context.get("conflicts", [])
        reservations: List[Dict[str, Any]] = telemetry_context.get("reservations", [])
        blocked_edges: List[str] = telemetry_context.get("blockedEdges", [])

        # Analyze active conflicts or yield situations
        conflict_desc = ""
        if conflicts:
            latest_c = conflicts[-1]
            conflict_desc = f" Active conflict detected at node '{latest_c.get('nodeId', 'N/A')}' between {latest_c.get('robotA', 'AMR')} and {latest_c.get('robotB', 'AMR')} with resolution strategy '{latest_c.get('resolution', 'yield')}'."

        # Analyze low battery robots
        low_battery_robots = [r for r in robots if r.get("battery", 100) < 30]
        battery_desc = ""
        if low_battery_robots:
            names = ", ".join([r.get("id", "AMR") for r in low_battery_robots])
            battery_desc = f" Robot(s) {names} currently have battery below 30% and are executing automatic docking/recharging protocols."

        # Analyze blocked aisles
        block_desc = ""
        if blocked_edges:
            block_desc = f" Aisle(s) {', '.join(blocked_edges)} are currently blocked. Affected AMRs are using dynamic A* rerouting to avoid these lanes."

        # Synthesize deterministic, natural language response based on empirical context
        if "battery" in q_lower or "charge" in q_lower:
            ans = f"Fleet battery status: {len(low_battery_robots)} AMR(s) currently low.{battery_desc} Under SOP-002, AMRs under 30% battery prioritize returning to charging docks N-0-0 or N-4-0."
        elif "block" in q_lower or "reroute" in q_lower or "path" in q_lower:
            ans = f"Path planning & routing status: {block_desc or 'All main warehouse aisles are clear.'} AMRs calculate multi-factor A* paths accounting for travel distance, edge congestion, and priority lease reservations."
        elif "deadlock" in q_lower or "conflict" in q_lower or "yield" in q_lower:
            ans = f"Coordination & Right-of-Way: {conflict_desc or 'No active deadlocks currently detected.'} Priority arbitration assigns right-of-way using lease score (priority + 0.2 * battery margin)."
        elif "task" in q_lower or "order" in q_lower or "bid" in q_lower:
            ans = f"Task allocation: Current completed throughput is {metrics.get('completedTasks', 0)} task(s). Idle AMRs bid for open tasks based on proximity distance, priority weighting, and current payload state."
        else:
            ans = f"Fleet Overview: Active fleet size is {len(robots)} AMRs with {metrics.get('activeTasks', 0)} task(s) in progress.{conflict_desc}{battery_desc}{block_desc}"

        if sop_context:
            ans += f" {sop_context}"

        return ans

ai_explanation_service = LocalRAGExplanationService()
