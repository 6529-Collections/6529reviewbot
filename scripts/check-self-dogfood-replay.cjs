#!/usr/bin/env node

"use strict";

const assert = require("assert");
const path = require("path");
const replayWebhook = require("../bin/replay-webhook.cjs");

const repoRoot = path.resolve(__dirname, "..");
const repositoryConfigPath = ".github/6529bot.yml";

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

  const commentReplay = await replay("templates/self-dogfood-comment-command.payload.json", {
    eventName: "issue_comment",
    deliveryId: "self-dogfood-comment-command",
  });
  assert.equal(commentReplay.statusCode, 200);
  assert.equal(commentReplay.body.enqueued, false);
  assert.equal(commentReplay.body.configuration.status, "loaded");
  assert.equal(commentReplay.body.event.trigger, "comment");
  assert.deepEqual(commentReplay.body.event.reviewKinds, ["security"]);
  assert.equal(commentReplay.body.admission.allowed, true);
  assert.equal(commentReplay.body.budget.allowed, true);
  assert.equal(commentReplay.body.queue.adapter, "dry_run");
  assert.equal(commentReplay.body.queue.jobCount, 1);
  assert.equal(commentReplay.body.jobs.length, 1);
  assert.equal(commentReplay.body.jobs[0].reviewKind, "security");
  assert.equal(commentReplay.body.jobs[0].provider, "anthropic");
  assert.equal(commentReplay.body.jobs[0].model, "claude-opus-4-8");

  console.log("self dogfood replay ok");
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
