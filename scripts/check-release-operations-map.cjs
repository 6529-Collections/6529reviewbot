#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  DEFAULT_RELEASE_OPERATIONS_MAP_PATH,
  loadReleaseOperationsMap,
  summarizeReleaseOperationsMap,
  validateReleaseOperationsMap,
} = require("../src/release-operations-map.cjs");

const root = path.resolve(__dirname, "..");

function checkReleaseOperationsMap(options = {}) {
  const file = options.file || DEFAULT_RELEASE_OPERATIONS_MAP_PATH;
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const map = loadReleaseOperationsMap(file);
  const validated = validateReleaseOperationsMap(map, file, {
    checkDocs: true,
    packageScripts: packageJson.scripts || {},
    repoRoot: root,
  });
  return summarizeReleaseOperationsMap(validated);
}

if (require.main === module) {
  try {
    const summary = checkReleaseOperationsMap();
    console.log(
      `release operations map ok (${summary.phaseCount} phases, ${summary.toolCount} tools)`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkReleaseOperationsMap,
};
