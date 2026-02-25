export default function BodyPoseLab({ poseStatus }) {
  const detected = Boolean(poseStatus?.detected);
  const parts = poseStatus?.parts ?? {
    head: false,
    eyes: false,
    shoulders: false,
    arms: false,
    torso: false,
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
      </div>

      <div className="body-part-list">
        <div className={parts.head ? "active" : "inactive"}>Head</div>
        <div className={parts.eyes ? "active" : "inactive"}>Eyes</div>
        <div className={parts.shoulders ? "active" : "inactive"}>Shoulders</div>
        <div className={parts.arms ? "active" : "inactive"}>Arms</div>
        <div className={parts.torso ? "active" : "inactive"}>Torso</div>
      </div>

      <p className="small-text">
        Tip: step back until your shoulders and wrists are in frame for best arm highlighting.
      </p>
    </section>
  );
}
