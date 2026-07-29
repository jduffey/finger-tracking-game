import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  MODE_MATURITY,
  PRODUCT_AREAS,
  TRACKING_PROFILES,
  getFeaturedModes,
  getModeById,
} from "../modeRegistry.js";
import {
  HOME_AREA_COPY,
  LIBRARY_COLLECTIONS,
  filterLibraryModes,
  formatModeMetadata,
  getLibraryModes,
  hasReturningHomeActivity,
  selectContinueMode,
  selectDailyChallengeMode,
  selectHomeRecommendations,
  selectLibraryCollectionModes,
  selectQuickPlayMode,
} from "../productHomeModel.js";
import { getHomeAchievementSummary } from "../achievementCatalog.js";
import "../productHome.css";

const MyCreationsLauncher = lazy(
  () => import("./MyCreationsLauncher.jsx"),
);

const AREA_FILTERS = [
  { id: "all", label: "All" },
  { id: PRODUCT_AREAS.PLAY, label: "Play" },
  { id: PRODUCT_AREAS.CREATE, label: "Create" },
  { id: PRODUCT_AREAS.LABS, label: "Labs" },
];

const DIFFICULTY_FILTERS = [
  { id: "all", label: "Any difficulty" },
  { id: "Easy", label: "Easy" },
  { id: "Medium", label: "Medium" },
  { id: "Hard", label: "Hard" },
  { id: "Adaptive", label: "Adaptive" },
  { id: "Open play", label: "Open play" },
];

const LIBRARY_COLLECTION_FILTERS = [
  { id: LIBRARY_COLLECTIONS.ALL, label: "All" },
  { id: LIBRARY_COLLECTIONS.FAVORITES, label: "Favorites" },
  { id: LIBRARY_COLLECTIONS.RECENT, label: "Recent" },
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

function TrackingReadiness({
  cameraActive,
  readiness,
  onOpenSetup,
  onStopCamera,
}) {
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
    <div className="product-home-camera-controls">
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
      {cameraActive && onStopCamera ? (
        <button
          aria-label="Camera is on. Turn camera off."
          className="product-home-camera-stop"
          onClick={onStopCamera}
          type="button"
        >
          <span aria-hidden="true">●</span>
          <span className="product-home-camera-stop-label">Turn camera off</span>
        </button>
      ) : null}
    </div>
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
  capabilities,
  progression,
  latestResult,
  recentModeIds = [],
  favoriteModeIds = [],
  onSelectMode,
  onOpenSetup,
  onOpenSettings,
  onStopCamera,
  onSelectArea,
  onToggleFavorite,
  cameraActive = false,
  initialArea = "all",
}) {
  const [query, setQuery] = useState("");
  const [activeArea, setActiveArea] = useState(initialArea);
  const [maxMinutes, setMaxMinutes] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [trackingFilter, setTrackingFilter] = useState("all");
  const [playersFilter, setPlayersFilter] = useState("all");
  const [seatedOnly, setSeatedOnly] = useState(false);
  const [libraryCollection, setLibraryCollection] = useState(
    LIBRARY_COLLECTIONS.ALL,
  );
  const lastQuickPlayModeIdRef = useRef(null);
  const libraryModes = useMemo(() => getLibraryModes(), []);
  const featuredModes = useMemo(() => getFeaturedModes(), []);
  const favoriteSet = useMemo(
    () => new Set(Array.isArray(favoriteModeIds) ? favoriteModeIds : []),
    [favoriteModeIds],
  );
  const favoriteModes = useMemo(
    () =>
      selectLibraryCollectionModes(libraryModes, {
        collection: LIBRARY_COLLECTIONS.FAVORITES,
        favoriteModeIds,
      }),
    [favoriteModeIds, libraryModes],
  );
  const recentModes = useMemo(
    () =>
      selectLibraryCollectionModes(libraryModes, {
        collection: LIBRARY_COLLECTIONS.RECENT,
        recentModeIds,
      }),
    [libraryModes, recentModeIds],
  );
  const collectionModes =
    libraryCollection === LIBRARY_COLLECTIONS.FAVORITES
      ? favoriteModes
      : libraryCollection === LIBRARY_COLLECTIONS.RECENT
        ? recentModes
        : libraryModes;
  const filteredModes = useMemo(
    () =>
      filterLibraryModes(collectionModes, {
        query,
        area: activeArea,
        maxMinutes: maxMinutes === "all" ? null : Number(maxMinutes),
        difficulty: difficultyFilter,
        trackingProfile: trackingFilter,
        players: playersFilter === "all" ? null : Number(playersFilter),
        seatedOnly,
      }),
    [
      activeArea,
      collectionModes,
      difficultyFilter,
      maxMinutes,
      playersFilter,
      query,
      seatedOnly,
      trackingFilter,
    ],
  );
  const arcadeRunMode = useMemo(() => getModeById("arcade-run"), []);
  const leadMode = featuredModes.find((mode) => mode.id === "sky-patrol") ?? featuredModes[0];
  const totals = progression?.totals ?? {};
  const recentResult =
    latestResult ?? progression?.recentResults?.[0] ?? null;
  const recentResultMode = recentResult
    ? getModeById(recentResult.modeId)
    : null;
  const dailyMode = useMemo(() => selectDailyChallengeMode(), []);
  const continueMode = selectContinueMode([
    ...(Array.isArray(recentModeIds) ? recentModeIds : []),
    recentResult?.modeId,
  ]);
  const isReturningUser = hasReturningHomeActivity({
    progression,
    latestResult,
    recentModeIds,
    favoriteModeIds,
  });
  const recommendationModes = useMemo(
    () =>
      selectHomeRecommendations({
        recentModeIds,
        favoriteModeIds,
        excludedModeIds: [continueMode?.id, dailyMode?.id],
        limit: 2,
      }),
    [
      continueMode?.id,
      dailyMode?.id,
      favoriteModeIds,
      recentModeIds,
    ],
  );
  const canQuickPlay = featuredModes.some(
    (mode) =>
      mode.area === PRODUCT_AREAS.PLAY &&
      mode.maturity !== MODE_MATURITY.EXPERIMENTAL &&
      mode.maturity !== MODE_MATURITY.INTERNAL,
  );
  const achievementSummary = useMemo(
    () => getHomeAchievementSummary(progression),
    [progression],
  );
  const isMobileDevice =
    capabilities?.device?.formFactor === "mobile";

  useEffect(() => {
    setActiveArea(initialArea);
  }, [initialArea]);

  function launchQuickPlay() {
    const quickPlayMode = selectQuickPlayMode({
      recentModeIds,
      excludedModeIds: [lastQuickPlayModeIdRef.current],
      randomValue: Math.random(),
    });
    if (!quickPlayMode) {
      return;
    }
    lastQuickPlayModeIdRef.current = quickPlayMode.id;
    onSelectMode(quickPlayMode);
  }

  function launchDaily() {
    if (!dailyMode) {
      return;
    }
    onSelectMode(dailyMode, {
      launchContext: {
        challenge: "daily",
        dayKey: new Date().toISOString().slice(0, 10),
      },
    });
  }

  function clearLibraryFilters({ showEverything = false } = {}) {
    setQuery("");
    setActiveArea("all");
    setMaxMinutes("all");
    setDifficultyFilter("all");
    setTrackingFilter("all");
    setPlayersFilter("all");
    setSeatedOnly(false);
    if (showEverything) {
      setLibraryCollection(LIBRARY_COLLECTIONS.ALL);
    }
    onSelectArea?.("all");
  }

  const collectionCounts = {
    [LIBRARY_COLLECTIONS.ALL]: libraryModes.length,
    [LIBRARY_COLLECTIONS.FAVORITES]: favoriteModes.length,
    [LIBRARY_COLLECTIONS.RECENT]: recentModes.length,
  };
  const selectedCollectionIsEmpty =
    libraryCollection !== LIBRARY_COLLECTIONS.ALL &&
    collectionModes.length === 0;
  const emptyState =
    libraryCollection === LIBRARY_COLLECTIONS.FAVORITES
      ? selectedCollectionIsEmpty
        ? {
            title: "No favorites yet.",
            detail:
              "Select the star on any Play, Create, or Labs experience to keep it here.",
          }
        : {
            title: "No favorites match these filters.",
            detail: "Clear the filters to see everything you have saved.",
          }
      : libraryCollection === LIBRARY_COLLECTIONS.RECENT
        ? selectedCollectionIsEmpty
          ? {
              title: "No recent experiences yet.",
              detail:
                "Open anything from Play, Create, or Labs and it will be easy to find here.",
            }
          : {
              title: "No recent experiences match these filters.",
              detail: "Clear the filters to see your recent activity.",
            }
        : {
            title: "No experiences match these filters.",
            detail: "Try a broader search or reset the library filters.",
          };

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
          <Suspense
            fallback={
              <button
                aria-label="Loading My Creations"
                className="product-home-icon-button"
                disabled
                type="button"
              >
                <span aria-hidden="true">✦</span>
              </button>
            }
          >
            <MyCreationsLauncher onSelectMode={onSelectMode} />
          </Suspense>
          <TrackingReadiness
            cameraActive={cameraActive}
            readiness={readiness}
            onOpenSetup={onOpenSetup}
            onStopCamera={onStopCamera}
          />
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

      <main
        className={`product-home-main${isReturningUser ? " is-returning" : ""}`}
      >
        {isMobileDevice ? (
          <aside className="product-home-device-tip" role="note">
            <strong>Playing on a phone?</strong>
            <span>
              Touch controls work now. For camera play, turn the phone sideways,
              place it on a stable surface, and leave room to move comfortably.
            </span>
          </aside>
        ) : null}
        {isReturningUser ? (
          <section
            className="product-home-hero is-returning"
            aria-labelledby="home-title"
          >
            <div className="product-returning-summary">
              <div>
                <span className="product-home-eyebrow">Welcome back</span>
                <h1 id="home-title">Ready for your next move?</h1>
                <p>
                  Pick a route and get playing. Your progress, favorites, and
                  personal bests stay on this device.
                </p>
                <div className="product-home-hero-actions">
                  <button
                    className="product-primary-action"
                    disabled={!arcadeRunMode}
                    onClick={() =>
                      arcadeRunMode && onSelectMode(arcadeRunMode)
                    }
                    type="button"
                  >
                    Start an Arcade Run
                  </button>
                  <button
                    className="product-secondary-action"
                    disabled={!canQuickPlay}
                    onClick={launchQuickPlay}
                    type="button"
                  >
                    Quick play
                  </button>
                </div>
              </div>

              <dl
                className="product-progress-summary"
                aria-label="Local play summary"
              >
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
                    {achievementSummary.unlockedCount}/
                    {achievementSummary.totalCount}
                  </dd>
                </div>
              </dl>

              {recentResult && recentResultMode ? (
                <div className="product-returning-last-result">
                  <span>{formatResultOutcome(recentResult.outcome)}</span>
                  <strong>{recentResultMode.label}</strong>
                  <small>
                    {Number.isFinite(recentResult.score)
                      ? `Score ${recentResult.score}`
                      : formatPlayTime(recentResult.durationMs)}
                  </small>
                </div>
              ) : null}
            </div>

            <div
              className="product-returning-picks"
              aria-labelledby="home-recommendations-title"
            >
              <div className="product-returning-picks-heading">
                <div>
                  <span className="product-home-eyebrow">For you</span>
                  <h2 id="home-recommendations-title">Jump right in</h2>
                </div>
                <span>Fresh picks based on local play</span>
              </div>

              <div className="product-returning-grid">
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
                    onClick={launchDaily}
                    type="button"
                  >
                    <span>Daily challenge</span>
                    <strong>{dailyMode.label}</strong>
                    <small>Today’s shared local challenge</small>
                  </button>
                ) : null}
                {recommendationModes.map((mode) => (
                  <button
                    className="product-shortcut-card recommended"
                    key={mode.id}
                    onClick={() => onSelectMode(mode)}
                    type="button"
                  >
                    <span>
                      {favoriteSet.has(mode.id) ? "Favorite pick" : "Try next"}
                    </span>
                    <strong>{mode.label}</strong>
                    <small>
                      {mode.typicalMinutes} min · {mode.difficulty}
                    </small>
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
            </div>
          </section>
        ) : (
          <>
            <section className="product-home-hero" aria-labelledby="home-title">
              <div className="product-home-intro">
                <span className="product-home-eyebrow">Webcam-powered play</span>
                <h1 id="home-title">
                  Move, play, and make something surprising.
                </h1>
                <p>
                  Short arcade challenges and creative tools that turn natural
                  movement into immediate feedback. Camera processing stays on
                  this device.
                </p>
                <div className="product-home-hero-actions">
                  <button
                    className="product-primary-action"
                    disabled={!arcadeRunMode}
                    onClick={() =>
                      arcadeRunMode && onSelectMode(arcadeRunMode)
                    }
                    type="button"
                  >
                    Start an Arcade Run
                  </button>
                  <button
                    className="product-secondary-action"
                    disabled={!canQuickPlay}
                    onClick={launchQuickPlay}
                    type="button"
                  >
                    Quick play
                  </button>
                  <button
                    className="product-secondary-action"
                    onClick={onOpenSetup}
                    type="button"
                  >
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
                  <h2 id="home-shortcuts-title">A great first session</h2>
                </div>
              </div>

              <div className="product-shortcut-grid">
                {dailyMode ? (
                  <button
                    className="product-shortcut-card daily"
                    onClick={launchDaily}
                    type="button"
                  >
                    <span>Daily challenge</span>
                    <strong>{dailyMode.label}</strong>
                    <small>Today’s shared local challenge</small>
                  </button>
                ) : null}
                {recommendationModes.map((mode) => (
                  <button
                    className="product-shortcut-card recommended"
                    key={mode.id}
                    onClick={() => onSelectMode(mode)}
                    type="button"
                  >
                    <span>Great place to start</span>
                    <strong>{mode.label}</strong>
                    <small>
                      {mode.typicalMinutes} min · {mode.difficulty}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

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

          <div className="product-library-view-bar">
            <div
              aria-controls="experience-list"
              aria-label="Choose a library view"
              className="product-library-collections"
              role="group"
            >
              <span className="product-library-collections-label">Show</span>
              {LIBRARY_COLLECTION_FILTERS.map((filter) => {
                const count = collectionCounts[filter.id];
                return (
                  <button
                    aria-label={`${filter.label}: ${count} ${
                      count === 1 ? "experience" : "experiences"
                    }`}
                    aria-pressed={libraryCollection === filter.id}
                    className={libraryCollection === filter.id ? "active" : ""}
                    key={filter.id}
                    onClick={() => setLibraryCollection(filter.id)}
                    type="button"
                  >
                    <span>{filter.label}</span>
                    <span aria-hidden="true" className="product-library-collection-count">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <p
              aria-live="polite"
              className="product-library-result-count"
              role="status"
            >
              <strong>{filteredModes.length}</strong>{" "}
              {filteredModes.length === 1 ? "experience" : "experiences"} shown
            </p>
          </div>

          <div
            aria-controls="experience-list"
            className="product-area-tabs"
            role="group"
            aria-label="Filter experiences by area"
          >
            {AREA_FILTERS.map((filter) => (
              <button
                aria-pressed={activeArea === filter.id}
                className={activeArea === filter.id ? "active" : ""}
                key={filter.id}
                onClick={() => {
                  setActiveArea(filter.id);
                  onSelectArea?.(filter.id);
                }}
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
              <span>Difficulty</span>
              <select
                onChange={(event) => setDifficultyFilter(event.target.value)}
                value={difficultyFilter}
              >
                {DIFFICULTY_FILTERS.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.label}
                  </option>
                ))}
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
            <label>
              <span>Play position</span>
              <select
                onChange={(event) => setSeatedOnly(event.target.value === "seated")}
                value={seatedOnly ? "seated" : "all"}
              >
                <option value="all">Any position</option>
                <option value="seated">Seated-friendly</option>
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
            <div className="product-library-empty">
              <div aria-live="polite" role="status">
                <strong>{emptyState.title}</strong>
                <span>{emptyState.detail}</span>
              </div>
              <button
                onClick={() =>
                  clearLibraryFilters({
                    showEverything: selectedCollectionIsEmpty,
                  })
                }
                type="button"
              >
                {selectedCollectionIsEmpty
                  ? "Browse all experiences"
                  : "Clear filters"}
              </button>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
