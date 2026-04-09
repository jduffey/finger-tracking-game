const FIREFLIES = [
  { x: 14, y: 18, size: 7, delay: 0.2, duration: 5.6 },
  { x: 22, y: 54, size: 6, delay: 1.4, duration: 6.8 },
  { x: 35, y: 26, size: 9, delay: 0.8, duration: 7.1 },
  { x: 52, y: 20, size: 8, delay: 1.7, duration: 6.2 },
  { x: 66, y: 46, size: 7, delay: 0.5, duration: 7.6 },
  { x: 81, y: 24, size: 8, delay: 2.1, duration: 5.9 },
  { x: 88, y: 58, size: 6, delay: 1.1, duration: 6.7 },
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

  const sceneStyle = {
    "--offaxis-shift-x": `${offAxis?.cameraShiftXPx ?? 0}px`,
    "--offaxis-shift-y": `${offAxis?.cameraShiftYPx ?? 0}px`,
    "--offaxis-rotate-y": `${offAxis?.chamberRotationDeg ?? 0}deg`,
    "--offaxis-rotate-x": `${offAxis?.chamberPitchDeg ?? 0}deg`,
    "--offaxis-skew-x": `${offAxis?.skewXDeg ?? 0}deg`,
    "--offaxis-skew-y": `${offAxis?.skewYDeg ?? 0}deg`,
    "--offaxis-inset": `${Math.max(6, offAxis?.viewportInset ?? 22)}px`,
    "--offaxis-depth-boost": `${((offAxis?.depth ?? 0) * 20).toFixed(3)}px`,
  };

  return (
    <section className="card panel offaxis-panel">
      <h2>Off-Axis Forest Walk</h2>
      <p className="small-text">
        Lean left and right like you are walking past trees on a woodland trail. Nearby trunks move
        faster than the distant hills so the screen reads like a little 3D window.
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
          <strong>Lean X</strong>
          <span>{formatSigned(offAxis?.offsetX ?? 0)}</span>
        </div>
        <div>
          <strong>Lean Y</strong>
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

      <div className={`offaxis-chamber-stage ${tracked ? "tracked" : "idle"}`} style={sceneStyle}>
        <div className="offaxis-screen-frame">
          <div className="offaxis-chamber-view offaxis-forest-view">
            <div className="offaxis-chamber-layer offaxis-forest-sky" />
            <div className="offaxis-chamber-layer offaxis-forest-far-hills" />
            <div className="offaxis-chamber-layer offaxis-forest-mid-trees">
              <span className="tree tree-a" />
              <span className="tree tree-b" />
              <span className="tree tree-c" />
              <span className="tree tree-d" />
              <span className="tree tree-e" />
            </div>
            <div className="offaxis-chamber-layer offaxis-forest-path" />
            <div className="offaxis-chamber-layer offaxis-forest-near-trees">
              <span className="tree tree-left" />
              <span className="tree tree-right" />
              <span className="tree tree-center-left" />
              <span className="tree tree-center-right" />
            </div>
            <div className="offaxis-chamber-layer offaxis-forest-foreground">
              <span className="fern fern-left" />
              <span className="fern fern-center" />
              <span className="fern fern-right" />
            </div>
            <div className="offaxis-chamber-layer offaxis-forest-fireflies">
              {FIREFLIES.map((firefly, index) => (
                <span
                  key={`${firefly.x}-${firefly.y}-${index}`}
                  className="firefly"
                  style={{
                    left: `${firefly.x}%`,
                    top: `${firefly.y}%`,
                    width: `${firefly.size}px`,
                    height: `${firefly.size}px`,
                    animationDelay: `${firefly.delay}s`,
                    animationDuration: `${firefly.duration}s`,
                  }}
                />
              ))}
            </div>
            {!tracked && (
              <div className="offaxis-empty-state">
                <strong>Move your face into frame</strong>
                <span>Show your nose and both eyes, then lean left and right to look around the trees.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="small-text">
        Best effect: sit an arm’s length from the screen and keep your head in the upper-middle of
        the camera while you sway left and right.
      </p>
    </section>
  );
}
