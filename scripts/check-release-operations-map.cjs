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
  const docFile = options.docFile || path.join(root, "docs", "release-operations-map.md");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const map = loadReleaseOperationsMap(file);
  const validated = validateReleaseOperationsMap(map, file, {
    checkDocs: true,
    packageScripts: packageJson.scripts || {},
    repoRoot: root,
  });
  checkReleaseOperationsDoc(validated, docFile);
  return summarizeReleaseOperationsMap(validated);
}

function checkReleaseOperationsDoc(map, docFile) {
  const doc = fs.readFileSync(docFile, "utf8");
  const localQualityPhase = map.phases.find((phase) => phase.id === "local-quality");
  if (!localQualityPhase) {
    throw new Error("release operations map must include the local-quality phase.");
  }
  const missing = localQualityPhase.tools
    .map((tool) => `npm run ${tool.script}`)
    .filter((command) => !doc.includes(command));
  if (missing.length) {
    throw new Error(
      `docs/release-operations-map.md is missing local quality command(s): ${missing.join(", ")}`
    );
  }
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
  checkReleaseOperationsDoc,
  checkReleaseOperationsMap,
};
