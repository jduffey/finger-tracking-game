import { Component } from "react";

import { getRecoveryMessage } from "../errorRecovery.js";
import { createScopedLogger } from "../logger.js";
import "../errorBoundary.css";

const errorLog = createScopedLogger("errorBoundary");

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      recoveryKey: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    errorLog.error("Experience render failed", {
      errorName: error?.name,
      errorMessage: error?.message,
      componentStack: info?.componentStack,
    });
  }

  retry = () => {
    this.setState((current) => ({
      error: null,
      recoveryKey: current.recoveryKey + 1,
    }));
  };

  render() {
    if (!this.state.error) {
      return (
        <div className="error-boundary-content" key={this.state.recoveryKey}>
          {this.props.children}
        </div>
      );
    }

    return (
      <main className="app-recovery" aria-labelledby="app-recovery-title">
        <span className="app-recovery-mark" aria-hidden="true">
          M
        </span>
        <p className="app-recovery-eyebrow">Motion Arcade recovery</p>
        <h1 id="app-recovery-title">Let’s get you back in.</h1>
        <p>{getRecoveryMessage(this.state.error)}</p>
        <div className="app-recovery-actions">
          <button onClick={this.retry} type="button">
            Try this experience again
          </button>
          <a href="/">Return Home</a>
        </div>
        <details>
          <summary>Technical details</summary>
          <code>{this.state.error?.message || "Unknown application error"}</code>
        </details>
      </main>
    );
  }
}
