import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ARCADE_RUN_DURATIONS,
  ARCADE_RUN_STATUSES,
  advanceArcadeRun,
  completeArcadeRunLeg,
  createArcadeRunNextUpUiModel,
  createArcadeRunPlan,
  createArcadeRunSession,
  createArcadeRunSummaryUiModel,
  getArcadeRunDayKey,
  pauseArcadeRun,
  resumeArcadeRun,
  retryArcadeRunLeg,
  serializeArcadeRunSession,
  skipArcadeRunLeg,
  startArcadeRun,
} from "../arcadeRunPlanner.js";
import {
  ARCADE_RUN_STORAGE_KEY,
  createArcadeRunLaunchRequest,
  matchesArcadeRunResultEnvelope,
  restoreArcadeRunSnapshot,
} from "../arcadeRunIntegration.js";

import "./ArcadeRunExperience.css";

const DURATION_CHOICES = Object.freeze([
  {
    minutes: ARCADE_RUN_DURATIONS.QUICK,
    label: "3 min",
    detail: "Quick Spark",
  },
  {
    minutes: ARCADE_RUN_DURATIONS.MIX,
    label: "5 min",
    detail: "Arcade Mix",
  },
  {
    minutes: ARCADE_RUN_DURATIONS.CIRCUIT,
    label: "10 min",
    detail: "Full Circuit",
  },
]);

function safeCall(callback, ...arguments_) {
  if (typeof callback !== "function") {
    return undefined;
  }
  try {
    return callback(...arguments_);
  } catch {
    return undefined;
  }
}

function formatMinutes(minutes) {
  return `${minutes} min`;
}

function formatScore(score, locale) {
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(score);
  } catch {
    return String(Math.round(score));
  }
}

function inputLabel(mode) {
  if (mode.inputMethod === "pointer") {
    return "Pointer ready";
  }
  if (mode.inputMethod === "none") {
    return "No camera";
  }
  return mode.trackingProfile === "one-hand"
    ? "One hand"
    : mode.trackingProfile.replaceAll("-", " ");
}

function statusTone(status) {
  if (status === ARCADE_RUN_STATUSES.COMPLETE) {
    return "is-complete";
  }
  if (status === ARCADE_RUN_STATUSES.PAUSED) {
    return "is-paused";
  }
  if (status === ARCADE_RUN_STATUSES.BETWEEN_LEGS) {
    return "is-between";
  }
  return "is-active";
}

function removeStoredRun(storage, storageKey) {
  if (!storage?.removeItem) {
    return false;
  }
  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

function PlaylistPreview({ plan }) {
  return (
    <section
      aria-labelledby="arcade-run-playlist-title"
      className="arx-playlist"
    >
      <header className="arx-section-heading">
        <div>
          <p className="arx-kicker">Your route</p>
          <h2 id="arcade-run-playlist-title">{plan.title}</h2>
        </div>
        <span className="arx-time-chip">
          {plan.estimatedMinutes} of {plan.durationMinutes} min
        </span>
      </header>

      {plan.canStart ? (
        <ol className="arx-playlist-list">
          {plan.legs.map((leg, index) => (
            <li className="arx-playlist-leg" key={leg.id}>
              <span aria-hidden="true" className="arx-leg-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="arx-leg-copy">
                <span className="arx-role">{leg.role}</span>
                <strong>{leg.mode.label}</strong>
                <p>{leg.mode.objective || leg.mode.summary}</p>
              </div>
              <div className="arx-leg-meta">
                <span>{formatMinutes(leg.estimatedMinutes)}</span>
                <span>{inputLabel(leg.mode)}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="arx-empty" role="status">
          <strong>No route available yet</strong>
          <p>{plan.unavailableReason}</p>
          <p>
            Try a different player count, enable pointer play, or set up a
            supported tracking profile.
          </p>
        </div>
      )}
    </section>
  );
}

function ResumeCard({ session, onResume, onDiscard }) {
  const summary = createArcadeRunSummaryUiModel(session);
  const next = createArcadeRunNextUpUiModel(session);
  return (
    <aside aria-labelledby="arcade-run-resume-title" className="arx-resume-card">
      <div className="arx-resume-mark" aria-hidden="true">
        ↗
      </div>
      <div>
        <p className="arx-kicker">Saved locally</p>
        <h2 id="arcade-run-resume-title">Continue {session.plan.title}</h2>
        <p>
          {summary.progress.label}
          {next.activity ? ` · ${next.activity.label} is next` : ""}
        </p>
      </div>
      <div className="arx-resume-actions">
        <button className="arx-button arx-button--primary" onClick={onResume} type="button">
          Resume run
        </button>
        <button className="arx-button arx-button--quiet" onClick={onDiscard} type="button">
          Discard
        </button>
      </div>
    </aside>
  );
}

function RunProgress({ session }) {
  const aggregate = session.aggregate;
  return (
    <div className="arx-progress-panel">
      <div className="arx-progress-copy">
        <span>
          Activity {Math.min(
            (session.currentLegIndex ?? session.legs.length - 1) + 1,
            session.legs.length,
          )}{" "}
          of {session.legs.length}
        </span>
        <strong>{Math.round(aggregate.progress * 100)}%</strong>
      </div>
      <progress
        aria-label="Arcade Run progress"
        max={aggregate.totalLegCount}
        value={aggregate.finishedLegCount}
      />
      <ol aria-label="Arcade Run activities" className="arx-progress-dots">
        {session.legs.map((leg, index) => (
          <li
            aria-current={
              index === session.currentLegIndex ? "step" : undefined
            }
            className={`is-${leg.status}`}
            key={leg.id}
          >
            <span aria-hidden="true">{index + 1}</span>
            <span className="arx-sr-only">
              {session.plan.legs[index].mode.label}: {leg.status}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ActiveLegCard({
  session,
  nextUp,
  headingRef,
  onOpen,
  onPause,
  onResume,
  onSkip,
}) {
  const paused = session.status === ARCADE_RUN_STATUSES.PAUSED;
  const activity = nextUp.activity;
  return (
    <section
      aria-labelledby="arcade-run-stage-title"
      className={`arx-stage-card ${statusTone(session.status)}`}
    >
      <div className="arx-stage-index" aria-hidden="true">
        {nextUp.progressLabel}
      </div>
      <div className="arx-stage-copy">
        <p className="arx-kicker">{paused ? "Run paused" : "In progress"}</p>
        <h2 id="arcade-run-stage-title" ref={headingRef} tabIndex={-1}>
          {nextUp.title}
        </h2>
        <p className="arx-stage-objective">{nextUp.description}</p>
        <dl className="arx-control-summary">
          <div>
            <dt>Controls</dt>
            <dd>{activity.controlHint}</dd>
          </div>
          <div>
            <dt>Input</dt>
            <dd>{activity.inputLabel}</dd>
          </div>
          <div>
            <dt>Target time</dt>
            <dd>{formatMinutes(activity.estimatedMinutes)}</dd>
          </div>
        </dl>
      </div>
      <div className="arx-stage-actions">
        {paused ? (
          <button
            className="arx-button arx-button--primary"
            onClick={onResume}
            type="button"
          >
            Resume game
          </button>
        ) : (
          <>
            <button
              className="arx-button arx-button--primary"
              onClick={onOpen}
              type="button"
            >
              Open {activity.label}
            </button>
            <button
              className="arx-button arx-button--secondary"
              onClick={onPause}
              type="button"
            >
              Pause run
            </button>
          </>
        )}
        <button
          className="arx-button arx-button--quiet"
          onClick={onSkip}
          type="button"
        >
          Skip this game
        </button>
      </div>
    </section>
  );
}

function BetweenLegCard({
  session,
  nextUp,
  locale,
  headingRef,
  onRetry,
  onContinue,
}) {
  const currentIndex = session.currentLegIndex;
  const currentState = session.legs[currentIndex];
  const currentPlan = session.plan.legs[currentIndex];
  const result = currentState.result;
  const hasNext = Boolean(nextUp.activity);
  return (
    <section
      aria-labelledby="arcade-run-stage-title"
      className="arx-stage-card is-between"
    >
      <div className="arx-leg-recap">
        <p className="arx-kicker">
          {currentState.status === "skipped" ? "Game skipped" : "Game complete"}
        </p>
        <h2 id="arcade-run-stage-title" ref={headingRef} tabIndex={-1}>
          {currentPlan.mode.label}
        </h2>
        {result ? (
          <div className="arx-recap-score">
            <strong>{formatScore(result.score, locale)}</strong>
            <span>points this game</span>
          </div>
        ) : (
          <p className="arx-skip-note">
            {currentState.skipReason || "Skipped without changing your score."}
          </p>
        )}
        {result?.medals?.length > 0 ? (
          <ul aria-label="Medals earned" className="arx-medal-row">
            {result.medals.map((medal) => (
              <li className={`is-${medal.tier}`} key={medal.id}>
                {medal.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="arx-next-card">
        <p className="arx-kicker">
          {hasNext ? nextUp.eyebrow : "Route complete"}
        </p>
        <h3>{hasNext ? nextUp.title : "Ready for your run recap"}</h3>
        <p>
          {hasNext
            ? nextUp.description
            : "Your score and medals are tallied. Finish when you’re ready."}
        </p>
        {hasNext ? (
          <div className="arx-next-meta">
            <span>{nextUp.activity.controlHint}</span>
            <span>{nextUp.activity.inputLabel}</span>
          </div>
        ) : null}
      </div>

      <div className="arx-stage-actions">
        <button
          aria-label={`Retry ${currentPlan.mode.label}`}
          className="arx-button arx-button--secondary"
          onClick={onRetry}
          type="button"
        >
          Retry last game
        </button>
        <button
          className="arx-button arx-button--primary"
          onClick={onContinue}
          type="button"
        >
          {hasNext ? `Play ${nextUp.activity.label}` : "See run results"}
        </button>
      </div>
    </section>
  );
}

function CompletedRun({
  session,
  summary,
  locale,
  headingRef,
  onNewRun,
  onExit,
}) {
  return (
    <section
      aria-labelledby="arcade-run-results-title"
      className="arx-results"
    >
      <div className="arx-results-hero">
        <div
          aria-hidden="true"
          className={`arx-circuit-medal${
            summary.runMedal ? ` is-${summary.runMedal.tier}` : ""
          }`}
        >
          <span>{summary.runMedal?.tier?.slice(0, 1).toUpperCase() || "✓"}</span>
        </div>
        <div>
          <p className="arx-kicker">{summary.eyebrow}</p>
          <h2 id="arcade-run-results-title" ref={headingRef} tabIndex={-1}>
            {summary.title}
          </h2>
          <p>{summary.runMedal?.label || "Route finished"}</p>
        </div>
        <div className="arx-total-score">
          <span>Total score</span>
          <strong>{formatScore(session.aggregate.totalScore, locale)}</strong>
        </div>
      </div>

      <div className="arx-results-grid">
        <section aria-labelledby="arcade-run-breakdown-title">
          <h3 id="arcade-run-breakdown-title">Game breakdown</h3>
          <ol className="arx-result-legs">
            {summary.legs.map((leg, index) => (
              <li key={leg.id}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <strong>{leg.label}</strong>
                  <small>
                    {leg.statusLabel}
                    {leg.attempts > 1 ? ` · ${leg.attempts} attempts` : ""}
                  </small>
                </div>
                <b>{leg.scoreLabel ?? "—"}</b>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="arcade-run-medals-title">
          <h3 id="arcade-run-medals-title">Medal case</h3>
          <dl className="arx-medal-case">
            {summary.medalCounts.map((medal) => (
              <div className={`is-${medal.tier}`} key={medal.tier}>
                <dt>{medal.label}</dt>
                <dd>{medal.count}</dd>
              </div>
            ))}
          </dl>
          <p className="arx-results-note">
            Completed {session.aggregate.completedLegCount} game
            {session.aggregate.completedLegCount === 1 ? "" : "s"}
            {session.aggregate.skippedLegCount
              ? ` and skipped ${session.aggregate.skippedLegCount}`
              : " with no skips"}
            .
          </p>
        </section>
      </div>

      <div className="arx-results-actions">
        <button
          className="arx-button arx-button--primary"
          onClick={onNewRun}
          type="button"
        >
          Play another run
        </button>
        <button
          className="arx-button arx-button--secondary"
          onClick={onExit}
          type="button"
        >
          Back to Home
        </button>
      </div>
    </section>
  );
}

/**
 * Standalone Arcade Run planner and orchestration surface.
 *
 * App integration:
 * - `onLaunchMode(request)` receives runId, legId, attempt, and modeId.
 * - After the routed game ends, pass an `incomingLegResult` created with
 *   createArcadeRunResultEnvelope(request, result).
 * - Supply `storage`, or load/persist callbacks, to keep unfinished runs.
 */
export function ArcadeRunExperience({
  modes = [],
  capabilityOptions = {},
  initialDurationMinutes = ARCADE_RUN_DURATIONS.MIX,
  initialRunKind = "mix",
  seed = "arcade-run",
  dailyDate,
  resumeSnapshot,
  loadResumeSnapshot,
  storage,
  storageKey = ARCADE_RUN_STORAGE_KEY,
  incomingLegResult,
  returningLegRequest,
  locale,
  now = () => new Date(),
  onLaunchMode,
  onLegResultConsumed,
  onSessionChange,
  onPersistSession,
  onClearPersistedSession,
  onRunComplete,
  onExit,
  className = "",
}) {
  const titleId = useId();
  const statusHeadingRef = useRef(null);
  const dailyReferenceRef = useRef(dailyDate ?? new Date());
  const completedCallbackRunRef = useRef(null);
  const clearedRunRef = useRef(null);
  const consumedResultRef = useRef(null);
  const storageLoadStartedRef = useRef(false);
  const [durationMinutes, setDurationMinutes] = useState(
    Object.values(ARCADE_RUN_DURATIONS).includes(initialDurationMinutes)
      ? initialDurationMinutes
      : ARCADE_RUN_DURATIONS.MIX,
  );
  const [runKind, setRunKind] = useState(
    initialRunKind === "daily" ? "daily" : "mix",
  );
  const [mixRevision, setMixRevision] = useState(0);
  const [session, setSession] = useState(null);
  const [resumeCandidate, setResumeCandidate] = useState(null);
  const [resumeMessage, setResumeMessage] = useState("");
  const [persistenceMessage, setPersistenceMessage] = useState("");
  const [announcement, setAnnouncement] = useState(
    "Choose a run length and review your playlist.",
  );

  const dailyReference = dailyDate ?? dailyReferenceRef.current;
  const dailyDayKey = useMemo(
    () => getArcadeRunDayKey(dailyReference),
    [dailyReference],
  );
  const plan = useMemo(
    () =>
      createArcadeRunPlan(modes, {
        ...capabilityOptions,
        durationMinutes,
        seed: `${seed}:${mixRevision}`,
        dailyDate: runKind === "daily" ? dailyReference : undefined,
      }),
    [
      capabilityOptions,
      dailyReference,
      durationMinutes,
      mixRevision,
      modes,
      runKind,
      seed,
    ],
  );

  const commitSession = useCallback(
    (nextSession, event) => {
      setSession(nextSession);
      safeCall(onSessionChange, nextSession, event);
      return nextSession;
    },
    [onSessionChange],
  );

  const acceptResumeSnapshot = useCallback((snapshot) => {
    try {
      const restored = restoreArcadeRunSnapshot(snapshot);
      if (restored) {
        setResumeCandidate(restored);
        setResumeMessage("");
      }
    } catch {
      setResumeMessage(
        "The saved run could not be restored. You can safely start a new one.",
      );
    }
  }, []);

  useEffect(() => {
    if (resumeSnapshot === undefined || session || resumeCandidate) {
      return;
    }
    acceptResumeSnapshot(resumeSnapshot);
  }, [acceptResumeSnapshot, resumeCandidate, resumeSnapshot, session]);

  useEffect(() => {
    if (
      session ||
      !resumeCandidate ||
      !matchesArcadeRunResultEnvelope(resumeCandidate, incomingLegResult)
    ) {
      return;
    }
    setSession(resumeCandidate);
    setResumeCandidate(null);
    safeCall(onSessionChange, resumeCandidate, {
      type: "run-returned-from-game",
    });
  }, [
    incomingLegResult,
    onSessionChange,
    resumeCandidate,
    session,
  ]);

  useEffect(() => {
    if (
      session ||
      !resumeCandidate ||
      !returningLegRequest ||
      matchesArcadeRunResultEnvelope(resumeCandidate, incomingLegResult)
    ) {
      return;
    }
    const currentLeg =
      resumeCandidate.legs?.[resumeCandidate.currentLegIndex];
    if (
      returningLegRequest.kind !== "arcade-run-leg" ||
      returningLegRequest.runId !== resumeCandidate.runId ||
      returningLegRequest.legId !== currentLeg?.id
    ) {
      return;
    }
    setSession(resumeCandidate);
    setResumeCandidate(null);
    safeCall(onSessionChange, resumeCandidate, {
      type: "run-returned-without-result",
    });
  }, [
    incomingLegResult,
    onSessionChange,
    resumeCandidate,
    returningLegRequest,
    session,
  ]);

  useEffect(() => {
    if (
      storageLoadStartedRef.current ||
      resumeSnapshot !== undefined ||
      session ||
      resumeCandidate
    ) {
      return undefined;
    }
    storageLoadStartedRef.current = true;
    let cancelled = false;

    const finishLoad = (snapshot) => {
      if (!cancelled) {
        acceptResumeSnapshot(snapshot);
      }
    };

    try {
      const loaded =
        typeof loadResumeSnapshot === "function"
          ? loadResumeSnapshot()
          : storage?.getItem
            ? storage.getItem(storageKey)
            : null;
      if (loaded && typeof loaded.then === "function") {
        loaded.then(finishLoad).catch(() => {
          if (!cancelled) {
            setResumeMessage(
              "Saved runs are unavailable right now. New runs still work.",
            );
          }
        });
      } else {
        finishLoad(loaded);
      }
    } catch {
      setResumeMessage(
        "Saved runs are unavailable right now. New runs still work.",
      );
    }

    return () => {
      cancelled = true;
    };
  }, [
    acceptResumeSnapshot,
    loadResumeSnapshot,
    resumeCandidate,
    resumeSnapshot,
    session,
    storage,
    storageKey,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.status === ARCADE_RUN_STATUSES.COMPLETE) {
      if (clearedRunRef.current !== session.runId) {
        removeStoredRun(storage, storageKey);
        safeCall(onClearPersistedSession, {
          runId: session.runId,
          reason: "completed",
        });
        clearedRunRef.current = session.runId;
      }
      return;
    }

    try {
      const serialized = serializeArcadeRunSession(session);
      if (storage?.setItem) {
        storage.setItem(storageKey, serialized);
      }
      safeCall(onPersistSession, {
        runId: session.runId,
        session,
        serialized,
      });
      setPersistenceMessage("");
    } catch {
      setPersistenceMessage(
        "This run is continuing in memory, but it could not be saved.",
      );
    }
  }, [
    onClearPersistedSession,
    onPersistSession,
    session,
    storage,
    storageKey,
  ]);

  useEffect(() => {
    if (
      session?.status !== ARCADE_RUN_STATUSES.COMPLETE ||
      completedCallbackRunRef.current === session.runId
    ) {
      return;
    }
    completedCallbackRunRef.current = session.runId;
    safeCall(onRunComplete, {
      session,
      summary: createArcadeRunSummaryUiModel(session, { locale }),
    });
  }, [locale, onRunComplete, session]);

  useEffect(() => {
    if (!session || !matchesArcadeRunResultEnvelope(session, incomingLegResult)) {
      return;
    }
    const resultKey = `${incomingLegResult.runId}:${incomingLegResult.legId}:${incomingLegResult.attempt}`;
    if (consumedResultRef.current === resultKey) {
      return;
    }
    consumedResultRef.current = resultKey;
    const currentLabel =
      session.plan.legs[session.currentLegIndex].mode.label;
    const next = completeArcadeRunLeg(session, incomingLegResult.result, { now });
    commitSession(next, {
      type: "leg-completed",
      envelope: incomingLegResult,
    });
    setAnnouncement(
      `${currentLabel} complete. ${
        next.currentLegIndex + 1 < next.legs.length
          ? "Review your score, then continue."
          : "Your run recap is ready."
      }`,
    );
    safeCall(onLegResultConsumed, incomingLegResult);
  }, [
    commitSession,
    incomingLegResult,
    now,
    onLegResultConsumed,
    session,
  ]);

  useEffect(() => {
    if (
      session?.status === ARCADE_RUN_STATUSES.BETWEEN_LEGS ||
      session?.status === ARCADE_RUN_STATUSES.PAUSED ||
      session?.status === ARCADE_RUN_STATUSES.COMPLETE
    ) {
      statusHeadingRef.current?.focus();
    }
  }, [session?.status]);

  const emitLaunch = useCallback(
    (nextSession, reason) => {
      const request = createArcadeRunLaunchRequest(nextSession);
      if (!request) {
        return;
      }
      const mode =
        nextSession.plan.legs[nextSession.currentLegIndex].mode;
      setAnnouncement(
        `${mode.label} is ready. ${mode.controlHint}.`,
      );
      safeCall(onLaunchMode, request, {
        reason,
        session: nextSession,
      });
    },
    [onLaunchMode],
  );

  const clearPersistedRun = useCallback(
    (runId, reason) => {
      removeStoredRun(storage, storageKey);
      safeCall(onClearPersistedSession, { runId, reason });
    },
    [onClearPersistedSession, storage, storageKey],
  );

  const handleStartPlan = useCallback(() => {
    if (!plan.canStart) {
      setAnnouncement(plan.unavailableReason);
      return;
    }
    const created = createArcadeRunSession(plan, { now });
    const started = startArcadeRun(created, { now });
    commitSession(started, { type: "run-started" });
    setResumeCandidate(null);
    emitLaunch(started, "run-started");
  }, [commitSession, emitLaunch, now, plan]);

  const handleResumeCandidate = useCallback(() => {
    if (!resumeCandidate) {
      return;
    }
    const restored =
      resumeCandidate.status === ARCADE_RUN_STATUSES.READY
        ? startArcadeRun(resumeCandidate, { now })
        : resumeCandidate;
    setSession(restored);
    setResumeCandidate(null);
    safeCall(onSessionChange, restored, {
      type: "run-restored",
    });
    setAnnouncement(
      `${restored.plan.title} restored. Continue where you left off.`,
    );
    if (resumeCandidate.status === ARCADE_RUN_STATUSES.READY) {
      emitLaunch(restored, "run-restored");
    }
  }, [emitLaunch, now, onSessionChange, resumeCandidate]);

  const handleDiscardCandidate = useCallback(() => {
    if (!resumeCandidate) {
      return;
    }
    clearPersistedRun(resumeCandidate.runId, "discarded");
    setResumeCandidate(null);
    setAnnouncement("Saved run discarded. Choose a new playlist.");
  }, [clearPersistedRun, resumeCandidate]);

  const handleOpen = useCallback(() => {
    if (session) {
      emitLaunch(session, "reopen");
    }
  }, [emitLaunch, session]);

  const handlePause = useCallback(() => {
    if (!session) {
      return;
    }
    const next = pauseArcadeRun(session, { now });
    commitSession(next, { type: "run-paused" });
    setAnnouncement("Arcade Run paused. Your current place is saved.");
  }, [commitSession, now, session]);

  const handleResume = useCallback(() => {
    if (!session) {
      return;
    }
    const next = resumeArcadeRun(session, { now });
    commitSession(next, { type: "run-resumed" });
    emitLaunch(next, "run-resumed");
  }, [commitSession, emitLaunch, now, session]);

  const handleSkip = useCallback(() => {
    if (!session) {
      return;
    }
    const label = session.plan.legs[session.currentLegIndex].mode.label;
    const next = skipArcadeRunLeg(session, {
      reason: "Skipped from Arcade Run",
      now,
    });
    commitSession(next, { type: "leg-skipped" });
    setAnnouncement(`${label} skipped. Review what is next.`);
  }, [commitSession, now, session]);

  const handleRetry = useCallback(() => {
    if (!session) {
      return;
    }
    const next = retryArcadeRunLeg(session, { now });
    commitSession(next, { type: "leg-retried" });
    emitLaunch(next, "leg-retried");
  }, [commitSession, emitLaunch, now, session]);

  const handleContinue = useCallback(() => {
    if (!session) {
      return;
    }
    const next = advanceArcadeRun(session, { now });
    commitSession(next, {
      type:
        next.status === ARCADE_RUN_STATUSES.COMPLETE
          ? "run-completed"
          : "leg-advanced",
    });
    if (next.status === ARCADE_RUN_STATUSES.ACTIVE) {
      emitLaunch(next, "leg-advanced");
    } else {
      setAnnouncement(
        `Arcade Run complete. Total score ${next.aggregate.totalScore}.`,
      );
    }
  }, [commitSession, emitLaunch, now, session]);

  const handleNewRun = useCallback(() => {
    if (session && clearedRunRef.current !== session.runId) {
      clearPersistedRun(session.runId, "new-run");
    }
    setSession(null);
    setMixRevision((revision) => revision + 1);
    setAnnouncement("Choose your next Arcade Run.");
  }, [clearPersistedRun, session]);

  const nextUp = session
    ? createArcadeRunNextUpUiModel(session)
    : null;
  const summary =
    session?.status === ARCADE_RUN_STATUSES.COMPLETE
      ? createArcadeRunSummaryUiModel(session, { locale })
      : null;

  return (
    <section
      aria-labelledby={titleId}
      className={`arx ${className}`.trim()}
    >
      <div aria-hidden="true" className="arx-atmosphere" />
      <header className="arx-topbar">
        <div className="arx-brand">
          <span aria-hidden="true" className="arx-brand-mark">
            MA
          </span>
          <div>
            <p>Motion Arcade</p>
            <h1 id={titleId}>Arcade Run</h1>
          </div>
        </div>
        <div className="arx-topbar-actions">
          {session && session.status !== ARCADE_RUN_STATUSES.COMPLETE ? (
            <span className={`arx-save-status ${persistenceMessage ? "has-warning" : ""}`}>
              {persistenceMessage ? "Playing in memory" : "Progress saved"}
            </span>
          ) : null}
          <button
            aria-label={
              session?.status === ARCADE_RUN_STATUSES.COMPLETE
                ? "Return to Motion Arcade Home"
                : "Leave Arcade Run; unfinished progress will be saved"
            }
            className="arx-button arx-button--quiet"
            onClick={() => safeCall(onExit)}
            type="button"
          >
            {session?.status === ARCADE_RUN_STATUSES.COMPLETE
              ? "Home"
              : "Leave for now"}
          </button>
        </div>
      </header>

      <main className="arx-main">
        {!session ? (
          <>
            <section className="arx-intro">
              <div>
                <p className="arx-kicker">One choice. A complete play session.</p>
                <h2>Pick your time. We’ll build the route.</h2>
              </div>
              <p>
                Arcade Run strings together complementary motion games, keeps
                the pace moving, and tallies one final score.
              </p>
            </section>

            {resumeCandidate ? (
              <ResumeCard
                onDiscard={handleDiscardCandidate}
                onResume={handleResumeCandidate}
                session={resumeCandidate}
              />
            ) : null}
            {resumeMessage ? (
              <p className="arx-inline-message" role="status">
                {resumeMessage}
              </p>
            ) : null}

            <div className="arx-builder-grid">
              <section
                aria-labelledby="arcade-run-setup-title"
                className="arx-setup"
              >
                <div className="arx-section-heading">
                  <div>
                    <p className="arx-kicker">Build your run</p>
                    <h2 id="arcade-run-setup-title">Choose a format</h2>
                  </div>
                  <span className="arx-step-chip">Step 1 of 2</span>
                </div>

                <div
                  aria-label="Run type"
                  className="arx-segmented"
                  role="group"
                >
                  <button
                    aria-pressed={runKind === "mix"}
                    className={runKind === "mix" ? "is-selected" : ""}
                    onClick={() => {
                      setRunKind("mix");
                      setAnnouncement("Arcade Mix selected.");
                    }}
                    type="button"
                  >
                    <strong>Arcade Mix</strong>
                    <span>Shuffle a route for me</span>
                  </button>
                  <button
                    aria-pressed={runKind === "daily"}
                    className={runKind === "daily" ? "is-selected" : ""}
                    onClick={() => {
                      setRunKind("daily");
                      setAnnouncement(
                        `Daily Run for ${dailyDayKey} selected.`,
                      );
                    }}
                    type="button"
                  >
                    <strong>Daily Run</strong>
                    <span>Today’s stable route for this setup</span>
                  </button>
                </div>

                <fieldset className="arx-duration-picker">
                  <legend>How long do you want to play?</legend>
                  <div>
                    {DURATION_CHOICES.map((choice) => (
                      <label
                        className={
                          durationMinutes === choice.minutes
                            ? "is-selected"
                            : ""
                        }
                        key={choice.minutes}
                      >
                        <input
                          checked={durationMinutes === choice.minutes}
                          name="arcade-run-duration"
                          onChange={() => {
                            setDurationMinutes(choice.minutes);
                            setAnnouncement(
                              `${choice.label} ${choice.detail} selected.`,
                            );
                          }}
                          type="radio"
                          value={choice.minutes}
                        />
                        <strong>{choice.label}</strong>
                        <span>{choice.detail}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="arx-format-note">
                  <span aria-hidden="true">◎</span>
                  <p>
                    {runKind === "daily"
                      ? `Daily seed ${dailyDayKey}. Retrying keeps today’s route.`
                      : "Routes favor variety: a friendly opener, a change of motion, and a stronger finish."}
                  </p>
                </div>
              </section>

              <PlaylistPreview plan={plan} />
            </div>

            <div className="arx-builder-actions">
              {runKind === "mix" ? (
                <button
                  className="arx-button arx-button--secondary"
                  onClick={() => {
                    setMixRevision((revision) => revision + 1);
                    setAnnouncement("A new Arcade Mix is ready.");
                  }}
                  type="button"
                >
                  Shuffle route
                </button>
              ) : (
                <span className="arx-daily-lock">
                  Daily route locked for {dailyDayKey}
                </span>
              )}
              <button
                className="arx-button arx-button--primary arx-button--start"
                disabled={!plan.canStart}
                onClick={handleStartPlan}
                type="button"
              >
                Start {plan.title}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <section className="arx-run-header">
              <div>
                <p className="arx-kicker">
                  {session.plan.dailyChallenge
                    ? `Daily Run · ${session.plan.dailyChallenge.dayKey}`
                    : "Arcade Mix"}
                </p>
                <h2>{session.plan.title}</h2>
              </div>
              <div className="arx-run-metrics">
                <div>
                  <span>Total score</span>
                  <strong>
                    {formatScore(session.aggregate.totalScore, locale)}
                  </strong>
                </div>
                <div>
                  <span>Medals</span>
                  <strong>
                    {Object.values(session.aggregate.medalCounts).reduce(
                      (total, count) => total + count,
                      0,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            {session.status !== ARCADE_RUN_STATUSES.COMPLETE ? (
              <RunProgress session={session} />
            ) : null}

            {session.status === ARCADE_RUN_STATUSES.ACTIVE ||
            session.status === ARCADE_RUN_STATUSES.PAUSED ? (
              <ActiveLegCard
                headingRef={statusHeadingRef}
                nextUp={nextUp}
                onOpen={handleOpen}
                onPause={handlePause}
                onResume={handleResume}
                onSkip={handleSkip}
                session={session}
              />
            ) : null}

            {session.status === ARCADE_RUN_STATUSES.BETWEEN_LEGS ? (
              <BetweenLegCard
                headingRef={statusHeadingRef}
                locale={locale}
                nextUp={nextUp}
                onContinue={handleContinue}
                onRetry={handleRetry}
                session={session}
              />
            ) : null}

            {session.status === ARCADE_RUN_STATUSES.COMPLETE ? (
              <CompletedRun
                headingRef={statusHeadingRef}
                locale={locale}
                onExit={() => safeCall(onExit)}
                onNewRun={handleNewRun}
                session={session}
                summary={summary}
              />
            ) : null}
          </>
        )}
      </main>

      <p
        aria-atomic="true"
        aria-live={
          session?.status === ARCADE_RUN_STATUSES.COMPLETE
            ? "assertive"
            : "polite"
        }
        className="arx-sr-only"
        role={
          session?.status === ARCADE_RUN_STATUSES.COMPLETE
            ? "alert"
            : "status"
        }
      >
        {announcement}
      </p>
    </section>
  );
}

export default ArcadeRunExperience;
