export function getSkyPatrolHudItems(hud = {}) {
  return [
    {
      id: "score",
      label: "Score",
      value: hud.score ?? 0,
    },
    {
      id: "lives",
      label: "Lives",
      value: hud.lives ?? 0,
    },
    {
      id: "air",
      label: "Air",
      value: hud.airTargetCount ?? 0,
    },
    {
      id: "ground",
      label: "Ground",
      value: hud.groundTargetCount ?? 0,
    },
    {
      id: "fire",
      label: "Fire",
      value: hud.fireReady ? "Ready" : "Reload",
    },
  ];
}
