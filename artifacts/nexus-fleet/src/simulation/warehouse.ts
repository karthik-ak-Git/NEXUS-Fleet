import type { WarehouseEdge, WarehouseNode } from "./types";
import { GLOBAL_WAREHOUSE_LAYOUT, nodeId as layoutNodeId } from "./warehouseLayout";

export function createWarehouse() {
  return {
    nodes: GLOBAL_WAREHOUSE_LAYOUT.nodes,
    edges: GLOBAL_WAREHOUSE_LAYOUT.edges,
  };
}

export function nodeId(row: number, col: number) {
  return layoutNodeId(row, col);
}

export function nodeById(nodes: WarehouseNode[], id: string | null | undefined) {
  return nodes.find((node) => node.id === id);
}

export function edgeBetween(
  edges: WarehouseEdge[],
  from: string,
  to: string,
) {
  return edges.find(
    (edge) =>
      (edge.from === from && edge.to === to) ||
      (edge.from === to && edge.to === from),
  );
}

export function getRackLocations() {
  return GLOBAL_WAREHOUSE_LAYOUT.shelves.map((shelf) => ({
    id: shelf.pickupPoint.nodeId,
    label: shelf.label,
    sku: shelf.sku,
  }));
}

export const PACKING_NODE = nodeId(2, 8);
export const CHARGER_NODES = [nodeId(0, 0), nodeId(5, 8)];