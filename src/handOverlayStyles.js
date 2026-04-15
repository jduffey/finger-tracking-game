const LEFT_HAND_STYLE = {
  point: "rgba(255, 141, 87, 0.95)",
  ring: "rgba(255, 141, 87, 0.28)",
  line: "rgba(255, 141, 87, 0.56)",
  poseStroke: "rgba(255, 171, 118, 0.82)",
  poseFill: "rgba(255, 167, 110, 0.95)",
};

const RIGHT_HAND_STYLE = {
  point: "rgba(86, 196, 255, 0.95)",
  ring: "rgba(86, 196, 255, 0.28)",
  line: "rgba(86, 196, 255, 0.56)",
  poseStroke: "rgba(115, 222, 255, 0.82)",
  poseFill: "rgba(110, 204, 255, 0.95)",
};

export function getHandOverlayStyle(hand, handIndex = 0) {
  if (hand?.label === "Left") {
    return LEFT_HAND_STYLE;
  }
  if (hand?.label === "Right") {
    return RIGHT_HAND_STYLE;
  }
  return handIndex % 2 === 0 ? LEFT_HAND_STYLE : RIGHT_HAND_STYLE;
}
