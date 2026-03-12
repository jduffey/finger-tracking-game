export const CONVEYOR_AUTO_THROW_BACK_SPEED = 1580;
export const CONVEYOR_MAX_RELEASE_SPEED_BONUS = 640;
export const CONVEYOR_RELEASE_SPEED_TO_THROW_RATIO = 0.45;

export function computeConveyorBackLaunchSpeed(vx = 0, vy = 0) {
  const safeVx = Number.isFinite(vx) ? vx : 0;
  const safeVy = Number.isFinite(vy) ? vy : 0;
  const releaseSpeed = Math.hypot(safeVx, safeVy);
  const launchBonus = Math.min(
    CONVEYOR_MAX_RELEASE_SPEED_BONUS,
    releaseSpeed * CONVEYOR_RELEASE_SPEED_TO_THROW_RATIO,
  );
  return Math.round(CONVEYOR_AUTO_THROW_BACK_SPEED + launchBonus);
}
