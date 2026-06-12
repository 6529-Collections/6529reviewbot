#!/usr/bin/env node

"use strict";

const assert = require("assert/strict");
const { runPreflight } = require("../src/preflight.cjs");

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
}
