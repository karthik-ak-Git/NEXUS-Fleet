import { useCallback, useEffect, useRef, useState } from "react";
import { SimulationEngine } from "./engine";
import type { SimulationSnapshot } from "./types";

const BACKEND_WS_URL = "ws://localhost:8000/ws/fleet";
const BACKEND_API_URL = "http://localhost:8000/api";

export function useSimulation() {
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SimulationEngine();
  
  const [state, setState] = useState<SimulationSnapshot>(() =>
    engineRef.current!.getSnapshot(),
  );
  const isConnectedRef = useRef(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    function connectWS() {
      try {
        ws = new WebSocket(BACKEND_WS_URL);
        ws.onopen = () => {
          isConnectedRef.current = true;
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "FLEET_SNAPSHOT" && data.payload) {
              setState(data.payload as SimulationSnapshot);
            }
          } catch (e) {
            console.error("WS Parse error", e);
          }
        };
        ws.onerror = () => {
          isConnectedRef.current = false;
        };
        ws.onclose = () => {
          isConnectedRef.current = false;
          reconnectTimer = window.setTimeout(connectWS, 3000);
        };
      } catch (e) {
        isConnectedRef.current = false;
        reconnectTimer = window.setTimeout(connectWS, 3000);
      }
    }

    connectWS();

    // Local engine loop runs if WS is disconnected
    const interval = window.setInterval(() => {
      if (isConnectedRef.current) return;
      const engine = engineRef.current!;
      const current = engine.getSnapshot();
      if (!current.running) return;
      engine.step(0.2 * current.speed);
      setState(engine.getSnapshot());
    }, 100);

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(interval);
    };
  }, []);

  const refresh = useCallback(() => {
    setState(engineRef.current!.getSnapshot());
  }, []);

  const start = useCallback(() => {
    engineRef.current!.start();
    refresh();
    if (isConnectedRef.current) {
      fetch(`${BACKEND_API_URL}/scenarios/normal/start`, { method: "POST" }).catch(() => {});
    }
  }, [refresh]);

  const pause = useCallback(() => {
    engineRef.current!.pause();
    refresh();
    if (isConnectedRef.current) {
      fetch(`${BACKEND_API_URL}/scenarios/normal/stop`, { method: "POST" }).catch(() => {});
    }
  }, [refresh]);

  const reset = useCallback(() => {
    engineRef.current!.reset();
    refresh();
    if (isConnectedRef.current) {
      fetch(`${BACKEND_API_URL}/scenarios/reset`, { method: "POST" }).catch(() => {});
    }
  }, [refresh]);

  const setSpeed = useCallback((speed: number) => {
    engineRef.current!.setSpeed(speed);
    refresh();
  }, [refresh]);

  const setScenario = useCallback((name: string) => {
    engineRef.current!.setScenario(name);
    refresh();
    if (isConnectedRef.current) {
      fetch(`${BACKEND_API_URL}/scenarios/${name}/start`, { method: "POST" }).catch(() => {});
    }
  }, [refresh]);

  const inject = useCallback((kind: string) => {
    engineRef.current!.inject(kind);
    refresh();
    if (isConnectedRef.current) {
      if (kind === "block-aisle") {
        fetch(`${BACKEND_API_URL}/environment/block-aisle`, { method: "POST" }).catch(() => {});
      } else if (kind === "robot-failure") {
        fetch(`${BACKEND_API_URL}/robots/AMR-02/fail`, { method: "POST" }).catch(() => {});
      } else if (kind === "communication-loss") {
        fetch(`${BACKEND_API_URL}/robots/AMR-03/communication-loss`, { method: "POST" }).catch(() => {});
      }
    }
  }, [refresh]);

  const createTask = useCallback((pickup?: string, sku?: string, assignedRobotId?: string) => {
    engineRef.current!.createTask(pickup, sku);
    refresh();
    if (isConnectedRef.current) {
      fetch(`${BACKEND_API_URL}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup, priority: 0.85 })
      }).catch(() => {});
    }
  }, [refresh]);

  const runBenchmark = useCallback(() => {
    engineRef.current!.runBenchmark();
    refresh();
    if (isConnectedRef.current) {
      fetch(`${BACKEND_API_URL}/benchmarks/run`, { method: "POST" }).catch(() => {});
    }
  }, [refresh]);

  const runStressTest = useCallback(() => {
    engineRef.current!.runStressTest();
    refresh();
  }, [refresh]);

  const runDemo = useCallback(() => {
    engineRef.current!.runDemo();
    refresh();
  }, [refresh]);

  const selectRobot = useCallback((id: string | null) => {
    engineRef.current!.selectRobot(id);
    setState((prev) => ({ ...prev, selectedRobotId: id }));
  }, []);

  return {
    state,
    start,
    pause,
    reset,
    setSpeed,
    setScenario,
    inject,
    createTask,
    runBenchmark,
    runStressTest,
    runDemo,
    selectRobot,
  };
}