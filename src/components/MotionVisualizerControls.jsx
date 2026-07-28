import { useMemo, useState } from "react";
import {
  MOTION_VISUALIZER_BUILT_IN_PRESETS,
  MOTION_VISUALIZER_EFFECTS,
  MOTION_VISUALIZER_PALETTES,
} from "../motionVisualizer.js";
import "./MotionVisualizerControls.css";

function RangeControl({ label, value, onChange, output }) {
  const id = `motion-visualizer-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label className="motion-visualizer-range" htmlFor={id}>
      <span>
        {label}
        <output htmlFor={id}>{output ?? `${value}%`}</output>
      </span>
      <input
        id={id}
        max="100"
        min="0"
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

export function MotionVisualizerControls({
  collapsed,
  settings,
  statusMessage,
  onApplyPreset,
  onChange,
  onCollapseChange,
  onDeletePreset,
  onExport,
  onSavePreset,
  onToggleFavorite,
}) {
  const [selectedPresetId, setSelectedPresetId] = useState(
    MOTION_VISUALIZER_BUILT_IN_PRESETS[0]?.id ?? "",
  );
  const selectedPresetIsSaved = useMemo(
    () =>
      settings.savedPresets.some(
        (preset) => preset.id === selectedPresetId,
      ),
    [selectedPresetId, settings.savedPresets],
  );
  const activeEffect =
    MOTION_VISUALIZER_EFFECTS.find(
      (effect) => effect.id === settings.effect,
    ) ?? MOTION_VISUALIZER_EFFECTS[0];
  const isFavorite = settings.favoriteEffects.includes(settings.effect);

  return (
    <section
      aria-label="Motion Visualizer controls"
      className={`motion-visualizer-controls ${collapsed ? "collapsed" : ""}`}
    >
      <header className="motion-visualizer-controls-header">
        <div>
          <span className="motion-visualizer-eyebrow">Motion Visualizer</span>
          <strong>{activeEffect.label}</strong>
        </div>
        <div className="motion-visualizer-header-actions">
          <button
            aria-label={
              isFavorite
                ? `Remove ${activeEffect.label} from favorites`
                : `Add ${activeEffect.label} to favorites`
            }
            aria-pressed={isFavorite}
            className="motion-visualizer-icon-button"
            onClick={onToggleFavorite}
            title={isFavorite ? "Remove favorite" : "Favorite this effect"}
            type="button"
          >
            <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
          </button>
          <button
            className="motion-visualizer-export-button"
            onClick={onExport}
            type="button"
          >
            Export artwork
          </button>
          <button
            aria-expanded={!collapsed}
            className="motion-visualizer-icon-button"
            onClick={() => onCollapseChange(!collapsed)}
            title={collapsed ? "Show remix controls" : "Hide remix controls"}
            type="button"
          >
            <span aria-hidden="true">{collapsed ? "＋" : "−"}</span>
            <span className="sr-only">
              {collapsed ? "Show remix controls" : "Hide remix controls"}
            </span>
          </button>
        </div>
      </header>

      <div
        aria-label="Choose an effect"
        className="motion-visualizer-effect-tabs"
        role="toolbar"
      >
        {MOTION_VISUALIZER_EFFECTS.map((effect, index) => {
          const selected = effect.id === settings.effect;
          const favorite = settings.favoriteEffects.includes(effect.id);
          return (
            <button
              aria-keyshortcuts={`${index + 1}`}
              aria-label={`${effect.label}${favorite ? ", favorite" : ""}`}
              aria-pressed={selected}
              className={selected ? "active" : ""}
              key={effect.id}
              onClick={() => onChange({ effect: effect.id })}
              title={effect.description}
              type="button"
            >
              {favorite ? <span aria-hidden="true">★</span> : null}
              {effect.label}
              <kbd aria-hidden="true">{index + 1}</kbd>
            </button>
          );
        })}
      </div>

      {!collapsed ? (
        <div className="motion-visualizer-remix-panel">
          <fieldset className="motion-visualizer-palettes">
            <legend>Palette</legend>
            {MOTION_VISUALIZER_PALETTES.map((palette) => (
              <button
                aria-label={`${palette.label} palette`}
                aria-pressed={palette.id === settings.palette}
                className={
                  palette.id === settings.palette ? "active" : ""
                }
                key={palette.id}
                onClick={() => onChange({ palette: palette.id })}
                style={{
                  "--palette-color-1": palette.colors[0],
                  "--palette-color-2": palette.colors[2],
                  "--palette-color-3": palette.colors[4],
                }}
                title={palette.label}
                type="button"
              >
                <span aria-hidden="true" />
                <small>{palette.label}</small>
              </button>
            ))}
          </fieldset>

          <div className="motion-visualizer-ranges">
            <RangeControl
              label="Intensity"
              onChange={(intensity) => onChange({ intensity })}
              value={settings.intensity}
            />
            <RangeControl
              label="Trails"
              onChange={(trails) => onChange({ trails })}
              value={settings.trails}
            />
            <RangeControl
              label="Camera"
              onChange={(cameraOpacity) => onChange({ cameraOpacity })}
              output={`${settings.cameraOpacity}% opacity`}
              value={settings.cameraOpacity}
            />
          </div>

          <div className="motion-visualizer-presets">
            <label htmlFor="motion-visualizer-preset">Looks</label>
            <select
              id="motion-visualizer-preset"
              onChange={(event) => setSelectedPresetId(event.target.value)}
              value={selectedPresetId}
            >
              <optgroup label="Starter looks">
                {MOTION_VISUALIZER_BUILT_IN_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </optgroup>
              {settings.savedPresets.length > 0 ? (
                <optgroup label="My saved looks">
                  {settings.savedPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            <button
              disabled={!selectedPresetId}
              onClick={() => onApplyPreset(selectedPresetId)}
              type="button"
            >
              Apply
            </button>
            <button onClick={onSavePreset} type="button">
              Save current
            </button>
            <button
              disabled={!selectedPresetIsSaved}
              onClick={() => {
                onDeletePreset(selectedPresetId);
                setSelectedPresetId(
                  MOTION_VISUALIZER_BUILT_IN_PRESETS[0]?.id ?? "",
                );
              }}
              type="button"
            >
              Delete saved
            </button>
          </div>

          <p className="motion-visualizer-instructions">
            Move one or more hands, or use mouse, touch, and arrow keys. Number
            keys 1–7 switch effects. Exported artwork never includes the camera.
          </p>
        </div>
      ) : null}

      <p
        aria-live="polite"
        className="motion-visualizer-status"
        role="status"
      >
        {statusMessage}
      </p>
    </section>
  );
}
