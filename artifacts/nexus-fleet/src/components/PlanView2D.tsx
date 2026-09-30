import { useMemo } from 'react';
import { GLOBAL_WAREHOUSE_LAYOUT } from '../simulation/warehouseLayout';
import { worldToSvgPath } from '../simulation/coordinates';

type Datum = Record<string, any>;

interface PlanView2DProps {
  robots: Datum[];
  nodes?: Datum[];
  edges?: Datum[];
  reservations?: Datum[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  debugMode?: boolean;
}

function statusColor(status: string, intent?: string): string {
  const s = String(status ?? '').toUpperCase();
  const i = String(intent ?? '').toUpperCase();
  if (s.includes('FAIL') || s.includes('ERROR') || s.includes('BLOCKED')) return '#ef4444';
  if (s.includes('WAIT') || s.includes('YIELD') || s.includes('SAFETY')) return '#f59e0b';
  if (s.includes('PICK') || i.includes('PICK')) return '#a855f7';
  if (s.includes('DELIVER') || i.includes('DELIVER')) return '#3b82f6';
  if (i.includes('HOME') || i.includes('CHARGE') || s.includes('CHARGE')) return '#06b6d4';
  return '#10b981'; // IDLE / MOVING
}

export function PlanView2D({
  robots,
  nodes: propNodes,
  edges: propEdges,
  reservations = [],
  selectedId,
  onSelect,
  debugMode = false,
}: PlanView2DProps) {
  const layout = GLOBAL_WAREHOUSE_LAYOUT;
  const nodeMap = useMemo(() => {
    const map = new Map<string, Datum>();
    const nList = propNodes && propNodes.length > 0 ? propNodes : layout.nodes;
    nList.forEach((n) => map.set(n.id, n));
    return map;
  }, [propNodes, layout.nodes]);

  const edgeList = propEdges && propEdges.length > 0 ? propEdges : layout.edges;

  return (
    <div className="w-full h-full min-h-[480px] bg-[#0c1311] rounded-xl border border-[#233530] p-4 relative overflow-hidden flex flex-col items-center justify-center select-none">
      <div className="absolute top-3 left-4 text-xs font-mono text-[#7e9990] flex items-center gap-3 z-10 pointer-events-none">
        <span className="font-bold text-white tracking-wide">2D DIGITAL TWIN OPERATIONAL MAP</span>
        <span className="px-2 py-0.5 rounded bg-[#172723] text-[#3db89a] border border-[#28423b]">
          BOUNDS: 36m × 24m
        </span>
        {debugMode && (
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
            DEBUG ACTIVE
          </span>
        )}
      </div>

      <svg className="w-full h-full max-h-[640px]" viewBox="-19.5 -13.5 39 27">
        <defs>
          <pattern id="grid" width="2" height="2" patternUnits="userSpaceOnUse">
            <path d="M 2 0 L 0 0 0 2" fill="none" stroke="#162521" strokeWidth="0.05" />
          </pattern>
        </defs>

        {/* Warehouse Floor */}
        <rect x="-18" y="-12" width="36" height="24" fill="#111c18" stroke="#283e37" strokeWidth="0.3" rx="0.4" />
        <rect x="-18" y="-12" width="36" height="24" fill="url(#grid)" opacity="0.6" />

        {/* Outer Perimeter Walls */}
        {layout.walls.map((wall) => (
          <rect
            key={wall.id}
            x={wall.x - wall.width / 2}
            y={wall.y - wall.depth / 2}
            width={wall.width}
            height={wall.depth}
            fill="#1f2d29"
            stroke="#344d45"
            strokeWidth="0.1"
          />
        ))}

        {/* Aisle Corridors Surface Overlay */}
        {[-10, -6, -2, 2, 6, 10].map((y) => (
          <line key={`aisle-h-${y}`} x1="-16" y1={y} x2="16" y2={y} stroke="#172b25" strokeWidth="1.8" opacity="0.4" />
        ))}

        {/* Charging Bays / Home Slots */}
        {layout.chargingSlots.map((slot) => {
          const isDocked = robots.some(
            (r) => r.currentNode === slot.nodeId && (r.intent === 'CHARGING' || r.status === 'IDLE'),
          );
          return (
            <g key={slot.id} transform={`translate(${slot.x} ${slot.y})`}>
              <rect
                x="-1.1"
                y="-0.8"
                width="2.2"
                height="1.6"
                fill={isDocked ? '#09322c' : '#142520'}
                stroke={isDocked ? '#3db89a' : '#27443d'}
                strokeWidth="0.12"
                rx="0.2"
              />
              <circle r="0.45" fill="none" stroke="#3db89a" strokeWidth="0.08" strokeDasharray="0.2 0.1" />
              <text y="-0.1" fontSize="0.35" fill="#3db89a" fontWeight="bold" textAnchor="middle" className="font-mono">
                {slot.id}
              </text>
              <text y="0.4" fontSize="0.25" fill="#8aa39b" textAnchor="middle" className="font-mono">
                {slot.assignedRobotId}
              </text>
            </g>
          );
        })}

        {/* Stations (Packing & Inbound) */}
        {layout.stations.map((st) => (
          <g key={st.id} transform={`translate(${st.x} ${st.y})`}>
            <rect
              x="-1.3"
              y="-1.0"
              width="2.6"
              height="2.0"
              fill={st.kind === 'packing' ? '#143029' : '#2b2316'}
              stroke={st.kind === 'packing' ? '#3db89a' : '#ad8957'}
              strokeWidth="0.15"
              rx="0.3"
            />
            <text y="-0.2" fontSize="0.38" fill="#ffffff" fontWeight="extrabold" textAnchor="middle" className="font-mono">
              {st.id}
            </text>
            <text y="0.35" fontSize="0.24" fill="#a4c2b7" textAnchor="middle" className="font-mono">
              {st.label}
            </text>
          </g>
        ))}

        {/* Physical Storage Racks / Shelves */}
        {layout.shelves.map((shelf) => (
          <g key={shelf.id} transform={`translate(${shelf.x} ${shelf.y})`}>
            {/* Shelf Body Bounding Box */}
            <rect
              x={-shelf.width / 2}
              y={-shelf.depth / 2}
              width={shelf.width}
              height={shelf.depth}
              fill="#1e2c28"
              stroke="#344e47"
              strokeWidth="0.12"
              rx="0.15"
            />
            {/* Internal Shelf Bin Dividers */}
            {[-0.8, 0, 0.8].map((dx) => (
              <line
                key={dx}
                x1={dx}
                y1={-shelf.depth / 2 + 0.1}
                x2={dx}
                y2={shelf.depth / 2 - 0.1}
                stroke="#2a3f39"
                strokeWidth="0.05"
              />
            ))}
            {/* Shelf Label & SKU */}
            <text y="-0.08" fontSize="0.32" fill="#cbe3db" fontWeight="bold" textAnchor="middle" className="font-mono">
              {shelf.label.replace('Rack ', '')}
            </text>
            <text y="0.3" fontSize="0.20" fill="#6d8a81" textAnchor="middle" className="font-mono">
              {shelf.sku.split('-')[1] ?? ''}
            </text>

            {/* Approach / Pickup Point Indicator outside shelf */}
            <circle
              cx={0}
              cy={shelf.accessibleSide === 'south' ? shelf.depth / 2 + 0.4 : -shelf.depth / 2 - 0.4}
              r="0.16"
              fill="#a855f7"
              opacity="0.8"
            />
          </g>
        ))}

        {/* Debug Navigation Graph Overlay */}
        {debugMode && (
          <g opacity="0.85">
            {/* Navigation Edges */}
            {edgeList.map((edge: any) => {
              const from = nodeMap.get(edge.from_node ?? edge.from);
              const to = nodeMap.get(edge.to_node ?? edge.to);
              if (!from || !to) return null;
              return (
                <line
                  key={edge.id}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={edge.blocked ? '#ef4444' : '#26594d'}
                  strokeWidth="0.08"
                  strokeDasharray={edge.blocked ? '0.2 0.2' : undefined}
                />
              );
            })}
            {/* Navigation Nodes */}
            {Array.from(nodeMap.values()).map((node) => (
              <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                <circle
                  r="0.22"
                  fill={
                    node.kind === 'packing'
                      ? '#3db89a'
                      : node.kind === 'charger'
                        ? '#38bdf8'
                        : node.kind === 'loading'
                          ? '#f59e0b'
                          : '#25473e'
                  }
                />
                <text y="-0.32" fontSize="0.22" fill="#75998f" textAnchor="middle" className="font-mono">
                  {node.id}
                </text>
              </g>
            ))}
            {/* Reservations */}
            {reservations.map((res, i) => {
              const node = nodeMap.get(res.resourceId);
              if (!node) return null;
              return (
                <circle
                  key={i}
                  cx={node.x}
                  cy={node.y}
                  r="0.45"
                  fill="none"
                  stroke="#bd8425"
                  strokeWidth="0.08"
                  strokeDasharray="0.1 0.1"
                />
              );
            })}
          </g>
        )}

        {/* Robot Routes */}
        {robots.map((robot) => {
          const routeIds: string[] = Array.isArray(robot.route) ? robot.route : [];
          if (routeIds.length <= 1) return null;
          const points: { x: number; y: number }[] = [
            { x: Number(robot.x ?? 0), y: Number(robot.y ?? 0) },
            ...routeIds
              .map((id) => nodeMap.get(id))
              .filter((n): n is Datum => Boolean(n))
              .map((n) => ({ x: Number(n.x), y: Number(n.y) })),
          ];
          const color = statusColor(robot.status, robot.intent);
          return (
            <path
              key={`route-${robot.id}`}
              d={worldToSvgPath(points)}
              fill="none"
              stroke={color}
              strokeWidth={String(robot.id) === selectedId ? '0.22' : '0.14'}
              strokeDasharray="0.4 0.2"
              opacity="0.85"
            />
          );
        })}

        {/* AMRs / Robots */}
        {robots.map((robot) => {
          const rId = String(robot.id);
          const isSelected = rId === selectedId;
          const rx = Number(robot.x ?? 0);
          const ry = Number(robot.y ?? 0);
          const heading = Number(robot.heading ?? 0);
          const color = statusColor(robot.status, robot.intent);

          return (
            <g
              key={rId}
              transform={`translate(${rx} ${ry})`}
              onClick={() => onSelect(rId)}
              className="cursor-pointer"
            >
              {/* Safety Radius Ring (Debug Mode / Selection) */}
              {(debugMode || isSelected) && (
                <circle r="1.15" fill="none" stroke={color} strokeWidth="0.06" opacity="0.6" strokeDasharray="0.2 0.15" />
              )}

              {/* Selection Halo */}
              {isSelected && <circle r="0.9" fill="#f59e0b" opacity="0.25" />}

              {/* AMR Cart Body (Footprint: 1.18m x 0.86m) */}
              <g transform={`rotate(${(-heading * 180) / Math.PI})`}>
                <rect
                  x="-0.59"
                  y="-0.43"
                  width="1.18"
                  height="0.86"
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="0.08"
                  rx="0.18"
                />
                {/* Heading Nose Arrow */}
                <polygon points="0.59,0 0.35,-0.22 0.35,0.22" fill="#ffffff" />
                {/* Rear LiDAR Turret */}
                <circle cx="-0.4" cy="0" r="0.14" fill="#182723" />
              </g>

              {/* Compact Robot ID & Status Label */}
              <g transform="translate(0, -0.7)">
                <rect x="-0.8" y="-0.3" width="1.6" height="0.4" fill="#0f1916" opacity="0.85" rx="0.1" stroke="#253d36" strokeWidth="0.04" />
                <text y="-0.02" fontSize="0.24" fill="#ffffff" fontWeight="bold" textAnchor="middle" className="font-mono">
                  {rId}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
