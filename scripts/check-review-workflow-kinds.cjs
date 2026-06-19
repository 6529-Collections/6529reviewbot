#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const {
  INITIAL_REVIEW_KINDS,
  REVIEW_KINDS,
} = require("../src/github-webhook.cjs");
const {
  REVIEW_KIND_BINS,
  REVIEW_KIND_WORKFLOWS,
} = require("../src/worker-adapter.cjs");

const root = path.resolve(__dirname, "..");
const dispatchWorkflowPaths = [
  ".github/workflows/review-job.yml",
  "templates/review-job-workflow.yml",
];
const reusableWorkflowPath = ".github/workflows/review.yml";
const SYNCHRONIZE_REVIEW_KINDS = ["followup"];
const SPECIAL_WORKFLOW_REVIEW_KINDS = ["responsiveness"];

function main() {
  const result = checkReviewWorkflowKinds();
  console.log(
    `review workflow kinds ok (${result.dispatchWorkflows} dispatch workflows, ${result.reviewKinds} review kinds checked)`
  );
}

function checkReviewWorkflowKinds(options = {}) {
  const findings = [];
  const reviewKinds = options.reviewKinds || REVIEW_KINDS;
  const providerReviewKinds =
    options.providerReviewKinds ||
    reviewKinds.filter((kind) => !SPECIAL_WORKFLOW_REVIEW_KINDS.includes(kind));
  const initialReviewKinds = options.initialReviewKinds || INITIAL_REVIEW_KINDS;
  const reviewKindBins = options.reviewKindBins || REVIEW_KIND_BINS;
  const dispatchWorkflows = options.dispatchWorkflows || dispatchWorkflowPaths;
  const reusableText =
    options.reusableWorkflowText ||
    fs.readFileSync(path.join(root, reusableWorkflowPath), "utf8");

  checkReviewKindBins(reviewKinds, reviewKindBins, findings);

  for (const workflowPath of dispatchWorkflows) {
    const workflowText =
      options.dispatchWorkflowTexts?.[workflowPath] ||
      fs.readFileSync(path.join(root, workflowPath), "utf8");
    checkDispatchWorkflow(workflowPath, workflowText, providerReviewKinds, findings);
  }
  checkSpecialWorkflow(
    ".github/workflows/responsiveness-review.yml",
    options.specialWorkflowText ||
      fs.readFileSync(path.join(root, ".github/workflows/responsiveness-review.yml"), "utf8"),
    findings
  );

  checkReusableWorkflowFallback(
    reusableText,
    "REVIEW_BOT_INITIAL_KINDS",
    initialReviewKinds,
    findings
  );
  checkReusableWorkflowFallback(
    reusableText,
    "REVIEW_BOT_SYNCHRONIZE_KINDS",
    SYNCHRONIZE_REVIEW_KINDS,
    findings
  );
  checkReusableWorkflowCaseStatement(reusableText, providerReviewKinds, reviewKindBins, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`review workflow kind check found ${findings.length} issue(s).`);
  }

  return {
    dispatchWorkflows: dispatchWorkflows.length,
    reviewKinds: reviewKinds.length,
  };
}

function checkSpecialWorkflow(workflowPath, workflowText, findings) {
  let workflow;
  try {
    workflow = YAML.parse(workflowText);
  } catch (error) {
    findings.push(`${workflowPath} must be valid YAML: ${error.message}`);
    return;
  }
  const reviewKindInput =
    workflow?.on?.workflow_dispatch?.inputs?.review_kind ||
    workflow?.true?.workflow_dispatch?.inputs?.review_kind;
  if (!reviewKindInput) {
    findings.push(`${workflowPath} must define workflow_dispatch input review_kind.`);
    return;
  }
  if (!arraysEqual(reviewKindInput.options || [], ["responsiveness"])) {
    findings.push(`${workflowPath} review_kind options must be ["responsiveness"].`);
  }
  if (!workflowText.includes("node bot/bin/responsiveness-review.cjs")) {
    findings.push(`${workflowPath} must post through bin/responsiveness-review.cjs.`);
  }
  checkResponsivenessBenchmarkDependencyInstall(workflowPath, workflowText, findings);
  checkResponsivenessArtifactUrlHandoff(workflowPath, workflowText, findings);
}

function checkResponsivenessBenchmarkDependencyInstall(workflowPath, workflowText, findings) {
  const normalized = normalizeWhitespace(workflowText);
  const requiredSnippets = [
    "cache-dependency-path: bot/package-lock.json",
    "working-directory: bot run: npm ci",
    "node bot/bin/github-app-installation-token.cjs",
  ];
  for (const snippet of requiredSnippets) {
    if (!normalized.includes(normalizeWhitespace(snippet))) {
      findings.push(`${workflowPath} must include '${snippet}'.`);
    }
  }
  const installIndex = normalized.indexOf(normalizeWhitespace("working-directory: bot run: npm ci"));
  const tokenIndex = normalized.indexOf(normalizeWhitespace("node bot/bin/github-app-installation-token.cjs"));
  if (installIndex < 0 || tokenIndex < 0 || installIndex > tokenIndex) {
    findings.push(`${workflowPath} benchmark job must install bot dependencies before minting a GitHub App token.`);
  }
}

function checkResponsivenessArtifactUrlHandoff(workflowPath, workflowText, findings) {
  const normalized = normalizeWhitespace(workflowText);
  const requiredSnippets = [
    "outputs: artifact_url: ${{ steps.upload-responsiveness-artifacts.outputs.artifact-url }}",
    "id: upload-responsiveness-artifacts",
    "REVIEWBOT_RESPONSIVENESS_ARTIFACT_URL: ${{ needs.benchmark.outputs.artifact_url }}",
  ];
  for (const snippet of requiredSnippets) {
    if (!normalized.includes(normalizeWhitespace(snippet))) {
      findings.push(`${workflowPath} must include '${snippet}'.`);
    }
  }
}

function checkReviewKindBins(reviewKinds, reviewKindBins, findings) {
  const binKinds = Object.keys(reviewKindBins);
  if (!arraysEqual(binKinds, reviewKinds)) {
    findings.push(
      `src/worker-adapter.cjs REVIEW_KIND_BINS keys must match REVIEW_KINDS: expected ${JSON.stringify(
        reviewKinds
      )}, got ${JSON.stringify(binKinds)}.`
    );
  }
  for (const reviewKind of reviewKinds) {
    const bin = reviewKindBins[reviewKind];
    if (!bin) {
      findings.push(`review kind '${reviewKind}' must have a worker bin mapping.`);
      continue;
    }
    if (!fs.existsSync(path.join(root, "bin", bin))) {
      findings.push(`review kind '${reviewKind}' worker bin does not exist: bin/${bin}.`);
    }
  }
}

function checkDispatchWorkflow(workflowPath, workflowText, reviewKinds, findings) {
  let workflow;
  try {
    workflow = YAML.parse(workflowText);
  } catch (error) {
    findings.push(`${workflowPath} must be valid YAML: ${error.message}`);
    return;
  }
  const reviewKindInput =
    workflow?.on?.workflow_dispatch?.inputs?.review_kind ||
    workflow?.true?.workflow_dispatch?.inputs?.review_kind;
  if (!reviewKindInput) {
    findings.push(`${workflowPath} must define workflow_dispatch input review_kind.`);
    return;
  }
  if (reviewKindInput.type !== "choice") {
    findings.push(`${workflowPath} review_kind input must be a choice.`);
  }
  if (!arraysEqual(reviewKindInput.options, reviewKinds)) {
    findings.push(
      `${workflowPath} review_kind options must match REVIEW_KINDS: expected ${JSON.stringify(
        reviewKinds
      )}, got ${JSON.stringify(reviewKindInput.options || null)}.`
    );
  }
}

function checkReusableWorkflowFallback(text, variableName, expected, findings) {
  const actual = fallbackJsonArrayForVariable(text, variableName);
  if (!actual) {
    findings.push(`${reusableWorkflowPath} must define a JSON fallback for vars.${variableName}.`);
    return;
  }
  if (!arraysEqual(actual, expected)) {
    findings.push(
      `${reusableWorkflowPath} vars.${variableName} fallback must be ${JSON.stringify(
        expected
      )}, got ${JSON.stringify(actual)}.`
    );
  }
}

function fallbackJsonArrayForVariable(text, variableName) {
  const pattern = new RegExp(`${escapeRegExp(variableName)}\\s*\\|\\|\\s*'([^']+)'`);
  const match = text.match(pattern);
  if (!match) {
    return null;
  }
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function checkReusableWorkflowCaseStatement(text, reviewKinds, reviewKindBins, findings) {
  for (const reviewKind of reviewKinds) {
    const expected = `${reviewKind}) script="bot/bin/${reviewKindBins[reviewKind]}" ;;`;
    if (!text.includes(expected)) {
      findings.push(`${reusableWorkflowPath} must map '${reviewKind}' to ${expected}.`);
    }
  }
  if (!text.includes("Unsupported REVIEW_KIND")) {
    findings.push(`${reusableWorkflowPath} must fail closed for unsupported review kinds.`);
  }
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
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
  SYNCHRONIZE_REVIEW_KINDS,
  SPECIAL_WORKFLOW_REVIEW_KINDS,
  arraysEqual,
  checkReviewWorkflowKinds,
  fallbackJsonArrayForVariable,
  normalizeWhitespace,
};
