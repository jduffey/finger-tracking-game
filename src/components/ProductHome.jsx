import { useMemo, useState } from "react";

import {
  MODE_MATURITY,
  PRODUCT_AREAS,
  TRACKING_PROFILES,
  getFeaturedModes,
  getModeById,
} from "../modeRegistry.js";
import {
  HOME_AREA_COPY,
  filterLibraryModes,
  formatModeMetadata,
  getLibraryModes,
  selectContinueMode,
  selectDailyChallengeMode,
  selectQuickPlayMode,
} from "../productHomeModel.js";
import { getHomeAchievementSummary } from "../achievementCatalog.js";
import "../productHome.css";

const AREA_FILTERS = [
  { id: "all", label: "All" },
  { id: PRODUCT_AREAS.PLAY, label: "Play" },
  { id: PRODUCT_AREAS.CREATE, label: "Create" },
  { id: PRODUCT_AREAS.LABS, label: "Labs" },
];

function formatPlayTime(durationMs = 0) {
  const minutes = Math.round(Math.max(0, durationMs) / 60_000);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function formatResultOutcome(outcome) {
  return (
    {
      won: "Win",
      lost: "Round complete",
      draw: "Draw",
      completed: "Complete",
      abandoned: "Session ended",
    }[outcome] ?? "Complete"
  );
}

function TrackingReadiness({ readiness, onOpenSetup }) {
  const status = readiness?.status ?? "idle";
  const label =
    status === "ready"
      ? "Tracking ready"
      : status === "loading"
        ? "Preparing tracking"
        : status === "error"
          ? "Tracking needs attention"
          : "Camera is off";

  return (
    <button
      aria-label={`${label}. Open camera and tracking setup.`}
      className={`product-home-readiness ${status}`}
      onClick={onOpenSetup}
      type="button"
    >
      <span className="product-home-readiness-dot" aria-hidden="true" />
      <span>{label}</span>
      <span className="product-home-readiness-action">
        {status === "ready" ? "Check setup" : "Set up"}
      </span>
    </button>
  );
}

function MaturityBadge({ maturity }) {
  if (maturity === MODE_MATURITY.FLAGSHIP) {
    return <span className="mode-maturity flagship">Featured</span>;
  }
  if (maturity === MODE_MATURITY.PREVIEW) {
    return <span className="mode-maturity preview">Preview</span>;
  }
  if (maturity === MODE_MATURITY.EXPERIMENTAL) {
    return <span className="mode-maturity experimental">Experimental</span>;
  }
  if (maturity === MODE_MATURITY.INTERNAL) {
    return <span className="mode-maturity internal">Developer</span>;
  }
  return null;
}

function FavoriteButton({ mode, favorite, onToggleFavorite }) {
  if (!onToggleFavorite) {
    return null;
  }

  return (
    <button
      aria-label={`${favorite ? "Remove" : "Add"} ${mode.label} ${
        favorite ? "from" : "to"
      } favorites`}
      aria-pressed={favorite}
      className="mode-favorite-button"
      onClick={(event) => {
        event.stopPropagation();
        onToggleFavorite(mode.id);
      }}
      type="button"
    >
      <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
    </button>
  );
}

function ModeCard({ mode, favorite, onSelect, onToggleFavorite }) {
  const metadata = formatModeMetadata(mode);

  return (
    <article className={`product-mode-card ${mode.area}`} role="listitem">
      <button
        aria-describedby={`mode-summary-${mode.id} mode-meta-${mode.id}`}
        className="product-mode-card-action"
        onClick={() => onSelect(mode)}
        type="button"
      >
        <span className="product-mode-card-visual" aria-hidden="true">
          {mode.iconSrc ? <img alt="" src={mode.iconSrc} /> : <span>{mode.label.slice(0, 1)}</span>}
        </span>
        <span className="product-mode-card-copy">
          <span className="product-mode-card-heading">
            <strong>{mode.label}</strong>
            <MaturityBadge maturity={mode.maturity} />
          </span>
          <span className="product-mode-card-summary" id={`mode-summary-${mode.id}`}>
            {mode.summary}
          </span>
          <span className="product-mode-card-meta" id={`mode-meta-${mode.id}`}>
            {metadata.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </span>
        </span>
      </button>
      <FavoriteButton
        favorite={favorite}
        mode={mode}
        onToggleFavorite={onToggleFavorite}
      />
    </article>
  );
}

function FeaturedMode({ mode, onSelect }) {
  if (!mode) {
    return null;
  }

  return (
    <article className={`product-feature-card ${mode.area}`}>
      {mode.iconSrc ? <img alt="" className="product-feature-icon" src={mode.iconSrc} /> : null}
      <div className="product-feature-copy">
        <span className="product-feature-kicker">
          {mode.area === PRODUCT_AREAS.CREATE ? "Create something" : "Featured challenge"}
        </span>
        <h2>{mode.label}</h2>
        <p>{mode.objective ?? mode.summary}</p>
        <div className="product-feature-meta">
          {formatModeMetadata(mode).map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <button className="product-primary-action" onClick={() => onSelect(mode)} type="button">
          Open {mode.label}
        </button>
      </div>
    </article>
  );
}

export default function ProductHome({
  readiness,
  progression,
  latestResult,
  recentModeIds = [],
  favoriteModeIds = [],
  onSelectMode,
  onOpenSetup,
  onOpenSettings,
  onToggleFavorite,
}) {
  const [query, setQuery] = useState("");
  const [activeArea, setActiveArea] = useState("all");
  const [maxMinutes, setMaxMinutes] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState("all");
  const [playersFilter, setPlayersFilter] = useState("all");
  const libraryModes = useMemo(() => getLibraryModes(), []);
  const featuredModes = useMemo(() => getFeaturedModes(), []);
  const favoriteSet = useMemo(() => new Set(favoriteModeIds), [favoriteModeIds]);
  const filteredModes = useMemo(
    () =>
      filterLibraryModes(libraryModes, {
        query,
        area: activeArea,
        maxMinutes: maxMinutes === "all" ? null : Number(maxMinutes),
        trackingProfile: trackingFilter,
        players: playersFilter === "all" ? null : Number(playersFilter),
      }),
    [
      activeArea,
      libraryModes,
      maxMinutes,
      playersFilter,
      query,
      trackingFilter,
    ],
  );
  const quickPlayMode = useMemo(
    () => selectQuickPlayMode({ recentModeIds, randomValue: 0 }),
    [recentModeIds],
  );
  const leadMode = featuredModes.find((mode) => mode.id === "sky-patrol") ?? featuredModes[0];
  const dailyMode = useMemo(() => selectDailyChallengeMode(), []);
  const continueMode = selectContinueMode(recentModeIds);
  const favoriteModes = favoriteModeIds
    .map((modeId) => getModeById(modeId))
    .filter(Boolean)
    .slice(0, 3);
  const totals = progression?.totals ?? {};
  const recentResult =
    latestResult ?? progression?.recentResults?.[0] ?? null;
  const recentResultMode = recentResult
    ? getModeById(recentResult.modeId)
    : null;
  const hasProgress = (totals.sessionsPlayed ?? 0) > 0;
  const achievementSummary = useMemo(
    () => getHomeAchievementSummary(progression),
    [progression],
  );

  return (
    <div className="product-home">
      <a className="product-skip-link" href="#experience-library">
        Skip to experience library
      </a>
      <header className="product-home-header">
        <div className="product-home-brand">
          <span className="product-home-brand-mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>Motion Arcade</strong>
            <small>Play with movement. Create with your hands.</small>
          </span>
        </div>
        <div className="product-home-header-actions">
          <TrackingReadiness readiness={readiness} onOpenSetup={onOpenSetup} />
          <button
            aria-label="Open settings"
            className="product-home-icon-button"
            onClick={onOpenSettings}
            type="button"
          >
            <span aria-hidden="true">⚙</span>
            <span className="product-home-settings-label">Settings</span>
          </button>
        </div>
      </header>

      <main className="product-home-main">
        <section className="product-home-hero" aria-labelledby="home-title">
          <div className="product-home-intro">
            <span className="product-home-eyebrow">Webcam-powered play</span>
            <h1 id="home-title">Move, play, and make something surprising.</h1>
            <p>
              Short arcade challenges and creative tools that turn natural movement into
              immediate feedback. Camera processing stays on this device.
            </p>
            <div className="product-home-hero-actions">
              <button
                className="product-primary-action"
                disabled={!quickPlayMode}
                onClick={() => quickPlayMode && onSelectMode(quickPlayMode)}
                type="button"
              >
                Quick play
              </button>
              <button className="product-secondary-action" onClick={onOpenSetup} type="button">
                Check my setup
              </button>
            </div>
          </div>
          <FeaturedMode mode={leadMode} onSelect={onSelectMode} />
        </section>

        <section
          aria-labelledby="home-shortcuts-title"
          className="product-home-shortcuts"
        >
          <div className="product-shortcuts-heading">
            <div>
              <span className="product-home-eyebrow">For you</span>
              <h2 id="home-shortcuts-title">
                {hasProgress ? "Pick up where you left off" : "A great first session"}
              </h2>
            </div>
            {hasProgress ? (
              <dl className="product-progress-summary" aria-label="Local play summary">
                <div>
                  <dt>Sessions</dt>
                  <dd>{totals.sessionsPlayed ?? 0}</dd>
                </div>
                <div>
                  <dt>Wins</dt>
                  <dd>{totals.wins ?? 0}</dd>
                </div>
                <div>
                  <dt>Play time</dt>
                  <dd>{formatPlayTime(totals.playTimeMs)}</dd>
                </div>
                <div>
                  <dt>Medals</dt>
                  <dd>
                    {achievementSummary.unlockedCount}/{achievementSummary.totalCount}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>

          <div className="product-shortcut-grid">
            {continueMode ? (
              <button
                className="product-shortcut-card continue"
                onClick={() => onSelectMode(continueMode)}
                type="button"
              >
                <span>Continue</span>
                <strong>{continueMode.label}</strong>
                <small>{continueMode.controlHint}</small>
              </button>
            ) : null}
            {dailyMode ? (
              <button
                className="product-shortcut-card daily"
                onClick={() => onSelectMode(dailyMode)}
                type="button"
              >
                <span>Daily challenge</span>
                <strong>{dailyMode.label}</strong>
                <small>Today’s shared local challenge</small>
              </button>
            ) : null}
            {recentResult && recentResultMode ? (
              <div className="product-shortcut-card result" role="status">
                <span>{formatResultOutcome(recentResult.outcome)}</span>
                <strong>{recentResultMode.label}</strong>
                <small>
                  {Number.isFinite(recentResult.score)
                    ? `Score ${recentResult.score}`
                    : formatPlayTime(recentResult.durationMs)}
                </small>
              </div>
            ) : null}
            {favoriteModes.map((mode) => (
              <button
                className="product-shortcut-card favorite"
                key={mode.id}
                onClick={() => onSelectMode(mode)}
                type="button"
              >
                <span>Favorite</span>
                <strong>{mode.label}</strong>
                <small>{mode.typicalMinutes} min · {mode.difficulty}</small>
              </button>
            ))}
          </div>
          {achievementSummary.next ? (
            <div className="product-achievement-progress">
              <span aria-hidden="true">◎</span>
              <div>
                <strong>Next medal: {achievementSummary.next.title}</strong>
                <small>
                  {achievementSummary.next.description}{" "}
                  {achievementSummary.next.progressState.label}
                </small>
              </div>
              <progress
                aria-label={`Progress toward ${achievementSummary.next.title}`}
                max="1"
                value={achievementSummary.next.progressState.ratio}
              />
            </div>
          ) : null}
        </section>

        <section className="product-library" id="experience-library" aria-labelledby="library-title">
          <div className="product-library-heading">
            <div>
              <span className="product-home-eyebrow">Experience library</span>
              <h2 id="library-title">Choose your next move</h2>
            </div>
            <label className="product-library-search">
              <span className="sr-only">Search experiences</span>
              <input
                aria-controls="experience-list"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by game, gesture, or difficulty"
                type="search"
                value={query}
              />
            </label>
          </div>

          <div
            aria-controls="experience-list"
            className="product-area-tabs"
            role="group"
            aria-label="Filter experiences"
          >
            {AREA_FILTERS.map((filter) => (
              <button
                aria-pressed={activeArea === filter.id}
                className={activeArea === filter.id ? "active" : ""}
                key={filter.id}
                onClick={() => setActiveArea(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="product-library-filters" aria-label="More experience filters">
            <label>
              <span>Round length</span>
              <select
                onChange={(event) => setMaxMinutes(event.target.value)}
                value={maxMinutes}
              >
                <option value="all">Any length</option>
                <option value="2">2 minutes or less</option>
                <option value="5">5 minutes or less</option>
                <option value="10">10 minutes or less</option>
              </select>
            </label>
            <label>
              <span>Movement</span>
              <select
                onChange={(event) => setTrackingFilter(event.target.value)}
                value={trackingFilter}
              >
                <option value="all">Any movement</option>
                <option value={TRACKING_PROFILES.ONE_HAND}>One hand</option>
                <option value={TRACKING_PROFILES.TWO_HANDS}>Two hands</option>
                <option value={TRACKING_PROFILES.MULTI_HAND}>Group / multi-hand</option>
                <option value={TRACKING_PROFILES.POSE}>Full body</option>
              </select>
            </label>
            <label>
              <span>Players</span>
              <select
                onChange={(event) => setPlayersFilter(event.target.value)}
                value={playersFilter}
              >
                <option value="all">Any group size</option>
                <option value="1">Solo</option>
                <option value="2">Two players / hands</option>
                <option value="4">Group</option>
              </select>
            </label>
          </div>

          {activeArea !== "all" && HOME_AREA_COPY[activeArea] ? (
            <p className="product-area-summary">{HOME_AREA_COPY[activeArea].summary}</p>
          ) : null}

          {activeArea === PRODUCT_AREAS.LABS ? (
            <aside className="product-labs-notice">
              <strong>Labs are experiments.</strong>
              <span>
                They expose early interaction ideas and diagnostics, so controls and goals may
                change.
              </span>
            </aside>
          ) : null}

          <div
            aria-label={`${filteredModes.length} available ${
              filteredModes.length === 1 ? "experience" : "experiences"
            }`}
            className="product-mode-grid"
            id="experience-list"
            role="list"
          >
            {filteredModes.map((mode) => (
              <ModeCard
                favorite={favoriteSet.has(mode.id)}
                key={mode.id}
                mode={mode}
                onSelect={onSelectMode}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>

          {filteredModes.length === 0 ? (
            <div className="product-library-empty" role="status">
              <strong>No experiences match that search.</strong>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveArea("all");
                  setMaxMinutes("all");
                  setTrackingFilter("all");
                  setPlayersFilter("all");
                }}
                type="button"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
