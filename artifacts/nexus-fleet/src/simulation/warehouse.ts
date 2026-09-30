import type { WarehouseEdge, WarehouseNode } from "./types";

const XS = [-16, -12, -8, -4, 0, 4, 8, 12, 16];
const YS = [-10, -6, -2, 2, 6, 10];

export function createWarehouse() {
  const nodes: WarehouseNode[] = [];
  const edges: WarehouseEdge[] = [];

  for (let row = 0; row < YS.length; row += 1) {
    for (let col = 0; col < XS.length; col += 1) {
      const x = XS[col];
      const y = YS[row];
      const id = nodeId(row, col);
      const kind: WarehouseNode["kind"] =
        (row === 0 && col === 0) || (row === 5 && col === 8)
          ? "charger"
          : col === 8 && row === 2
            ? "packing"
            : col === 0 && row === 2
              ? "loading"
              : (row === 2 && col === 4) || (row === 3 && col === 4)
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
                  ? `STAGE-${row === 2 ? "01" : "02"}`
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
    const specialAisle = vertical && col === 4 && Math.min(row, nextRow) === 2;
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
      capacity: 3,
      direction: "both",
      speedLimit: 2.2,
      congestion: 0,
      blocked: false,
      risk: specialAisle ? 0.12 : 0.03,
      occupancy: [],
      narrow: false,
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
  const letters = ["A", "B", "C", "D", "E", "F"];
  const groceryItems = [
    "ORGANIC_APPLES", "FRESH_MILK", "WHOLE_WHEAT_BREAD", "BASMATI_RICE",
    "OLIVE_OIL", "ALMOND_MILK", "GREEK_YOGURT", "ROASTED_COFFEE",
    "ORANGE_JUICE", "CHOCOLATE_BAR", "GREEN_TEA", "PASTA_PACK",
    "HONEY_JAR", "PEANUT_BUTTER", "OAT_CEREAL", "DARK_ROAST_BEANS"
  ];
  let index = 0;
  for (const row of [1, 2, 3, 4]) {
    for (const col of [1, 2, 3, 5, 6, 7]) {
      const letter = letters[Math.floor(index / 4) % letters.length];
      const number = String((index % 4) + 11).padStart(2, "0");
      const item = groceryItems[index % groceryItems.length];
      rackNodes.push({
        id: nodeId(row, col),
        label: `Rack ${letter}-${number}`,
        sku: `SKU-${letter}${number}-${item}`,
      });
      index += 1;
    }
  }
  return rackNodes;
}

export const PACKING_NODE = nodeId(2, 8);
export const CHARGER_NODES = [nodeId(0, 0), nodeId(5, 8)];