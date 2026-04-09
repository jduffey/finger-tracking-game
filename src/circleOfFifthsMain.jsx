import React from "react";
import ReactDOM from "react-dom/client";
import CircleOfFifthsPage from "./CircleOfFifthsPage.jsx";
import { createScopedLogger, initializeLogging } from "./logger.js";
import "./styles.css";

initializeLogging();
const bootLog = createScopedLogger("circleOfFifthsBootstrap");
bootLog.info("Circle of fifths page bootstrap started", {
  rootElementFound: Boolean(document.getElementById("root")),
});

ReactDOM.createRoot(document.getElementById("root")).render(<CircleOfFifthsPage />);

bootLog.info("Circle of fifths page render completed");
