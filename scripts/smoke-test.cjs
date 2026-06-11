#!/usr/bin/env node

"use strict";

const assert = require("assert");
const admissionPolicy = require("../src/admission-policy.cjs");
const appServer = require("../src/app-server.cjs");
const githubWebhook = require("../src/github-webhook.cjs");
const reviewBot = require("../src/review-bot.cjs");
const usageLedger = require("../src/usage-ledger.cjs");

const settings = withEnv(
  {
    GH_REPO: "6529-Collections/example",
    PR_NUMBER: "7",
    REVIEW_PROVIDER: "anthropic",
    REVIEW_USAGE_ENABLED: "false",
  },
  () => reviewBot.readSettings({}, "general")
);

assert.equal(settings.provider, "anthropic");
assert.equal(settings.model, "claude-opus-4-8");
assert.equal(settings.providerTimeoutMs, 120000);
assert.deepEqual(settings.trustedMarkerAuthors, ["6529bot[bot]", "github-actions[bot]"]);

withEnv(
  {
    GH_REPO: "6529-Collections/example",
    PR_NUMBER: "7",
    REVIEW_PROVIDER: "anthropic",
    REVIEW_MAX_OUTPUT_TOKENS: "999999",
  },
  () => {
    assert.throws(
      () => reviewBot.readSettings({}, "general"),
      /REVIEW_MAX_OUTPUT_TOKENS must be <= 32000/
    );
  }
);

const marker = reviewBot.commentMarker("general", settings, "abc123");
const comments = [
  {
    author: "human",
    body: `<!-- 6529-review-bot:{"marker":"${marker}","kind":"general","headSha":"bad"} -->`,
    createdAt: "1",
  },
  {
    author: "6529bot[bot]",
    body: `<!-- 6529-review-bot:{"marker":"${marker}","kind":"general","headSha":"abc1234"} -->`,
    createdAt: "2",
  },
];

assert.equal(reviewBot.countMarker(comments, marker, settings), 1);
assert.equal(reviewBot.extractReviewHistory(comments, settings).length, 1);
assert.equal(reviewBot.isTrustedMarkerAuthor("human", settings), false);
assert.equal(reviewBot.isTrustedMarkerAuthor("6529bot[bot]", settings), true);
assert.equal(reviewBot.isSafeRepositoryPath("components/example.tsx"), true);
assert.equal(reviewBot.isSafeRepositoryPath("../secret"), false);
assert.equal(reviewBot.isSafeRepositoryPath("/etc/passwd"), false);
assert.equal(reviewBot.isSafeRepositoryPath(".git/config"), false);
assert.equal(reviewBot.stripReviewBotMetadata('hello <!-- 6529-review-bot:{"x":1} --> world'), "hello  world");
assert.equal(reviewBot.truncate("abcdef", 0), "");
assert.equal(reviewBot.enforceInputLimit({ system: "system", user: "abcdef" }, 3).user, "");

assert.equal(usageLedger.quoteIdent("reviewbot"), '"reviewbot"');
assert.throws(() => usageLedger.quoteIdent("reviewbot;drop"), /Invalid SQL identifier/);

assert.deepEqual(reviewBot.normalizeOpenAIUsage({
  input_tokens: 10,
  output_tokens: 5,
  total_tokens: 15,
  input_tokens_details: { cached_tokens: 2 },
  output_tokens_details: { reasoning_tokens: 3 },
}), {
  inputTokens: 10,
  cachedInputTokens: 2,
  outputTokens: 5,
  reasoningTokens: 3,
  totalTokens: 15,
});

const webhookBody = Buffer.from(JSON.stringify({
  action: "opened",
  repository: {
    id: 1,
    full_name: "6529-Collections/example",
    private: false,
    default_branch: "main",
  },
  installation: { id: 99 },
  sender: { login: "maintainer" },
  pull_request: {
    number: 12,
    user: { login: "author" },
    head: {
      sha: "abc123",
      repo: { full_name: "6529-Collections/example" },
    },
    base: {
      sha: "def456",
      repo: { full_name: "6529-Collections/example" },
    },
    draft: false,
  },
}));
const webhookSecret = "test-secret";
const webhookSignature = githubWebhook.signGitHubWebhook(webhookSecret, webhookBody);
assert.equal(githubWebhook.verifyGitHubWebhookSignature(webhookSecret, webhookBody, webhookSignature), true);
assert.equal(githubWebhook.verifyGitHubWebhookSignature(webhookSecret, webhookBody, "sha256=bad"), false);
assert.throws(
  () => githubWebhook.assertGitHubWebhookSignature(webhookSecret, webhookBody, {}),
  /Invalid GitHub webhook signature/
);

const normalizedPullRequest = githubWebhook.normalizeGitHubWebhook(
  {
    "x-github-event": "pull_request",
    "x-github-delivery": "delivery-1",
  },
  JSON.parse(webhookBody.toString("utf8"))
);
assert.equal(normalizedPullRequest.kind, "pull_request");
assert.equal(normalizedPullRequest.shouldEnqueue, true);
assert.deepEqual(normalizedPullRequest.reviewKinds, ["general", "wcag", "i18n", "security"]);

assert.deepEqual(githubWebhook.parseReviewCommand("/6529bot review security wcag").reviewKinds, [
  "security",
  "wcag",
]);
assert.deepEqual(githubWebhook.parseReviewCommand("@6529bot review all").reviewKinds, [
  "general",
  "wcag",
  "i18n",
  "security",
]);
assert.equal(githubWebhook.parseReviewCommand("looks good"), null);

const commentEvent = githubWebhook.normalizeGitHubWebhook(
  { "x-github-event": "issue_comment" },
  {
    action: "created",
    repository: { full_name: "6529-Collections/example" },
    sender: { login: "maintainer" },
    issue: {
      number: 12,
      pull_request: { url: "https://api.github.com/repos/6529-Collections/example/pulls/12" },
      user: { login: "author" },
    },
    comment: {
      id: 456,
      body: "/6529bot security",
      user: { login: "maintainer" },
    },
  }
);
assert.equal(commentEvent.kind, "comment_command");
assert.deepEqual(commentEvent.reviewKinds, ["security"]);

const publicPolicy = admissionPolicy.admissionPolicyFromEnv({});
assert.equal(
  admissionPolicy.evaluateAdmission(normalizedPullRequest, { login: "author", permission: "read" }, publicPolicy).status,
  "denied"
);
assert.equal(
  admissionPolicy.evaluateAdmission(normalizedPullRequest, { login: "maintainer", permission: "write" }, publicPolicy).status,
  "allowed"
);
assert.equal(
  admissionPolicy.evaluateAdmission(commentEvent, { login: "maintainer", permission: "maintain" }, publicPolicy).requestor,
  "maintainer"
);
const privateEvent = {
  ...normalizedPullRequest,
  repository: { ...normalizedPullRequest.repository, private: true },
};
assert.equal(
  admissionPolicy.evaluateAdmission(privateEvent, { login: "external", permission: "none" }, publicPolicy).status,
  "allowed"
);
const draftEvent = { ...normalizedPullRequest, draft: true };
assert.equal(
  admissionPolicy.evaluateAdmission(draftEvent, { login: "maintainer", permission: "admin" }, publicPolicy).code,
  "draft_pull_request"
);
const denyPolicy = admissionPolicy.admissionPolicyFromEnv({
  REVIEWBOT_DENY_USERS: "maintainer",
});
assert.equal(
  admissionPolicy.evaluateAdmission(normalizedPullRequest, { login: "maintainer", permission: "admin" }, denyPolicy).code,
  "blocked_actor"
);
assert.equal(
  admissionPolicy.evaluateAdmission(draftEvent, { login: "maintainer", permission: "admin" }, denyPolicy).code,
  "blocked_actor"
);
assert.throws(
  () => admissionPolicy.admissionPolicyFromEnv({ REVIEWBOT_TRUSTED_PERMISSION: "owner" }),
  /REVIEWBOT_TRUSTED_PERMISSION must be one of/
);

let enqueuedEvent = null;
appServer.handleGitHubWebhook({
  headers: {
    "x-hub-signature-256": webhookSignature,
    "x-github-event": "pull_request",
    "x-github-delivery": "delivery-1",
  },
  rawBody: webhookBody,
  settings: {
    webhookSecret,
    webhookPath: "/webhooks/github",
    maxBodyBytes: 2048,
  },
  enqueueReview: async (event) => {
    enqueuedEvent = event;
    return { accepted: true, jobId: "job-1" };
  },
  resolveActorContext: async () => ({ login: "maintainer", permission: "write" }),
}).then(async (webhookResult) => {
  assert.equal(webhookResult.statusCode, 202);
  assert.equal(webhookResult.body.enqueued, true);
  assert.equal(enqueuedEvent.prNumber, 12);
  const defaultQueueResult = await appServer.handleGitHubWebhook({
    headers: {
      "x-hub-signature-256": webhookSignature,
      "x-github-event": "pull_request",
      "x-github-delivery": "delivery-1",
    },
    rawBody: webhookBody,
    settings: {
      webhookSecret,
      webhookPath: "/webhooks/github",
      maxBodyBytes: 2048,
    },
    resolveActorContext: async () => ({ login: "maintainer", permission: "write" }),
  });
  assert.equal(defaultQueueResult.statusCode, 200);
  assert.equal(defaultQueueResult.body.enqueued, false);
  console.log("smoke tests ok");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function withEnv(nextEnv, fn) {
  const oldEnv = process.env;
  process.env = { ...oldEnv, ...nextEnv };
  try {
    return fn();
  } finally {
    process.env = oldEnv;
  }
}
