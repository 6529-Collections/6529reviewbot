#!/usr/bin/env node

"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");
const { REVIEW_KINDS, parseReviewCommand } = require("../src/github-webhook.cjs");

function planSelfReview(env = process.env, options = {}) {
  const eventName = String(env.EVENT_NAME || "").trim();
  const eventAction = String(env.EVENT_ACTION || "manual").trim() || "manual";
  const prNumber = String(env.PR_NUMBER || "").trim();
  if (!prNumber) {
    throw new Error("PR_NUMBER is required.");
  }
  let reviewKinds;
  if (eventName === "workflow_dispatch") {
    reviewKinds = String(env.REQUESTED_KINDS_JSON || "").trim()
      ? parseKindsJson(env.REQUESTED_KINDS_JSON, "review_kinds_json")
      : parseKindsJson(env.INITIAL_KINDS_JSON, "INITIAL_KINDS_JSON");
  } else if (eventName === "pull_request") {
    reviewKinds =
      eventAction === "synchronize"
        ? parseKindsJson(env.SYNCHRONIZE_KINDS_JSON, "SYNCHRONIZE_KINDS_JSON")
        : parseKindsJson(env.INITIAL_KINDS_JSON, "INITIAL_KINDS_JSON");
  } else if (eventName === "issue_comment") {
    const command = parseReviewCommand(String(env.COMMENT_BODY || ""));
    reviewKinds = command?.reviewKinds?.length ? command.reviewKinds : [];
  } else {
    throw new Error(`Unsupported event '${eventName}'.`);
  }
  let headSha = String(env.PR_HEAD_SHA || "").trim();
  if (!headSha && reviewKinds.length) {
    const resolveHeadSha = options.resolveHeadSha || resolveHeadShaWithGh;
    headSha = resolveHeadSha(prNumber, env);
  }
  return {
    prNumber,
    headSha,
    eventAction,
    reviewKinds,
  };
}

function parseKindsJson(value, label) {
  let parsed;
  try {
    parsed = JSON.parse(String(value || ""));
  } catch (error) {
    throw new Error(`${label} must be a JSON array of review kinds: ${error.message}`);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`${label} must be a non-empty JSON array of review kinds.`);
  }
  for (const kind of parsed) {
    if (!REVIEW_KINDS.includes(kind)) {
      throw new Error(`${label} includes unknown review kind '${kind}'.`);
    }
  }
  return parsed;
}

function resolveHeadShaWithGh(prNumber, env = process.env) {
  const repository = String(env.GITHUB_REPOSITORY || "").trim();
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required to resolve the PR head SHA.");
  }
  const output = execFileSync(
    "gh",
    ["api", `repos/${repository}/pulls/${prNumber}`, "--jq", ".head.sha"],
    { encoding: "utf8" }
  );
  const headSha = String(output || "").trim();
  if (!headSha) {
    throw new Error(`Could not resolve head SHA for PR #${prNumber}.`);
  }
  return headSha;
}

function main() {
  const plan = planSelfReview(process.env);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error("GITHUB_OUTPUT is required.");
  }
  const lines = [
    `pr_number=${plan.prNumber}`,
    `head_sha=${plan.headSha}`,
    `event_action=${plan.eventAction}`,
    `review_kinds_json=${JSON.stringify(plan.reviewKinds)}`,
  ];
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
  if (plan.reviewKinds.length === 0) {
    console.log(`No review kinds requested for PR #${plan.prNumber}; skipping review.`);
    return;
  }
  console.log(
    `Planned self review for PR #${plan.prNumber} @ ${plan.headSha}: ${plan.reviewKinds.join(", ")}`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {
  planSelfReview,
};
