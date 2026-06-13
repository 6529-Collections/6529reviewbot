#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  REVIEW_KINDS,
} = require("../src/github-webhook.cjs");
const {
  REVIEW_KIND_CONFIGS,
} = require("../src/review-bot.cjs");
const {
  REVIEW_KIND_BINS,
} = require("../src/worker-adapter.cjs");

const root = path.resolve(__dirname, "..");
const reviewWorkflowDocPath = "docs/review-workflows.md";

function main() {
  const result = checkReviewBinEntrypoints();
  console.log(`review bin entrypoints ok (${result.reviewKinds} review kinds checked)`);
}

function checkReviewBinEntrypoints(options = {}) {
  const findings = [];
  const packageJson = options.packageJson || JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const reviewKinds = options.reviewKinds || REVIEW_KINDS;
  const reviewKindBins = options.reviewKindBins || REVIEW_KIND_BINS;
  const reviewKindConfigs = options.reviewKindConfigs || REVIEW_KIND_CONFIGS;
  const reviewWorkflowDoc =
    options.reviewWorkflowDoc ||
    fs.readFileSync(path.join(root, reviewWorkflowDocPath), "utf8");

  checkObjectKeys("src/review-bot.cjs REVIEW_KIND_CONFIGS", reviewKindConfigs, reviewKinds, findings);
  checkObjectKeys("src/worker-adapter.cjs REVIEW_KIND_BINS", reviewKindBins, reviewKinds, findings);

  for (const reviewKind of reviewKinds) {
    const bin = reviewKindBins[reviewKind];
    const binPath = path.join(root, "bin", bin || "");
    if (!bin || !fs.existsSync(binPath)) {
      findings.push(`review kind '${reviewKind}' must have an existing bin entrypoint.`);
      continue;
    }
    const binText = options.binTexts?.[bin] || fs.readFileSync(binPath, "utf8");
    const expectedCall = `require("../src/review-bot.cjs").main("${reviewKind}")`;
    if (!binText.includes(expectedCall)) {
      findings.push(`bin/${bin} must call ${expectedCall}.`);
    }

    const scriptName = `review:${reviewKind}`;
    const expectedScript = `node bin/${bin}`;
    if (packageJson.scripts?.[scriptName] !== expectedScript) {
      findings.push(`package.json script '${scriptName}' must be '${expectedScript}'.`);
    }

    if (!reviewWorkflowDoc.includes(expectedScript)) {
      findings.push(`${reviewWorkflowDocPath} must document '${expectedScript}'.`);
    }
  }

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`review bin entrypoint check found ${findings.length} issue(s).`);
  }

  return {
    reviewKinds: reviewKinds.length,
  };
}

function checkObjectKeys(label, object, expected, findings) {
  const actual = Object.keys(object || {});
  if (!arraysEqual(actual, expected)) {
    findings.push(`${label} keys must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`);
  }
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
  arraysEqual,
  checkReviewBinEntrypoints,
};
