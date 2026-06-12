#!/usr/bin/env node

"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { runPreflight } = require("../src/preflight.cjs");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529reviewbot-preflight-"));
const priceFile = path.join(tempDir, "model-prices.json");

process.on("exit", () => {
  fs.rmSync(tempDir, { force: true, recursive: true });
});

fs.writeFileSync(
  priceFile,
  JSON.stringify(
    {
      version: 1,
      currency: "USD",
      prices: [
        {
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputUsdPerMillion: 1,
          outputUsdPerMillion: 2,
          effectiveFrom: "2026-06-12T00:00:00.000Z",
          sourceUrl: "https://example.com/provider-pricing",
          sourceCheckedAt: "2026-06-12T12:00:00.000Z",
        },
      ],
    },
    null,
    2
  )
);

const baseEnv = {
  GITHUB_WEBHOOK_SECRET: "release-preflight-secret-release-preflight-secret",
  REVIEWBOT_GITHUB_APP_ID: "12345",
  REVIEWBOT_GITHUB_APP_PRIVATE_KEY: "configured-for-preflight",
  REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8",
  REVIEWBOT_MAX_JOBS_PER_DELIVERY: "4",
  REVIEWBOT_PUBLIC_REPO_MODE: "trusted",
  REVIEWBOT_PRIVATE_REPO_MODE: "open",
  REVIEWBOT_DRAFT_PR_MODE: "skip",
  REVIEWBOT_TRUSTED_PERMISSION: "write",
  REVIEWBOT_BUDGET_MODE: "enforce",
  REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD: "1",
  REVIEWBOT_ENABLED: "true",
  REVIEWBOT_RUN_CONTROL_MODE: "enforce",
  REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT: "2",
  REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT: "1",
  REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED: "true",
  REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "github",
  REVIEW_USAGE_ENABLED: "true",
  REVIEW_USAGE_AWS_REGION: "us-east-1",
  REVIEW_USAGE_DB_RESOURCE_ARN: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  REVIEW_USAGE_DB_SECRET_ARN:
    "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot-db",
  REVIEW_USAGE_DB_NAME: "reviewbot",
  REVIEW_USAGE_DB_SCHEMA: "reviewbot",
  REVIEWBOT_JOB_LEDGER_ENABLED: "true",
  REVIEWBOT_MODEL_PRICE_FILE: priceFile,
  REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS: "30",
  REVIEWBOT_USAGE_API_PUBLIC_ENABLED: "true",
  REVIEWBOT_USAGE_API_ADMIN_ENABLED: "true",
  REVIEWBOT_ADMIN_AUTH_MODE: "hmac",
  REVIEWBOT_ADMIN_AUTH_HMAC_SECRET: "release-preflight-hmac-secret-release-preflight",
  REVIEWBOT_ALERTS_ENABLED: "true",
  REVIEWBOT_ALERTS_NOTIFY_MODE: "stdout",
  REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED: "true",
};

const fixtures = [
  {
    name: "central-server-github-actions",
    options: {
      profile: "server",
      now: "2026-06-20T12:00:00.000Z",
      env: {
        ...baseEnv,
        REVIEWBOT_WORKER_ADAPTER: "github_actions",
        REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
        REVIEWBOT_WORKER_GITHUB_WORKFLOW: "review-job.yml",
        REVIEWBOT_WORKER_GITHUB_REF: "main",
        REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
        REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "98765",
      },
    },
    expectedWarnings: [
      "github_actions provider keys must be configured as central worker secrets.",
    ],
  },
  {
    name: "central-worker-local",
    options: {
      profile: "worker",
      strict: true,
      now: "2026-06-20T12:00:00.000Z",
      env: {
        ...baseEnv,
        REVIEWBOT_WORKER_ADAPTER: "local",
        ANTHROPIC_API_KEY: "configured-for-preflight",
      },
    },
    expectedWarnings: [],
  },
];

for (const fixture of fixtures) {
  assertPreflightFixture(fixture);
}

assertStalePriceFilePreflight();

console.log(`preflight fixtures ok (${fixtures.length} profiles checked)`);

function assertPreflightFixture(fixture) {
  const result = runPreflight(fixture.options);
  assert.equal(
    result.errors.length,
    0,
    `${fixture.name} should not report preflight errors: ${JSON.stringify(result.errors)}`
  );
  assert.deepEqual(
    result.warnings.map((warning) => warning.message),
    fixture.expectedWarnings,
    `${fixture.name} should only emit expected warnings`
  );
  assert.equal(
    result.ok,
    true,
    `${fixture.name} should be ok when it has no errors and no unexpected strict warnings`
  );
  const priceCheck = result.checks.find((check) => check.name === "model_price_sources");
  assert.equal(priceCheck.configured, true, `${fixture.name} should validate price evidence`);
  assert.equal(priceCheck.file, undefined, `${fixture.name} should not expose price file paths`);
}

function assertStalePriceFilePreflight() {
  const result = runPreflight({
    profile: "server",
    now: "2026-07-20T12:00:00.000Z",
    env: {
      ...baseEnv,
      REVIEWBOT_WORKER_ADAPTER: "noop",
    },
  });
  assert.equal(result.ok, false, "stale price source evidence should fail preflight");
  assert.match(
    result.errors.find((error) => error.name === "model_price_sources")?.message || "",
    /stale or invalid sourceCheckedAt evidence/
  );
}
