#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/budget-policies.md",
  "docs/budget-admission.md",
  "docs/operations.md",
  "docs/dogfood.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkBudgetPoliciesRunbookContract();
  console.log(
    `budget policies runbook contract ok (${result.runbookCases} runbook cases, ${result.docs} docs checked)`
  );
}

function checkBudgetPoliciesRunbookContract(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const text = getDocText("docs/budget-policies.md", docTexts, options.budgetText);

  checkSections(text, findings);
  checkPolicyFile(text, findings);
  checkScopesAndLedger(text, findings);
  checkDryRunAndApply(text, findings);
  checkAdmissionAndReview(text, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`budget policies runbook contract check found ${findings.length} issue(s).`);
  }

  return {
    runbookCases: 5,
    docs: targetDocs.length,
  };
}

function checkSections(text, findings) {
  checkOrderedHeadings(
    text,
    [
      "## Policy File",
      "## Dry Run",
      "## Apply",
      "## Admission Behavior",
      "## Review Requirements",
    ],
    findings
  );
}

function checkPolicyFile(text, findings) {
  for (const snippet of [
    "Central budget policy rows are operator-maintained caps stored in",
    "`reviewbot.ai_review_budget_policies`",
    "repository config can only add stricter caps for that repository",
    "production server loads enabled DB rows before budget admission",
    "config/budget-policies.example.json",
    "config/budget-policies.dogfood.example.json",
    "Replace `replace-with-maintainer-login`",
    "Dogfood examples intentionally omit `pr` rows",
    "\"scopeType\": \"global\"",
    "\"scopeValue\": \"*\"",
    "\"dailyUsd\": 25",
  ]) {
    requireSnippet(text, snippet, "budget policy-file guidance", findings);
  }
}

function checkScopesAndLedger(text, findings) {
  for (const snippet of [
    "`global`, with `scopeValue` set to `*`",
    "`org`, with an organization or user login",
    "`repo`, with `owner/repo`",
    "`requestor`, with the trusted GitHub login that caused the spend",
    "`pr`, with `owner/repo#123`",
    "`provider`, with `anthropic`, `openai`, or `openrouter`",
    "`model`, with an exact configured model id",
    "`review_kind`, with `general`, `followup`, `wcag`, `i18n`, or `security`",
    "npm run ledger:schema -- -- --apply",
    "normalizes the legacy `requester` spelling to `requestor`",
    "Enabled policies must include at least one of `dailyUsd`, `weeklyUsd`, or `monthlyUsd`.",
    "Use `\"enabled\": false` to intentionally disable an existing row.",
  ]) {
    requireSnippet(text, snippet, "budget scope/ledger guidance", findings);
  }
}

function checkDryRunAndApply(text, findings) {
  for (const snippet of [
    "npm run budget-policies -- -- --file budget-policies.json",
    "npm run budget-policies -- -- --file config/budget-policies.dogfood.example.json",
    "dry run prints the SQL plus Data API parameter values",
    "Rendered parameter comments are redacted for common secret-shaped values across every field",
    "`notes` values are also capped at 1000 characters",
    "capped at 1000 characters",
    "Use `--quiet` when a release or CI check should validate the file without printing SQL.",
    "npm run budget-policies -- -- --file budget-policies.json --apply",
    "upserts rows by `(scope_type, scope_value)`",
    "REVIEW_USAGE_DB_RESOURCE_ARN",
    "REVIEW_USAGE_DB_SECRET_ARN",
    "Use `--schema <name>` only when the deployment intentionally stores bot data in a non-default schema.",
  ]) {
    requireSnippet(text, snippet, "budget dry-run/apply guidance", findings);
  }
}

function checkAdmissionAndReview(text, findings) {
  for (const snippet of [
    "When `REVIEW_USAGE_ENABLED=true`, `bin/server.cjs` reads enabled budget policy rows",
    "merges them into the base admission policy before repository config is applied",
    "webhook handling fails before queueing work",
    "central DB budget rows are a spend-control surface, not just dashboard metadata",
    "Repository config remains restrictive.",
    "it cannot remove or raise central DB caps",
    "Every policy update should record:",
    "why the cap exists",
    "the operator or release issue that approved the change",
    "Do not put secrets, private PR payloads, provider diagnostics, or AWS account details in `notes`",
  ]) {
    requireSnippet(text, snippet, "budget admission/review guidance", findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:budget-policies-runbook", "[Budget Policies](docs/budget-policies.md)"],
    "docs/budget-policies.md": ["budget policies runbook contract", "npm run check:budget-policies-runbook"],
    "docs/budget-admission.md": ["npm run check:budget-policies-runbook", "Budget Policies"],
    "docs/operations.md": ["npm run check:budget-policies-runbook", "budget-policies"],
    "docs/dogfood.md": ["npm run check:budget-policies-runbook", "budget policy"],
    "docs/release-operations-map.md": ["npm run check:budget-policies-runbook", "budget policies"],
    "docs/release.md": ["npm run check:budget-policies-runbook", "budget policies"],
    "docs/release-readiness.md": ["npm run check:budget-policies-runbook", "budget policy"],
    "docs/roadmap.md": ["budget policies runbook contract", "central DB caps"],
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
      findings.push(`docs/budget-policies.md must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/budget-policies.md sections must stay in order.");
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
  checkBudgetPoliciesRunbookContract,
  targetDocs,
};
