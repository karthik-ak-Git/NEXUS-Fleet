import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, Battery, Bot,
  Boxes, ChevronDown, CircleHelp, Clock3, Layers, MapPinned, Menu,
  Pause, Play, Plus, Radio, RotateCcw, Route, ShieldCheck, Signal,
  Sparkles, Target, Zap, Cpu, CheckCircle2, AlertTriangle, Eye, ArrowLeft, ExternalLink
} from 'lucide-react';
import { useSimulation } from '../simulation/useSimulation';
import { WarehouseScene3D } from './WarehouseScene3D';
import { PlanView2D } from './PlanView2D';
import { GLOBAL_WAREHOUSE_LAYOUT } from '../simulation/warehouseLayout';

type Datum = Record<string, any>;

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

function shortTime(value: unknown) {
  if (typeof value === 'string' && value.includes(':')) return value;
  const seconds = Math.max(0, Number(value) || 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function statusTone(value: unknown) {
  const status = String(value ?? '').toLowerCase();
  if (/error|fail|dead|blocked|critical|collision|lost|offline/.test(status)) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  if (/wait|yield|low|warn|conflict|paused|recover|rerout/.test(status)) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  if (/charge|home/.test(status)) return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
  if (/complete|idle|ready|online|healthy|resolved/.test(status)) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return 'bg-[#2e8b75]/20 text-[#42d4b0] border-[#2e8b75]/40';
}

export function FleetConsole() {
  const [, setLocation] = useLocation();
  const { state, start, pause, reset, setSpeed, createTask, dispatchOrderBatch, selectRobot } = useSimulation();

  const [mapMode, setMapMode] = useState<'3d' | 'plan'>('3d');
  const [followRobot, setFollowRobot] = useState(false);
  const [topView, setTopView] = useState(false);
  const [cameraReset, setCameraReset] = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [hoveredObject, setHoveredObject] = useState<Datum | null>(null);

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
    dispatchOrderBatch(selectedProducts);
    setIsTaskModalOpen(false);
  };

  const data = state as unknown as Datum;
  const nodeLabels = useMemo(() => new Map(
    (Array.isArray(data?.nodes) ? data.nodes : []).map((node: Datum) => [node.id, node.label]),
  ), [data?.nodes]);

  const rawRobots: Datum[] = Array.isArray(data?.robots) ? data.robots : [];
  const robots: Datum[] = rawRobots.map((robot) => ({
    ...robot,
    state: robot.status,
    taskId: robot.currentTaskId,
    destination: nodeLabels.get(robot.destination) ?? robot.destination,
  }));

  const tasks: Datum[] = (Array.isArray(data?.tasks) ? data.tasks : []).map((task: Datum) => ({
    ...task,
    pickup: nodeLabels.get(task.pickup) ?? task.pickup,
    destination: nodeLabels.get(task.destination) ?? task.destination,
  }));

  // Dynamic Fleet Counters
  const activeTasks = tasks.filter((task) => task.status !== 'COMPLETED');
  const queuedTasks = tasks.filter((task) => task.status === 'WAITING' || !task.assignedRobotId);
  const completedTasksCount = tasks.filter((task) => task.status === 'COMPLETED').length;

  const activeRobotsCount = robots.filter((r) => /moving|picking|delivering|navigat|working|active/i.test(String(r.status ?? r.intent))).length;
  const waitingRobotsCount = robots.filter((r) => /wait|yield|pause|negotiat|queue/i.test(String(r.status))).length;
  const chargingRobotsCount = robots.filter((r) => /charge|home|dock/i.test(String(r.status ?? r.intent))).length;
  const idleRobotsCount = robots.filter((r) => String(r.status).toUpperCase() === 'IDLE' && !r.currentTaskId).length;

  const events: Datum[] = Array.isArray(data?.events) ? data.events : [];
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => Number(b.time ?? 0) - Number(a.time ?? 0));
  }, [events]);
  const conflicts: Datum[] = Array.isArray(data?.conflicts) ? data.conflicts : [];
  const metrics: Datum = data?.metrics ?? {};
  const selectedRobot = robots.find((robot) => str(robot.id) === data?.selectedRobotId) ?? null;
  const isRunning = Boolean(data?.running);

  return (
    <div className="min-h-screen bg-[#111816] text-[#e3e8e5] font-sans flex flex-col">
      {/* Top Navbar */}
      <nav className="border-b border-[#283834] bg-[#17221f]/95 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center space-x-3">
          <button onClick={() => setLocation('/')} className="text-[#8aa39b] hover:text-white p-1 transition-colors cursor-pointer" title="Back to Home">
            <ArrowLeft size={20} />
          </button>
          <div className="w-9 h-9 rounded-lg bg-[#2e8b75] flex items-center justify-center font-bold text-white text-lg shadow-lg">
            N
          </div>
          <div>
            <h1 className="font-bold text-base leading-none text-white tracking-wide">NEXUS-Fleet Digital Twin</h1>
            <span className="text-xs text-[#3db89a] font-mono">SIH26123 · Distributed Edge-AI Coordination</span>
          </div>
        </div>

        <div className="flex items-center space-x-6 text-sm font-medium">
          <button onClick={() => setLocation('/')} className="text-[#9cb5ac] hover:text-white transition-colors cursor-pointer">
            Overview
          </button>
          <button onClick={() => setLocation('/docs')} className="text-[#9cb5ac] hover:text-white transition-colors cursor-pointer">
            Documentation & System Spec
          </button>
          <button onClick={() => setLocation('/console')} className="text-[#3db89a] border-b-2 border-[#3db89a] pb-0.5 font-bold">
            3D Fleet Console
          </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#1f302b] border border-[#2e8b75]/40 text-[#42d4b0] px-3 py-1 rounded-full text-xs font-mono shadow-inner">
            <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{isRunning ? 'SIMULATION LIVE' : 'SIMULATION PAUSED'}</span>
          </div>
          <div className="text-xs font-mono text-[#8aa39b] bg-[#17221f] px-3 py-1 rounded-lg border border-[#283834]">
            CLOCK: <strong className="text-white">{shortTime(data?.time)}</strong>
          </div>
        </div>
      </nav>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        
        {/* Toolbar Controls Header */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => isRunning ? pause() : start()}
              className={`px-5 py-2 rounded-lg font-bold text-sm flex items-center space-x-2 transition-all shadow-md cursor-pointer ${
                isRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-[#2e8b75] hover:bg-[#38a38a] text-white shadow-emerald-950/50'
              }`}
            >
              {isRunning ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
              <span>{isRunning ? 'Pause Engine' : 'Start Engine'}</span>
            </button>

            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 rounded-lg bg-[#1a2724] hover:bg-[#233531] border border-[#283834] text-sm font-semibold text-[#e3e8e5] flex items-center space-x-2 transition-all cursor-pointer"
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
                  className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
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

          {/* View Switcher & Camera Toolbar */}
          <div className="flex items-center space-x-3">
            <div className="bg-[#111816] rounded-lg p-1 border border-[#283834] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMapMode('3d')}
                className={`px-4 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  mapMode === '3d' ? 'bg-[#2e8b75] text-white shadow-md' : 'text-[#8aa39b] hover:text-white'
                }`}
              >
                3D DIGITAL TWIN
              </button>
              <button
                type="button"
                onClick={() => setMapMode('plan')}
                className={`px-4 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  mapMode === 'plan' ? 'bg-[#2e8b75] text-white shadow-md' : 'text-[#8aa39b] hover:text-white'
                }`}
              >
                2D OPERATIONAL MAP
              </button>
            </div>

            {mapMode === '3d' && (
              <>
                <button
                  type="button"
                  onClick={() => { setTopView(!topView); setFollowRobot(false); }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                    topView ? 'bg-[#2e8b75] border-[#3db89a] text-white' : 'bg-[#111816] border-[#283834] text-[#8aa39b] hover:text-white'
                  }`}
                >
                  {topView ? 'ORBIT' : 'TOP'}
                </button>
                <button
                  type="button"
                  onClick={() => { setFollowRobot(!followRobot); setTopView(false); }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                    followRobot ? 'bg-[#2e8b75] border-[#3db89a] text-white' : 'bg-[#111816] border-[#283834] text-[#8aa39b] hover:text-white'
                  }`}
                >
                  FOLLOW
                </button>
                <button
                  type="button"
                  onClick={() => { setFollowRobot(false); setTopView(false); setCameraReset((v) => v + 1); }}
                  className="p-1.5 rounded-lg bg-[#111816] border border-[#283834] text-[#8aa39b] hover:text-white transition-colors cursor-pointer"
                  title="Reset Camera View"
                >
                  <RotateCcw size={15} />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setDebugMode(!debugMode)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                debugMode ? 'bg-amber-600 border-amber-400 text-white font-bold' : 'bg-[#111816] border-[#283834] text-[#8aa39b] hover:text-white'
              }`}
              title="Toggle Telemetry Overlay & Graph Debug Layer"
            >
              DEBUG
            </button>

            {/* Task Dispatch Button */}
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-[#3db89a] hover:bg-[#48d2b0] text-slate-950 font-extrabold text-xs flex items-center space-x-1.5 transition-all shadow-lg cursor-pointer"
            >
              <Plus size={16} strokeWidth={3} />
              <span>Dispatch Order Batch</span>
            </button>
          </div>
        </section>

        {/* PRIMARY 3D DIGITAL TWIN CANVAS (FULL WIDTH) */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-4 flex flex-col shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#283834] pb-3">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono text-[#3db89a] uppercase tracking-wider font-bold">PRIMARY DIGITAL TWIN VIEWPORT</span>
              <span className="text-xs font-mono text-[#8aa39b]">48 Shelves • Dynamic Swarm: {robots.length} AMRs = {tasks.length} Orders • 1 Pack Counter</span>
            </div>
            {selectedRobot && (
              <div className="text-xs font-mono text-amber-400 flex items-center gap-2 bg-[#111816] px-3 py-1 rounded-lg border border-[#283834]">
                <Eye size={14} />
                <span>FOLLOWING: <strong>{selectedRobot.id}</strong> ({str(selectedRobot.status)})</span>
              </div>
            )}
          </div>

          <div className="w-full h-[580px] rounded-xl overflow-hidden border border-[#283834] relative bg-[#111816]">
            {mapMode === '3d' ? (
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
            ) : (
              <PlanView2D
                robots={rawRobots}
                nodes={data?.nodes ?? []}
                edges={data?.edges ?? []}
                reservations={data?.reservations ?? []}
                selectedId={data?.selectedRobotId ?? null}
                onSelect={(id) => selectRobot(id)}
                debugMode={debugMode}
              />
            )}
          </div>
        </section>

        {/* DYNAMIC FLEET SUMMARY METRICS BAR (PART 7) */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#283834] pb-2 text-xs font-mono">
            <span className="font-bold text-[#3db89a] uppercase tracking-wider">DYNAMIC FLEET METRICS & LIVE STATE SUMMARY</span>
            <span className="text-[#8aa39b]">Calculated in real-time from backend snapshot</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-center space-y-0.5">
              <span className="text-[10px] font-mono text-[#8aa39b] uppercase">ACTIVE</span>
              <div className="text-xl font-extrabold text-emerald-400 font-mono">{activeRobotsCount}</div>
              <span className="text-[10px] text-[#8aa39b]">Moving / Carrying</span>
            </div>

            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-center space-y-0.5">
              <span className="text-[10px] font-mono text-[#8aa39b] uppercase">WAITING</span>
              <div className="text-xl font-extrabold text-amber-400 font-mono">{waitingRobotsCount}</div>
              <span className="text-[10px] text-[#8aa39b]">Yielding / Conflict</span>
            </div>

            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-center space-y-0.5">
              <span className="text-[10px] font-mono text-[#8aa39b] uppercase">CHARGING</span>
              <div className="text-xl font-extrabold text-cyan-400 font-mono">{chargingRobotsCount}</div>
              <span className="text-[10px] text-[#8aa39b]">Docked at Home</span>
            </div>

            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-center space-y-0.5">
              <span className="text-[10px] font-mono text-[#8aa39b] uppercase">IDLE</span>
              <div className="text-xl font-extrabold text-slate-300 font-mono">{idleRobotsCount}</div>
              <span className="text-[10px] text-[#8aa39b]">Ready for Tasks</span>
            </div>

            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-center space-y-0.5">
              <span className="text-[10px] font-mono text-[#8aa39b] uppercase">ACTIVE TASKS</span>
              <div className="text-xl font-extrabold text-indigo-400 font-mono">{activeTasks.length} / {tasks.length}</div>
              <span className="text-[10px] text-[#8aa39b]">In Progress</span>
            </div>

            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-center space-y-0.5">
              <span className="text-[10px] font-mono text-[#8aa39b] uppercase">COMPLETED</span>
              <div className="text-xl font-extrabold text-teal-400 font-mono">{completedTasksCount}</div>
              <span className="text-[10px] text-[#8aa39b]">Delivered to Pack</span>
            </div>

            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-center space-y-0.5">
              <span className="text-[10px] font-mono text-[#8aa39b] uppercase">QUEUED FIFO</span>
              <div className="text-xl font-extrabold text-rose-400 font-mono">{queuedTasks.length}</div>
              <span className="text-[10px] text-[#8aa39b]">Pending Assignment</span>
            </div>
          </div>
        </section>

        {/* FLEET ROSTER GRID BELOW 3D (PART 6) */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#283834] pb-3">
            <div>
              <span className="text-[10px] font-mono text-[#3db89a] uppercase tracking-wider">Fleet Roster ({robots.length} Units)</span>
              <h2 className="text-lg font-bold text-white leading-tight">AMR State & Hardware Status Cards</h2>
            </div>
            <span className="text-xs font-mono text-[#8aa39b]">Click any robot card to focus camera</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {robots.map((robot) => {
              const isSelected = str(robot.id) === data?.selectedRobotId;
              const isCharging = String(robot.status ?? robot.intent).includes('CHARGE') || String(robot.intent).includes('HOME');

              return (
                <div
                  key={str(robot.id)}
                  onClick={() => selectRobot(robot.id)}
                  className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1e332c] border-[#3db89a] ring-2 ring-[#3db89a]/50 shadow-xl'
                      : 'bg-[#111816]/90 border-[#283834] hover:border-[#385249]'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-white text-sm flex items-center gap-1.5">
                      <Bot size={16} className={isSelected ? 'text-[#3db89a]' : 'text-slate-400'} />
                      <span>{str(robot.id)}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${statusTone(robot.state)}`}>
                      {str(robot.state, 'IDLE')}
                    </span>
                  </div>

                  {/* Battery & Charging Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#8aa39b]">
                      <span className="flex items-center gap-1">
                        <Battery size={13} className={isCharging ? 'text-cyan-400' : 'text-emerald-400'} />
                        <span>Battery</span>
                      </span>
                      <strong className="text-white font-bold">{Number(robot.battery ?? 0).toFixed(0)}%</strong>
                    </div>
                    <div className="w-full bg-[#1e2c28] h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${isCharging ? 'bg-cyan-400 animate-pulse' : Number(robot.battery) < 25 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                        style={{ width: `${Math.max(0, Math.min(100, Number(robot.battery ?? 0)))}%` }}
                      />
                    </div>
                  </div>

                  {/* Location & Task info */}
                  <div className="space-y-1 font-mono text-[11px] text-[#8aa39b]">
                    <div className="flex justify-between">
                      <span>Location:</span>
                      <strong className="text-white truncate max-w-[100px]">{str(robot.currentNode)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Target:</span>
                      <strong className="text-[#3db89a] truncate max-w-[100px]">{str(robot.destination, 'Home Charger')}</strong>
                    </div>
                    <div className="flex justify-between border-t border-[#233530] pt-1">
                      <span>Task:</span>
                      <strong className="text-amber-400 truncate max-w-[100px]">{str(robot.currentTaskId, 'None (Idle)')}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* End-to-End Grocery Fulfillment Lifecycle Workflow */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#283834] pb-2 text-xs font-mono">
            <span className="font-bold text-[#3db89a] uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3db89a]" />
              End-to-End Grocery Fulfillment Lifecycle Workflow
            </span>
            <span className="text-[#8aa39b]">Order &#8594; Best AMR Bid &#8594; Food Pickup &#8594; Counter Acceptance &#8594; Charger Return</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-xs">
              <div className="text-[10px] font-mono text-[#3db89a] uppercase">Step 1</div>
              <div className="font-bold text-white mt-1">Food Order Placed</div>
              <p className="text-[#8aa39b] text-[11px] mt-1">Specific item selected (e.g. Apples, Milk, Bread). Only ordered items trigger AMR bids.</p>
            </div>
            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-xs">
              <div className="text-[10px] font-mono text-[#3db89a] uppercase">Step 2</div>
              <div className="font-bold text-white mt-1">Best AMR Auctioned</div>
              <p className="text-[#8aa39b] text-[11px] mt-1">Idle AMRs bid based on distance &amp; battery. Lowest cost AMR launches; unassigned AMRs rest at dock.</p>
            </div>
            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-xs">
              <div className="text-[10px] font-mono text-[#3db89a] uppercase">Step 3</div>
              <div className="font-bold text-white mt-1">Food Item Picked</div>
              <p className="text-[#8aa39b] text-[11px] mt-1">Robot reaches designated rack, loads item, and routes directly to Pack Counter (N-2-8).</p>
            </div>
            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-xs">
              <div className="text-[10px] font-mono text-[#3db89a] uppercase">Step 4</div>
              <div className="font-bold text-white mt-1">Counter Handshake</div>
              <p className="text-[#8aa39b] text-[11px] mt-1">Pack Counter accepts package immediately, order completed, counter lease released for next AMR.</p>
            </div>
            <div className="bg-[#111816] p-3 rounded-lg border border-[#283834] text-xs">
              <div className="text-[10px] font-mono text-[#3db89a] uppercase">Step 5</div>
              <div className="font-bold text-white mt-1">Perimeter Dock Return</div>
              <p className="text-[#8aa39b] text-[11px] mt-1">AMR exits via perimeter loop to avoid queue, returns to home charger slot, and docks.</p>
            </div>
          </div>
        </section>

        {/* ORDERS & TASK FIFO QUEUE TABLE (PART 9, 32) */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-4 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#283834] pb-3">
            <div>
              <span className="text-[10px] font-mono text-[#3db89a] uppercase tracking-wider">Order Management & Task Dispatch</span>
              <h2 className="text-lg font-bold text-white leading-tight">Deterministic FIFO Order Queue ({tasks.length} Total Orders)</h2>
            </div>
            <span className="text-xs font-mono text-[#8aa39b]">
              Pending orders wait in strict FIFO queue; oldest order assigned first
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#283834]">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-[#111816] text-[#8aa39b] border-b border-[#283834]">
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Task ID</th>
                  <th className="p-3">Item / SKU</th>
                  <th className="p-3">Pickup Shelf</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned AMR</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Queue Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233530]">
                {tasks.length ? (
                  tasks.map((task, idx) => {
                    const isQueued = task.status === 'WAITING' || !task.assignedRobotId;
                    const queuePos = isQueued ? queuedTasks.findIndex((t) => t.id === task.id) + 1 : '—';

                    return (
                      <tr key={str(task.id, String(idx))} className="hover:bg-[#1f2e29] transition-colors">
                        <td className="p-3 font-bold text-white">{str(task.orderId, `ORD-${78421 + idx}`)}</td>
                        <td className="p-3 text-[#3db89a] font-bold">{str(task.id)}</td>
                        <td className="p-3 text-slate-300 truncate max-w-[200px]">{str(task.sku)}</td>
                        <td className="p-3 text-amber-300">{str(task.pickup)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusTone(task.status)}`}>
                            {str(task.status)}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-cyan-300">
                          {str(task.assignedRobotId, 'UNASSIGNED (QUEUED)')}
                        </td>
                        <td className="p-3 text-slate-400">{Number(task.priority ?? 0.8).toFixed(2)}</td>
                        <td className="p-3 font-bold text-rose-400">
                          {queuePos !== '—' ? `#${queuePos} (FIFO)` : 'Active'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-[#8aa39b]">
                      No active orders. Click "Dispatch Order Batch" to generate tasks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* System Journal / Activity Log */}
        <section className="bg-[#17221f] border border-[#283834] rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#283834] pb-3">
            <div>
              <span className="text-[10px] font-mono text-[#3db89a] uppercase tracking-wider">Autonomous Telemetry Journal</span>
              <h2 className="text-lg font-bold text-white leading-tight">Live P2P Negotiation & Recovery Log</h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              10 Hz STREAM
            </span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {sortedEvents.slice(0, 20).map((event, idx) => (
              <div key={str(event.id, String(idx))} className="p-2.5 rounded-lg bg-[#111816] border border-[#283834] text-xs space-y-1 font-mono">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#3db89a]">{str(event.type).replaceAll('_', ' ')}</span>
                  <span className="text-[#8aa39b]">{str(event.robotId, 'FLEET')} · {shortTime(event.time)}</span>
                </div>
                <p className="text-slate-300 text-[11px]">{str(event.reason, str(event.result))}</p>
              </div>
            ))}
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
                <p className="text-xs text-[#8aa39b] mt-1">Select orders to dispatch; nearest idle AMRs will pick them, pending orders queue in FIFO order</p>
              </div>
              <button type="button" onClick={() => setIsTaskModalOpen(false)} className="text-[#8aa39b] hover:text-white text-xl font-bold p-1 cursor-pointer">✕</button>
            </div>

            <div className="flex items-center justify-between text-xs text-[#8aa39b] font-mono px-1">
              <span>Selected: <strong className="text-emerald-400 font-bold">{selectedProductIds.length} Products</strong></span>
              <div className="space-x-3">
                <button type="button" onClick={selectAllProducts} className="text-[#3db89a] hover:underline font-medium cursor-pointer">Select All</button>
                <button type="button" onClick={clearProductSelection} className="text-[#8aa39b] hover:text-white hover:underline cursor-pointer">Clear</button>
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
                    className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'border-[#3db89a] bg-[#1f332c] shadow-lg ring-1 ring-[#3db89a]'
                        : 'border-[#283834] bg-[#111816]/60 hover:border-[#385249]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
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

            <div className="bg-[#192723] border border-[#2e4d43] rounded-lg p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#8aa39b]">Batch Order Count:</span>
                <span className="text-emerald-400 font-bold">{selectedProducts.length} Tasks to Dispatch</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-[#8aa39b]">Fleet Auto Assignment:</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Bot size={15} />
                  Dynamic 1:1 Swarm (AMR-01 .. AMR-{String(selectedProducts.length).padStart(2, "0")})
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#283834]">
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-[#283834] text-sm text-[#8aa39b] hover:text-white hover:bg-[#1f2c28] transition-colors cursor-pointer"
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
                <span>Launch Swarm ({selectedProducts.length} Bots for {selectedProducts.length} Orders)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}