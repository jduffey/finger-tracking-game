export default function WebcamBackground({
  videoRef,
  overlayCanvasRef,
  cameraObjectFit,
  videoClassName = "",
}) {
  const className = ["camera-video fullscreen-camera-video", videoClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <video
        ref={videoRef}
        className={className}
        style={{ objectFit: cameraObjectFit }}
        playsInline
        muted
        autoPlay
      />
      <canvas ref={overlayCanvasRef} className="camera-overlay" />
    </>
  );
}
