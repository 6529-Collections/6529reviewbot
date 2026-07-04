#!/usr/bin/env node

"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");
const { REVIEW_KINDS, parseReviewCommand } = require("../src/github-webhook.cjs");
const { createReviewJobs } = require("../src/review-job.cjs");

const SELF_REVIEW_LANES = [{ provider: "anthropic", model: "claude-opus-4-8" }];
const SELF_REVIEW_MAX_JOBS = 12;

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
  if (reviewKinds.length === 0) {
    return {
      prNumber,
      eventAction,
      reviewKinds: [],
      jobs: [],
      headSha: "",
    };
  }
  const repository = String(env.GITHUB_REPOSITORY || "").trim();
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required.");
  }
  const installationId = String(env.SELF_INSTALLATION_ID || "").trim();
  if (!installationId) {
    throw new Error(
      "SELF_INSTALLATION_ID is required. Set the REVIEWBOT_SELF_INSTALLATION_ID repository variable."
    );
  }
  let headSha = String(env.PR_HEAD_SHA || "").trim();
  let baseSha = String(env.PR_BASE_SHA || "").trim();
  let headRefName = String(env.PR_HEAD_REF || "").trim();
  if (!headSha || !baseSha || !headRefName) {
    const resolvePullRequest = options.resolvePullRequest || resolvePullRequestWithGh;
    const context = resolvePullRequest(prNumber, env);
    headSha = headSha || context.headSha;
    baseSha = baseSha || context.baseSha;
    headRefName = headRefName || context.headRefName;
  }
  if (!headSha) {
    throw new Error(`Could not resolve head SHA for PR #${prNumber}.`);
  }
  const deliveryId = `self-review-${String(env.GITHUB_RUN_ID || "").trim() || "manual"}`;
  const event = {
    kind: "self_review",
    trigger: eventName === "issue_comment" ? "comment" : "self_review",
    shouldEnqueue: true,
    deliveryId,
    repository: { fullName: repository },
    headRepoFullName: repository,
    prNumber,
    headSha,
    baseSha,
    headRefName,
    installationId,
    reviewKinds,
    actor: String(env.GITHUB_ACTOR || "").trim(),
  };
  const jobs = createReviewJobs(
    event,
    {},
    { maxJobsPerDelivery: SELF_REVIEW_MAX_JOBS, lanes: SELF_REVIEW_LANES }
  );
  return {
    prNumber,
    eventAction,
    reviewKinds,
    jobs,
    headSha,
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

function resolvePullRequestWithGh(prNumber, env = process.env) {
  const repository = String(env.GITHUB_REPOSITORY || "").trim();
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY is required to resolve the PR context.");
  }
  const output = execFileSync(
    "gh",
    [
      "api",
      `repos/${repository}/pulls/${prNumber}`,
      "--jq",
      "[.head.sha, .base.sha, .head.ref] | join(\"\\n\")",
    ],
    { encoding: "utf8" }
  );
  const [headSha = "", baseSha = "", headRefName = ""] = String(output || "")
    .split("\n")
    .map((line) => line.trim());
  if (!headSha) {
    throw new Error(`Could not resolve head SHA for PR #${prNumber}.`);
  }
  return { headSha, baseSha, headRefName };
}

function main() {
  const plan = planSelfReview(process.env);
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error("GITHUB_OUTPUT is required.");
  }
  const lines = [
    `pr_number=${plan.prNumber}`,
    `event_action=${plan.eventAction}`,
    `review_kinds_json=${JSON.stringify(plan.reviewKinds)}`,
    `jobs_json=${JSON.stringify(plan.jobs)}`,
  ];
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`);
  if (plan.jobs.length === 0) {
    console.log(`No review kinds requested for PR #${plan.prNumber}; skipping review.`);
    return;
  }
  console.log(
    `Planned ${plan.jobs.length} self review job(s) for PR #${plan.prNumber} @ ${plan.headSha}: ${plan.reviewKinds.join(", ")}`
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
