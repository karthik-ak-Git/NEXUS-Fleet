import type { WarehouseNode, WarehouseEdge } from "./types";

export interface BoundingBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Shelf {
  id: string;
  label: string;
  sku: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  accessibleSide: 'north' | 'south';
  pickupPoint: {
    nodeId: string;
    x: number;
    y: number;
  };
  bounds: BoundingBox;
}

export interface ChargingSlot {
  id: string;
  label: string;
  nodeId: string;
  assignedRobotId: string;
  x: number;
  y: number;
}

export interface StationLocation {
  id: string;
  label: string;
  nodeId: string;
  x: number;
  y: number;
  kind: 'packing' | 'loading' | 'staging';
}

export interface WarehouseLayout {
  bounds: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    height: number;
  };
  walls: {
    id: string;
    x: number;
    y: number;
    width: number;
    depth: number;
    height: number;
  }[];
  shelves: Shelf[];
  chargingSlots: ChargingSlot[];
  stations: StationLocation[];
  nodes: WarehouseNode[];
  edges: WarehouseEdge[];
}

const XS = [-16, -12, -8, -4, 0, 4, 8, 12, 16];
const YS = [-10, -6, -2, 2, 6, 10];

export function nodeId(row: number, col: number): string {
  return `N-${row}-${col}`;
}

const GROCERY_SKUS = [
  { sku: "SKU-A11-ORGANIC_APPLES", name: "Organic Honeycrisp Apples" },
  { sku: "SKU-B12-FRESH_MILK", name: "Fresh Whole Milk 1L" },
  { sku: "SKU-C13-WHOLE_WHEAT_BREAD", name: "Artisan Whole Wheat Bread" },
  { sku: "SKU-D14-BASMATI_RICE", name: "Premium Basmati Rice 5kg" },
  { sku: "SKU-E15-OLIVE_OIL", name: "Extra Virgin Olive Oil 500ml" },
  { sku: "SKU-F16-ALMOND_MILK", name: "Unsweetened Almond Milk 1L" },
  { sku: "SKU-A21-GREEK_YOGURT", name: "Plain Greek Yogurt 500g" },
  { sku: "SKU-B22-ROASTED_COFFEE", name: "Dark Roasted Coffee Beans" },
  { sku: "SKU-C23-ORANGE_JUICE", name: "Fresh Orange Juice 1L" },
  { sku: "SKU-D24-CHOCOLATE_BAR", name: "70% Dark Chocolate Bar" },
  { sku: "SKU-E25-GREEN_TEA", name: "Organic Green Tea Bags 50s" },
  { sku: "SKU-F26-PASTA_PACK", name: "Italian Penne Rigate 500g" },
  { sku: "SKU-A31-HONEY_JAR", name: "Pure Raw Wildflower Honey" },
  { sku: "SKU-B32-PEANUT_BUTTER", name: "Crunchy Peanut Butter 400g" },
  { sku: "SKU-C33-OAT_CEREAL", name: "Whole Grain Oat Cereal 375g" },
  { sku: "SKU-D34-DARK_ROAST_BEANS", name: "Espresso Dark Roast Beans" },
  { sku: "SKU-E35-SPARKLING_WATER", name: "Lime Sparkling Water 6x330ml" },
  { sku: "SKU-F36-MIXED_NUTS", name: "Roasted Salted Mixed Nuts 250g" },
  { sku: "SKU-A41-DARK_CHOCOLATE", name: "Swiss Dark Chocolate 100g" },
  { sku: "SKU-B42-COCONUT_WATER", name: "Pure Coconut Water 1L" },
  { sku: "SKU-C43-PROTEIN_BAR", name: "Chocolate Peanut Protein Bar" },
  { sku: "SKU-D44-DRIED_MANGO", name: "Organic Dried Mango Slices" },
  { sku: "SKU-E45-GRANOLA_CHIPS", name: "Honey Granola Clusters 400g" },
  { sku: "SKU-F46-BERRY_JAM", name: "Wild Raspberry Fruit Spread" },
];

export function buildWarehouseLayout(): WarehouseLayout {
  const nodes: WarehouseNode[] = [];
  const edges: WarehouseEdge[] = [];

  for (let row = 0; row < YS.length; row++) {
    for (let col = 0; col < XS.length; col++) {
      const x = XS[col];
      const y = YS[row];
      const id = nodeId(row, col);
      let kind: WarehouseNode["kind"] = "intersection";
      if ((row === 0 && col === 0) || (row === 0 && col === 1) || (row === 0 && col === 2) ||
          (row === 5 && col === 6) || (row === 5 && col === 7) || (row === 5 && col === 8)) {
        kind = "charger";
      } else if (col === 8 && row === 2) {
        kind = "packing";
      } else if (col === 0 && row === 2) {
        kind = "loading";
      } else if ((row === 2 && col === 4) || (row === 3 && col === 4)) {
        kind = "staging";
      }

      nodes.push({
        id,
        x,
        y,
        kind,
        label:
          kind === "charger"
            ? `CHG-${String(row * XS.length + col + 1).padStart(2, "0")}`
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

    // CRITICAL PHYSICAL SAFETY CHECK:
    // Vertical edges at rack columns (col 1, 2, 3, 5, 6, 7) between row 1<->2 and row 3<->4 intersect physical shelves!
    // Exclude those invalid vertical edges so paths follow aisle centerlines exclusively.
    if (vertical && [1, 2, 3, 5, 6, 7].includes(col) && (Math.min(row, nextRow) === 1 || Math.min(row, nextRow) === 3)) {
      return;
    }

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

  for (let row = 0; row < YS.length; row++) {
    for (let col = 0; col < XS.length; col++) {
      if (col < XS.length - 1) addEdge(row, col, row, col + 1);
      if (row < YS.length - 1) addEdge(row, col, row + 1, col);
    }
  }

  // Physical Shelves (24 racks: 4 rows x 6 columns)
  const shelves: Shelf[] = [];
  const letters = ["A", "B", "C", "D", "E", "F"];
  let shelfIdx = 0;

  const rackCols = [1, 2, 3, 5, 6, 7]; // XS: -12, -8, -4, 4, 8, 12
  const rackRows = [
    { row: 1, z: -4.4, accessibleSide: "south" as const, aisleY: -6.0 }, // Accessible from Aisle Y=-6
    { row: 2, z: -3.6, accessibleSide: "north" as const, aisleY: -2.0 }, // Accessible from Aisle Y=-2
    { row: 3, z: 3.6,  accessibleSide: "south" as const, aisleY: 2.0 },  // Accessible from Aisle Y=2
    { row: 4, z: 4.4,  accessibleSide: "north" as const, aisleY: 6.0 },  // Accessible from Aisle Y=6
  ];

  for (const rInfo of rackRows) {
    for (const colIdx of rackCols) {
      const x = XS[colIdx];
      const y = rInfo.z;
      const letter = letters[Math.floor(shelfIdx / 4) % letters.length];
      const number = String((shelfIdx % 4) + 11).padStart(2, "0");
      const id = `R-${String(shelfIdx + 1).padStart(2, "0")}`;
      const label = `Rack ${letter}-${number}`;
      const skuData = GROCERY_SKUS[shelfIdx % GROCERY_SKUS.length];
      const pickupNodeId = nodeId(rInfo.row, colIdx);

      const width = 2.6;
      const depth = 1.2;
      const height = 2.4;

      shelves.push({
        id,
        label,
        sku: skuData.sku,
        x,
        y,
        width,
        depth,
        height,
        accessibleSide: rInfo.accessibleSide,
        pickupPoint: {
          nodeId: pickupNodeId,
          x,
          y: rInfo.aisleY,
        },
        bounds: {
          xMin: x - width / 2,
          xMax: x + width / 2,
          yMin: y - depth / 2,
          yMax: y + depth / 2,
        },
      });
      shelfIdx++;
    }
  }

  // 6 Dedicated Home Charging Slots
  const chargingSlots: ChargingSlot[] = [
    { id: "C-01", label: "CHARGER 01", nodeId: "N-0-0", assignedRobotId: "AMR-01", x: -16, y: -10 },
    { id: "C-02", label: "CHARGER 02", nodeId: "N-0-1", assignedRobotId: "AMR-02", x: -12, y: -10 },
    { id: "C-03", label: "CHARGER 03", nodeId: "N-0-2", assignedRobotId: "AMR-03", x: -8,  y: -10 },
    { id: "C-04", label: "CHARGER 04", nodeId: "N-5-6", assignedRobotId: "AMR-04", x: 8,   y: 10 },
    { id: "C-05", label: "CHARGER 05", nodeId: "N-5-7", assignedRobotId: "AMR-05", x: 12,  y: 10 },
    { id: "C-06", label: "CHARGER 06", nodeId: "N-5-8", assignedRobotId: "AMR-06", x: 16,  y: 10 },
  ];

  // Station Locations
  const stations: StationLocation[] = [
    { id: "PACK-02", label: "PACKING / OUTBOUND", nodeId: "N-2-8", x: 16, y: -2, kind: "packing" },
    { id: "INBOUND", label: "INBOUND RECEIVING", nodeId: "N-2-0", x: -16, y: -2, kind: "loading" },
    { id: "STAGE-01", label: "STAGING ZONE 01", nodeId: "N-2-4", x: 0, y: -2, kind: "staging" },
    { id: "STAGE-02", label: "STAGING ZONE 02", nodeId: "N-3-4", x: 0, y: 2, kind: "staging" },
  ];

  return {
    bounds: { xMin: -18, xMax: 18, yMin: -12, yMax: 12, height: 4.5 },
    walls: [
      { id: "wall-north", x: 0, y: -12, width: 36, depth: 0.4, height: 4.0 },
      { id: "wall-south", x: 0, y: 12, width: 36, depth: 0.4, height: 4.0 },
      { id: "wall-west",  x: -18, y: 0, width: 0.4, depth: 24, height: 4.0 },
      { id: "wall-east",  x: 18, y: 0, width: 0.4, depth: 24, height: 4.0 },
    ],
    shelves,
    chargingSlots,
    stations,
    nodes,
    edges,
  };
}

export const GLOBAL_WAREHOUSE_LAYOUT = buildWarehouseLayout();
