import { useEffect, useId, useMemo, useRef } from "react";

import {
  EXPERIENCE_PAUSE_REASONS,
} from "../experienceLifecycle.js";
import "../experienceOverlay.css";
import {
  EXPERIENCE_OVERLAY_ACTIONS,
  EXPERIENCE_OVERLAY_KINDS,
  createExperienceOverlayViewModel,
} from "./experienceOverlayModel.js";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container) {
  if (!container?.querySelectorAll) {
    return [];
  }
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (element) =>
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[inert]"),
  );
}

function focusElement(element) {
  if (!element?.focus) {
    return false;
  }
  try {
    element.focus({ preventScroll: true });
  } catch {
    try {
      element.focus();
    } catch {
      return false;
    }
  }
  return (
    typeof document === "undefined" || document.activeElement === element
  );
}

function requestFocus(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }
  if (typeof window.requestAnimationFrame === "function") {
    const frame = window.requestAnimationFrame(callback);
    return () => window.cancelAnimationFrame?.(frame);
  }
  const timeout = window.setTimeout(callback, 0);
  return () => window.clearTimeout(timeout);
}

function CompactHud({ view, onInvokeAction, isActionAvailable }) {
  const { hud, actions } = view;
  return (
    <aside
      aria-label={`${hud.label} status and controls`}
      className="experience-overlay-hud"
    >
      <div className="experience-overlay-hud-identity">
        <strong>{hud.label}</strong>
        {hud.status ? (
          <span aria-live="polite" role="status">
            {hud.status}
          </span>
        ) : null}
      </div>

      {hud.items.length > 0 ? (
        <dl className="experience-overlay-hud-metrics">
          {hud.items.map((item) => (
            <div
              className={`experience-overlay-hud-metric ${item.emphasis}`}
              key={item.id}
            >
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div
        aria-label="Experience controls"
        className="experience-overlay-hud-actions"
        role="group"
      >
        {actions.map((action) => (
          <button
            aria-label={`${action.label} ${hud.label}`}
            className={`experience-overlay-action ${action.emphasis}`}
            data-experience-action={action.id}
            disabled={!isActionAvailable(action)}
            key={action.id}
            onClick={() => onInvokeAction(action)}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

function CountdownOverlay({ view, onInvokeAction, isActionAvailable }) {
  const exitAction = view.actions.find(
    ({ id }) => id === EXPERIENCE_OVERLAY_ACTIONS.EXIT,
  );
  return (
    <section
      aria-label={view.announcement}
      aria-atomic="true"
      className="experience-overlay-countdown"
      role="timer"
    >
      <span className="experience-overlay-countdown-eyebrow">
        {view.eyebrow}
      </span>
      <strong key={view.seconds}>{view.title}</strong>
      <span>{view.message}</span>
      {exitAction ? (
        <button
          className="experience-overlay-action quiet"
          data-experience-action={exitAction.id}
          disabled={!isActionAvailable(exitAction)}
          onClick={() => onInvokeAction(exitAction)}
          type="button"
        >
          {exitAction.label}
        </button>
      ) : null}
    </section>
  );
}

function ResultMetrics({ result }) {
  if (!result?.primaryMetric) {
    return null;
  }
  return (
    <div className="experience-overlay-results-metrics">
      <div className="experience-overlay-primary-metric">
        <span>{result.primaryMetric.label}</span>
        <strong>{result.primaryMetric.formattedValue}</strong>
        {result.primaryMetric.isPersonalBest ? (
          <em>Personal best</em>
        ) : null}
      </div>
      {result.secondaryMetrics.length > 0 ? (
        <dl aria-label="Round details">
          {result.secondaryMetrics.map((metric) => (
            <div key={metric.id}>
              <dt>{metric.label}</dt>
              <dd>
                {metric.formattedValue}
                {metric.isPersonalBest ? (
                  <span className="experience-overlay-personal-best">
                    {" "}
                    · best
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function OverlayDialog({
  descriptionId,
  dialogRef,
  headingId,
  isActionAvailable,
  onDialogKeyDown,
  onInvokeAction,
  primaryActionRef,
  view,
}) {
  return (
    <div className="experience-overlay-backdrop">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={headingId}
        aria-modal="true"
        className={`experience-overlay-dialog ${view.kind}`}
        onKeyDown={onDialogKeyDown}
        ref={dialogRef}
        role={view.isTrackingLost ? "alertdialog" : "dialog"}
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="experience-overlay-dialog-mark"
        >
          {view.isTrackingLost
            ? "!"
            : view.kind === EXPERIENCE_OVERLAY_KINDS.RESULTS
              ? "★"
              : "●"}
        </div>
        <span className="experience-overlay-eyebrow">{view.eyebrow}</span>
        <h2 id={headingId}>{view.title}</h2>
        <p id={descriptionId}>{view.message}</p>

        {view.isTrackingLost ? (
          <div
            aria-label={
              view.isReacquiring
                ? `${Math.round(view.recoveryProgress * 100)}% stable`
                : "Waiting for tracking"
            }
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(view.recoveryProgress * 100)}
            className="experience-overlay-tracking-progress"
            role="progressbar"
          >
            <span
              style={{
                transform: `scaleX(${view.recoveryProgress})`,
              }}
            />
          </div>
        ) : null}

        {view.pauseReasons?.length > 1 ? (
          <ul
            aria-label="Reasons the experience remains paused"
            className="experience-overlay-pause-reasons"
          >
            {view.pauseReasons.map((reason) => (
              <li key={reason.id}>{reason.label}</li>
            ))}
          </ul>
        ) : null}

        {view.help ? (
          <details className="experience-overlay-help">
            <summary>How to play</summary>
            <p>{view.help}</p>
          </details>
        ) : null}

        {view.kind === EXPERIENCE_OVERLAY_KINDS.RESULTS ? (
          <ResultMetrics result={view.result} />
        ) : null}

        <div className="experience-overlay-dialog-actions">
          {view.actions.map((action, index) => (
            <button
              className={`experience-overlay-action ${action.emphasis}`}
              data-experience-action={action.id}
              disabled={!isActionAvailable(action)}
              key={action.id}
              onClick={() => onInvokeAction(action)}
              ref={index === 0 ? primaryActionRef : undefined}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function ExperienceOverlay({
  lifecycle,
  modeLabel,
  instructions,
  hud,
  resultOptions,
  exitLabel,
  trackingRecovery,
  onStart,
  onPause,
  onResume,
  onRestart,
  onExit,
  className = "",
}) {
  const view = useMemo(
    () =>
      createExperienceOverlayViewModel({
        lifecycle,
        modeLabel,
        instructions,
        hud,
        resultOptions,
        exitLabel,
        trackingRecovery,
      }),
    [
      exitLabel,
      hud,
      instructions,
      lifecycle,
      modeLabel,
      resultOptions,
      trackingRecovery,
    ],
  );
  const id = useId().replaceAll(":", "");
  const headingId = `experience-overlay-heading-${id}`;
  const descriptionId = `experience-overlay-description-${id}`;
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);
  const focusOriginRef = useRef(null);
  const focusOriginActionRef = useRef(null);
  const previousModalRef = useRef(false);

  const rememberFocusOrigin = () => {
    if (typeof document === "undefined") {
      return;
    }
    const activeElement = document.activeElement;
    focusOriginRef.current = activeElement;
    focusOriginActionRef.current =
      activeElement?.getAttribute?.("data-experience-action") ?? null;
  };

  const isActionAvailable = (action) => {
    switch (action.id) {
      case EXPERIENCE_OVERLAY_ACTIONS.START:
        return typeof onStart === "function";
      case EXPERIENCE_OVERLAY_ACTIONS.PAUSE:
        return typeof onPause === "function";
      case EXPERIENCE_OVERLAY_ACTIONS.RESUME:
        return typeof onResume === "function";
      case EXPERIENCE_OVERLAY_ACTIONS.RESTART:
        return typeof onRestart === "function";
      case EXPERIENCE_OVERLAY_ACTIONS.EXIT:
        return typeof onExit === "function";
      default:
        return false;
    }
  };

  const invokeAction = (action) => {
    if (!isActionAvailable(action)) {
      return;
    }
    if (action.id === EXPERIENCE_OVERLAY_ACTIONS.PAUSE) {
      rememberFocusOrigin();
      onPause(action.reason ?? EXPERIENCE_PAUSE_REASONS.MANUAL);
      return;
    }
    if (action.id === EXPERIENCE_OVERLAY_ACTIONS.START) {
      onStart();
      return;
    }
    if (action.id === EXPERIENCE_OVERLAY_ACTIONS.RESUME) {
      onResume(action.reason ?? EXPERIENCE_PAUSE_REASONS.MANUAL);
      return;
    }
    if (action.id === EXPERIENCE_OVERLAY_ACTIONS.RESTART) {
      onRestart();
      return;
    }
    onExit();
  };

  useEffect(() => {
    const wasModal = previousModalRef.current;
    previousModalRef.current = view.modal;

    if (view.modal) {
      if (!wasModal && !focusOriginRef.current) {
        rememberFocusOrigin();
      }
      return requestFocus(() => {
        if (!focusElement(primaryActionRef.current)) {
          focusElement(dialogRef.current);
        }
      });
    }

    if (
      !wasModal &&
      !focusOriginRef.current &&
      !focusOriginActionRef.current
    ) {
      return undefined;
    }

    const origin = focusOriginRef.current;
    const originAction = focusOriginActionRef.current;
    return requestFocus(() => {
      if (origin?.isConnected && focusElement(origin)) {
        focusOriginRef.current = null;
        focusOriginActionRef.current = null;
        return;
      }
      if (originAction && typeof document !== "undefined") {
        const restored = focusElement(
          document.querySelector(
            `[data-experience-action="${originAction}"]`,
          ),
        );
        if (restored) {
          focusOriginRef.current = null;
          focusOriginActionRef.current = null;
        }
      }
    });
  }, [view.kind, view.modal]);

  useEffect(
    () => () => {
      if (focusOriginRef.current?.isConnected) {
        focusElement(focusOriginRef.current);
      }
    },
    [],
  );

  const handleDialogKeyDown = (event) => {
    if (event.key === "Escape") {
      const escapeAction =
        view.isTrackingLost
          ? view.actions.find(
              ({ id: actionId }) =>
                actionId === EXPERIENCE_OVERLAY_ACTIONS.EXIT,
            )
          : view.kind === EXPERIENCE_OVERLAY_KINDS.PAUSED
            ? view.actions.find(
                ({ id: actionId }) =>
                  actionId === EXPERIENCE_OVERLAY_ACTIONS.RESUME,
              )
            : view.actions.find(
                ({ id: actionId }) =>
                  actionId === EXPERIENCE_OVERLAY_ACTIONS.EXIT,
              );
      if (escapeAction && isActionAvailable(escapeAction)) {
        event.preventDefault();
        invokeAction(escapeAction);
      }
      return;
    }
    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(dialogRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      focusElement(dialogRef.current);
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      focusElement(last);
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      focusElement(first);
    }
  };

  if (!view.visible) {
    return null;
  }

  return (
    <div
      className={`experience-overlay-root experience-overlay-state-${view.kind} ${
        view.blocking ? "is-blocking" : ""
      } ${className}`.trim()}
      data-experience-phase={lifecycle.phase}
    >
      {view.announcement ? (
        <div
          aria-atomic="true"
          aria-live={view.livePriority}
          className="experience-overlay-visually-hidden"
          role={view.livePriority === "assertive" ? "alert" : "status"}
        >
          {view.announcement}
        </div>
      ) : null}

      {view.kind === EXPERIENCE_OVERLAY_KINDS.HUD ? (
        <CompactHud
          isActionAvailable={isActionAvailable}
          onInvokeAction={invokeAction}
          view={view}
        />
      ) : view.kind === EXPERIENCE_OVERLAY_KINDS.COUNTDOWN ? (
        <CountdownOverlay
          isActionAvailable={isActionAvailable}
          onInvokeAction={invokeAction}
          view={view}
        />
      ) : (
        <OverlayDialog
          descriptionId={descriptionId}
          dialogRef={dialogRef}
          headingId={headingId}
          isActionAvailable={isActionAvailable}
          onDialogKeyDown={handleDialogKeyDown}
          onInvokeAction={invokeAction}
          primaryActionRef={primaryActionRef}
          view={view}
        />
      )}
    </div>
  );
}
