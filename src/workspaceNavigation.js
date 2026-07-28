import {
  APP_PHASES,
  PRODUCT_AREAS,
  listModes,
} from "./modeRegistry.js";

const WORKSPACE_NAV_PHASES = new Set(
  listModes({ includeHidden: true })
    .filter(
      (mode) =>
        mode.entryKind === "phase" &&
        mode.phase !== APP_PHASES.FULLSCREEN_CAMERA,
    )
    .map((mode) => mode.phase),
);

export function shouldShowWorkspaceNav(phase) {
  return WORKSPACE_NAV_PHASES.has(phase);
}

export function getWorkspaceNavigationGroups() {
  return [
    {
      id: PRODUCT_AREAS.PLAY,
      label: "Play",
      modes: listModes({ area: PRODUCT_AREAS.PLAY }).filter(
        (mode) => mode.entryKind === "phase",
      ),
    },
    {
      id: PRODUCT_AREAS.CREATE,
      label: "Create",
      modes: listModes({ area: PRODUCT_AREAS.CREATE }).filter(
        (mode) => mode.entryKind === "phase",
      ),
    },
    {
      id: PRODUCT_AREAS.LABS,
      label: "Labs",
      modes: listModes({ area: PRODUCT_AREAS.LABS }).filter(
        (mode) => mode.entryKind === "phase",
      ),
    },
  ];
}
