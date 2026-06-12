#!/usr/bin/env node

"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const adminAuth = require("../src/admin-auth.cjs");
const admissionPolicy = require("../src/admission-policy.cjs");
const alertNotifier = require("../src/alert-notifier.cjs");
const appServer = require("../src/app-server.cjs");
const budgetAdmission = require("../src/budget-admission.cjs");
const budgetLedger = require("../src/budget-ledger.cjs");
const budgetPolicies = require("../src/budget-policies.cjs");
const budgetPoliciesCli = require("../bin/apply-budget-policies.cjs");
const dataApi = require("../src/data-api.cjs");
const githubWebhook = require("../src/github-webhook.cjs");
const githubAppAuth = require("../src/github-app-auth.cjs");
const applyLedgerSchemaCli = require("../bin/apply-ledger-schema.cjs");
const githubAppManifest = require("../src/github-app-manifest.cjs");
const githubAppManifestConversion = require("../src/github-app-manifest-conversion.cjs");
const githubAppManifestConversionCli = require("../bin/convert-github-app-manifest.cjs");
const githubAppManifestCli = require("../bin/render-github-app-manifest.cjs");
const githubAppInstallationToken = require("../bin/github-app-installation-token.cjs");
const jobHealthAlerts = require("../src/job-health-alerts.cjs");
const jobLedger = require("../src/job-ledger.cjs");
const ledgerSchema = require("../src/ledger-schema.cjs");
const replayWebhook = require("../bin/replay-webhook.cjs");
const runReviewJobCli = require("../bin/run-review-job.cjs");
const serverCli = require("../bin/server.cjs");
const releaseGates = require("../src/release-gates.cjs");
const releaseGatesCli = require("../bin/v0-gates.cjs");
const docsLinkCheck = require("./check-doc-links.cjs");
const modelCatalog = require("../src/model-catalog.cjs");
const modelPrices = require("../src/model-prices.cjs");
const modelPricesCli = require("../bin/apply-model-prices.cjs");
const preflight = require("../src/preflight.cjs");
const preflightCli = require("../bin/preflight.cjs");
const publicArtifactsCheck = require("./check-public-artifacts.cjs");
const repositoryConfig = require("../src/repository-config.cjs");
const reviewJob = require("../src/review-job.cjs");
const reviewBot = require("../src/review-bot.cjs");
const runControl = require("../src/run-control.cjs");
const runControlLedger = require("../src/run-control-ledger.cjs");
const runtimeControl = require("../src/runtime-control.cjs");
const scheduledSpendCheck = require("../src/scheduled-spend-check.cjs");
const spendAlerts = require("../src/spend-alerts.cjs");
const supportBundle = require("../src/support-bundle.cjs");
const supportBundleCli = require("../bin/support-bundle.cjs");
const usageApi = require("../src/usage-api.cjs");
const usageApiLedger = require("../src/usage-api-ledger.cjs");
const usageLedger = require("../src/usage-ledger.cjs");
const workerAdapter = require("../src/worker-adapter.cjs");

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
const providerTextResult = reviewBot.requireProviderReviewText(
  { text: "\n**Verdict**: Good to merge\n", usage: { totalTokens: 12 } },
  settings
);
assert.equal(providerTextResult.text, "**Verdict**: Good to merge");
assert.throws(
  () => reviewBot.requireProviderReviewText({ text: "   " }, settings),
  /returned empty review output/
);
assert.deepEqual(docsLinkCheck.markdownLinkTargets("[Release](docs/release.md)"), ["docs/release.md"]);
assert.equal(docsLinkCheck.normalizeLocalLinkTarget("docs/release.md#tagging"), "docs/release.md");
assert.equal(docsLinkCheck.normalizeLocalLinkTarget("https://example.com"), "");
assert.equal(
  docsLinkCheck.checkMarkdownLinks("README.md", "[Missing](docs/nope.md)\n")[0].message,
  "broken local link 'docs/nope.md'"
);
const catalog = modelCatalog.loadModelCatalog();
assert.equal(catalog.providers.anthropic.defaultModel, "claude-opus-4-8");
assert.equal(modelCatalog.defaultModelForProvider("openrouter"), "");
assert.equal(
  modelCatalog.defaultModelForProvider("anthropic", {
    REVIEW_DEFAULT_ANTHROPIC_MODEL: "claude-opus-next",
  }),
  "claude-opus-next"
);
const modelPriceFile = modelPrices.validateModelPriceFile({
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
      notes: "test price row",
    },
  ],
});
assert.equal(modelPriceFile.prices[0].provider, "anthropic");
assert.equal(modelPriceFile.prices[0].sourceCheckedAt, "2026-06-12T12:00:00.000Z");
const modelPriceStatements = modelPrices.modelPriceStatements("reviewbot", modelPriceFile);
assert.equal(modelPriceStatements.length, 2);
assert.match(modelPrices.renderModelPriceSql("reviewbot", modelPriceFile), /ai_model_prices/);
assert.match(modelPrices.renderModelPriceSql("reviewbot", modelPriceFile), /source_checked_at/);
const currentPriceStatement = modelPrices.currentModelPriceStatement("reviewbot", {
  provider: "anthropic",
  model: "claude-opus-4-8",
  at: "2026-06-12T01:00:00.000Z",
});
assert.match(currentPriceStatement.sql, /effective_from <= cast\(:at_ts as timestamptz\)/);
assert.equal(
  currentPriceStatement.parameters.find((param) => param.name === "model").value.stringValue,
  "claude-opus-4-8"
);
const modelPriceRecord = [
  { stringValue: "anthropic" },
  { stringValue: "claude-opus-4-8" },
  { stringValue: "1" },
  { stringValue: "0.1" },
  { stringValue: "2" },
  { stringValue: "3" },
  { stringValue: "USD" },
  { stringValue: "2026-06-12 00:00:00+00" },
  { isNull: true },
  { stringValue: "https://example.com/provider-pricing" },
  { stringValue: "2026-06-12 12:00:00+00" },
  { stringValue: "test price row" },
];
assert.equal(modelPrices.modelPriceFromRecord(modelPriceRecord).cachedInputUsdPerMillion, 0.1);
assert.equal(
  modelPrices.modelPriceFromRecord(modelPriceRecord).sourceCheckedAt,
  "2026-06-12 12:00:00+00"
);
assert.equal(
  modelPrices.estimateUsageCostUsd(
    { inputTokens: 1000, cachedInputTokens: 250, outputTokens: 500, reasoningTokens: 100 },
    modelPrices.modelPriceFromRecord(modelPriceRecord)
  ),
  0.002075
);
assert.equal(
  modelPrices.estimateUsageCostUsd(
    { inputTokens: 1000, outputTokens: 500 },
    { currency: "USD", inputUsdPerMillion: 1 }
  ),
  null
);
assert.throws(
  () =>
    modelPrices.assertNoZeroPriceRows({
      version: 1,
      currency: "USD",
      prices: [
        {
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputUsdPerMillion: 0,
          outputUsdPerMillion: 1,
          effectiveFrom: "2026-06-12T00:00:00.000Z",
          sourceUrl: "https://example.com/provider-pricing",
          sourceCheckedAt: "2026-06-12T12:00:00.000Z",
        },
      ],
    }),
  /zero inputUsdPerMillion/
);
assert.equal(
  modelPrices.staleModelPriceSources(modelPriceFile, {
    now: "2026-06-20T12:00:00.000Z",
    maxSourceAgeDays: 30,
  }).length,
  0
);
assert.equal(
  modelPrices.staleModelPriceSources(modelPriceFile, {
    now: "2026-07-20T12:00:00.000Z",
    maxSourceAgeDays: 30,
  })[0].ageDays,
  38
);
assert.throws(
  () =>
    modelPrices.assertFreshModelPriceSources(modelPriceFile, {
      now: "2026-07-20T12:00:00.000Z",
      maxSourceAgeDays: 30,
    }),
  /outside freshness policy/
);
assert.match(
  modelPrices.describeFreshnessIssue(
    modelPrices.staleModelPriceSources(modelPriceFile, {
      now: "2026-06-10T12:00:00.000Z",
      maxSourceAgeDays: 30,
    })[0]
  ),
  /sourceCheckedAt is in the future/
);
assert.throws(
  () =>
    modelPrices.validateModelPriceFile({
      version: 1,
      currency: "USD",
      prices: [
        {
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputUsdPerMillion: 1,
          effectiveFrom: "2026-06-12T00:00:00.000Z",
          sourceUrl: "https://example.com/provider-pricing",
        },
      ],
    }),
  /sourceCheckedAt/
);
let priceLookupSql = "";
const lookedUpPrice = modelPrices.readCurrentModelPrice({
  enabled: true,
  region: "us-east-1",
  resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
  database: "reviewbot",
  schema: "reviewbot",
}, {
  provider: "anthropic",
  model: "claude-opus-4-8",
  at: "2026-06-12T01:00:00.000Z",
}, {
  executeStatement: (settings, sql, parameters, options) => {
    priceLookupSql = sql;
    assert.equal(settings.schema, "reviewbot");
    assert.equal(options.tempPrefix, "6529-model-price-read-");
    assert(parameters.some((param) => param.name === "at_ts"));
    return { records: [modelPriceRecord] };
  },
});
assert.match(priceLookupSql, /ai_model_prices/);
assert.equal(lookedUpPrice.outputUsdPerMillion, 2);
assert.equal(
  reviewBot.estimateUsageCostForRecord(
    {
      provider: "anthropic",
      model: "claude-opus-4-8",
      usageLedger: {
        enabled: true,
        failClosed: false,
        region: "us-east-1",
        resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
        secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
        database: "reviewbot",
        schema: "reviewbot",
      },
    },
    { inputTokens: 1000, outputTokens: 500 },
    {
      actualCostUsd: 0.12,
    }
  ),
  null
);
assert.equal(
  reviewBot.estimateUsageCostForRecord(
    {
      provider: "anthropic",
      model: "claude-opus-4-8",
      usageLedger: {
        enabled: true,
        failClosed: false,
        region: "us-east-1",
        resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
        secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
        database: "reviewbot",
        schema: "reviewbot",
      },
    },
    { inputTokens: 1000, outputTokens: 500 },
    { actualCostUsd: null },
    { readCurrentModelPrice: () => modelPrices.modelPriceFromRecord(modelPriceRecord) }
  ),
  0.002
);
let appliedModelPriceStatements = 0;
modelPrices.applyModelPrices({
  enabled: true,
  region: "us-east-1",
  resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
  database: "reviewbot",
  schema: "reviewbot",
}, modelPriceFile, {
  executeStatement: (settings, sql, parameters, options) => {
    assert.equal(settings.schema, "reviewbot");
    assert.match(sql, /ai_model_prices/);
    assert(parameters.some((param) => param.name === "provider"));
    assert.equal(options.tempPrefix, "6529-model-prices-");
    appliedModelPriceStatements += 1;
  },
  now: "2026-06-20T12:00:00.000Z",
});
assert.equal(appliedModelPriceStatements, 2);
assert.deepEqual(
  modelPricesCli.parseArgs(["--file", "prices.json", "--schema", "reviewbot", "--apply"]),
  {
    allowStaleSource: false,
    allowZeroPrice: false,
    apply: true,
    file: "prices.json",
    schema: "reviewbot",
  }
);
assert.deepEqual(
  modelPricesCli.parseArgs(["--file", "prices.json", "--apply", "--allow-zero-price"]),
  {
    allowStaleSource: false,
    allowZeroPrice: true,
    apply: true,
    file: "prices.json",
  }
);
assert.deepEqual(
  modelPricesCli.parseArgs([
    "--file",
    "prices.json",
    "--apply",
    "--allow-stale-source",
    "--max-source-age-days",
    "45",
  ]),
  {
    allowStaleSource: true,
    allowZeroPrice: false,
    apply: true,
    file: "prices.json",
    maxSourceAgeDays: 45,
  }
);
const budgetPolicyFile = budgetPolicies.validateBudgetPolicyFile({
  version: 1,
  currency: "USD",
  policies: [
    {
      scopeType: "global",
      scopeValue: "*",
      dailyUsd: 25,
      monthlyUsd: 500,
      notes: "dogfood global cap",
    },
    {
      scopeType: "provider",
      scopeValue: "Anthropic",
      dailyBudgetUsd: 10,
      enabled: true,
    },
  ],
});
assert.equal(budgetPolicyFile.policies[1].scopeValue, "anthropic");
assert.throws(
  () => budgetPolicies.validateBudgetPolicyFile({
    version: 1,
    policies: [{ scopeType: "repo", scopeValue: "bad", dailyUsd: 1 }],
  }),
  /repository full name/
);
assert.throws(
  () => budgetPolicies.validateBudgetPolicyFile({
    version: 1,
    policies: [{ scopeType: "global", scopeValue: "*", enabled: true }],
  }),
  /at least one budget cap/
);
assert.throws(
  () => budgetPolicies.validateBudgetPolicyFile({
    version: 1,
    policies: [{ scopeType: "global", scopeValue: "*", dailyUSD: 1 }],
  }),
  /unsupported key/
);
const budgetPolicyStatements = budgetPolicies.budgetPolicyStatements("reviewbot", budgetPolicyFile);
assert.equal(budgetPolicyStatements.length, 2);
assert.match(budgetPolicies.renderBudgetPolicySql("reviewbot", budgetPolicyFile), /ai_review_budget_policies/);
assert.equal(
  budgetPolicies.mergeBudgetPolicyRows({ mode: "enforce", explicitPolicies: [] }, budgetPolicyFile.policies)
    .explicitPolicies.length,
  2
);
let appliedBudgetPolicyStatements = 0;
budgetPolicies.applyBudgetPolicies({
  enabled: true,
  region: "us-east-1",
  resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
  database: "reviewbot",
  schema: "reviewbot",
}, budgetPolicyFile, {
  executeStatement: (settings, sql, parameters, options) => {
    assert.equal(settings.schema, "reviewbot");
    assert.match(sql, /ai_review_budget_policies/);
    assert(parameters.some((param) => param.name === "scope_type"));
    assert.equal(options.tempPrefix, "6529-budget-policies-");
    appliedBudgetPolicyStatements += 1;
  },
});
assert.equal(appliedBudgetPolicyStatements, 2);
assert.deepEqual(
  budgetPoliciesCli.parseArgs(["--file", "budgets.json", "--schema", "reviewbot", "--apply"]),
  { apply: true, file: "budgets.json", quiet: false, schema: "reviewbot" }
);
assert.deepEqual(
  budgetPoliciesCli.parseArgs(["--file", "budgets.json", "--quiet"]),
  { apply: false, file: "budgets.json", quiet: true }
);

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
assert.equal(typeof usageLedger.awsCliBin(), "string");
assert.equal(typeof budgetLedger.awsCliBin(), "string");
let usageWriteCall = null;
const usageWriteResult = usageLedger.writeUsageEvent(
  {
    enabled: true,
    failClosed: true,
    region: "us-east-1",
    resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
    secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
    database: "reviewbot",
    schema: "reviewbot",
  },
  {
    repoFullName: "6529-Collections/example",
    prNumber: 12,
    prAuthor: "maintainer",
    prHeadSha: "abc123",
    workflowRunId: "run-1",
    workflowJob: "review",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    lane: "anthropic:claude-opus-4-8",
    requestId: "request-1",
    providerResponseId: "response-1",
    inputTokens: 10,
    outputTokens: 5,
    estimatedCostUsd: 0.01,
    metadata: { requestor: "maintainer" },
  },
  console.warn,
  {
    executeStatement: (settings, sql, parameters, options) => {
      usageWriteCall = { settings, sql, parameters, options };
      return {};
    },
  }
);
assert.equal(usageWriteResult.skipped, false);
assert.match(usageWriteCall.sql, /ai_review_usage_events/);
assert.equal(usageWriteCall.options.tempPrefix, "6529-usage-ledger-");
assert.equal(
  usageWriteCall.parameters.find((param) => param.name === "repo_full_name").value.stringValue,
  "6529-Collections/example"
);
const jobLedgerSettings = jobLedger.jobLedgerSettingsFromEnv({
  REVIEWBOT_JOB_LEDGER_ENABLED: "true",
  REVIEW_USAGE_AWS_REGION: "us-east-1",
  REVIEW_USAGE_DB_RESOURCE_ARN: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  REVIEW_USAGE_DB_SECRET_ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
  REVIEW_USAGE_DB_NAME: "reviewbot",
  REVIEW_USAGE_DB_SCHEMA: "reviewbot",
});
assert.equal(jobLedgerSettings.enabled, true);
const jobInsert = jobLedger.buildJobEventInsert("reviewbot", {
  jobId: "rj_test",
  status: "budget_admitted",
  stage: "budget",
  repoFullName: "6529-Collections/example",
  prNumber: 12,
  reviewKind: "general",
  provider: "anthropic",
  model: "claude-opus-4-8",
  metadata: { budgetCode: "within_budget" },
});
assert.match(jobInsert.sql, /ai_review_job_events/);
assert.equal(
  jobInsert.parameters.find((param) => param.name === "job_id").value.stringValue,
  "rj_test"
);
assert.throws(
  () => jobLedger.buildJobEventInsert("reviewbot", { status: "dispatch_failed" }),
  /missing required fields/
);
let capturedJobLedgerWrite = null;
const jobWriteResult = jobLedger.writeJobEvent(
  jobLedgerSettings,
  {
    jobId: "rj_test",
    status: "dispatch_accepted",
    stage: "dispatch",
    repoFullName: "6529-Collections/example",
    prNumber: 12,
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    accepted: true,
  },
  {
    executeStatement: (settings, sql, parameters, options) => {
      capturedJobLedgerWrite = { settings, sql, parameters, options };
      return {};
    },
  }
);
assert.equal(jobWriteResult.skipped, false);
assert.equal(capturedJobLedgerWrite.options.tempPrefix, "6529-job-ledger-");
const renderedLedgerSchema = ledgerSchema.renderLedgerSchema("reviewbot");
assert.match(renderedLedgerSchema, /ai_review_usage_events/);
assert.match(renderedLedgerSchema, /ai_review_job_events/);
assert.match(renderedLedgerSchema, /ai_review_run_claims/);
assert.match(renderedLedgerSchema, /alter table "reviewbot"\.ai_model_prices/);
assert.match(renderedLedgerSchema, /add column if not exists source_url text/);
assert.match(renderedLedgerSchema, /add column if not exists source_checked_at timestamptz/);
assert.match(renderedLedgerSchema, /alter table "reviewbot"\.ai_review_budget_policies/);
assert.match(renderedLedgerSchema, /set scope_type = 'requestor'\s+where scope_type = 'requester'/);
assert.match(renderedLedgerSchema, /drop constraint if exists ai_review_budget_policies_scope_type_check/);
assert.match(
  renderedLedgerSchema,
  /scope_type in \('global', 'org', 'repo', 'requestor', 'pr', 'provider', 'model', 'review_kind'\)/
);
assert.match(renderedLedgerSchema, /drop view if exists "reviewbot"\.daily_ai_review_spend_by_requester/);
assert.match(renderedLedgerSchema, /daily_ai_review_spend_by_requester/);
assert.throws(() => ledgerSchema.ledgerSchemaStatements("reviewbot;drop"), /Invalid SQL identifier/);
let appliedSchemaStatements = 0;
ledgerSchema.applyLedgerSchema(jobLedgerSettings, {
  schema: "reviewbot",
  executeStatement: (settings, sql, parameters, options) => {
    assert.equal(settings.schema, "reviewbot");
    assert.equal(parameters.length, 0);
    assert.equal(options.tempPrefix, "6529-ledger-schema-");
    assert.match(sql, /reviewbot/);
    appliedSchemaStatements += 1;
    return {};
  },
});
assert.equal(appliedSchemaStatements, ledgerSchema.ledgerSchemaStatements("reviewbot").length);
assert.deepEqual(
  applyLedgerSchemaCli.parseArgs(["--schema", "reviewbot", "--apply"]),
  { apply: true, schema: "reviewbot" }
);
const preflightEnv = {
  GITHUB_WEBHOOK_SECRET: "secret",
  REVIEW_PROVIDER: "anthropic",
  REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8",
  REVIEWBOT_WORKER_ADAPTER: "noop",
  REVIEW_USAGE_ENABLED: "false",
  REVIEWBOT_JOB_LEDGER_ENABLED: "false",
  REVIEWBOT_ALERTS_ENABLED: "false",
  REVIEWBOT_ADMIN_AUTH_MODE: "disabled",
};
const preflightResult = preflight.runPreflight({ env: preflightEnv });
assert.equal(preflightResult.ok, true);
assert.equal(preflightResult.errors.length, 0);
assert(preflightResult.warnings.some((warning) => warning.name === "worker_adapter"));
assert(preflightResult.warnings.some((warning) => warning.name === "webhook"));
assert.equal(preflight.runPreflight({ env: preflightEnv, strict: true }).ok, false);
assert(
  preflight
    .runPreflight({ env: { ...preflightEnv, REVIEWBOT_ENABLED: "false" } })
    .warnings.some((warning) => warning.name === "runtime_control")
);
assert.equal(preflight.runPreflight({ env: {} }).errors[0].name, "webhook");
assert(
  preflight
    .runPreflight({
      env: {
        ...preflightEnv,
        REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED: "true",
      },
    })
    .errors.some((error) => error.name === "run_control")
);
assert.match(preflight.formatPreflightResult(preflightResult), /preflight: ok/);
assert.deepEqual(
  preflightCli.parseArgs(["--profile", "worker", "--json", "--strict"]),
  { json: true, profile: "worker", strict: true }
);
assert(
  preflight
    .runPreflight({
      env: {
        ...preflightEnv,
        REVIEWBOT_WORKER_ADAPTER: "local",
      },
    })
    .errors.some((error) => error.name === "provider_keys")
);
assert(
  preflight
    .runPreflight({
      env: {
        ...preflightEnv,
        REVIEWBOT_WORKER_ADAPTER: "github_actions",
        REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
      },
    })
    .warnings.some((warning) => warning.message.includes("fall back to the gh CLI"))
);
assert(
  preflight
    .runPreflight({
      env: {
        ...preflightEnv,
        REVIEWBOT_WORKER_ADAPTER: "github_actions",
        REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
        REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
      },
    })
    .errors.some((error) => error.name === "worker_adapter")
);
const configuredUsageLedgerPreflight = preflight.runPreflight({
  env: {
    ...preflightEnv,
    REVIEW_USAGE_ENABLED: "true",
    REVIEW_USAGE_DB_RESOURCE_ARN: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
    REVIEW_USAGE_DB_SECRET_ARN:
      "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot-db",
  },
});
assert.equal(
  configuredUsageLedgerPreflight.errors.some((error) => error.name === "usage_ledger"),
  false
);
const appDispatchPreflight = preflight.runPreflight({
  env: {
    ...preflightEnv,
    REVIEWBOT_GITHUB_APP_ID: "12345",
    REVIEWBOT_GITHUB_APP_PRIVATE_KEY: "configured",
    REVIEWBOT_WORKER_ADAPTER: "github_actions",
    REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
    REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
    REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "777",
  },
});
assert.equal(
  appDispatchPreflight.errors.some((error) => error.name === "worker_adapter"),
  false
);
assert.equal(
  appDispatchPreflight.checks.find((check) => check.name === "worker_adapter")
    .githubInstallationIdConfigured,
  true
);
const splitDispatchAppPreflight = preflight.runPreflight({
  env: {
    ...preflightEnv,
    REVIEWBOT_WORKER_GITHUB_APP_ID: "12345",
    REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY: "configured",
    REVIEWBOT_WORKER_ADAPTER: "github_actions",
    REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
    REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
    REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "777",
  },
});
assert.equal(
  splitDispatchAppPreflight.errors.some((error) => error.name === "worker_adapter"),
  false
);
assert.equal(
  dataApi.isRetriableDataApiError({ stderr: "DatabaseResumingException: please retry" }),
  true
);
const supportEnv = {
  REVIEW_PROVIDER: "anthropic",
  REVIEWBOT_MODEL_CATALOG_PATH: path.resolve("/private/model-catalog.json"),
  REVIEWBOT_WORKER_ADAPTER: "noop",
  REVIEWBOT_WORKER_GITHUB_REPO: "private-org/private-worker",
  ANTHROPIC_API_KEY: "secret-key",
  REVIEW_USAGE_DB_RESOURCE_ARN: "arn:aws:rds:us-east-1:123456789012:cluster:secret",
  GITHUB_WEBHOOK_SECRET: "",
};
const supportSummary = supportBundle.environmentSummary(supportEnv);
assert.equal(supportSummary.safe.REVIEW_PROVIDER, "anthropic");
assert.equal(supportSummary.safe.REVIEWBOT_MODEL_CATALOG_PATH, "[absolute-path-set]");
assert.equal(
  supportBundle.safeEnvValue("REVIEWBOT_MODEL_CATALOG_PATH", "C:\\private\\model-catalog.json"),
  "[absolute-path-set]"
);
assert.equal(supportSummary.safe.REVIEWBOT_WORKER_GITHUB_REPO, undefined);
assert.equal(supportSummary.presence.REVIEWBOT_WORKER_GITHUB_REPO, "set");
assert.equal(supportSummary.presence.ANTHROPIC_API_KEY, "set");
assert.equal(supportSummary.presence.GITHUB_WEBHOOK_SECRET, "unset");
assert.equal(JSON.stringify(supportSummary).includes("secret-key"), false);
assert.equal(JSON.stringify(supportSummary).includes("private-org/private-worker"), false);
const collectedSupportBundle = supportBundle.collectSupportBundle({
  env: {
    ...supportEnv,
    GITHUB_WEBHOOK_SECRET: "configured",
  },
  now: new Date("2026-06-12T00:00:00.000Z"),
  execFileSync: (bin, args) => {
    if (args[0] === "rev-parse") {
      return "abc123\n";
    }
    if (args[0] === "branch") {
      return "main\n";
    }
    return "";
  },
});
assert.equal(collectedSupportBundle.git.commit, "abc123");
assert.equal(collectedSupportBundle.environment.presence.GITHUB_WEBHOOK_SECRET, "set");
assert.match(supportBundle.formatSupportBundleMarkdown(collectedSupportBundle), /Support Bundle/);
assert.deepEqual(supportBundleCli.parseArgs(["--json", "--include-git-status", "--quiet"]), {
  includeGitStatus: true,
  json: true,
  quiet: true,
});
assert.equal(publicArtifactsCheck.isPublicTextArtifact("docs/release.md"), true);
assert.equal(publicArtifactsCheck.isPublicTextArtifact(".env.example"), true);
assert.equal(publicArtifactsCheck.isPublicTextArtifact("scripts/smoke-test.cjs"), false);
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "arn:aws:iam::123456789012:role/example\n").length,
  0
);
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "arn:aws:iam::111122223333:role/live\n")[0].rule,
  "aws_arn"
);
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "Account: 111122223333\n")[0].rule,
  "aws_account_id"
);
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwx123456\n")[0].rule,
  "github_token"
);
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwx123456\n")[0].rule,
  "provider_api_key"
);
assert.equal(
  publicArtifactsCheck.scanFile(
    "docs/example.md",
    "REVIEWBOT_ALERTS_WEBHOOK_URL=https://hooks.slack.com/services/T12345678/B12345678/abcdefghijklmnopqrstuvwxyz\n"
  )[0].rule,
  "alert_webhook_url"
);
assert.equal(
  publicArtifactsCheck.scanFile(
    "docs/example.md",
    "REVIEWBOT_ALERTS_WEBHOOK_URL=https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDE\n"
  )[0].rule,
  "alert_webhook_url"
);
const gates = releaseGates.loadReleaseGates("config/v0-release-gates.json");
assert.equal(gates.release, "v0.1.0");
assert(gates.gates.length >= 19);
assert.match(
  gates.gates.find((gate) => gate.id === "container-image").title,
  /built from a reviewed commit/
);
assert.match(
  gates.gates.find((gate) => gate.id === "model-prices").title,
  /fresh source-checked timestamps/
);
assert.match(releaseGates.renderReleaseGatesMarkdown(gates), /Release Gates/);
const gateStatus = releaseGates.loadReleaseGateStatus("config/v0-release-status.example.json");
const gatesWithStatus = releaseGates.mergeReleaseGateStatus(gates, gateStatus);
assert.equal(gatesWithStatus.gates.find((gate) => gate.id === "ledger-schema").status, "complete");
assert.match(releaseGates.renderReleaseGatesMarkdown(gatesWithStatus), /\[x\] \*\*ledger-schema\*\*/);
assert.match(releaseGates.renderReleaseGatesMarkdown(gatesWithStatus), /_\(deferred\)_/);
const missingGateStatusIds = releaseGates.missingReleaseGateStatusIds(gates, gateStatus);
assert(missingGateStatusIds.includes("container-image"));
assert.equal(missingGateStatusIds.includes("ledger-schema"), false);
assert.throws(
  () => releaseGates.mergeReleaseGateStatus(gates, gateStatus, { requireComplete: true }),
  /release gate status is missing/
);
const gateSummary = releaseGates.summarizeReleaseGates(gatesWithStatus);
assert.equal(gateSummary.ready, false);
assert.equal(gateSummary.complete, 1);
assert.equal(gateSummary.deferred, 1);
assert.equal(gateSummary.pending, gatesWithStatus.gates.length - 2);
assert.match(releaseGates.renderReleaseGateSummaryMarkdown(gatesWithStatus), /Ready to tag: no/);
const statusSkeleton = releaseGates.createReleaseGateStatusSkeleton(gates);
assert.equal(statusSkeleton.release, gates.release);
assert.equal(Object.keys(statusSkeleton.gates).length, gates.gates.length);
assert.equal(statusSkeleton.gates["github-app"].status, "pending");
const statusSkeletonDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-gates-"));
const statusSkeletonPath = path.join(statusSkeletonDir, "status.json");
releaseGates.writeReleaseGateStatusFile(statusSkeletonPath, statusSkeleton);
assert.equal(
  releaseGates.loadReleaseGateStatus(statusSkeletonPath).gates["github-app"].status,
  "pending"
);
assert.throws(
  () => releaseGates.writeReleaseGateStatusFile(statusSkeletonPath, statusSkeleton),
  /already exists/
);
releaseGates.writeReleaseGateStatusFile(statusSkeletonPath, statusSkeleton, { force: true });
assert.throws(
  () => releaseGates.assertReleaseGatesReady(gatesWithStatus),
  /release gates are not ready/
);
const completeGateStatus = {
  version: 1,
  release: gates.release,
  gates: Object.fromEntries(
    gates.gates.map((gate) => [
      gate.id,
      {
        status: "complete",
        evidence: `Private operator evidence: ${gate.id}.`,
      },
    ])
  ),
};
const readyGates = releaseGates.mergeReleaseGateStatus(gates, completeGateStatus, {
  requireComplete: true,
});
assert.equal(releaseGates.assertReleaseGatesReady(readyGates).ready, true);
assert.throws(
  () => releaseGates.validateReleaseGates({
    version: 1,
    release: "v0.1.0",
    description: "bad",
    gates: [
      { id: "dup", title: "one", evidence: "x" },
      { id: "dup", title: "two", evidence: "y" },
    ],
  }),
  /duplicated/
);
assert.throws(
  () => releaseGates.mergeReleaseGateStatus(gates, {
    version: 1,
    release: "v0.1.0",
    gates: { missing: { status: "complete", evidence: "x" } },
  }),
  /unknown gate/
);
assert.throws(
  () => releaseGates.validateReleaseGateStatus({
    version: 1,
    gates: { "ledger-schema": { status: "complete" } },
  }),
  /evidence/
);
assert.deepEqual(
  releaseGatesCli.parseArgs([
    "--file",
    "gates.json",
    "--status-file",
    "status.json",
    "--json",
    "--quiet",
    "--summary",
    "--require-ready",
    "--init-status",
    "new-status.json",
    "--force",
  ]),
  {
    file: "gates.json",
    force: true,
    initStatusFile: "new-status.json",
    json: true,
    quiet: true,
    requireReady: true,
    summary: true,
    statusFile: "status.json",
  }
);
const renderedGitHubAppManifest = githubAppManifest.renderGitHubAppManifest({
  host: "https://reviewbot.example.com/",
});
assert.equal(renderedGitHubAppManifest.name, "6529bot");
assert.equal(
  renderedGitHubAppManifest.hook_attributes.url,
  "https://reviewbot.example.com/webhooks/github"
);
assert.equal(renderedGitHubAppManifest.default_permissions.members, "read");
assert(renderedGitHubAppManifest.default_events.includes("pull_request"));
assert.throws(
  () => githubAppManifest.renderGitHubAppManifest({ host: "http://reviewbot.example.com" }),
  /must use https/
);
assert.throws(
  () => githubAppManifest.renderGitHubAppManifest({ host: "https://reviewbot.example.com/path" }),
  /must not include a path/
);
const githubAppManifestForm = githubAppManifest.renderGitHubAppRegistrationForm({
  manifest: renderedGitHubAppManifest,
  owner: "6529-Collections",
  state: "test-state",
});
assert.match(githubAppManifestForm, /organizations\/6529-Collections\/settings\/apps\/new/);
assert.match(githubAppManifestForm, /state=test-state/);
assert.match(githubAppManifestForm, /&quot;name&quot;:&quot;6529bot&quot;/);
assert.deepEqual(
  githubAppManifestCli.parseArgs([
    "--host",
    "https://reviewbot.example.com",
    "--form",
    "--owner",
    "6529-Collections",
    "--state",
    "test-state",
  ]),
  {
    form: true,
    host: "https://reviewbot.example.com",
    name: "",
    owner: "6529-Collections",
    quiet: false,
    state: "test-state",
    template: githubAppManifest.DEFAULT_GITHUB_APP_MANIFEST_TEMPLATE_PATH,
  }
);
assert.equal(
  githubAppManifestConversion.normalizeManifestCode(
    "https://reviewbot.example.com/github-app/manifest-complete?state=test&code=abc_123-XYZ"
  ),
  "abc_123-XYZ"
);
assert.throws(
  () => githubAppManifestConversion.resolvePrivateOutputPath("private-app.json", {
    cwd: path.resolve(__dirname, ".."),
    repoRoot: path.resolve(__dirname, ".."),
  }),
  /Refusing to write/
);
assert.deepEqual(
  githubAppManifestConversionCli.parseArgs([
    "--code",
    "abc123",
    "--output",
    "C:\\private\\6529bot-app.json",
    "--token-env",
    "GH_TOKEN",
    "--json",
    "--overwrite",
  ]),
  {
    allowRepoOutput: false,
    apiUrl: "",
    code: "abc123",
    json: true,
    noAuth: false,
    outputPath: "C:\\private\\6529bot-app.json",
    overwrite: true,
    timeoutMs: 0,
    tokenEnv: "GH_TOKEN",
  }
);
assert.equal(
  githubAppManifestConversionCli.resolveToken(
    { noAuth: false, tokenEnv: "CUSTOM_TOKEN" },
    { token: "settings-token" },
    { CUSTOM_TOKEN: "custom-token" }
  ),
  "custom-token"
);

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
assert.doesNotThrow(() =>
  githubWebhook.assertGitHubWebhookSignature(
    webhookSecret,
    webhookBody,
    new Headers({ "x-hub-signature-256": webhookSignature })
  )
);
assert.throws(
  () => githubWebhook.assertGitHubWebhookSignature(webhookSecret, webhookBody, {}),
  /Invalid GitHub webhook signature/
);

const normalizedPullRequest = githubWebhook.normalizeGitHubWebhook(
  new Headers({
    "x-github-event": "pull_request",
    "x-github-delivery": "delivery-1",
  }),
  JSON.parse(webhookBody.toString("utf8"))
);
assert.equal(normalizedPullRequest.kind, "pull_request");
assert.equal(normalizedPullRequest.shouldEnqueue, true);
assert.deepEqual(normalizedPullRequest.reviewKinds, ["general", "wcag", "i18n", "security"]);
assert.equal(
  repositoryConfig.repositoryConfigRefForEvent(normalizedPullRequest),
  "def456"
);
const githubAppKey = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const githubAppPrivateKey = githubAppKey.export({ type: "pkcs1", format: "pem" });
const githubAppSettings = githubAppAuth.githubAppAuthSettingsFromEnv({
  REVIEWBOT_GITHUB_APP_ID: "12345",
  REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS: "5000",
  REVIEWBOT_GITHUB_APP_PRIVATE_KEY: githubAppPrivateKey.replace(/\n/g, "\\n"),
});
assert.equal(githubAppAuth.isGitHubAppAuthConfigured(githubAppSettings), true);
assert.equal(githubAppSettings.fetchTimeoutMs, 5000);
assert.equal(githubAppAuth.createGitHubAppJwt(githubAppSettings).split(".").length, 3);
assert.equal(githubAppInstallationToken.parseArgs([]).profile, "main");
assert.deepEqual(
  githubAppInstallationToken.parseArgs([
    "--installation-id",
    "99",
    "--profile",
    "worker-dispatch",
    "--github-actions-output",
  ]),
  {
    githubActionsOutput: true,
    installationId: "99",
    profile: "worker-dispatch",
  }
);
assert.throws(
  () => githubAppInstallationToken.parseArgs(["--installation-id", "--github-actions-output"]),
  /requires a value/
);
assert.throws(
  () => githubAppInstallationToken.parseArgs(["--profile", "unknown"]),
  /must be one of/
);
assert.equal(
  githubAppInstallationToken.installationIdFromEnv("worker-dispatch", {
    REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "777",
    REVIEWBOT_GITHUB_INSTALLATION_ID: "99",
  }),
  "777"
);
assert.equal(
  githubAppInstallationToken.githubAppAuthSettingsForProfile("worker-dispatch", {
    REVIEWBOT_WORKER_GITHUB_APP_ID: "dispatch-app",
    REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY: githubAppPrivateKey,
  }).appId,
  "dispatch-app"
);
const githubAppConfigText = Buffer.from("enabled: false\n").toString("base64");
const githubAppIntegration = githubAppAuth.createGitHubAppIntegration({
  settings: githubAppSettings,
  fetchImpl: async (url, options = {}) => {
    const urlText = String(url);
    assert.equal(typeof options.signal?.aborted, "boolean");
    if (urlText.endsWith("/app/installations/99/access_tokens")) {
      assert.match(options.headers.authorization, /^Bearer /);
      return {
        ok: true,
        status: 201,
        json: async () => ({
          token: "installation-token",
          expires_at: "2026-06-12T03:00:00.000Z",
        }),
      };
    }
    assert.equal(options.headers.authorization, "Bearer installation-token");
    if (urlText.includes("/collaborators/maintainer/permission")) {
      return { ok: true, status: 200, json: async () => ({ permission: "write" }) };
    }
    if (urlText.includes("/orgs/6529-Collections/members/maintainer")) {
      return { ok: true, status: 204, json: async () => ({}) };
    }
    if (urlText.includes("/contents/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: "file",
          encoding: "base64",
          content: githubAppConfigText,
        }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  },
});
const githubActorContextPromise = githubAppIntegration.resolveActorContext(normalizedPullRequest);
const githubRepoConfigPromise = githubAppIntegration.loadRepositoryConfig(normalizedPullRequest, {
  policy: repositoryConfig.repositoryConfigPolicyFromEnv({
    REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "github",
  }),
});
const githubMembershipFailurePromise = githubAppAuth.createGitHubAppIntegration({
  settings: githubAppSettings,
  fetchImpl: async (url, options = {}) => {
    const urlText = String(url);
    assert.equal(typeof options.signal?.aborted, "boolean");
    if (urlText.endsWith("/app/installations/99/access_tokens")) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ token: "installation-token" }),
      };
    }
    if (urlText.includes("/collaborators/maintainer/permission")) {
      return { ok: true, status: 200, json: async () => ({ permission: "write" }) };
    }
    if (urlText.includes("/orgs/6529-Collections/members/maintainer")) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  },
}).resolveActorContext(normalizedPullRequest);
let disabledConfigRequestedToken = false;
const disabledGithubRepoConfigPromise = githubAppAuth.createGitHubAppIntegration({
  settings: githubAppSettings,
  fetchImpl: async (url) => {
    if (String(url).endsWith("/app/installations/99/access_tokens")) {
      disabledConfigRequestedToken = true;
    }
    return { ok: false, status: 500, json: async () => ({}) };
  },
}).loadRepositoryConfig(normalizedPullRequest, {
  policy: repositoryConfig.repositoryConfigPolicyFromEnv({
    REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "none",
  }),
});

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
assert.equal(replayWebhook.inferEventName(JSON.parse(webhookBody.toString("utf8"))), "pull_request");
assert.equal(replayWebhook.parsePayload(Buffer.from(`\uFEFF${webhookBody}`)).action, "opened");
assert.equal(replayWebhook.normalizePayloadBody(Buffer.from(`\uFEFF${webhookBody}`))[0], 123);
assert.deepEqual(
  replayWebhook.parseArgs([
    "--payload",
    "payload.json",
    "--actor-permission",
    "write",
    "--assume-empty-budget",
    "--estimated-cost-usd",
    "0.25",
  ]),
  {
    dispatch: false,
    assumeEmptyBudget: true,
    orgMember: false,
    payloadPath: "payload.json",
    actorPermission: "write",
    estimatedCostUsd: 0.25,
  }
);

const parsedRepoConfig = repositoryConfig.parseRepositoryConfigText(`
version: 1
enabled: true
reviewKinds:
  allowed: [general, security, followup]
  initial: [general, security]
  followup: [followup]
commands:
  enabled: true
lanes:
  - provider: anthropic
    model: claude-opus-4-8
  - openai:gpt-5.5
limits:
  maxJobsPerDelivery: 4
admission:
  publicRepoMode: trusted
  trustedUsers: [trusted-maintainer]
  denyUsers: [blocked-user]
budget:
  mode: enforce
  defaultEstimatedCostUsd: 2
  caps:
    repo:
      dailyUsd: 5
`, ".github/6529bot.yml");
assert.deepEqual(parsedRepoConfig.reviewKinds.initial, ["general", "security"]);
assert.equal(parsedRepoConfig.lanes.length, 2);
assert.equal(parsedRepoConfig.limits.maxJobsPerDelivery, 4);
assert.equal(parsedRepoConfig.budget.caps.repo.dailyBudgetUsd, 5);
assert.throws(
  () => repositoryConfig.parseRepositoryConfigText("unknownKey: true", ".github/6529bot.yml"),
  /unsupported key/
);
assert.throws(
  () =>
    repositoryConfig.repositoryConfigPolicyFromEnv({
      REVIEWBOT_REPOSITORY_CONFIG_PATHS: "../bad.yml",
    }),
  /Invalid repository config path/
);
const configuredPullRequest = repositoryConfig.applyRepositoryConfigToEvent(
  normalizedPullRequest,
  parsedRepoConfig
);
assert.deepEqual(configuredPullRequest.reviewKinds, ["general", "security"]);
const disabledPullRequest = repositoryConfig.applyRepositoryConfigToEvent(
  normalizedPullRequest,
  { ...parsedRepoConfig, enabled: false }
);
assert.equal(disabledPullRequest.shouldEnqueue, false);

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

const twoLanePolicy = reviewJob.reviewJobPolicyFromEnv({
  REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8,openai:gpt-5.5,anthropic:claude-opus-4-8",
  REVIEWBOT_MAX_JOBS_PER_DELIVERY: "20",
});
// Explicit REVIEWBOT_REVIEW_LANES entries should not need a valid
// REVIEWBOT_MODEL_CATALOG_PATH because the provider/model pair is complete.
assert.deepEqual(
  reviewJob.reviewJobPolicyFromEnv({
    REVIEWBOT_REVIEW_LANES: "openrouter:anthropic/claude-sonnet-4",
    REVIEWBOT_MODEL_CATALOG_PATH: "missing-model-catalog.json",
  }).lanes.map((lane) => `${lane.provider}:${lane.model}`),
  ["openrouter:anthropic/claude-sonnet-4"]
);
assert.deepEqual(
  twoLanePolicy.lanes.map((lane) => `${lane.provider}:${lane.model}`),
  ["anthropic:claude-opus-4-8", "openai:gpt-5.5"]
);
const reviewJobs = reviewJob.createReviewJobs(
  normalizedPullRequest,
  {
    admission: { requestor: "maintainer" },
    createdAt: "2026-06-11T00:00:00.000Z",
  },
  twoLanePolicy
);
assert.equal(reviewJobs.length, 8);
assert.equal(reviewJobs.filter((job) => job.reviewKind === "general").length, 2);
assert.equal(reviewJobs[0].requestor, "maintainer");
assert.equal(reviewJobs[0].provider, "anthropic");
assert.equal(reviewJobs[1].provider, "openai");
const globallyDisabledRuntime = runtimeControl.applyRuntimeControlToEvent(
  normalizedPullRequest,
  runtimeControl.runtimeControlPolicyFromEnv({
    REVIEWBOT_ENABLED: "false",
    REVIEWBOT_DISABLED_REASON: "paused for incident",
  })
);
assert.equal(globallyDisabledRuntime.event.shouldEnqueue, false);
assert.equal(globallyDisabledRuntime.control.code, "runtime_disabled");
const filteredRuntimeEvent = runtimeControl.applyRuntimeControlToEvent(
  normalizedPullRequest,
  runtimeControl.runtimeControlPolicyFromEnv({
    REVIEWBOT_DISABLED_REVIEW_KINDS: "wcag,i18n",
  })
);
assert.equal(filteredRuntimeEvent.event.shouldEnqueue, true);
assert.deepEqual(filteredRuntimeEvent.event.reviewKinds, ["general", "security"]);
assert.equal(filteredRuntimeEvent.control.status, "filtered");
const runtimeFilteredJobs = runtimeControl.filterRuntimeControlJobs(
  reviewJobs,
  runtimeControl.runtimeControlPolicyFromEnv({
    REVIEWBOT_DISABLED_PROVIDERS: "openai",
    REVIEWBOT_DISABLED_MODELS: "claude-opus-4-8",
  })
);
assert.equal(runtimeFilteredJobs.jobs.length, 0);
assert.equal(runtimeFilteredJobs.deniedJobs.length, reviewJobs.length);
assert.equal(runtimeFilteredJobs.deniedJobs[0].status, "runtime_disabled");
assert.equal(runtimeFilteredJobs.control.status, "denied");
const repoJobPolicy = repositoryConfig.mergeRepositoryJobPolicy(twoLanePolicy, parsedRepoConfig);
assert.equal(repoJobPolicy.maxJobsPerDelivery, 4);
assert.deepEqual(
  repoJobPolicy.lanes.map((lane) => `${lane.provider}:${lane.model}`),
  ["anthropic:claude-opus-4-8", "openai:gpt-5.5"]
);
const filteredJobPolicy = repositoryConfig.mergeRepositoryJobPolicy(twoLanePolicy, {
  ...parsedRepoConfig,
  lanes: reviewJob.parseReviewLanes("openrouter:anthropic/claude-sonnet-4"),
});
assert.equal(filteredJobPolicy.lanes.length, 0);
const replayedReviewJobs = reviewJob.createReviewJobs(normalizedPullRequest, {
  admission: { requestor: "maintainer" },
  createdAt: "2027-01-01T00:00:00.000Z",
}, twoLanePolicy);
assert.equal(reviewJobs[0].id, replayedReviewJobs[0].id);
const redeliveredReviewJobs = reviewJob.createReviewJobs(
  { ...normalizedPullRequest, deliveryId: "delivery-2" },
  {
    admission: { requestor: "maintainer" },
    createdAt: "2027-01-01T00:00:00.000Z",
  },
  twoLanePolicy
);
assert.notEqual(reviewJobs[0].id, redeliveredReviewJobs[0].id);
assert.equal(reviewJobs[0].runKey, redeliveredReviewJobs[0].runKey);
assert.notEqual(reviewJobs[0].runKey, reviewJobs[1].runKey);
const firstJobEvent = reviewJob.eventForReviewJob(normalizedPullRequest, reviewJobs[0]);
assert.deepEqual(firstJobEvent.reviewKinds, [reviewJobs[0].reviewKind]);
assert.equal(firstJobEvent.run.provider, reviewJobs[0].provider);
assert.equal(firstJobEvent.run.model, reviewJobs[0].model);
assert.equal(workerAdapter.jobEnv(reviewJobs[0]).GH_REPO, "6529-Collections/example");
assert.equal(workerAdapter.jobEnv(reviewJobs[0]).REVIEW_KIND, "general");
assert.equal(workerAdapter.jobEnv(reviewJobs[0]).REVIEWBOT_GITHUB_INSTALLATION_ID, "99");
assert.equal(workerAdapter.jobEnv(reviewJobs[0]).REVIEWBOT_RUN_KEY, reviewJobs[0].runKey);
assert.match(workerAdapter.reviewCommandArgs(reviewJobs[0])[0], /general-pr-review\.cjs$/);
const localWorkerResult = workerAdapter.runReviewJobLocally(reviewJobs[0], {
  policy: workerAdapter.workerAdapterPolicyFromEnv({
    REVIEWBOT_WORKER_ADAPTER: "local",
  }),
  includeOutput: true,
  localCommandArgs: [
    "-e",
    "process.stdout.write(`${process.env.REVIEW_KIND}:${process.env.GH_REPO}`)",
  ],
});
assert.equal(localWorkerResult.accepted, true);
assert.equal(localWorkerResult.claimStatus, "completed");
assert.equal(localWorkerResult.stdout, "general:6529-Collections/example");
assert.equal(
  workerAdapter.redactSensitiveText("Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890"),
  "Bearer [redacted]"
);
const redactedLocalWorkerResult = workerAdapter.runReviewJobLocally(reviewJobs[0], {
  policy: workerAdapter.workerAdapterPolicyFromEnv({
    REVIEWBOT_WORKER_ADAPTER: "local",
  }),
  includeOutput: true,
  localCommandArgs: [
    "-e",
    [
      "process.stdout.write('sk-ant-api03-secretvalue');",
      "process.stderr.write('github_pat_abcdefghijklmnopqrstuvwxyz1234567890');",
    ].join(""),
  ],
});
assert.equal(redactedLocalWorkerResult.accepted, true);
assert.equal(redactedLocalWorkerResult.stdout, "sk-[redacted]");
assert.equal(redactedLocalWorkerResult.stderr, "github_pat_[redacted]");
const failedLocalWorkerResult = workerAdapter.runReviewJobLocally(reviewJobs[0], {
  policy: workerAdapter.workerAdapterPolicyFromEnv({
    REVIEWBOT_WORKER_ADAPTER: "local",
  }),
  localCommandArgs: ["-e", "process.exit(1)"],
});
assert.equal(failedLocalWorkerResult.accepted, false);
assert.equal(failedLocalWorkerResult.claimStatus, "failed");
const workerClaimUpdates = [];
const lifecycleWorkerResult = runReviewJobCli.runJobWithClaimStatus(reviewJobs[0], {
  runControlSettings: { enabled: false },
  runReviewJobLocally: () => ({
    accepted: true,
    adapter: "local",
    exitCode: 0,
  }),
  updateWorkerRunClaim: (settings, job, status, metadata) => {
    workerClaimUpdates.push({ settings, job, status, metadata });
    return { skipped: false };
  },
});
assert.equal(lifecycleWorkerResult.accepted, true);
assert.deepEqual(workerClaimUpdates.map((item) => item.status), ["running", "completed"]);
let dispatchedWorkflow = null;
const forkReviewJob = { ...reviewJobs[0], headRepoFullName: "external/fork" };
const dispatchResult = workerAdapter.dispatchReviewJobToGitHubActions(forkReviewJob, {
  policy: {
    mode: "github_actions",
    githubRepo: "6529-Collections/6529reviewbot",
    githubWorkflow: "review-job.yml",
    githubRef: "main",
    ghBin: "gh",
    localTimeoutMs: 1234,
  },
  spawnSync: (bin, args, options) => {
    dispatchedWorkflow = { bin, args, options };
    return { status: 0, stdout: "queued", stderr: "" };
  },
});
assert.equal(dispatchResult.accepted, true);
assert.equal(dispatchedWorkflow.bin, "gh");
assert.equal(dispatchedWorkflow.options.timeout, 1234);
assert.deepEqual(
  workerAdapter.githubWorkflowFields(forkReviewJob).target_repo,
  "6529-Collections/example"
);
assert.deepEqual(workerAdapter.githubWorkflowFields(forkReviewJob).head_repo, "external/fork");
assert.equal(workerAdapter.githubWorkflowFields(forkReviewJob).installation_id, "99");
assert.equal(workerAdapter.githubWorkflowFields(forkReviewJob).run_key, forkReviewJob.runKey);
assert.equal(dispatchedWorkflow.args.includes("workflow"), true);
assert.equal(dispatchedWorkflow.args.includes("target_repo=6529-Collections/example"), true);
assert.equal(dispatchedWorkflow.args.includes(`run_key=${forkReviewJob.runKey}`), true);
assert.equal(dispatchedWorkflow.args.includes("installation_id=99"), true);
assert.equal(dispatchedWorkflow.args.includes("head_repo=external/fork"), true);
let apiDispatchRequest = null;
const apiDispatchResultPromise = workerAdapter.dispatchReviewJobToGitHubActions(forkReviewJob, {
  policy: workerAdapter.workerAdapterPolicyFromEnv({
    REVIEWBOT_WORKER_ADAPTER: "github_actions",
    REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
    REVIEWBOT_WORKER_GITHUB_WORKFLOW: "review-job.yml",
    REVIEWBOT_WORKER_GITHUB_REF: "main",
    REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
    REVIEWBOT_WORKER_GITHUB_TOKEN: "dispatch-token",
    REVIEWBOT_WORKER_GITHUB_API_URL: "https://api.github.test/",
    REVIEWBOT_WORKER_GITHUB_FETCH_TIMEOUT_MS: "1234",
  }),
  fetchImpl: async (url, options) => {
    apiDispatchRequest = {
      url,
      options,
      body: JSON.parse(options.body),
    };
    return { status: 204, text: async () => "" };
  },
  spawnSync: () => {
    throw new Error("API dispatch should not shell out to gh.");
  },
});
const missingApiTokenResultPromise = workerAdapter.dispatchReviewJobToGitHubActions(
  forkReviewJob,
  {
    policy: workerAdapter.workerAdapterPolicyFromEnv({
      REVIEWBOT_WORKER_ADAPTER: "github_actions",
      REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
      REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
    }),
  }
);
const failedApiDispatchResultPromise = workerAdapter.dispatchReviewJobToGitHubActions(
  forkReviewJob,
  {
    policy: workerAdapter.workerAdapterPolicyFromEnv({
      REVIEWBOT_WORKER_ADAPTER: "github_actions",
      REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
      REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
      REVIEWBOT_WORKER_GITHUB_TOKEN: "dispatch-token",
    }),
    fetchImpl: async () => ({
      status: 403,
      text: async () =>
        "bad token Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890 sk-ant-api03-secretvalue",
    }),
  }
);
let missingInstallationDispatchCalled = false;
const missingInstallationResult = workerAdapter.dispatchReviewJobToGitHubActions(
  { ...forkReviewJob, installationId: null },
  {
    policy: {
      mode: "github_actions",
      githubRepo: "6529-Collections/6529reviewbot",
      githubWorkflow: "review-job.yml",
      githubRef: "main",
      ghBin: "gh",
      localTimeoutMs: 1234,
    },
    spawnSync: () => {
      missingInstallationDispatchCalled = true;
      return { status: 0, stdout: "queued", stderr: "" };
    },
  }
);
assert.equal(missingInstallationResult.accepted, false);
assert.match(missingInstallationResult.reason, /installationId is required/);
assert.equal(missingInstallationDispatchCalled, false);
const noopQueuePromise = workerAdapter.enqueueReviewJobsWithAdapter([reviewJobs[0]], {}, {
  policy: { mode: "noop" },
});
const serverEntrypointOptions = serverCli.createServerOptionsFromEnv({
  REVIEWBOT_WORKER_ADAPTER: "noop",
  REVIEW_USAGE_ENABLED: "false",
});
const serverEntrypointQueuePromise = serverEntrypointOptions.enqueueReviewJobs([reviewJobs[0]], {});
let serverDispatchRequest = null;
const serverAppDispatchOptions = serverCli.createServerOptionsFromEnv(
  {
    REVIEWBOT_WORKER_GITHUB_APP_ID: "12345",
    REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY: githubAppPrivateKey.replace(/\n/g, "\\n"),
    REVIEWBOT_WORKER_GITHUB_APP_API_URL: "https://api.github.test",
    REVIEWBOT_WORKER_ADAPTER: "github_actions",
    REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
    REVIEWBOT_WORKER_GITHUB_WORKFLOW: "review-job.yml",
    REVIEWBOT_WORKER_GITHUB_REF: "main",
    REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
    REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "777",
    REVIEWBOT_WORKER_GITHUB_API_URL: "https://api.github.test",
    REVIEW_USAGE_ENABLED: "false",
  },
  {
    fetchImpl: async (url, options) => {
      if (String(url).endsWith("/app/installations/777/access_tokens")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            token: "server-installation-token",
            expires_at: "2026-06-12T13:00:00Z",
          }),
        };
      }
      if (String(url).includes("/actions/workflows/")) {
        serverDispatchRequest = {
          url,
          options,
          body: JSON.parse(options.body),
        };
        return { status: 204, text: async () => "" };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  }
);
const serverAppDispatchPromise = serverAppDispatchOptions.enqueueReviewJobs([forkReviewJob], {});
let serverMainAppDispatchRequest = null;
const serverMainAppDispatchOptions = serverCli.createServerOptionsFromEnv(
  {
    REVIEWBOT_GITHUB_APP_ID: "12345",
    REVIEWBOT_GITHUB_APP_PRIVATE_KEY: githubAppPrivateKey.replace(/\n/g, "\\n"),
    REVIEWBOT_GITHUB_APP_API_URL: "https://api.github.test",
    REVIEWBOT_WORKER_ADAPTER: "github_actions",
    REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
    REVIEWBOT_WORKER_GITHUB_WORKFLOW: "review-job.yml",
    REVIEWBOT_WORKER_GITHUB_REF: "main",
    REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
    REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "777",
    REVIEWBOT_WORKER_GITHUB_API_URL: "https://api.github.test",
    REVIEW_USAGE_ENABLED: "false",
  },
  {
    fetchImpl: async (url, options) => {
      if (String(url).endsWith("/app/installations/777/access_tokens")) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            token: "main-app-installation-token",
            expires_at: "2026-06-12T13:00:00Z",
          }),
        };
      }
      if (String(url).includes("/actions/workflows/")) {
        serverMainAppDispatchRequest = {
          url,
          options,
          body: JSON.parse(options.body),
        };
        return { status: 204, text: async () => "" };
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
  }
);
const serverMainAppDispatchPromise =
  serverMainAppDispatchOptions.enqueueReviewJobs([forkReviewJob], {});
assert.equal(serverCli.serverPortFromEnv({ REVIEWBOT_PORT: "8181" }), 8181);
assert.throws(() => serverCli.serverPortFromEnv({ PORT: "8080abc" }), /valid TCP port/);
assert.equal(
  reviewJob.publicReviewJobSummary({
    ...reviewJobs[0],
    status: "admitted",
    budget: { status: "allowed", allowed: true, code: "within_budget", estimatedCostUsd: 1 },
  }).budget.code,
  "within_budget"
);
assert.equal(
  reviewJob.budgetSummaryForJobs([
    { budget: { status: "allowed", allowed: true, code: "within_budget" } },
    { budget: { status: "denied", allowed: false, code: "budget_exceeded" } },
  ]).status,
  "partial"
);
assert.throws(
  () => reviewJob.createReviewJobs(normalizedPullRequest, {}, {
    ...twoLanePolicy,
    maxJobsPerDelivery: 2,
  }),
  /above REVIEWBOT_MAX_JOBS_PER_DELIVERY=2/
);
assert.equal(
  runControl.evaluateRunControl({
    job: reviewJobs[0],
    policy: runControl.runControlPolicyFromEnv({}),
    snapshot: { unavailable: true },
  }).code,
  "run_control_off"
);
const runControlPolicy = runControl.runControlPolicyFromEnv({
  REVIEWBOT_RUN_CONTROL_MODE: "enforce",
  REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT: "1",
});
const runControlDenied = runControl.evaluateRunControl({
  job: reviewJobs[0],
  policy: runControlPolicy,
  snapshot: {
    unavailable: false,
    active: {
      "repo:6529-Collections/example": 1,
    },
  },
});
assert.equal(runControlDenied.code, "concurrency_limit_exceeded");
assert.equal(runControlDenied.allowed, false);
assert.equal(
  runControl.evaluateRunControl({
    job: reviewJobs[0],
    policy: runControlPolicy,
    snapshot: {
      unavailable: false,
      duplicate: {
        runKey: reviewJobs[0].runKey,
        jobId: "older-job",
        status: "claimed",
      },
    },
  }).code,
  "duplicate_run"
);
assert.equal(
  runControl.evaluateRunControl({
    job: reviewJobs[0],
    policy: runControl.runControlPolicyFromEnv({
      REVIEWBOT_RUN_CONTROL_MODE: "warn",
      REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT: "1",
    }),
    snapshot: {
      unavailable: false,
      active: {
        "repo:6529-Collections/example": 1,
      },
    },
  }).allowed,
  true
);
const runControlLedgerSettings = runControlLedger.runControlLedgerSettingsFromEnv({
  REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED: "true",
  REVIEW_USAGE_AWS_REGION: "us-east-1",
  REVIEW_USAGE_DB_RESOURCE_ARN: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  REVIEW_USAGE_DB_SECRET_ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
  REVIEW_USAGE_DB_NAME: "reviewbot",
  REVIEW_USAGE_DB_SCHEMA: "reviewbot",
});
const runClaimQuery = runControlLedger.buildRunClaimQuery(
  "reviewbot",
  reviewJobs[0],
  runControlPolicy,
  { claimTtlSeconds: 60 }
);
assert.match(runClaimQuery.sql, /pg_advisory_xact_lock/);
assert.match(runClaimQuery.sql, /ai_review_run_claims/);
assert.equal(
  runClaimQuery.parameters.find((param) => param.name === "run_key").value.stringValue,
  reviewJobs[0].runKey
);
const runClaimUpdateQuery = runControlLedger.buildRunClaimStatusUpdate(
  "reviewbot",
  reviewJobs[0],
  "dispatch_failed",
  { metadata: { queueReason: "closed", ignored: { nested: true } } }
);
assert.match(runClaimUpdateQuery.sql, /completed_at/);
assert.equal(
  runClaimUpdateQuery.parameters.find((param) => param.name === "status").value.stringValue,
  "dispatch_failed"
);
assert.match(
  runClaimUpdateQuery.parameters.find((param) => param.name === "metadata").value.stringValue,
  /queueReason/
);
assert.equal(
  runControlLedger
    .buildRunClaimStatusUpdate("reviewbot", reviewJobs[0], "failed")
    .parameters.find((param) => param.name === "status").value.stringValue,
  "failed"
);
let updatedRunClaim = null;
const updateRunClaimResult = runControlLedger.updateRunClaimStatus(
  runControlLedgerSettings,
  reviewJobs[0],
  "dispatch_failed",
  {
    metadata: { queueReason: "closed" },
    executeStatement: (settings, sql, parameters, options) => {
      updatedRunClaim = { settings, sql, parameters, options };
      return {};
    },
  }
);
assert.equal(updateRunClaimResult.skipped, false);
assert.equal(updatedRunClaim.options.tempPrefix, "6529-run-control-update-");
const claimedDecisionPromise = runControlLedger.claimReviewJobWithLedger(
  runControlLedgerSettings,
  reviewJobs[0],
  { policy: runControlPolicy },
  {
    executeStatement: () => ({
      records: [
        [
          { stringValue: "claimed" },
          { stringValue: reviewJobs[0].runKey },
          { stringValue: reviewJobs[0].id },
          { stringValue: "claimed" },
          { stringValue: "2026-06-12T00:00:00.000Z" },
          { isNull: true },
          { stringValue: "[]" },
        ],
      ],
    }),
  }
);
const duplicateDecisionPromise = runControlLedger.claimReviewJobWithLedger(
  runControlLedgerSettings,
  reviewJobs[0],
  { policy: runControlPolicy },
  {
    executeStatement: () => ({
      records: [
        [
          { stringValue: "duplicate_run" },
          { stringValue: reviewJobs[0].runKey },
          { stringValue: "older-job" },
          { stringValue: "claimed" },
          { stringValue: "2026-06-12T00:00:00.000Z" },
          {
            stringValue: JSON.stringify({
              runKey: reviewJobs[0].runKey,
              jobId: "older-job",
              status: "claimed",
              createdAt: "2026-06-12T00:00:00.000Z",
            }),
          },
          { stringValue: "[]" },
        ],
      ],
    }),
  }
);
const concurrencyDecisionPromise = runControlLedger.claimReviewJobWithLedger(
  runControlLedgerSettings,
  reviewJobs[0],
  { policy: runControlPolicy },
  {
    executeStatement: () => ({
      records: [
        [
          { stringValue: "concurrency_limit_exceeded" },
          { isNull: true },
          { isNull: true },
          { isNull: true },
          { isNull: true },
          { isNull: true },
          {
            stringValue: JSON.stringify([
              {
                scopeType: "repo",
                scopeValue: "6529-Collections/example",
                active: 1,
                maxConcurrent: 1,
              },
            ]),
          },
        ],
      ],
    }),
  }
);
const disabledRunControlLedgerPromise = runControlLedger.claimReviewJobWithLedger(
  { ...runControlLedgerSettings, enabled: false },
  reviewJobs[0],
  { policy: runControlPolicy }
);

const usageEvents = [
  {
    createdAt: "2026-06-10T01:00:00.000Z",
    repoFullName: "6529-Collections/public-repo",
    prNumber: 10,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    totalTokens: 1000,
    actualCostUsd: 1.25,
  },
  {
    createdAt: "2026-06-10T02:00:00.000Z",
    repoFullName: "6529-Collections/private-repo",
    repoPrivate: true,
    prNumber: 11,
    metadata: { requestor: "admin" },
    reviewKind: "security",
    provider: "openai",
    model: "gpt-5.5",
    inputTokens: 500,
    outputTokens: 250,
    estimatedCostUsd: 0.75,
    budgetSkipped: true,
  },
];
const publicUsageSummary = usageApi.summarizeUsageEvents(usageEvents, {
  visibility: "public",
  range: { days: 7 },
});
assert.equal(publicUsageSummary.totals.reviewRuns, 2);
assert.equal(publicUsageSummary.totals.costUsd, 2);
assert.equal(publicUsageSummary.byRepo.some((item) => item.key === "private"), true);
assert.equal(Object.prototype.hasOwnProperty.call(publicUsageSummary, "byRequestor"), false);
const adminUsageSummary = usageApi.summarizeUsageEvents(usageEvents, {
  visibility: "admin",
  range: { days: 7 },
});
assert.equal(adminUsageSummary.byRequestor.some((item) => item.key === "admin"), true);
assert.equal(usageApi.publicBudgetPolicy({ scope_type: "repo", scope_value: "x", daily_budget_usd: "2" }).dailyBudgetUsd, 2);
const alertNow = new Date("2026-06-12T12:00:00.000Z");
const alertEvents = [
  {
    createdAt: "2026-06-12T11:00:00.000Z",
    repoFullName: "6529-Collections/example",
    prNumber: 12,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    actualCostUsd: 9,
  },
  {
    createdAt: "2026-06-11T11:00:00.000Z",
    repoFullName: "6529-Collections/example",
    prNumber: 11,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    actualCostUsd: 1,
  },
  {
    createdAt: "2026-06-10T11:00:00.000Z",
    repoFullName: "6529-Collections/example",
    prNumber: 10,
    requestor: "maintainer",
    reviewKind: "general",
    provider: "anthropic",
    model: "claude-opus-4-8",
    actualCostUsd: 1,
  },
];
const alertPolicy = spendAlerts.spendAlertPolicyFromEnv({
  REVIEWBOT_ALERTS_ENABLED: "true",
  REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT: "80",
  REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT: "100",
  REVIEWBOT_ALERTS_SPIKE_WINDOW_HOURS: "24",
  REVIEWBOT_ALERTS_SPIKE_BASELINE_DAYS: "2",
  REVIEWBOT_ALERTS_SPIKE_MULTIPLIER: "3",
  REVIEWBOT_ALERTS_SPIKE_MIN_USD: "5",
  REVIEWBOT_ALERTS_MAX_ALERTS: "10",
});
assert.throws(
  () =>
    spendAlerts.spendAlertPolicyFromEnv({
      REVIEWBOT_ALERTS_SPIKE_DIMENSIONS: "global,bad_dimension",
    }),
  /unsupported values/
);
const generatedAlerts = spendAlerts.evaluateSpendAlerts({
  events: alertEvents,
  budgetPolicies: [
    {
      scopeType: "repo",
      scopeValue: "6529-Collections/example",
      dailyBudgetUsd: 10,
      enabled: true,
    },
  ],
  now: alertNow,
  policy: alertPolicy,
});
assert.equal(
  generatedAlerts.some((alert) => alert.kind === "budget_utilization" && alert.severity === "warning"),
  true
);
assert.equal(
  generatedAlerts.some((alert) => alert.kind === "spend_spike" && alert.scopeType === "repo"),
  true
);
const jobHealthPolicy = jobHealthAlerts.jobHealthAlertPolicyFromEnv({
  REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED: "true",
  REVIEWBOT_ALERTS_JOB_FAILURE_LOOKBACK_HOURS: "6",
  REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD: "1",
  REVIEWBOT_ALERTS_STALE_CLAIM_HOURS: "2",
  REVIEWBOT_ALERTS_STALE_CLAIM_THRESHOLD: "1",
});
const generatedJobHealthAlerts = jobHealthAlerts.evaluateJobHealthAlerts({
  now: alertNow,
  policy: jobHealthPolicy,
  jobEvents: [
    {
      createdAt: "2026-06-12T10:00:00.000Z",
      jobId: "failed-job",
      status: "dispatch_failed",
      repoFullName: "6529-Collections/example",
    },
  ],
  runClaims: [
    {
      updatedAt: "2026-06-12T08:30:00.000Z",
      expiresAt: "2026-06-12T13:00:00.000Z",
      jobId: "stale-job",
      status: "running",
      repoFullName: "6529-Collections/example",
    },
  ],
});
assert.equal(generatedJobHealthAlerts.some((alert) => alert.kind === "job_failure"), true);
assert.equal(generatedJobHealthAlerts.some((alert) => alert.kind === "stale_run_claim"), true);
assert.throws(
  () =>
    jobHealthAlerts.jobHealthAlertPolicyFromEnv({
      REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD: "0",
    }),
  /positive integer/
);

const publicPolicy = admissionPolicy.admissionPolicyFromEnv({});
const mergedAdmissionPolicy = repositoryConfig.mergeRepositoryAdmissionPolicy(
  admissionPolicy.admissionPolicyFromEnv({
    REVIEWBOT_PUBLIC_REPO_MODE: "open",
    REVIEWBOT_TRUSTED_PERMISSION: "read",
  }),
  parsedRepoConfig
);
assert.equal(mergedAdmissionPolicy.publicRepoMode, "trusted");
assert.equal(mergedAdmissionPolicy.trustedPermission, "read");
assert.equal(mergedAdmissionPolicy.trustedUsers.has("trusted-maintainer"), true);
assert.equal(mergedAdmissionPolicy.denyUsers.has("blocked-user"), true);
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

const budgetSubject = budgetAdmission.budgetSubjectFromEvent(
  normalizedPullRequest,
  { requestor: "maintainer" },
  { provider: "anthropic", model: "claude-opus-4-8" }
);
assert.equal(budgetSubject.repo, "6529-Collections/example");
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: { unavailable: true },
  policy: budgetAdmission.budgetPolicyFromEnv({}),
}).status, "allowed");
const cappedPolicy = budgetAdmission.budgetPolicyFromEnv({
  REVIEWBOT_BUDGET_GLOBAL_DAILY_USD: "2",
});
const mergedBudgetPolicy = repositoryConfig.mergeRepositoryBudgetPolicy(cappedPolicy, parsedRepoConfig);
assert.equal(mergedBudgetPolicy.mode, "enforce");
assert.equal(mergedBudgetPolicy.defaultEstimatedCostUsd, 2);
assert.equal(mergedBudgetPolicy.caps.global.dailyBudgetUsd, 2);
assert.equal(mergedBudgetPolicy.caps.repo.dailyBudgetUsd, 5);
const reviewKindPolicy = budgetAdmission.budgetPolicyFromEnv({
  REVIEWBOT_BUDGET_REVIEW_KIND_DAILY_USD: "1",
});
assert.deepEqual(
  budgetAdmission
    .budgetPoliciesForSubject(budgetSubject, reviewKindPolicy)
    .map((item) => `${item.scopeType}:${item.scopeValue}`),
  ["review_kind:general", "review_kind:wcag", "review_kind:i18n", "review_kind:security"]
);
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: { unavailable: true, reason: "ledger offline" },
  policy: cappedPolicy,
}).code, "budget_snapshot_unavailable");
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: {
    unavailable: false,
    totals: {
      "global:*": { dailyUsd: 1.5, weeklyUsd: 1.5, monthlyUsd: 1.5 },
    },
  },
  policy: cappedPolicy,
  estimate: { estimatedCostUsd: 1 },
}).code, "budget_exceeded");
assert.equal(budgetAdmission.evaluateBudgetAdmission({
  event: normalizedPullRequest,
  admission: { requestor: "maintainer" },
  spendSnapshot: {
    unavailable: false,
    totals: {
      "global:*": { dailyUsd: 1.5, weeklyUsd: 1.5, monthlyUsd: 1.5 },
    },
  },
  policy: budgetAdmission.budgetPolicyFromEnv({
    REVIEWBOT_BUDGET_MODE: "warn",
    REVIEWBOT_BUDGET_GLOBAL_DAILY_USD: "2",
  }),
  estimate: { estimatedCostUsd: 1 },
}).status, "warning");
const spendQuery = budgetLedger.buildScopeSpendQuery("reviewbot", "requestor", "maintainer");
assert.match(spendQuery.sql, /metadata->>'requestor'/);
assert.equal(spendQuery.parameters[0].value.stringValue, "maintainer");
const usageEventsQuery = usageApiLedger.buildUsageEventsQuery("reviewbot", {
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-11T00:00:00.000Z",
}, 25);
assert.match(usageEventsQuery.sql, /ai_review_usage_events/);
assert.match(usageEventsQuery.sql, /created_at >= cast\(:from_ts as timestamptz\)/);
assert.equal(usageEventsQuery.parameters[2].value.longValue, 25);
assert.throws(() => usageApiLedger.buildUsageEventsQuery("reviewbot", {}, 25), /bounded range/);
const jobEventsQuery = usageApiLedger.buildJobEventsQuery("reviewbot", {
  status: "dispatch_failed",
  limit: 10,
});
assert.match(jobEventsQuery.sql, /ai_review_job_events/);
assert.match(jobEventsQuery.sql, /where status = :status/);
assert.equal(jobEventsQuery.parameters[0].value.stringValue, "dispatch_failed");
assert.equal(jobEventsQuery.parameters[1].value.longValue, 10);
const recentJobEventsQuery = usageApiLedger.buildJobEventsQuery("reviewbot", {
  statuses: ["dispatch_failed", "dispatch_error"],
  createdAfter: "2026-06-12T00:00:00.000Z",
  createdBefore: "2026-06-12T12:00:00.000Z",
  limit: 5,
});
assert.match(recentJobEventsQuery.sql, /status in \(:status_0, :status_1\)/);
assert.match(recentJobEventsQuery.sql, /created_at >= cast\(:created_after as timestamptz\)/);
assert.equal(recentJobEventsQuery.parameters[0].value.stringValue, "dispatch_failed");
assert.equal(recentJobEventsQuery.parameters[4].value.longValue, 5);
const runClaimsQuery = usageApiLedger.buildRunClaimsQuery("reviewbot", {
  statuses: ["claimed", "running"],
  updatedBefore: "2026-06-12T10:00:00.000Z",
  onlyUnexpired: true,
  limit: 7,
});
assert.match(runClaimsQuery.sql, /ai_review_run_claims/);
assert.match(runClaimsQuery.sql, /updated_at < cast\(:updated_before as timestamptz\)/);
assert.match(runClaimsQuery.sql, /expires_at is null or expires_at > now\(\)/);
assert.equal(runClaimsQuery.parameters[0].value.stringValue, "claimed");
assert.equal(runClaimsQuery.parameters[3].value.longValue, 7);
assert.throws(() => usageApiLedger.buildJobEventsQuery("reviewbot", { limit: 0 }), /positive integer/);
const usageApiLedgerRecord = [
  { stringValue: "2026-06-10 01:00:00+00" },
  { stringValue: "6529-Collections/public-repo" },
  { longValue: 10 },
  { stringValue: "author" },
  { stringValue: "head" },
  { stringValue: "run" },
  { stringValue: "job" },
  { stringValue: "general" },
  { stringValue: "anthropic" },
  { stringValue: "claude-opus-4-8" },
  { stringValue: "anthropic:claude-opus-4-8" },
  { longValue: 100 },
  { longValue: 25 },
  { longValue: 50 },
  { longValue: 0 },
  { longValue: 150 },
  { stringValue: "0.10" },
  { isNull: true },
  { stringValue: "USD" },
  { booleanValue: false },
  { stringValue: "{\"requestor\":\"maintainer\"}" },
];
const publicLedgerEvent = usageApiLedger.usageRecordToEvent(usageApiLedgerRecord, {
  visibility: "public",
  apiSettings: usageApi.usageApiSettingsFromEnv({
    REVIEWBOT_USAGE_API_PUBLIC_ORGS: "6529-Collections",
  }),
});
assert.equal(publicLedgerEvent.repoPrivate, false);
assert.equal(publicLedgerEvent.metadata.requestor, "maintainer");
const privateByDefaultLedgerEvent = usageApiLedger.usageRecordToEvent(usageApiLedgerRecord, {
  visibility: "public",
  apiSettings: usageApi.usageApiSettingsFromEnv({}),
});
assert.equal(privateByDefaultLedgerEvent.repoPrivate, true);
const jobEventLedgerRecord = [
  { longValue: 99 },
  { stringValue: "2026-06-10 02:00:00+00" },
  { stringValue: "job-1" },
  { stringValue: "dispatch_failed" },
  { stringValue: "dispatch" },
  { stringValue: "6529-Collections/private-repo" },
  { longValue: 12 },
  { stringValue: "author" },
  { stringValue: "head" },
  { stringValue: "delivery-1" },
  { stringValue: "maintainer" },
  { stringValue: "security" },
  { stringValue: "openai" },
  { stringValue: "gpt-5.2" },
  { stringValue: "openai:gpt-5.2" },
  { stringValue: "github_actions" },
  { booleanValue: false },
  { stringValue: "queue disabled" },
  { longValue: 1 },
  { stringValue: "{\"workflow\":\"review-job\"}" },
];
const jobEvent = usageApiLedger.jobEventRecordToEvent(jobEventLedgerRecord);
assert.equal(jobEvent.eventId, 99);
assert.equal(jobEvent.accepted, false);
assert.equal(jobEvent.metadata.workflow, "review-job");
const runClaimLedgerRecord = [
  { longValue: 101 },
  { stringValue: "2026-06-12 08:00:00+00" },
  { stringValue: "2026-06-12 08:30:00+00" },
  { isNull: true },
  { stringValue: "2026-06-12 13:00:00+00" },
  { stringValue: "run-key" },
  { stringValue: "job-claim" },
  { stringValue: "running" },
  { stringValue: "6529-Collections/private-repo" },
  { stringValue: "6529-Collections" },
  { longValue: 12 },
  { stringValue: "maintainer" },
  { stringValue: "head" },
  { stringValue: "security" },
  { stringValue: "openai" },
  { stringValue: "gpt-5.5" },
  { stringValue: "openai:gpt-5.5" },
  { stringValue: "delivery-1" },
  { stringValue: "review" },
  { stringValue: "{\"worker\":\"review-job\"}" },
];
const runClaim = usageApiLedger.runClaimRecordToClaim(runClaimLedgerRecord);
assert.equal(runClaim.claimId, 101);
assert.equal(runClaim.status, "running");
assert.equal(runClaim.metadata.worker, "review-job");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: new URL("http://localhost/api/admin/usage/summary"),
  headers: {},
}).code, "admin_auth_disabled");
const sharedSecretAuth = adminAuth.authorizeAdminRequest({
  method: "GET",
  url: new URL("http://localhost/api/admin/usage/summary"),
  headers: {
    "x-6529-reviewbot-admin-secret": "secret",
  },
}, adminAuth.adminAuthSettingsFromEnv({
  REVIEWBOT_ADMIN_AUTH_MODE: "shared_secret",
  REVIEWBOT_ADMIN_AUTH_SHARED_SECRET: "secret",
}));
assert.equal(sharedSecretAuth.allowed, true);
const hmacAuthSettings = adminAuth.adminAuthSettingsFromEnv({
  REVIEWBOT_ADMIN_AUTH_MODE: "hmac",
  REVIEWBOT_ADMIN_AUTH_HMAC_SECRET: "hmac-secret",
  REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "reviewbot-admin",
  REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS: "300",
});
const adminUsageUrl = new URL("http://localhost/api/admin/usage/summary?days=7");
const signedAdminHeaders = signedAdminHeadersFor(adminUsageUrl);
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeaders,
}, hmacAuthSettings).allowed, true);
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: new Headers(signedAdminHeaders),
}, hmacAuthSettings).allowed, true);
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeadersFor(adminUsageUrl, { roles: ["viewer"] }),
}, hmacAuthSettings).code, "admin_auth_missing_role");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: new URL("http://localhost/api/admin/budget/policies"),
  headers: signedAdminHeaders,
}, hmacAuthSettings).code, "admin_auth_invalid_signature");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeadersFor(adminUsageUrl, {
    expiresAt: String(Math.floor(Date.now() / 1000) - 1),
  }),
}, hmacAuthSettings).code, "admin_auth_expired");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: signedAdminHeadersFor(adminUsageUrl, {
    expiresAt: String(Math.floor(Date.now() / 1000) + 9999),
  }),
}, hmacAuthSettings).code, "admin_auth_ttl_too_long");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: {
    ...signedAdminHeaders,
    "x-6529-admin-user": "operator\nnext",
  },
}, hmacAuthSettings).code, "admin_auth_invalid_actor");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: {
    ...signedAdminHeaders,
    "x-6529-admin-roles": "reviewbot-admin,bad role",
  },
}, hmacAuthSettings).code, "admin_auth_invalid_roles");
assert.throws(
  () => adminAuth.signAdminAuthRequest({
    method: "GET",
    url: adminUsageUrl,
    actor: "operator",
    roles: ["reviewbot-admin\nbad"],
    expiresAt: String(Math.floor(Date.now() / 1000) + 120),
  }, hmacAuthSettings),
  /roles are invalid/
);
assert.equal(appServer.normalizeConfigLoadResult(null).status, "invalid");
assert.equal(
  repositoryConfig.repositoryConfigBlocksWork(
    { status: "not_configured" },
    { required: true }
  ),
  true
);

const fakeConfigText = Buffer.from("enabled: false\n").toString("base64");
const loadedRepoConfigPromise = repositoryConfig.loadRepositoryConfigFromGitHub(
  normalizedPullRequest,
  {
    policy: repositoryConfig.repositoryConfigPolicyFromEnv({
      REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "github",
    }),
    fetchImpl: async (url) => {
      assert.match(String(url), /ref=def456/);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: "file",
          encoding: "base64",
          content: fakeConfigText,
        }),
      };
    },
  }
);

let enqueuedJobs = null;
const recordedJobEvents = [];
let capturedBudgetSnapshotPolicy = null;
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
  enqueueReviewJobs: async (jobs) => {
    enqueuedJobs = jobs;
    return { accepted: true, jobId: "job-1" };
  },
  recordJobEvent: async (event) => {
    recordedJobEvents.push(event);
  },
  resolveActorContext: async () => ({ login: "maintainer", permission: "write" }),
  loadRepositoryConfig: async () => ({
    status: "loaded",
    source: "test",
    config: parsedRepoConfig,
  }),
  resolveBudgetSnapshot: async (jobEvent, admission, job, policy) => {
    capturedBudgetSnapshotPolicy = policy;
    return { unavailable: false, totals: {} };
  },
  jobPolicy: twoLanePolicy,
}).then(async (webhookResult) => {
  const manifestConversionSummary = await runManifestConversionSmoke();
  assert.equal(manifestConversionSummary.credentials.webhookSecret, "set");
  const githubActorContext = await githubActorContextPromise;
  assert.equal(githubActorContext.login, "maintainer");
  assert.equal(githubActorContext.permission, "write");
  assert.equal(githubActorContext.isOrgMember, true);
  const githubMembershipFailureContext = await githubMembershipFailurePromise;
  assert.equal(githubMembershipFailureContext.permission, "write");
  assert.equal(githubMembershipFailureContext.isOrgMember, false);
  assert.deepEqual(githubMembershipFailureContext.organizations, []);
  const githubRepoConfig = await githubRepoConfigPromise;
  assert.equal(githubRepoConfig.status, "loaded");
  assert.equal(githubRepoConfig.config.enabled, false);
  const disabledGithubRepoConfig = await disabledGithubRepoConfigPromise;
  assert.equal(disabledGithubRepoConfig.status, "not_configured");
  assert.equal(disabledConfigRequestedToken, false);
  const loadedRepoConfig = await loadedRepoConfigPromise;
  assert.equal(loadedRepoConfig.status, "loaded");
  assert.equal(loadedRepoConfig.config.enabled, false);
  const noopQueue = await noopQueuePromise;
  assert.equal(noopQueue.accepted, false);
  assert.equal(noopQueue.reason, "No worker adapter configured.");
  const serverEntrypointQueue = await serverEntrypointQueuePromise;
  assert.equal(serverEntrypointQueue.accepted, false);
  assert.equal(serverEntrypointQueue.adapter, "noop");
  assert.equal(serverEntrypointQueue.reason, "No worker adapter configured.");
  const serverAppDispatchResult = await serverAppDispatchPromise;
  assert.equal(serverAppDispatchResult.accepted, true);
  assert.equal(serverAppDispatchResult.jobs[0].dispatchMode, "api");
  assert.equal(
    serverDispatchRequest.options.headers.authorization,
    "Bearer server-installation-token"
  );
  assert.equal(serverDispatchRequest.body.inputs.run_key, forkReviewJob.runKey);
  const serverMainAppDispatchResult = await serverMainAppDispatchPromise;
  assert.equal(serverMainAppDispatchResult.accepted, true);
  assert.equal(serverMainAppDispatchResult.jobs[0].dispatchMode, "api");
  assert.equal(
    serverMainAppDispatchRequest.options.headers.authorization,
    "Bearer main-app-installation-token"
  );
  assert.equal(
    serverMainAppDispatchRequest.body.inputs.run_key,
    forkReviewJob.runKey
  );
  const apiDispatchResult = await apiDispatchResultPromise;
  assert.equal(apiDispatchResult.accepted, true);
  assert.equal(apiDispatchResult.dispatchMode, "api");
  assert.equal(apiDispatchResult.statusCode, 204);
  assert.equal(
    apiDispatchRequest.url,
    "https://api.github.test/repos/6529-Collections/6529reviewbot/actions/workflows/review-job.yml/dispatches"
  );
  assert.equal(apiDispatchRequest.options.method, "POST");
  assert.equal(apiDispatchRequest.options.headers.authorization, "Bearer dispatch-token");
  assert.match(apiDispatchRequest.options.body, /"review_kind":"general"/);
  assert.equal(apiDispatchRequest.body.ref, "main");
  assert.equal(apiDispatchRequest.body.inputs.target_repo, "6529-Collections/example");
  assert.equal(apiDispatchRequest.body.inputs.head_repo, "external/fork");
  assert.equal(apiDispatchRequest.body.inputs.installation_id, "99");
  const missingApiTokenResult = await missingApiTokenResultPromise;
  assert.equal(missingApiTokenResult.accepted, false);
  assert.equal(missingApiTokenResult.dispatchMode, "api");
  assert.match(missingApiTokenResult.reason, /GITHUB_TOKEN/);
  const failedApiDispatchResult = await failedApiDispatchResultPromise;
  assert.equal(failedApiDispatchResult.accepted, false);
  assert.equal(failedApiDispatchResult.dispatchMode, "api");
  assert.match(failedApiDispatchResult.reason, /Bearer \[redacted\]/);
  assert.match(failedApiDispatchResult.reason, /sk-\[redacted\]/);
  assert.doesNotMatch(failedApiDispatchResult.reason, /ghp_abcdefghijklmnopqrstuvwxyz/);
  assert.doesNotMatch(failedApiDispatchResult.reason, /sk-ant-api03-secretvalue/);
  const claimedDecision = await claimedDecisionPromise;
  assert.equal(claimedDecision.code, "run_control_claimed");
  assert.equal(claimedDecision.allowed, true);
  assert.equal((await duplicateDecisionPromise).code, "duplicate_run");
  assert.equal((await concurrencyDecisionPromise).code, "concurrency_limit_exceeded");
  assert.equal((await disabledRunControlLedgerPromise).code, "run_control_snapshot_unavailable");

  const usageApiSettings = usageApi.usageApiSettingsFromEnv({
    REVIEWBOT_USAGE_API_DEFAULT_DAYS: "7",
    REVIEWBOT_USAGE_API_MAX_DAYS: "30",
  });
  const usageRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/public/usage/summary?days=7",
    headers: {},
  }, {
    usageApiSettings,
    loadUsageEvents: async ({ range, visibility }) => {
      assert.equal(range.days, 7);
      assert.equal(visibility, "public");
      return { events: usageEvents };
    },
  });
  assert.equal(usageRouteResult.statusCode, 200);
  assert.equal(usageRouteResult.body.visibility, "public");
  const manifestCompleteRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/github-app/manifest-complete?code=temporary-code&state=test-state",
    headers: {},
  }, {});
  assert.equal(manifestCompleteRouteResult.statusCode, 200);
  assert.equal(manifestCompleteRouteResult.body.kind, "github_app_manifest_complete");
  assert.equal(manifestCompleteRouteResult.body.codeReceived, true);
  assert.equal(JSON.stringify(manifestCompleteRouteResult.body).includes("temporary-code"), false);
  assert.equal(appServer.isGitHubAppOperatorPath("/github-app/setup"), true);
  const adminStatusRouteUrl = new URL("http://localhost/api/admin/status?profile=worker&strict=1");
  const adminStatusRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/status?profile=worker&strict=1",
    headers: signedAdminHeadersFor(adminStatusRouteUrl),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadAdminStatus: async ({ query }) => {
      assert.equal(query.profile, "worker");
      assert.equal(query.strict, true);
      return { preflight: { ok: false, warnings: [{ name: "test", message: "warning" }] } };
    },
  });
  assert.equal(adminStatusRouteResult.statusCode, 200);
  assert.equal(adminStatusRouteResult.body.kind, "runtime_status");
  assert.equal(adminStatusRouteResult.body.preflight.ok, false);
  const adminJobsRouteUrl = new URL("http://localhost/api/admin/jobs/recent?limit=1");
  const adminJobsRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/jobs/recent?limit=1",
    headers: signedAdminHeadersFor(adminJobsRouteUrl),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadJobEvents: async ({ query }) => {
      assert.equal(query.limit, 1);
      return { events: [{ jobId: "job-route", status: "dispatch_accepted" }] };
    },
  });
  assert.equal(adminJobsRouteResult.statusCode, 200);
  assert.equal(adminJobsRouteResult.body.events[0].jobId, "job-route");
  const adminDenied = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/usage/summary"),
    headers: {},
  }, {
    settings: usageApiSettings,
    loadUsageEvents: async () => ({ events: usageEvents }),
  });
  assert.equal(adminDenied.statusCode, 403);
  const adminAllowed = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/budget/policies"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
    loadBudgetPolicies: async () => ({
      policies: [{ scopeType: "global", scopeValue: "*", dailyBudgetUsd: 5, enabled: true }],
    }),
  });
  assert.equal(adminAllowed.statusCode, 200);
  assert.equal(adminAllowed.body.policies[0].scopeType, "global");
  const adminBridgeAllowed = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: adminUsageUrl,
    headers: signedAdminHeadersFor(adminUsageUrl),
  }, {
    settings: usageApiSettings,
    authorizeAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadUsageEvents: async () => ({ events: usageEvents }),
  });
  assert.equal(adminBridgeAllowed.statusCode, 200);
  assert.equal(adminBridgeAllowed.body.visibility, "admin");
  const adminStatusUrl = new URL("http://localhost/api/admin/status?profile=server");
  const adminStatus = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: adminStatusUrl,
    headers: signedAdminHeadersFor(adminStatusUrl),
  }, {
    settings: usageApiSettings,
    authorizeAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadAdminStatus: async ({ query }) => {
      assert.equal(query.profile, "server");
      assert.equal(query.strict, false);
      return { preflight: { ok: true, checks: [{ name: "webhook", status: "ok" }] } };
    },
  });
  assert.equal(adminStatus.statusCode, 200);
  assert.equal(adminStatus.body.preflight.checks[0].name, "webhook");
  assert.throws(
    () => usageApi.adminStatusQueryFromRequest(
      { url: new URL("http://localhost/api/admin/status?profile=operator") }
    ),
    /profile must be one of/
  );
  const adminJobsUrl = new URL("http://localhost/api/admin/jobs/recent?status=dispatch_failed&limit=2");
  const adminJobEvents = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: adminJobsUrl,
    headers: signedAdminHeadersFor(adminJobsUrl),
  }, {
    settings: usageApiSettings,
    authorizeAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadJobEvents: async ({ query }) => {
      assert.equal(query.status, "dispatch_failed");
      assert.equal(query.limit, 2);
      return {
        events: [{
          eventId: 1,
          jobId: "job-1",
          status: "dispatch_failed",
          stage: "dispatch",
          repoFullName: "6529-Collections/private",
          prNumber: 12,
          accepted: false,
          metadata: { workflow: "review-job" },
        }],
      };
    },
  });
  assert.equal(adminJobEvents.statusCode, 200);
  assert.equal(adminJobEvents.body.kind, "job_events");
  assert.equal(adminJobEvents.body.events[0].accepted, false);
  assert.equal(adminJobEvents.body.events[0].metadata.workflow, "review-job");
  assert.throws(
    () => usageApi.jobEventsQueryFromRequest(
      { url: new URL("http://localhost/api/admin/jobs/recent?limit=999") },
      usageApiSettings
    ),
    /limit must be <= 50/
  );
  let alertOutput = "";
  const stdoutNotification = await alertNotifier.sendAlerts(generatedAlerts.slice(0, 1), {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "stdout",
    }),
    now: alertNow,
    write: (text) => {
      alertOutput += text;
    },
  });
  assert.equal(stdoutNotification.delivered, true);
  assert.match(alertOutput, /6529reviewbot/);
  let snsPublishOptions = null;
  const snsNotification = await alertNotifier.sendAlerts(generatedAlerts.slice(0, 1), {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "sns",
      REVIEWBOT_ALERTS_SNS_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:reviewbot-alerts",
      REVIEWBOT_ALERTS_SNS_TIMEOUT_MS: "1234",
    }),
    now: alertNow,
    execFileSync: (bin, args, options) => {
      assert.equal(bin, "aws");
      assert.equal(args.includes("publish"), true);
      snsPublishOptions = options;
      return "{}";
    },
  });
  assert.equal(snsNotification.delivered, true);
  assert.equal(snsPublishOptions.timeout, 1234);
  let customSnsShell = null;
  const customSnsNotification = await alertNotifier.sendAlerts(generatedAlerts.slice(0, 1), {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      AWS_CLI_BIN: "aws-custom",
      REVIEWBOT_ALERTS_NOTIFY_MODE: "sns",
      REVIEWBOT_ALERTS_SNS_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:reviewbot-alerts",
    }),
    now: alertNow,
    execFileSync: (bin, args, options) => {
      assert.equal(bin, "aws-custom");
      assert.equal(args.includes("publish"), true);
      customSnsShell = options.shell;
      return "{}";
    },
  });
  assert.equal(customSnsNotification.delivered, true);
  assert.equal(customSnsShell, false);
  const bestEffortNotification = await alertNotifier.sendAlerts(generatedAlerts.slice(0, 1), {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "webhook",
      REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED: "false",
    }),
  });
  assert.equal(bestEffortNotification.ok, true);
  assert.equal(bestEffortNotification.delivered, false);
  const scheduledAlertResult = await scheduledSpendCheck.runScheduledSpendCheck({
    dryRun: true,
    now: alertNow,
    events: alertEvents,
    jobEvents: [
      {
        createdAt: "2026-06-12T10:00:00.000Z",
        jobId: "failed-job",
        status: "dispatch_failed",
        repoFullName: "6529-Collections/example",
      },
    ],
    runClaims: [
      {
        updatedAt: "2026-06-12T08:30:00.000Z",
        expiresAt: "2026-06-12T13:00:00.000Z",
        jobId: "stale-job",
        status: "running",
        repoFullName: "6529-Collections/example",
      },
    ],
    budgetPolicies: [
      {
        scopeType: "repo",
        scopeValue: "6529-Collections/example",
        dailyBudgetUsd: 10,
        enabled: true,
      },
    ],
    settings: {
      alertPolicy,
      jobHealthPolicy,
      notifierSettings: alertNotifier.alertNotifierSettingsFromEnv({
        REVIEWBOT_ALERTS_NOTIFY_MODE: "none",
      }),
      ledgerSettings: {},
      apiSettings: usageApiSettings,
      lookbackDays: 35,
    },
  });
  assert.equal(scheduledAlertResult.alertCount, generatedAlerts.length + generatedJobHealthAlerts.length);
  assert.equal(scheduledAlertResult.notification.mode, "dry_run");
  try {
    usageApi.usageRangeFromRequest(
      { url: new URL("http://localhost/api/public/usage/summary?days=bad") },
      usageApiSettings,
      new Date("2026-06-11T00:00:00.000Z")
    );
    assert.fail("expected invalid days query to throw");
  } catch (error) {
    assert.equal(error.statusCode, 400);
  }
  assert.equal(webhookResult.statusCode, 202);
  assert.equal(webhookResult.body.enqueued, true);
  assert.equal(enqueuedJobs.length, 4);
  assert.equal(recordedJobEvents.filter((event) => event.status === "budget_admitted").length, 4);
  assert.equal(recordedJobEvents.filter((event) => event.status === "dispatch_accepted").length, 4);
  assert.equal(recordedJobEvents[0].metadata.budgetCode, "within_budget");
  assert.equal(capturedBudgetSnapshotPolicy.caps.repo.dailyBudgetUsd, 5);
  assert.equal(enqueuedJobs[0].prNumber, 12);
  assert.equal(webhookResult.body.jobs.length, 4);
  assert.deepEqual(
    webhookResult.body.jobs.map((job) => `${job.reviewKind}:${job.provider}`),
    ["general:anthropic", "general:openai", "security:anthropic", "security:openai"]
  );
  assert.equal(webhookResult.body.configuration.status, "loaded");
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
  assert.equal(defaultQueueResult.body.jobs.length, 4);
  assert.equal(defaultQueueResult.body.queue.jobCount, 4);
  let runtimePausedQueued = false;
  const runtimePausedEvents = [];
  const runtimePausedResult = await appServer.handleGitHubWebhook({
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
    jobPolicy: twoLanePolicy,
    runtimeControlPolicy: runtimeControl.runtimeControlPolicyFromEnv({
      REVIEWBOT_DISABLED_PROVIDERS: "anthropic,openai",
    }),
    recordJobEvent: async (event) => {
      runtimePausedEvents.push(event);
    },
    enqueueReviewJobs: async () => {
      runtimePausedQueued = true;
      return { accepted: true };
    },
  });
  assert.equal(runtimePausedResult.body.enqueued, false);
  assert.equal(runtimePausedResult.body.runtimeControl.jobs.status, "denied");
  assert.equal(runtimePausedResult.body.deniedJobs.length, 8);
  assert.equal(runtimePausedResult.body.deniedJobs[0].runtimeControl.code, "provider_disabled");
  assert.equal(runtimePausedEvents.filter((event) => event.status === "runtime_disabled").length, 8);
  assert.equal(runtimePausedQueued, false);
  const replayResult = await replayWebhook.replayWebhook({
    payloadPath: "-",
    eventName: "pull_request",
    deliveryId: "replay-test",
    webhookSecret,
    actorPermission: "write",
    repositoryConfigPath: "templates/dogfood-repository-config.yml",
    assumeEmptyBudget: true,
    estimatedCostUsd: 0.25,
    readStdin: () => webhookBody,
  });
  assert.equal(replayResult.statusCode, 200);
  assert.equal(replayResult.replay.dryRun, true);
  assert.equal(replayResult.body.enqueued, false);
  assert.equal(replayResult.body.jobs.length, 2);
  assert.equal(replayResult.body.queue.adapter, "dry_run");
  let budgetDeniedQueued = false;
  const budgetDeniedResult = await appServer.handleGitHubWebhook({
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
    budgetPolicy: cappedPolicy,
    resolveBudgetSnapshot: async () => ({
      unavailable: false,
      totals: {
        "global:*": { dailyUsd: 2, weeklyUsd: 2, monthlyUsd: 2 },
      },
    }),
    estimateBudgetCost: async () => ({ estimatedCostUsd: 1 }),
    enqueueReviewJobs: async () => {
      budgetDeniedQueued = true;
      return { accepted: true };
    },
  });
  assert.equal(budgetDeniedResult.body.budget.code, "budget_exceeded");
  assert.equal(budgetDeniedResult.body.enqueued, false);
  assert.equal(budgetDeniedResult.body.deniedJobs.length, 4);
  assert.equal(budgetDeniedQueued, false);
  let ledgerBudgetPolicyQueued = false;
  const ledgerBudgetPolicyResult = await appServer.handleGitHubWebhook({
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
    loadBudgetPolicy: async (basePolicy) =>
      budgetPolicies.mergeBudgetPolicyRows(basePolicy, [{
        scopeType: "global",
        scopeValue: "*",
        dailyBudgetUsd: 0,
        enabled: true,
      }]),
    resolveBudgetSnapshot: async () => ({
      unavailable: false,
      totals: {
        "global:*": { dailyUsd: 0, weeklyUsd: 0, monthlyUsd: 0 },
      },
    }),
    estimateBudgetCost: async () => ({ estimatedCostUsd: 1 }),
    enqueueReviewJobs: async () => {
      ledgerBudgetPolicyQueued = true;
      return { accepted: true };
    },
  });
  assert.equal(ledgerBudgetPolicyResult.body.budget.code, "budget_exceeded");
  assert.equal(ledgerBudgetPolicyResult.body.enqueued, false);
  assert.equal(ledgerBudgetPolicyResult.body.deniedJobs.length, 4);
  assert.equal(ledgerBudgetPolicyQueued, false);
  const dispatchStatusUpdates = [];
  const dispatchFailedResult = await appServer.handleGitHubWebhook({
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
    runControlPolicy,
    claimReviewJob: async (job, context) =>
      runControl.evaluateRunControl({
        job,
        policy: context.policy,
        snapshot: { unavailable: false, active: {} },
      }),
    enqueueReviewJobs: async () => ({ accepted: false, reason: "queue closed" }),
    updateRunClaimStatus: async (job, status, options) => {
      dispatchStatusUpdates.push({ job, status, options });
    },
  });
  assert.equal(dispatchFailedResult.body.enqueued, false);
  assert.equal(dispatchStatusUpdates.length, 4);
  assert.equal(dispatchStatusUpdates[0].status, "dispatch_failed");
  assert.equal(dispatchStatusUpdates[0].options.metadata.queueReason, "queue closed");
  const dispatchExceptionStatusUpdates = [];
  const dispatchExceptionEvents = [];
  const sensitiveDispatchError =
    "dispatch token mint failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456";
  await assert.rejects(
    () =>
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
        resolveActorContext: async () => ({ login: "maintainer", permission: "write" }),
        runControlPolicy,
        claimReviewJob: async (job, context) =>
          runControl.evaluateRunControl({
            job,
            policy: context.policy,
            snapshot: { unavailable: false, active: {} },
          }),
        enqueueReviewJobs: async () => {
          throw new Error(sensitiveDispatchError);
        },
        updateRunClaimStatus: async (job, status, options) => {
          dispatchExceptionStatusUpdates.push({ job, status, options });
        },
        recordJobEvent: async (event) => {
          dispatchExceptionEvents.push(event);
        },
      }),
    /dispatch token mint failed/
  );
  assert.equal(dispatchExceptionStatusUpdates.length, 4);
  assert(dispatchExceptionStatusUpdates.every((entry) => entry.status === "dispatch_error"));
  assert(
    dispatchExceptionStatusUpdates.every((entry) =>
      /dispatch token mint failed/.test(entry.options.metadata.queueReason)
    )
  );
  assert(
    dispatchExceptionStatusUpdates.every(
      (entry) =>
        entry.options.metadata.queueReason.includes("Bearer [redacted]") &&
        entry.options.metadata.queueReason.includes("sk-[redacted]") &&
        !entry.options.metadata.queueReason.includes("abcdefghijklmnopqrstuvwxyz123456") &&
        !entry.options.metadata.queueReason.includes("sk-proj-")
    )
  );
  const dispatchExceptionDispatchEvents = dispatchExceptionEvents.filter(
    (event) => event.status === "dispatch_error"
  );
  assert.equal(dispatchExceptionDispatchEvents.length, 4);
  assert(dispatchExceptionDispatchEvents.every((event) => event.stage === "dispatch"));
  assert(dispatchExceptionDispatchEvents.every((event) => event.accepted === false));
  assert(
    dispatchExceptionDispatchEvents.every((event) =>
      /dispatch token mint failed/.test(event.reason)
    )
  );
  assert(
    dispatchExceptionDispatchEvents.every(
      (event) =>
        event.reason.includes("Bearer [redacted]") &&
        event.reason.includes("sk-[redacted]") &&
        !event.reason.includes("abcdefghijklmnopqrstuvwxyz123456") &&
        !event.reason.includes("sk-proj-")
    )
  );
  const completedDispatchStatusUpdates = [];
  const completedDispatchResult = await appServer.handleGitHubWebhook({
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
    runControlPolicy,
    claimReviewJob: async (job, context) =>
      runControl.evaluateRunControl({
        job,
        policy: context.policy,
        snapshot: { unavailable: false, active: {} },
      }),
    enqueueReviewJobs: async (jobs) => ({
      accepted: true,
      status: "accepted",
      adapter: "local",
      jobs: jobs.map((job) => ({
        jobId: job.id,
        accepted: true,
        adapter: "local",
        claimStatus: "completed",
      })),
    }),
    updateRunClaimStatus: async (job, status, options) => {
      completedDispatchStatusUpdates.push({ job, status, options });
    },
  });
  assert.equal(completedDispatchResult.statusCode, 202);
  assert.equal(completedDispatchStatusUpdates.length, 4);
  assert.equal(completedDispatchStatusUpdates[0].status, "completed");
  assert.equal(completedDispatchStatusUpdates[0].options.metadata.adapter, "local");
  let runControlDeniedQueued = false;
  const runControlDeniedResult = await appServer.handleGitHubWebhook({
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
    runControlPolicy,
    claimReviewJob: async (job, context) =>
      runControl.evaluateRunControl({
        job,
        policy: context.policy,
        snapshot: {
          unavailable: false,
          duplicate: {
            runKey: job.runKey,
            jobId: "older-job",
            status: "claimed",
          },
        },
      }),
    enqueueReviewJobs: async () => {
      runControlDeniedQueued = true;
      return { accepted: true };
    },
  });
  assert.equal(runControlDeniedResult.body.runControl.code, "duplicate_run");
  assert.equal(runControlDeniedResult.body.enqueued, false);
  assert.equal(runControlDeniedResult.body.deniedJobs.length, 4);
  assert.equal(runControlDeniedQueued, false);
  console.log("smoke tests ok");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function runManifestConversionSmoke() {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-manifest-"));
  const outputPath = path.join(outputDir, "app.json");
  let capturedRequest = null;
  const summary = await githubAppManifestConversion.convertGitHubAppManifest({
    code: "abc123",
    outputPath,
    repoRoot: path.resolve(__dirname, ".."),
    token: "operator-token",
    fetchImpl: async (url, options = {}) => {
      capturedRequest = { url: String(url), options };
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 123,
          slug: "6529bot",
          name: "6529bot",
          owner: { login: "6529-Collections" },
          html_url: "https://github.com/apps/6529bot",
          external_url: "https://github.com/6529-Collections/6529reviewbot",
          client_id: "client-id",
          client_secret: "client-secret",
          webhook_secret: "webhook-secret",
          pem: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----\n",
          permissions: { contents: "read", issues: "write" },
          events: ["issue_comment", "pull_request"],
        }),
      };
    },
  });
  assert.match(capturedRequest.url, /\/app-manifests\/abc123\/conversions$/);
  assert.equal(capturedRequest.options.method, "POST");
  assert.equal(capturedRequest.options.headers.authorization, "Bearer operator-token");
  assert.equal(summary.id, 123);
  assert.equal(summary.credentials.clientSecret, "set");
  assert.equal(summary.credentials.pem, "set");
  const written = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(written.webhook_secret, "webhook-secret");
  const formatted = githubAppManifestConversion.formatManifestConversionSummary(summary);
  assert.match(formatted, /GitHub App manifest conversion complete/);
  assert.equal(formatted.includes("client-secret"), false);
  assert.equal(formatted.includes("webhook-secret"), false);
  assert.equal(formatted.includes("PRIVATE KEY"), false);
  return summary;
}

function signedAdminHeadersFor(url, options = {}) {
  const roles = options.roles || ["reviewbot-admin", "admin"];
  const expiresAt =
    options.expiresAt || String(Math.floor(Date.now() / 1000) + 120);
  const signature = adminAuth.signAdminAuthRequest({
    method: options.method || "GET",
    url,
    actor: options.actor || "operator",
    roles,
    expiresAt,
  }, hmacAuthSettings);
  return {
    "x-6529-admin-user": options.actor || "operator",
    "x-6529-admin-roles": roles.join(","),
    "x-6529-admin-expires-at": expiresAt,
    "x-6529-admin-signature": `sha256=${signature}`,
  };
}

function withEnv(nextEnv, fn) {
  const oldEnv = process.env;
  process.env = { ...oldEnv, ...nextEnv };
  try {
    return fn();
  } finally {
    process.env = oldEnv;
  }
}
