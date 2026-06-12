"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WORKER_MODES = ["noop", "local", "github_actions"];
const DEFAULT_LOCAL_TIMEOUT_MS = 15 * 60 * 1000;
const REVIEW_KIND_BINS = {
  general: "general-pr-review.cjs",
  followup: "followup-commit-review.cjs",
  wcag: "wcag-aa-analysis.cjs",
  i18n: "i18n-analysis.cjs",
  security: "security-analysis.cjs",
};

function workerAdapterPolicyFromEnv(env = process.env) {
  return {
    mode: enumValue(
      env.REVIEWBOT_WORKER_ADAPTER || "noop",
      WORKER_MODES,
      "REVIEWBOT_WORKER_ADAPTER"
    ),
    localNodeBin: env.REVIEWBOT_WORKER_NODE_BIN || process.execPath,
    localCwd: path.resolve(env.REVIEWBOT_WORKER_CWD || ROOT),
    localTimeoutMs: positiveInt(
      env.REVIEWBOT_WORKER_LOCAL_TIMEOUT_MS,
      DEFAULT_LOCAL_TIMEOUT_MS,
      "REVIEWBOT_WORKER_LOCAL_TIMEOUT_MS"
    ),
    githubRepo: env.REVIEWBOT_WORKER_GITHUB_REPO || env.GITHUB_REPOSITORY || "",
    githubWorkflow: env.REVIEWBOT_WORKER_GITHUB_WORKFLOW || "review-job.yml",
    githubRef: env.REVIEWBOT_WORKER_GITHUB_REF || "main",
    ghBin: env.REVIEWBOT_WORKER_GH_BIN || env.GH_BIN || "gh",
  };
}

function createReviewJobEnqueuer(options = {}) {
  const policy = options.policy || workerAdapterPolicyFromEnv(options.env);
  return async (jobs, controls) =>
    enqueueReviewJobsWithAdapter(jobs, controls, {
      ...options,
      policy,
    });
}

async function enqueueReviewJobsWithAdapter(jobs, controls = {}, options = {}) {
  const policy = options.policy || workerAdapterPolicyFromEnv(options.env);
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return {
      accepted: false,
      adapter: policy.mode,
      jobCount: 0,
      reason: "No jobs supplied.",
    };
  }

  if (policy.mode === "noop") {
    return {
      accepted: false,
      adapter: policy.mode,
      jobCount: jobs.length,
      reason: "No worker adapter configured.",
    };
  }

  const results = [];
  for (const job of jobs) {
    const result =
      policy.mode === "local"
        ? runReviewJobLocally(job, { ...options, policy, controls })
        : dispatchReviewJobToGitHubActions(job, { ...options, policy, controls });
    results.push(await result);
  }

  const failed = results.filter((result) => !result.accepted);
  return {
    accepted: results.length > 0 && failed.length < results.length,
    adapter: policy.mode,
    status: failed.length ? "partial" : "accepted",
    jobCount: jobs.length,
    acceptedJobs: results.filter((result) => result.accepted).length,
    failedJobs: failed.length,
    jobs: results,
  };
}

function runReviewJobLocally(job, options = {}) {
  const policy = options.policy || workerAdapterPolicyFromEnv(options.env);
  const runner = options.spawnSync || spawnSync;
  const env = {
    ...process.env,
    ...(options.env || {}),
    ...jobEnv(job),
  };
  const args = options.localCommandArgs || reviewCommandArgs(job);
  const result = runner(policy.localNodeBin, args, {
    cwd: policy.localCwd,
    env,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: policy.localTimeoutMs,
  });

  if (result.error) {
    return workerResult(job, false, {
      adapter: "local",
      reason: safeError(result.error),
      ...outputSummary(result, options.includeOutput),
    });
  }

  return workerResult(job, result.status === 0, {
    adapter: "local",
    exitCode: result.status,
    ...outputSummary(result, options.includeOutput),
  });
}

function dispatchReviewJobToGitHubActions(job, options = {}) {
  const policy = options.policy || workerAdapterPolicyFromEnv(options.env);
  if (!policy.githubRepo) {
    return workerResult(job, false, {
      adapter: "github_actions",
      reason: "REVIEWBOT_WORKER_GITHUB_REPO or GITHUB_REPOSITORY is required.",
    });
  }

  const runner = options.spawnSync || spawnSync;
  const fields = githubWorkflowFields(job);
  const args = [
    "workflow",
    "run",
    policy.githubWorkflow,
    "--repo",
    policy.githubRepo,
    "--ref",
    policy.githubRef,
  ];
  for (const [key, value] of Object.entries(fields)) {
    args.push("--field", `${key}=${value}`);
  }

  const result = runner(policy.ghBin, args, {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: policy.localTimeoutMs,
  });

  if (result.error) {
    return workerResult(job, false, {
      adapter: "github_actions",
      reason: safeError(result.error),
      ...outputSummary(result, options.includeOutput),
    });
  }

  return workerResult(job, result.status === 0, {
    adapter: "github_actions",
    exitCode: result.status,
    ...outputSummary(result, options.includeOutput),
    workflow: policy.githubWorkflow,
    workflowRepo: policy.githubRepo,
    workflowRef: policy.githubRef,
  });
}

function jobEnv(job) {
  assertReviewJob(job);
  return {
    GH_REPO: job.repository.fullName,
    GITHUB_REPOSITORY: job.repository.fullName,
    PR_NUMBER: String(job.prNumber),
    GITHUB_PR_NUMBER: String(job.prNumber),
    PR_HEAD_SHA: job.headSha || "",
    REVIEW_KIND: job.reviewKind,
    REVIEW_PROVIDER: job.provider,
    REVIEW_MODEL: job.model,
    REVIEWBOT_JOB_ID: job.id,
    REVIEWBOT_JOB_LANE: job.lane || "",
    REVIEWBOT_DELIVERY_ID: job.deliveryId || "",
    REVIEWBOT_GITHUB_INSTALLATION_ID: job.installationId ? String(job.installationId) : "",
    REVIEWBOT_REQUESTOR: job.requestor || "",
  };
}

function githubWorkflowFields(job) {
  assertReviewJob(job);
  return {
    job_id: job.id,
    installation_id: job.installationId ? String(job.installationId) : "",
    target_repo: job.repository.fullName,
    head_repo: headRepoFullNameForJob(job),
    pr_number: String(job.prNumber),
    head_sha: job.headSha || "",
    review_kind: job.reviewKind,
    provider: job.provider,
    model: job.model,
    lane: job.lane || "",
    requestor: job.requestor || "",
  };
}

function headRepoFullNameForJob(job) {
  return (
    job.headRepoFullName ||
    job.headRepository?.fullName ||
    job.headRepository?.nameWithOwner ||
    job.headRepo?.fullName ||
    job.headRepo?.nameWithOwner ||
    job.repository.fullName
  );
}

function reviewCommandArgs(job) {
  assertReviewJob(job);
  return [path.join(ROOT, "bin", REVIEW_KIND_BINS[job.reviewKind])];
}

function assertReviewJob(job) {
  if (!job || typeof job !== "object") {
    throw new Error("Review job is required.");
  }
  if (!job.id) {
    throw new Error("Review job id is required.");
  }
  if (!job.repository?.fullName) {
    throw new Error("Review job repository.fullName is required.");
  }
  if (!job.prNumber) {
    throw new Error("Review job prNumber is required.");
  }
  if (!Object.prototype.hasOwnProperty.call(REVIEW_KIND_BINS, job.reviewKind)) {
    throw new Error(`Unsupported review job kind '${job.reviewKind}'.`);
  }
  if (!job.provider || !job.model) {
    throw new Error("Review job provider and model are required.");
  }
}

function workerResult(job, accepted, extra = {}) {
  return {
    jobId: job.id,
    reviewKind: job.reviewKind,
    provider: job.provider,
    model: job.model,
    lane: job.lane || "",
    accepted,
    ...extra,
  };
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function safeError(error) {
  return error && error.message ? error.message : String(error);
}

function outputSummary(result, includeOutput) {
  const stdout = String(result.stdout || "");
  const stderr = String(result.stderr || "");
  const summary = {
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
  };
  if (!includeOutput) {
    return summary;
  }
  return {
    ...summary,
    stdout: tail(stdout),
    stderr: tail(stderr),
  };
}

function tail(value, maxChars = 4000) {
  const text = String(value || "");
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

module.exports = {
  DEFAULT_LOCAL_TIMEOUT_MS,
  REVIEW_KIND_BINS,
  WORKER_MODES,
  createReviewJobEnqueuer,
  dispatchReviewJobToGitHubActions,
  enqueueReviewJobsWithAdapter,
  githubWorkflowFields,
  headRepoFullNameForJob,
  jobEnv,
  outputSummary,
  reviewCommandArgs,
  runReviewJobLocally,
  workerAdapterPolicyFromEnv,
};
