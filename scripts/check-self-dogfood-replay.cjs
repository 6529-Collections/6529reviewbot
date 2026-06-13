#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const replayWebhook = require("../bin/replay-webhook.cjs");

const repoRoot = path.resolve(__dirname, "..");
const repositoryConfigPath = ".github/6529bot.yml";
const commandMatrix = [
  { body: "/6529bot", reviewKinds: ["general"] },
  { body: "/6529bot review", reviewKinds: ["general"] },
  { body: "/6529bot general", reviewKinds: ["general"] },
  { body: "/6529bot followup", reviewKinds: ["followup"] },
  { body: "/6529bot wcag", reviewKinds: ["wcag"] },
  { body: "/6529bot i18n", reviewKinds: ["i18n"] },
  { body: "/6529bot security", reviewKinds: ["security"] },
  { body: "@6529bot review wcag i18n", reviewKinds: ["wcag", "i18n"] },
];

async function main() {
  const pullRequestReplay = await replay("templates/self-dogfood-pr-opened.payload.json", {
    eventName: "pull_request",
    deliveryId: "self-dogfood-pr-opened",
  });
  assert.equal(pullRequestReplay.statusCode, 200);
  assert.equal(pullRequestReplay.body.enqueued, false);
  assert.equal(pullRequestReplay.body.configuration.status, "loaded");
  assert.equal(pullRequestReplay.body.event.trigger, "pull_request");
  assert.equal(pullRequestReplay.body.event.reviewKinds.length, 0);
  assert.match(
    pullRequestReplay.body.event.reason,
    /Repository config does not allow any requested review kinds/
  );

  const checkedCommands = await checkCommandMatrix();
  const multiLaneJobs = await checkMultiLaneCommandFanout();
  await checkMaxFanoutGuard();
  await checkUntrustedCommandDenied();

  console.log(
    `self dogfood replay ok (${checkedCommands} trusted command cases checked; ${multiLaneJobs} multi-lane jobs checked; max-fanout guard checked; untrusted command denied)`
  );
}

async function checkCommandMatrix() {
  const tempRoot = path.join(repoRoot, "tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(tempRoot, "self-dogfood-command-"));
  try {
    for (let index = 0; index < commandMatrix.length; index += 1) {
      const commandCase = commandMatrix[index];
      const payloadPath = writeCommandPayload(tempDir, commandCase, index);
      const commentReplay = await replay(payloadPath, {
        eventName: "issue_comment",
        deliveryId: `self-dogfood-command-${slug(commandCase.body)}`,
      });
      assertCommentReplay(commentReplay, commandCase);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return commandMatrix.length;
}

async function checkMultiLaneCommandFanout() {
  const tempDir = createTempDir("self-dogfood-lanes-");
  try {
    const configPath = writeMultiLaneRepositoryConfig(tempDir, {
      maxJobsPerDelivery: 4,
    });
    const replayResult = await replay("templates/self-dogfood-comment-command.payload.json", {
      eventName: "issue_comment",
      deliveryId: "self-dogfood-multi-lane-command",
      repositoryConfigPath: configPath,
      env: {
        REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8,openai:gpt-5.5",
        REVIEWBOT_MAX_JOBS_PER_DELIVERY: "4",
      },
    });
    assert.equal(replayResult.statusCode, 200);
    assert.equal(replayResult.body.enqueued, false);
    assert.equal(replayResult.body.event.trigger, "comment");
    assert.deepEqual(replayResult.body.event.reviewKinds, ["security"]);
    assert.equal(replayResult.body.queue.adapter, "dry_run");
    assert.equal(replayResult.body.queue.jobCount, 2);
    assert.deepEqual(
      replayResult.body.jobs.map((job) => `${job.provider}:${job.model}`),
      ["anthropic:claude-opus-4-8", "openai:gpt-5.5"]
    );
    assert.equal(new Set(replayResult.body.jobs.map((job) => job.id)).size, 2);
    assert.equal(new Set(replayResult.body.jobs.map((job) => job.runKey)).size, 2);
    assert.equal(
      replayResult.body.jobs.every((job) => job.reviewKind === "security"),
      true
    );
    return replayResult.body.jobs.length;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function checkMaxFanoutGuard() {
  const tempDir = createTempDir("self-dogfood-fanout-");
  try {
    const configPath = writeMultiLaneRepositoryConfig(tempDir, {
      maxJobsPerDelivery: 4,
    });
    await assert.rejects(
      () =>
        replay("templates/self-dogfood-comment-command.payload.json", {
          eventName: "issue_comment",
          deliveryId: "self-dogfood-max-fanout",
          repositoryConfigPath: configPath,
          env: {
            REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8,openai:gpt-5.5",
            REVIEWBOT_MAX_JOBS_PER_DELIVERY: "1",
          },
        }),
      /above REVIEWBOT_MAX_JOBS_PER_DELIVERY=1/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function assertCommentReplay(commentReplay, commandCase) {
  assert.equal(commentReplay.statusCode, 200);
  assert.equal(commentReplay.body.enqueued, false);
  assert.equal(commentReplay.body.configuration.status, "loaded");
  assert.equal(commentReplay.body.event.trigger, "comment");
  assert.deepEqual(commentReplay.body.event.reviewKinds, commandCase.reviewKinds);
  assert.equal(commentReplay.body.admission.allowed, true);
  assert.equal(commentReplay.body.budget.allowed, true);
  assert.equal(commentReplay.body.queue.adapter, "dry_run");
  assert.equal(commentReplay.body.queue.jobCount, commandCase.reviewKinds.length);
  assert.equal(commentReplay.body.jobs.length, commandCase.reviewKinds.length);
  assert.deepEqual(
    commentReplay.body.jobs.map((job) => job.reviewKind),
    commandCase.reviewKinds
  );
  for (const job of commentReplay.body.jobs) {
    assert.equal(job.provider, "anthropic");
    assert.equal(job.model, "claude-opus-4-8");
  }
}

async function checkUntrustedCommandDenied() {
  const replayResult = await replay("templates/self-dogfood-comment-command.payload.json", {
    eventName: "issue_comment",
    deliveryId: "self-dogfood-untrusted-command",
    actorPermission: "read",
  });
  assert.equal(replayResult.statusCode, 200);
  assert.equal(replayResult.body.enqueued, false);
  assert.equal(replayResult.body.configuration.status, "loaded");
  assert.equal(replayResult.body.event.trigger, "comment");
  assert.deepEqual(replayResult.body.event.reviewKinds, ["security"]);
  assert.equal(replayResult.body.admission.allowed, false);
  assert.equal(replayResult.body.admission.code, "untrusted_actor");
  assert.equal(hasOwn(replayResult.body, "budget"), false);
  assert.equal(hasOwn(replayResult.body, "queue"), false);
  assert.equal(hasOwn(replayResult.body, "jobs"), false);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function writeCommandPayload(tempDir, commandCase, index) {
  const payload = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "templates/self-dogfood-comment-command.payload.json"),
      "utf8"
    )
  );
  payload.comment.id = 6529100 + index;
  payload.comment.body = commandCase.body;
  const payloadPath = path.join(
    tempDir,
    `${String(index + 1).padStart(2, "0")}.json`
  );
  fs.writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payloadPath;
}

function writeMultiLaneRepositoryConfig(tempDir, options = {}) {
  const maxJobsPerDelivery = options.maxJobsPerDelivery || 4;
  const filePath = path.join(tempDir, "6529bot.yml");
  fs.writeFileSync(
    filePath,
    `version: 1
enabled: true

reviewKinds:
  allowed: [general, followup, wcag, i18n, security]
  initial: []
  followup: []

commands:
  enabled: true

lanes:
  - provider: anthropic
    model: claude-opus-4-8
  - provider: openai
    model: gpt-5.5

limits:
  maxJobsPerDelivery: ${maxJobsPerDelivery}

admission:
  publicRepoMode: trusted
  privateRepoMode: open
  draftPrMode: skip
  trustedPermission: write
  trustedUsers: []
  trustedTeams: []
  trustedOrganizations: []
  denyUsers: []

budget:
  mode: enforce
  defaultEstimatedCostUsd: 0.25
  caps:
    repo:
      dailyUsd: 50
    requestor:
      dailyUsd: 25
    pr:
      dailyUsd: 25
    review_kind:
      dailyUsd: 25
`,
    "utf8"
  );
  return path.relative(repoRoot, filePath);
}

function createTempDir(prefix) {
  const tempRoot = path.join(repoRoot, "tmp");
  fs.mkdirSync(tempRoot, { recursive: true });
  return fs.mkdtempSync(path.join(tempRoot, prefix));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function replay(payloadPath, options = {}) {
  return await withEnv(options.env || {}, async () =>
    replayWebhook.replayWebhook({
      payloadPath: path.relative(repoRoot, path.resolve(repoRoot, payloadPath)),
      eventName: options.eventName,
      deliveryId: options.deliveryId,
      webhookSecret: "self-dogfood-replay-secret",
      actorPermission: options.actorPermission || "write",
      repositoryConfigPath: options.repositoryConfigPath || repositoryConfigPath,
      assumeEmptyBudget: true,
      estimatedCostUsd: 0.25,
    })
  );
}

async function withEnv(patch, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(patch)) {
    previous.set(
      key,
      Object.prototype.hasOwnProperty.call(process.env, key)
        ? process.env[key]
        : undefined
    );
    process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
};
