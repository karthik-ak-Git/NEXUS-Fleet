import type { WarehouseEdge, WarehouseNode } from "./types";

const XS = [-12, -8, -4, 0, 4, 8, 12];
const YS = [-8, -4, 0, 4, 8];

export function createWarehouse() {
  const nodes: WarehouseNode[] = [];
  const edges: WarehouseEdge[] = [];

  for (let row = 0; row < YS.length; row += 1) {
    for (let col = 0; col < XS.length; col += 1) {
      const x = XS[col];
      const y = YS[row];
      const id = nodeId(row, col);
      const kind: WarehouseNode["kind"] =
        (row === 0 && col === 0) || (row === 4 && col === 6)
          ? "charger"
          : col === 6 && row === 2
            ? "packing"
            : col === 0 && row === 2
              ? "loading"
              : row === 2 && col === 3
                ? "staging"
                : "intersection";
      nodes.push({
        id,
        x,
        y,
        kind,
        label:
          kind === "charger"
            ? `CHG-${row === 0 ? "01" : "02"}`
            : kind === "packing"
              ? "PACK-02"
              : kind === "loading"
                ? "INBOUND"
                : kind === "staging"
                  ? "STAGE-01"
                  : `I-${String(row * XS.length + col + 1).padStart(2, "0")}`,
      });
    }
  }

  const addEdge = (row: number, col: number, nextRow: number, nextCol: number) => {
    const from = nodeId(row, col);
    const to = nodeId(nextRow, nextCol);
    const x1 = XS[col];
    const y1 = YS[row];
    const x2 = XS[nextCol];
    const y2 = YS[nextRow];
    const vertical = col === nextCol;
    const specialAisle =
      vertical && col === 3 && Math.min(row, nextRow) === 1;
    const edgeId = specialAisle
      ? "C-17"
      : vertical
        ? `V-${row}-${col}`
        : `H-${row}-${col}`;
    edges.push({
      id: edgeId,
      from,
      to,
      length: Math.hypot(x2 - x1, y2 - y1),
      estimatedTravelTime: 2,
      capacity: specialAisle ? 1 : 2,
      direction: "both",
      speedLimit: specialAisle ? 1.7 : 2,
      congestion: 0,
      blocked: false,
      risk: specialAisle ? 0.16 : 0.04,
      occupancy: [],
      narrow: specialAisle || (vertical && col % 2 === 0),
    });
  };

  for (let row = 0; row < YS.length; row += 1) {
    for (let col = 0; col < XS.length; col += 1) {
      if (col < XS.length - 1) addEdge(row, col, row, col + 1);
      if (row < YS.length - 1) addEdge(row, col, row + 1, col);
    }
  }

  return { nodes, edges };
}

export function nodeId(row: number, col: number) {
  return `N-${row}-${col}`;
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
  const rackNodes: Array<{ id: string; label: string; sku: string }> = [];
  const letters = ["A", "B", "C", "D"];
  let index = 0;
  for (let row = 0; row < YS.length; row += 1) {
    for (const col of [1, 2, 4, 5]) {
      const letter = letters[Math.floor(index / 4)];
      const number = String((index % 4) + 11).padStart(2, "0");
      rackNodes.push({
        id: nodeId(row, col),
        label: `Rack ${letter}-${number}`,
        sku: `SKU-${letter}${number}-${["RED", "BLUE", "GREY", "AMBER"][index % 4]}`,
      });
      index += 1;
    }
  }
  return rackNodes;
}

export const PACKING_NODE = nodeId(2, 6);
export const CHARGER_NODES = [nodeId(0, 0), nodeId(4, 6)];