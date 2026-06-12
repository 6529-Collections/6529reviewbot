#!/usr/bin/env node

"use strict";

const fs = require("fs");
const { safeErrorLine } = require("../src/diagnostics.cjs");
const { runReviewJobLocally } = require("../src/worker-adapter.cjs");
const {
  runControlLedgerSettingsFromEnv,
  updateRunClaimStatus,
} = require("../src/run-control-ledger.cjs");

function main() {
  const job = readJob(process.argv.slice(2));
  const result = runJobWithClaimStatus(job);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.accepted ? 0 : 1);
}

function runJobWithClaimStatus(job, options = {}) {
  const settings =
    options.runControlSettings || runControlLedgerSettingsFromEnv(options.env || process.env);
  const runJob = options.runReviewJobLocally || runReviewJobLocally;
  const updateClaim = options.updateWorkerRunClaim || updateWorkerRunClaim;
  updateClaim(settings, job, "running", {
    worker: "run-review-job",
  });
  try {
    const result = runJob(job, options.workerOptions || {});
    updateClaim(settings, job, result.accepted ? "completed" : "failed", {
      worker: "run-review-job",
      adapter: result.adapter || "",
      exitCode: result.exitCode,
      reason: result.reason || "",
    });
    return result;
  } catch (error) {
    updateClaim(settings, job, "failed", {
      worker: "run-review-job",
      reason: safeError(error),
    });
    throw error;
  }
}

function updateWorkerRunClaim(settings, job, status, metadata) {
  const result = updateRunClaimStatus(settings, job, status, { metadata });
  if (result.error) {
    console.warn(`[review-bot] warning: run-control status update failed: ${safeError(result.error)}`);
  }
  return result;
}

function readJob(args) {
  const fileIndex = args.indexOf("--job-file");
  if (fileIndex >= 0 && args[fileIndex + 1]) {
    return JSON.parse(fs.readFileSync(args[fileIndex + 1], "utf8"));
  }
  if (process.env.REVIEWBOT_JOB_JSON) {
    return JSON.parse(process.env.REVIEWBOT_JOB_JSON);
  }
  const stdin = fs.readFileSync(0, "utf8").trim();
  if (!stdin) {
    throw new Error("Pass --job-file, REVIEWBOT_JOB_JSON, or a job JSON document on stdin.");
  }
  return JSON.parse(stdin);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorLine(error));
    process.exit(1);
  }
}

module.exports = {
  readJob,
  runJobWithClaimStatus,
  updateWorkerRunClaim,
};

function safeError(error) {
  return safeErrorLine(error || "unknown error");
}
