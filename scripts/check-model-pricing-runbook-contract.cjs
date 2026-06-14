#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/model-pricing.md",
  "docs/operations.md",
  "docs/provider-setup.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkModelPricingRunbookContract();
  console.log(
    `model pricing runbook contract ok (${result.runbookCases} runbook cases, ${result.docs} docs checked)`
  );
}

function checkModelPricingRunbookContract(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const text = getDocText("docs/model-pricing.md", docTexts, options.modelPricingText);

  checkSections(text, findings);
  checkPriceFile(text, findings);
  checkDryRunAndApply(text, findings);
  checkCatalogCoverage(text, findings);
  checkReviewRequirements(text, findings);
  checkEstimationBehavior(text, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`model pricing runbook contract check found ${findings.length} issue(s).`);
  }

  return {
    runbookCases: 6,
    docs: targetDocs.length,
  };
}

function checkSections(text, findings) {
  checkOrderedHeadings(
    text,
    [
      "## Price File",
      "## Dry Run",
      "## Catalog Coverage",
      "## Apply",
      "## Review Requirements",
      "## Estimation Behavior",
    ],
    findings
  );
}

function checkPriceFile(text, findings) {
  for (const snippet of [
    "Model pricing is intentionally operator-maintained.",
    "Use the model-prices CLI to review and apply price rows to",
    "`reviewbot.ai_model_prices`",
    "config/model-prices.example.json",
    "\"provider\": \"anthropic\"",
    "\"model\": \"claude-opus-4-8\"",
    "\"sourceUrl\": \"https://provider.example/pricing\"",
    "\"sourceCheckedAt\": \"2026-06-12T12:00:00.000Z\"",
    "Do not apply zeroes or placeholder prices.",
    "rejects zero-rate rows by default",
    "sourceCheckedAt` timestamp is older than 30 days",
    "rejects future-dated source checks",
  ]) {
    requireSnippet(text, snippet, "model price-file guidance", findings);
  }
}

function checkDryRunAndApply(text, findings) {
  for (const snippet of [
    "npm run model-prices -- -- --file prices.json",
    "dry run prints the SQL plus Data API parameter values",
    "notes` values are redacted for common secret-shaped values",
    "capped at 1000 characters",
    "npm run model-prices -- -- --file prices.json --apply",
    "npm run model-prices -- -- --file prices.json --apply --max-source-age-days 14",
    "npm run model-prices -- -- --file prices.json --apply --allow-stale-source",
    "record the accepted risk and evidence in the operator runbook",
    "npm run model-prices -- -- --file prices.json --apply --allow-zero-price",
    "provider really documents a free token class or free model",
    "REVIEW_USAGE_DB_RESOURCE_ARN",
    "REVIEW_USAGE_DB_SECRET_ARN",
    "Use `--schema <name>` only when the deployment intentionally stores bot data in a non-default schema.",
  ]) {
    requireSnippet(text, snippet, "model price apply guidance", findings);
  }
}

function checkCatalogCoverage(text, findings) {
  for (const snippet of [
    "## Catalog Coverage",
    "npm run model-prices -- -- --file prices.json --require-catalog-coverage",
    "does not contact AWS or provider APIs",
    "every catalog default provider/model lane",
    "both input and output rates",
    "fresh `sourceCheckedAt`",
    "avoids zero-rate placeholders unless `--allow-zero-price` is explicitly supplied",
    "avoids placeholder source URLs",
    "npm run model-prices -- -- --file prices.json --catalog config/model-catalog.json --require-catalog-coverage",
  ]) {
    requireSnippet(text, snippet, "model price catalog coverage guidance", findings);
  }
}

function checkReviewRequirements(text, findings) {
  for (const snippet of [
    "Every pricing update should record:",
    "input/cached-input/output/reasoning rates that apply",
    "provider source URL",
    "source-checked timestamp",
    "The CLI enforces a source URL, source-checked timestamp, and at least one price field.",
    "rejects zero-rate rows during apply unless the operator passes",
    "`--allow-zero-price`",
    "rejects stale or future-dated source-checked",
    "`--allow-stale-source`",
    "Do not put secrets, private account details, provider diagnostics, or private PR payloads in `notes`",
    "Provider pages and APIs are the source of truth.",
    "leave the row unapplied and keep budget admission on conservative default estimates",
    "GET /api/admin/model-prices/status",
    "not operator notes or full source URLs",
  ]) {
    requireSnippet(text, snippet, "model price review guidance", findings);
  }
}

function checkEstimationBehavior(text, findings) {
  for (const snippet of [
    "provider/model match the review lane",
    "effective_from <= now",
    "effective_to is null or in the future",
    "if cached tokens look like a subset of input tokens",
    "if cached tokens are reported separately from input tokens",
    "if no cached-input rate is configured",
    "Reasoning tokens use `reasoningUsdPerMillion`",
    "If any token class has usage but no applicable rate, the bot does not write an estimated cost for that run.",
  ]) {
    requireSnippet(text, snippet, "model price estimation guidance", findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:model-pricing-runbook",
      "[Model Pricing](docs/model-pricing.md)",
    ],
    "docs/model-pricing.md": [
      "model pricing runbook contract",
      "npm run check:model-pricing-runbook",
    ],
    "docs/operations.md": [
      "npm run check:model-pricing-runbook",
      "model-prices",
    ],
    "docs/provider-setup.md": [
      "npm run check:model-pricing-runbook",
      "Model Pricing",
    ],
    "docs/release-operations-map.md": [
      "npm run check:model-pricing-runbook",
      "model pricing",
    ],
    "docs/release.md": [
      "npm run check:model-pricing-runbook",
      "model pricing",
    ],
    "docs/release-readiness.md": [
      "npm run check:model-pricing-runbook",
      "model price",
    ],
    "docs/roadmap.md": [
      "model pricing runbook contract",
      "source-checked",
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
      findings.push(`docs/model-pricing.md must include '${heading}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/model-pricing.md sections must stay in order.");
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
  checkModelPricingRunbookContract,
  targetDocs,
};
