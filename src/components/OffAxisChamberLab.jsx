const DUST_PARTICLES = [
  { x: 12, y: 18, size: 9, delay: 0.1, duration: 8.6 },
  { x: 24, y: 72, size: 6, delay: 1.2, duration: 7.9 },
  { x: 38, y: 28, size: 12, delay: 0.7, duration: 9.4 },
  { x: 57, y: 64, size: 7, delay: 2.2, duration: 8.9 },
  { x: 71, y: 22, size: 10, delay: 1.8, duration: 10.1 },
  { x: 83, y: 55, size: 8, delay: 0.4, duration: 8.3 },
];

function formatSigned(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export default function OffAxisChamberLab({ poseStatus }) {
  const offAxis = poseStatus?.offAxis;
  const tracked = Boolean(offAxis?.detected);

  const chamberStyle = {
    "--offaxis-shift-x": `${offAxis?.cameraShiftXPx ?? 0}px`,
    "--offaxis-shift-y": `${offAxis?.cameraShiftYPx ?? 0}px`,
    "--offaxis-rotate-y": `${offAxis?.chamberRotationDeg ?? 0}deg`,
    "--offaxis-rotate-x": `${offAxis?.chamberPitchDeg ?? 0}deg`,
    "--offaxis-skew-x": `${offAxis?.skewXDeg ?? 0}deg`,
    "--offaxis-skew-y": `${offAxis?.skewYDeg ?? 0}deg`,
    "--offaxis-inset": `${Math.max(8, offAxis?.viewportInset ?? 22)}px`,
    "--offaxis-depth-boost": `${((offAxis?.depth ?? 0) * 22).toFixed(3)}px`,
  };

  return (
    <section className="card panel offaxis-panel">
      <h2>Off-Axis Chamber Lab</h2>
      <p className="small-text">
        A best-fit replica of the described peek-around concept: head motion from pose keypoints
        shifts an off-axis chamber viewport so the stone room feels deeper as you lean.
      </p>

      <div className="offaxis-status-grid">
        <div>
          <strong>Tracking</strong>
          <span>{offAxis?.status ?? "Head not detected"}</span>
        </div>
        <div>
          <strong>Confidence</strong>
          <span>{Number.isFinite(offAxis?.confidence) ? offAxis.confidence.toFixed(3) : "0.000"}</span>
        </div>
        <div>
          <strong>Head X</strong>
          <span>{formatSigned(offAxis?.offsetX ?? 0)}</span>
        </div>
        <div>
          <strong>Head Y</strong>
          <span>{formatSigned(offAxis?.offsetY ?? 0)}</span>
        </div>
        <div>
          <strong>Yaw</strong>
          <span>{formatSigned(offAxis?.yaw ?? 0)}</span>
        </div>
        <div>
          <strong>Depth</strong>
          <span>{formatSigned(offAxis?.depth ?? 0)}</span>
        </div>
      </div>

      <div className={`offaxis-chamber-stage ${tracked ? "tracked" : "idle"}`} style={chamberStyle}>
        <div className="offaxis-screen-frame">
          <div className="offaxis-chamber-view">
            <div className="offaxis-chamber-layer offaxis-layer-backwall" />
            <div className="offaxis-chamber-layer offaxis-layer-pillars">
              <div className="pillar left" />
              <div className="pillar right" />
              <div className="beam" />
            </div>
            <div className="offaxis-chamber-layer offaxis-layer-portal">
              <div className="portal-glow" />
              <div className="portal-core" />
              <div className="portal-rings" />
            </div>
            <div className="offaxis-chamber-layer offaxis-layer-floor" />
            <div className="offaxis-chamber-layer offaxis-layer-foreground">
              <div className="rock outcrop left" />
              <div className="rock outcrop center" />
              <div className="rock outcrop right" />
            </div>
            <div className="offaxis-chamber-layer offaxis-layer-dust">
              {DUST_PARTICLES.map((particle, index) => (
                <span
                  key={`${particle.x}-${particle.y}-${index}`}
                  className="dust-particle"
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    animationDelay: `${particle.delay}s`,
                    animationDuration: `${particle.duration}s`,
                  }}
                />
              ))}
            </div>
            {!tracked && (
              <div className="offaxis-empty-state">
                <strong>Move your head into frame</strong>
                <span>Keep your nose and both eyes visible to engage the off-axis camera.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="small-text">
        Lean left/right to shift the chamber, move closer to intensify depth, and keep your face in
        the upper-center of the webcam for the steadiest lock.
      </p>
    </section>
  );
}
