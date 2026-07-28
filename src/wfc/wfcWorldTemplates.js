export const WFC_WORLD_BLANK_TEMPLATE_ID = "blank-canvas";

function freezeConstraints(constraints) {
  return Object.freeze(
    constraints.map((constraint) => Object.freeze({ ...constraint })),
  );
}

export const WFC_WORLD_STARTER_TEMPLATES = Object.freeze([
  Object.freeze({
    id: WFC_WORLD_BLANK_TEMPLATE_ID,
    name: "Blank canvas",
    description:
      "Begin with an open map and place every terrain rule yourself.",
    defaultTileId: "grass",
    constraints: freezeConstraints([]),
  }),
  Object.freeze({
    id: "river-crossing",
    name: "River crossing",
    description:
      "Start with a working bridge, grassy banks, and water ready to spread.",
    defaultTileId: "water",
    constraints: freezeConstraints([
      { col: 19, row: 12, tileId: "bridge" },
      { col: 20, row: 12, tileId: "grass" },
      { col: 18, row: 12, tileId: "grass" },
      { col: 19, row: 13, tileId: "water" },
      { col: 18, row: 13, tileId: "water" },
      { col: 18, row: 11, tileId: "water" },
      { col: 19, row: 11, tileId: "water" },
    ]),
  }),
  Object.freeze({
    id: "highland-keep",
    name: "Highland keep",
    description:
      "Grow a castle realm between wooded ridges and a distant lake.",
    defaultTileId: "forest",
    constraints: freezeConstraints([
      { col: 12, row: 12, tileId: "castle" },
      { col: 5, row: 5, tileId: "forest" },
      { col: 6, row: 5, tileId: "mountain" },
      { col: 30, row: 7, tileId: "mountain" },
      { col: 29, row: 7, tileId: "forest" },
      { col: 24, row: 18, tileId: "water" },
    ]),
  }),
  Object.freeze({
    id: "island-chain",
    name: "Island chain",
    description:
      "Scatter water anchors across the map to invite lakes, coasts, and islands.",
    defaultTileId: "grass",
    constraints: freezeConstraints([
      { col: 5, row: 5, tileId: "water" },
      { col: 9, row: 7, tileId: "water" },
      { col: 17, row: 16, tileId: "water" },
      { col: 25, row: 6, tileId: "water" },
      { col: 32, row: 17, tileId: "water" },
      { col: 20, row: 11, tileId: "grass" },
    ]),
  }),
]);

export function getWfcWorldStarterTemplate(templateId) {
  return (
    WFC_WORLD_STARTER_TEMPLATES.find(
      (template) => template.id === templateId,
    ) ?? null
  );
}

export function isWfcWorldStarterTemplateId(templateId) {
  return Boolean(getWfcWorldStarterTemplate(templateId));
}
