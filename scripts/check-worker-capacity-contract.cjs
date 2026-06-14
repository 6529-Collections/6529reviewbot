#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/worker-capacity.md",
  "docs/operations.md",
  "docs/deployment.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkWorkerCapacityContract();
  console.log(
    `worker capacity contract ok (${result.capacityCases} capacity cases, ${result.docs} docs checked)`
  );
}

function checkWorkerCapacityContract(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const text = getDocText("docs/worker-capacity.md", docTexts, options.workerCapacityText);

  checkSections(text, findings);
  checkStartingPolicy(text, findings);
  checkScaleUpRules(text, findings);
  checkBackpressure(text, findings);
  checkStuckJobs(text, findings);
  checkProviderLimitsAndAlerts(text, findings);
  checkEvidenceAndReleaseDecision(text, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`worker capacity contract check found ${findings.length} issue(s).`);
  }

  return {
    capacityCases: 7,
    docs: targetDocs.length,
  };
}

function checkSections(text, findings) {
  checkOrderedHeadings(
    text,
    [
      "## Capacity Layers",
      "## Starting Policy",
      "## GitHub Actions Worker Shape",
      "## Scale-Up Rules",
      "## Backpressure",
      "## Stuck Jobs",
      "## Provider Limits",
      "## Alerting",
      "## Evidence To Capture",
      "## Release Decision",
    ],
    findings
  );
}

function checkStartingPolicy(text, findings) {
  for (const snippet of [
    "low throughput, explicit human triggers, and fast rollback",
    "Scale only after comments, usage rows, run-control claims, and alerts are healthy",
    "REVIEWBOT_WORKER_ADAPTER=github_actions",
    "REVIEWBOT_WORKER_GITHUB_REPO=6529-Collections/6529reviewbot",
    "REVIEWBOT_WORKER_GITHUB_WORKFLOW=review-job.yml",
    "REVIEWBOT_WORKER_GITHUB_REF=main",
    "REVIEWBOT_MAX_JOBS_PER_DELIVERY=4",
    "REVIEWBOT_REVIEW_LANES=anthropic:claude-opus-4-8",
    "REVIEWBOT_RUN_CONTROL_MODE=enforce",
    "REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true",
    "REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=2",
    "REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT=1",
    "REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=3",
    "REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT=4",
    "REVIEWBOT_RUN_CONTROL_MODEL_MAX_CONCURRENT=4",
    "REVIEWBOT_WORKER_TIMEOUT_MINUTES=20",
    "Target repository config should start command-only.",
    "Before switching out of `noop`, record the dispatch credential posture",
    "dispatch-only GitHub App installed only on `6529-Collections/6529reviewbot`",
    "record that fallback and accepted permission boundary",
  ]) {
    requireSnippet(text, snippet, "worker starting policy", findings);
  }
}

function checkScaleUpRules(text, findings) {
  for (const snippet of [
    "Change only one capacity dimension at a time.",
    "No unresolved bad-comment incident:",
    "No provider 429/rate-limit incident:",
    "No over-budget denial surprise:",
    "No stuck run-control claims:",
    "Usage rows written for completed reviews:",
    "Job ledger rows written for dispatch and completion:",
    "Alerts dry-run or delivery verified:",
    "Median and p95 worker duration recorded:",
    "Increase trusted repository count.",
    "Increase requestor or repo concurrency by one.",
    "Add one initial review kind.",
    "Add a second provider/model lane.",
    "Raise org or provider concurrency.",
    "Do not add multi-model lanes and initial full-review fanout in the same release.",
  ]) {
    requireSnippet(text, snippet, "worker scale-up policy", findings);
  }
}

function checkBackpressure(text, findings) {
  for (const snippet of [
    "Use the narrowest effective control first:",
    "REVIEWBOT_DISABLED_REPOS=<owner/repo>",
    "REVIEWBOT_DISABLED_PROVIDERS=<provider>",
    "REVIEWBOT_DISABLED_MODELS=<model>",
    "REVIEWBOT_DISABLED_REVIEW_KINDS=<kind>",
    "REVIEWBOT_WORKER_ADAPTER=noop",
    "REVIEWBOT_ENABLED=false",
    "REVIEWBOT_MAX_JOBS_PER_DELIVERY=1",
    "REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT=1",
    "REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT=1",
    "REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT=1",
    "pause that provider or model rather than pausing the entire App",
    "reduce run-control caps so jobs do not pile up",
  ]) {
    requireSnippet(text, snippet, "worker backpressure policy", findings);
  }
}

function checkStuckJobs(text, findings) {
  for (const snippet of [
    "GET /api/admin/jobs/recent?status=dispatch_failed&limit=50",
    "GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50",
    "Confirm the worker workflow is enabled and has available runner capacity.",
    "Confirm provider keys and AWS OIDC variables are present in the central worker environment.",
    "Confirm `REVIEWBOT_WORKER_TIMEOUT_MINUTES` is not too short",
    "let TTL expire or update terminal status from the private operator runbook",
    "Do not delete run-control rows from a public incident thread.",
  ]) {
    requireSnippet(text, snippet, "worker stuck-job triage", findings);
  }
}

function checkProviderLimitsAndAlerts(text, findings) {
  for (const snippet of [
    "record the account or project limit in the private operator runbook",
    "apply central budget rows for the provider and model",
    "set run-control provider/model concurrency caps below the provider limit",
    "verify provider error handling with a dry run or controlled low-volume job",
    "provider limits usually do not know the GitHub requestor, repo, PR, or review kind",
    "Worker capacity is not healthy until alerts are healthy.",
    "npm run alerts:operator -- -- --dry-run --force",
    "REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=true",
    "record delivery evidence in the operator runbook",
    "set alert thresholds below the hard budget caps",
  ]) {
    requireSnippet(text, snippet, "worker provider/alert policy", findings);
  }
}

function checkEvidenceAndReleaseDecision(text, findings) {
  for (const snippet of [
    "Public-safe evidence:",
    "Worker adapter:",
    "Dispatch credential posture:",
    "Provider/model concurrency cap class:",
    "Alert delivery configured: yes/no",
    "Private evidence:",
    "Exact provider limits:",
    "Dispatch-only App installation id or reviewed fallback acceptance:",
    "Exact run keys:",
    "Provider error payloads:",
    "AWS account ids, ARNs, and secret ARNs:",
    "Block a scale-up when:",
    "run control is disabled or unverified",
    "budget policies are missing for the target org/repo/provider/model",
    "dispatch credential posture is unreviewed before non-noop worker traffic",
    "provider keys are present in a target repository",
    "alerts are disabled for live provider traffic",
    "external PRs can trigger automatic spend without a trusted actor",
  ]) {
    requireSnippet(text, snippet, "worker evidence/release policy", findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:worker-capacity",
      "[Worker Capacity](docs/worker-capacity.md)",
    ],
    "docs/worker-capacity.md": [
      "worker capacity contract",
      "npm run check:worker-capacity",
    ],
    "docs/operations.md": [
      "npm run check:worker-capacity",
      "Worker Capacity And Backpressure",
    ],
    "docs/deployment.md": [
      "npm run check:worker-capacity",
      "worker capacity",
    ],
    "docs/release-operations-map.md": [
      "npm run check:worker-capacity",
      "worker capacity and backpressure",
    ],
    "docs/release.md": [
      "npm run check:worker-capacity",
      "worker capacity and backpressure",
    ],
    "docs/release-readiness.md": [
      "npm run check:worker-capacity",
      "Worker Capacity",
      "dispatch credential evidence",
    ],
    "docs/roadmap.md": [
      "worker capacity contract",
      "backpressure controls",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(getDocText(doc, docTexts));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function checkOrderedHeadings(text, headings, findings) {
  let lastIndex = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    if (index === -1) {
      findings.push(`docs/worker-capacity.md must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/worker-capacity.md sections must stay in order.");
    }
    lastIndex = index;
  }
}

function requireSnippet(text, snippet, label, findings) {
  if (!hasSnippet(text, snippet)) {
    findings.push(`${label} must include '${snippet}'.`);
  }
}

function getDocText(relativePath, docTexts, explicitText) {
  if (explicitText !== undefined) {
    return explicitText;
  }
  if (Object.prototype.hasOwnProperty.call(docTexts, relativePath)) {
    return docTexts[relativePath];
  }
  return readText(relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function hasSnippet(text, snippet) {
  return normalizeWhitespace(text).includes(normalizeWhitespace(snippet));
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkWorkerCapacityContract,
  targetDocs,
};
