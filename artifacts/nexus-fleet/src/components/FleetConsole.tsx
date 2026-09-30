import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, Battery, Bot,
  Boxes, ChevronDown, CircleHelp, Clock3, Layers, MapPinned, Menu,
  Pause, Play, Plus, Radio, RotateCcw, Route, ShieldCheck, Signal,
  Sparkles, Target, Zap
} from 'lucide-react';
import { useSimulation } from '../simulation/useSimulation';
import { WarehouseScene3D } from './WarehouseScene3D';

type Datum = Record<string, any>;
type Point = { x: number; y: number };

const groceryProducts = [
  { id: 'apples', name: 'Organic Honeycrisp Apples', rack: 'Rack A-11', pickup: 'N-1-1', sku: 'SKU-A11-ORGANIC_APPLES', category: 'Fresh Produce', icon: '🍎' },
  { id: 'milk', name: 'Fresh Whole Milk 1L', rack: 'Rack B-12', pickup: 'N-1-2', sku: 'SKU-B12-FRESH_MILK', category: 'Dairy', icon: '🥛' },
  { id: 'bread', name: 'Artisan Whole Wheat Bread', rack: 'Rack C-13', pickup: 'N-2-1', sku: 'SKU-C13-WHOLE_WHEAT_BREAD', category: 'Bakery', icon: '🍞' },
  { id: 'oil', name: 'Extra Virgin Olive Oil 500ml', rack: 'Rack D-14', pickup: 'N-2-2', sku: 'SKU-D14-OLIVE_OIL', category: 'Pantry', icon: '🫒' },
  { id: 'coffee', name: 'Dark Roasted Coffee Beans', rack: 'Rack E-15', pickup: 'N-3-1', sku: 'SKU-E15-ROASTED_COFFEE', category: 'Beverages', icon: '☕' },
  { id: 'chocolate', name: '70% Dark Chocolate Bar', rack: 'Rack B-14', pickup: 'N-3-2', sku: 'SKU-B14-CHOCOLATE_BAR', category: 'Snacks', icon: '🍫' },
];

function str(value: unknown, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function pointOf(value: any): Point | null {
  if (Array.isArray(value) && value.length > 1) {
    const x = Number(value[0]); const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  if (value && typeof value === 'object') {
    const x = Number(value.x ?? value.col ?? value[0]);
    const y = Number(value.y ?? value.row ?? value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }
  return null;
}

function shortTime(value: unknown) {
  if (typeof value === 'string' && value.includes(':')) return value;
  const seconds = Math.max(0, Number(value) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function statusTone(value: unknown) {
  const status = String(value ?? '').toLowerCase();
  if (/error|fail|dead|blocked|critical|collision|lost|offline/.test(status)) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (/wait|yield|charge|low|warn|conflict|paused|recover|rerout/.test(status)) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (/complete|idle|ready|online|healthy|resolved/.test(status)) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
}

function MetricTile({ label, value, unit, icon: Icon, note }: {
  label: string; value: unknown; unit?: string; icon: typeof Activity; note?: string;
}) {
  return (
    <div className="bg-[#17221f] border border-[#283834] rounded-xl p-4 shadow-lg space-y-1">
      <div className="flex items-center justify-between text-xs text-[#8aa39b] font-medium">
        <span>{label}</span>
        <Icon size={16} className="text-[#3db89a]" />
      </div>
      <div className="text-2xl font-extrabold text-white tracking-tight flex items-baseline gap-1">
        <span>{str(value, '0')}</span>
        {unit && <small className="text-xs font-normal text-[#8aa39b]">{unit}</small>}
      </div>
      {note && <div className="text-[11px] text-[#8aa39b] font-mono">{note}</div>}
    </div>
  );
}

function PlanView2D({ robots, nodes, selectedId, onSelect }: {
  robots: Datum[]; nodes: Datum[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  return (
    <div className="w-full h-[460px] bg-[#111816] rounded-xl border border-[#283834] p-4 relative overflow-hidden flex items-center justify-center">
      <svg className="w-full h-full" viewBox="-15 -10 30 20">
        <rect x="-14.5" y="-9.5" width="29" height="19" fill="#17221f" stroke="#283834" strokeWidth="0.2" rx="0.5" />
        {/* Warehouse Nodes */}
        {nodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
            <circle r="0.3" fill={node.kind === 'packing' ? '#3db89a' : node.kind === 'charger' ? '#38bdf8' : '#283834'} />
            <text y="-0.5" fontSize="0.4" fill="#8aa39b" textAnchor="middle" className="font-mono">{node.label}</text>
          </g>
        ))}
        {/* Robots */}
        {robots.map((robot) => {
          const isSelected = str(robot.id) === selectedId;
          return (
            <g
              key={str(robot.id)}
              transform={`translate(${robot.x ?? 0} ${robot.y ?? 0})`}
              onClick={() => onSelect(str(robot.id))}
              className="cursor-pointer"
            >
              <circle r={isSelected ? '0.9' : '0.7'} fill={isSelected ? '#f59e0b' : '#2e8b75'} opacity="0.4" />
              <circle r="0.5" fill={isSelected ? '#f59e0b' : '#3db89a'} stroke="#ffffff" strokeWidth="0.1" />
              <text y="0.15" fontSize="0.3" fill="#ffffff" fontWeight="bold" textAnchor="middle" className="font-mono">
                {str(robot.id).replace('AMR-', '')}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function FleetConsole() {
  const [, setLocation] = useLocation();
  const { state, start, pause, reset, setSpeed, createTask, selectRobot } = useSimulation();

  const [mapMode, setMapMode] = useState<'3d' | 'plan'>('3d');
  const [followRobot, setFollowRobot] = useState(false);
  const [topView, setTopView] = useState(false);
  const [cameraReset, setCameraReset] = useState(0);
  const [debugMode, setDebugMode] = useState(false);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(['apples', 'milk', 'bread']);

  const selectedProducts = useMemo(() => {
    return groceryProducts.filter((p) => selectedProductIds.includes(p.id));
  }, [selectedProductIds]);

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectAllProducts = () => {
    setSelectedProductIds(groceryProducts.map((p) => p.id));
  };

  const clearProductSelection = () => {
    setSelectedProductIds([]);
  };

  const handleDispatchBatchTasks = () => {
    if (!selectedProducts.length) return;
    selectedProducts.forEach((prod) => {
      createTask(prod.pickup, prod.sku);
    });
    setIsTaskModalOpen(false);
  };

  const data = state as unknown as Datum;
  const nodeLabels = useMemo(() => new Map(
    (Array.isArray(data?.nodes) ? data.nodes : []).map((node: Datum) => [node.id, node.label]),
  ), [data?.nodes]);
  const nodeMapForDist = useMemo(() => new Map(
    (Array.isArray(data?.nodes) ? data.nodes : []).map((node: Datum) => [node.id, { x: Number(node.x), y: Number(node.y) }])
  ), [data?.nodes]);

  const rawRobots: Datum[] = Array.isArray(data?.robots) ? data.robots : [];
  const robots: Datum[] = rawRobots.map((robot) => ({
    ...robot,
    state: robot.status,
    taskId: robot.currentTaskId,
    destination: nodeLabels.get(robot.destination) ?? robot.destination,
  }));

  const firstSelectedProduct = selectedProducts[0] ?? groceryProducts[0];
  const targetNodeCoord = nodeMapForDist.get(firstSelectedProduct.pickup) ?? { x: 0, y: 0 };

  const tasks: Datum[] = (Array.isArray(data?.tasks) ? data.tasks : []).map((task: Datum) => ({
    ...task,
    pickup: nodeLabels.get(task.pickup) ?? task.pickup,
    destination: nodeLabels.get(task.destination) ?? task.destination,
  }));
  const activeTasks = tasks.filter((task) => task.status !== 'COMPLETED');
  const events: Datum[] = Array.isArray(data?.events) ? data.events : [];
  const conflicts: Datum[] = Array.isArray(data?.conflicts) ? data.conflicts : [];
  const metrics: Datum = data?.metrics ?? {};
  const selectedRobot = robots.find((robot) => str(robot.id) === data?.selectedRobotId) ?? null;
  const activeCount = metrics.activeRobots ?? robots.filter((robot) => /active|moving|working|navigat|pick/i.test(String(robot.state))).length;
  const isRunning = Boolean(data?.running);

  return (
    <div className="min-h-screen bg-[#111816] text-[#e3e8e5] font-sans flex flex-col">
      {/* Top Navbar matching Landing Page */}
      <nav className="border-b border-[#283834] bg-[#17221f]/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-[#2e8b75] flex items-center justify-center font-bold text-white text-xl shadow-lg">
            N
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none tracking-wide text-white">NEXUS-Fleet</h1>
            <span className="text-xs text-[#8aa39b] font-mono">SIH26123 · Distributed AMR Platform</span>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm font-medium">
          <button onClick={() => setLocation('/')} className="text-[#9cb5ac] hover:text-white transition-colors">
            Overview
          </button>
          <button onClick={() => setLocation('/docs')} className="text-[#9cb5ac] hover:text-white transition-colors">
            Documentation
          </button>
          <button onClick={() => setLocation('/console')} className="text-[#3db89a] border-b-2 border-[#3db89a] pb-1 font-semibold">
            3D Fleet Console
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#1f302b] border border-[#2e8b75]/40 text-[#42d4b0] px-3 py-1 rounded-full text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isRunning ? 'SIMULATION LIVE' : 'SIMULATION PAUSED'}</span>
          </div>
          <div className="text-xs font-mono text-[#8aa39b] bg-[#17221f] px-3 py-1 rounded-lg border border-[#283834]">
            SIM TIME: <strong className="text-white">{shortTime(data?.time)}</strong>
          </div>
        </div>
      </nav>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Top Control Bar - Clean & Essential Controls Only */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => isRunning ? pause() : start()}
              className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center space-x-2 transition-all shadow-md ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-[#2e8b75] hover:bg-[#38a38a] text-white shadow-emerald-950/50'
              }`}
            >
              {isRunning ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              <span>{isRunning ? 'Pause Simulation' : 'Resume Simulation'}</span>
            </button>

            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2.5 rounded-lg bg-[#1a2724] hover:bg-[#233531] border border-[#283834] text-sm font-semibold text-[#e3e8e5] flex items-center space-x-2 transition-all"
            >
              <RotateCcw size={15} />
              <span>Reset Fleet</span>
            </button>

            <div className="h-6 w-px bg-[#283834] mx-1" />

            {/* Speed Multiplier */}
            <div className="flex items-center bg-[#111816] rounded-lg p-1 border border-[#283834] text-xs font-mono">
              <span className="px-2 text-[#8aa39b] font-sans font-medium">Speed:</span>
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setSpeed(speed)}
                  className={`px-2.5 py-1 rounded font-bold transition-all ${
                    Number(data?.speed ?? 1) === speed
                      ? 'bg-[#2e8b75] text-white shadow'
                      : 'text-[#8aa39b] hover:text-white'
                  }`}
                >
                  {speed}×
                </button>
              ))}
            </div>
          </div>

          {/* Prominent Task Dispatch Button */}
          <button
            type="button"
            onClick={() => setIsTaskModalOpen(true)}
            className="px-5 py-2.5 rounded-lg bg-[#3db89a] hover:bg-[#48d2b0] text-slate-950 font-extrabold text-sm flex items-center space-x-2 transition-all shadow-lg hover:shadow-emerald-900/50"
          >
            <Plus size={18} strokeWidth={3} />
            <span>Dispatch Grocery Task</span>
          </button>
        </section>

        {/* Top 4 High-Level Metric Tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricTile
            label="Active AMRs"
            value={activeCount}
            unit={`/ ${robots.length}`}
            icon={Bot}
            note={`${((activeCount / (robots.length || 1)) * 100).toFixed(0)}% fleet operational`}
          />
          <MetricTile
            label="Completed Orders"
            value={metrics.completedTasks ?? 0}
            unit="items"
            icon={Target}
            note={`${activeTasks.length} active in queue`}
          />
          <MetricTile
            label="P2P Negotiations"
            value={metrics.conflicts ?? conflicts.length}
            unit="resolved"
            icon={Route}
            note={`${metrics.deadlocks ?? 0} deadlock recoveries`}
          />
          <MetricTile
            label="Avg. Battery & Link"
            value={Number(metrics.avgBattery ?? 85).toFixed(0)}
            unit="%"
            icon={Battery}
            note="WebSocket 10 Hz live sync"
          />
        </section>

        {/* Main 2-Column Grid: 3D Digital Twin Canvas + Interactive Fleet Roster */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Spans): 3D Digital Twin Canvas */}
          <div className="lg:col-span-2 bg-[#17221f] border border-[#283834] rounded-xl p-4 flex flex-col shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#283834] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#3db89a] uppercase tracking-wider">3D Digital Twin · Floor Zone 05</span>
                <h2 className="text-lg font-bold text-white leading-tight">Warehouse Floor Observability</h2>
              </div>

              {/* View Control Toolbar */}
              <div className="flex items-center space-x-2 text-xs font-medium">
                <div className="bg-[#111816] rounded-lg p-1 border border-[#283834]">
                  <button
                    onClick={() => setMapMode('3d')}
                    className={`px-3 py-1 rounded font-semibold transition-all ${mapMode === '3d' ? 'bg-[#2e8b75] text-white' : 'text-[#8aa39b]'}`}
                  >
                    3D
                  </button>
                  <button
                    onClick={() => setMapMode('plan')}
                    className={`px-3 py-1 rounded font-semibold transition-all ${mapMode === 'plan' ? 'bg-[#2e8b75] text-white' : 'text-[#8aa39b]'}`}
                  >
                    PLAN
                  </button>
                </div>

                {mapMode === '3d' && (
                  <>
                    <button
                      onClick={() => { setTopView(!topView); setFollowRobot(false); }}
                      className={`px-3 py-1.5 rounded-lg border font-mono transition-all ${topView ? 'bg-[#2e8b75] border-[#3db89a] text-white' : 'bg-[#111816] border-[#283834] text-[#8aa39b] hover:text-white'}`}
                    >
                      {topView ? 'ORBIT' : 'TOP'}
                    </button>
                    <button
                      onClick={() => { setFollowRobot(!followRobot); setTopView(false); }}
                      className={`px-3 py-1.5 rounded-lg border font-mono transition-all ${followRobot ? 'bg-[#2e8b75] border-[#3db89a] text-white' : 'bg-[#111816] border-[#283834] text-[#8aa39b] hover:text-white'}`}
                    >
                      FOLLOW
                    </button>
                    <button
                      onClick={() => setDebugMode(!debugMode)}
                      className={`px-3 py-1.5 rounded-lg border font-mono transition-all ${debugMode ? 'bg-amber-600 border-amber-400 text-white font-bold' : 'bg-[#111816] border-[#283834] text-[#8aa39b] hover:text-white'}`}
                      title="Toggle Developer Digital-Twin Telemetry & Debug Layer"
                    >
                      DEBUG
                    </button>
                    <button
                      onClick={() => { setFollowRobot(false); setTopView(false); setCameraReset((v) => v + 1); }}
                      className="p-1.5 rounded-lg bg-[#111816] border border-[#283834] text-[#8aa39b] hover:text-white transition-colors"
                      title="Reset Camera"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 3D Canvas / 2D Plan View Render */}
            {mapMode === '3d' ? (
              <div className="w-full h-[460px] rounded-xl overflow-hidden border border-[#283834] relative bg-[#111816]">
                <WarehouseScene3D
                  robots={rawRobots}
                  nodes={data?.nodes ?? []}
                  edges={data?.edges ?? []}
                  obstacles={data?.obstacles ?? []}
                  reservations={data?.reservations ?? []}
                  selectedId={data?.selectedRobotId ?? null}
                  onSelect={(id) => selectRobot(id)}
                  follow={followRobot}
                  topView={topView}
                  resetToken={cameraReset}
                  debugMode={debugMode}
                />
              </div>
            ) : (
              <PlanView2D
                robots={robots}
                nodes={data?.nodes ?? []}
                selectedId={data?.selectedRobotId ?? null}
                onSelect={(id) => selectRobot(id)}
              />
            )}

            <div className="flex items-center justify-between text-xs text-[#8aa39b] font-mono pt-1">
              <span className="flex items-center gap-1.5"><Radio size={13} className="text-[#3db89a]" /> P2P RADIO MESH ONLINE</span>
              <span>GRID SPACING: 1.0 METER</span>
            </div>
          </div>

          {/* Right Column (1 Span): Interactive 6-AMR Fleet Roster Cards */}
          <div className="bg-[#17221f] border border-[#283834] rounded-xl p-4 flex flex-col shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#283834] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#3db89a] uppercase tracking-wider">Independent Agents</span>
                <h2 className="text-lg font-bold text-white leading-tight">Fleet Roster ({robots.length} Units)</h2>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {robots.map((robot) => {
                const isSelected = str(robot.id) === data?.selectedRobotId;
                const battery = Number(robot.battery ?? 80);
                const statusStr = str(robot.state, 'IDLE').toUpperCase();

                return (
                  <button
                    key={str(robot.id)}
                    type="button"
                    onClick={() => selectRobot(str(robot.id))}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex flex-col space-y-2 ${
                      isSelected
                        ? 'border-[#3db89a] bg-[#1f332c] shadow-md ring-1 ring-[#3db89a]'
                        : 'border-[#283834] bg-[#111816]/70 hover:border-[#385249]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded bg-[#2e8b75] flex items-center justify-center font-bold text-white text-xs">
                          {str(robot.id).replace('AMR-', '')}
                        </div>
                        <span className="font-bold text-sm text-white font-mono">{str(robot.id)}</span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusTone(statusStr)}`}>
                        {statusStr}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#8aa39b] font-mono">
                      <span>Task: <strong className="text-white">{str(robot.taskId, 'NONE')}</strong></span>
                      <span>Pos: <strong className="text-[#3db89a]">{str(robot.currentNode)}</strong></span>
                    </div>

                    {/* Battery Indicator Bar */}
                    <div className="w-full bg-[#111816] h-1.5 rounded-full overflow-hidden border border-[#283834]">
                      <div
                        className={`h-full transition-all ${battery < 25 ? 'bg-rose-500' : 'bg-[#3db89a]'}`}
                        style={{ width: `${Math.min(100, Math.max(0, battery))}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Robot Quick Inspector */}
            {selectedRobot && (
              <div className="bg-[#1f2c28] border border-[#2e4d43] rounded-lg p-3 text-xs space-y-1.5 pt-2">
                <div className="flex items-center justify-between font-bold text-white font-mono border-b border-[#2e4d43] pb-1">
                  <span className="flex items-center gap-1.5"><Bot size={14} className="text-[#3db89a]" /> Selected: {str(selectedRobot.id)}</span>
                  <span className="text-[#3db89a]">{str(selectedRobot.state)}</span>
                </div>
                <div className="text-[#8aa39b] font-mono leading-tight">
                  <div>Intent: <strong className="text-white">{str(selectedRobot.intent, 'AVAILABLE')}</strong></div>
                  <div>Dest: <strong className="text-white">{str(selectedRobot.destination, '—')}</strong></div>
                  <div>Status Note: <span className="text-[#9cb5ac]">{str(selectedRobot.reason, 'Nominal navigation')}</span></div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Bottom Section: Active Task Queue Table + Live System Journal */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Task Queue */}
          <div className="bg-[#17221f] border border-[#283834] rounded-xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#283834] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#3db89a] uppercase tracking-wider">Order Flow</span>
                <h2 className="text-lg font-bold text-white leading-tight">Active Task Queue</h2>
              </div>
              <span className="text-xs font-mono font-bold bg-[#1f302b] border border-[#2e8b75]/40 text-[#42d4b0] px-2.5 py-1 rounded-full">
                {activeTasks.length} Active
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#283834] text-[#8aa39b] font-mono uppercase">
                    <th className="py-2 px-2">Order / SKU</th>
                    <th className="py-2 px-2">Route</th>
                    <th className="py-2 px-2">AMR</th>
                    <th className="py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#283834]">
                  {activeTasks.length ? (
                    activeTasks.slice(0, 6).map((task) => (
                      <tr key={str(task.id)} className="hover:bg-[#1f2c28] transition-colors">
                        <td className="py-2.5 px-2 font-mono">
                          <div className="font-bold text-white">{str(task.id)}</div>
                          <div className="text-[10px] text-[#8aa39b]">{str(task.sku)}</div>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[#3db89a]">
                          {str(task.pickup)} → {str(task.destination)}
                        </td>
                        <td className="py-2.5 px-2 font-mono font-bold text-amber-400">
                          {str(task.assignedRobotId, 'UNASSIGNED')}
                        </td>
                        <td className="py-2.5 px-2">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusTone(task.status)}`}>
                            {str(task.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#8aa39b] font-mono">
                        No active tasks. Click &quot;Dispatch Grocery Task&quot; above to assign work to the fleet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live System Journal Stream */}
          <div className="bg-[#17221f] border border-[#283834] rounded-xl p-4 space-y-3 shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[#283834] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#3db89a] uppercase tracking-wider">System Journal</span>
                <h2 className="text-lg font-bold text-white leading-tight">Live Event Stream</h2>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                STREAM
              </span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {events.length ? (
                events.slice(0, 10).map((event, idx) => {
                  const typeStr = str(event.type, 'EVENT').replace(/_/g, ' ');
                  const isBad = /failure|blocked|deadlock|conflict/i.test(typeStr);
                  const isGood = /complete|resolve|recover|assign|picked/i.test(typeStr);

                  return (
                    <div key={str(event.id, String(idx))} className="p-2.5 rounded-lg bg-[#111816]/80 border border-[#283834] text-xs space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className={`font-bold ${isBad ? 'text-rose-400' : isGood ? 'text-emerald-400' : 'text-cyan-400'}`}>
                          {typeStr.toUpperCase()}
                        </span>
                        <span className="text-[#8aa39b]">{str(event.robotId, 'FLEET')} · {shortTime(event.time)}</span>
                      </div>
                      <p className="text-[#9cb5ac] leading-tight">{str(event.reason, str(event.result))}</p>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[#8aa39b] font-mono">
                  Waiting for simulation events...
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Multi-Product Grocery Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17221f] border border-[#283834] rounded-xl max-w-xl w-full p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#283834] pb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Boxes className="text-[#3db89a]" size={22} />
                  <span>Select Grocery Product Orders (Batch)</span>
                </h2>
                <p className="text-xs text-[#8aa39b] mt-1">Select one or multiple items to pick; nearest idle AMRs will pick them concurrently</p>
              </div>
              <button type="button" onClick={() => setIsTaskModalOpen(false)} className="text-[#8aa39b] hover:text-white text-xl font-bold p-1">✕</button>
            </div>

            <div className="flex items-center justify-between text-xs text-[#8aa39b] font-mono px-1">
              <span>Selected: <strong className="text-emerald-400 font-bold">{selectedProductIds.length} Products</strong></span>
              <div className="space-x-3">
                <button type="button" onClick={selectAllProducts} className="text-[#3db89a] hover:underline font-medium">Select All</button>
                <button type="button" onClick={clearProductSelection} className="text-[#8aa39b] hover:text-white hover:underline">Clear</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
              {groceryProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProductSelection(product.id)}
                    className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-[#3db89a] bg-[#1f332c] shadow-lg ring-1 ring-[#3db89a]'
                        : 'border-[#283834] bg-[#111816]/60 hover:border-[#385249]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by container button click
                      className="mt-1 accent-[#3db89a] w-4 h-4 rounded cursor-pointer pointer-events-none"
                    />
                    <span className="text-2xl">{product.icon}</span>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-sm text-white truncate">{product.name}</div>
                      <div className="text-xs text-[#3db89a] font-mono mt-0.5">{product.rack} ({product.pickup})</div>
                      <div className="text-[10px] text-[#8aa39b]">{product.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Nearest Robot Auto Assignment Summary */}
            <div className="bg-[#192723] border border-[#2e4d43] rounded-lg p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#8aa39b]">Batch Order Count:</span>
                <span className="text-emerald-400 font-bold">{selectedProducts.length} Tasks to Dispatch</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#8aa39b]">Target Shelf Racks:</span>
                <span className="text-white truncate max-w-[280px]">
                  {selectedProducts.map((p) => p.rack).join(', ') || 'None selected'}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono pt-2 border-t border-[#2e4d43]">
                <span className="text-[#8aa39b]">Fleet Auto Assignment:</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Bot size={15} />
                  Nearest Idle AMRs (AMR-01 .. AMR-10)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#283834]">
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#283834] text-sm text-[#8aa39b] hover:text-white hover:bg-[#1f2c28] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedProducts.length}
                onClick={handleDispatchBatchTasks}
                className="px-5 py-2 rounded-lg bg-[#2e8b75] hover:bg-[#38a38a] disabled:opacity-40 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Plus size={16} />
                <span>Dispatch {selectedProducts.length} Batch Task{selectedProducts.length === 1 ? '' : 's'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}