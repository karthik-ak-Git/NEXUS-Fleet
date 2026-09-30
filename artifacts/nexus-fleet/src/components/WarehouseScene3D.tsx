import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { GLOBAL_WAREHOUSE_LAYOUT } from "../simulation/warehouseLayout";

type Datum = Record<string, any>;

const robotColor = (status: unknown) => {
  const text = String(status ?? "").toLowerCase();
  if (/failed|blocked|lost/.test(text)) return "#b6493f";
  if (/yield|wait|negotiat|rerout|recover|charge/.test(text)) return "#d49b34";
  if (/complete|idle/.test(text)) return "#7a9183";
  return "#1d927d";
};

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LabelSprite({
  position,
  text,
  tone = "neutral",
  size = [1.8, 0.42],
}: {
  position: [number, number, number];
  text: string;
  tone?: "neutral" | "station" | "robot" | "blocked" | "reservation";
  size?: [number, number];
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const palette = {
        neutral: { bg: "#f4f2e8", fg: "#42564d", border: "#9eaa9d" },
        station: { bg: "#31594f", fg: "#f4f0dd", border: "#6e9080" },
        robot: { bg: "#f4f2e8", fg: "#314b43", border: "#aeb8a8" },
        blocked: { bg: "#f7e9db", fg: "#973f36", border: "#c98977" },
        reservation: { bg: "#f6f0df", fg: "#725920", border: "#cbb579" },
      }[tone];
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = palette.bg;
      context.strokeStyle = palette.border;
      context.lineWidth = 5;
      context.beginPath();
      context.roundRect(8, 8, 496, 112, 8);
      context.fill();
      context.stroke();
      context.fillStyle = palette.fg;
      context.font = tone === "robot" ? "600 31px monospace" : "600 28px monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text.slice(0, 30), 256, 64);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [text, tone]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[size[0], size[1], 1]} renderOrder={10}>
      <spriteMaterial
        map={texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[42, 28]} />
        <meshStandardMaterial color="#d9d7c9" roughness={0.88} />
      </mesh>
      <gridHelper args={[40, 40, "#89968c", "#c3c3b5"]} position={[0, -0.105, 0]} />
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <boxGeometry args={[42.5, 0.3, 28.5]} />
        <meshStandardMaterial color="#9b9d91" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[38, 24]} />
        <meshStandardMaterial color="#dfddcf" roughness={0.96} />
      </mesh>
      {[-10, -6, -2, 2, 6, 10].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, z]}>
          <planeGeometry args={[37, 0.055]} />
          <meshStandardMaterial color="#b2b5a8" roughness={0.8} />
        </mesh>
      ))}
      {[-18.5, 18.5].map((x) => (
        <mesh key={x} position={[x, 1.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.3, 2.3, 26]} />
          <meshStandardMaterial color="#b8b9ad" roughness={0.78} />
        </mesh>
      ))}
      {[-12.5, 12.5].map((z) => (
        <mesh key={z} position={[0, 1.15, z]} castShadow receiveShadow>
          <boxGeometry args={[37.5, 2.3, 0.28]} />
          <meshStandardMaterial color="#c0c0b4" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Rack({ x, z, id }: { x: number; z: number; id: string }) {
  const bins = ["#b67b45", "#87988f", "#d5b85e", "#6d8790"];
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.65, 2.1, 0.82]} />
        <meshStandardMaterial color="#435c58" roughness={0.75} metalness={0.2} />
      </mesh>
      {[-1.12, 0, 1.12].map((xOffset, index) => (
        <mesh key={xOffset} position={[xOffset, 1.05, 0.43]} castShadow>
          <boxGeometry args={[0.08, 2.25, 0.08]} />
          <meshStandardMaterial color={index === 1 ? "#b69048" : "#243f3c"} metalness={0.35} roughness={0.44} />
        </mesh>
      ))}
      {[0.38, 1.05, 1.72].map((y, shelfIndex) => (
        <group key={y}>
          <mesh position={[0, y, 0]} castShadow>
            <boxGeometry args={[2.55, 0.075, 0.9]} />
            <meshStandardMaterial color="#bc9b5f" metalness={0.18} roughness={0.6} />
          </mesh>
          {[-0.73, 0, 0.73].map((xOffset, binIndex) => (
            <mesh key={xOffset} position={[xOffset, y + 0.23, -0.02]} castShadow>
              <boxGeometry args={[0.58, 0.34, 0.65]} />
              <meshStandardMaterial color={bins[(shelfIndex + binIndex) % bins.length]} roughness={0.87} />
            </mesh>
          ))}
        </group>
      ))}
      <LabelSprite position={[0, 2.3, 0]} text={id} size={[0.9, 0.22]} />
    </group>
  );
}

function WarehouseRacks({ debugMode }: { debugMode?: boolean }) {
  const layout = GLOBAL_WAREHOUSE_LAYOUT;
  return (
    <group>
      {layout.shelves.map((shelf) => (
        <group key={shelf.id}>
          <Rack x={shelf.x} z={shelf.y} id={shelf.id} />
          {/* Subtle Approach / Pickup Point Marker outside shelf on aisle centerline */}
          <mesh position={[shelf.pickupPoint.x, 0.04, shelf.pickupPoint.y]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.35, 24]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.7} />
          </mesh>
          {debugMode && (
            <mesh position={[shelf.x, 1.2, shelf.y]}>
              <boxGeometry args={[shelf.width, shelf.height, shelf.depth]} />
              <meshBasicMaterial color="#ef4444" wireframe />
            </mesh>
          )}
        </group>
      ))}

      {/* Perimeter Support Pillars */}
      {[
        [-17.5, -11.5], [17.5, -11.5], [-17.5, 11.5], [17.5, 11.5],
        [-17.5, 0], [17.5, 0], [0, -12], [0, 12],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 1.45, z]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 2.9, 0.42]} />
          <meshStandardMaterial color="#7a817a" metalness={0.18} roughness={0.65} />
        </mesh>
      ))}

      {/* Stations */}
      <Station position={[-16, 0, -2]} label="INBOUND" tint="#a88951" />
      <Station position={[16, 0, -2]} label="PACK / OUT" tint="#4e8277" />

      {/* 6 Home Charging Bays */}
      {layout.chargingSlots.map((slot) => (
        <ChargingBay key={slot.id} slot={slot} />
      ))}
    </group>
  );
}

function ChargingBay({ slot }: { slot: typeof GLOBAL_WAREHOUSE_LAYOUT.chargingSlots[0] }) {
  const zOffset = slot.y < 0 ? -0.7 : 0.7;
  return (
    <group position={[slot.x, 0, slot.y]}>
      {/* Floor Dock Pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[2.2, 1.6]} />
        <meshStandardMaterial color="#142520" roughness={0.6} />
      </mesh>
      {/* Floor Dock Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.3, 0.5, 24]} />
        <meshBasicMaterial color="#3db89a" transparent opacity={0.8} />
      </mesh>
      {/* Charger Tower */}
      <mesh position={[0, 0.75, zOffset]} castShadow>
        <boxGeometry args={[0.6, 1.5, 0.25]} />
        <meshStandardMaterial color="#2d423c" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* LED Indicator */}
      <mesh position={[0, 1.35, zOffset * 0.8]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#3db89a" />
      </mesh>
      <LabelSprite position={[0, 1.8, 0]} text={`${slot.id} · ${slot.assignedRobotId}`} tone="station" size={[1.4, 0.28]} />
    </group>
  );
}

function Station({ position, label, tint }: { position: [number, number, number]; label: string; tint: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.13, 0]} receiveShadow>
        <boxGeometry args={[2.1, 0.16, 1.55]} />
        <meshStandardMaterial color={tint} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[1.6, 1.35, 0.12]} />
        <meshStandardMaterial color="#38534e" roughness={0.55} metalness={0.18} />
      </mesh>
      <LabelSprite position={[0, 1.75, 0]} text={label} tone="station" size={[1.3, 0.3]} />
    </group>
  );
}

function DockingZoneMat({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <planeGeometry args={[2.4, 1.8]} />
        <meshStandardMaterial color="#1a423a" roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[0.35, 0.65, 32]} />
        <meshBasicMaterial color="#3db89a" transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color="#e3c066" />
      </mesh>
      <LabelSprite position={[0, 0.6, 0]} text="DOCK ZONE · PACK-02" tone="station" size={[1.5, 0.28]} />
    </group>
  );
}

function DebugGraphOverlay({ nodes, edges, debugMode }: { nodes: Map<string, Datum>; edges: Datum[]; debugMode: boolean }) {
  if (!debugMode) return null;
  const nodeList = Array.from(nodes.values());
  return (
    <group>
      {nodeList.map((node) => (
        <group key={node.id} position={[node.x, 0.08, node.y]}>
          <mesh>
            <sphereGeometry args={[0.18, 16, 16]} />
            <meshBasicMaterial color={node.kind === "packing" ? "#3db89a" : node.kind === "charger" ? "#38bdf8" : "#2e8b75"} />
          </mesh>
          <LabelSprite position={[0, 0.45, 0]} text={`${node.id} (${node.x},${node.y})`} tone="neutral" size={[1.4, 0.28]} />
        </group>
      ))}

      {edges.map((edge) => {
        const from = nodes.get(edge.from_node ?? edge.from);
        const to = nodes.get(edge.to_node ?? edge.to);
        if (!from || !to) return null;
        return (
          <Line
            key={edge.id ?? `${from.id}-${to.id}`}
            points={[[from.x, 0.08, from.y], [to.x, 0.08, to.y]]}
            color="#2e8b75"
            lineWidth={1.5}
            transparent
            opacity={0.5}
          />
        );
      })}
    </group>
  );
}

function Robot({ robot, nodes, selected, onSelect, debugMode }: {
  robot: Datum;
  nodes: Map<string, Datum>;
  selected: boolean;
  onSelect: () => void;
  debugMode?: boolean;
}) {
  const color = robotColor(robot.status);
  const routePoints = (Array.isArray(robot.route) ? robot.route : [])
    .map((id: string) => nodes.get(id))
    .filter(Boolean)
    .map((node: Datum) => [node.x, 0.18, node.y] as [number, number, number]);
  const route = [[robot.x, 0.18, robot.y] as [number, number, number], ...routePoints];

  // Dynamic vertical carriage height & forklift arm extension
  const isPickingPhase =
    robot.intent === "PICK" ||
    String(robot.status).includes("PICKING") ||
    (String(robot.status).includes("NEGOTIATING") && robot.intent === "PICK");

  const isDeliveringPhase =
    robot.intent === "DELIVER" ||
    String(robot.status).includes("DELIVERING");

  const liftHeight = isPickingPhase
    ? 0.55 + Math.abs(Math.sin(Number(robot.x ?? 0) * 2.0)) * 0.65
    : isDeliveringPhase
      ? 0.35
      : 0.22;

  // Forklift arm extends sideways towards shelf when picking
  const armExtension = isPickingPhase ? 0.68 : 0.08;

  // Packages are only carried AFTER picking item from shelf
  const isCarryingPackage = isDeliveringPhase || (Boolean(robot.currentTaskId) && !isPickingPhase);

  return (
    <group>
      {route.length > 1 && (
        <Line points={route} color={selected ? "#bd8425" : "#198b77"} lineWidth={selected ? 2 : 1.2} dashed dashSize={0.35} gapSize={0.22} transparent opacity={0.78} />
      )}
      {selected && (
        <mesh position={[robot.x, 0.045, robot.y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.78, 0.88, 48]} />
          <meshBasicMaterial color="#bd8425" transparent opacity={0.78} />
        </mesh>
      )}
      <group
        position={[robot.x, 0.32, robot.y]}
        rotation={[0, -Number(robot.heading ?? 0), 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        {/* Drive Base Chassis (SOLO Style Cart Base) */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.18, 0.34, 0.86]} />
          <meshStandardMaterial color={color} roughness={0.52} metalness={0.22} />
        </mesh>
        
        {/* Bottom Safety LED Strip (Green/Status Glow) */}
        <mesh position={[0, -0.14, 0]} castShadow>
          <boxGeometry args={[1.19, 0.05, 0.87]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
        </mesh>

        {/* Straight Vertical Mast / Twin Mast Rod Pillars */}
        <group position={[-0.28, 0.8, 0]}>
          {[-0.26, 0.26].map((zOffset) => (
            <mesh key={zOffset} position={[0, 0, zOffset]} castShadow>
              <cylinderGeometry args={[0.032, 0.032, 1.6, 14]} />
              <meshStandardMaterial color="#c0c5c1" metalness={0.85} roughness={0.2} />
            </mesh>
          ))}
          {/* Top Mast Crossbar Cap */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[0.09, 0.05, 0.58]} />
            <meshStandardMaterial color="#3a4844" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>

        {/* Vertical Lift Carriage Mechanism & Forklift Extension Arm */}
        <group position={[-0.22, liftHeight, 0]}>
          {/* Carriage Frame */}
          <mesh castShadow>
            <boxGeometry args={[0.32, 0.08, 0.62]} />
            <meshStandardMaterial color="#2d3936" metalness={0.65} roughness={0.35} />
          </mesh>
          {/* Forklift Extractor Gripper Arms (Extends sideways to reach shelf) */}
          <mesh position={[0.18 + armExtension, 0.02, 0]} castShadow>
            <boxGeometry args={[0.34, 0.04, 0.52]} />
            <meshStandardMaterial color="#d4b45d" metalness={0.55} roughness={0.35} />
          </mesh>

          {/* Grocery Package Container Tote (Rides carriage after pickup) */}
          {isCarryingPackage && (
            <group position={[0.1, 0.19, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[0.48, 0.3, 0.44]} />
                <meshStandardMaterial color="#ad8957" roughness={0.85} metalness={0.1} />
              </mesh>
              {/* Package SKU Label */}
              <mesh position={[0.25, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.22, 0.14]} />
                <meshBasicMaterial color="#f0ecda" />
              </mesh>
            </group>
          )}
        </group>

        {/* Directional Sensor Nose Cone */}
        <mesh position={[0.69, 0.03, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[0.16, 0.38, 3]} />
          <meshStandardMaterial color="#f0c15b" roughness={0.4} />
        </mesh>

        {/* Top LiDAR Sensor Turret & Beacon Indicator */}
        <mesh position={[-0.42, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.12, 20]} />
          <meshStandardMaterial color="#3a4946" metalness={0.72} roughness={0.24} />
        </mesh>
        <mesh position={[-0.42, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 14]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>

        {/* 4 Wheels at Base Chassis */}
        {[-0.36, 0.36].flatMap((z) =>
          [-0.38, 0.38].map((x) => (
            <mesh key={`${x}-${z}`} position={[x, -0.12, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.1, 14]} />
              <meshStandardMaterial color="#24312f" roughness={0.86} />
            </mesh>
          )),
        )}

        {/* Developer Debug Wireframe & Heading Vector Arrow */}
        {debugMode && (
          <group>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[1.22, 0.45, 0.90]} />
              <meshBasicMaterial color="#3db89a" wireframe />
            </mesh>
            <mesh position={[0.75, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.08, 0.5, 12]} />
              <meshBasicMaterial color="#f59e0b" />
            </mesh>
          </group>
        )}
      </group>

      <LabelSprite
        position={[robot.x, 1.95, robot.y]}
        text={`${robot.id} · ${String(robot.status ?? "IDLE").replaceAll("_", " ")}`}
        tone="robot"
        size={[2.1, 0.44]}
      />
    </group>
  );
}

function ResourceOverlays({ edges, nodes, reservations, obstacles }: {
  edges: Datum[];
  nodes: Map<string, Datum>;
  reservations: Datum[];
  obstacles: Datum[];
}) {
  return (
    <group>
      {edges.filter((edge) => edge.blocked).map((edge) => {
        const from = nodes.get(edge.from);
        const to = nodes.get(edge.to);
        if (!from || !to) return null;
        const midpoint: [number, number, number] = [(from.x + to.x) / 2, 0.22, (from.y + to.y) / 2];
        const barrierRotation = Math.atan2(to.y - from.y, to.x - from.x);
        return (
          <group key={edge.id}>
            <Line points={[[from.x, 0.15, from.y], [to.x, 0.15, to.y]]} color="#b84a42" lineWidth={6} transparent opacity={0.6} />
            <group position={midpoint} rotation={[0, -barrierRotation, 0]}>
              {[-0.65, 0.65].map((x) => (
                <mesh key={x} position={[x, 0.45, 0]} castShadow>
                  <boxGeometry args={[0.16, 0.9, 0.18]} />
                  <meshStandardMaterial color="#b84a42" />
                </mesh>
              ))}
              <mesh position={[0, 0.45, 0]} castShadow>
                <boxGeometry args={[1.65, 0.18, 0.2]} />
                <meshStandardMaterial color="#e3c066" />
              </mesh>
            </group>
            <LabelSprite position={midpoint} text={`BLOCKED · ${edge.id}`} tone="blocked" size={[1.8, 0.38]} />
          </group>
        );
      })}
      {reservations.map((reservation) => {
        const node = nodes.get(reservation.resourceId);
        if (!node) return null;
        return (
          <group key={reservation.id}>
            <mesh position={[node.x, 0.06, node.y]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.58, 0.66, 40]} />
              <meshBasicMaterial color="#c49436" transparent opacity={0.84} />
            </mesh>
            <LabelSprite
              position={[node.x, 0.4, node.y]}
              text={`${reservation.ownerRobot} · RESERVED`}
              tone="reservation"
              size={[1.8, 0.34]}
            />
          </group>
        );
      })}
      {obstacles.map((obstacle) => (
        <group key={obstacle.id} position={[obstacle.x, 0, obstacle.y]}>
          <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.72, 0.72, 0.72]} />
            <meshStandardMaterial color={obstacle.type === "FORKLIFT" ? "#bd6b35" : "#a98a5b"} roughness={0.86} />
          </mesh>
          <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.72, 36]} />
            <meshBasicMaterial color="#b74b43" transparent opacity={0.75} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function InterlinkConnections({ robots }: { robots: Datum[] }) {
  const activeRobots = useMemo(
    () => robots.filter((r) => String(r.health ?? "").toUpperCase() !== "FAILED" && String(r.communication ?? "").toUpperCase() !== "OFFLINE"),
    [robots],
  );
  const links = useMemo(() => {
    const result: [Datum, Datum][] = [];
    for (let i = 0; i < activeRobots.length; i += 1) {
      for (let j = i + 1; j < activeRobots.length; j += 1) {
        const r1 = activeRobots[i];
        const r2 = activeRobots[j];
        const dist = Math.hypot(Number(r1.x ?? 0) - Number(r2.x ?? 0), Number(r1.y ?? 0) - Number(r2.y ?? 0));
        const r1Active = r1.status && r1.status !== "IDLE" && r1.status !== "CHARGING";
        const r2Active = r2.status && r2.status !== "IDLE" && r2.status !== "CHARGING";
        if (dist <= 5.0 && (r1Active || r2Active)) {
          result.push([r1, r2]);
        }
      }
    }
    return result;
  }, [activeRobots]);

  return (
    <group>
      {links.map(([r1, r2]) => (
        <Line
          key={`${r1.id}-${r2.id}`}
          points={[
            [Number(r1.x ?? 0), 0.35, Number(r1.y ?? 0)],
            [Number(r2.x ?? 0), 0.35, Number(r2.y ?? 0)],
          ]}
          color="#3db89a"
          lineWidth={0.8}
          dashed
          dashSize={0.4}
          gapSize={0.3}
          transparent
          opacity={0.38}
        />
      ))}
    </group>
  );
}

function CameraRig({ selectedRobot, follow, topView, resetToken }: {
  selectedRobot: Datum | null;
  follow: boolean;
  topView: boolean;
  resetToken: number;
}) {
  const { camera, controls } = useThree() as any;
  const lastReset = useRef(resetToken);
  useFrame(() => {
    const orbit = controls as { target: THREE.Vector3; update: () => void } | undefined;
    if (lastReset.current !== resetToken) {
      lastReset.current = resetToken;
      camera.position.set(23, 23, 25);
      orbit?.target.set(0, 0, 0);
      orbit?.update();
    }
    if (topView) {
      camera.position.lerp(new THREE.Vector3(0, 35, 0.01), 0.035);
      orbit?.target.lerp(new THREE.Vector3(0, 0, 0), 0.035);
      orbit?.update();
      return;
    }
    if (follow && selectedRobot) {
      const target = new THREE.Vector3(selectedRobot.x, 0, selectedRobot.y);
      const cameraTarget = new THREE.Vector3(selectedRobot.x + 11, 14, selectedRobot.y + 13);
      camera.position.lerp(cameraTarget, 0.035);
      orbit?.target.lerp(target, 0.045);
      orbit?.update();
    }
  });
  return null;
}

function WarehousePlanFallback({
  robots,
  nodes,
  edges,
  obstacles,
  reservations,
  selectedId,
  onSelect,
}: {
  robots: Datum[];
  nodes: Datum[];
  edges: Datum[];
  obstacles: Datum[];
  reservations: Datum[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const project = (x: number, y: number) => ({
    x: 42 + ((x + 14) / 28) * 816,
    y: 28 + ((y + 10) / 20) * 444,
  });
  const racks = [-6, -1.5, 3, 7.5].flatMap((x) =>
    [-6.1, -1.55, 3.1].map((y) => ({ x, y })),
  );

  return (
    <div className="warehouse-plan-fallback">
      <svg viewBox="0 0 900 500" role="img" aria-label="Live warehouse floor plan fallback">
        <rect width="900" height="500" fill="#d9d8cd" />
        <rect x="25" y="20" width="850" height="460" fill="#e4e2d5" stroke="#8e9a8d" strokeDasharray="4 5" />
        {[-8, -4, 0, 4, 8].map((y) => {
          const point = project(0, y);
          return <line key={y} x1="40" y1={point.y} x2="860" y2={point.y} stroke="#bdc0b3" strokeDasharray="6 7" />;
        })}
        {edges.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const a = project(from.x, from.y);
          const b = project(to.x, to.y);
          return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edge.blocked ? "#b84940" : "#aeb7aa"} strokeWidth={edge.blocked ? 7 : 1} strokeDasharray={edge.blocked ? "5 4" : undefined} opacity={edge.blocked ? 0.9 : 0.55} />;
        })}
        {racks.map((rack, index) => {
          const p = project(rack.x, rack.y);
          return (
            <g key={`rack-${index}`}>
              <rect x={p.x - 38} y={p.y - 9} width="76" height="18" rx="2" fill="#70857a" stroke="#435c58" />
              <path d={`M${p.x - 22} ${p.y - 8}V${p.y + 8}M${p.x} ${p.y - 8}V${p.y + 8}M${p.x + 22} ${p.y - 8}V${p.y + 8}`} stroke="#d0b372" strokeWidth="2" />
              <text x={p.x} y={p.y + 2.5} textAnchor="middle" fill="#f0ecda" fontSize="7" fontFamily="monospace">R-{String(index + 1).padStart(2, "0")}</text>
            </g>
          );
        })}
        <g>
          <rect x="35" y="220" width="64" height="46" fill="#b69858" opacity=".88" />
          <text x="67" y="246" textAnchor="middle" fill="#fff6df" fontSize="8" fontFamily="monospace">INBOUND</text>
          <rect x="801" y="220" width="64" height="46" fill="#4e8277" opacity=".92" />
          <text x="833" y="246" textAnchor="middle" fill="#fff6df" fontSize="8" fontFamily="monospace">PACK / OUT</text>
        </g>
        {reservations.map((reservation) => {
          const node = nodeMap.get(reservation.resourceId);
          if (!node) return null;
          const p = project(node.x, node.y);
          return <circle key={reservation.id} cx={p.x} cy={p.y} r="12" fill="none" stroke="#b88a2f" strokeWidth="2" strokeDasharray="3 3" />;
        })}
        {obstacles.map((obstacle) => {
          const p = project(obstacle.x, obstacle.y);
          return <g key={obstacle.id}><rect x={p.x - 8} y={p.y - 8} width="16" height="16" fill="#b6493f" /><path d={`M${p.x - 5} ${p.y - 5}L${p.x + 5} ${p.y + 5}M${p.x + 5} ${p.y - 5}L${p.x - 5} ${p.y + 5}`} stroke="white" strokeWidth="2" /></g>;
        })}
        {robots.map((robot) => {
          const p = project(robot.x, robot.y);
          const color = robotColor(robot.status);
          const route = (Array.isArray(robot.route) ? robot.route : [])
            .map((id: string) => nodeMap.get(id))
            .filter(Boolean)
            .map((node: Datum) => project(node.x, node.y));
          const points = [p, ...route].map((point) => `${point.x},${point.y}`).join(" ");
          return (
            <g key={robot.id} onClick={() => onSelect(robot.id)} style={{ cursor: "pointer" }}>
              {route.length > 0 && <polyline points={points} fill="none" stroke={robot.id === selectedId ? "#b68125" : "#168571"} strokeWidth="2" strokeDasharray="5 4" />}
              <circle cx={p.x} cy={p.y} r={robot.id === selectedId ? 12 : 9} fill={color} stroke="#f7f4e9" strokeWidth="2" />
              <text x={p.x} y={p.y - 14} textAnchor="middle" fill="#304840" stroke="#eceadd" strokeWidth="3" paintOrder="stroke" fontSize="9" fontWeight="bold" fontFamily="monospace">{robot.id}</text>
              <path d="M0 -5L4 3H-4Z" fill="#fff6df" transform={`translate(${p.x} ${p.y}) rotate(${-(Number(robot.heading) * 180 / Math.PI)})`} />
            </g>
          );
        })}
      </svg>
      <div className="scene-fallback-banner">LIVE FLOOR PLAN · 3D GRAPHICS UNAVAILABLE</div>
    </div>
  );
}

export function WarehouseScene3D({
  robots,
  nodes,
  edges,
  obstacles,
  reservations,
  selectedId,
  onSelect,
  follow,
  topView,
  resetToken,
  debugMode = false,
}: {
  robots: Datum[];
  nodes: Datum[];
  edges: Datum[];
  obstacles: Datum[];
  reservations: Datum[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  follow: boolean;
  topView: boolean;
  resetToken: number;
  debugMode?: boolean;
}) {
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const selected = robots.find((robot) => robot.id === selectedId) ?? null;
  const fallback = (
    <WarehousePlanFallback
      robots={robots}
      nodes={nodes}
      edges={edges}
      obstacles={obstacles}
      reservations={reservations}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );

  return (
    <div className="warehouse-3d relative">
      <SceneErrorBoundary fallback={fallback}>
        <Canvas shadows="basic" dpr={[1, 1.65]} camera={{ position: [23, 23, 25], fov: 39, near: 0.1, far: 140 }}>
          <color attach="background" args={["#d5d4c8"]} />
          <fog attach="fog" args={["#d5d4c8", 34, 75]} />
          <ambientLight intensity={1.45} />
          <hemisphereLight args={["#f5e9c9", "#64756b", 1.1]} />
          <directionalLight
            position={[12, 20, 13]}
            intensity={2}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-24}
            shadow-camera-right={24}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
          />
          <Floor />
          <WarehouseRacks debugMode={debugMode} />
          <DockingZoneMat position={[16, 0, -2]} />
          <DebugGraphOverlay nodes={nodeMap} edges={edges} debugMode={debugMode} />
          <ResourceOverlays edges={edges} nodes={nodeMap} reservations={reservations} obstacles={obstacles} />
          <InterlinkConnections robots={robots} />
          {robots.map((robot) => (
            <Robot
              key={robot.id}
              robot={robot}
              nodes={nodeMap}
              selected={robot.id === selectedId}
              onSelect={() => onSelect(robot.id)}
              debugMode={debugMode}
            />
          ))}
          <CameraRig selectedRobot={selected} follow={follow} topView={topView} resetToken={resetToken} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            minDistance={13}
            maxDistance={60}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 0, 0]}
          />
        </Canvas>
        <div className="scene-hud scene-hud-north">N ↑</div>
        <div className="scene-hud scene-hud-scale">WAREHOUSE SCALE · 1 UNIT / 1 M</div>

        {/* Developer Digital-Twin Telemetry HUD Overlay (Requirement 12 & 19) */}
        {debugMode && (
          <div className="absolute top-3 right-3 bg-[#111816]/90 backdrop-blur border border-[#3db89a]/50 text-emerald-300 p-3 rounded-lg text-xs font-mono shadow-2xl max-w-xs space-y-1.5 z-20">
            <div className="flex items-center justify-between border-b border-[#283834] pb-1 font-bold text-white">
              <span>DIGITAL TWIN TELEMETRY</span>
              <span className="text-[10px] bg-[#2e8b75] text-white px-1.5 py-0.5 rounded">10 Hz LIVE</span>
            </div>
            {selected ? (
              <div className="space-y-1">
                <div>Robot ID: <strong className="text-white">{selected.id}</strong></div>
                <div>Backend (X, Y): <span className="text-white">({Number(selected.x).toFixed(2)}, {Number(selected.y).toFixed(2)})</span></div>
                <div>Rendered (X, Z): <span className="text-white">({Number(selected.x).toFixed(2)}, {Number(selected.y).toFixed(2)})</span></div>
                <div>Backend Heading: <span className="text-white">{((Number(selected.heading ?? 0) * 180) / Math.PI).toFixed(1)}°</span></div>
                <div>Rendered Y-Rot: <span className="text-white">{((-Number(selected.heading ?? 0) * 180) / Math.PI).toFixed(1)}°</span></div>
                <div>Current Node: <span className="text-[#3db89a] font-bold">{selected.currentNode ?? "—"}</span></div>
                <div>Current Waypoint: <span className="text-[#38bdf8]">{selected.currentWaypoint ?? "—"}</span></div>
                <div>Status: <span className="text-amber-300 font-bold">{String(selected.status ?? "IDLE").toUpperCase()}</span></div>
                <div>Intent: <span className="text-slate-200">{String(selected.intent ?? "NONE")}</span></div>
              </div>
            ) : (
              <div className="text-slate-400 italic">Select an AMR in 3D canvas to inspect coordinate transforms.</div>
            )}
          </div>
        )}
      </SceneErrorBoundary>
    </div>
  );
}