export function shouldShowFullscreenInvadersBanner(state) {
  if (!state?.message) {
    return false;
  }

  return state.status === "gameover" || state.status === "cleared";
}
