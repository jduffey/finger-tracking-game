import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { createScopedLogger, initializeLogging } from "./logger";
import "./styles.css";

initializeLogging();
const bootLog = createScopedLogger("bootstrap");
bootLog.info("React bootstrap started", {
  strictMode: false,
  rootElementFound: Boolean(document.getElementById("root")),
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />,
);

bootLog.info("React render call completed");
