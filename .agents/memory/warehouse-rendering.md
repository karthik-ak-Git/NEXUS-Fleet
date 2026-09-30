---
name: Warehouse rendering fallback
description: Rendering constraints and fallback behavior for the NEXUS-Fleet warehouse scene.
---

Keep dynamic warehouse labels inside the Three.js/R3F scene instead of mounting DOM portal labels. The portal-based labels triggered a delayed `removeChild` runtime error during scene updates.

**Why:** Some preview browsers cannot create a WebGL context, and portal cleanup caused React unmount errors in the same scene. A local rendering boundary keeps the rest of the fleet console usable when either issue occurs.

**How to apply:** Use Three.js sprites or geometry for scene labels. Keep a live SVG floor-plan fallback around the Canvas so renderer initialization failures do not take down the console.