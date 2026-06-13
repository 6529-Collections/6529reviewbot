#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  DEFAULT_SPIKE_DIMENSIONS,
  evaluateSpendAlerts,
  spendAlertPolicyFromEnv,
} = require("../src/spend-alerts.cjs");

const root = path.resolve(__dirname, "..");
const expectedSpikeDimensions = [
  "global",
  "repo",
  "requestor",
  "provider",
  "model",
  "review_kind",
];
const alertDimensionDocs = [
  "README.md",
  ".env.example",
  "docs/alerting.md",
  "docs/configuration.md",
];

function main() {
  const result = checkAlertDimensions();
  console.log(
    `alert dimensions ok (${result.dimensions} spike dimensions, ${result.docs} docs/env files checked)`
  );
}

function checkAlertDimensions(options = {}) {
  const findings = [];
  const dimensions = options.dimensions || DEFAULT_SPIKE_DIMENSIONS;

  checkDefaultDimensions(dimensions, findings);
  checkPolicyParsing(dimensions, findings);
  checkGeneratedSpikeAlerts(dimensions, findings);
  checkDocs(dimensions, options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`alert dimension check found ${findings.length} issue(s).`);
  }

  return {
    dimensions: dimensions.length,
    docs: alertDimensionDocs.length,
  };
}

function checkDefaultDimensions(dimensions, findings) {
  if (!arraysEqual(dimensions, expectedSpikeDimensions)) {
    findings.push(
      `src/spend-alerts.cjs DEFAULT_SPIKE_DIMENSIONS must be ${JSON.stringify(
        expectedSpikeDimensions
      )}, got ${JSON.stringify(dimensions)}.`
    );
  }
}

function checkPolicyParsing(dimensions, findings) {
  const policy = spendAlertPolicyFromEnv({
    REVIEWBOT_ALERTS_SPIKE_DIMENSIONS: dimensions.join(","),
  });
  if (!arraysEqual(policy.spikeDimensions, dimensions)) {
    findings.push(
      `spendAlertPolicyFromEnv spikeDimensions must be ${JSON.stringify(
        dimensions
      )}, got ${JSON.stringify(policy.spikeDimensions)}.`
    );
  }
  try {
    spendAlertPolicyFromEnv({ REVIEWBOT_ALERTS_SPIKE_DIMENSIONS: "global,pr" });
    findings.push("spendAlertPolicyFromEnv must reject unsupported spike dimension 'pr'.");
  } catch (error) {
    if (!/unsupported values: pr/.test(error.message)) {
      findings.push(`unsupported spike dimension error changed: ${error.message}`);
    }
  }
}

function checkGeneratedSpikeAlerts(dimensions, findings) {
  const now = "2026-06-13T10:00:00.000Z";
  const policy = spendAlertPolicyFromEnv({
    REVIEWBOT_ALERTS_SPIKE_DIMENSIONS: dimensions.join(","),
    REVIEWBOT_ALERTS_SPIKE_MIN_USD: "1",
    REVIEWBOT_ALERTS_SPIKE_ALERT_ON_NEW_SPEND: "true",
  });
  const alerts = evaluateSpendAlerts({
    now,
    policy,
    budgetPolicies: [],
    events: [
      {
        createdAt: "2026-06-13T09:30:00.000Z",
        repoFullName: "6529-Collections/6529reviewbot",
        prNumber: 123,
        requestor: "maintainer",
        reviewKind: "security",
        provider: "anthropic",
        model: "claude-opus-4-8",
        costUsd: 10,
      },
    ],
  }).filter((alert) => alert.kind === "spend_spike");
  const alertDimensions = sortByExpected(
    [...new Set(alerts.map((alert) => alert.scopeType))],
    dimensions
  );
  if (!arraysEqual(alertDimensions, dimensions)) {
    findings.push(
      `spend spike alerts must cover ${JSON.stringify(
        dimensions
      )}, got ${JSON.stringify(alertDimensions)}.`
    );
  }
}

function checkDocs(dimensions, docTexts, findings) {
  const envLine = `REVIEWBOT_ALERTS_SPIKE_DIMENSIONS=${dimensions.join(",")}`;
  for (const docPath of alertDimensionDocs) {
    const text = docTexts[docPath] || readText(docPath);
    if (!text.includes(envLine)) {
      findings.push(`${docPath} must include ${envLine}.`);
    }
  }
  const alertingDoc = normalizeWhitespace(docTexts["docs/alerting.md"] || readText("docs/alerting.md"));
  if (!alertingDoc.includes("Spike dimensions intentionally exclude `org` and `pr`")) {
    findings.push("docs/alerting.md must explain why org and pr are not default spike dimensions.");
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function sortByExpected(values, expected) {
  return values.sort((left, right) => expected.indexOf(left) - expected.indexOf(right));
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
  checkAlertDimensions,
  expectedSpikeDimensions,
};
