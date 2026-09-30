import math
from typing import List, Dict, Tuple, Optional
from ..schemas.simulation import WarehouseNodeSchema, WarehouseEdgeSchema

XS = [-16.0, -12.0, -8.0, -4.0, 0.0, 4.0, 8.0, 12.0, 16.0]
YS = [-10.0, -6.0, -2.0, 2.0, 6.0, 10.0]

def node_id(row: int, col: int) -> str:
    return f"N-{row}-{col}"

def create_warehouse() -> Tuple[List[WarehouseNodeSchema], List[WarehouseEdgeSchema]]:
    nodes: List[WarehouseNodeSchema] = []
    edges: List[WarehouseEdgeSchema] = []

    for row in range(len(YS)):
        for col in range(len(XS)):
            x = XS[col]
            y = YS[row]
            id_str = node_id(row, col)

            if (row == 0 and col == 0) or (row == 5 and col == 8):
                kind = "charger"
            elif col == 8 and row == 2:
                kind = "packing"
            elif col == 0 and row == 2:
                kind = "loading"
            elif (row == 2 and col == 4) or (row == 3 and col == 4):
                kind = "staging"
            else:
                kind = "intersection"

            if kind == "charger":
                label = f"CHG-{'01' if row == 0 else '02'}"
            elif kind == "packing":
                label = "PACK-02"
            elif kind == "loading":
                label = "INBOUND"
            elif kind == "staging":
                label = f"STAGE-{'01' if row == 2 else '02'}"
            else:
                label = f"I-{str(row * len(XS) + col + 1).zfill(2)}"

            nodes.append(WarehouseNodeSchema(
                id=id_str,
                x=x,
                y=y,
                kind=kind,
                label=label
            ))

    def add_edge(row: int, col: int, next_row: int, next_col: int):
        from_id = node_id(row, col)
        to_id = node_id(next_row, next_col)
        x1, y1 = XS[col], YS[row]
        x2, y2 = XS[next_col], YS[next_row]
        vertical = (col == next_col)
        # Exclude vertical edges crossing physical shelf blocks at rack columns
        if vertical and (col in [1, 2, 3, 5, 6, 7]) and (min(row, next_row) in [1, 3]):
            return
        special_aisle = vertical and col == 4 and min(row, next_row) == 2

        if special_aisle:
            edge_id = "C-17"
        elif vertical:
            edge_id = f"V-{row}-{col}"
        else:
            edge_id = f"H-{row}-{col}"

        edges.append(WarehouseEdgeSchema(
            id=edge_id,
            from_node=from_id,
            to_node=to_id,
            length=math.hypot(x2 - x1, y2 - y1),
            estimatedTravelTime=2.0,
            capacity=3,
            direction="both",
            speedLimit=2.2,
            congestion=0.0,
            blocked=False,
            risk=0.12 if special_aisle else 0.03,
            occupancy=[],
            narrow=False
        ))

    for row in range(len(YS)):
        for col in range(len(XS)):
            if col < len(XS) - 1:
                add_edge(row, col, row, col + 1)
            if row < len(YS) - 1:
                add_edge(row, col, row + 1, col)

    return nodes, edges

def get_rack_locations() -> List[Dict[str, str]]:
    rack_nodes = []
    letters = ["A", "B", "C", "D", "E", "F"]
    grocery_items = [
        "ORGANIC_APPLES", "FRESH_MILK", "WHOLE_WHEAT_BREAD", "BASMATI_RICE",
        "OLIVE_OIL", "ALMOND_MILK", "GREEK_YOGURT", "ROASTED_COFFEE",
        "ORANGE_JUICE", "CHOCOLATE_BAR", "GREEN_TEA", "PASTA_PACK",
        "HONEY_JAR", "PEANUT_BUTTER", "OAT_CEREAL", "DARK_ROAST_BEANS"
    ]
    index = 0
    for row in [1, 2, 3, 4]:
        for col in [1, 2, 3, 5, 6, 7]:
            letter = letters[(index // 4) % len(letters)]
            number = str((index % 4) + 11).zfill(2)
            item = grocery_items[index % len(grocery_items)]
            rack_nodes.append({
                "id": node_id(row, col),
                "label": f"Rack {letter}-{number}",
                "sku": f"SKU-{letter}{number}-{item}"
            })
            index += 1
    return rack_nodes

PACKING_NODE = node_id(2, 8)
COUNTER_QUEUE_NODES = [node_id(2, 8), node_id(2, 7), node_id(2, 6), node_id(2, 5)]
CHARGER_NODES = [
    node_id(0, 0), node_id(0, 1), node_id(0, 2), node_id(0, 3), node_id(0, 4),
    node_id(0, 5), node_id(0, 6), node_id(0, 7), node_id(0, 8), node_id(5, 0)
]

def node_by_id(nodes: List[WarehouseNodeSchema], node_id_str: Optional[str]) -> Optional[WarehouseNodeSchema]:
    if not node_id_str:
        return None
    for n in nodes:
        if n.id == node_id_str:
            return n
    return None

def edge_between(edges: List[WarehouseEdgeSchema], from_id: str, to_id: str) -> Optional[WarehouseEdgeSchema]:
    for e in edges:
        if (e.from_node == from_id and e.to_node == to_id) or (e.from_node == to_id and e.to_node == from_id):
            return e
    return None
