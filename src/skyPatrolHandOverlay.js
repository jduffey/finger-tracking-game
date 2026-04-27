export const SKY_PATROL_ACTIVE_HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
];

export const SKY_PATROL_ACTIVE_HAND_TIP_INDEXES = [4, 8];

export function getSkyPatrolActiveHandTipStyle(isPinching = false) {
  return {
    fill: isPinching ? "rgba(255, 56, 76, 0.98)" : "rgba(219, 255, 248, 0.25)",
    stroke: isPinching ? "rgba(255, 56, 76, 0.58)" : "rgba(64, 255, 225, 0.24)",
  };
}
