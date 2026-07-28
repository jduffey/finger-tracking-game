import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  WHACK_A_MOLE_ACTIONS,
  WHACK_A_MOLE_PHASES,
  WHACK_A_MOLE_TARGET_STATES,
  WHACK_A_MOLE_TARGET_TYPES,
  createDailyWhackAMoleSeed,
  createWhackAMoleGame,
  getWhackAMoleDifficulty,
  getWhackAMoleStats,
  getWhackAMoleSummary,
  reduceWhackAMoleGame,
} from "../whackAMoleGame.js";

const PHASE_STEPS = [
  { id: "learn", label: "Learn" },
  { id: "ready", label: "Ready" },
  { id: "play", label: "Play" },
  { id: "score", label: "Score" },
];

const LEGEND_ITEMS = [
  {
    type: WHACK_A_MOLE_TARGET_TYPES.NORMAL,
    icon: "🐹",
    title: "Garden mole",
    instruction: "Whack it",
  },
  {
    type: WHACK_A_MOLE_TARGET_TYPES.GOLD,
    icon: "★",
    title: "Gold mole",
    instruction: "Chase it",
  },
  {
    type: WHACK_A_MOLE_TARGET_TYPES.DECOY,
    icon: "!",
    title: "Red decoy",
    instruction: "Leave it",
  },
];

function getNow() {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }
  return Date.now();
}

function formatSeconds(milliseconds) {
  return Math.max(0, Math.ceil(milliseconds / 1_000));
}

function formatReaction(milliseconds) {
  return Number.isFinite(milliseconds) ? `${milliseconds} ms` : "—";
}

function getPhaseStepIndex(state) {
  const phase =
    state.phase === WHACK_A_MOLE_PHASES.PAUSED
      ? state.pausedPhase
      : state.phase;
  if (
    phase === WHACK_A_MOLE_PHASES.IDLE ||
    phase === WHACK_A_MOLE_PHASES.TEACH
  ) {
    return 0;
  }
  if (phase === WHACK_A_MOLE_PHASES.COUNTDOWN) {
    return 1;
  }
  if (phase === WHACK_A_MOLE_PHASES.PLAYING) {
    return 2;
  }
  return 3;
}

function getTargetCopy(target, normalPoints, goldPoints) {
  if (!target) {
    return null;
  }
  if (target.state === WHACK_A_MOLE_TARGET_STATES.TELEGRAPH) {
    return {
      className: "wamx-target--telegraph",
      icon: "•",
      tag: "WAIT",
      label: "target incoming; wait for it to appear",
    };
  }
  if (target.type === WHACK_A_MOLE_TARGET_TYPES.GOLD) {
    return {
      className: "wamx-target--gold",
      icon: "★",
      tag: `+${goldPoints}`,
      label: "gold mole; hit it",
    };
  }
  if (target.type === WHACK_A_MOLE_TARGET_TYPES.DECOY) {
    return {
      className: "wamx-target--decoy",
      icon: "!",
      tag: "DON'T",
      label: "red decoy; leave it alone",
    };
  }
  return {
    className: "wamx-target--normal",
    icon: "🐹",
    tag: `+${normalPoints}`,
    label: "garden mole; hit it",
  };
}

function getPerformanceMessage(summary) {
  if (summary.accuracyPercent >= 90 && summary.bestStreak >= 5) {
    return {
      eyebrow: "Garden legend",
      title: "Lightning reflexes.",
      detail: "You stayed precise even as the garden accelerated.",
    };
  }
  if (summary.accuracyPercent >= 70) {
    return {
      eyebrow: "Strong round",
      title: "Sharp eyes, steady hands.",
      detail: "A cleaner streak will push the next score much higher.",
    };
  }
  return {
    eyebrow: "Round complete",
    title: "You learned the garden.",
    detail: "Wait for each ripple to resolve, then commit to one hole.",
  };
}

function Legend({
  compact = false,
  normalPoints = 100,
  goldPoints = 300,
  decoyPenalty = 125,
}) {
  return (
    <ul className={`wamx-legend${compact ? " wamx-legend--compact" : ""}`}>
      {LEGEND_ITEMS.map((item) => {
        const detail =
          item.type === WHACK_A_MOLE_TARGET_TYPES.NORMAL
            ? `${normalPoints} points, plus streak bonus`
            : item.type === WHACK_A_MOLE_TARGET_TYPES.GOLD
              ? `${goldPoints} points, plus streak bonus`
              : `A hit costs up to ${decoyPenalty} points and your streak`;
        return (
          <li className="wamx-legend-item" key={item.type}>
            <span
              aria-hidden="true"
              className={`wamx-legend-icon wamx-legend-icon--${item.type}`}
            >
              {item.icon}
            </span>
            <span className="wamx-legend-copy">
              <strong>{item.title}</strong>
              <span>{item.instruction}</span>
              {!compact ? <small>{detail}</small> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PhaseSteps({ activeIndex }) {
  return (
    <ol aria-label="Round phases" className="wamx-steps">
      {PHASE_STEPS.map((step, index) => (
        <li
          aria-current={index === activeIndex ? "step" : undefined}
          className={index <= activeIndex ? "is-reached" : undefined}
          key={step.id}
        >
          <span aria-hidden="true">{index + 1}</span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

function Metric({ label, value, accent = false }) {
  return (
    <div className={`wamx-metric${accent ? " is-accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * A complete Whack-a-Mole surface with an optional controlled reducer boundary.
 *
 * Controlled App integration:
 *   state={whackState}
 *   onAction={(action) =>
 *     setWhackState((previous) => reduceWhackAMoleGame(previous, action))
 *   }
 *
 * Camera input can use the same boundary by dispatching HIT_HOLE with a
 * holeIndex, performance timestamp, and source: "camera".
 */
export function WhackAMoleExperience({
  state: controlledState,
  onAction,
  seed = "practice",
  daily = false,
  dailyDate,
  dailyChallengeId = "standard",
  config,
  autoStart = false,
  onComplete,
  onExit,
  className = "",
}) {
  const controlsId = useId();
  const dailySeed = useMemo(
    () =>
      createDailyWhackAMoleSeed(
        dailyDate ?? new Date(),
        dailyChallengeId,
      ),
    [dailyChallengeId, dailyDate],
  );
  const resolvedSeed = daily ? dailySeed : seed;
  const initialOptionsRef = useRef(null);
  if (initialOptionsRef.current === null) {
    initialOptionsRef.current = {
      seed: resolvedSeed,
      config,
      autoStart,
      now: getNow(),
    };
  }
  const [internalState, internalDispatch] = useReducer(
    reduceWhackAMoleGame,
    initialOptionsRef.current,
    createWhackAMoleGame,
  );
  const isControlled = controlledState !== undefined;
  const experience = isControlled ? controlledState : internalState;
  const dispatchAction = useCallback(
    (action) => {
      if (isControlled) {
        onAction?.(action);
      } else {
        internalDispatch(action);
      }
    },
    [isControlled, onAction],
  );
  const stats = getWhackAMoleStats(experience);
  const summary = getWhackAMoleSummary(experience);
  const difficulty = getWhackAMoleDifficulty(
    experience.elapsedMs,
    experience.config.roundDurationMs,
  );
  const resultVisible =
    experience.phase === WHACK_A_MOLE_PHASES.RESULT;
  const phaseStepIndex = getPhaseStepIndex(experience);
  const holeButtonRefs = useRef([]);
  const resumeButtonRef = useRef(null);
  const resultHeadingRef = useRef(null);
  const previousPhaseRef = useRef(experience.phase);
  const deliveredResultRef = useRef(null);

  const startRound = useCallback(() => {
    dispatchAction({
      type: WHACK_A_MOLE_ACTIONS.START,
      now: getNow(),
      seed: resolvedSeed,
      config,
    });
  }, [config, dispatchAction, resolvedSeed]);

  const pauseRound = useCallback(() => {
    dispatchAction({
      type: WHACK_A_MOLE_ACTIONS.PAUSE,
      now: getNow(),
    });
  }, [dispatchAction]);

  const resumeRound = useCallback(() => {
    dispatchAction({
      type: WHACK_A_MOLE_ACTIONS.RESUME,
      now: getNow(),
    });
  }, [dispatchAction]);

  const hitHole = useCallback(
    (holeIndex, source = "pointer") => {
      dispatchAction({
        type: WHACK_A_MOLE_ACTIONS.HIT_HOLE,
        holeIndex,
        now: getNow(),
        source,
      });
    },
    [dispatchAction],
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      experience.phase !== WHACK_A_MOLE_PHASES.TEACH &&
      experience.phase !== WHACK_A_MOLE_PHASES.COUNTDOWN &&
      experience.phase !== WHACK_A_MOLE_PHASES.PLAYING
    ) {
      return undefined;
    }
    const timerId = window.setInterval(() => {
      dispatchAction({
        type: WHACK_A_MOLE_ACTIONS.TICK,
        now: getNow(),
      });
    }, 80);
    return () => window.clearInterval(timerId);
  }, [dispatchAction, experience.phase]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    if (
      experience.phase === WHACK_A_MOLE_PHASES.PLAYING &&
      previousPhase !== WHACK_A_MOLE_PHASES.PLAYING
    ) {
      holeButtonRefs.current[0]?.focus();
    } else if (
      experience.phase === WHACK_A_MOLE_PHASES.PAUSED &&
      previousPhase !== WHACK_A_MOLE_PHASES.PAUSED
    ) {
      resumeButtonRef.current?.focus();
    } else if (
      experience.phase === WHACK_A_MOLE_PHASES.RESULT &&
      previousPhase !== WHACK_A_MOLE_PHASES.RESULT
    ) {
      resultHeadingRef.current?.focus();
    }
    previousPhaseRef.current = experience.phase;
  }, [experience.phase]);

  useEffect(() => {
    if (!resultVisible) {
      return;
    }
    const resultKey = `${experience.seed}:${experience.transitionCount}`;
    if (deliveredResultRef.current === resultKey) {
      return;
    }
    deliveredResultRef.current = resultKey;
    onComplete?.(experience.result ?? summary);
  }, [
    experience.result,
    experience.seed,
    experience.transitionCount,
    onComplete,
    resultVisible,
    summary,
  ]);

  const handleKeyboardInput = useCallback(
    (event) => {
      if (
        experience.phase !== WHACK_A_MOLE_PHASES.PLAYING ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat
      ) {
        return;
      }
      const holeIndex = Number.parseInt(event.key, 10) - 1;
      if (
        !Number.isInteger(holeIndex) ||
        holeIndex < 0 ||
        holeIndex >= experience.config.holeCount
      ) {
        return;
      }
      event.preventDefault();
      hitHole(holeIndex, "keyboard");
    },
    [experience.config.holeCount, experience.phase, hitHole],
  );

  const roundProgress =
    experience.config.roundDurationMs > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (experience.remainingMs /
              experience.config.roundDurationMs) *
              100,
          ),
        )
      : 0;
  const countdownNumber = formatSeconds(experience.phaseRemainingMs);
  const feedbackTone =
    experience.lastAction?.kind === "hit"
      ? "good"
      : experience.lastAction
        ? "warning"
        : "neutral";
  const performanceMessage = resultVisible
    ? getPerformanceMessage(summary)
    : null;
  const rootClassName = ["wamx", className].filter(Boolean).join(" ");
  const seedLabel = daily ? "Daily board" : "Seeded practice";

  return (
    <section
      aria-labelledby={`${controlsId}-title`}
      className={rootClassName}
      data-experience-phase={experience.phase}
      onKeyDown={handleKeyboardInput}
    >
      <style>{WHACK_A_MOLE_STYLES}</style>

      <header className="wamx-header">
        <div className="wamx-brand">
          <span aria-hidden="true" className="wamx-brand-mark">
            W
          </span>
          <div>
            <p className="wamx-eyebrow">
              Reflex garden
              <span aria-hidden="true"> · </span>
              <span className="wamx-seed-label">{seedLabel}</span>
            </p>
            <h2 id={`${controlsId}-title`}>Ready, Set, Whack</h2>
          </div>
        </div>
        <div className="wamx-header-actions">
          {(experience.phase === WHACK_A_MOLE_PHASES.TEACH ||
            experience.phase === WHACK_A_MOLE_PHASES.COUNTDOWN ||
            experience.phase === WHACK_A_MOLE_PHASES.PLAYING) && (
            <button
              className="wamx-button wamx-button--quiet"
              onClick={pauseRound}
              type="button"
            >
              Pause
            </button>
          )}
          {onExit &&
          experience.phase !== WHACK_A_MOLE_PHASES.PAUSED &&
          !resultVisible ? (
            <button
              className="wamx-button wamx-button--quiet"
              onClick={onExit}
              type="button"
            >
              Exit
            </button>
          ) : null}
        </div>
      </header>

      <PhaseSteps activeIndex={phaseStepIndex} />

      {experience.phase === WHACK_A_MOLE_PHASES.IDLE ? (
        <div className="wamx-briefing">
          <div className="wamx-briefing-copy">
            <p className="wamx-kicker">
              {Math.round(experience.config.roundDurationMs / 1_000)} seconds
              {" · "}
              {experience.config.holeCount} holes · one rule
            </p>
            <h3>Wait for the reveal. Whack the right targets.</h3>
            <p>
              Each ripple telegraphs the next target. Build a streak with
              garden and gold moles, but resist the red decoys.
            </p>
            <div className="wamx-callout" id={controlsId}>
              <strong>Use what feels natural.</strong>
              <span>
                Tap or click a hole, press number keys 1–9, or use camera
                pinch input when the parent experience connects it.
              </span>
            </div>
            <div className="wamx-primary-actions">
              <button
                autoFocus
                className="wamx-button wamx-button--primary"
                onClick={startRound}
                type="button"
              >
                Start round
                <span aria-hidden="true">→</span>
              </button>
              <span className="wamx-round-note">
                Includes a quick practice cue and countdown
              </span>
            </div>
          </div>
          <div className="wamx-briefing-legend">
            <p className="wamx-eyebrow">Know your targets</p>
            <Legend
              decoyPenalty={experience.config.decoyPenalty}
              goldPoints={experience.config.goldPoints}
              normalPoints={experience.config.normalPoints}
            />
          </div>
        </div>
      ) : null}

      {experience.phase === WHACK_A_MOLE_PHASES.TEACH ? (
        <div className="wamx-teach wamx-motion-safe">
          <div className="wamx-teach-demo" aria-hidden="true">
            <span className="wamx-demo-ripple" />
            <span className="wamx-demo-target">🐹</span>
            <span className="wamx-demo-hole" />
          </div>
          <div className="wamx-teach-copy">
            <p className="wamx-eyebrow">Quick cue</p>
            <h3>Ripple. Reveal. React.</h3>
            <p>
              Hold your hit while a hole pulses. Commit once the target is
              fully visible.
            </p>
            <Legend
              compact
              decoyPenalty={experience.config.decoyPenalty}
              goldPoints={experience.config.goldPoints}
              normalPoints={experience.config.normalPoints}
            />
          </div>
          <div className="wamx-setup-progress" aria-hidden="true">
            <span
              style={{
                width: `${
                  experience.config.teachDurationMs > 0
                    ? 100 -
                      (experience.phaseRemainingMs /
                        experience.config.teachDurationMs) *
                        100
                    : 100
                }%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {experience.phase === WHACK_A_MOLE_PHASES.COUNTDOWN ? (
        <div className="wamx-countdown wamx-motion-safe">
          <p className="wamx-eyebrow">Hands ready</p>
          <strong aria-hidden="true" key={countdownNumber}>
            {Math.max(1, countdownNumber)}
          </strong>
          <h3>Find the first ripple.</h3>
          <p>The round clock starts after the countdown.</p>
        </div>
      ) : null}

      {experience.phase === WHACK_A_MOLE_PHASES.PLAYING ? (
        <div className="wamx-gameplay">
          <div className="wamx-playfield">
            <div aria-label="Round statistics" className="wamx-hud">
              <Metric accent label="Score" value={experience.score} />
              <Metric
                label="Time"
                value={`${formatSeconds(experience.remainingMs)}s`}
              />
              <Metric
                label="Accuracy"
                value={`${Math.round(stats.accuracyPercent)}%`}
              />
              <Metric label="Streak" value={`×${experience.streak}`} />
            </div>
            <div className="wamx-timer-track" role="presentation">
              <span style={{ width: `${roundProgress}%` }} />
            </div>

            <div
              aria-describedby={`${controlsId}-board-help`}
              aria-label={`Whack-a-Mole garden, holes 1 through ${experience.config.holeCount}`}
              className="wamx-board"
              role="group"
            >
              {Array.from(
                { length: experience.config.holeCount },
                (_, holeIndex) => {
                  const target =
                    experience.target?.holeIndex === holeIndex
                      ? experience.target
                      : null;
                  const targetCopy = getTargetCopy(
                    target,
                    experience.config.normalPoints,
                    experience.config.goldPoints,
                  );
                  const holeLabel = targetCopy
                    ? `Hole ${holeIndex + 1}, ${targetCopy.label}`
                    : `Hole ${holeIndex + 1}, empty`;
                  return (
                    <button
                      aria-keyshortcuts={String(holeIndex + 1)}
                      aria-label={holeLabel}
                      className={`wamx-hole${
                        targetCopy ? " has-target" : ""
                      }`}
                      data-hole-index={holeIndex}
                      key={holeIndex}
                      onClick={() => hitHole(holeIndex, "pointer")}
                      ref={(element) => {
                        holeButtonRefs.current[holeIndex] = element;
                      }}
                      type="button"
                    >
                      <span aria-hidden="true" className="wamx-hole-number">
                        {holeIndex + 1}
                      </span>
                      {targetCopy ? (
                        <span
                          aria-hidden="true"
                          className={`wamx-target wamx-motion-safe ${targetCopy.className}`}
                        >
                          <span className="wamx-target-icon">
                            {targetCopy.icon}
                          </span>
                          <span className="wamx-target-tag">
                            {targetCopy.tag}
                          </span>
                        </span>
                      ) : null}
                      <span aria-hidden="true" className="wamx-hole-rim" />
                    </button>
                  );
                },
              )}
            </div>
            <p className="wamx-board-help" id={`${controlsId}-board-help`}>
              Tap a hole or press its number. Wait during the blue ripple.
            </p>
          </div>

          <aside className="wamx-coach" aria-label="Round details">
            <div className="wamx-pace">
              <div>
                <span className="wamx-eyebrow">Pace</span>
                <strong>{difficulty.label}</strong>
              </div>
              <span className={`wamx-tier wamx-tier--${difficulty.tier}`}>
                Level {difficulty.tier}
              </span>
            </div>

            <div
              className={`wamx-feedback wamx-feedback--${feedbackTone}`}
            >
              <span aria-hidden="true">
                {feedbackTone === "good"
                  ? "✓"
                  : feedbackTone === "warning"
                    ? "!"
                    : "◎"}
              </span>
              <p>{experience.announcement}</p>
            </div>

            <dl className="wamx-detail-stats">
              <div>
                <dt>Average reaction</dt>
                <dd>{formatReaction(stats.averageHitTimeMs)}</dd>
              </div>
              <div>
                <dt>Fastest hit</dt>
                <dd>{formatReaction(stats.fastestHitMs)}</dd>
              </div>
              <div>
                <dt>Misses</dt>
                <dd>{experience.misses}</dd>
              </div>
              <div>
                <dt>Best streak</dt>
                <dd>×{experience.bestStreak}</dd>
              </div>
            </dl>

            <Legend
              compact
              decoyPenalty={experience.config.decoyPenalty}
              goldPoints={experience.config.goldPoints}
              normalPoints={experience.config.normalPoints}
            />
          </aside>
        </div>
      ) : null}

      {experience.phase === WHACK_A_MOLE_PHASES.PAUSED ? (
        <div
          aria-labelledby={`${controlsId}-paused-title`}
          className="wamx-pause"
          role="dialog"
        >
          <span aria-hidden="true" className="wamx-pause-icon">
            Ⅱ
          </span>
          <p className="wamx-eyebrow">Everything is frozen</p>
          <h3 id={`${controlsId}-paused-title`}>Round paused</h3>
          <p>
            The clock and current target will continue exactly where you
            left them.
          </p>
          <div className="wamx-primary-actions">
            <button
              className="wamx-button wamx-button--primary"
              onClick={resumeRound}
              ref={resumeButtonRef}
              type="button"
            >
              Resume
            </button>
            <button
              className="wamx-button wamx-button--secondary"
              onClick={startRound}
              type="button"
            >
              Restart round
            </button>
            {onExit ? (
              <button
                className="wamx-button wamx-button--quiet"
                onClick={onExit}
                type="button"
              >
                Exit
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {resultVisible ? (
        <div className="wamx-result">
          <div className="wamx-result-hero">
            <div
              className="wamx-score-orbit wamx-motion-safe"
              aria-label={`${summary.score} points`}
            >
              <span>Score</span>
              <strong>{summary.score}</strong>
              <small>points</small>
            </div>
            <div>
              <p className="wamx-eyebrow">
                {performanceMessage.eyebrow}
              </p>
              <h3 ref={resultHeadingRef} tabIndex={-1}>
                {performanceMessage.title}
              </h3>
              <p>{performanceMessage.detail}</p>
            </div>
          </div>

          <dl className="wamx-recap" aria-label="Round recap">
            <div>
              <dt>Targets hit</dt>
              <dd>{summary.hits}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{Math.round(summary.accuracyPercent)}%</dd>
            </div>
            <div>
              <dt>Average reaction</dt>
              <dd>{formatReaction(summary.averageHitTimeMs)}</dd>
            </div>
            <div>
              <dt>Fastest hit</dt>
              <dd>{formatReaction(summary.fastestHitMs)}</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>×{summary.bestStreak}</dd>
            </div>
            <div>
              <dt>Misses</dt>
              <dd>{summary.misses}</dd>
            </div>
          </dl>

          <div className="wamx-result-specials">
            <span>
              <strong>{summary.goldHits}</strong> gold hit
              {summary.goldHits === 1 ? "" : "s"}
            </span>
            <span>
              <strong>{summary.decoysAvoided}</strong> decoy
              {summary.decoysAvoided === 1 ? "" : "s"} avoided
            </span>
            {summary.decoyHits > 0 ? (
              <span className="is-warning">
                <strong>{summary.decoyHits}</strong> decoy
                {summary.decoyHits === 1 ? "" : "s"} hit
              </span>
            ) : null}
          </div>

          <div className="wamx-primary-actions">
            <button
              className="wamx-button wamx-button--primary"
              onClick={startRound}
              type="button"
            >
              Play same board again
            </button>
            {onExit ? (
              <button
                className="wamx-button wamx-button--secondary"
                onClick={onExit}
                type="button"
              >
                Back to games
              </button>
            ) : null}
          </div>
          <p className="wamx-result-note">
            Same seed means the same target pattern—perfect for a fair rematch.
          </p>
        </div>
      ) : null}

      <p
        aria-atomic="true"
        aria-live={resultVisible ? "assertive" : "polite"}
        className="wamx-sr-only"
        role={resultVisible ? "alert" : "status"}
      >
        {experience.announcement}
      </p>
    </section>
  );
}

export default WhackAMoleExperience;

const WHACK_A_MOLE_STYLES = `
  .wamx {
    --wamx-ink: #f8fafc;
    --wamx-muted: #aab8cd;
    --wamx-panel: rgba(10, 23, 43, 0.9);
    --wamx-panel-soft: rgba(18, 37, 64, 0.72);
    --wamx-line: rgba(174, 202, 234, 0.18);
    --wamx-blue: #62d8ff;
    --wamx-blue-deep: #168dcc;
    --wamx-gold: #ffd45f;
    --wamx-green: #66e2ad;
    --wamx-red: #ff6f78;
    --wamx-shadow: 0 28px 80px rgba(0, 4, 14, 0.38);
    width: min(100%, 1180px);
    min-height: min(760px, calc(100dvh - 2rem));
    margin-inline: auto;
    padding: clamp(1rem, 2.5vw, 2rem);
    color: var(--wamx-ink);
    background:
      radial-gradient(circle at 12% 0%, rgba(42, 182, 227, 0.15), transparent 30%),
      radial-gradient(circle at 100% 85%, rgba(102, 226, 173, 0.1), transparent 26%),
      linear-gradient(145deg, #071322 0%, #0b1b31 54%, #07111f 100%);
    border: 1px solid rgba(170, 209, 241, 0.2);
    border-radius: clamp(1rem, 2vw, 1.75rem);
    box-shadow: var(--wamx-shadow);
    overflow: hidden;
    position: relative;
    isolation: isolate;
    box-sizing: border-box;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
  }

  .wamx *,
  .wamx *::before,
  .wamx *::after {
    box-sizing: border-box;
  }

  .wamx button {
    font: inherit;
  }

  .wamx button:focus-visible,
  .wamx [tabindex="-1"]:focus-visible {
    outline: 3px solid #ffffff;
    outline-offset: 3px;
  }

  .wamx-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .wamx-brand {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-width: 0;
  }

  .wamx-brand-mark {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid rgba(99, 216, 255, 0.55);
    border-radius: 0.85rem;
    color: #061421;
    background: linear-gradient(145deg, #9bedff, #58cfef);
    box-shadow: 0 8px 28px rgba(47, 190, 231, 0.2);
    font-size: 1rem;
    font-weight: 950;
    transform: rotate(-5deg);
  }

  .wamx-eyebrow,
  .wamx-kicker {
    margin: 0 0 0.32rem;
    color: var(--wamx-blue);
    font-size: 0.7rem;
    font-weight: 850;
    letter-spacing: 0.14em;
    line-height: 1.25;
    text-transform: uppercase;
  }

  .wamx-seed-label {
    color: var(--wamx-muted);
  }

  .wamx h2,
  .wamx h3,
  .wamx p {
    max-width: none;
  }

  .wamx h2 {
    margin: 0;
    font-size: clamp(1.35rem, 2.6vw, 2rem);
    line-height: 1.05;
    letter-spacing: -0.035em;
  }

  .wamx h3 {
    margin: 0;
    font-size: clamp(1.6rem, 4vw, 3.35rem);
    line-height: 1.02;
    letter-spacing: -0.045em;
  }

  .wamx-header-actions,
  .wamx-primary-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.7rem;
  }

  .wamx-button {
    min-height: 2.75rem;
    padding: 0.72rem 1rem;
    border: 1px solid transparent;
    border-radius: 0.85rem;
    cursor: pointer;
    color: var(--wamx-ink);
    background: transparent;
    font-weight: 800;
    line-height: 1;
    touch-action: manipulation;
  }

  .wamx-button:hover {
    transform: translateY(-1px);
  }

  .wamx-button--primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-height: 3.25rem;
    padding-inline: 1.35rem;
    color: #05131f;
    background: linear-gradient(135deg, #8aebff, #5ad7f4);
    box-shadow: 0 10px 34px rgba(57, 192, 228, 0.22);
  }

  .wamx-button--secondary {
    border-color: rgba(137, 218, 242, 0.34);
    background: rgba(51, 101, 132, 0.22);
  }

  .wamx-button--quiet {
    border-color: var(--wamx-line);
    color: #d7e6f5;
    background: rgba(9, 22, 40, 0.52);
  }

  .wamx-steps {
    display: flex;
    align-items: center;
    gap: 0;
    margin: 1.25rem 0 clamp(1.15rem, 2.4vw, 2rem);
    padding: 0;
    color: #73849c;
    list-style: none;
  }

  .wamx-steps li {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .wamx-steps li:not(:last-child) {
    flex: 1;
  }

  .wamx-steps li:not(:last-child)::after {
    content: "";
    height: 1px;
    flex: 1;
    margin-inline: 0.65rem;
    background: var(--wamx-line);
  }

  .wamx-steps li > span {
    display: grid;
    width: 1.4rem;
    height: 1.4rem;
    place-items: center;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 0.62rem;
  }

  .wamx-steps li.is-reached {
    color: #c9eefe;
  }

  .wamx-steps li[aria-current="step"] > span {
    color: #061521;
    border-color: var(--wamx-blue);
    background: var(--wamx-blue);
    box-shadow: 0 0 0 4px rgba(98, 216, 255, 0.13);
  }

  .wamx-briefing {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.8fr);
    gap: clamp(1rem, 3vw, 2.5rem);
    align-items: stretch;
  }

  .wamx-briefing-copy,
  .wamx-briefing-legend,
  .wamx-teach,
  .wamx-countdown,
  .wamx-pause,
  .wamx-result {
    border: 1px solid var(--wamx-line);
    background: var(--wamx-panel);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  }

  .wamx-briefing-copy {
    display: flex;
    min-height: 29rem;
    padding: clamp(1.4rem, 4vw, 3.5rem);
    border-radius: 1.4rem;
    flex-direction: column;
    justify-content: center;
  }

  .wamx-briefing-copy > p:not(.wamx-kicker) {
    max-width: 42rem;
    margin: 1rem 0 0;
    color: var(--wamx-muted);
    font-size: clamp(1rem, 1.8vw, 1.15rem);
    line-height: 1.65;
  }

  .wamx-callout {
    display: grid;
    gap: 0.25rem;
    max-width: 40rem;
    margin: 1.5rem 0;
    padding: 1rem 1.1rem;
    border-left: 3px solid var(--wamx-blue);
    border-radius: 0 0.85rem 0.85rem 0;
    color: #dfefff;
    background: rgba(60, 160, 198, 0.1);
    line-height: 1.45;
  }

  .wamx-callout span,
  .wamx-round-note {
    color: var(--wamx-muted);
    font-size: 0.86rem;
  }

  .wamx-briefing-legend {
    padding: clamp(1.25rem, 2.8vw, 2rem);
    border-radius: 1.4rem;
  }

  .wamx-legend {
    display: grid;
    gap: 0.7rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .wamx-legend-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-width: 0;
    padding: 0.85rem;
    border: 1px solid var(--wamx-line);
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.025);
  }

  .wamx-legend-icon {
    display: grid;
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.85rem;
    font-size: 1.35rem;
    font-weight: 950;
    color: #06131f;
    background: var(--wamx-green);
  }

  .wamx-legend-icon--gold {
    background: var(--wamx-gold);
  }

  .wamx-legend-icon--decoy {
    color: white;
    background: var(--wamx-red);
  }

  .wamx-legend-copy {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
  }

  .wamx-legend-copy strong {
    font-size: 0.92rem;
  }

  .wamx-legend-copy span {
    color: #d6e5f4;
    font-size: 0.78rem;
    font-weight: 750;
  }

  .wamx-legend-copy small {
    color: var(--wamx-muted);
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .wamx-legend--compact {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .wamx-legend--compact .wamx-legend-item {
    gap: 0.55rem;
    padding: 0.6rem;
  }

  .wamx-legend--compact .wamx-legend-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 0.6rem;
    font-size: 0.95rem;
  }

  .wamx-legend--compact .wamx-legend-copy span {
    display: none;
  }

  .wamx-teach {
    display: grid;
    grid-template-columns: minmax(15rem, 0.85fr) minmax(0, 1.15fr);
    gap: clamp(1.5rem, 5vw, 4rem);
    min-height: 31rem;
    padding: clamp(1.5rem, 4vw, 3.5rem);
    border-radius: 1.4rem;
    align-items: center;
    position: relative;
    overflow: hidden;
  }

  .wamx-teach-demo {
    display: grid;
    width: min(100%, 22rem);
    aspect-ratio: 1;
    margin-inline: auto;
    place-items: center;
    position: relative;
  }

  .wamx-demo-hole {
    width: 74%;
    height: 28%;
    border: 0.7rem solid #10243a;
    border-radius: 50%;
    background: #02070c;
    box-shadow:
      inset 0 1rem 2rem rgba(0, 0, 0, 0.8),
      0 1rem 0 #081526;
    position: absolute;
    bottom: 9%;
  }

  .wamx-demo-ripple {
    width: 56%;
    aspect-ratio: 1;
    border: 3px solid var(--wamx-blue);
    border-radius: 50%;
    opacity: 0;
    animation: wamx-ripple-demo 1.8s ease-out infinite;
  }

  .wamx-demo-target {
    z-index: 1;
    font-size: clamp(4rem, 10vw, 7rem);
    transform: translateY(10%);
    animation: wamx-target-demo 1.8s ease-in-out infinite;
  }

  .wamx-teach-copy > p:not(.wamx-eyebrow) {
    margin: 1rem 0 1.5rem;
    color: var(--wamx-muted);
    font-size: 1.05rem;
    line-height: 1.6;
  }

  .wamx-setup-progress {
    height: 0.28rem;
    background: rgba(117, 154, 188, 0.12);
    position: absolute;
    inset: auto 0 0;
  }

  .wamx-setup-progress span {
    display: block;
    height: 100%;
    background: var(--wamx-blue);
    transition: width 80ms linear;
  }

  .wamx-countdown,
  .wamx-pause {
    display: flex;
    min-height: 31rem;
    padding: 2rem;
    border-radius: 1.4rem;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    text-align: center;
  }

  .wamx-countdown > strong {
    display: grid;
    width: clamp(8rem, 25vw, 13rem);
    aspect-ratio: 1;
    margin: 0.6rem 0 1.2rem;
    place-items: center;
    border: 1px solid rgba(98, 216, 255, 0.38);
    border-radius: 50%;
    color: #071421;
    background: var(--wamx-blue);
    box-shadow:
      0 0 0 1rem rgba(98, 216, 255, 0.06),
      0 0 5rem rgba(98, 216, 255, 0.22);
    font-size: clamp(4rem, 12vw, 7.5rem);
    line-height: 1;
    animation: wamx-count 720ms ease-out both;
  }

  .wamx-countdown > p:last-child,
  .wamx-pause > p {
    margin: 0.8rem 0 1.5rem;
    color: var(--wamx-muted);
  }

  .wamx-gameplay {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(14.5rem, 0.32fr);
    gap: clamp(0.8rem, 2vw, 1.4rem);
    align-items: stretch;
  }

  .wamx-playfield,
  .wamx-coach {
    border: 1px solid var(--wamx-line);
    border-radius: 1.35rem;
    background: var(--wamx-panel);
  }

  .wamx-playfield {
    min-width: 0;
    padding: clamp(0.75rem, 1.8vw, 1.2rem);
  }

  .wamx-hud {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .wamx-metric {
    display: grid;
    gap: 0.12rem;
    padding: 0.68rem 0.8rem;
    border: 1px solid rgba(170, 202, 234, 0.12);
    border-radius: 0.8rem;
    background: rgba(255, 255, 255, 0.025);
  }

  .wamx-metric > span {
    color: var(--wamx-muted);
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .wamx-metric > strong {
    font-size: clamp(1.05rem, 2.4vw, 1.55rem);
    line-height: 1.15;
  }

  .wamx-metric.is-accent > strong {
    color: var(--wamx-blue);
  }

  .wamx-timer-track {
    height: 0.24rem;
    margin: 0.7rem 0 0.85rem;
    border-radius: 999px;
    background: rgba(145, 176, 205, 0.1);
    overflow: hidden;
  }

  .wamx-timer-track span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--wamx-green), var(--wamx-blue));
    transition: width 80ms linear;
  }

  .wamx-board {
    display: grid;
    width: min(100%, 44rem);
    aspect-ratio: 1.36;
    margin-inline: auto;
    padding: clamp(0.65rem, 1.7vw, 1.15rem);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: clamp(0.45rem, 1.2vw, 0.9rem);
    border: 1px solid rgba(112, 191, 171, 0.15);
    border-radius: 1.2rem;
    background:
      linear-gradient(rgba(9, 31, 40, 0.6), rgba(4, 17, 24, 0.8)),
      repeating-linear-gradient(105deg, rgba(83, 144, 117, 0.08) 0 1px, transparent 1px 28px);
  }

  .wamx-hole {
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: 1px solid rgba(152, 210, 221, 0.1);
    border-radius: 1rem;
    cursor: pointer;
    color: var(--wamx-ink);
    background: rgba(8, 25, 35, 0.5);
    position: relative;
    overflow: hidden;
    touch-action: manipulation;
  }

  .wamx-hole:hover {
    border-color: rgba(98, 216, 255, 0.36);
    background: rgba(18, 48, 61, 0.7);
  }

  .wamx-hole:active {
    transform: scale(0.98);
  }

  .wamx-hole-number {
    display: grid;
    width: 1.4rem;
    height: 1.4rem;
    place-items: center;
    border: 1px solid rgba(172, 204, 229, 0.15);
    border-radius: 0.42rem;
    color: #8296ad;
    background: rgba(3, 13, 23, 0.66);
    font-size: 0.66rem;
    font-weight: 900;
    position: absolute;
    top: 0.42rem;
    left: 0.42rem;
  }

  .wamx-hole-rim {
    width: 72%;
    height: 24%;
    border: clamp(0.25rem, 0.7vw, 0.48rem) solid #132b3f;
    border-radius: 50%;
    background: #02070d;
    box-shadow:
      inset 0 0.65rem 1.3rem rgba(0, 0, 0, 0.9),
      0 0.38rem 0 #081827;
    position: absolute;
    left: 14%;
    bottom: 10%;
  }

  .wamx-target {
    display: flex;
    z-index: 1;
    width: 64%;
    height: 76%;
    padding: 0.25rem;
    border-radius: 48% 48% 34% 34%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    color: #07131d;
    background: var(--wamx-green);
    box-shadow: 0 0.5rem 1.4rem rgba(0, 0, 0, 0.25);
    position: absolute;
    left: 18%;
    bottom: 16%;
    animation: wamx-rise 170ms cubic-bezier(0.2, 0.9, 0.25, 1.2) both;
  }

  .wamx-target-icon {
    font-size: clamp(1.25rem, 4.2vw, 2.8rem);
    font-weight: 950;
    line-height: 1;
  }

  .wamx-target-tag {
    margin-top: 0.15rem;
    padding: 0.16rem 0.36rem;
    border-radius: 999px;
    color: white;
    background: rgba(3, 15, 21, 0.78);
    font-size: clamp(0.48rem, 1.1vw, 0.66rem);
    font-weight: 950;
    letter-spacing: 0.05em;
  }

  .wamx-target--gold {
    background: linear-gradient(145deg, #fff0a8, var(--wamx-gold));
    box-shadow:
      0 0 0 0.3rem rgba(255, 212, 95, 0.08),
      0 0 2.2rem rgba(255, 212, 95, 0.38);
  }

  .wamx-target--decoy {
    color: white;
    background:
      repeating-linear-gradient(135deg, rgba(75, 7, 17, 0.22) 0 8px, transparent 8px 16px),
      var(--wamx-red);
    box-shadow:
      0 0 0 0.3rem rgba(255, 111, 120, 0.08),
      0 0 1.8rem rgba(255, 77, 91, 0.3);
  }

  .wamx-target--telegraph {
    width: 70%;
    aspect-ratio: 1;
    height: auto;
    border: 2px solid var(--wamx-blue);
    border-radius: 50%;
    color: var(--wamx-blue);
    background: rgba(98, 216, 255, 0.06);
    box-shadow: none;
    bottom: 5%;
    animation: wamx-telegraph 650ms ease-out infinite;
  }

  .wamx-target--telegraph .wamx-target-icon {
    font-size: 2rem;
  }

  .wamx-target--telegraph .wamx-target-tag {
    color: var(--wamx-blue);
    background: rgba(3, 16, 26, 0.9);
  }

  .wamx-board-help {
    margin: 0.65rem 0 0;
    color: var(--wamx-muted);
    font-size: 0.73rem;
    line-height: 1.4;
    text-align: center;
  }

  .wamx-coach {
    display: flex;
    min-width: 0;
    padding: 1rem;
    flex-direction: column;
    gap: 0.8rem;
  }

  .wamx-pace {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
  }

  .wamx-pace > div {
    display: grid;
  }

  .wamx-tier {
    padding: 0.38rem 0.55rem;
    border: 1px solid rgba(98, 216, 255, 0.2);
    border-radius: 999px;
    color: var(--wamx-blue);
    background: rgba(98, 216, 255, 0.07);
    font-size: 0.7rem;
    font-weight: 850;
    white-space: nowrap;
  }

  .wamx-tier--4 {
    color: #111000;
    border-color: var(--wamx-gold);
    background: var(--wamx-gold);
  }

  .wamx-feedback {
    display: flex;
    min-height: 4.5rem;
    padding: 0.8rem;
    border: 1px solid var(--wamx-line);
    border-radius: 0.9rem;
    align-items: flex-start;
    gap: 0.65rem;
    background: rgba(255, 255, 255, 0.025);
  }

  .wamx-feedback > span {
    display: grid;
    width: 1.6rem;
    height: 1.6rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 50%;
    color: #06161e;
    background: var(--wamx-blue);
    font-weight: 950;
  }

  .wamx-feedback--good > span {
    background: var(--wamx-green);
  }

  .wamx-feedback--warning > span {
    color: white;
    background: var(--wamx-red);
  }

  .wamx-feedback p {
    margin: 0;
    color: #d9e8f5;
    font-size: 0.77rem;
    line-height: 1.45;
  }

  .wamx-detail-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    margin: 0;
    border: 1px solid var(--wamx-line);
    border-radius: 0.9rem;
    background: var(--wamx-line);
    overflow: hidden;
  }

  .wamx-detail-stats > div {
    display: grid;
    gap: 0.18rem;
    padding: 0.72rem;
    background: #0b1c31;
  }

  .wamx-detail-stats dt {
    color: var(--wamx-muted);
    font-size: 0.65rem;
  }

  .wamx-detail-stats dd {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 850;
  }

  .wamx-coach .wamx-legend--compact {
    margin-top: auto;
    grid-template-columns: 1fr;
  }

  .wamx-pause-icon {
    display: grid;
    width: 4rem;
    aspect-ratio: 1;
    margin-bottom: 1.2rem;
    place-items: center;
    border: 1px solid rgba(98, 216, 255, 0.28);
    border-radius: 1.2rem;
    color: var(--wamx-blue);
    background: rgba(98, 216, 255, 0.08);
    font-size: 1.5rem;
    font-weight: 950;
  }

  .wamx-result {
    min-height: 31rem;
    padding: clamp(1.3rem, 3.5vw, 2.75rem);
    border-radius: 1.4rem;
  }

  .wamx-result-hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: clamp(1.4rem, 4vw, 3.5rem);
    align-items: center;
  }

  .wamx-result-hero > div:last-child > p:last-child {
    margin: 0.9rem 0 0;
    color: var(--wamx-muted);
    line-height: 1.55;
  }

  .wamx-score-orbit {
    display: grid;
    width: clamp(9.5rem, 20vw, 13rem);
    aspect-ratio: 1;
    place-items: center;
    align-content: center;
    border: 1px solid rgba(98, 216, 255, 0.35);
    border-radius: 50%;
    background:
      radial-gradient(circle, rgba(98, 216, 255, 0.17), rgba(98, 216, 255, 0.035) 58%, transparent 59%);
    box-shadow:
      0 0 0 0.8rem rgba(98, 216, 255, 0.035),
      0 0 4rem rgba(98, 216, 255, 0.12);
  }

  .wamx-score-orbit span,
  .wamx-score-orbit small {
    color: var(--wamx-muted);
    font-size: 0.65rem;
    font-weight: 850;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .wamx-score-orbit strong {
    color: var(--wamx-blue);
    font-size: clamp(2rem, 5vw, 3.25rem);
    line-height: 1;
  }

  .wamx-recap {
    display: grid;
    margin: 2rem 0 1rem;
    border: 1px solid var(--wamx-line);
    border-radius: 1rem;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    background: rgba(255, 255, 255, 0.02);
    overflow: hidden;
  }

  .wamx-recap > div {
    display: grid;
    gap: 0.3rem;
    padding: 1rem;
    border-right: 1px solid var(--wamx-line);
  }

  .wamx-recap > div:last-child {
    border-right: 0;
  }

  .wamx-recap dt {
    color: var(--wamx-muted);
    font-size: 0.68rem;
    line-height: 1.3;
  }

  .wamx-recap dd {
    margin: 0;
    font-size: clamp(1rem, 2vw, 1.35rem);
    font-weight: 900;
  }

  .wamx-result-specials {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
    margin-bottom: 1.5rem;
  }

  .wamx-result-specials > span {
    padding: 0.45rem 0.7rem;
    border: 1px solid rgba(255, 212, 95, 0.18);
    border-radius: 999px;
    color: #ffe7a4;
    background: rgba(255, 212, 95, 0.06);
    font-size: 0.75rem;
  }

  .wamx-result-specials > span.is-warning {
    color: #ffc4c8;
    border-color: rgba(255, 111, 120, 0.2);
    background: rgba(255, 111, 120, 0.07);
  }

  .wamx-result-note {
    margin: 0.9rem 0 0;
    color: var(--wamx-muted);
    font-size: 0.75rem;
  }

  .wamx-sr-only {
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    border: 0 !important;
    margin: -1px !important;
    position: absolute !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
  }

  @keyframes wamx-ripple-demo {
    0% { opacity: 0; transform: scale(0.35); }
    28% { opacity: 0.9; }
    58%, 100% { opacity: 0; transform: scale(1); }
  }

  @keyframes wamx-target-demo {
    0%, 50% { opacity: 0; transform: translateY(45%); }
    65%, 92% { opacity: 1; transform: translateY(4%); }
    100% { opacity: 0; transform: translateY(45%); }
  }

  @keyframes wamx-count {
    from { opacity: 0; transform: scale(0.72); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes wamx-rise {
    from { opacity: 0; transform: translateY(58%); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes wamx-telegraph {
    0% { opacity: 0.25; transform: scale(0.55); }
    75%, 100% { opacity: 1; transform: scale(1); }
  }

  @media (max-width: 880px) {
    .wamx {
      min-height: auto;
    }

    .wamx-briefing,
    .wamx-gameplay {
      grid-template-columns: 1fr;
    }

    .wamx-briefing-copy {
      min-height: 0;
    }

    .wamx-briefing-legend {
      padding: 1rem;
    }

    .wamx-briefing-legend .wamx-legend {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .wamx-briefing-legend .wamx-legend-item {
      align-items: flex-start;
      flex-direction: column;
    }

    .wamx-gameplay {
      grid-template-columns: minmax(0, 1fr);
    }

    .wamx-coach {
      display: grid;
      grid-template-columns: minmax(10rem, 0.7fr) minmax(0, 1.3fr);
    }

    .wamx-coach .wamx-legend--compact {
      display: none;
    }

    .wamx-pace {
      grid-column: 1 / -1;
    }

    .wamx-recap {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .wamx-recap > div:nth-child(3n) {
      border-right: 0;
    }

    .wamx-recap > div:nth-child(-n + 3) {
      border-bottom: 1px solid var(--wamx-line);
    }
  }

  @media (max-width: 620px) {
    .wamx {
      width: 100%;
      padding: 0.8rem;
      border-radius: 0;
    }

    .wamx-header {
      align-items: flex-start;
    }

    .wamx-brand-mark {
      display: none;
    }

    .wamx-header-actions {
      justify-content: flex-end;
    }

    .wamx-steps {
      margin-block: 0.9rem;
    }

    .wamx-steps li {
      font-size: 0;
    }

    .wamx-steps li > span {
      font-size: 0.62rem;
    }

    .wamx-briefing,
    .wamx-teach,
    .wamx-countdown,
    .wamx-pause,
    .wamx-result {
      border-radius: 1rem;
    }

    .wamx-briefing-copy {
      padding: 1.25rem;
    }

    .wamx-briefing-legend .wamx-legend {
      grid-template-columns: 1fr;
    }

    .wamx-briefing-legend .wamx-legend-item {
      align-items: center;
      flex-direction: row;
    }

    .wamx-teach {
      min-height: 0;
      padding: 1.2rem;
      grid-template-columns: 1fr;
    }

    .wamx-teach-demo {
      width: min(58vw, 13rem);
    }

    .wamx-legend--compact {
      grid-template-columns: 1fr;
    }

    .wamx-countdown,
    .wamx-pause {
      min-height: min(30rem, 70dvh);
    }

    .wamx-playfield,
    .wamx-coach {
      border-radius: 1rem;
    }

    .wamx-playfield {
      padding: 0.55rem;
    }

    .wamx-hud {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .wamx-board {
      width: 100%;
      min-height: min(104vw, 31rem);
      aspect-ratio: auto;
      padding: 0.45rem;
      gap: 0.42rem;
    }

    .wamx-hole {
      border-radius: 0.75rem;
    }

    .wamx-hole-number {
      width: 1.15rem;
      height: 1.15rem;
      top: 0.25rem;
      left: 0.25rem;
      font-size: 0.58rem;
    }

    .wamx-target {
      width: 70%;
      left: 15%;
    }

    .wamx-target-icon {
      font-size: clamp(1.2rem, 8vw, 2.4rem);
    }

    .wamx-coach {
      grid-template-columns: 1fr;
      padding: 0.7rem;
    }

    .wamx-pace {
      grid-column: auto;
    }

    .wamx-result {
      padding: 1.25rem;
    }

    .wamx-result-hero {
      grid-template-columns: 1fr;
      text-align: center;
    }

    .wamx-score-orbit {
      width: 9rem;
      margin-inline: auto;
    }

    .wamx-recap {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .wamx-recap > div,
    .wamx-recap > div:nth-child(3n) {
      border-right: 1px solid var(--wamx-line);
      border-bottom: 1px solid var(--wamx-line);
    }

    .wamx-recap > div:nth-child(2n) {
      border-right: 0;
    }

    .wamx-recap > div:nth-last-child(-n + 2) {
      border-bottom: 0;
    }

    .wamx-primary-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .wamx-primary-actions .wamx-button {
      width: 100%;
    }
  }

  @media (max-height: 720px) and (min-width: 881px) {
    .wamx {
      min-height: 0;
      padding: 1rem;
    }

    .wamx-brand-mark {
      width: 2.3rem;
      height: 2.3rem;
    }

    .wamx h3 {
      font-size: clamp(1.7rem, 3.4vw, 2.75rem);
    }

    .wamx-steps {
      margin-block: 0.55rem 0.7rem;
    }

    .wamx-board {
      width: min(100%, 26rem);
    }

    .wamx-playfield,
    .wamx-coach {
      border-radius: 1rem;
    }

    .wamx-playfield,
    .wamx-coach {
      padding: 0.7rem;
    }

    .wamx-coach {
      gap: 0.5rem;
    }

    .wamx-metric {
      padding: 0.45rem 0.6rem;
    }

    .wamx-timer-track {
      margin-block: 0.45rem 0.6rem;
    }

    .wamx-board-help {
      margin-top: 0.35rem;
    }

    .wamx-briefing-copy {
      padding: 1.4rem 2rem;
    }

    .wamx-briefing-legend {
      padding: 1rem;
    }

    .wamx-callout {
      margin-block: 0.8rem;
      padding-block: 0.7rem;
    }

    .wamx-legend-item {
      padding: 0.62rem;
    }

    .wamx-briefing-copy,
    .wamx-teach,
    .wamx-countdown,
    .wamx-pause,
    .wamx-result {
      min-height: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wamx .wamx-motion-safe,
    .wamx .wamx-motion-safe *,
    .wamx .wamx-button,
    .wamx .wamx-hole,
    .wamx .wamx-setup-progress span,
    .wamx .wamx-timer-track span {
      scroll-behavior: auto !important;
      animation: none !important;
      transition: none !important;
    }

    .wamx .wamx-target--telegraph {
      opacity: 1;
      border-width: 4px;
      background: rgba(98, 216, 255, 0.16);
    }

    .wamx .wamx-demo-ripple {
      opacity: 1;
      transform: scale(0.88);
    }

    .wamx .wamx-demo-target {
      opacity: 1;
      transform: translateY(4%);
    }
  }

  :root[data-reduced-motion="true"] .wamx .wamx-motion-safe,
  :root[data-reduced-motion="true"] .wamx .wamx-motion-safe *,
  :root[data-reduced-motion="true"] .wamx .wamx-button,
  :root[data-reduced-motion="true"] .wamx .wamx-hole,
  :root[data-reduced-motion="true"] .wamx .wamx-setup-progress span,
  :root[data-reduced-motion="true"] .wamx .wamx-timer-track span {
    scroll-behavior: auto !important;
    animation: none !important;
    transition: none !important;
  }

  :root[data-reduced-motion="true"] .wamx .wamx-target--telegraph {
    opacity: 1;
    border-width: 4px;
    background: rgba(98, 216, 255, 0.16);
  }
`;
