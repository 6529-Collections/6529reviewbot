#!/usr/bin/env node

"use strict";

const fs = require("fs");
const { safeErrorLine } = require("../src/diagnostics.cjs");
const { runReviewJobLocally } = require("../src/worker-adapter.cjs");
const {
  beginRunClaimWork,
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
  const env = options.env || process.env;
  const settings =
    options.runControlSettings || runControlLedgerSettingsFromEnv(env);
  const runJob = options.runReviewJobLocally || runReviewJobLocally;
  const updateClaim = options.updateWorkerRunClaim || updateWorkerRunClaim;
  const beginClaim = options.beginWorkerRunClaim || beginWorkerRunClaim;
  const workerOptions = options.workerOptions || workerOptionsFromEnv(env);
  const begin = beginClaim(settings, job, {
    worker: "run-review-job",
  });
  if (begin.duplicate) {
    return duplicateDispatchResult(job, begin);
  }
  if (begin.skipped || begin.error) {
    updateClaim(settings, job, "running", {
      worker: "run-review-job",
    });
  }
  try {
    const result = runJob(job, workerOptions);
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

function workerOptionsFromEnv(env = process.env) {
  return {
    includeOutput: parseBool(env.REVIEWBOT_WORKER_INCLUDE_OUTPUT || "false"),
  };
}

function updateWorkerRunClaim(settings, job, status, metadata) {
  const result = updateRunClaimStatus(settings, job, status, { metadata });
  if (result.error) {
    console.warn(`[review-bot] warning: run-control status update failed: ${safeError(result.error)}`);
  }
  return result;
}

function beginWorkerRunClaim(settings, job, metadata) {
  const result = beginRunClaimWork(settings, job, { metadata });
  if (result.error) {
    console.warn(`[review-bot] warning: run-control begin update failed: ${safeError(result.error)}`);
  }
  return result;
}

function duplicateDispatchResult(job, begin = {}) {
  return {
    jobId: job.id,
    reviewKind: job.reviewKind,
    provider: job.provider,
    model: job.model,
    lane: job.lane || "",
    accepted: true,
    duplicateDispatchSkipped: true,
    claimStatus: begin.priorStatus || "completed",
    reason:
      "Run claim for this run key is already completed; skipping duplicate worker dispatch.",
  };
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
  beginWorkerRunClaim,
  duplicateDispatchResult,
  readJob,
  runJobWithClaimStatus,
  updateWorkerRunClaim,
  workerOptionsFromEnv,
};

function safeError(error) {
  return safeErrorLine(error || "unknown error");
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
