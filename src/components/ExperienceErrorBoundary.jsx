import { Component, Fragment } from "react";

import { createExperienceErrorRecovery } from "../experienceErrorRecovery.js";
import { createScopedLogger } from "../logger.js";
import "./ExperienceErrorBoundary.css";

const experienceErrorLog = createScopedLogger("experienceErrorBoundary");
const COPY_STATUS = Object.freeze({
  IDLE: "idle",
  COPIED: "copied",
  FAILED: "failed",
  UNAVAILABLE: "unavailable",
  REPORTED: "reported",
});

let boundarySequence = 0;

function nextBoundaryId() {
  boundarySequence += 1;
  return `experience-recovery-${boundarySequence}`;
}

export default class ExperienceErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.boundaryId = props.id || nextBoundaryId();
    this.headingRef = null;
    this.focusFrame = null;
    this.state = {
      copyStatus: COPY_STATUS.IDLE,
      error: null,
      experienceKey: props.experienceKey,
      recoveryKey: 0,
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (!Object.is(props.experienceKey, state.experienceKey)) {
      return {
        copyStatus: COPY_STATUS.IDLE,
        error: null,
        experienceKey: props.experienceKey,
        recoveryKey: state.recoveryKey + 1,
      };
    }
    return null;
  }

  static getDerivedStateFromError(error) {
    return {
      copyStatus: COPY_STATUS.IDLE,
      error,
    };
  }

  componentDidCatch(error) {
    const recovery = this.getRecovery(error);
    experienceErrorLog.error("Experience render stopped safely", {
      category: recovery.category,
      reference: recovery.reference,
    });
    this.focusRecoveryHeading();
  }

  componentWillUnmount() {
    if (
      this.focusFrame !== null &&
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(this.focusFrame);
    }
  }

  getRecovery = (error = this.state.error) =>
    createExperienceErrorRecovery(error, {
      experienceName: this.props.experienceName,
    });

  focusRecoveryHeading = () => {
    const focus = () => {
      this.focusFrame = null;
      try {
        this.headingRef?.focus({ preventScroll: true });
      } catch {
        this.headingRef?.focus?.();
      }
    };
    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      this.focusFrame = window.requestAnimationFrame(focus);
      return;
    }
    focus();
  };

  retry = () => {
    try {
      this.props.onRetry?.();
    } catch (error) {
      this.setState({
        copyStatus: COPY_STATUS.IDLE,
        error,
      });
      return;
    }
    this.setState((state) => ({
      copyStatus: COPY_STATUS.IDLE,
      error: null,
      recoveryKey: state.recoveryKey + 1,
    }));
  };

  returnHome = () => {
    try {
      this.props.onReturnHome?.();
    } catch (error) {
      this.setState({
        copyStatus: COPY_STATUS.IDLE,
        error,
      });
    }
  };

  copyIssueSummary = async () => {
    const recovery = this.getRecovery();
    if (
      typeof navigator === "undefined" ||
      typeof navigator.clipboard?.writeText !== "function"
    ) {
      this.setState({ copyStatus: COPY_STATUS.UNAVAILABLE });
      return;
    }
    try {
      await navigator.clipboard.writeText(recovery.report.text);
      this.setState({ copyStatus: COPY_STATUS.COPIED });
    } catch {
      this.setState({ copyStatus: COPY_STATUS.FAILED });
    }
  };

  reportIssue = async () => {
    const recovery = this.getRecovery();
    try {
      await this.props.onReport?.(recovery.report);
      this.setState({ copyStatus: COPY_STATUS.REPORTED });
    } catch {
      this.setState({ copyStatus: COPY_STATUS.FAILED });
    }
  };

  getStatusMessage() {
    switch (this.state.copyStatus) {
      case COPY_STATUS.COPIED:
        return "Privacy-safe issue summary copied.";
      case COPY_STATUS.REPORTED:
        return "Privacy-safe issue summary shared.";
      case COPY_STATUS.UNAVAILABLE:
        return "Clipboard access is unavailable. You can copy the reference shown below.";
      case COPY_STATUS.FAILED:
        return "The issue summary could not be shared. Retry or use the reference shown below.";
      default:
        return "";
    }
  }

  renderRecovery() {
    const {
      allowCopySummary = true,
      homeHref = "/",
      onReport,
      onReturnHome,
      showIssueSummary = true,
    } = this.props;
    const recovery = this.getRecovery();
    const titleId = `${this.boundaryId}-title`;
    const consequenceId = `${this.boundaryId}-consequence`;
    const statusMessage = this.getStatusMessage();
    const showReportTools =
      showIssueSummary && (allowCopySummary || typeof onReport === "function");

    return (
      <section
        aria-describedby={consequenceId}
        aria-labelledby={titleId}
        aria-live="assertive"
        className="experience-error-boundary"
        role="alertdialog"
      >
        <div className="experience-error-boundary-card">
          <span
            aria-hidden="true"
            className="experience-error-boundary-mark"
          >
            !
          </span>
          <p className="experience-error-boundary-eyebrow">
            Experience recovery
          </p>
          <h2
            id={titleId}
            ref={(element) => {
              this.headingRef = element;
            }}
            tabIndex={-1}
          >
            {recovery.title}
          </h2>
          <p
            className="experience-error-boundary-consequence"
            id={consequenceId}
          >
            {recovery.consequence}
          </p>
          <p className="experience-error-boundary-next-step">
            {recovery.nextStep}
          </p>

          <div
            aria-label="Recovery options"
            className="experience-error-boundary-actions"
            role="group"
          >
            <button onClick={this.retry} type="button">
              Retry {recovery.experienceName}
            </button>
            {typeof onReturnHome === "function" ? (
              <button
                className="experience-error-boundary-secondary"
                onClick={this.returnHome}
                type="button"
              >
                Return Home
              </button>
            ) : (
              <a
                className="experience-error-boundary-secondary"
                href={homeHref}
              >
                Return Home
              </a>
            )}
          </div>

          {showReportTools ? (
            <details className="experience-error-boundary-report">
              <summary>Share a privacy-safe issue summary</summary>
              <p>
                This summary includes only the experience name, a broad error
                category, and a reference. It leaves out the error message,
                stack trace, camera data, settings, and saved content.
              </p>
              <code>{recovery.reference}</code>
              <div className="experience-error-boundary-report-actions">
                {allowCopySummary ? (
                  <button onClick={this.copyIssueSummary} type="button">
                    Copy issue summary
                  </button>
                ) : null}
                {typeof onReport === "function" ? (
                  <button onClick={this.reportIssue} type="button">
                    Report this issue
                  </button>
                ) : null}
              </div>
            </details>
          ) : null}
          <p
            aria-atomic="true"
            aria-live="polite"
            className="experience-error-boundary-status"
            role="status"
          >
            {statusMessage}
          </p>
        </div>
      </section>
    );
  }

  render() {
    if (this.state.error) {
      return this.renderRecovery();
    }
    return (
      <Fragment key={this.state.recoveryKey}>{this.props.children}</Fragment>
    );
  }
}
