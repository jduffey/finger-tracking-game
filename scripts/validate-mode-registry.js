#!/usr/bin/env node

import {
  MODE_REGISTRY,
  PRODUCT_AREAS,
  isPlayReleaseCandidate,
  validateModeRegistry,
} from "../src/modeRegistry.js";

const errors = validateModeRegistry();
if (errors.length > 0) {
  console.error(`Mode registry validation failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  const releaseModes = MODE_REGISTRY.filter(isPlayReleaseCandidate);
  const areaCounts = Object.values(PRODUCT_AREAS)
    .map(
      (area) =>
        `${area}=${MODE_REGISTRY.filter((mode) => mode.area === area).length}`,
    )
    .join(", ");
  console.log(
    `Mode registry valid: ${MODE_REGISTRY.length} modes (${areaCounts}); ${releaseModes.length} Play release modes meet the capability bar.`,
  );
}
