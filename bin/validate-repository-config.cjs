#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  redactSensitiveText,
  safeErrorLine,
} = require("../src/diagnostics.cjs");
const {
  parseRepositoryConfigText,
} = require("../src/repository-config.cjs");

const args = process.argv.slice(2).filter((item) => item !== "--");

if (!args.length || args.includes("-h") || args.includes("--help")) {
  printUsage();
  process.exit(args.length ? 0 : 2);
}

let failed = false;

for (const filePath of args) {
  try {
    validateFile(filePath);
  } catch (error) {
    failed = true;
    console.error(`${safePath(filePath)}: invalid: ${safeErrorLine(error)}`);
  }
}

if (failed) {
  process.exitCode = 1;
}

function validateFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const text = fs.readFileSync(absolutePath, "utf8");
  const config = parseRepositoryConfigText(text, filePath);
  const laneSummary = config.lanes.length
    ? config.lanes.map((lane) => `${lane.provider}:${lane.model}`).join(", ")
    : "central default";

  console.log(`${safePath(filePath)}: ok`);
  console.log(`  enabled: ${config.enabled}`);
  console.log(`  initial: ${config.reviewKinds.initial.join(", ") || "none"}`);
  console.log(`  followup: ${config.reviewKinds.followup.join(", ") || "none"}`);
  console.log(`  lanes: ${laneSummary}`);
  console.log(`  maxJobsPerDelivery: ${config.limits.maxJobsPerDelivery || "central default"}`);
}

function safePath(filePath) {
  return redactSensitiveText(filePath).slice(0, 500);
}

function printUsage() {
  console.log("Usage: node bin/validate-repository-config.cjs <config.yml> [more.yml...]");
}
