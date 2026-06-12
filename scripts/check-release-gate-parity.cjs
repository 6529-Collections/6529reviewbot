#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { loadReleaseGates } = require("../src/release-gates.cjs");

const root = path.resolve(__dirname, "..");

function main(options = {}) {
  const gatesFile = options.gatesFile || path.join(root, "config/v0-release-gates.json");
  const planFile = options.planFile || path.join(root, "docs/v0-release-plan.md");
  const gates = loadReleaseGates(gatesFile);
  const requiredGateCount = requiredGateCountFromPlan(planFile);
  if (gates.gates.length !== requiredGateCount) {
    throw new Error(
      `v0 release gate count mismatch: config has ${gates.gates.length}, docs/v0-release-plan.md has ${requiredGateCount}.`
    );
  }
  if (!options.quiet) {
    console.log(`release gate parity ok (${gates.gates.length} gates)`);
  }
  return { gates: gates.gates.length, requiredGateCount };
}

function requiredGateCountFromPlan(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const section = between(
    text,
    "## Required Gates Before Tagging",
    "Render the same gates as an operator checklist:"
  );
  const gates = [...section.matchAll(/^\d+\.\s+/gm)];
  if (!gates.length) {
    throw new Error("No numbered required gates found in docs/v0-release-plan.md.");
  }
  return gates.length;
}

function between(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) {
    throw new Error(`Missing release gate section start: ${start}`);
  }
  const afterStart = startIndex + start.length;
  const endIndex = text.indexOf(end, afterStart);
  if (endIndex === -1) {
    throw new Error(`Missing release gate section end: ${end}`);
  }
  return text.slice(afterStart, endIndex);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  requiredGateCountFromPlan,
};
