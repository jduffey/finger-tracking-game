function hasUsableIndexTip(hand) {
  const indexTip = hand?.fingerTips?.index ?? hand?.indexTip ?? null;
  return (
    (Number.isFinite(indexTip?.u) && Number.isFinite(indexTip?.v)) ||
    (Number.isFinite(indexTip?.x) && Number.isFinite(indexTip?.y))
  );
}

function getFirstUsableHand(hands) {
  const candidates = Array.isArray(hands) ? hands : [];
  return candidates.find((hand) => hasUsableIndexTip(hand)) ?? null;
}

export function getVerifiedFullscreenHandPointerInput(
  hands,
  viewport,
  projectPoint,
) {
  const verifiedHand = getFirstUsableHand(hands);
  if (!verifiedHand) {
    return {
      handVerified: false,
      pointerActive: false,
      pointerX: 0,
      pointerY: 0,
    };
  }

  const indexTip =
    verifiedHand.fingerTips?.index ?? verifiedHand.indexTip ?? null;
  const projectedPoint =
    typeof projectPoint === "function" && indexTip
      ? projectPoint(indexTip)
      : null;
  const hasProjectedPoint =
    Number.isFinite(projectedPoint?.x) &&
    Number.isFinite(projectedPoint?.y);
  const hasNormalizedPoint =
    Number.isFinite(indexTip?.u) &&
    Number.isFinite(indexTip?.v) &&
    Number.isFinite(viewport?.width) &&
    Number.isFinite(viewport?.height);
  const pointerX = hasProjectedPoint
    ? projectedPoint.x -
      (Number.isFinite(viewport?.left) ? viewport.left : 0)
    : hasNormalizedPoint
      ? indexTip.u * viewport.width
      : 0;
  const pointerY = hasProjectedPoint
    ? projectedPoint.y -
      (Number.isFinite(viewport?.top) ? viewport.top : 0)
    : hasNormalizedPoint
      ? indexTip.v * viewport.height
      : 0;
  const pointerActive = hasProjectedPoint || hasNormalizedPoint;

  return {
    handVerified: true,
    pointerActive,
    pointerX: pointerActive ? pointerX : 0,
    pointerY: pointerActive ? pointerY : 0,
  };
}
