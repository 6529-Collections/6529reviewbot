#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const relativePath = "docs/release-notes-template.md";
const absolutePath = path.join(root, relativePath);
const documentText = fs.readFileSync(absolutePath, "utf8");
const template = extractMarkdownTemplate(documentText);

const requiredDocumentHeadings = ["# Release Notes Template"];
const requiredTemplateHeadings = [
  "# 6529reviewbot v0.x.x",
  "## Who Should Use This",
  "## Highlights",
  "## Tested Configuration",
  "## Safety Requirements",
  "## Known Gaps",
  "## Deferrals And Accepted Risks",
  "## Upgrade Notes",
  "## Rollback",
  "## Validation",
];
const requiredTemplateText = [
  "Status: pre-v1 dogfood/community-review release.",
  "dogfooding `6529bot`",
  "trusted-actor admission",
  "budget mode is `enforce`",
  "run-control mode is `enforce`",
  "non-noop worker traffic has reviewed dispatch credential evidence",
  "container image evidence has reviewed container publish-plan evidence",
  "provider keys and AWS credentials live only in bot-owned infrastructure",
  "target repo configuration is loaded from the base ref",
  "public dashboard repo/org disclosure uses reviewed allowlists",
  "private admin exposure has reviewed auth-check URL and wallet allowlist evidence",
  "broad community-release gates are complete or explicitly deferred",
  "scheduled operator alerts have reviewed alert delivery plan evidence",
  "route to an operator-owned channel",
  "Risk accepted:",
  "Follow-up owner:",
  "Follow-up trigger/date:",
  "Public-safe evidence:",
  "Pin target repositories to an exact tag or commit SHA",
  "Set `REVIEWBOT_WORKER_ADAPTER=noop`",
  "Set `REVIEWBOT_ENABLED=false`",
];
const requiredTestedConfigurationFields = [
  "Worker path:",
  "GitHub Actions dispatch mode:",
  "GitHub Actions dispatch token source:",
  "Worker dispatch credential evidence:",
  "App server runtime:",
  "Container image contract check:",
  "Container image digest, if used:",
  "Container publish plan evidence:",
  "GitHub App permissions/events:",
  "Providers/models:",
  "Default Anthropic model:",
  "Repository config template:",
  "Budget mode and caps:",
  "Run-control mode and caps:",
  "Ledger schema status:",
  "Model pricing status:",
  "Model price source freshness policy:",
  "Alert delivery:",
  "Empty provider output fail-closed evidence:",
  "Worker diagnostic redaction evidence:",
  "6529.io dashboard/admin status:",
  "Public dashboard disclosure allowlists:",
  "Private admin auth-check/wallet allowlist evidence:",
  "Release candidate bundle:",
  "Production deployment plan:",
  "Dashboard deployment plan:",
  "Dogfood promotion packet:",
  "Dogfood go-live packet:",
  "Community release status:",
  "Production cutover status:",
  "Preflight result:",
  "v0 gate checklist:",
  "v0 gate status file/evidence:",
  "v0 gate summary:",
];
const requiredKnownGapFields = [
  "Production GitHub App deployment:",
  "6529.io public dashboard:",
  "6529.io private admin UI:",
  "Dogfood repositories:",
  "Provider pricing/model update process:",
  "Accepted model-price overrides:",
  "Incident response readiness:",
  "Compatibility guarantees:",
];
const requiredValidationFields = [
  "`npm run release:check`:",
  "`npm run check:container-image`:",
  "`npm run v0:gates`:",
  "`npm run preflight -- -- --strict`:",
  "`npm run community:gates",
  "`npm run release:candidate",
  "`npm run production:deployment-plan",
  "`npm run dashboard:deployment-plan",
  "`npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready`",
  "`npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready`",
  "`npm run production:cutover",
  "CI:",
  "Dependency Review:",
  "OpenSSF Scorecard:",
  "Manual security checklist:",
];

assertIncludesAll(documentText, requiredDocumentHeadings);
assertIncludesAll(template, requiredTemplateHeadings);
assertIncludesAll(template, requiredTemplateText);
assertIncludesAll(template, requiredTestedConfigurationFields);
assertIncludesAll(template, requiredKnownGapFields);
assertIncludesAll(template, requiredValidationFields);

console.log("release notes template ok");

function extractMarkdownTemplate(text) {
  const match = text.match(/```markdown\n([\s\S]*?)\n```/);
  if (!match) {
    throw new Error(`${relativePath} must include a fenced markdown release template.`);
  }
  return match[1];
}

function assertIncludesAll(text, requiredItems) {
  const normalizedText = normalizeWhitespace(text);
  const missing = requiredItems.filter(
    (item) => !normalizedText.includes(normalizeWhitespace(item))
  );
  if (missing.length > 0) {
    throw new Error(
      `${relativePath} is missing required release-notes contract item(s): ${missing.join(", ")}`
    );
  }
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}
