# Gemini AI Integration & Security

## 1. Role of Gemini AI

Google Gemini is integrated strictly as an **Explanation & Intelligence Layer**.

It does **NOT** make real-time robot control decisions (path planning, collision avoidance, priority yielding). Those decisions remain 100% deterministic and local to the `RobotAgent`.

---

## 2. Gemini Capabilities

- **Decision Explanations:** Explains why an AMR yielded, rerouted, or entered a charging dock.
- **Incident Analysis:** Summarizes root causes of deadlocks or blocked aisles.
- **Operator Q&A:** Answers natural language queries regarding fleet status.

---

## 3. Security Requirements

- **API Key Security:** `GEMINI_API_KEY` is configured strictly as a server-side environment variable in `.env`.
- **Zero Frontend Exposure:** The key is NEVER sent to the browser, stored in `localStorage`, or broadcast in WebSocket payloads.
- **Graceful Fallback:** If `GEMINI_API_KEY` is missing or the Gemini API is unreachable, the fleet simulation continues operating without interruption.
