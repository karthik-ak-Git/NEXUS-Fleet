import { useCallback, useEffect, useRef, useState } from "react";
import { SimulationEngine } from "./engine";
import type { SimulationSnapshot } from "./types";

export function useSimulation() {
  const engineRef = useRef<SimulationEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SimulationEngine();
  const [state, setState] = useState<SimulationSnapshot>(() =>
    engineRef.current!.getSnapshot(),
  );

  const refresh = useCallback(() => {
    setState(engineRef.current!.getSnapshot());
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const engine = engineRef.current!;
      const current = engine.getSnapshot();
      if (!current.running) return;
      engine.step(0.2 * current.speed);
      setState(engine.getSnapshot());
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  const start = useCallback(() => {
    engineRef.current!.start();
    refresh();
  }, [refresh]);

  const pause = useCallback(() => {
    engineRef.current!.pause();
    refresh();
  }, [refresh]);

  const reset = useCallback(() => {
    engineRef.current!.reset();
    refresh();
  }, [refresh]);

  const setSpeed = useCallback(
    (speed: number) => {
      engineRef.current!.setSpeed(speed);
      refresh();
    },
    [refresh],
  );

  const setScenario = useCallback(
    (name: string) => {
      engineRef.current!.setScenario(name);
      refresh();
    },
    [refresh],
  );

  const inject = useCallback(
    (kind: string) => {
      engineRef.current!.inject(kind);
      refresh();
    },
    [refresh],
  );

  const createTask = useCallback(() => {
    engineRef.current!.createTask();
    refresh();
  }, [refresh]);

  const runBenchmark = useCallback(() => {
    engineRef.current!.runBenchmark();
    refresh();
  }, [refresh]);

  const runStressTest = useCallback(() => {
    engineRef.current!.runStressTest();
    refresh();
  }, [refresh]);

  const runDemo = useCallback(() => {
    engineRef.current!.runDemo();
    refresh();
  }, [refresh]);

  const selectRobot = useCallback(
    (id: string | null) => {
      engineRef.current!.selectRobot(id);
      refresh();
    },
    [refresh],
  );

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