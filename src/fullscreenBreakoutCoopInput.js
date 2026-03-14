export function selectBreakoutCoopSupportHand(hands, primaryHandId = null) {
  if (!Array.isArray(hands) || hands.length === 0) {
    return null;
  }

  const primaryHand =
    hands.find(
      (hand) =>
        hand &&
        primaryHandId &&
        (hand.id === primaryHandId || hand.label === primaryHandId),
    ) ?? hands[0] ?? null;

  if (!primaryHand) {
    return null;
  }

  return (
    hands.find((hand) => {
      if (!hand || hand === primaryHand) {
        return false;
      }
      if (primaryHand.id && hand.id) {
        return hand.id !== primaryHand.id;
      }
      if (primaryHand.label && hand.label) {
        return hand.label !== primaryHand.label;
      }
      return true;
    }) ?? null
  );
}
