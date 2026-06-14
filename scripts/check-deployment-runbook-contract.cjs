#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/deployment.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkDeploymentRunbookContract();
  console.log(
    `deployment runbook contract ok (${result.runbookCases} runbook cases, ${result.docs} docs checked)`
  );
}

function checkDeploymentRunbookContract(options = {}) {
  const findings = [];
  const deploymentText = options.deploymentText || readText("docs/deployment.md");

  checkRunbookSections(deploymentText, findings);
  checkGitHubAppDeploymentPath(deploymentText, findings);
  checkCentralRuntimePath(deploymentText, findings);
  checkWorkerDeploymentPath(deploymentText, findings);
  checkDashboardAndVerificationPath(deploymentText, findings);
  checkRollbackPath(deploymentText, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`deployment runbook contract check found ${findings.length} issue(s).`);
  }

  return {
    runbookCases: 7,
    docs: targetDocs.length,
  };
}

function checkRunbookSections(text, findings) {
  const headings = [
    "## GitHub App Registration",
    "## Central Server Environment",
    "## Central GitHub Actions Worker",
    "## 6529.io Wiring",
    "## Verification Checklist",
    "## Rollback",
  ];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    if (index === -1) {
      findings.push(`docs/deployment.md must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/deployment.md deployment sections must stay in order.");
    }
    lastIndex = index;
  }
  for (const snippet of [
    "[install.md](install.md)",
    "[container-deployment.md](container-deployment.md)",
    "[operator-evidence-template.md](operator-evidence-template.md)",
    "[production-cutover.md](production-cutover.md)",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`docs/deployment.md must point at '${snippet}'.`);
    }
  }
}

function checkGitHubAppDeploymentPath(text, findings) {
  for (const snippet of [
    "Create a GitHub App named `6529bot`.",
    "templates/github-app-manifest.example.json",
    "npm run github-app:manifest -- -- --host <production-bot-origin> --quiet",
    "npm run check:github-app-manifest",
    "npm run github-app:convert -- -- --code <code> --output <private-json-path>",
    "GET /github-app/manifest-complete",
    "GET /github-app/setup",
    "GET /github-app/callback",
    "npm run check:github-app-routes",
    "[github-app-registration.md](github-app-registration.md)",
    "Contents: read",
    "Issues: write",
    "Members: read",
    "Pull requests: read",
    "Issue comment",
    "Pull request",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`GitHub App deployment path must include '${snippet}'.`);
    }
  }
}

function checkCentralRuntimePath(text, findings) {
  for (const snippet of [
    "REVIEWBOT_GITHUB_WEBHOOK_SECRET=",
    "REVIEWBOT_GITHUB_APP_ID=",
    "REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64=",
    "REVIEWBOT_REPOSITORY_CONFIG_SOURCE=github",
    "REVIEWBOT_PUBLIC_REPO_MODE=trusted",
    "REVIEWBOT_DRAFT_PR_MODE=skip",
    "REVIEWBOT_BUDGET_MODE=enforce",
    "REVIEWBOT_RUN_CONTROL_MODE=off",
    "REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=false",
    "REVIEWBOT_WORKER_ADAPTER=noop",
    "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE=api",
    "npm run preflight",
    "npm run check:preflight",
    "npm run check:preflight-contract",
    "[worker-capacity.md](worker-capacity.md)",
    "[container-deployment.md](container-deployment.md)",
    "[AWS IAM Templates](../infra/aws/README.md)",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`central runtime deployment path must include '${snippet}'.`);
    }
  }
}

function checkWorkerDeploymentPath(text, findings) {
  for (const snippet of [
    ".github/workflows/review-job.yml",
    "templates/review-job-workflow.yml",
    "REVIEWBOT_GITHUB_APP_ID",
    "REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "REVIEW_USAGE_AWS_ROLE_ARN",
    "REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED=true",
    "npm run ledger:schema -- -- --apply",
    "npm run budget-policies -- -- --file <reviewed-budget-policy-file.json>",
    "short-lived GitHub App installation token",
    "Target repositories do not receive bot provider keys, AWS credentials, or long-lived GitHub tokens.",
    "REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID",
    "dispatch-only GitHub App",
    "Actions: write",
    "REVIEWBOT_WORKER_GITHUB_TOKEN",
    "Preflight rejects partial worker App credential overrides",
    "Before enabling non-noop worker traffic, record the worker dispatch credential posture",
    "central bot repository `Actions: write` scope confirmed",
    "main-App credential reuse or `REVIEWBOT_WORKER_GITHUB_TOKEN` fallback explicitly accepted",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`central worker deployment path must include '${snippet}'.`);
    }
  }
}

function checkDashboardAndVerificationPath(text, findings) {
  for (const snippet of [
    "npm run check:6529-io-env",
    "GET /api/public/usage/summary?days=30",
    "GET /api/admin/usage/summary?days=30",
    "GET /api/admin/jobs/recent?status=dispatch_failed&limit=50",
    "GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50",
    "GET /api/admin/status?profile=server",
    "The browser must never receive bot admin signing secrets, provider keys, AWS credentials, or GitHub App private keys.",
    "npm run production:cutover -- -- --init-status <operator-cutover-status-file>",
    "npm run production:cutover -- -- --status-file <operator-cutover-status-file> --summary",
    "GET /healthz",
    "Invalid webhook signatures fail.",
    "GitHub App `ping` is acknowledged.",
    "npm run webhook:replay",
    "npm --silent run dogfood:promotion",
    "npm --silent run dogfood:go-live",
    "Worker mints a short-lived installation token without logging it.",
    "Worker dispatch credential posture is reviewed before non-noop traffic",
    "Operator alerts run from the central bot environment",
    "npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`dashboard or verification path must include '${snippet}'.`);
    }
  }
}

function checkRollbackPath(text, findings) {
  for (const snippet of [
    "Set central `REVIEWBOT_WORKER_ADAPTER=noop`.",
    "Set central `REVIEWBOT_PUBLIC_REPO_MODE=off`.",
    "Disable the target repo config with `enabled: false`.",
    "Remove the GitHub App installation from the target repo.",
    "Disable provider keys in the bot secret store.",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`deployment rollback path must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:deployment-runbook"],
    "docs/deployment.md": [
      "npm run check:deployment-runbook",
      "deployment runbook contract",
    ],
    "docs/release-operations-map.md": ["npm run check:deployment-runbook"],
    "docs/release.md": [
      "npm run check:deployment-runbook",
      "deployment runbook contract",
    ],
    "docs/release-readiness.md": [
      "npm run check:deployment-runbook",
      "Production Deployment",
    ],
    "docs/roadmap.md": [
      "deployment runbook contract",
      "central App server",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(docTexts[doc] || readText(doc));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
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
  checkDeploymentRunbookContract,
  targetDocs,
};
