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

  console.log(`self dogfood replay ok (${checkedCommands} command cases checked)`);
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

function writeCommandPayload(tempDir, commandCase, index) {
  const payload = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, "templates/self-dogfood-comment-command.payload.json"),
      "utf8"
    )
  );
  payload.comment.id = 6529100 + index;
  payload.comment.body = commandCase.body;
  const payloadPath = path.join(tempDir, `${String(index + 1).padStart(2, "0")}.json`);
  fs.writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`);
  return payloadPath;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function replay(payloadPath, options = {}) {
  return await replayWebhook.replayWebhook({
    payloadPath: path.relative(repoRoot, path.resolve(repoRoot, payloadPath)),
    eventName: options.eventName,
    deliveryId: options.deliveryId,
    webhookSecret: "self-dogfood-replay-secret",
    actorPermission: "write",
    repositoryConfigPath,
    assumeEmptyBudget: true,
    estimatedCostUsd: 0.25,
  });
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
