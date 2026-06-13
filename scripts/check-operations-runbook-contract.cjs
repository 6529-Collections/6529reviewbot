#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/operations.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkOperationsRunbookContract();
  console.log(
    `operations runbook contract ok (${result.runbookCases} runbook cases, ${result.docs} docs checked)`
  );
}

function checkOperationsRunbookContract(options = {}) {
  const findings = [];
  const operationsText = options.operationsText || readText("docs/operations.md");

  checkRunbookSections(operationsText, findings);
  checkRoutineCommands(operationsText, findings);
  checkReplayAndDogfoodPath(operationsText, findings);
  checkSpendAndBudgetTriage(operationsText, findings);
  checkWorkerAndLedgerTriage(operationsText, findings);
  checkDashboardAndCommentTriage(operationsText, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`operations runbook contract check found ${findings.length} issue(s).`);
  }

  return {
    runbookCases: 7,
    docs: targetDocs.length,
  };
}

function checkRunbookSections(text, findings) {
  const headings = [
    "## Routine Checks",
    "## If Reviews Stop Posting",
    "## If Usage Rows Stop Writing",
    "## If Job Ledger Rows Stop Writing",
    "## If A GitHub Delivery Needs Replay",
    "## If Provider Spend Spikes",
    "## If Workers Fail Or Claims Look Stuck",
    "## If Usage Dashboards Stop Updating",
    "## If A Bot Comment Looks Wrong",
  ];
  let lastIndex = -1;
  for (const heading of headings) {
    const index = text.indexOf(heading);
    if (index === -1) {
      findings.push(`docs/operations.md must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/operations.md operations sections must stay in order.");
    }
    lastIndex = index;
  }
}

function checkRoutineCommands(text, findings) {
  for (const snippet of [
    "npm run check",
    "npm test",
    "npm run operator:workspace -- -- --dir <private-workspace-dir>",
    "npm run check:operator-workspace",
    "npm run preflight",
    "aws rds-data execute-statement",
    "npm run ledger:schema",
    "npm run ledger:schema -- -- --apply",
    "npm run budget-policies -- -- --file config/budget-policies.example.json",
    "npm run budget-policies -- -- --file <reviewed-budget-policy-file.json> --apply",
    "npm run model-prices -- -- --file <reviewed-model-price-file.json>",
    "npm run model-prices -- -- --file <reviewed-model-price-file.json> --apply",
    "npm run alerts:operator -- -- --dry-run --force",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`routine operations command must include '${snippet}'.`);
    }
  }
}

function checkReplayAndDogfoodPath(text, findings) {
  for (const snippet of [
    "npm run dogfood:target",
    "npm run dogfood:target -- -- --mode limited-initial --require-ready",
    "npm run check:self-dogfood-replay",
    "npm run validate:repo-config -- templates/dogfood-repository-config.yml",
    "npm run dogfood:readiness",
    "npm run dogfood:promotion",
    "npm --silent run dogfood:promotion",
    "npm --silent run dogfood:go-live",
    "npm run webhook:replay -- --",
    "--assume-empty-budget",
    "--dispatch",
    "Do not paste provider keys, GitHub App private keys, webhook secrets, or raw",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`replay/dogfood operations path must include '${snippet}'.`);
    }
  }
}

function checkSpendAndBudgetTriage(text, findings) {
  for (const snippet of [
    "npm run alerts:operator -- -- --dry-run --force",
    "reviewbot.ai_review_budget_policies",
    "REVIEW_BOT_INITIAL_KINDS",
    "REVIEW_MAX_OUTPUT_TOKENS",
    "REVIEW_MAX_DIFF_CHARS",
    "REVIEW_MAX_CONTEXT_CHARS",
    "REVIEW_MAX_PRIOR_COMMENTS_CHARS",
    "REVIEWBOT_ENABLED=false",
    "REVIEWBOT_DISABLED_*",
    "REVIEWBOT_ALERTS_NOTIFY_MODE",
    "REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`spend/budget operations path must include '${snippet}'.`);
    }
  }
}

function checkWorkerAndLedgerTriage(text, findings) {
  for (const snippet of [
    "REVIEW_USAGE_ENABLED",
    "AWS OIDC role trust",
    "RDS Data API enabled",
    "REVIEWBOT_JOB_LEDGER_ENABLED",
    "reviewbot.ai_review_job_events",
    "REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED",
    "GET /api/admin/jobs/recent?status=dispatch_failed&limit=50",
    "GET /api/admin/run-claims/recent?active=1&staleMinutes=120&limit=50",
    "[Worker Capacity And Backpressure](worker-capacity.md)",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`worker/ledger operations path must include '${snippet}'.`);
    }
  }
}

function checkDashboardAndCommentTriage(text, findings) {
  for (const snippet of [
    "GET /api/public/usage/summary?days=30",
    "GET /api/admin/usage/events/recent?days=7&limit=50",
    "REVIEWBOT_USAGE_API_PUBLIC_REPOS",
    "REVIEWBOT_USAGE_API_PUBLIC_ORGS",
    "6529.io auth handoff",
    "GET /api/admin/status?profile=server",
    "whether private repo data is intentionally collapsed",
    "whether the finding is grounded in diff/context",
    "hidden metadata marker lane",
    "target PR content attempted prompt injection",
  ]) {
    if (!hasSnippet(text, snippet)) {
      findings.push(`dashboard/comment operations path must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:operations-runbook"],
    "docs/operations.md": [
      "npm run check:operations-runbook",
      "operations runbook contract",
    ],
    "docs/release-operations-map.md": ["npm run check:operations-runbook"],
    "docs/release.md": [
      "npm run check:operations-runbook",
      "operations runbook contract",
    ],
    "docs/release-readiness.md": [
      "npm run check:operations-runbook",
      "Operations Runbook",
    ],
    "docs/roadmap.md": [
      "operations runbook contract",
      "routine checks",
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
  checkOperationsRunbookContract,
  targetDocs,
};
