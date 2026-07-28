import { useRef, useState } from "react";

import "../settingsPanel.css";

function SettingRow({ controlId, title, description, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <label htmlFor={controlId} id={`${controlId}-label`}>
          {title}
        </label>
        {description ? <span>{description}</span> : null}
      </div>
      <div className="settings-row-control">{children}</div>
    </div>
  );
}

function RangeSetting({
  id,
  title,
  description,
  min,
  max,
  step,
  value,
  valueLabel,
  onChange,
}) {
  return (
    <SettingRow controlId={id} description={description} title={title}>
      <div className="settings-range">
        <input
          aria-labelledby={`${id}-label`}
          aria-valuetext={valueLabel}
          id={id}
          max={max}
          min={min}
          onChange={(event) => onChange(Number(event.target.value))}
          step={step}
          type="range"
          value={value}
        />
        <output htmlFor={id}>{valueLabel}</output>
      </div>
    </SettingRow>
  );
}

function Toggle({ checked, id, onChange }) {
  return (
    <label className="settings-toggle" htmlFor={id}>
      <input
        aria-labelledby={`${id}-label`}
        checked={checked}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" />
    </label>
  );
}

export default function SettingsPanel({
  preferences,
  capabilities,
  qualityBudget,
  trackingFps = 0,
  onChange,
  onBack,
  onReset,
  onDeleteLocalData,
  onStopCamera,
  cameraActive = false,
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteTriggerRef = useRef(null);
  const update = (key, value) => onChange({ ...preferences, [key]: value });
  const cancelDelete = () => {
    setConfirmingDelete(false);
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="settings-back" onClick={onBack} type="button">
          <span aria-hidden="true">←</span> Home
        </button>
        <div>
          <span>Motion Arcade</span>
          <strong>Settings</strong>
        </div>
      </header>

      <main className="settings-main">
        <div className="settings-title">
          <span className="settings-kicker">Make it comfortable</span>
          <h1>Settings</h1>
          <p>Adjust input, motion, sound, and camera behavior once for every experience.</p>
        </div>

        <section className="settings-section" aria-labelledby="settings-input">
          <div className="settings-section-heading">
            <h2 id="settings-input">Input & comfort</h2>
            <p>Choose controls that work well for your movement and setup.</p>
          </div>
          <div className="settings-card">
            <SettingRow
              controlId="dominant-hand"
              description="Used for one-hand tutorials and player-side defaults."
              title="Dominant hand"
            >
              <select
                id="dominant-hand"
                onChange={(event) => update("dominantHand", event.target.value)}
                value={preferences.dominantHand}
              >
                <option value="auto">Automatic</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </SettingRow>
            <SettingRow
              controlId="seated-mode"
              description="Optimizes instructions and movement ranges for seated play."
              title="Seated mode"
            >
              <Toggle
                checked={preferences.seatedMode}
                id="seated-mode"
                onChange={(value) => update("seatedMode", value)}
              />
            </SettingRow>
            <SettingRow
              controlId="mirror-camera"
              description="Matches movement to a familiar mirror view."
              title="Mirror camera"
            >
              <Toggle
                checked={preferences.mirrorCamera}
                id="mirror-camera"
                onChange={(value) => update("mirrorCamera", value)}
              />
            </SettingRow>
            <RangeSetting
              description="Choose immediate selection or extra time to avoid accidental activation."
              id="dwell-duration"
              max={2000}
              min={0}
              onChange={(value) => update("dwellDurationMs", value)}
              step={250}
              title="Dwell selection time"
              value={preferences.dwellDurationMs}
              valueLabel={
                preferences.dwellDurationMs === 0
                  ? "Off"
                  : `${(preferences.dwellDurationMs / 1000).toFixed(2)} s`
              }
            />
            <RangeSetting
              description="Higher smoothing is steadier; lower smoothing responds faster."
              id="cursor-smoothing"
              max={0.9}
              min={0.05}
              onChange={(value) => update("cursorSmoothing", value)}
              step={0.05}
              title="Pointer smoothing"
              value={preferences.cursorSmoothing}
              valueLabel={`${Math.round(preferences.cursorSmoothing * 100)}%`}
            />
            <RangeSetting
              description="Adjust how close thumb and index must be to count as a pinch."
              id="pinch-threshold"
              max={0.09}
              min={0.02}
              onChange={(value) => update("pinchThreshold", value)}
              step={0.005}
              title="Pinch sensitivity"
              value={preferences.pinchThreshold}
              valueLabel={preferences.pinchThreshold.toFixed(3)}
            />
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-display">
          <div className="settings-section-heading">
            <h2 id="settings-display">Display & motion</h2>
            <p>Reduce sensory load or make controls and text easier to see.</p>
          </div>
          <div className="settings-card">
            <SettingRow
              controlId="reduced-motion"
              description="Minimizes parallax, trails, pulsing, and large transitions."
              title="Reduced motion"
            >
              <Toggle
                checked={preferences.reducedMotion}
                id="reduced-motion"
                onChange={(value) => update("reducedMotion", value)}
              />
            </SettingRow>
            <SettingRow
              controlId="high-contrast"
              description="Uses stronger edges and less transparent interface surfaces."
              title="High contrast"
            >
              <Toggle
                checked={preferences.highContrast}
                id="high-contrast"
                onChange={(value) => update("highContrast", value)}
              />
            </SettingRow>
            <SettingRow
              controlId="low-sensory-effects"
              description="Reduces particles, flashes, shake, and sharp audio transients."
              title="Low-sensory effects"
            >
              <Toggle
                checked={preferences.lowSensory}
                id="low-sensory-effects"
                onChange={(value) => update("lowSensory", value)}
              />
            </SettingRow>
            <RangeSetting
              id="ui-scale"
              max={1.35}
              min={0.9}
              onChange={(value) => update("uiScale", value)}
              step={0.05}
              title="Interface size"
              value={preferences.uiScale}
              valueLabel={`${Math.round(preferences.uiScale * 100)}%`}
            />
            <RangeSetting
              id="cursor-scale"
              max={2}
              min={0.75}
              onChange={(value) => update("cursorScale", value)}
              step={0.05}
              title="Tracking pointer size"
              value={preferences.cursorScale}
              valueLabel={`${Math.round(preferences.cursorScale * 100)}%`}
            />
            <SettingRow
              controlId="performance-mode"
              description="Automatic adapts to the device and live frame rate. Battery Saver favors cooler, lighter play."
              title="Performance"
            >
              <select
                id="performance-mode"
                onChange={(event) => update("performanceMode", event.target.value)}
                value={preferences.performanceMode}
              >
                <option value="auto">Automatic</option>
                <option value="battery">Battery Saver</option>
                <option value="quality">High Quality</option>
              </select>
            </SettingRow>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-device">
          <div className="settings-section-heading">
            <h2 id="settings-device">Device readiness</h2>
            <p>
              These checks never open your camera. They help Motion Arcade choose a smooth
              starting point.
            </p>
          </div>
          <div className="settings-card settings-capability-card">
            <dl className="settings-capability-grid">
              <div>
                <dt>Camera API</dt>
                <dd>{capabilities?.camera?.status ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Graphics</dt>
                <dd>{capabilities?.graphics?.preferredApi ?? "Unknown"}</dd>
              </div>
              <div>
                <dt>Active quality</dt>
                <dd>{qualityBudget?.level ?? "Automatic"}</dd>
              </div>
              <div>
                <dt>Tracking rate</dt>
                <dd>
                  {trackingFps > 0
                    ? `${Math.round(trackingFps)} fps`
                    : `Up to ${qualityBudget?.inferenceFps ?? "—"} fps`}
                </dd>
              </div>
            </dl>
            {capabilities?.issues?.length ? (
              <ul className="settings-capability-notices">
                {capabilities.issues.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            ) : (
              <p className="settings-capability-ready">
                This device has the browser features needed for the full experience.
              </p>
            )}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-sound">
          <div className="settings-section-heading">
            <h2 id="settings-sound">Sound</h2>
            <p>Keep audio feedback useful without making it overwhelming.</p>
          </div>
          <div className="settings-card">
            <SettingRow controlId="mute-all-sound" title="Mute all sound">
              <Toggle
                checked={preferences.muted}
                id="mute-all-sound"
                onChange={(value) => update("muted", value)}
              />
            </SettingRow>
            <RangeSetting
              id="master-volume"
              max={1}
              min={0}
              onChange={(value) => update("masterVolume", value)}
              step={0.05}
              title="Master volume"
              value={preferences.masterVolume}
              valueLabel={`${Math.round(preferences.masterVolume * 100)}%`}
            />
            <RangeSetting
              id="music-volume"
              max={1}
              min={0}
              onChange={(value) => update("musicVolume", value)}
              step={0.05}
              title="Music volume"
              value={preferences.musicVolume}
              valueLabel={`${Math.round(preferences.musicVolume * 100)}%`}
            />
            <RangeSetting
              id="effects-volume"
              max={1}
              min={0}
              onChange={(value) => update("effectsVolume", value)}
              step={0.05}
              title="Effects volume"
              value={preferences.effectsVolume}
              valueLabel={`${Math.round(preferences.effectsVolume * 100)}%`}
            />
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-privacy">
          <div className="settings-section-heading">
            <h2 id="settings-privacy">Camera & local data</h2>
            <p>
              Camera frames stay on this device. Preferences, calibration, personalized gesture
              samples, and records may be stored locally in this browser.
            </p>
          </div>
          <div className="settings-card settings-data-actions">
            <SettingRow
              controlId="camera-preview"
              description="Choose how much room the camera preview uses outside setup."
              title="Camera preview"
            >
              <select
                id="camera-preview"
                onChange={(event) => update("cameraPreview", event.target.value)}
                value={preferences.cameraPreview}
              >
                <option value="hidden">Hidden</option>
                <option value="compact">Compact</option>
                <option value="expanded">Expanded</option>
              </select>
            </SettingRow>
            <div className="settings-camera-action">
              <button disabled={!cameraActive} onClick={onStopCamera} type="button">
                Stop camera
              </button>
              <span>{cameraActive ? "Camera is currently active." : "Camera is already off."}</span>
            </div>
            <button onClick={onReset} type="button">
              Reset settings
            </button>
            <a className="settings-privacy-link" href="/privacy.html">
              Read privacy details
            </a>
            {confirmingDelete ? (
              <div
                aria-labelledby="delete-local-data-confirmation"
                className="settings-delete-confirmation"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    cancelDelete();
                  }
                }}
                role="alertdialog"
              >
                <strong id="delete-local-data-confirmation">
                  Delete preferences, calibration, samples, and local records?
                </strong>
                <div>
                  <button autoFocus onClick={cancelDelete} type="button">
                    Cancel
                  </button>
                  <button
                    className="danger danger-confirm"
                    onClick={() => {
                      setConfirmingDelete(false);
                      onDeleteLocalData();
                    }}
                    type="button"
                  >
                    Yes, delete local data
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="danger"
                onClick={() => setConfirmingDelete(true)}
                ref={deleteTriggerRef}
                type="button"
              >
                Delete all local app data
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
