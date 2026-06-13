#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const workerAdapter = require("../src/worker-adapter.cjs");
const { PROVIDERS } = require("../src/model-catalog.cjs");
const { REVIEW_KIND_CONFIGS } = require("../src/review-bot.cjs");

const root = path.resolve(__dirname, "..");
const workerDocs = ["docs/worker-adapters.md", "docs/deployment.md", "docs/architecture.md"];
const expectedWorkerModes = ["noop", "local", "github_actions"];
const expectedDispatchModes = ["auto", "api", "gh"];
const expectedDispatchFields = [
  "job_id",
  "run_key",
  "installation_id",
  "target_repo",
  "head_repo",
  "pr_number",
  "head_sha",
  "review_kind",
  "provider",
  "model",
  "lane",
  "requestor",
];
const expectedLocalEnvKeys = [
  "GH_REPO",
  "GITHUB_REPOSITORY",
  "PR_NUMBER",
  "GITHUB_PR_NUMBER",
  "PR_HEAD_SHA",
  "REVIEW_KIND",
  "REVIEW_PROVIDER",
  "REVIEW_MODEL",
  "REVIEWBOT_JOB_ID",
  "REVIEWBOT_RUN_KEY",
  "REVIEWBOT_JOB_LANE",
  "REVIEWBOT_DELIVERY_ID",
  "REVIEWBOT_GITHUB_INSTALLATION_ID",
  "REVIEWBOT_REQUESTOR",
];

function main() {
  const result = checkWorkerAdapterContract();
  console.log(
    `worker adapter contract ok (${result.workerModes} worker modes, ${result.dispatchFields} dispatch fields, ${result.docs} docs/templates checked)`
  );
}

function checkWorkerAdapterContract(options = {}) {
  const findings = [];

  checkConstants(findings);
  checkPolicyParsing(findings);
  checkJobContracts(findings);
  checkAdapterBehavior(findings);
  checkWorkflowTemplate(options.workflowText, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`worker adapter contract check found ${findings.length} issue(s).`);
  }

  return {
    workerModes: expectedWorkerModes.length,
    dispatchFields: expectedDispatchFields.length,
    docs: workerDocs.length + 1,
  };
}

function checkConstants(findings) {
  if (!arraysEqual(workerAdapter.WORKER_MODES, expectedWorkerModes)) {
    findings.push(`WORKER_MODES must be ${JSON.stringify(expectedWorkerModes)}, got ${JSON.stringify(workerAdapter.WORKER_MODES)}.`);
  }
  if (!arraysEqual(workerAdapter.GITHUB_DISPATCH_MODES, expectedDispatchModes)) {
    findings.push(
      `GITHUB_DISPATCH_MODES must be ${JSON.stringify(expectedDispatchModes)}, got ${JSON.stringify(workerAdapter.GITHUB_DISPATCH_MODES)}.`
    );
  }
  for (const kind of Object.keys(REVIEW_KIND_CONFIGS)) {
    if (!workerAdapter.REVIEW_KIND_BINS[kind]) {
      findings.push(`REVIEW_KIND_BINS must include ${kind}.`);
    }
  }
}

function checkPolicyParsing(findings) {
  const defaults = workerAdapter.workerAdapterPolicyFromEnv({});
  const expectedDefaults = {
    mode: "noop",
    githubWorkflow: "review-job.yml",
    githubRef: "main",
    githubDispatchMode: "auto",
    githubApiUrl: workerAdapter.DEFAULT_GITHUB_API_URL,
    githubFetchTimeoutMs: workerAdapter.DEFAULT_GITHUB_FETCH_TIMEOUT_MS,
    localTimeoutMs: workerAdapter.DEFAULT_LOCAL_TIMEOUT_MS,
  };
  for (const [key, value] of Object.entries(expectedDefaults)) {
    if (defaults[key] !== value) {
      findings.push(`worker adapter default ${key} must be ${JSON.stringify(value)}, got ${JSON.stringify(defaults[key])}.`);
    }
  }
  for (const mode of expectedWorkerModes) {
    const policy = workerAdapter.workerAdapterPolicyFromEnv({ REVIEWBOT_WORKER_ADAPTER: mode });
    if (policy.mode !== mode) {
      findings.push(`REVIEWBOT_WORKER_ADAPTER=${mode} must parse.`);
    }
  }
  for (const mode of expectedDispatchModes) {
    const policy = workerAdapter.workerAdapterPolicyFromEnv({
      REVIEWBOT_WORKER_ADAPTER: "github_actions",
      REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: mode,
    });
    if (policy.githubDispatchMode !== mode) {
      findings.push(`REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=${mode} must parse.`);
    }
  }
  expectError(
    () => workerAdapter.workerAdapterPolicyFromEnv({ REVIEWBOT_WORKER_ADAPTER: "lambda" }),
    "REVIEWBOT_WORKER_ADAPTER must be one of: noop, local, github_actions.",
    findings
  );
  expectError(
    () => workerAdapter.workerAdapterPolicyFromEnv({ REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "manual" }),
    "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE must be one of: auto, api, gh.",
    findings
  );
  if (!workerAdapter.shouldUseGitHubApiDispatch({ githubDispatchMode: "auto", githubToken: "token" })) {
    findings.push("auto dispatch mode must prefer GitHub API when a token is available.");
  }
  if (workerAdapter.shouldUseGitHubApiDispatch({ githubDispatchMode: "auto", githubToken: "" })) {
    findings.push("auto dispatch mode must fall back to gh when no token is available.");
  }
  if (!workerAdapter.shouldUseGitHubApiDispatch({ githubDispatchMode: "api", githubToken: "" })) {
    findings.push("api dispatch mode must require API dispatch regardless of token presence.");
  }
  if (workerAdapter.shouldUseGitHubApiDispatch({ githubDispatchMode: "gh", githubToken: "token" })) {
    findings.push("gh dispatch mode must not use API dispatch.");
  }
}

function checkJobContracts(findings) {
  const job = sampleReviewJob();
  const env = workerAdapter.jobEnv(job);
  if (!arraysEqual(Object.keys(env), expectedLocalEnvKeys)) {
    findings.push(`jobEnv keys must be ${JSON.stringify(expectedLocalEnvKeys)}, got ${JSON.stringify(Object.keys(env))}.`);
  }
  const fields = workerAdapter.githubWorkflowFields(job);
  if (!arraysEqual(Object.keys(fields), expectedDispatchFields)) {
    findings.push(`github workflow fields must be ${JSON.stringify(expectedDispatchFields)}, got ${JSON.stringify(Object.keys(fields))}.`);
  }
  if (fields.head_repo !== job.headRepoFullName) {
    findings.push(`github workflow head_repo must use job headRepoFullName, got ${fields.head_repo}.`);
  }
  if (fields.installation_id !== String(job.installationId)) {
    findings.push(`github workflow installation_id must be stringified, got ${fields.installation_id}.`);
  }
  expectError(
    () => workerAdapter.githubWorkflowFields({ ...job, installationId: "" }),
    "Review job installationId is required for github_actions dispatch.",
    findings
  );
  if (!workerAdapter.reviewCommandArgs(job)[0].endsWith(path.join("bin", "security-analysis.cjs"))) {
    findings.push("security review jobs must route to bin/security-analysis.cjs.");
  }
}

function checkAdapterBehavior(findings) {
  const job = sampleReviewJob();
  const noopQueue = workerAdapter.enqueueReviewJobsWithAdapter([job], {}, { policy: { mode: "noop" } });
  if (typeof noopQueue.then !== "function") {
    findings.push("enqueueReviewJobsWithAdapter must return a promise.");
  }

  const localResult = workerAdapter.runReviewJobLocally(job, {
    policy: {
      localNodeBin: "node",
      localCwd: root,
      localTimeoutMs: 1000,
    },
    spawnSync: () => ({
      status: 1,
      stdout: "provider output sk-ant-api03-secretvalue1234567890",
      stderr: "dispatch failed Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890",
    }),
    includeOutput: true,
  });
  if (localResult.accepted !== false || localResult.claimStatus !== "failed") {
    findings.push("failed local workers must return accepted=false and claimStatus=failed.");
  }
  if (!localResult.stdout.includes("sk-[redacted]") || !localResult.stderr.includes("Bearer [redacted]")) {
    findings.push("local worker output tails must be redacted when included.");
  }
  const localHiddenOutput = workerAdapter.runReviewJobLocally(job, {
    policy: {
      localNodeBin: "node",
      localCwd: root,
      localTimeoutMs: 1000,
    },
    spawnSync: () => ({ status: 0, stdout: "secret", stderr: "secret" }),
    includeOutput: false,
  });
  if (Object.prototype.hasOwnProperty.call(localHiddenOutput, "stdout")) {
    findings.push("local worker stdout must be omitted unless includeOutput is true.");
  }

  const redacted = workerAdapter.redactSensitiveText(
    "bad Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890 sk-ant-api03-secretvalue1234567890"
  );
  if (!redacted.includes("Bearer [redacted]") || !redacted.includes("sk-[redacted]")) {
    findings.push("worker diagnostic redaction must cover bearer and provider tokens.");
  }
}

function checkWorkflowTemplate(workflowText, findings) {
  const text = workflowText || readText("templates/review-job-workflow.yml");
  const workflow = YAML.parse(text);
  const inputs = workflow?.on?.workflow_dispatch?.inputs || {};
  const inputNames = Object.keys(inputs);
  if (!arraysEqual(inputNames, expectedDispatchFields)) {
    findings.push(`review-job workflow inputs must be ${JSON.stringify(expectedDispatchFields)}, got ${JSON.stringify(inputNames)}.`);
  }
  for (const field of expectedDispatchFields.filter((field) => field !== "requestor")) {
    if (inputs[field]?.required !== true) {
      findings.push(`review-job workflow input ${field} must be required.`);
    }
  }
  if (inputs.requestor?.required !== false) {
    findings.push("review-job workflow input requestor must remain optional.");
  }
  const reviewKinds = Object.keys(REVIEW_KIND_CONFIGS);
  if (!arraysEqual(inputs.review_kind?.options || [], reviewKinds)) {
    findings.push(`review-job workflow review_kind options must be ${JSON.stringify(reviewKinds)}.`);
  }
  if (!arraysEqual(inputs.provider?.options || [], PROVIDERS)) {
    findings.push(`review-job workflow provider options must be ${JSON.stringify(PROVIDERS)}.`);
  }
  const permissions = workflow?.permissions || {};
  const expectedPermissions = {
    contents: "read",
    "id-token": "write",
    issues: "write",
    "pull-requests": "read",
  };
  for (const [permission, value] of Object.entries(expectedPermissions)) {
    if (permissions[permission] !== value) {
      findings.push(`review-job workflow permission ${permission} must be ${value}.`);
    }
  }
  const normalized = normalizeWhitespace(text);
  const requiredSnippets = [
    "persist-credentials: false",
    "group: reviewbot-worker-${{ inputs.run_key }}",
    "node bin/github-app-installation-token.cjs",
    "npm run worker:job -- -- --job-file job.json",
    "REVIEW_WORKSPACE: ${{ github.workspace }}/target",
  ];
  for (const snippet of requiredSnippets) {
    if (!normalized.includes(normalizeWhitespace(snippet))) {
      findings.push(`templates/review-job-workflow.yml must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const workerDoc = docTexts["docs/worker-adapters.md"] || readText("docs/worker-adapters.md");
  const normalizedWorkerDoc = normalizeWhitespace(workerDoc);
  const requiredWorkerSnippets = [
    "REVIEWBOT_WORKER_ADAPTER=noop|local|github_actions",
    "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=auto|api|gh",
    "A worker adapter starts only after a job has passed those gates",
    "The dispatch fields are:",
    "Provider keys, GitHub App credentials, and AWS credentials remain owned by the bot backend or worker environment",
    "Target repositories do not receive them",
    "Worker stdout and stderr are not included in adapter results by default",
    "diagnostic tails and GitHub API dispatch error bodies are redacted",
  ];
  for (const snippet of requiredWorkerSnippets) {
    if (!normalizedWorkerDoc.includes(normalizeWhitespace(snippet))) {
      findings.push(`docs/worker-adapters.md must include '${snippet}'.`);
    }
  }
  for (const field of expectedDispatchFields) {
    if (!workerDoc.includes(field)) {
      findings.push(`docs/worker-adapters.md must document dispatch field ${field}.`);
    }
  }

  const deploymentDoc = normalizeWhitespace(docTexts["docs/deployment.md"] || readText("docs/deployment.md"));
  if (!deploymentDoc.includes("Start with `noop` worker mode for the first webhook pass")) {
    findings.push("docs/deployment.md must keep the noop-first deployment guidance.");
  }
  if (!deploymentDoc.includes("dispatch credentials scoped to this repository and separate from target repository access")) {
    findings.push("docs/deployment.md must document dispatch credential separation.");
  }

  const architectureDoc = normalizeWhitespace(docTexts["docs/architecture.md"] || readText("docs/architecture.md"));
  if (!architectureDoc.includes("Worker adapters bridge admitted jobs to execution")) {
    findings.push("docs/architecture.md must describe worker adapters.");
  }
}

function sampleReviewJob() {
  return {
    id: "job_6529",
    runKey: "repo:pr:security:anthropic",
    repository: { fullName: "6529-Collections/target-repo" },
    headRepoFullName: "6529-Collections/fork-repo",
    prNumber: 42,
    headSha: "abcdef1234567890abcdef1234567890abcdef12",
    reviewKind: "security",
    provider: "anthropic",
    model: "claude-opus-4-8",
    lane: "anthropic:claude-opus-4-8",
    deliveryId: "delivery-123",
    installationId: 12345,
    requestor: "maintainer",
  };
}

function expectError(fn, expectedMessage, findings) {
  try {
    fn();
    findings.push(`expected error '${expectedMessage}'.`);
  } catch (error) {
    if (error.message !== expectedMessage) {
      findings.push(`expected error '${expectedMessage}', got '${error.message}'.`);
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
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
  checkWorkerAdapterContract,
  expectedDispatchFields,
  expectedWorkerModes,
};
