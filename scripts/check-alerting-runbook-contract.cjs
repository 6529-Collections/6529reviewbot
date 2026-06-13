#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/alerting.md",
  "docs/operations.md",
  "docs/worker-capacity.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkAlertingRunbookContract();
  console.log(
    `alerting runbook contract ok (${result.runbookCases} runbook cases, ${result.docs} docs checked)`
  );
}

function checkAlertingRunbookContract(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const text = getDocText("docs/alerting.md", docTexts, options.alertingText);

  checkSections(text, findings);
  checkScopeAndRunner(text, findings);
  checkConfiguration(text, findings);
  checkDeliveryModes(text, findings);
  checkScheduledWorkflow(text, findings);
  checkDogfoodVerification(text, findings);
  checkPayloadPrivacy(text, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`alerting runbook contract check found ${findings.length} issue(s).`);
  }

  return {
    runbookCases: 7,
    docs: targetDocs.length,
  };
}

function checkSections(text, findings) {
  checkOrderedHeadings(
    text,
    [
      "## Runner",
      "## Configuration",
      "## Delivery Modes",
      "## Scheduled Workflow",
      "## Dogfood Verification",
      "## Alert Payload",
    ],
    findings
  );
}

function checkScopeAndRunner(text, findings) {
  for (const snippet of [
    "It does not call model providers and does not depend on someone opening a dashboard.",
    "budget utilization against enabled budget policies",
    "unusual spend spikes by global, repo, requestor, provider, model, and review kind dimensions",
    "failed or errored review jobs from the job ledger",
    "stale active run-control claims",
    "npm run alerts:operator",
    "npm run alerts:spend",
    "npm run alerts:operator -- -- --dry-run --force",
    "`--force` runs even when `REVIEWBOT_ALERTS_ENABLED=false`",
  ]) {
    requireSnippet(text, snippet, "alerting scope/runner guidance", findings);
  }
}

function checkConfiguration(text, findings) {
  for (const snippet of [
    "REVIEWBOT_ALERTS_ENABLED=false",
    "REVIEWBOT_ALERTS_NOTIFY_MODE=none|stdout|webhook|sns|ses",
    "REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED=false",
    "REVIEWBOT_ALERTS_WEBHOOK_URL=",
    "REVIEWBOT_ALERTS_SNS_TOPIC_ARN=",
    "REVIEWBOT_ALERTS_SES_FROM=",
    "REVIEWBOT_ALERTS_SES_TO=",
    "REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT=80",
    "REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT=100",
    "REVIEWBOT_ALERTS_SPIKE_DIMENSIONS=global,repo,requestor,provider,model,review_kind",
    "Spike dimensions intentionally exclude `org` and `pr`",
    "REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=false",
    "REVIEWBOT_ALERTS_STALE_CLAIM_HOURS=2",
    "REVIEWBOT_ALERTS_LOOKBACK_DAYS=35",
    "REVIEWBOT_ALERTS_MAX_EVENTS=5000",
    "REVIEW_USAGE_DB_SCHEMA=reviewbot",
  ]) {
    requireSnippet(text, snippet, "alerting configuration guidance", findings);
  }
}

function checkDeliveryModes(text, findings) {
  for (const snippet of [
    "`none` evaluates alerts without delivering them.",
    "`stdout` writes the alert payload as JSON.",
    "`webhook` posts JSON to `REVIEWBOT_ALERTS_WEBHOOK_URL`.",
    "`sns` publishes the same JSON payload to `REVIEWBOT_ALERTS_SNS_TOPIC_ARN`",
    "`ses` sends the same sanitized JSON payload as a plain-text email through AWS SES v2",
    "Keep sender identity verification, sandbox exit status, and recipient policy in the private operator runbook.",
  ]) {
    requireSnippet(text, snippet, "alerting delivery mode guidance", findings);
  }
}

function checkScheduledWorkflow(text, findings) {
  for (const snippet of [
    ".github/workflows/spend-alerts.yml",
    "scheduled hourly",
    "dormant unless `REVIEWBOT_ALERTS_ENABLED=true`",
    "assumes the configured AWS role through OIDC",
    "reads the isolated usage, job-event, and run-claim tables",
    "Keep `templates/spend-alert-workflow.yml` aligned with the installed workflow",
    "Do not copy this workflow into target repositories",
    "scheduled checks should run from the central bot environment",
  ]) {
    requireSnippet(text, snippet, "alerting scheduled workflow guidance", findings);
  }
}

function checkDogfoodVerification(text, findings) {
  for (const snippet of [
    "dry-run against the isolated dogfood usage ledger with `--force`",
    "ledger reads completed for the default 35-day alert window",
    "enabled central budget policy rows were evaluated",
    "notification delivery stayed in `dry_run` mode",
    "route scheduled operator alerts to an operator-owned SNS topic, SES sender/recipient list, webhook, or equivalent private channel",
    "enable job-health alerts after the job ledger is live",
    "record that delivery evidence in the private operator runbook",
  ]) {
    requireSnippet(text, snippet, "alerting dogfood verification guidance", findings);
  }
}

function checkPayloadPrivacy(text, findings) {
  for (const snippet of [
    "`kind`: `budget_utilization`, `spend_spike`, `job_failure`, or",
    "`severity`: `warning` or `critical`",
    "private repo names, requestors, providers, model names, job ids, and failure reasons",
    "Route it through private notification channels unless the configured deployment explicitly treats this data as public.",
    "Before dry-run output or notification delivery, the notifier redacts common bearer, GitHub, provider-key, alert-webhook, AWS access-key id, and private-key shapes",
    "bounds nested payload size",
    "omits unsafe or secret-shaped custom keys",
  ]) {
    requireSnippet(text, snippet, "alert payload privacy guidance", findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:alerting-runbook",
      "[Alerting and scheduled operator checks](docs/alerting.md)",
    ],
    "docs/alerting.md": [
      "alerting runbook contract",
      "npm run check:alerting-runbook",
    ],
    "docs/operations.md": [
      "npm run check:alerting-runbook",
      "alerts:operator",
    ],
    "docs/worker-capacity.md": [
      "npm run check:alerting-runbook",
      "alerts:operator",
    ],
    "docs/release-operations-map.md": [
      "npm run check:alerting-runbook",
      "scheduled alert runner",
    ],
    "docs/release.md": [
      "npm run check:alerting-runbook",
      "scheduled alert runner",
    ],
    "docs/release-readiness.md": [
      "npm run check:alerting-runbook",
      "Alerting",
    ],
    "docs/roadmap.md": [
      "alerting runbook contract",
      "scheduled operator alerts",
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
      findings.push(`docs/alerting.md must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/alerting.md sections must stay in order.");
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
  checkAlertingRunbookContract,
  targetDocs,
};
