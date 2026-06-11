#!/usr/bin/env node

"use strict";

const assert = require("assert");
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

console.log("smoke tests ok");

function withEnv(nextEnv, fn) {
  const oldEnv = process.env;
  process.env = { ...oldEnv, ...nextEnv };
  try {
    return fn();
  } finally {
    process.env = oldEnv;
  }
}
