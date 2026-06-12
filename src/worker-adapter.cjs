"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const {
  diagnosticTail,
  redactSensitiveText,
} = require("./diagnostics.cjs");

const ROOT = path.resolve(__dirname, "..");
const WORKER_MODES = ["noop", "local", "github_actions"];
const GITHUB_DISPATCH_MODES = ["auto", "api", "gh"];
const DEFAULT_LOCAL_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_GITHUB_FETCH_TIMEOUT_MS = 10000;
const DEFAULT_GITHUB_API_URL = "https://api.github.com";
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
    githubDispatchMode: enumValue(
      env.REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE || "auto",
      GITHUB_DISPATCH_MODES,
      "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE"
    ),
    githubToken:
      env.REVIEWBOT_WORKER_GITHUB_TOKEN || env.GH_TOKEN || env.GITHUB_TOKEN || "",
    githubInstallationId:
      env.REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID ||
      env.REVIEWBOT_WORKER_GITHUB_APP_INSTALLATION_ID ||
      "",
    githubApiUrl: trimTrailingSlash(
      env.REVIEWBOT_WORKER_GITHUB_API_URL ||
        env.GITHUB_API_URL ||
        DEFAULT_GITHUB_API_URL
    ),
    githubFetchTimeoutMs: positiveInt(
      env.REVIEWBOT_WORKER_GITHUB_FETCH_TIMEOUT_MS,
      DEFAULT_GITHUB_FETCH_TIMEOUT_MS,
      "REVIEWBOT_WORKER_GITHUB_FETCH_TIMEOUT_MS"
    ),
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
      claimStatus: "failed",
      reason: safeError(result.error),
      ...outputSummary(result, options.includeOutput),
    });
  }

  return workerResult(job, result.status === 0, {
    adapter: "local",
    claimStatus: result.status === 0 ? "completed" : "failed",
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
  if (!job?.installationId) {
    return workerResult(job || {}, false, {
      adapter: "github_actions",
      reason: "Review job installationId is required for github_actions dispatch.",
    });
  }

  if (shouldUseGitHubApiDispatch(policy)) {
    return dispatchReviewJobToGitHubActionsApi(job, { ...options, policy });
  }
  return dispatchReviewJobToGitHubActionsCli(job, { ...options, policy });
}

function dispatchReviewJobToGitHubActionsCli(job, options = {}) {
  const policy = options.policy || workerAdapterPolicyFromEnv(options.env);
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
      dispatchMode: "gh",
      reason: safeError(result.error),
      ...outputSummary(result, options.includeOutput),
    });
  }

  return workerResult(job, result.status === 0, {
    adapter: "github_actions",
    dispatchMode: "gh",
    exitCode: result.status,
    ...outputSummary(result, options.includeOutput),
    workflow: policy.githubWorkflow,
    workflowRepo: policy.githubRepo,
    workflowRef: policy.githubRef,
  });
}

async function dispatchReviewJobToGitHubActionsApi(job, options = {}) {
  const policy = options.policy || workerAdapterPolicyFromEnv(options.env);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return workerResult(job, false, {
      adapter: "github_actions",
      dispatchMode: "api",
      reason: "A fetch implementation is required for GitHub Actions API dispatch.",
    });
  }
  if (!policy.githubToken) {
    return workerResult(job, false, {
      adapter: "github_actions",
      dispatchMode: "api",
      reason: "REVIEWBOT_WORKER_GITHUB_TOKEN, GH_TOKEN, or GITHUB_TOKEN is required for API dispatch.",
    });
  }

  const repoPath = githubRepoApiPath(policy.githubRepo);
  if (!repoPath) {
    return workerResult(job, false, {
      adapter: "github_actions",
      dispatchMode: "api",
      reason: "REVIEWBOT_WORKER_GITHUB_REPO must be in owner/repo form.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), policy.githubFetchTimeoutMs);
  const fields = githubWorkflowFields(job);
  const url =
    `${policy.githubApiUrl}/repos/${repoPath}/actions/workflows/` +
    `${encodeURIComponent(policy.githubWorkflow)}/dispatches`;
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${policy.githubToken}`,
        "content-type": "application/json",
        "user-agent": "6529reviewbot",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: policy.githubRef,
        inputs: fields,
      }),
      signal: controller.signal,
    });
    const bodyText = await safeResponseText(response);
    return workerResult(job, response.status === 204, {
      adapter: "github_actions",
      dispatchMode: "api",
      statusCode: response.status,
      reason:
        response.status === 204
          ? ""
          : `GitHub API dispatch failed: ${response.status} ${diagnosticTail(bodyText, 500)}`.trim(),
      workflow: policy.githubWorkflow,
      workflowRepo: policy.githubRepo,
      workflowRef: policy.githubRef,
    });
  } catch (error) {
    return workerResult(job, false, {
      adapter: "github_actions",
      dispatchMode: "api",
      reason: safeError(error),
      workflow: policy.githubWorkflow,
      workflowRepo: policy.githubRepo,
      workflowRef: policy.githubRef,
    });
  } finally {
    clearTimeout(timeout);
  }
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
    REVIEWBOT_RUN_KEY: job.runKey || "",
    REVIEWBOT_JOB_LANE: job.lane || "",
    REVIEWBOT_DELIVERY_ID: job.deliveryId || "",
    REVIEWBOT_GITHUB_INSTALLATION_ID: job.installationId ? String(job.installationId) : "",
    REVIEWBOT_REQUESTOR: job.requestor || "",
  };
}

function githubWorkflowFields(job) {
  assertReviewJob(job);
  if (!job.installationId) {
    throw new Error("Review job installationId is required for github_actions dispatch.");
  }
  return {
    job_id: job.id,
    run_key: job.runKey || "",
    installation_id: String(job.installationId),
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
  return diagnosticTail(error && error.message ? error.message : String(error), 500);
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
    stdout: diagnosticTail(stdout),
    stderr: diagnosticTail(stderr),
  };
}

function shouldUseGitHubApiDispatch(policy) {
  if (policy.githubDispatchMode === "gh") {
    return false;
  }
  if (policy.githubDispatchMode === "api") {
    return true;
  }
  return Boolean(policy.githubToken);
}

function githubRepoApiPath(repo) {
  const parts = String(repo || "").split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return "";
  }
  return parts.map((part) => encodeURIComponent(part)).join("/");
}

async function safeResponseText(response) {
  try {
    return typeof response.text === "function" ? await response.text() : "";
  } catch {
    return "";
  }
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

module.exports = {
  DEFAULT_LOCAL_TIMEOUT_MS,
  DEFAULT_GITHUB_API_URL,
  DEFAULT_GITHUB_FETCH_TIMEOUT_MS,
  GITHUB_DISPATCH_MODES,
  REVIEW_KIND_BINS,
  WORKER_MODES,
  createReviewJobEnqueuer,
  dispatchReviewJobToGitHubActions,
  dispatchReviewJobToGitHubActionsApi,
  dispatchReviewJobToGitHubActionsCli,
  enqueueReviewJobsWithAdapter,
  githubRepoApiPath,
  githubWorkflowFields,
  headRepoFullNameForJob,
  jobEnv,
  outputSummary,
  redactSensitiveText,
  reviewCommandArgs,
  runReviewJobLocally,
  shouldUseGitHubApiDispatch,
  workerAdapterPolicyFromEnv,
};
