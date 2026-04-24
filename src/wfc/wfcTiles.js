export const WFC_DIRECTIONS = ["n", "e", "s", "w"];

export const WFC_DIRECTION_DELTAS = {
  n: { dc: 0, dr: -1 },
  e: { dc: 1, dr: 0 },
  s: { dc: 0, dr: 1 },
  w: { dc: -1, dr: 0 },
};

export function getOppositeWfcDirection(direction) {
  switch (direction) {
    case "n":
      return "s";
    case "e":
      return "w";
    case "s":
      return "n";
    case "w":
      return "e";
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
    id: "sand",
    label: "Sand",
    icon: "S",
    weight: 3,
    color: "#e5c66f",
    accent: "#b88338",
    textColor: "#37230d",
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
    id: "road",
    label: "Road",
    icon: "R",
    weight: 3,
    color: "#9a7048",
    accent: "#f0cf76",
    textColor: "#fff4cf",
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
  grass: ["grass", "sand", "forest", "mountain", "road", "castle"],
  water: ["water", "sand", "bridge"],
  sand: ["water", "sand", "grass", "road", "bridge"],
  forest: ["grass", "forest", "mountain"],
  mountain: ["grass", "forest", "mountain"],
  road: ["grass", "sand", "road", "castle", "bridge"],
  castle: ["grass", "road"],
  bridge: ["water", "sand", "road"],
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
