import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type Datum = Record<string, any>;

const robotColor = (status: unknown) => {
  const text = String(status ?? "").toLowerCase();
  if (/failed|blocked|lost/.test(text)) return "#b6493f";
  if (/yield|wait|negotiat|rerout|recover|charge/.test(text)) return "#d49b34";
  if (/complete|idle/.test(text)) return "#7a9183";
  return "#1d927d";
};

function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[31, 22]} />
        <meshStandardMaterial color="#d9d7c9" roughness={0.88} />
      </mesh>
      <gridHelper args={[30, 30, "#89968c", "#c3c3b5"]} position={[0, -0.105, 0]} />
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <boxGeometry args={[31.5, 0.3, 22.5]} />
        <meshStandardMaterial color="#9b9d91" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[28, 18]} />
        <meshStandardMaterial color="#dfddcf" roughness={0.96} />
      </mesh>
      {[-9, -4.5, 0, 4.5, 9].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, z]}>
          <planeGeometry args={[27, 0.055]} />
          <meshStandardMaterial color="#b2b5a8" roughness={0.8} />
        </mesh>
      ))}
      {[-14.2, 14.2].map((x) => (
        <mesh key={x} position={[x, 1.15, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.3, 2.3, 20]} />
          <meshStandardMaterial color="#b8b9ad" roughness={0.78} />
        </mesh>
      ))}
      {[-10, 10].map((z) => (
        <mesh key={z} position={[0, 1.15, z]} castShadow receiveShadow>
          <boxGeometry args={[28.5, 2.3, 0.28]} />
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
      <Html position={[0, 2.3, 0]} center distanceFactor={18} transform>
        <div className="scene-rack-label">{id}</div>
      </Html>
    </group>
  );
}

function WarehouseRacks() {
  const racks = useMemo(
    () =>
      [-6, -1.5, 3, 7.5].flatMap((x, column) =>
        [-6.1, -1.55, 3.1].map((z, row) => ({
          id: `R-${String(row * 4 + column + 1).padStart(2, "0")}`,
          x,
          z,
        })),
      ),
    [],
  );
  return (
    <group>
      {racks.map((rack) => <Rack key={rack.id} {...rack} />)}
      {[
        [-12.8, -8.5], [12.8, -8.5], [-12.8, 8.5], [12.8, 8.5],
        [-12.8, 0], [12.8, 0], [0, -9.2], [0, 9.2],
      ].map(([x, z], index) => (
        <mesh key={index} position={[x, 1.45, z]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 2.9, 0.42]} />
          <meshStandardMaterial color="#7a817a" metalness={0.18} roughness={0.65} />
        </mesh>
      ))}
      <Station position={[-12.3, 0, 0]} label="INBOUND" tint="#a88951" />
      <Station position={[12.3, 0, 0]} label="PACK / OUT" tint="#4e8277" />
      <Station position={[-12.3, 0, -8]} label="CHG 01" tint="#578a7b" />
      <Station position={[12.3, 0, 8]} label="CHG 02" tint="#578a7b" />
      <group position={[-10, 0.32, 6.8]}>
        {[0, 0.65, 1.3].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh castShadow position={[0, 0.32, 0]}>
              <boxGeometry args={[0.62, 0.6, 0.62]} />
              <meshStandardMaterial color="#ad8957" roughness={0.88} />
            </mesh>
            <mesh castShadow position={[0, 0.76, 0]}>
              <boxGeometry args={[0.54, 0.25, 0.54]} />
              <meshStandardMaterial color="#8b5940" roughness={0.92} />
            </mesh>
          </group>
        ))}
      </group>
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
      <Html position={[0, 1.75, 0]} center distanceFactor={15}>
        <div className="scene-station-label">{label}</div>
      </Html>
    </group>
  );
}

function Robot({ robot, nodes, selected, onSelect }: {
  robot: Datum;
  nodes: Map<string, Datum>;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = robotColor(robot.status);
  const routePoints = (Array.isArray(robot.route) ? robot.route : [])
    .map((id: string) => nodes.get(id))
    .filter(Boolean)
    .map((node: Datum) => [node.x, 0.18, node.y] as [number, number, number]);
  const route = [[robot.x, 0.18, robot.y] as [number, number, number], ...routePoints];
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
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.18, 0.34, 0.86]} />
          <meshStandardMaterial color={color} roughness={0.52} metalness={0.22} />
        </mesh>
        <mesh position={[0.18, 0.22, 0]} castShadow>
          <boxGeometry args={[0.44, 0.12, 0.58]} />
          <meshStandardMaterial color="#d2c8ae" roughness={0.6} metalness={0.15} />
        </mesh>
        <mesh position={[0.69, 0.03, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[0.16, 0.38, 3]} />
          <meshStandardMaterial color="#f0c15b" roughness={0.4} />
        </mesh>
        <mesh position={[-0.2, 0.34, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.13, 20]} />
          <meshStandardMaterial color="#3a4946" metalness={0.72} roughness={0.24} />
        </mesh>
        <mesh position={[-0.2, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 14]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>
        {[-0.36, 0.36].flatMap((z) =>
          [-0.38, 0.38].map((x) => (
            <mesh key={`${x}-${z}`} position={[x, -0.12, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.1, 14]} />
              <meshStandardMaterial color="#24312f" roughness={0.86} />
            </mesh>
          )),
        )}
      </group>
      <Html position={[robot.x, 0.88, robot.y]} center distanceFactor={17} occlude={false}>
        <div className={`scene-robot-label ${selected ? "selected" : ""}`}>
          <strong>{robot.id}</strong>
          <span>{String(robot.status ?? "IDLE").replaceAll("_", " ")}</span>
        </div>
      </Html>
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
            <Html position={midpoint} center distanceFactor={14}>
              <div className="scene-blocked-label">BLOCKED · {edge.id}</div>
            </Html>
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
            <Html position={[node.x, 0.4, node.y]} center distanceFactor={14}>
              <div className="scene-reservation-label">{reservation.ownerRobot} · RESERVED</div>
            </Html>
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
}) {
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const selected = robots.find((robot) => robot.id === selectedId) ?? null;

  return (
    <div className="warehouse-3d">
      <Canvas shadows dpr={[1, 1.65]} camera={{ position: [23, 23, 25], fov: 39, near: 0.1, far: 140 }}>
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
        <WarehouseRacks />
        <ResourceOverlays edges={edges} nodes={nodeMap} reservations={reservations} obstacles={obstacles} />
        {robots.map((robot) => (
          <Robot
            key={robot.id}
            robot={robot}
            nodes={nodeMap}
            selected={robot.id === selectedId}
            onSelect={() => onSelect(robot.id)}
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
    </div>
  );
}