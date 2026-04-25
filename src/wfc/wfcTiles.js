export const WFC_DIRECTIONS = ["e", "se", "sw", "w", "nw", "ne"];

export const WFC_DIRECTION_DELTAS = {
  e: { dc: 1, dr: 0 },
  se: { dc: 0, dr: 1 },
  sw: { dc: -1, dr: 1 },
  w: { dc: -1, dr: 0 },
  nw: { dc: -1, dr: -1 },
  ne: { dc: 0, dr: -1 },
};

export function getWfcDirectionDelta(direction, row = 0) {
  const oddRow = Math.abs(row % 2) === 1;
  switch (direction) {
    case "e":
      return { dc: 1, dr: 0 };
    case "se":
      return { dc: oddRow ? 1 : 0, dr: 1 };
    case "sw":
      return { dc: oddRow ? 0 : -1, dr: 1 };
    case "w":
      return { dc: -1, dr: 0 };
    case "nw":
      return { dc: oddRow ? 0 : -1, dr: -1 };
    case "ne":
      return { dc: oddRow ? 1 : 0, dr: -1 };
    default:
      return { dc: 0, dr: 0 };
  }
}

export function getOppositeWfcDirection(direction) {
  switch (direction) {
    case "e":
      return "w";
    case "se":
      return "nw";
    case "sw":
      return "ne";
    case "w":
      return "e";
    case "nw":
      return "se";
    case "ne":
      return "sw";
    default:
      return "";
  }
}

export const FINGERPRINT_WORLD_TILES = [
  {
    id: "grass",
    label: "Grass",
    icon: "G",
    weight: 8,
    color: "#65b96f",
    accent: "#2f7f47",
    textColor: "#102817",
  },
  {
    id: "water",
    label: "Water",
    icon: "W",
    weight: 5,
    color: "#338fd0",
    accent: "#0f4f8b",
    textColor: "#eff8ff",
  },
  {
    id: "forest",
    label: "Forest",
    icon: "F",
    weight: 4,
    color: "#2f7f47",
    accent: "#163d29",
    textColor: "#effff0",
  },
  {
    id: "mountain",
    label: "Peak",
    icon: "M",
    weight: 2,
    color: "#8e99a5",
    accent: "#4e5965",
    textColor: "#f6f8fb",
  },
  {
    id: "castle",
    label: "Castle",
    icon: "C",
    weight: 1,
    color: "#b7bdc8",
    accent: "#5a6270",
    textColor: "#19202b",
  },
  {
    id: "bridge",
    label: "Bridge",
    icon: "B",
    weight: 1,
    color: "#c68b55",
    accent: "#6a3f28",
    textColor: "#fff3df",
  },
];

const SAME_ON_ALL_SIDES = {
  grass: ["grass", "water", "forest", "mountain", "castle", "bridge"],
  water: ["grass", "water", "bridge"],
  forest: ["grass", "forest", "mountain"],
  mountain: ["grass", "forest", "mountain"],
  castle: ["grass"],
  bridge: ["grass", "water"],
};

export const FINGERPRINT_WORLD_ADJACENCY = Object.fromEntries(
  Object.entries(SAME_ON_ALL_SIDES).map(([tileId, neighbors]) => [
    tileId,
    Object.fromEntries(WFC_DIRECTIONS.map((direction) => [direction, neighbors])),
  ]),
);

export function getFingerprintWorldTile(tileId) {
  return FINGERPRINT_WORLD_TILES.find((tile) => tile.id === tileId) ?? null;
}
