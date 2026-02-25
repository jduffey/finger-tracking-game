export default function BodyPoseLab({ poseStatus }) {
  const detected = Boolean(poseStatus?.detected);
  const parts = poseStatus?.parts ?? {
    head: false,
    eyes: false,
    shoulders: false,
    arms: false,
    torso: false,
    fingers: false,
    fingertips: false,
  };

  return (
    <section className="card panel body-pose-panel">
      <h2>Body Pose Highlight Lab</h2>
      <p className="small-text">
        Centered webcam mode with live body keypoint highlighting for head, eyes, shoulders, arms,
        and torso.
      </p>

      <div className="body-pose-status-grid">
        <div>
          <strong>Pose</strong>
          <span>{detected ? "detected" : "not detected"}</span>
        </div>
        <div>
          <strong>Score</strong>
          <span>{Number.isFinite(poseStatus?.score) ? poseStatus.score.toFixed(3) : "0.000"}</span>
        </div>
        <div>
          <strong>Keypoints</strong>
          <span>{poseStatus?.keypointsCount ?? 0}</span>
        </div>
        <div>
          <strong>Hands</strong>
          <span>{poseStatus?.handsCount ?? 0}</span>
        </div>
        <div>
          <strong>Fingers</strong>
          <span>{poseStatus?.fingerCount ?? 0}</span>
        </div>
        <div>
          <strong>Finger tips</strong>
          <span>{poseStatus?.fingertipCount ?? 0}</span>
        </div>
      </div>

      <div className="body-part-list">
        <div className={parts.head ? "active" : "inactive"}>Head</div>
        <div className={parts.eyes ? "active" : "inactive"}>Eyes</div>
        <div className={parts.shoulders ? "active" : "inactive"}>Shoulders</div>
        <div className={parts.arms ? "active" : "inactive"}>Arms</div>
        <div className={parts.torso ? "active" : "inactive"}>Torso</div>
        <div className={parts.fingers ? "active" : "inactive"}>Fingers</div>
        <div className={parts.fingertips ? "active" : "inactive"}>Finger tips</div>
      </div>

      <p className="small-text">
        Tip: keep your upper body and both hands visible to light up the body and fingertip indicators.
      </p>
    </section>
  );
}
