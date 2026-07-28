import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const componentSource = readFileSync(
  new URL("../src/components/ExperienceErrorBoundary.jsx", import.meta.url),
  "utf8",
);
const styleSource = readFileSync(
  new URL("../src/components/ExperienceErrorBoundary.css", import.meta.url),
  "utf8",
);

test("mode boundary catches render failures and resets when the experience changes", () => {
  assert.match(componentSource, /extends Component/);
  assert.match(componentSource, /getDerivedStateFromError/);
  assert.match(componentSource, /componentDidCatch/);
  assert.match(componentSource, /Object\.is\(props\.experienceKey, state\.experienceKey\)/);
  assert.match(componentSource, /error:\s*null/);
  assert.match(componentSource, /recoveryKey:\s*state\.recoveryKey \+ 1/);
});

test("recovery surface names consequences and exposes accessible escape routes", () => {
  assert.match(componentSource, /role="alertdialog"/);
  assert.match(componentSource, /aria-live="assertive"/);
  assert.match(componentSource, /aria-labelledby=\{titleId\}/);
  assert.match(componentSource, /aria-describedby=\{consequenceId\}/);
  assert.match(componentSource, /Retry \{recovery\.experienceName\}/);
  assert.match(componentSource, />\s*Return Home\s*</);
  assert.match(componentSource, /role="group"/);
  assert.match(componentSource, /role="status"/);
  assert.match(componentSource, /focus\(\{ preventScroll: true \}\)/);
});

test("reporting receives only a redacted summary rather than the caught error", () => {
  assert.match(componentSource, /navigator\.clipboard\.writeText\(recovery\.report\.text\)/);
  assert.match(componentSource, /onReport\?\.\(recovery\.report\)/);
  assert.doesNotMatch(componentSource, /onReport\?\.\([^)]*state\.error/);
  assert.doesNotMatch(componentSource, /state\.error\?\.stack/);
  assert.doesNotMatch(componentSource, /state\.error\?\.message/);
  assert.match(componentSource, /leaves out the error message/);
});

test("scoped recovery styles preserve touch, viewport, and contrast affordances", () => {
  assert.match(styleSource, /\.experience-error-boundary/);
  assert.match(styleSource, /min-block-size:\s*46px/);
  assert.match(styleSource, /env\(safe-area-inset-top\)/);
  assert.match(styleSource, /@media \(max-width: 560px\)/);
  assert.match(
    styleSource,
    /@media \(max-height: 560px\) and \(orientation: landscape\)/,
  );
  assert.match(styleSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styleSource, /@media \(forced-colors: active\)/);
  assert.match(styleSource, /:focus-visible/);
});
