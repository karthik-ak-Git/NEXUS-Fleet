import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Activity, AlertOctagon, ArrowDownRight, ArrowUpRight, Battery, Bot,
  Boxes, ChevronDown, CircleHelp, Clock3, Command, Gauge, Layers3,
  MapPinned, Menu, Pause, Play, Plus, Radio, RotateCcw, Route,
  ShieldCheck, Signal, Siren, SlidersHorizontal, Sparkles, Target,
  TimerReset, Zap,
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

const scenarios = [
  ['normal', 'Nominal operation'],
  ['head-on', 'Head-on encounter'],
  ['intersection', 'Intersection negotiation'],
  ['blocked-aisle', 'Blocked aisle recovery'],
  ['deadlock', 'Deadlock recovery'],
  ['communication-loss', 'Communication loss'],
  ['robot-failure', 'Robot failure'],
  ['low-battery', 'Low battery return'],
  ['obstacle', 'Dynamic obstacle'],
  ['high-congestion', 'High congestion'],
  ['task-burst', 'Task burst'],
  ['multi-failure', 'Multi-failure'],
  ['stress-test', 'Stress test'],
];

const disturbances = [
  ['block-aisle', 'Block an aisle'],
  ['communication-loss', 'Communication loss'],
  ['robot-failure', 'Robot failure'],
  ['low-battery', 'Low battery'],
  ['obstacle', 'Place an obstacle'],
  ['conflict', 'Create a conflict'],
];

const rackBlocks = [
  [140, 112, 136, 74], [140, 208, 136, 74], [140, 304, 136, 74], [140, 400, 136, 74],
  [371, 112, 136, 74], [371, 208, 136, 74], [371, 304, 136, 74], [371, 400, 136, 74],
  [602, 112, 136, 74], [602, 208, 136, 74], [602, 304, 136, 74], [602, 400, 136, 74],
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
  if (/error|fail|dead|blocked|critical|collision|lost|offline/.test(status)) return 'tone-danger';
  if (/wait|yield|charge|low|warn|conflict|paused|recover|rerout/.test(status)) return 'tone-warn';
  if (/complete|idle|ready|online|healthy|resolved/.test(status)) return 'tone-good';
  return 'tone-active';
}

function MetricTile({ label, value, unit, icon: Icon, note, tone = 'default' }: {
  label: string; value: unknown; unit?: string; icon: typeof Activity; note?: string; tone?: string;
}) {
  return (
    <article className={`metric-tile ${tone}`} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <div className="metric-top"><span>{label}</span><Icon size={15} strokeWidth={1.8} /></div>
      <div className="metric-number">{str(value, '0')}<small>{unit}</small></div>
      {note && <div className="metric-note">{note}</div>}
    </article>
  );
}

function FleetMap({ robots, nodes, blockedEdges, obstacles, reservations, selectedId, onSelect }: {
  robots: Datum[]; nodes: Datum[]; blockedEdges: Datum[]; obstacles: Datum[]; reservations: Datum[];
  selectedId: string | null; onSelect: (id: string) => void;
}) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const allPoints = useMemo(() => {
    const result: Point[] = nodes.map((node) => ({ x: Number(node.x), y: Number(node.y) }));
    robots.forEach((robot) => {
      const p = pointOf(robot); if (p) result.push(p);
      if (Array.isArray(robot.route)) robot.route.forEach((item: any) => {
        const routePoint = pointOf(typeof item === 'string' ? nodeMap.get(item) : item);
        if (routePoint) result.push(routePoint);
      });
    });
    obstacles.forEach((obstacle) => { const p = pointOf(obstacle); if (p) result.push(p); });
    return result;
  }, [robots, nodes, nodeMap, obstacles]);
  const bounds = useMemo(() => {
    if (!allPoints.length) return { minX: 0, maxX: 100, minY: 0, maxY: 60 };
    const xs = allPoints.map((p) => p.x); const ys = allPoints.map((p) => p.y);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    return {
      minX: minX - (maxX === minX ? 10 : (maxX - minX) * .1),
      maxX: maxX + (maxX === minX ? 10 : (maxX - minX) * .1),
      minY: minY - (maxY === minY ? 7 : (maxY - minY) * .1),
      maxY: maxY + (maxY === minY ? 7 : (maxY - minY) * .1),
    };
  }, [allPoints]);
  const project = (p: Point) => ({
    x: 52 + ((p.x - bounds.minX) / (bounds.maxX - bounds.minX)) * 796,
    y: 51 + ((p.y - bounds.minY) / (bounds.maxY - bounds.minY)) * 402,
  });
  const resolvePoint = (value: any) =>
    pointOf(typeof value === 'string' ? nodeMap.get(value) : value);
  const edgeEnds = (edge: Datum) => {
    const from = resolvePoint(edge.from ?? edge.start ?? edge.a);
    const to = resolvePoint(edge.to ?? edge.end ?? edge.b);
    if (from && to) return [project(from), project(to)];
    return null;
  };

  return (
    <div className="map-viewport scrollbar-thin">
      <svg className="warehouse-map" viewBox="0 0 900 500" role="img" aria-label="Live warehouse fleet map">
        <defs>
          <pattern id="mapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#789088" strokeOpacity=".12" strokeWidth=".7" />
          </pattern>
          <pattern id="rackHatch" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 7L7 0" stroke="#7b887e" strokeOpacity=".15" strokeWidth=".8" />
          </pattern>
          <filter id="robotShadow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#19332c" floodOpacity=".2" />
          </filter>
        </defs>
        <rect width="900" height="500" fill="#ebe9dd" />
        <rect width="900" height="500" fill="url(#mapGrid)" />
        <rect x="26" y="25" width="848" height="450" rx="2" fill="none" stroke="#75847a" strokeOpacity=".46" strokeDasharray="3 4" />
        <path d="M40 74H860 M40 167H860 M40 263H860 M40 359H860 M40 452H860" stroke="#b4b6a8" strokeWidth="1" strokeDasharray="6 8" />
        {rackBlocks.map(([x, y, w, h], index) => (
          <g key={`rack-${index}`}>
            <rect x={x} y={y} width={w} height={h} rx="2" fill="#cdd0c2" stroke="#8b978c" strokeWidth="1" />
            <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill="url(#rackHatch)" />
            <path d={`M${x + 12} ${y + 9}V${y + h - 9}M${x + w - 12} ${y + 9}V${y + h - 9}`} stroke="#829087" strokeWidth="1" />
            <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" className="svg-rack-label">R-{String(index + 1).padStart(2, '0')}</text>
          </g>
        ))}
        <g className="svg-zone">
          <rect x="38" y="80" width="71" height="350" rx="2" fill="#dfd8c5" stroke="#afa68e" />
          <text x="73" y="256" transform="rotate(-90 73 256)" textAnchor="middle">INBOUND / PICK FACE</text>
          <rect x="777" y="80" width="84" height="350" rx="2" fill="#dfd8c5" stroke="#afa68e" />
          <text x="819" y="256" transform="rotate(-90 819 256)" textAnchor="middle">OUTBOUND / STAGING</text>
        </g>
        <g className="svg-aisle-labels">
          <text x="303" y="95">AISLE 01</text><text x="534" y="95">AISLE 02</text>
          <text x="303" y="462">AISLE 03</text><text x="534" y="462">AISLE 04</text>
        </g>
        {robots.map((robot) => {
          const p = pointOf(robot); if (!p) return null;
          const xy = project(p);
          const id = str(robot.id);
          const selected = id === selectedId;
          const tone = statusTone(robot.state);
      const routePoints = Array.isArray(robot.route) ? robot.route.map(resolvePoint).filter(Boolean) as Point[] : [];
          const linePoints = [p, ...routePoints].map((pt) => {
            const mapped = project(pt); return `${mapped.x},${mapped.y}`;
          }).join(' ');
          const heading = Number(robot.heading) || 0;
          return (
            <g key={id} className="map-robot" onClick={() => onSelect(id)} role="button" tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(id); }}
              aria-label={`Select robot ${id}`} data-testid={`map-robot-${id}`}>
              {routePoints.length > 0 && <polyline points={linePoints} fill="none" stroke={selected ? '#bf8b24' : '#167a68'} strokeWidth={selected ? 2.5 : 1.7} strokeDasharray="5 5" opacity=".8" />}
              <circle cx={xy.x} cy={xy.y} r={selected ? 15 : 11} fill={selected ? '#f7d578' : '#f6f2e6'} opacity=".8" />
              <g transform={`translate(${xy.x} ${xy.y}) rotate(${heading})`} filter="url(#robotShadow)">
                <rect x="-8" y="-8" width="16" height="16" rx="4" className={`robot-body ${tone}`} />
                <path d="M0 -6L4 1H-4Z" fill="#fff8e5" />
              </g>
              <circle cx={xy.x + 8} cy={xy.y - 8} r="3.2" className={`robot-state-dot ${tone}`} />
              <text x={xy.x} y={xy.y + 24} textAnchor="middle" className={`robot-id ${selected ? 'is-selected' : ''}`}>{id}</text>
            </g>
          );
        })}
        {blockedEdges.map((edge, index) => {
          const ends = edgeEnds(edge); if (!ends) return null;
          return <g key={`blocked-${index}`}><line x1={ends[0].x} y1={ends[0].y} x2={ends[1].x} y2={ends[1].y} stroke="#ba473e" strokeWidth="7" strokeLinecap="round" opacity=".7" /><line x1={ends[0].x} y1={ends[0].y} x2={ends[1].x} y2={ends[1].y} stroke="#f3ddc6" strokeWidth="1.4" strokeDasharray="4 4" /></g>;
        })}
        {obstacles.map((obstacle, index) => {
          const p = pointOf(obstacle); if (!p) return null;
          const xy = project(p);
          return <g key={`obstacle-${index}`} transform={`translate(${xy.x} ${xy.y})`}><circle r="12" fill="#bd584b" fillOpacity=".17" /><path d="M-5 -5L5 5M5 -5L-5 5" stroke="#a33f38" strokeWidth="2.5" /><circle r="8" fill="none" stroke="#a33f38" strokeDasharray="2 3" /></g>;
        })}
        {reservations.slice(0, 12).map((reservation, index) => {
          const p = pointOf(reservation); if (!p) return null;
          const xy = project(p);
          return <circle key={`reservation-${index}`} cx={xy.x} cy={xy.y} r="11" fill="none" stroke="#b38c36" strokeDasharray="2 3" strokeWidth="1.4" />;
        })}
        <g transform="translate(46 446)">
          <circle cx="0" cy="0" r="7" fill="#167a68" /><text x="14" y="3" className="map-legend-label">ACTIVE AGENT</text>
          <circle cx="128" cy="0" r="7" fill="#c69a38" /><text x="142" y="3" className="map-legend-label">YIELD / WAIT</text>
          <circle cx="264" cy="0" r="7" fill="#bb554b" /><text x="278" y="3" className="map-legend-label">FAULT / BLOCK</text>
        </g>
      </svg>
    </div>
  );
}

function FleetConsole() {
  const [, setLocation] = useLocation();
  const { state, start, pause, reset, setSpeed, setScenario, inject, createTask, runBenchmark, runStressTest, runDemo, selectRobot } = useSimulation();
  const [scenario, setScenarioLocal] = useState('normal');
  const [disturbance, setDisturbance] = useState('block-aisle');
  const [query, setQuery] = useState('');
  const [activeNav, setActiveNav] = useState('overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mapMode, setMapMode] = useState<'3d' | 'plan'>('3d');
  const [followRobot, setFollowRobot] = useState(false);
  const [topView, setTopView] = useState(false);
  const [cameraReset, setCameraReset] = useState(0);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState(0);

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

  const selectedProduct = groceryProducts[selectedProductIndex];
  const targetNodeCoord = nodeMapForDist.get(selectedProduct.pickup) ?? { x: 0, y: 0 };

  const nearestIdleRobot = useMemo(() => {
    const idleRobots = robots.filter((r) => r.health !== 'FAILED' && (!r.taskId || r.state === 'IDLE' || r.state === 'COMPLETED'));
    if (!idleRobots.length) return robots[0] ?? null;

    let bestRobot = idleRobots[0];
    let minDistance = Infinity;

    for (const robot of idleRobots) {
      const rx = Number(robot.x ?? 0);
      const ry = Number(robot.y ?? 0);
      const dist = Math.hypot(rx - targetNodeCoord.x, ry - targetNodeCoord.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestRobot = robot;
      }
    }

    return { ...bestRobot, distanceMeters: minDistance.toFixed(1) };
  }, [robots, targetNodeCoord]);

  const handleDispatchTask = () => {
    createTask(selectedProduct.pickup, selectedProduct.sku, nearestIdleRobot?.id);
    setIsTaskModalOpen(false);
  };
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
  const filteredRobots = robots.filter((robot) => str(robot.id).toLowerCase().includes(query.toLowerCase()));
  const activeCount = metrics.activeRobots ?? robots.filter((robot) => /active|moving|working|navigat/.test(String(robot.state).toLowerCase())).length;
  const isRunning = Boolean(data?.running);

  const navTo = (section: string) => {
    setActiveNav(section);
    setMobileMenu(false);
    document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const chooseScenario = (value: string) => {
    setScenarioLocal(value);
    setScenario(value);
  };
  const currentBenchmark = data?.benchmark;
  const priorityLabel = (priority: unknown) => {
    const value = Number(priority);
    return value >= .85 ? 'HIGH' : value >= .65 ? 'MEDIUM' : 'STANDARD';
  };

  return (
    <main className="fleet-app grain" data-testid="fleet-console">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span>N</span><i /></div>
          <div><strong>NEXUS<span> / FLEET</span></strong><small>COORDINATION SYSTEM</small></div>
        </div>
        <div className="facility-switch">
          <div className="facility-icon"><Layers3 size={16} /></div>
          <div><small>FACILITY</small><strong>BEL · Ghaziabad DC</strong></div>
          <ChevronDown size={14} />
        </div>
        <div className="side-label">OPERATIONS</div>
        <nav className="side-nav" aria-label="Workspace navigation">
          {[
            { id: 'overview', label: 'Live overview', icon: MapPinned },
            { id: 'fleet', label: 'Robot fleet', icon: Bot, count: robots.length },
            { id: 'tasks', label: 'Task queue', icon: Boxes, count: metrics.activeTasks ?? tasks.length },
            { id: 'events', label: 'Event stream', icon: Activity },
          ].map(({ id, label, icon: Icon, count }) => (
            <button key={id} type="button" className={`side-nav-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => navTo(id)} data-testid={`nav-${id}`}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{count !== undefined && <b>{count}</b>}
            </button>
          ))}
        </nav>
        <div className="side-label sim-label">SIMULATION LAB</div>
        <div className="side-nav">
          <button type="button" className="side-nav-item" onClick={() => { runBenchmark(); navTo('benchmark'); }} data-testid="button-benchmark-nav"><Gauge size={17} /><span>Benchmarks</span><ArrowUpRight size={13} className="nav-arrow" /></button>
          <button type="button" className="side-nav-item" onClick={() => runDemo()} data-testid="button-demo-nav"><Sparkles size={17} /><span>Guided demo</span><ArrowUpRight size={13} className="nav-arrow" /></button>
        </div>
        <div className="sidebar-spacer" />
        <div className="protocol-card">
          <div className="protocol-heading"><span className="protocol-dot" /> SYSTEM LINK</div>
          <div className="protocol-row"><span>Fleet bus</span><strong><i /> nominal</strong></div>
          <div className="protocol-row"><span>Planner</span><strong><i /> available</strong></div>
          <div className="protocol-row"><span>Safety layer</span><strong><i /> engaged</strong></div>
          <div className="protocol-footer"><span>BUILD 0.9.26-SIH</span><span>ZONE 05:IST</span></div>
        </div>
        <div className="operator-card">
          <div className="operator-avatar">OP</div><div><strong>Operations desk</strong><small>CONTROL ROOM · L2</small></div>
          <CircleHelp size={16} />
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button type="button" className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu" data-testid="button-mobile-menu"><Menu size={19} /></button>
          <div className="breadcrumb">
            <button onClick={() => setLocation('/')} className="hover:text-emerald-400 transition-colors cursor-pointer mr-1">OVERVIEW</button>
            <b>/</b>
            <button onClick={() => setLocation('/docs')} className="hover:text-emerald-400 transition-colors cursor-pointer mx-1 font-semibold">DOCS</button>
            <b>/</b>
            <strong className="ml-1 text-emerald-400 font-mono">3D CONSOLE</strong>
          </div>
          <div className="topbar-right">
            <div className="clock-readout"><span>SIM TIME</span><strong className="mono">{shortTime(data?.time)}</strong></div>
            <div className="topbar-divider" />
            <div className="live-indicator"><span className={`live-dot ${isRunning ? 'pulse-dot' : 'is-paused'}`} /><span>{isRunning ? 'SIMULATION LIVE' : 'SIMULATION PAUSED'}</span></div>
            <button type="button" className="icon-button help-button" title="Environment controls only" aria-label="Environment controls information" data-testid="button-control-info"><CircleHelp size={17} /></button>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading" id="section-overview">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> DIGITAL TWIN <span className="eyebrow-sep">/</span> ENVIRONMENT 01</div>
              <h1>Warehouse <em>operations</em></h1>
              <p>Observe autonomous coordination across the floor. Robots negotiate, route and recover independently.</p>
            </div>
            <div className="heading-actions">
              <button type="button" className="button-secondary" onClick={() => { reset(); setScenarioLocal('normal'); }} data-testid="button-reset"><RotateCcw size={14} /> Reset run</button>
              <button type="button" className="button-primary" onClick={() => isRunning ? pause() : start()} data-testid="button-simulation-toggle">
                {isRunning ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                {isRunning ? 'Pause simulation' : 'Resume simulation'}
              </button>
            </div>
          </section>

          <section className="metrics-strip" aria-label="Fleet performance metrics">
            <MetricTile label="Active robots" value={activeCount} unit={`/ ${robots.length}`} icon={Bot} note="Fleet availability" tone="metric-teal" />
             <MetricTile label="Tasks complete" value={metrics.completedTasks} icon={Target} note={`${metrics.activeTasks ?? activeTasks.length} currently active`} />
            <MetricTile label="Aisle conflicts" value={metrics.conflicts ?? conflicts.length} icon={Route} note={`${metrics.deadlocks ?? 0} deadlocks`} tone={(metrics.conflicts ?? conflicts.length) > 0 ? 'metric-amber' : ''} />
            <MetricTile label="Blocked aisles" value={metrics.blockedAisles ?? (data?.blockedEdges?.length ?? 0)} icon={AlertOctagon} note={`${metrics.reroutes ?? 0} route adaptations`} tone={(metrics.blockedAisles ?? 0) > 0 ? 'metric-red' : ''} />
            <MetricTile label="Avg. battery" value={metrics.avgBattery} unit="%" icon={Battery} note={`${metrics.communicationHealth ?? '—'}% comms health`} />
            <MetricTile label="Throughput" value={metrics.throughput} unit="/ hr" icon={Zap} note={`${metrics.distanceTravelled ?? '—'} m traveled`} tone="metric-teal" />
          </section>

          <div className="control-strip">
            <div className="control-group">
              <span className="control-caption"><Command size={13} /> ENVIRONMENT</span>
              <div className="scenario-select-wrap">
                <select value={scenario} onChange={(e) => chooseScenario(e.target.value)} aria-label="Choose simulation scenario" data-testid="select-scenario">
                  {scenarios.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select><ChevronDown size={13} />
              </div>
              <button type="button" className="control-icon-button" title="Inject selected environmental disturbance" onClick={() => inject(disturbance)} data-testid="button-inject-disturbance"><Siren size={14} /><span>Inject</span></button>
              <select className="disturbance-select" value={disturbance} onChange={(e) => setDisturbance(e.target.value)} aria-label="Disturbance type" data-testid="select-disturbance">
                {disturbances.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </div>
            <div className="control-right">
              <div className="speed-control"><span>SPEED</span>{[1, 2, 4].map((speed) => <button type="button" key={speed} className={Number(data?.speed ?? 1) === speed ? 'speed-active' : ''}
                onClick={() => setSpeed(speed)} data-testid={`button-speed-${speed}`}>{speed}×</button>)}</div>
              <span className="control-v-divider" />
              <button type="button" className="control-icon-button create-task-button" onClick={() => setIsTaskModalOpen(true)} data-testid="button-create-task"><Plus size={14} /> Add task</button>
            </div>
          </div>

          <div className="primary-grid">
            <section className="panel map-panel">
              <div className="panel-heading">
                <div><div className="panel-kicker"><span className="panel-kicker-mark" /> SPATIAL VIEW</div><h2>Warehouse floor <span>·</span> Zone 05</h2></div>
                <div className="map-heading-tools">
                  <div className="map-view-switch" aria-label="Warehouse view mode">
                    <button type="button" className={mapMode === '3d' ? 'view-active' : ''} onClick={() => setMapMode('3d')}>3D</button>
                    <button type="button" className={mapMode === 'plan' ? 'view-active' : ''} onClick={() => setMapMode('plan')}>PLAN</button>
                  </div>
                  {mapMode === '3d' && <>
                    <button type="button" className={`scene-control ${topView ? 'scene-control-active' : ''}`} onClick={() => { setTopView(!topView); setFollowRobot(false); }} title="Toggle top-down camera">{topView ? 'ORBIT' : 'TOP'}</button>
                    <button type="button" className={`scene-control ${followRobot ? 'scene-control-active' : ''}`} onClick={() => { setFollowRobot(!followRobot); setTopView(false); }} title="Follow the selected agent">FOLLOW</button>
                    <button type="button" className="scene-control scene-reset" onClick={() => { setFollowRobot(false); setTopView(false); setCameraReset((value) => value + 1); }} title="Reset camera"><RotateCcw size={11} /></button>
                  </>}
                  <span className="map-live-pill"><i /> LIVE</span>
                </div>
              </div>
              <div className="map-summary">
                 <div><span className="summary-square" /> <b>{robots.length}</b> agents on floor</div>
                <div><span className="summary-square conflict" /> <b>{conflicts.length}</b> open negotiations</div>
                <div><span className="summary-square blocked" /> <b>{data?.blockedEdges?.length ?? 0}</b> restricted segments</div>
                <span className="map-scale">GRID 1.0 M <span>·</span> NORTH ↑</span>
              </div>
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
                 />
               ) : (
                 <FleetMap robots={robots} nodes={data?.nodes ?? []} blockedEdges={(data?.edges ?? []).filter((edge: Datum) => edge.blocked)} obstacles={data?.obstacles ?? []}
                   reservations={data?.reservations ?? []} selectedId={data?.selectedRobotId ?? null}
                   onSelect={(id) => selectRobot(id)} />
               )}
              <div className="map-footer"><span><Radio size={13} /> COORDINATION LAYER <b>ONLINE</b></span><span>ROUTE RESERVATIONS VISUALIZED</span></div>
            </section>

            <aside className="right-rail">
              <section className="panel inspector-panel">
                <div className="panel-heading compact">
                  <div><div className="panel-kicker">AGENT INSPECTOR</div><h2>{selectedRobot ? str(selectedRobot.id) : 'No agent selected'}</h2></div>
                  {selectedRobot && <span className={`status-chip ${statusTone(selectedRobot.state)}`}><i />{str(selectedRobot.state, 'UNKNOWN')}</span>}
                </div>
                {selectedRobot ? <RobotInspector robot={selectedRobot} /> : (
                  <div className="inspector-empty"><div className="empty-radar"><Bot size={21} /></div><strong>Awaiting selection</strong><span>Select an agent on the map or roster to inspect its current intent and health.</span></div>
                )}
                {data?.latestDecision && <div className="decision-callout"><div><ShieldCheck size={14} /> LATEST COORDINATION DECISION</div><p>{str(data.latestDecision.reason ?? data.latestDecision.decision ?? data.latestDecision)}</p><span>{str(data.latestDecision.resource, 'SHARED RESOURCE')} · {str(data.latestDecision.status, 'RESOLVED')}</span></div>}
              </section>
              <section className="panel conflict-panel">
                <div className="section-title-row"><div><div className="panel-kicker">SHARED-SPACE PROTOCOL</div><h2>Negotiations</h2></div><span className="count-chip">{conflicts.length}</span></div>
                {conflicts.length > 0 ? <div className="negotiation-list scrollbar-thin">
                  {conflicts.slice(0, 4).map((conflict, index) => <div className="negotiation" key={str(conflict.id, `conflict-${index}`)} data-testid={`conflict-${str(conflict.id, String(index))}`}>
                    <div className="negotiation-top"><span className="conflict-resource"><Route size={12} />{str(conflict.resource, 'SHARED AISLE')}</span><span className={`status-chip ${statusTone(conflict.risk)}`}>{str(conflict.risk, 'REVIEW')}</span></div>
                    <div className="negotiation-pair"><b>{str(conflict.robotA)}</b><span>×</span><b>{str(conflict.robotB)}</b><time>{str(conflict.etaA)} / {str(conflict.etaB)}</time></div>
                    <p>{str(conflict.decision, str(conflict.status, 'Negotiation in progress'))}</p>
                  </div>)}
                </div> : <div className="quiet-empty"><ShieldCheck size={15} /><span>No shared-space conflicts. Agents are moving with clear reservations.</span></div>}
              </section>
            </aside>
          </div>

          <div className="secondary-grid">
            <section className="panel roster-panel" id="section-fleet">
              <div className="section-title-row">
                <div><div className="panel-kicker">INDEPENDENT AGENTS</div><h2>Fleet roster <span className="subtle-count">{robots.length} units</span></h2></div>
                <label className="search-box"><SlidersHorizontal size={13} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by ID" aria-label="Filter robots by ID" data-testid="input-filter-robots" /><span className="mono">/</span></label>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>AGENT</th><th>STATE / INTENT</th><th>TASK</th><th>BATTERY</th><th>ETA</th><th>LINK</th></tr></thead>
                  <tbody>
                    {filteredRobots.length ? filteredRobots.slice(0, 8).map((robot, index) => {
                      const selected = str(robot.id) === data?.selectedRobotId;
                      const battery = Number(robot.battery);
                      return <tr key={str(robot.id, `robot-${index}`)} className={selected ? 'row-selected' : ''} onClick={() => selectRobot(str(robot.id))}
                        data-testid={`row-robot-${str(robot.id, String(index))}`} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') selectRobot(str(robot.id)); }}>
                        <td><span className="robot-cell-mark">N</span><b>{str(robot.id)}</b></td>
                        <td><span className={`state-dot ${statusTone(robot.state)}`} /><span className="table-state">{str(robot.state, 'Unknown')}</span><small>{str(robot.intent, '—')}</small></td>
                        <td><span className="mono task-id">{str(robot.taskId, '—')}</span></td>
                        <td><div className="battery-cell"><span className={`battery-bar ${battery < 25 ? 'battery-low' : ''}`}><i style={{ width: `${Math.min(100, Math.max(0, battery))}%` }} /></span><span>{Number.isFinite(battery) ? `${battery}%` : '—'}</span></div></td>
                        <td className="mono">{str(robot.eta, '—')}</td>
                        <td><LinkQuality value={robot.communication} /></td>
                      </tr>;
                    }) : <tr><td colSpan={6}><div className="table-empty"><Bot size={18} /><strong>{robots.length ? 'No matching agents' : 'Fleet is standing by'}</strong><span>{robots.length ? 'Try a different robot identifier.' : 'Agents will appear here when the simulation is initialized.'}</span></div></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="panel-footnote"><span><i className="footnote-pulse" /> TELEMETRY STREAMING</span><span>SELECT A ROW TO INSPECT</span></div>
            </section>

            <section className="panel event-panel" id="section-events">
              <div className="section-title-row"><div><div className="panel-kicker">SYSTEM JOURNAL</div><h2>Recent events</h2></div><span className="event-stream-label"><span className="pulse-dot" /> STREAM</span></div>
              {events.length ? <div className="event-list scrollbar-thin max-h-96 overflow-y-auto">
                {events.slice(0, 15).map((event, index) => <EventLine event={event} key={str(event.id, `event-${index}`)} index={index} />)}
              </div> : <div className="quiet-empty event-empty"><Clock3 size={16} /><span>Waiting for simulation events. Coordination decisions and state changes appear here.</span></div>}
              <div className="panel-footnote"><span>EVENT BUS <b>CONNECTED</b></span><span>{events.length} RECORDS</span></div>
            </section>
          </div>

          <div className="bottom-grid">
            <section className="panel task-panel" id="section-tasks">
              <div className="section-title-row"><div><div className="panel-kicker">ORDER FLOW</div><h2>Active task queue</h2></div><span className="count-chip">{metrics.activeTasks ?? activeTasks.length} ACTIVE</span></div>
              <div className="task-table-wrap">
                <table className="data-table task-table">
                  <thead><tr><th>ORDER / SKU</th><th>ROUTE</th><th>PRIORITY</th><th>ASSIGNED AGENT</th><th>STATUS</th><th>ETA</th></tr></thead>
                  <tbody>{activeTasks.slice(0, 5).length ? activeTasks.slice(0, 5).map((task, index) => <tr key={str(task.id, `task-${index}`)} data-testid={`row-task-${str(task.id, String(index))}`}>
                    <td><b>{str(task.orderId, str(task.id))}</b><small>{str(task.sku, 'SKU pending')}</small></td>
                    <td><span className="route-readout">{str(task.pickup, '—')} <ArrowDownRight size={12} /> {str(task.destination, '—')}</span></td>
                    <td><span className={`priority-label priority-${priorityLabel(task.priority).toLowerCase()}`}>{priorityLabel(task.priority)}</span></td>
                    <td className="mono">{str(task.assignedRobotId, 'UNASSIGNED')}</td>
                    <td><span className={`status-chip ${statusTone(task.status)}`}>{str(task.status, 'QUEUED')}</span></td>
                    <td className="mono">{str(task.eta, '—')}</td>
                  </tr>) : <tr><td colSpan={6}><div className="table-empty task-empty"><Boxes size={18} /><strong>No work in queue</strong><span>Add an environment task to observe the fleet's autonomous assignment.</span></div></td></tr>}</tbody>
                </table>
              </div>
               <div className="task-note"><span><Target size={13} /> Task allocation is autonomous</span><span>NO ROBOT-LEVEL COMMANDS</span></div>
            </section>

            <section className="panel lab-panel" id="section-benchmark">
              <div className="panel-kicker">EVALUATION SUITE</div><h2>Simulation lab</h2>
              <p>Probe coordination resilience under repeatable warehouse conditions.</p>
              <div className="lab-actions">
                 <button type="button" onClick={() => runBenchmark()} data-testid="button-run-benchmark"><Gauge size={15} /><span><b>Run benchmark</b><small>{currentBenchmark ? `Seed ${currentBenchmark.seed} · measured` : 'Measure fleet performance'}</small></span><ArrowUpRight size={14} /></button>
                <button type="button" onClick={() => runStressTest()} data-testid="button-run-stress"><Activity size={15} /><span><b>Stress test</b><small>Escalating environment load</small></span><ArrowUpRight size={14} /></button>
                <button type="button" onClick={() => runDemo()} data-testid="button-run-demo"><Sparkles size={15} /><span><b>Guided demo</b><small>Showcase recovery sequence</small></span><ArrowUpRight size={14} /></button>
              </div>
              {currentBenchmark && <div className="benchmark-result" data-testid="benchmark-result">
                <div><TimerReset size={14} /> SEEDED COMPARISON · {str(currentBenchmark.seed)}</div>
                <strong>{Number(currentBenchmark.timeReduction).toFixed(1)}% less completion time</strong>
                <span>Stop-and-wait {Number(currentBenchmark.baseline?.completionTime).toFixed(1)}s ({currentBenchmark.baseline?.tasksCompleted}/12 tasks) · Distributed {Number(currentBenchmark.nexus?.completionTime).toFixed(1)}s ({currentBenchmark.nexus?.tasksCompleted}/12)</span>
              </div>}
              <div className="lab-meta"><span><ShieldCheck size={13} /> ENVIRONMENT-SCOPED ONLY</span><span>SIH 2026</span></div>
            </section>
          </div>
          <footer className="page-footer"><span>NEXUS-FLEET <b>v0.9.26</b> · BEL WAREHOUSE DIGITAL TWIN</span><span>BUILT FOR AUTONOMOUS COORDINATION <i /></span></footer>
        </div>
      </section>

      {/* Grocery Task Creation Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17221f] border border-[#283834] rounded-xl max-w-xl w-full p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#283834] pb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Boxes className="text-[#3db89a]" size={22} />
                  <span>Select Grocery Product Order</span>
                </h2>
                <p className="text-xs text-[#8aa39b] mt-1">Pick a product from storage racks; system automatically assigns nearest idle AMR</p>
              </div>
              <button type="button" onClick={() => setIsTaskModalOpen(false)} className="text-[#8aa39b] hover:text-white text-xl font-bold p-1">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {groceryProducts.map((product, idx) => {
                const isSelected = idx === selectedProductIndex;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductIndex(idx)}
                    className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-[#3db89a] bg-[#1f332c] shadow-lg ring-1 ring-[#3db89a]'
                        : 'border-[#283834] bg-[#111816]/60 hover:border-[#385249]'
                    }`}
                  >
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
            <div className="bg-[#192723] border border-[#2e4d43] rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8aa39b]">Target Shelf Rack:</span>
                <span className="font-mono text-[#3db89a] font-semibold">{selectedProduct.rack} ({selectedProduct.pickup})</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8aa39b]">Product SKU:</span>
                <span className="font-mono text-white text-[11px]">{selectedProduct.sku}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-[#2e4d43]">
                <span className="text-[#8aa39b]">Nearest Idle Robot:</span>
                <span className="font-mono font-bold text-amber-400 flex items-center gap-1 text-sm">
                  <Bot size={16} />
                  {nearestIdleRobot ? `${nearestIdleRobot.id} (${nearestIdleRobot.distanceMeters ?? '3.5'}m away)` : 'AMR-01'}
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
                onClick={handleDispatchTask}
                className="px-5 py-2 rounded-lg bg-[#2e8b75] hover:bg-[#38a38a] text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Plus size={16} />
                <span>Assign Task to {nearestIdleRobot?.id ?? 'AMR-01'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function RobotInspector({ robot }: { robot: Datum }) {
  const battery = Number(robot.battery);
  const eta = str(robot.eta, '—');
  const health = robot.health;
  const healthLabel = typeof health === 'object' && health ? str(health.status ?? health.state, 'Nominal') : str(health, 'Nominal');
  return <>
    <div className="inspector-intent"><div className="intent-stamp"><Target size={15} /></div><div><small>CURRENT INTENT</small><strong>{str(robot.intent, 'Awaiting assignment')}</strong></div></div>
    <div className="inspector-destination"><span>DESTINATION</span><strong>{str(robot.destination, '—')}</strong><span className="destination-eta"><Clock3 size={12} /> ETA {eta}</span></div>
    <div className="battery-meter">
      <div className="meter-header"><span><Battery size={13} /> BATTERY RESERVE</span><strong>{Number.isFinite(battery) ? `${battery}%` : '—'}</strong></div>
      <div className="meter-track"><i style={{ width: `${Math.min(100, Math.max(0, battery || 0))}%` }} className={battery < 25 ? 'low' : ''} /></div>
      <div className="meter-scale"><span>RETURN THRESHOLD 20%</span><span>100%</span></div>
    </div>
    <div className="inspector-specs">
      <div><span>ASSIGNED TASK</span><b className="mono">{str(robot.taskId, 'NONE')}</b></div>
      <div><span>COMMUNICATION</span><b><LinkQuality value={robot.communication} compact /></b></div>
      <div><span>HEALTH</span><b className={`health-state ${statusTone(healthLabel)}`}><i />{healthLabel}</b></div>
      <div><span>RECOVERY NOTE</span><b>{str(robot.reason, 'No active recovery')}</b></div>
    </div>
  </>;
}

function LinkQuality({ value, compact = false }: { value: unknown; compact?: boolean }) {
  const label = typeof value === 'object' && value ? str((value as Datum).status ?? (value as Datum).quality, 'ONLINE') : str(value, 'ONLINE');
  const numeric = typeof value === 'number' ? value : Number((value as Datum)?.quality ?? (value as Datum)?.strength);
  const tone = statusTone(label);
  const bars = Number.isFinite(numeric) ? Math.max(1, Math.min(4, Math.ceil(numeric / 25))) : /loss|weak|offline|poor/.test(label.toLowerCase()) ? 1 : 4;
  return <span className={`link-quality ${tone} ${compact ? 'compact-link' : ''}`} title={`Communication: ${label}`}><Signal size={12} /><i className="signal-bars">{[1, 2, 3, 4].map((bar) => <b key={bar} className={bar <= bars ? 'filled' : ''} />)}</i>{!compact && <small>{label}</small>}</span>;
}

function EventLine({ event, index }: { event: Datum; index: number }) {
  const type = str(event.type, 'STATE UPDATE');
  const bad = /failure|blocked|deadlock|conflict|loss|obstacle/i.test(type + str(event.reason, ''));
  const good = /complete|resolve|recover|assign/i.test(type + str(event.result, ''));
  return <div className="event-line" data-testid={`event-${str(event.id, String(index))}`}>
    <div className={`event-marker ${bad ? 'bad' : good ? 'good' : ''}`}>{bad ? <AlertOctagon size={12} /> : good ? <ShieldCheck size={12} /> : <Activity size={12} />}</div>
    <div className="event-copy"><div><b>{type.replaceAll('-', ' ').toUpperCase()}</b><span>{str(event.robotId, 'FLEET')}</span></div>
      <p>{str(event.reason, str(event.result, str(event.resource, 'Coordination state updated')))}</p>
      {event.resource && <span className="event-resource">{str(event.resource)}</span>}
    </div>
    <time className="mono">{shortTime(event.time)}</time>
  </div>;
}

export { FleetConsole };