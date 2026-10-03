import { edgeBetween, nodeById } from "./warehouse";
import type { Reservation, WarehouseEdge, WarehouseNode } from "./types";

export interface RoutePlan {
  nodes: string[];
  cost: number;
  estimatedTime: number;
  distance: number;
}

export interface PlanOptions {
  nodes: WarehouseNode[];
  edges: WarehouseEdge[];
  blockedNodes?: Set<string>;
  blockedEdges?: Set<string>;
  reservations?: Reservation[];
  robotId?: string;
  avoidNodes?: Set<string>;
  energyWeight?: number;
}

export function planRoute(
  start: string,
  goal: string,
  options: PlanOptions,
): RoutePlan | null {
  if (start === goal) return { nodes: [start], cost: 0, estimatedTime: 0, distance: 0 };
  const nodeMap = new Map(options.nodes.map((node) => [node.id, node]));
  const frontier: Array<{ id: string; score: number }> = [{ id: start, score: 0 }];
  const cameFrom = new Map<string, string>();
  const costSoFar = new Map<string, number>([[start, 0]]);
  const travelSoFar = new Map<string, number>([[start, 0]]);
  const distanceSoFar = new Map<string, number>([[start, 0]]);
  const blockedNodes = options.blockedNodes ?? new Set<string>();
  const blockedEdges = options.blockedEdges ?? new Set<string>();
  const reservations = options.reservations ?? [];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.score - b.score);
    const current = frontier.shift()!;
    if (current.id === goal) break;

    for (const edge of options.edges) {
      const next =
        edge.from === current.id
          ? edge.to
          : edge.to === current.id
            ? edge.from
            : null;
      if (!next || edge.blocked || blockedEdges.has(edge.id) || blockedNodes.has(next)) {
        continue;
      }
      const directionAllowed =
        edge.direction === "both" ||
        (edge.direction === "forward" && edge.from === current.id) ||
        (edge.direction === "reverse" && edge.to === current.id);
      if (!directionAllowed) continue;

      const isReserved = reservations.some(
        (reservation) =>
          reservation.status === "ACTIVE" &&
          reservation.endTime > 0 &&
          reservation.ownerRobot !== options.robotId &&
          reservation.resourceId === next,
      );
      const avoided = options.avoidNodes?.has(next) ?? false;
      const travelTime =
        edge.estimatedTravelTime *
        (1 + Math.max(0, edge.congestion) * 1.6 + edge.risk * 0.5);
      const edgeCost =
        travelTime +
        edge.length * 0.045 +
        edge.congestion * 2.4 +
        edge.risk * 3 +
        (isReserved ? 22 : 0) +
        (avoided ? 35 : 0) +
        edge.occupancy.filter((robotId) => robotId !== options.robotId).length * 4.0 +
        edge.length * (options.energyWeight ?? 0.04);
      const nextCost = (costSoFar.get(current.id) ?? 0) + edgeCost;

      if (nextCost < (costSoFar.get(next) ?? Number.POSITIVE_INFINITY)) {
        cameFrom.set(next, current.id);
        costSoFar.set(next, nextCost);
        travelSoFar.set(next, (travelSoFar.get(current.id) ?? 0) + travelTime);
        distanceSoFar.set(
          next,
          (distanceSoFar.get(current.id) ?? 0) + edge.length,
        );
        const node = nodeMap.get(next);
        const goalNode = nodeMap.get(goal);
        const heuristic =
          node && goalNode
            ? Math.hypot(goalNode.x - node.x, goalNode.y - node.y) * 0.25
            : 0;
        frontier.push({ id: next, score: nextCost + heuristic });
      }
    }
  }

  if (!cameFrom.has(goal)) return null;
  const path = [goal];
  let cursor = goal;
  while (cursor !== start) {
    const previous = cameFrom.get(cursor);
    if (!previous) return null;
    path.unshift(previous);
    cursor = previous;
  }
  return {
    nodes: path,
    cost: costSoFar.get(goal) ?? 0,
    estimatedTime: travelSoFar.get(goal) ?? 0,
    distance: distanceSoFar.get(goal) ?? 0,
  };
}

export function estimateRouteTime(
  route: string[],
  nodes: WarehouseNode[],
  edges: WarehouseEdge[],
) {
  let total = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const edge = edgeBetween(edges, route[index], route[index + 1]);
    if (edge) {
      total +=
        edge.estimatedTravelTime *
        (1 + Math.max(0, edge.congestion) * 1.6 + edge.risk * 0.5);
    } else {
      const a = nodeById(nodes, route[index]);
      const b = nodeById(nodes, route[index + 1]);
      if (a && b) total += Math.hypot(a.x - b.x, a.y - b.y) / 2;
    }
  }
  return total;
}

export function routeDistance(route: string[], edges: WarehouseEdge[]) {
  let distance = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    distance += edgeBetween(edges, route[index], route[index + 1])?.length ?? 0;
  }
  return distance;
}