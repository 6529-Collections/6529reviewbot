#!/usr/bin/env node

"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const adminAuth = require("../src/admin-auth.cjs");
const adminAuthContractCheck = require("./check-admin-auth-contract.cjs");
const adminSnapshot = require("../src/admin-snapshot.cjs");
const adminSnapshotCli = require("../bin/admin-snapshot.cjs");
const adminSnapshotContractCheck = require("./check-admin-snapshot-contract.cjs");
const admissionPolicyCheck = require("./check-admission-policy.cjs");
const admissionPolicy = require("../src/admission-policy.cjs");
const alertDimensionsCheck = require("./check-alert-dimensions.cjs");
const alertingRunbookContractCheck = require("./check-alerting-runbook-contract.cjs");
const alertDeliveryPlanContractCheck = require("./check-alert-delivery-plan-contract.cjs");
const alertNotifierModesCheck = require("./check-alert-notifier-modes.cjs");
const alertNotifier = require("../src/alert-notifier.cjs");
const alertStatus = require("../src/alert-status.cjs");
const appServer = require("../src/app-server.cjs");
const budgetAdmission = require("../src/budget-admission.cjs");
const budgetLedger = require("../src/budget-ledger.cjs");
const budgetPolicies = require("../src/budget-policies.cjs");
const budgetPoliciesCli = require("../bin/apply-budget-policies.cjs");
const budgetScopesCheck = require("./check-budget-scopes.cjs");
const budgetPoliciesRunbookContractCheck = require("./check-budget-policies-runbook-contract.cjs");
const dataApi = require("../src/data-api.cjs");
const diagnostics = require("../src/diagnostics.cjs");
const dogfoodTarget = require("../src/dogfood-target.cjs");
const dogfoodTargetCli = require("../bin/dogfood-target.cjs");
const dogfoodTargetContractCheck = require("./check-dogfood-target-contract.cjs");
const dogfoodReadiness = require("../src/dogfood-readiness.cjs");
const dogfoodReadinessCli = require("../bin/dogfood-readiness.cjs");
const dogfoodReadinessContractCheck = require("./check-dogfood-readiness-contract.cjs");
const dogfoodPromotion = require("../src/dogfood-promotion.cjs");
const dogfoodPromotionCli = require("../bin/dogfood-promotion.cjs");
const dogfoodPromotionContractCheck = require("./check-dogfood-promotion-contract.cjs");
const dogfoodGoLive = require("../src/dogfood-go-live.cjs");
const dogfoodGoLiveCli = require("../bin/dogfood-go-live.cjs");
const dogfoodGoLiveContractCheck = require("./check-dogfood-go-live-contract.cjs");
const dogfoodStatus = require("../src/dogfood-status.cjs");
const dogfoodStatusCli = require("../bin/dogfood-status.cjs");
const dogfoodStatusContractCheck = require("./check-dogfood-status-contract.cjs");
const diagnosticsRedactionCheck = require("./check-diagnostics-redaction.cjs");
const workerCapacityContractCheck = require("./check-worker-capacity-contract.cjs");
const githubWebhook = require("../src/github-webhook.cjs");
const githubAppAuth = require("../src/github-app-auth.cjs");
const applyLedgerSchemaCli = require("../bin/apply-ledger-schema.cjs");
const githubAppManifest = require("../src/github-app-manifest.cjs");
const githubAppManifestConversion = require("../src/github-app-manifest-conversion.cjs");
const githubAppManifestConversionCli = require("../bin/convert-github-app-manifest.cjs");
const githubAppManifestCli = require("../bin/render-github-app-manifest.cjs");
const githubAppManifestContractCheck = require("./check-github-app-manifest-contract.cjs");
const githubAppInstallationToken = require("../bin/github-app-installation-token.cjs");
const githubAppAuthContractCheck = require("./check-github-app-auth-contract.cjs");
const githubAppRoutesContractCheck = require("./check-github-app-routes-contract.cjs");
const installGuideContractCheck = require("./check-install-guide-contract.cjs");
const deploymentRunbookContractCheck = require("./check-deployment-runbook-contract.cjs");
const configurationReferenceContractCheck = require("./check-configuration-reference-contract.cjs");
const managerMemoryContractCheck = require("./check-manager-memory.cjs");
const awsIamTemplatesCheck = require("./check-aws-iam-templates.cjs");
const securityModelContractCheck = require("./check-security-model-contract.cjs");
const compatibilityPolicyCheck = require("./check-compatibility-policy.cjs");
const externalEvidenceBoundariesCheck = require("./check-external-evidence-boundaries.cjs");
const operationsRunbookContractCheck = require("./check-operations-runbook-contract.cjs");
const supportRunbooksContractCheck = require("./check-support-runbooks-contract.cjs");
const jobHealthAlerts = require("../src/job-health-alerts.cjs");
const jobLedger = require("../src/job-ledger.cjs");
const ledgerSchema = require("../src/ledger-schema.cjs");
const replayWebhook = require("../bin/replay-webhook.cjs");
const runReviewJobCli = require("../bin/run-review-job.cjs");
const serverCli = require("../bin/server.cjs");
const releaseCandidate = require("../src/release-candidate.cjs");
const releaseCandidateCli = require("../bin/release-candidate.cjs");
const releaseOperationsMap = require("../src/release-operations-map.cjs");
const releaseOperationsMapCli = require("../bin/release-operations-map.cjs");
const releaseGates = require("../src/release-gates.cjs");
const releaseGatesCli = require("../bin/v0-gates.cjs");
const v0GatesContractCheck = require("./check-v0-gates-contract.cjs");
const releaseNotesDraftContractCheck = require("./check-release-notes-draft-contract.cjs");
const releaseNotesPublicationContractCheck = require("./check-release-notes-publication-contract.cjs");
const releaseTagPlanContractCheck = require("./check-release-tag-plan-contract.cjs");
const securityReviewStatus = require("../src/security-review-status.cjs");
const securityReviewStatusCli = require("../bin/security-review-status.cjs");
const securityReviewStatusContractCheck = require("./check-security-review-status-contract.cjs");
const operatorEvidence = require("../src/operator-evidence.cjs");
const operatorEvidenceCli = require("../bin/operator-evidence.cjs");
const operatorEvidenceContractCheck = require("./check-operator-evidence-contract.cjs");
const operatorWorkspace = require("../src/operator-workspace.cjs");
const operatorWorkspaceCli = require("../bin/operator-workspace.cjs");
const operatorWorkspaceContractCheck = require("./check-operator-workspace-contract.cjs");
const operatorDrillContractCheck = require("./check-operator-drill-contract.cjs");
const productionCutover = require("../src/production-cutover.cjs");
const productionCutoverCli = require("../bin/production-cutover.cjs");
const productionCutoverContractCheck = require("./check-production-cutover-contract.cjs");
const productionDeploymentPlanContractCheck = require("./check-production-deployment-plan-contract.cjs");
const dashboardDeploymentPlanContractCheck = require("./check-dashboard-deployment-plan-contract.cjs");
const alertDeliveryPlan = require("../src/alert-delivery-plan.cjs");
const alertDeliveryPlanCli = require("../bin/alert-delivery-plan.cjs");
const docsLinkCheck = require("./check-doc-links.cjs");
const envTemplateCheck = require("./check-6529-io-env-template.cjs");
const envTemplatesCheck = require("./check-env-templates.cjs");
const ledgerPrivacyCheck = require("./check-ledger-privacy-contract.cjs");
const webhookReplayCheck = require("./check-webhook-replay-contract.cjs");
const modelDefaultsCheck = require("./check-model-defaults.cjs");
const modelCatalog = require("../src/model-catalog.cjs");
const modelPriceStatus = require("../src/model-price-status.cjs");
const modelPricingRunbookContractCheck = require("./check-model-pricing-runbook-contract.cjs");
const modelPrices = require("../src/model-prices.cjs");
const modelPricesCli = require("../bin/apply-model-prices.cjs");
const providerAdapterCheck = require("./check-provider-adapters.cjs");
const providerContractCheck = require("./check-provider-contract.cjs");
const preflight = require("../src/preflight.cjs");
const preflightCli = require("../bin/preflight.cjs");
const preflightContractCheck = require("./check-preflight-contract.cjs");
const commentCommandsCheck = require("./check-comment-commands.cjs");
const containerImageCheck = require("./check-container-image.cjs");
const containerPublishPlanContractCheck = require("./check-container-publish-plan-contract.cjs");
const codeownersContractCheck = require("./check-codeowners-contract.cjs");
const communityReleaseGatesContractCheck = require("./check-community-release-gates-contract.cjs");
const repositoryRulesetsContractCheck = require("./check-repository-rulesets-contract.cjs");
const publicArtifactsCheck = require("./check-public-artifacts.cjs");
const reviewCommentFormatCheck = require("./check-review-comment-format.cjs");
const reviewContextBoundaryCheck = require("./check-review-context-boundary.cjs");
const reviewWorkflowKindsCheck = require("./check-review-workflow-kinds.cjs");
const releaseOperationsMapCheck = require("./check-release-operations-map.cjs");
const releaseCandidateContractCheck = require("./check-release-candidate-contract.cjs");
const repositoryConfig = require("../src/repository-config.cjs");
const repositoryConfigBoundaryCheck = require("./check-repository-config-boundary.cjs");
const reviewJob = require("../src/review-job.cjs");
const reviewBot = require("../src/review-bot.cjs");
const reviewBinEntrypointsCheck = require("./check-review-bin-entrypoints.cjs");
const runControlScopesCheck = require("./check-run-control-scopes.cjs");
const runControl = require("../src/run-control.cjs");
const runControlLedger = require("../src/run-control-ledger.cjs");
const runtimeControl = require("../src/runtime-control.cjs");
const scheduledSpendCheck = require("../src/scheduled-spend-check.cjs");
const spendAlerts = require("../src/spend-alerts.cjs");
const supportBundle = require("../src/support-bundle.cjs");
const supportBundleCli = require("../bin/support-bundle.cjs");
const supportBundleContractCheck = require("./check-support-bundle-contract.cjs");
const usageApi = require("../src/usage-api.cjs");
const usageApiClient = require("../src/usage-api-client.cjs");
const usageApiRoutesCheck = require("./check-usage-api-routes.cjs");
const usageApiLedger = require("../src/usage-api-ledger.cjs");
const usageLedger = require("../src/usage-ledger.cjs");
const workerAdapter = require("../src/worker-adapter.cjs");
const workerAdapterContractCheck = require("./check-worker-adapter-contract.cjs");

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
assert.equal(reviewBinEntrypointsCheck.checkReviewBinEntrypoints().reviewKinds, 5);
assert.equal(budgetScopesCheck.checkBudgetScopes().scopes, 8);
assert.deepEqual(
  budgetScopesCheck.dogfoodExampleScopes,
  ["global", "org", "repo", "requestor", "provider", "model", "review_kind"]
);
assert.throws(
  () =>
    budgetScopesCheck.checkBudgetScopes({
      quiet: true,
      docTexts: {
        "docs/budget-policies.md": "# Budget Policies\n\nSupported scopes:\n\n- `global`\n",
        "docs/budget-admission.md": "# Budget Admission\n\nSupported scopes:\n\n- `global`\n",
        "docs/aws-usage-ledger.md": "# AWS Usage Ledger\n",
      },
    }),
  /budget scope check found/
);
assert.equal(runControlScopesCheck.checkRunControlScopes().scopes, 8);
assert.equal(
  runControlScopesCheck.runControlEnvName("review_kind"),
  "REVIEWBOT_RUN_CONTROL_REVIEW_KIND_MAX_CONCURRENT"
);
assert.throws(
  () =>
    runControlScopesCheck.checkRunControlScopes({
      quiet: true,
      docTexts: {
        "README.md": "# 6529reviewbot\n",
        ".env.example": "REVIEWBOT_RUN_CONTROL_GLOBAL_MAX_CONCURRENT=\n",
        "docs/run-control.md": "# Run Control\n",
        "docs/configuration.md": "# Configuration\n",
      },
    }),
  /run-control scope check found/
);
assert.equal(alertDimensionsCheck.checkAlertDimensions().dimensions, 6);
assert.deepEqual(
  alertDimensionsCheck.expectedSpikeDimensions,
  ["global", "repo", "requestor", "provider", "model", "review_kind"]
);
assert.throws(
  () =>
    alertDimensionsCheck.checkAlertDimensions({
      quiet: true,
      docTexts: {
        "README.md": "# 6529reviewbot\n",
        ".env.example": "REVIEWBOT_ALERTS_SPIKE_DIMENSIONS=global,repo\n",
        "docs/alerting.md": "# Alerting\n",
        "docs/configuration.md": "# Configuration\n",
      },
    }),
  /alert dimension check found/
);
assert.equal(alertNotifierModesCheck.checkAlertNotifierModes().modes, 5);
assert.deepEqual(
  alertNotifierModesCheck.expectedNotifyModes,
  ["none", "stdout", "webhook", "sns", "ses"]
);
assert.throws(
  () =>
    alertNotifierModesCheck.checkAlertNotifierModes({
      quiet: true,
      docTexts: {
        "README.md": "# 6529reviewbot\n",
        "docs/alerting.md": "# Alerting\n`none`\n",
        "docs/configuration.md": "# Configuration\n",
      },
      envExampleText: "REVIEWBOT_ALERTS_NOTIFY_MODE=stdout\n",
    }),
  /alert notifier mode check found/
);
assert.equal(reviewCommentFormatCheck.checkReviewCommentFormat().reviewKinds, 5);
assert.equal(reviewCommentFormatCheck.expectedMarker, "6529-review-bot");
assert.throws(
  () =>
    reviewCommentFormatCheck.checkReviewCommentFormat({
      quiet: true,
      docTexts: {
        "docs/review-comment-format.md": "# Review Comment Format\n\n`general`\n",
      },
    }),
  /review comment format check found/
);
const reviewContextBoundaryResult = reviewContextBoundaryCheck.checkReviewContextBoundary();
assert.equal(reviewContextBoundaryResult.pathCases, 11);
assert.equal(reviewContextBoundaryResult.hardLimits, 9);
assert.throws(
  () =>
    reviewContextBoundaryCheck.checkReviewContextBoundary({
      quiet: true,
      docTexts: {
        "README.md": "# 6529reviewbot\n",
        "docs/architecture.md": "# Architecture\n",
        "docs/configuration.md": "# Configuration\n",
        "docs/security-model.md": "# Security Model\n",
        "docs/security-review-checklist.md": "# Security Review Checklist\n",
        "docs/release-operations-map.md": "# Release Operations Map\n",
        "docs/release-readiness.md": "# Release Readiness\n",
      },
    }),
  /review context boundary check found/
);
assert.equal(admissionPolicyCheck.checkAdmissionPolicy().repoModes, 3);
assert.deepEqual(admissionPolicyCheck.expectedRepoModes, ["trusted", "off", "open"]);
assert.throws(
  () =>
    admissionPolicyCheck.checkAdmissionPolicy({
      quiet: true,
      docTexts: {
        "docs/admission-policy.md": "# Admission\nREVIEWBOT_PUBLIC_REPO_MODE=open\n",
        "docs/configuration.md": "# Configuration\n",
      },
    }),
  /admission policy check found/
);
assert.equal(repositoryConfigBoundaryCheck.checkRepositoryConfigBoundary().configPaths, 6);
assert.deepEqual(repositoryConfigBoundaryCheck.expectedConfigPaths, [
  ".github/6529bot.yml",
  ".github/6529bot.yaml",
  ".github/6529bot.json",
  ".6529reviewbot.yml",
  ".6529reviewbot.yaml",
  ".6529reviewbot.json",
]);
assert.throws(
  () =>
    repositoryConfigBoundaryCheck.checkRepositoryConfigBoundary({
      quiet: true,
      docTexts: {
        "docs/repository-config.md": "# Repository Config\n",
        "docs/architecture.md": "# Architecture\n",
      },
    }),
  /repository config boundary check found/
);
assert.equal(workerAdapterContractCheck.checkWorkerAdapterContract().workerModes, 3);
assert.deepEqual(workerAdapterContractCheck.expectedWorkerModes, ["noop", "local", "github_actions"]);
assert.throws(
  () =>
    workerAdapterContractCheck.checkWorkerAdapterContract({
      quiet: true,
      docTexts: {
        "docs/worker-adapters.md": "# Worker Adapters\n",
        "docs/deployment.md": "# Deployment\n",
        "docs/architecture.md": "# Architecture\n",
      },
    }),
  /worker adapter contract check found/
);
assert.equal(adminAuthContractCheck.checkAdminAuthContract().modes, 3);
assert.deepEqual(adminAuthContractCheck.expectedAuthModes, ["disabled", "shared_secret", "hmac"]);
assert.throws(
  () =>
    adminAuthContractCheck.checkAdminAuthContract({
      quiet: true,
      docTexts: {
        "docs/admin-auth-bridge.md": "# Admin Auth\n",
        "docs/6529-io-admin-integration.md": "# Integration\n",
        "docs/configuration.md": "# Configuration\n",
      },
    }),
  /admin auth contract check found/
);
assert.deepEqual(
  usageApiRoutesCheck.routeContracts.map((contract) => contract.path),
  [
    "/api/public/usage/summary",
    "/api/admin/usage/summary",
    "/api/admin/usage/events/recent",
    "/api/admin/budget/policies",
    "/api/admin/budget/status",
    "/api/admin/model-prices/status",
    "/api/admin/alerts/status",
    "/api/admin/jobs/recent",
    "/api/admin/run-claims/recent",
    "/api/admin/status",
  ]
);
assert.deepEqual(adminSnapshotContractCheck.expectedChecks, [
  "admin_usage_summary",
  "recent_usage_events",
  "budget_status",
  "model_price_status",
  "alert_status",
  "failed_job_events",
  "stale_run_claims",
  "runtime_status_server",
  "runtime_status_worker",
]);
assert.equal(supportBundleContractCheck.requiredSafeEnvKeys.includes("REVIEWBOT_ADMIN_AUTH_MODE"), true);
assert.equal(
  supportBundleContractCheck.requiredPresenceEnvKeys.includes("REVIEWBOT_ADMIN_AUTH_HMAC_SECRET"),
  true
);
assert.equal(diagnosticsRedactionCheck.checkDiagnosticsRedaction().fixtures, 8);
assert.throws(
  () =>
    diagnosticsRedactionCheck.checkDiagnosticsRedaction({
      quiet: true,
      docTexts: {
        "docs/support.md": "# Support\n",
      },
    }),
  /diagnostics redaction check found/
);
assert.equal(preflightContractCheck.checkPreflightContract().checks, 18);
assert.deepEqual(preflightContractCheck.expectedChecks.slice(0, 3), [
  "webhook",
  "github_app_auth",
  "model_catalog",
]);
assert.throws(
  () =>
    preflightContractCheck.checkPreflightContract({
      quiet: true,
      docTexts: {
        "README.md": "# 6529reviewbot\nnpm run preflight\n",
        "docs/configuration.md": "# Configuration\n",
        "docs/deployment.md": "# Deployment\n",
        "docs/release.md": "# Release\n",
        "docs/release-operations-map.md": "# Release Operations Map\n",
        "docs/release-readiness.md": "# Release Readiness\n",
      },
    }),
  /preflight contract check found/
);
assert.throws(
  () =>
    reviewBinEntrypointsCheck.checkReviewBinEntrypoints({
      quiet: true,
      binTexts: { "general-pr-review.cjs": "wrong kind" },
    }),
  /review bin entrypoint check found/
);
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
assert.equal(
  envTemplateCheck.parseEnvTemplate("A=1\n# comment\nB=\n").B,
  ""
);
assert.equal(envTemplateCheck.check6529IoEnvTemplate().pathCount, 8);
assert.equal(envTemplatesCheck.checkEnvTemplates().files.length, 3);
assert.equal(envTemplatesCheck.isSensitiveTemplateKey("REVIEWBOT_ALERTS_WEBHOOK_URL"), true);
assert.equal(envTemplatesCheck.isSensitiveTemplateKey("REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS"), false);
const catalog = modelCatalog.loadModelCatalog();
assert.equal(catalog.providers.anthropic.defaultModel, "claude-opus-4-8");
assert.equal(modelCatalog.defaultModelForProvider("openrouter"), "");
assert.equal(modelDefaultsCheck.checkModelDefaults().providers, 3);
assert.equal(modelDefaultsCheck.anthropicDefaultLane(catalog), "anthropic:claude-opus-4-8");
assert.equal(providerContractCheck.checkProviderContract().providers, 3);
assert.equal(providerAdapterCheck.checkProviderAdapters().providers, 3);
assert.equal(ledgerPrivacyCheck.checkLedgerPrivacyContract().ledgers, 3);
assert.throws(
  () =>
    ledgerPrivacyCheck.checkLedgerPrivacyContract({
      quiet: true,
      docTexts: {
        "README.md": "# 6529reviewbot\n",
        "docs/architecture.md": "# Architecture\n",
        "docs/aws-usage-ledger.md": "# AWS Usage Ledger\n",
        "docs/job-ledger.md": "# Job Ledger\n",
        "docs/security-model.md": "# Security Model\n",
        "docs/usage-api.md": "# Usage API\n",
        "docs/release-operations-map.md": "# Release Operations Map\n",
        "docs/release-readiness.md": "# Release Readiness\n",
      },
    }),
  /ledger privacy contract check found/
);
assert.throws(
  () =>
    providerAdapterCheck.checkProviderAdapters({
      quiet: true,
      docTexts: {
        "README.md": "# 6529reviewbot\n",
        "docs/configuration.md": "# Configuration\n",
        "docs/provider-setup.md": "# Provider Setup\n",
        "docs/model-catalog.md": "# Model Catalog\n",
        "docs/review-jobs.md": "# Review Jobs\n",
        "docs/release-operations-map.md": "# Release Operations Map\n",
        "docs/release-readiness.md": "# Release Readiness\n",
      },
    }),
  /provider adapter check found/
);
assert.equal(
  providerContractCheck.humanProviderList(modelCatalog.PROVIDERS),
  "anthropic, openai, or openrouter"
);
assert.equal(
  providerContractCheck.backtickProviderList(modelCatalog.PROVIDERS),
  "`anthropic`, `openai`, or `openrouter`"
);
assert.throws(
  () =>
    providerContractCheck.checkProviderContract({
      quiet: true,
      providerKeys: { anthropic: "ANTHROPIC_API_KEY" },
    }),
  /provider contract check found/
);
assert.equal(
  modelDefaultsCheck.workflowEnvFallback(
    "REVIEW_DEFAULT_ANTHROPIC_MODEL: ${{ vars.REVIEW_DEFAULT_ANTHROPIC_MODEL || 'claude-next' }}",
    "REVIEW_DEFAULT_ANTHROPIC_MODEL"
  ),
  "claude-next"
);
assert.throws(
  () =>
    modelDefaultsCheck.checkModelDefaults({
      quiet: true,
      workflowText: "name: bad\non: {}\n",
    }),
  /model default check found/
);
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
      sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing",
      sourceCheckedAt: "2026-06-12T12:00:00.000Z",
      notes: `test price row sk-proj-abcdefghijklmnopqrstuvwxyz123456 ${"x".repeat(1200)}`,
    },
  ],
});
assert.equal(modelPriceFile.prices[0].provider, "anthropic");
assert.equal(modelPriceFile.prices[0].sourceCheckedAt, "2026-06-12T12:00:00.000Z");
assert.equal(modelPriceFile.prices[0].notes.length, 1000);
assert.match(modelPriceFile.prices[0].notes, /sk-\[redacted\]/);
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
          outputUsdPerMillion: 2,
          effectiveFrom: "2026-06-12T00:00:00.000Z",
          sourceUrl: "http://example.com/provider-pricing",
          sourceCheckedAt: "2026-06-12T12:00:00.000Z",
        },
      ],
    }),
  /absolute https URL/
);
const modelPriceStatements = modelPrices.modelPriceStatements("reviewbot", modelPriceFile);
assert.equal(modelPriceStatements.length, 2);
const renderedModelPriceSql = modelPrices.renderModelPriceSql("reviewbot", modelPriceFile);
assert.match(renderedModelPriceSql, /ai_model_prices/);
assert.match(renderedModelPriceSql, /source_checked_at/);
assert.match(renderedModelPriceSql, /sk-\[redacted\]/);
assert(!renderedModelPriceSql.includes("abcdefghijklmnopqrstuvwxyz123456"));
assert(!renderedModelPriceSql.includes("x".repeat(1001)));
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
  { stringValue: "https://docs.anthropic.com/en/docs/about-claude/pricing" },
  { stringValue: "2026-06-12 12:00:00+00" },
  { stringValue: "test price row" },
];
assert.equal(modelPrices.modelPriceFromRecord(modelPriceRecord).cachedInputUsdPerMillion, 0.1);
assert.equal(
  modelPrices.modelPriceFromRecord(modelPriceRecord).sourceCheckedAt,
  "2026-06-12 12:00:00+00"
);
const modelPriceStatusRow = modelPriceStatus.modelPriceStatusRecordToPrice(
  modelPriceRecord.slice(0, 11),
  {
    now: "2026-06-20T12:00:00.000Z",
    maxSourceAgeDays: 30,
  }
);
assert.equal(modelPriceStatusRow.provider, "anthropic");
assert.equal(modelPriceStatusRow.rates.outputUsdPerMillion, 2);
assert.equal(modelPriceStatusRow.sourceHost, "docs.anthropic.com");
assert.equal(modelPriceStatusRow.sourceStatus, "fresh");
assert.equal(modelPriceStatusRow.sourceAgeDays, 8);
assert.equal(modelPriceStatusRow.hasSourceUrl, true);
assert.equal(Object.prototype.hasOwnProperty.call(modelPriceStatusRow, "notes"), false);
assert.equal(Object.prototype.hasOwnProperty.call(modelPriceStatusRow, "sourceUrl"), false);
assert.deepEqual(
  modelPriceStatus.modelPriceSourceFreshness("2026-07-20T12:00:00.000Z", {
    now: "2026-06-20T12:00:00.000Z",
  }).status,
  "future"
);
assert.equal(
  modelPriceStatus.modelPriceSourceFreshness("2026-05-01T12:00:00.000Z", {
    now: "2026-06-20T12:00:00.000Z",
    maxSourceAgeDays: 30,
  }).status,
  "stale"
);
const modelPriceStatusSummary = modelPriceStatus.summarizeModelPriceStatus([
  modelPriceStatusRow,
  modelPriceStatus.modelPriceStatusRecordToPrice([
    { stringValue: "openai" },
    { stringValue: "gpt-5.5" },
    { stringValue: "1" },
    { isNull: true },
    { isNull: true },
    { isNull: true },
    { stringValue: "USD" },
    { stringValue: "2026-06-12 00:00:00+00" },
    { isNull: true },
    { stringValue: "https://platform.openai.com/docs/pricing" },
    { stringValue: "2026-05-01 12:00:00+00" },
  ], {
    now: "2026-06-20T12:00:00.000Z",
    maxSourceAgeDays: 30,
  }),
], {
  maxSourceAgeDays: 30,
});
assert.equal(modelPriceStatusSummary.summary.activeRows, 2);
assert.equal(modelPriceStatusSummary.summary.providerCount, 2);
assert.equal(modelPriceStatusSummary.summary.staleRows, 1);
assert.equal(modelPriceStatusSummary.summary.incompleteRows, 1);
const modelPriceStatusQuery = modelPriceStatus.buildModelPriceStatusQuery("reviewbot");
assert.match(modelPriceStatusQuery.sql, /ai_model_prices/);
assert.match(modelPriceStatusQuery.sql, /effective_from <= now\(\)/);
assert.deepEqual(modelPriceStatusQuery.parameters, []);
let modelPriceStatusSql = "";
const readPriceStatus = modelPriceStatus.readModelPriceStatus({
  enabled: true,
  region: "us-east-1",
  resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
  database: "reviewbot",
  schema: "reviewbot",
}, {
  executeStatement: (settings, sql, parameters, options) => {
    modelPriceStatusSql = sql;
    assert.equal(settings.schema, "reviewbot");
    assert.equal(options.tempPrefix, "6529-model-price-status-");
    assert.deepEqual(parameters, []);
    return { records: [modelPriceRecord.slice(0, 11)] };
  },
  now: "2026-06-20T12:00:00.000Z",
  maxSourceAgeDays: 30,
});
assert.match(modelPriceStatusSql, /ai_model_prices/);
assert.equal(readPriceStatus.summary.activeRows, 1);
assert.equal(readPriceStatus.prices[0].sourceHost, "docs.anthropic.com");
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
assert.throws(
  () =>
    modelPrices.applyModelPrices({
      enabled: true,
      region: "us-east-1",
      resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
      secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
      database: "reviewbot",
      schema: "reviewbot",
    }, {
      ...modelPriceFile,
      prices: [
        {
          ...modelPriceFile.prices[0],
          sourceUrl: "https://provider.example/pricing",
        },
      ],
    }, {
      executeStatement: () => {
        throw new Error("placeholder source rows must not execute SQL.");
      },
      now: "2026-06-20T12:00:00.000Z",
    }),
  /placeholder source URLs/
);
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
    catalog: "config/model-catalog.json",
    file: "prices.json",
    requireCatalogCoverage: false,
    schema: "reviewbot",
  }
);
assert.deepEqual(
  modelPricesCli.parseArgs(["--file", "prices.json", "--apply", "--allow-zero-price"]),
  {
    allowStaleSource: false,
    allowZeroPrice: true,
    apply: true,
    catalog: "config/model-catalog.json",
    file: "prices.json",
    requireCatalogCoverage: false,
  }
);
assert.deepEqual(
  modelPricesCli.parseArgs([
    "--file",
    "prices.json",
    "--catalog",
    "catalog.json",
    "--require-catalog-coverage",
  ]),
  {
    allowStaleSource: false,
    allowZeroPrice: false,
    apply: false,
    catalog: "catalog.json",
    file: "prices.json",
    requireCatalogCoverage: true,
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
    catalog: "config/model-catalog.json",
    file: "prices.json",
    maxSourceAgeDays: 45,
    requireCatalogCoverage: false,
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
      notes: `dogfood global cap github_pat_abcdefghijklmnopqrstuvwxyz1234567890 ${"y".repeat(1200)}`,
    },
    {
      scopeType: "provider",
      scopeValue: "Anthropic",
      dailyBudgetUsd: 10,
      enabled: true,
    },
  ],
});
assert.equal(budgetPolicyFile.policies[0].notes.length, 1000);
assert.match(budgetPolicyFile.policies[0].notes, /github_pat_\[redacted\]/);
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
const renderedBudgetPolicySql = budgetPolicies.renderBudgetPolicySql("reviewbot", budgetPolicyFile);
assert.match(renderedBudgetPolicySql, /ai_review_budget_policies/);
assert.match(renderedBudgetPolicySql, /github_pat_\[redacted\]/);
assert(!renderedBudgetPolicySql.includes("abcdefghijklmnopqrstuvwxyz1234567890"));
assert(!renderedBudgetPolicySql.includes("y".repeat(1001)));
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
const dogfoodTargetRepoRoot = path.resolve(__dirname, "..");
const commandOnlyTargetPacket = dogfoodTarget.collectDogfoodTargetPacket({
  root: dogfoodTargetRepoRoot,
  mode: "command-only",
  targetRepository: "6529-Collections/example",
});
assert.equal(commandOnlyTargetPacket.ready, true);
assert.equal(commandOnlyTargetPacket.mode, "command-only");
assert.equal(commandOnlyTargetPacket.configFile, "templates/dogfood-command-only-config.yml");
assert.equal(commandOnlyTargetPacket.targetRepository, "6529-Collections/example");
assert.match(dogfoodTarget.formatDogfoodTargetMarkdown(commandOnlyTargetPacket), /Dogfood Target Packet/);
const limitedTargetPacket = dogfoodTarget.collectDogfoodTargetPacket({
  root: dogfoodTargetRepoRoot,
  mode: "limited-initial",
});
assert.equal(limitedTargetPacket.ready, true);
assert.equal(limitedTargetPacket.mode, "limited-initial");
const autoTargetPacket = dogfoodTarget.collectDogfoodTargetPacket({
  root: dogfoodTargetRepoRoot,
  mode: "auto",
  repositoryConfigFile: "templates/dogfood-repository-config.yml",
});
assert.equal(autoTargetPacket.mode, "limited-initial");
const mismatchedTargetPacket = dogfoodTarget.collectDogfoodTargetPacket({
  root: dogfoodTargetRepoRoot,
  mode: "command-only",
  repositoryConfigFile: "templates/dogfood-repository-config.yml",
});
assert.equal(mismatchedTargetPacket.ready, false);
assert.throws(() => dogfoodTarget.assertDogfoodTargetReady(mismatchedTargetPacket), /not ready/);
const externalDogfoodConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-target-config-"));
const externalDogfoodConfigPath = path.join(externalDogfoodConfigDir, "target.yml");
fs.copyFileSync(path.join(dogfoodTargetRepoRoot, "templates/dogfood-command-only-config.yml"), externalDogfoodConfigPath);
const externalTargetPacket = dogfoodTarget.collectDogfoodTargetPacket({
  root: dogfoodTargetRepoRoot,
  mode: "command-only",
  repositoryConfigFile: externalDogfoodConfigPath,
});
assert.equal(externalTargetPacket.ready, true);
assert.equal(externalTargetPacket.configFile, "[external-config]/target.yml");
assert.equal(JSON.stringify(externalTargetPacket).includes(externalDogfoodConfigDir), false);
assert.throws(
  () =>
    dogfoodTarget.collectDogfoodTargetPacket({
      root: dogfoodTargetRepoRoot,
      repositoryConfigFile: path.join(externalDogfoodConfigDir, "missing.yml"),
    }),
  (error) =>
    /Unable to read repository config \[external-config\]\/missing\.yml/.test(error.message) &&
    !error.message.includes(externalDogfoodConfigDir)
);
assert.deepEqual(
  dogfoodTargetCli.parseArgs([
    "--",
    "--mode",
    "auto",
    "--repository-config",
    "target.yml",
    "--repository",
    "6529-Collections/example",
    "--json",
    "--quiet",
    "--require-ready",
  ]),
  {
    json: true,
    mode: "auto",
    quiet: true,
    repositoryConfigFile: "target.yml",
    requireReady: true,
    targetRepository: "6529-Collections/example",
  }
);
assert.equal(dogfoodTargetCli.main(["--mode", "command-only", "--require-ready", "--quiet"]).ready, true);
const dogfoodReport = dogfoodReadiness.collectDogfoodReadiness({
  now: new Date("2026-06-13T00:00:00.000Z"),
});
assert.equal(dogfoodReport.ready, true);
assert.equal(dogfoodReport.checks.repositoryConfigs.count, 3);
assert.equal(dogfoodReport.checks.budgetPolicies.enabledPolicyCount > 0, true);
assert.equal(dogfoodReport.checks.modelCatalog.defaultModel, "claude-opus-4-8");
assert.equal(
  JSON.stringify(dogfoodReport).includes("123456789012"),
  false
);
const dogfoodMarkdown = dogfoodReadiness.formatDogfoodReadinessMarkdown(dogfoodReport);
assert.match(dogfoodMarkdown, /Dogfood Readiness/);
assert.match(dogfoodMarkdown, /templates\/dogfood-command-only-config.yml/);
const dogfoodPreflightReport = dogfoodReadiness.collectDogfoodReadiness({
  env: {},
  includePreflight: true,
  now: new Date("2026-06-13T00:00:00.000Z"),
});
assert.equal(dogfoodPreflightReport.ready, false);
assert.equal(dogfoodPreflightReport.checks.preflight.ok, false);
assert.deepEqual(
  dogfoodReadinessCli.parseArgs([
    "--repository-config",
    "one.yml",
    "--repository-config",
    "two.yml",
    "--budget-policy-file",
    "budgets.json",
    "--model-catalog-file",
    "catalog.json",
    "--operator-workspace",
    "workspace",
    "--require-operator-workspace-ready",
    "--strict-preflight",
    "--json",
    "--quiet",
    "--require-ready",
  ]),
  {
    budgetPolicyFile: "budgets.json",
    includePreflight: true,
    json: true,
    modelCatalogFile: "catalog.json",
    modelPriceFile: undefined,
    allowStaleModelPriceSource: false,
    allowZeroModelPrice: false,
    maxModelPriceSourceAgeDays: undefined,
    operatorWorkspaceDir: "workspace",
    preflightProfile: "server",
    quiet: true,
    requireOperatorWorkspaceReady: true,
    repositoryConfigFiles: ["one.yml", "two.yml"],
    requireReady: true,
    strictPreflight: true,
  }
);
assert.deepEqual(
  dogfoodReadinessCli.parseArgs([
    "--model-price-file",
    "prices.json",
    "--allow-stale-model-price-source",
    "--allow-zero-model-price",
    "--max-model-price-source-age-days",
    "14",
  ]),
  {
    budgetPolicyFile: undefined,
    includePreflight: false,
    json: false,
    modelCatalogFile: undefined,
    modelPriceFile: "prices.json",
    allowStaleModelPriceSource: true,
    allowZeroModelPrice: true,
    maxModelPriceSourceAgeDays: 14,
    operatorWorkspaceDir: undefined,
    preflightProfile: "server",
    quiet: false,
    requireOperatorWorkspaceReady: false,
    requireReady: false,
    strictPreflight: false,
  }
);
const promotionReplayRunner = () => ({
  status: 0,
  stdout: "self dogfood replay ok (8 trusted command cases checked; 2 multi-lane jobs checked; max-fanout guard checked; untrusted command denied)\n",
  stderr: "",
});
const dogfoodPromotionPublicPacket = dogfoodPromotion.collectDogfoodPromotionPacket({
  now: new Date("2026-06-13T00:00:00.000Z"),
  root: dogfoodTargetRepoRoot,
  selfDogfoodReplayRunner: promotionReplayRunner,
  targetRepository: "6529-Collections/example",
});
assert.equal(dogfoodPromotionPublicPacket.ready, false);
assert.equal(dogfoodPromotionPublicPacket.summary.warnings, 2);
assert.equal(dogfoodPromotionPublicPacket.checks.selfDogfoodReplay.status, "ok");
assert.match(
  dogfoodPromotion.formatDogfoodPromotionMarkdown(dogfoodPromotionPublicPacket),
  /Dogfood Promotion Packet/
);
assert.throws(
  () => dogfoodPromotion.assertDogfoodPromotionReady(dogfoodPromotionPublicPacket),
  /operator-workspace/
);
const dogfoodPromotionWorkspaceDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "6529-promotion-workspace-")
);
operatorWorkspace.createOperatorWorkspace({
  directory: dogfoodPromotionWorkspaceDir,
  repoRoot: dogfoodTargetRepoRoot,
});
const promotionPreflightEnv = {
  GITHUB_WEBHOOK_SECRET: "secret",
  REVIEW_PROVIDER: "anthropic",
  REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8",
  REVIEWBOT_WORKER_ADAPTER: "noop",
  REVIEW_USAGE_ENABLED: "false",
  REVIEWBOT_JOB_LEDGER_ENABLED: "false",
  REVIEWBOT_ALERTS_ENABLED: "false",
  REVIEWBOT_ADMIN_AUTH_MODE: "disabled",
};
const dogfoodPromotionReadyPacket = dogfoodPromotion.collectDogfoodPromotionPacket({
  env: promotionPreflightEnv,
  includePreflight: true,
  now: new Date("2026-06-13T00:00:00.000Z"),
  operatorWorkspaceDir: dogfoodPromotionWorkspaceDir,
  root: dogfoodTargetRepoRoot,
  selfDogfoodReplayRunner: promotionReplayRunner,
});
assert.equal(dogfoodPromotionReadyPacket.ready, true);
assert.equal(dogfoodPromotionReadyPacket.summary.errors, 0);
assert.equal(JSON.stringify(dogfoodPromotionReadyPacket).includes(dogfoodPromotionWorkspaceDir), false);
assert.deepEqual(
  dogfoodPromotionCli.parseArgs([
    "--",
    "--mode",
    "auto",
    "--repository-config",
    "target.yml",
    "--repository",
    "6529-Collections/example",
    "--operator-workspace",
    "workspace",
    "--strict-preflight",
    "--json",
    "--quiet",
    "--require-ready",
  ]),
  {
    budgetPolicyFile: undefined,
    includePreflight: true,
    json: true,
    mode: "auto",
    modelCatalogFile: undefined,
    modelPriceFile: undefined,
    allowStaleModelPriceSource: false,
    allowZeroModelPrice: false,
    maxModelPriceSourceAgeDays: undefined,
    operatorWorkspaceDir: "workspace",
    preflightProfile: "server",
    quiet: true,
    repositoryConfigFile: "target.yml",
    requireOperatorWorkspaceReady: false,
    requireReady: true,
    skipSelfDogfoodReplay: false,
    strictPreflight: true,
    targetRepository: "6529-Collections/example",
  }
);
assert.equal(
  dogfoodPromotionCli.main(["--skip-self-dogfood-replay", "--quiet"]).ready,
  false
);
const dogfoodGoLivePublicPacket = dogfoodGoLive.collectDogfoodGoLivePacket({
  now: new Date("2026-06-13T00:00:00.000Z"),
  root: dogfoodTargetRepoRoot,
  selfDogfoodReplayRunner: promotionReplayRunner,
});
assert.equal(dogfoodGoLivePublicPacket.ready, false);
assert.equal(dogfoodGoLivePublicPacket.gates.length, 4);
assert.equal(dogfoodGoLivePublicPacket.gates[0].status, "warning");
assert.match(
  dogfoodGoLive.formatDogfoodGoLiveMarkdown(dogfoodGoLivePublicPacket),
  /Dogfood Go-Live Packet/
);
assert.throws(
  () => dogfoodGoLive.assertDogfoodGoLiveReady(dogfoodGoLivePublicPacket),
  /strict preflight/
);
const dogfoodGoLiveWorkspacePacket = dogfoodGoLive.collectDogfoodGoLivePacket({
  env: promotionPreflightEnv,
  now: new Date("2026-06-13T00:00:00.000Z"),
  operatorWorkspaceDir: dogfoodPromotionWorkspaceDir,
  root: dogfoodTargetRepoRoot,
  selfDogfoodReplayRunner: promotionReplayRunner,
});
assert.equal(dogfoodGoLiveWorkspacePacket.ready, false);
assert.equal(
  dogfoodGoLiveWorkspacePacket.gates.find((item) => item.id === "dogfood-promotion").status,
  "ok"
);
assert.equal(
  dogfoodGoLiveWorkspacePacket.gates.find((item) => item.id === "release-candidate").status,
  "error"
);
assert.equal(JSON.stringify(dogfoodGoLiveWorkspacePacket).includes(dogfoodPromotionWorkspaceDir), false);
assert.deepEqual(
  dogfoodGoLive.operatorWorkspaceFilePaths("workspace"),
  {
    communityReleaseStatus: path.join("workspace", "community-release-status.json"),
    dogfoodStatus: path.join("workspace", "dogfood-status.json"),
    operatorEvidence: path.join("workspace", "operator-evidence.json"),
    productionCutoverStatus: path.join("workspace", "production-cutover-status.json"),
    readme: path.join("workspace", "README.md"),
    releaseGateStatus: path.join("workspace", "v0-release-status.json"),
    securityReviewStatus: path.join("workspace", "security-review-status.json"),
  }
);
assert.deepEqual(
  dogfoodGoLiveCli.parseArgs([
    "--",
    "--operator-workspace",
    "workspace",
    "--repository",
    "6529-Collections/example",
    "--strict-preflight",
    "--require-ready",
    "--json",
    "--quiet",
  ]),
  {
    budgetPolicyFile: "",
    cutoverStatusFile: "",
    dogfoodStatusFile: "",
    gateStatusFile: "",
    help: false,
    includeGitStatus: false,
    json: true,
    mode: "command-only",
    modelCatalogFile: "",
    modelPriceFile: "",
    allowStaleModelPriceSource: false,
    allowZeroModelPrice: false,
    maxModelPriceSourceAgeDays: undefined,
    operatorEvidenceFile: "",
    operatorWorkspaceDir: "workspace",
    out: "",
    preflightProfile: "server",
    quiet: true,
    repositoryConfigFile: "",
    requireOperatorWorkspaceReady: false,
    requireReady: true,
    securityReviewStatusFile: "",
    skipPreflight: false,
    skipSelfDogfoodReplay: false,
    strictPreflight: true,
    targetRepository: "6529-Collections/example",
  }
);
assert.throws(
  () => dogfoodGoLiveCli.parseArgs(["--require-ready"]),
  /requires --strict-preflight/
);
assert.throws(
  () => dogfoodGoLiveCli.parseArgs(["--strict-preflight", "--skip-preflight", "--require-ready"]),
  /cannot be used with --skip-preflight/
);
assert.equal(dogfoodGoLiveCli.main(["--skip-self-dogfood-replay", "--quiet"]).ready, false);
const dogfoodChecklist = dogfoodStatus.loadDogfoodChecklist("config/dogfood-checklist.json");
assert.equal(dogfoodChecklist.release, "v0.1.0");
assert.equal(dogfoodChecklist.phases.length, 5);
assert.equal(dogfoodChecklist.phases.flatMap((phase) => phase.items).length, 23);
const dogfoodExampleStatus = dogfoodStatus.loadDogfoodStatus("config/dogfood-status.example.json");
const dogfoodWithStatus = dogfoodStatus.mergeDogfoodStatus(dogfoodChecklist, dogfoodExampleStatus, {
  requireComplete: true,
});
const dogfoodSummary = dogfoodStatus.summarizeDogfood(dogfoodWithStatus);
assert.equal(dogfoodSummary.ready, false);
assert.equal(dogfoodSummary.complete, 1);
assert.equal(dogfoodSummary.deferred, 4);
assert.equal(dogfoodSummary.pending, 18);
assert.equal(dogfoodStatus.missingDogfoodStatusIds(dogfoodChecklist, dogfoodExampleStatus).length, 0);
assert.match(dogfoodStatus.renderDogfoodMarkdown(dogfoodWithStatus), /Dogfood Execution/);
assert.match(dogfoodStatus.renderDogfoodSummaryMarkdown(dogfoodWithStatus), /Ready for next dogfood step: no/);
const readyDogfoodStatus = dogfoodStatus.validateDogfoodStatus({
  version: 1,
  release: "v0.1.0",
  items: Object.fromEntries(
    dogfoodChecklist.phases.flatMap((phase) =>
      phase.items.map((item) => [
        item.id,
        {
          status: "complete",
          evidence: `public-safe dogfood evidence for ${item.id}`,
        },
      ])
    )
  ),
});
assert.equal(
  dogfoodStatus.assertDogfoodReady(dogfoodStatus.mergeDogfoodStatus(dogfoodChecklist, readyDogfoodStatus)).ready,
  true
);
assert.throws(() => dogfoodStatus.assertDogfoodReady(dogfoodWithStatus), /dogfood execution is not ready/);
const dogfoodSkeletonPath = path.join(os.tmpdir(), `6529-dogfood-${Date.now()}.json`);
dogfoodStatus.writeDogfoodStatusFile(
  dogfoodSkeletonPath,
  dogfoodStatus.createDogfoodStatusSkeleton(dogfoodChecklist)
);
assert.equal(dogfoodStatus.loadDogfoodStatus(dogfoodSkeletonPath).items["reviewed-bot-commit"].status, "pending");
assert.deepEqual(
  dogfoodStatusCli.parseArgs([
    "--",
    "--file",
    "dogfood.json",
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
    file: "dogfood.json",
    force: true,
    initStatusFile: "new-status.json",
    json: true,
    quiet: true,
    requireReady: true,
    statusFile: "status.json",
    summary: true,
  }
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
const providerErrorSummary = reviewBot.providerErrorSummary({
  error: {
    type: "provider_error",
    message: [
      "failed with Bearer abcdefghijklmnopqrstuvwxyz123456",
      "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
      "sk-proj-abcdefghijklmnopqrstuvwx123456",
      "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
    ].join(", "),
  },
});
assert(providerErrorSummary.includes("Bearer [redacted]"));
assert(providerErrorSummary.includes("github_pat_[redacted]"));
assert(providerErrorSummary.includes("sk-[redacted]"));
assert(providerErrorSummary.includes("[redacted-private-key]"));
assert.equal(providerErrorSummary.includes("sk-proj-"), false);
const cliSecret = "sk-proj-abcdefghijklmnopqrstuvwx123456";
const cliFatal = runCliForSmoke(["bin/preflight.cjs", cliSecret]);
assert.equal(cliFatal.status, 1);
assert(cliFatal.stderr.includes("sk-[redacted]"));
assert.equal(cliFatal.stderr.includes(cliSecret), false);
assert.equal(cliFatal.stderr.includes("\n    at "), false);
const catalogSecretPath = "github_pat_abcdefghijklmnopqrstuvwxyz1234567890.json";
const catalogFatal = runCliForSmoke([
  "bin/validate-model-catalog.cjs",
  catalogSecretPath,
]);
assert.equal(catalogFatal.status, 1);
assert(catalogFatal.stderr.includes("github_pat_[redacted]"));
assert.equal(catalogFatal.stderr.includes("github_pat_abcdefghijklmnopqrstuvwxyz"), false);

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
const redactedJobEvent = jobLedger.normalizeJobLedgerEvent({
  jobId: "rj_redacted",
  status: "dispatch_error",
  stage: "dispatch",
  repoFullName: "6529-Collections/example",
  reviewKind: "general",
  provider: "anthropic",
  model: "claude-opus-4-8",
  reason:
    "failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
  metadata: {
    detail:
      "failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
  },
});
assert(redactedJobEvent.reason.includes("Bearer [redacted]"));
assert(redactedJobEvent.reason.includes("sk-[redacted]"));
assert.equal(redactedJobEvent.reason.includes("sk-proj-"), false);
assert.equal(redactedJobEvent.metadata.detail.includes("sk-proj-"), false);
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
assert.equal(
  appDispatchPreflight.checks.find((check) => check.name === "worker_adapter")
    .githubDispatchAppCredentialSource,
  "main"
);
assert(
  appDispatchPreflight.warnings.some((warning) =>
    warning.message.includes("reuse the main GitHub App credentials")
  )
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
  splitDispatchAppPreflight.checks.find((check) => check.name === "worker_adapter")
    .githubDispatchAppCredentialSource,
  "worker-dispatch"
);
assert.equal(
  splitDispatchAppPreflight.warnings.some((warning) =>
    warning.message.includes("reuse the main GitHub App credentials")
  ),
  false
);
assert(
  preflight
    .runPreflight({
      env: {
        ...preflightEnv,
        REVIEWBOT_GITHUB_APP_ID: "main-app",
        REVIEWBOT_GITHUB_APP_PRIVATE_KEY: "main-key",
        REVIEWBOT_WORKER_GITHUB_APP_ID: "dispatch-app",
        REVIEWBOT_WORKER_ADAPTER: "github_actions",
        REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
        REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE: "api",
        REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "777",
      },
    })
    .errors.some((error) => error.message.includes("Worker dispatch GitHub App override"))
);
assert.equal(
  githubAppAuth.githubAppAuthSettingsFromWorkerDispatchEnv({
    REVIEWBOT_GITHUB_APP_ID: "main-app",
    REVIEWBOT_GITHUB_APP_PRIVATE_KEY: "main-key",
    REVIEWBOT_WORKER_GITHUB_APP_ID: "dispatch-app",
  }).privateKey,
  ""
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
const supportSummaryWithMalformedSafeValues = supportBundle.environmentSummary({
  REVIEW_MODEL: "sk-proj-abcdefghijklmnopqrstuvwxyz123456",
  REVIEWBOT_WORKER_GITHUB_REF: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
});
assert.equal(supportSummaryWithMalformedSafeValues.safe.REVIEW_MODEL, "sk-[redacted]");
assert.equal(
  supportSummaryWithMalformedSafeValues.safe.REVIEWBOT_WORKER_GITHUB_REF,
  "github_pat_[redacted]"
);
assert.equal(
  JSON.stringify(supportSummaryWithMalformedSafeValues).includes("abcdefghijklmnopqrstuvwxyz"),
  false
);
const supportPreflightSummary = supportBundle.preflightSummary({
  ok: false,
  errors: [
    {
      name: "test_error",
      message: "provider rejected Bearer abcdefghijklmnopqrstuvwxyz123456",
    },
  ],
  warnings: [
    {
      name: "test_warning",
      message: "check path sk-proj-abcdefghijklmnopqrstuvwxyz123456",
    },
  ],
});
assert.match(supportPreflightSummary.errors[0].message, /Bearer \[redacted\]/);
assert.match(supportPreflightSummary.warnings[0].message, /sk-\[redacted\]/);
assert.equal(JSON.stringify(supportPreflightSummary).includes("abcdefghijklmnopqrstuvwxyz"), false);
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
const supportBundleWithGitStatus = supportBundle.collectSupportBundle({
  env: supportEnv,
  includeGitStatus: true,
  now: new Date("2026-06-12T00:00:00.000Z"),
  execFileSync: (bin, args) => {
    if (args[0] === "rev-parse") {
      return "abc123\n";
    }
    if (args[0] === "branch") {
      return "feature/sk-proj-abcdefghijklmnopqrstuvwxyz\n";
    }
    if (args[0] === "status") {
      return [
        " M github_pat_abcdefghijklmnopqrstuvwxyz1234567890.txt",
        "?? docs/sk-proj-abcdefghijklmnopqrstuvwxyz.md",
      ].join("\n");
    }
    return "";
  },
});
const supportBundleWithGitStatusJson = JSON.stringify(supportBundleWithGitStatus);
const supportBundleWithGitStatusMarkdown = supportBundle.formatSupportBundleMarkdown(
  supportBundleWithGitStatus
);
assert.match(supportBundleWithGitStatus.git.branch, /sk-\[redacted\]/);
assert.match(supportBundleWithGitStatus.git.status, /github_pat_\[redacted\]/);
assert.match(supportBundleWithGitStatus.git.status, /sk-\[redacted\]/);
assert.equal(supportBundleWithGitStatusJson.includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.equal(supportBundleWithGitStatusMarkdown.includes("abcdefghijklmnopqrstuvwxyz"), false);
const handBuiltSupportBundleMarkdown = supportBundle.formatSupportBundleMarkdown({
  generatedAt: "2026-06-12T00:00:00.000Z",
  package: { name: "@6529/6529reviewbot", version: "0.1.0" },
  runtime: { node: "v24.0.0", platform: "linux", arch: "x64", osRelease: "test" },
  git: {
    branch: "feature/sk-proj-abcdefghijklmnopqrstuvwxyz123456",
    commit: "abc123",
    status: "?? github_pat_abcdefghijklmnopqrstuvwxyz1234567890.txt",
  },
  environment: {
    safe: { REVIEW_MODEL: "sk-proj-abcdefghijklmnopqrstuvwxyz123456" },
    presence: { OPENAI_API_KEY: "set" },
  },
  preflight: supportPreflightSummary,
});
assert.equal(handBuiltSupportBundleMarkdown.includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.match(handBuiltSupportBundleMarkdown, /sk-\[redacted\]/);
assert.match(handBuiltSupportBundleMarkdown, /github_pat_\[redacted\]/);
assert.deepEqual(supportBundleCli.parseArgs(["--", "--json", "--include-git-status", "--quiet"]), {
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
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "output C:\\private\\6529bot-app.json\n")[0]
    .rule,
  "local_private_path"
);
assert.equal(
  publicArtifactsCheck.scanFile(
    "docs/example.md",
    String.raw`{"output":"C:\\private\\6529bot-app.json"}`
  )[0].rule,
  "local_private_path"
);
assert.equal(
  publicArtifactsCheck.scanFile(
    "docs/example.md",
    "output C:/Users/operator/6529bot-app.json\n"
  )[0].rule,
  "local_private_path"
);
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "output /home/operator/6529bot-app.json\n")[0]
    .rule,
  "local_private_path"
);
assert.equal(
  publicArtifactsCheck.scanFile("docs/example.md", "checkout D:\\repos\\6529reviewbot\n").length,
  0
);
assert.equal(
  publicArtifactsCheck.scanFile(
    "docs/example.md",
    "Use `reviewbot.example.com` only in explanatory prose.\n"
  ).length,
  0
);
assert.equal(
  publicArtifactsCheck.scanFile(
    "docs/example.md",
    "```bash\nnpm run admin:snapshot -- -- --base-url https://reviewbot.example.com\n```\n"
  )[0].rule,
  "reserved_bot_host_shell_command"
);
assert.equal(containerImageCheck.checkContainerImage().runtimeCopies, 6);
const containerPublishPlanContractResult =
  containerPublishPlanContractCheck.checkContainerPublishPlanContract();
assert.equal(containerPublishPlanContractResult.planCases, 6);
assert.equal(containerPublishPlanContractResult.docs, 6);
assert.throws(
  () =>
    containerPublishPlanContractCheck.checkContainerPublishPlanContract({
      quiet: true,
      docTexts: {
        "docs/container-publish-plan.md": "# Container Publish Plan\n",
      },
    }),
  /container publish plan contract check found/
);
assert.match(
  containerImageCheck
    .checkDockerfile(
      "FROM node:22-bookworm-slim AS runtime\nCOPY . .\nCMD [\"node\", \"bin/server.cjs\"]\n"
    )
    .join("\n"),
  /COPY \./
);
assert.match(
  containerImageCheck.checkDockerignore(".git\n.env\n!docs\n").join("\n"),
  /re-include/
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
const alertsGate = gates.gates.find((gate) => gate.id === "alerts");
assert.match(alertsGate.title, /reviewed alert delivery plan evidence/);
assert.equal(alertsGate.evidence, "docs/alert-delivery-plan.md");
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
const sensitiveGateStatus = releaseGates.validateReleaseGateStatus({
  version: 1,
  release: gates.release,
  gates: {
    "ledger-schema": {
      status: "complete",
      evidence: "Private evidence github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    },
    "model-prices": {
      status: "deferred",
      notes: "Accepted stale source with sk-proj-abcdefghijklmnopqrstuvwxyz123456",
    },
  },
});
assert.match(sensitiveGateStatus.gates["ledger-schema"].statusEvidence, /github_pat_\[redacted\]/);
assert.match(sensitiveGateStatus.gates["model-prices"].notes, /sk-\[redacted\]/);
assert.equal(JSON.stringify(sensitiveGateStatus).includes("abcdefghijklmnopqrstuvwxyz"), false);
const sensitiveGatesMarkdown = releaseGates.renderReleaseGatesMarkdown(
  releaseGates.mergeReleaseGateStatus(gates, sensitiveGateStatus)
);
assert.equal(sensitiveGatesMarkdown.includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.match(sensitiveGatesMarkdown, /github_pat_\[redacted\]/);
assert.match(sensitiveGatesMarkdown, /sk-\[redacted\]/);
const longEvidenceTail = "x".repeat(1200);
const longNotesTail = "y".repeat(1200);
const longGateStatus = releaseGates.validateReleaseGateStatus({
  version: 1,
  release: gates.release,
  gates: {
    "ledger-schema": {
      status: "complete",
      evidence: `github_pat_abcdefghijklmnopqrstuvwxyz1234567890 ${longEvidenceTail}`,
    },
    "model-prices": {
      status: "deferred",
      notes: `sk-proj-abcdefghijklmnopqrstuvwxyz123456 ${longNotesTail}`,
    },
  },
});
assert.equal(longGateStatus.gates["ledger-schema"].statusEvidence.length, 1000);
assert.equal(longGateStatus.gates["model-prices"].notes.length, 1000);
const longGatesMarkdown = releaseGates.renderReleaseGatesMarkdown(
  releaseGates.mergeReleaseGateStatus(gates, longGateStatus)
);
assert.equal(longGatesMarkdown.includes("x".repeat(1001)), false);
assert.equal(longGatesMarkdown.includes("y".repeat(1001)), false);
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
assert.throws(
  () => releaseGates.validateReleaseGateStatus({
    version: 1,
    gates: { "ledger-schema": { status: "" } },
  }),
  /release gate status\.gates\.ledger-schema\.status must be a non-empty string/
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
const productionEvidenceExample = operatorEvidence.loadOperatorEvidence(
  "config/production-evidence.example.json"
);
assert.equal(productionEvidenceExample.release, "v0.1.0");
assert.equal(productionEvidenceExample.sections.length, operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.length);
const productionEvidenceSummary = operatorEvidence.summarizeOperatorEvidence(productionEvidenceExample);
assert.equal(productionEvidenceSummary.ready, false);
assert.equal(
  productionEvidenceSummary.pending,
  operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.length - 1
);
assert.equal(productionEvidenceSummary.deferred, 1);
assert.match(
  operatorEvidence.renderOperatorEvidenceSummaryMarkdown(productionEvidenceExample),
  /Production cutover summary: 2\/32 complete/
);
const sensitiveOperatorEvidence = operatorEvidence.validateOperatorEvidence({
  version: 1,
  release: "v0.1.0",
  summary: {
    date: "2026-06-12",
    operator: "maintainer",
    commit: "abc123",
    environment: "prod arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
    privateEvidenceLocation: "private runbook 123456789012",
  },
  sections: Object.fromEntries(
    operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.map((section) => [
      section.id,
      {
        status: "complete",
        evidence: [
          `Evidence for ${section.id} with github_pat_abcdefghijklmnopqrstuvwxyz1234567890`,
          "cluster arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
        ],
      },
    ])
  ),
});
const sensitiveOperatorEvidenceMarkdown =
  operatorEvidence.renderOperatorEvidenceSummaryMarkdown(sensitiveOperatorEvidence);
const sensitiveOperatorEvidenceJson = JSON.stringify(
  operatorEvidence.publicOperatorEvidenceDocument(sensitiveOperatorEvidence)
);
assert.equal(sensitiveOperatorEvidenceMarkdown.includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.equal(sensitiveOperatorEvidenceMarkdown.includes("123456789012"), false);
assert.equal(sensitiveOperatorEvidenceMarkdown.includes("arn:aws:rds"), false);
assert.equal(sensitiveOperatorEvidenceJson.includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.equal(sensitiveOperatorEvidenceJson.includes("123456789012"), false);
assert.equal(sensitiveOperatorEvidenceJson.includes("arn:aws:rds"), false);
assert.match(sensitiveOperatorEvidenceMarkdown, /github_pat_\[redacted\]/);
assert.match(sensitiveOperatorEvidenceMarkdown, /arn:aws:\[redacted\]/);
assert.match(sensitiveOperatorEvidenceMarkdown, /\[redacted-aws-account-id\]/);
assert.equal(operatorEvidence.assertOperatorEvidenceReady(sensitiveOperatorEvidence).ready, true);
assert.throws(
  () => operatorEvidence.assertOperatorEvidenceReady(productionEvidenceExample),
  /operator evidence is not ready/
);
assert.throws(
  () =>
    operatorEvidence.validateOperatorEvidence({
      version: 1,
      release: "v0.1.0",
      summary: {
        date: "2026-06-12",
        operator: "maintainer",
        commit: "abc123",
        environment: "prod",
        privateEvidenceLocation: "private runbook",
      },
      sections: Object.fromEntries(
        operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.map((section) => [
          section.id,
          {
            status: section.id === "github-app" ? "" : "pending",
          },
        ])
      ),
    }),
  /operator evidence\.sections\.github-app\.status must be a non-empty string/
);
assert.throws(
  () =>
    operatorEvidence.assertOperatorEvidenceReady({
      version: 1,
      release: "v0.1.0",
      summary: {
        date: "2026-06-12",
        operator: "maintainer",
        commit: "abc123",
        environment: "prod",
        privateEvidenceLocation: "private runbook",
      },
      sections: [],
    }),
  /operator evidence\.sections must be an object/
);
assert.throws(
  () =>
    operatorEvidence.validateOperatorEvidence({
      version: 1,
      release: "v0.1.0",
      summary: {
        date: "2026-06-12",
        operator: "maintainer",
        commit: "abc123",
        environment: "prod",
        privateEvidenceLocation: "private runbook",
      },
      sections: {
        "github-app": {
          status: "complete",
        },
      },
    }),
  /evidence/
);
assert.deepEqual(
  operatorEvidenceCli.parseArgs([
    "--",
    "--file",
    "evidence.json",
    "--json",
    "--quiet",
    "--summary",
    "--require-ready",
  ]),
  {
    file: "evidence.json",
    json: true,
    quiet: true,
    requireReady: true,
    summary: true,
  }
);
const operatorEvidenceSkeleton = operatorEvidence.createOperatorEvidenceSkeleton({
  commit: "abc123",
  date: "2026-06-12",
  environment: "dogfood",
  operator: "maintainer",
  privateEvidenceLocation: "private runbook",
});
assert.equal(
  operatorEvidence.summarizeOperatorEvidence(operatorEvidenceSkeleton).pending,
  operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.length
);
const operatorWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-operator-workspace-"));
const workspace = operatorWorkspace.createOperatorWorkspace({
  commit: "abc123",
  date: "2026-06-12",
  directory: operatorWorkspaceDir,
  environment: "dogfood",
  operator: "maintainer",
  privateEvidenceLocation: "private runbook",
  repoRoot: path.resolve(__dirname, ".."),
});
assert.equal(workspace.files.length, 7);
assert.equal(workspace.summaries.communityRelease.pending, 14);
assert.equal(workspace.summaries.releaseGates.pending, 20);
assert.equal(
  workspace.summaries.operatorEvidence.pending,
  operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.length
);
assert.equal(workspace.ready, false);
assert.equal(fs.existsSync(path.join(operatorWorkspaceDir, "community-release-status.json")), true);
assert.equal(fs.existsSync(path.join(operatorWorkspaceDir, "v0-release-status.json")), true);
assert.equal(fs.existsSync(path.join(operatorWorkspaceDir, "operator-evidence.json")), true);
assert.match(
  fs.readFileSync(path.join(operatorWorkspaceDir, "README.md"), "utf8"),
  /npm run release:candidate -- -- --operator-workspace \. --strict-preflight/
);
assert.match(
  fs.readFileSync(path.join(operatorWorkspaceDir, "README.md"), "utf8"),
  /npm --silent run dogfood:go-live -- -- --operator-workspace \. --model-price-file <reviewed-model-price-file\.json> --strict-preflight --require-ready/
);
assert.match(
  operatorWorkspace.renderOperatorWorkspaceSummaryMarkdown(workspace),
  /Created private release-operator evidence skeletons/
);
assert.equal(
  operatorWorkspace.publicOperatorWorkspaceSummary(workspace).directory,
  "[operator-workspace]"
);
const checkedWorkspace = operatorWorkspace.checkOperatorWorkspace({ directory: operatorWorkspaceDir });
assert.equal(checkedWorkspace.ready, false);
assert.equal(checkedWorkspace.summaries.securityReview.pending, 33);
const dogfoodWorkspaceReport = dogfoodReadiness.collectDogfoodReadiness({
  now: new Date("2026-06-13T00:00:00.000Z"),
  operatorWorkspaceDir,
});
assert.equal(dogfoodWorkspaceReport.ready, true);
assert.equal(dogfoodWorkspaceReport.checks.operatorWorkspace.status, "ok");
assert.equal(dogfoodWorkspaceReport.checks.operatorWorkspace.ready, false);
assert.equal(dogfoodWorkspaceReport.checks.operatorWorkspace.directory, "[operator-workspace]");
assert.equal(JSON.stringify(dogfoodWorkspaceReport).includes(operatorWorkspaceDir), false);
const dogfoodWorkspaceMarkdown = dogfoodReadiness.formatDogfoodReadinessMarkdown(dogfoodWorkspaceReport);
assert.match(dogfoodWorkspaceMarkdown, /Operator Workspace/);
assert.match(dogfoodWorkspaceMarkdown, /dogfood: not ready/);
const dogfoodWorkspaceReadyReport = dogfoodReadiness.collectDogfoodReadiness({
  now: new Date("2026-06-13T00:00:00.000Z"),
  operatorWorkspaceDir,
  requireOperatorWorkspaceReady: true,
});
assert.equal(dogfoodWorkspaceReadyReport.ready, false);
assert.equal(dogfoodWorkspaceReadyReport.checks.operatorWorkspace.status, "error");
assert.equal(JSON.stringify(dogfoodWorkspaceReadyReport).includes(operatorWorkspaceDir), false);
const dogfoodMissingWorkspaceReport = dogfoodReadiness.collectDogfoodReadiness({
  now: new Date("2026-06-13T00:00:00.000Z"),
  operatorWorkspaceDir: path.join(operatorWorkspaceDir, "missing"),
});
assert.equal(dogfoodMissingWorkspaceReport.ready, false);
assert.equal(dogfoodMissingWorkspaceReport.checks.operatorWorkspace.status, "error");
assert.equal(JSON.stringify(dogfoodMissingWorkspaceReport).includes(operatorWorkspaceDir), false);
assert.throws(
  () => operatorWorkspace.checkOperatorWorkspace({ directory: operatorWorkspaceDir, requireReady: true }),
  /release gates are not ready/
);
assert.throws(
  () =>
    operatorWorkspace.createOperatorWorkspace({
      directory: path.resolve(__dirname, "..", "tmp", "operator-workspace"),
      repoRoot: path.resolve(__dirname, ".."),
    }),
  /outside the public repository/
);
assert.deepEqual(
  operatorWorkspaceCli.parseArgs([
    "--",
    "--dir",
    "private",
    "--operator",
    "maintainer",
    "--environment",
    "dogfood",
    "--commit",
    "abc123",
    "--date",
    "2026-06-12",
    "--private-evidence-location",
    "runbook",
    "--public-summary-location",
    "release PR",
    "--release",
    "v0.1.0",
    "--force",
    "--json",
    "--show-paths",
    "--quiet",
  ]),
  {
    allowRepoDir: false,
    check: false,
    commit: "abc123",
    date: "2026-06-12",
    directory: "private",
    environment: "dogfood",
    force: true,
    json: true,
    operator: "maintainer",
    privateEvidenceLocation: "runbook",
    publicSummaryLocation: "release PR",
    quiet: true,
    release: "v0.1.0",
    requireReady: false,
    showPaths: true,
  }
);
assert.equal(
  operatorWorkspaceCli.main(["--dir", operatorWorkspaceDir, "--check", "--json", "--quiet"]).ready,
  false
);
assert.throws(
  () => operatorWorkspaceCli.main(["--dir", operatorWorkspaceDir, "--require-ready", "--quiet"]),
  /requires --check/
);
const productionCutoverChecklist = productionCutover.loadProductionCutoverChecklist(
  "config/production-cutover-checklist.json"
);
assert.equal(productionCutoverChecklist.release, "v0.1.0");
assert.equal(productionCutoverChecklist.phases.length, 7);
assert.equal(
  productionCutoverChecklist.phases.flatMap((phase) => phase.items).length,
  34
);
const productionCutoverStatus = productionCutover.loadProductionCutoverStatus(
  "config/production-cutover-status.example.json"
);
const productionCutoverWithStatus = productionCutover.mergeProductionCutoverStatus(
  productionCutoverChecklist,
  productionCutoverStatus,
  { requireComplete: true }
);
assert.equal(productionCutover.missingProductionCutoverStatusIds(
  productionCutoverChecklist,
  productionCutoverStatus
).length, 0);
const productionCutoverSummary = productionCutover.summarizeProductionCutover(productionCutoverWithStatus);
assert.equal(productionCutoverSummary.ready, false);
assert.equal(productionCutoverSummary.complete, 2);
assert.equal(productionCutoverSummary.deferred, 2);
assert.equal(productionCutoverSummary.pending, 30);
assert.match(
  productionCutover.renderProductionCutoverMarkdown(productionCutoverWithStatus),
  /Production Cutover/
);
assert.match(
  productionCutover.renderProductionCutoverSummaryMarkdown(productionCutoverWithStatus),
  /Ready to cut over: no/
);
const sensitiveCutoverStatus = productionCutover.validateProductionCutoverStatus({
  version: 1,
  release: "v0.1.0",
  items: {
    "reviewed-commit": {
      status: "complete",
      evidence:
        "private github_pat_abcdefghijklmnopqrstuvwxyz1234567890 arn:aws:rds:us-east-1:123456789012:cluster:reviewbot account 123456789012",
    },
  },
});
const sensitiveCutoverMarkdown = productionCutover.renderProductionCutoverMarkdown(
  productionCutover.mergeProductionCutoverStatus(productionCutoverChecklist, sensitiveCutoverStatus)
);
assert.equal(sensitiveCutoverMarkdown.includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.equal(sensitiveCutoverMarkdown.includes("123456789012"), false);
assert.equal(sensitiveCutoverMarkdown.includes("arn:aws:rds"), false);
assert.match(sensitiveCutoverMarkdown, /github_pat_\[redacted\]/);
assert.match(sensitiveCutoverMarkdown, /arn:aws:\[redacted\]/);
assert.match(sensitiveCutoverMarkdown, /\[redacted-aws-account-id\]/);
const readyCutoverStatus = productionCutover.validateProductionCutoverStatus({
  version: 1,
  release: "v0.1.0",
  items: Object.fromEntries(
    productionCutoverChecklist.phases.flatMap((phase) =>
      phase.items.map((item) => [
        item.id,
        {
          status: "complete",
          evidence: `public-safe completion evidence for ${item.id}`,
        },
      ])
    )
  ),
});
const readyCutover = productionCutover.mergeProductionCutoverStatus(
  productionCutoverChecklist,
  readyCutoverStatus,
  { requireComplete: true }
);
assert.equal(productionCutover.assertProductionCutoverReady(readyCutover).ready, true);
assert.throws(
  () => productionCutover.assertProductionCutoverReady(productionCutoverWithStatus),
  /production cutover is not ready/
);
assert.throws(
  () =>
    productionCutover.mergeProductionCutoverStatus(productionCutoverChecklist, {
      version: 1,
      release: "v0.1.0",
      items: {},
    }, { requireComplete: true }),
  /production cutover status is missing/
);
assert.throws(
  () =>
    productionCutover.validateProductionCutoverStatus({
      version: 1,
      items: {
        "reviewed-commit": {
          status: "complete",
        },
      },
    }),
  /evidence/
);
assert.throws(
  () =>
    productionCutover.validateProductionCutoverStatus({
      version: 1,
      items: {
        "reviewed-commit": {
          status: "blocked",
        },
      },
    }),
  /notes/
);
const cutoverSkeletonPath = path.join(os.tmpdir(), `6529-cutover-${Date.now()}.json`);
productionCutover.writeProductionCutoverStatusFile(
  cutoverSkeletonPath,
  productionCutover.createProductionCutoverStatusSkeleton(productionCutoverChecklist)
);
assert.equal(
  productionCutover.loadProductionCutoverStatus(cutoverSkeletonPath).items["reviewed-commit"].status,
  "pending"
);
assert.throws(
  () => productionCutover.writeProductionCutoverStatusFile(
    cutoverSkeletonPath,
    productionCutover.createProductionCutoverStatusSkeleton(productionCutoverChecklist)
  ),
  /already exists/
);
productionCutover.writeProductionCutoverStatusFile(
  cutoverSkeletonPath,
  productionCutover.createProductionCutoverStatusSkeleton(productionCutoverChecklist),
  { force: true }
);
assert.deepEqual(
  productionCutoverCli.parseArgs([
    "--",
    "--file",
    "cutover.json",
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
    file: "cutover.json",
    force: true,
    initStatusFile: "new-status.json",
    json: true,
    quiet: true,
    requireReady: true,
    statusFile: "status.json",
    summary: true,
  }
);
const securityReviewChecklist = securityReviewStatus.loadSecurityReviewChecklist(
  "config/security-review-checklist.json"
);
assert.equal(securityReviewChecklist.release, "v0.1.0");
assert.equal(securityReviewChecklist.phases.length, 8);
assert.equal(securityReviewChecklist.phases.flatMap((phase) => phase.items).length, 33);
const securityReviewExampleStatus = securityReviewStatus.loadSecurityReviewStatus(
  "config/security-review-status.example.json"
);
const securityReviewWithStatus = securityReviewStatus.mergeSecurityReviewStatus(
  securityReviewChecklist,
  securityReviewExampleStatus,
  { requireComplete: true }
);
const securityReviewSummary = securityReviewStatus.summarizeSecurityReview(securityReviewWithStatus);
assert.equal(securityReviewSummary.ready, false);
assert.equal(securityReviewSummary.complete, 1);
assert.equal(securityReviewSummary.pending, 32);
assert.equal(
  securityReviewStatus.missingSecurityReviewStatusIds(
    securityReviewChecklist,
    securityReviewExampleStatus
  ).length,
  0
);
assert.match(
  securityReviewStatus.renderSecurityReviewMarkdown(securityReviewWithStatus),
  /Security Review/
);
assert.match(
  securityReviewStatus.renderSecurityReviewSummaryMarkdown(securityReviewWithStatus),
  /Security review ready: no/
);
const readySecurityReviewStatus = securityReviewStatus.validateSecurityReviewStatus({
  version: 1,
  release: "v0.1.0",
  items: Object.fromEntries(
    securityReviewChecklist.phases.flatMap((phase) =>
      phase.items.map((item) => [
        item.id,
        {
          status: "complete",
          evidence: `public-safe security evidence for ${item.id}`,
        },
      ])
    )
  ),
});
assert.equal(
  securityReviewStatus.assertSecurityReviewReady(
    securityReviewStatus.mergeSecurityReviewStatus(securityReviewChecklist, readySecurityReviewStatus)
  ).ready,
  true
);
assert.throws(
  () => securityReviewStatus.assertSecurityReviewReady(securityReviewWithStatus),
  /security review is not ready/
);
const securityReviewSkeletonPath = path.join(os.tmpdir(), `6529-security-review-${Date.now()}.json`);
securityReviewStatus.writeSecurityReviewStatusFile(
  securityReviewSkeletonPath,
  securityReviewStatus.createSecurityReviewStatusSkeleton(securityReviewChecklist)
);
assert.equal(
  securityReviewStatus.loadSecurityReviewStatus(securityReviewSkeletonPath).items["review-scope-recorded"].status,
  "pending"
);
assert.deepEqual(
  securityReviewStatusCli.parseArgs([
    "--",
    "--file",
    "security.json",
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
    file: "security.json",
    force: true,
    initStatusFile: "new-status.json",
    json: true,
    quiet: true,
    requireReady: true,
    statusFile: "status.json",
    summary: true,
  }
);
const candidateBundle = releaseCandidate.collectReleaseCandidateBundle({
  env: preflightEnv,
  execFileSync: (_command, args) => {
    if (args[0] === "rev-parse") {
      return "abc123def456\n";
    }
    if (args[0] === "branch") {
      return "codex/sk-proj-abcdefghijklmnopqrstuvwxyz123456\n";
    }
    if (args[0] === "status") {
      return " M github_pat_abcdefghijklmnopqrstuvwxyz1234567890\n";
    }
    return "";
  },
  gateStatusFile: "config/v0-release-status.example.json",
  includeGitStatus: true,
  now: new Date("2026-06-12T00:00:00.000Z"),
});
assert.equal(candidateBundle.release, "v0.1.0");
assert.equal(candidateBundle.ready, false);
assert.equal(candidateBundle.readiness.releaseGates.complete, 1);
assert.equal(candidateBundle.readiness.releaseGates.deferred, 1);
assert(candidateBundle.readiness.releaseGates.missingStatusIds.includes("container-image"));
assert.equal(
  candidateBundle.readiness.operatorEvidence.pending,
  operatorEvidence.OPERATOR_EVIDENCE_SECTIONS.length - 1
);
assert.equal(candidateBundle.readiness.preflight.ok, true);
assert.equal(Object.prototype.hasOwnProperty.call(candidateBundle.readiness, "productionCutover"), false);
assert.match(candidateBundle.git.branch, /sk-\[redacted\]/);
assert.match(candidateBundle.git.status, /github_pat_\[redacted\]/);
const candidateBundleMarkdown = releaseCandidate.formatReleaseCandidateBundleMarkdown(candidateBundle);
assert.match(candidateBundleMarkdown, /Release Candidate Bundle/);
assert.match(candidateBundleMarkdown, /missing gate status ids/);
const candidateBundleWithCutover = releaseCandidate.collectReleaseCandidateBundle({
  env: preflightEnv,
  gateStatusFile: "config/v0-release-status.example.json",
  cutoverStatusFile: "config/production-cutover-status.example.json",
  now: new Date("2026-06-12T00:00:00.000Z"),
});
assert.equal(candidateBundleWithCutover.readiness.productionCutover.complete, 2);
assert.equal(candidateBundleWithCutover.readiness.productionCutover.deferred, 2);
assert.equal(candidateBundleWithCutover.readiness.productionCutover.pending, 30);
assert.deepEqual(candidateBundleWithCutover.readiness.productionCutover.missingStatusIds, []);
assert.equal(candidateBundleWithCutover.ready, false);
const candidateBundleWithCutoverMarkdown =
  releaseCandidate.formatReleaseCandidateBundleMarkdown(candidateBundleWithCutover);
assert.match(candidateBundleWithCutoverMarkdown, /production cutover: not ready/);
assert.match(candidateBundleWithCutoverMarkdown, /missing cutover status ids: none/);
const candidateBundleWithDogfood = releaseCandidate.collectReleaseCandidateBundle({
  env: preflightEnv,
  gateStatusFile: "config/v0-release-status.example.json",
  dogfoodStatusFile: "config/dogfood-status.example.json",
  now: new Date("2026-06-12T00:00:00.000Z"),
});
assert.equal(candidateBundleWithDogfood.readiness.dogfood.complete, 1);
assert.equal(candidateBundleWithDogfood.readiness.dogfood.deferred, 4);
assert.equal(candidateBundleWithDogfood.readiness.dogfood.pending, 18);
assert.deepEqual(candidateBundleWithDogfood.readiness.dogfood.missingStatusIds, []);
assert.equal(candidateBundleWithDogfood.ready, false);
const candidateBundleWithDogfoodMarkdown =
  releaseCandidate.formatReleaseCandidateBundleMarkdown(candidateBundleWithDogfood);
assert.match(candidateBundleWithDogfoodMarkdown, /dogfood: not ready/);
assert.match(candidateBundleWithDogfoodMarkdown, /missing dogfood status ids: none/);
const candidateBundleWithSecurityReview = releaseCandidate.collectReleaseCandidateBundle({
  env: preflightEnv,
  gateStatusFile: "config/v0-release-status.example.json",
  securityReviewStatusFile: "config/security-review-status.example.json",
  now: new Date("2026-06-12T00:00:00.000Z"),
});
assert.equal(candidateBundleWithSecurityReview.readiness.securityReview.complete, 1);
assert.equal(candidateBundleWithSecurityReview.readiness.securityReview.pending, 32);
assert.deepEqual(candidateBundleWithSecurityReview.readiness.securityReview.missingStatusIds, []);
assert.equal(candidateBundleWithSecurityReview.ready, false);
const candidateBundleWithSecurityReviewMarkdown =
  releaseCandidate.formatReleaseCandidateBundleMarkdown(candidateBundleWithSecurityReview);
assert.match(candidateBundleWithSecurityReviewMarkdown, /security review: not ready/);
assert.match(candidateBundleWithSecurityReviewMarkdown, /missing security review status ids: none/);
const candidateBundleFromWorkspace = releaseCandidateCli.main([
  "--operator-workspace",
  operatorWorkspaceDir,
  "--json",
  "--quiet",
], {
  env: preflightEnv,
  now: new Date("2026-06-12T00:00:00.000Z"),
});
assert.equal(candidateBundleFromWorkspace.ready, false);
assert.equal(candidateBundleFromWorkspace.readiness.releaseGates.pending, 20);
assert.equal(candidateBundleFromWorkspace.readiness.communityRelease.pending, 14);
assert.equal(candidateBundleFromWorkspace.readiness.dogfood.pending, 23);
assert.equal(candidateBundleFromWorkspace.readiness.securityReview.pending, 33);
assert.equal(candidateBundleFromWorkspace.readiness.productionCutover.pending, 34);
assert.deepEqual(candidateBundleFromWorkspace.readiness.communityRelease.missingStatusIds, []);
assert.deepEqual(candidateBundleFromWorkspace.readiness.dogfood.missingStatusIds, []);
assert.equal(JSON.stringify(candidateBundleFromWorkspace).includes(operatorWorkspaceDir), false);
assert.equal(candidateBundleFromWorkspace.inputs.releaseGateStatusFile, "[operator-workspace]/v0-release-status.json");
assert.equal(
  candidateBundleFromWorkspace.inputs.communityReleaseStatusFile,
  "[operator-workspace]/community-release-status.json"
);
assert.equal(candidateBundleFromWorkspace.inputs.operatorEvidenceFile, "[operator-workspace]/operator-evidence.json");
assert.equal(candidateBundleFromWorkspace.inputs.dogfoodStatusFile, "[operator-workspace]/dogfood-status.json");
assert.equal(
  candidateBundleFromWorkspace.inputs.securityReviewStatusFile,
  "[operator-workspace]/security-review-status.json"
);
assert.equal(
  candidateBundleFromWorkspace.inputs.productionCutoverStatusFile,
  "[operator-workspace]/production-cutover-status.json"
);
assert.equal(
  releaseCandidate.formatReleaseCandidateBundleMarkdown(candidateBundleFromWorkspace).includes(operatorWorkspaceDir),
  false
);
assert.equal(JSON.stringify(candidateBundle).includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.equal(candidateBundleMarkdown.includes("abcdefghijklmnopqrstuvwxyz"), false);
assert.match(
  releaseCandidate.publicText("arn:aws:rds:us-east-1:123456789012:cluster:reviewbot"),
  /arn:aws:\[redacted\]/
);
assert.match(
  releaseCandidate.publicText("account 123456789012"),
  /\[redacted-aws-account-id\]/
);
assert.throws(
  () =>
    releaseCandidate.collectReleaseCandidateBundle({
      env: preflightEnv,
      gateStatusFile: "config/v0-release-status.example.json",
      requireReady: true,
    }),
  /release candidate gate status is missing/
);
assert.deepEqual(
  releaseCandidateCli.parseArgs([
    "--",
    "--json",
    "--quiet",
    "--status-file",
    "status.json",
    "--operator-evidence-file",
    "evidence.json",
    "--operator-workspace",
    "workspace",
    "--community-gate-file",
    "community-gates.json",
    "--community-status-file",
    "community-status.json",
    "--dogfood-file",
    "dogfood.json",
    "--dogfood-status-file",
    "dogfood-status.json",
    "--security-review-file",
    "security.json",
    "--security-review-status-file",
    "security-status.json",
    "--cutover-file",
    "cutover.json",
    "--cutover-status-file",
    "cutover-status.json",
    "--strict-preflight",
    "--require-ready",
    "--profile",
    "worker",
    "--out",
    "bundle.json",
    "--include-git-status",
  ]),
  {
    communityGateStatusFile: "community-status.json",
    communityGatesFile: "community-gates.json",
    cutoverChecklistFile: "cutover.json",
    cutoverStatusFile: "cutover-status.json",
    dogfoodChecklistFile: "dogfood.json",
    dogfoodStatusFile: "dogfood-status.json",
    gateStatusFile: "status.json",
    gatesFile: "config/v0-release-gates.json",
    includeGitStatus: true,
    json: true,
    operatorEvidenceFile: "evidence.json",
    operatorWorkspaceDir: "workspace",
    out: "bundle.json",
    preflightProfile: "worker",
    quiet: true,
    requireReady: true,
    securityReviewChecklistFile: "security.json",
    securityReviewStatusFile: "security-status.json",
    strictPreflight: true,
  }
);
const releaseCandidateWorkspaceDefaults = releaseCandidateCli.applyOperatorWorkspaceDefaults(
  releaseCandidateCli.parseArgs(["--operator-workspace", "workspace"])
);
assert.equal(
  releaseCandidateWorkspaceDefaults.gateStatusFile,
  path.join("workspace", "v0-release-status.json")
);
assert.equal(
  releaseCandidateWorkspaceDefaults.communityGateStatusFile,
  path.join("workspace", "community-release-status.json")
);
assert.equal(
  releaseCandidateWorkspaceDefaults.operatorEvidenceFile,
  path.join("workspace", "operator-evidence.json")
);
assert.equal(
  releaseCandidateWorkspaceDefaults.dogfoodStatusFile,
  path.join("workspace", "dogfood-status.json")
);
assert.equal(
  releaseCandidateWorkspaceDefaults.securityReviewStatusFile,
  path.join("workspace", "security-review-status.json")
);
assert.equal(
  releaseCandidateWorkspaceDefaults.cutoverStatusFile,
  path.join("workspace", "production-cutover-status.json")
);
const releaseCandidateWorkspaceOverrides = releaseCandidateCli.applyOperatorWorkspaceDefaults(
  releaseCandidateCli.parseArgs([
    "--operator-workspace",
    "workspace",
    "--status-file",
    "status.json",
    "--operator-evidence-file",
    "evidence.json",
    "--community-status-file",
    "community-status.json",
    "--dogfood-status-file",
    "dogfood-status.json",
    "--security-review-status-file",
    "security-status.json",
    "--cutover-status-file",
    "cutover-status.json",
  ])
);
assert.equal(releaseCandidateWorkspaceOverrides.gateStatusFile, "status.json");
assert.equal(releaseCandidateWorkspaceOverrides.communityGateStatusFile, "community-status.json");
assert.equal(releaseCandidateWorkspaceOverrides.operatorEvidenceFile, "evidence.json");
assert.equal(releaseCandidateWorkspaceOverrides.dogfoodStatusFile, "dogfood-status.json");
assert.equal(releaseCandidateWorkspaceOverrides.securityReviewStatusFile, "security-status.json");
assert.equal(releaseCandidateWorkspaceOverrides.cutoverStatusFile, "cutover-status.json");
assert.equal(
  releaseCandidateCli.main(["--json", "--quiet"], {
    env: preflightEnv,
    now: new Date("2026-06-12T00:00:00.000Z"),
  }).release,
  "v0.1.0"
);
const operationsMap = releaseOperationsMap.loadReleaseOperationsMap();
const operationsSummary = releaseOperationsMap.summarizeReleaseOperationsMap(operationsMap);
assert.equal(operationsSummary.phaseCount >= 6, true);
assert.equal(operationsSummary.toolCount >= 20, true);
const operationsMarkdown = releaseOperationsMap.renderReleaseOperationsMapMarkdown(operationsMap, {
  phase: "release-candidate",
});
assert.match(operationsMarkdown, /Release candidate and tagging/);
assert.match(operationsMarkdown, /npm run release:candidate/);
assert.throws(
  () =>
    releaseOperationsMap.validateReleaseOperationsMap({
      version: 1,
      title: "bad map",
      description: "bad args",
      phases: [{
        id: "bad-phase",
        title: "Bad Phase",
        when: "Never.",
        boundary: "Public.",
        tools: [{
          id: "bad-tool",
          script: "release:check",
          args: "--json",
          purpose: "Bad argument style.",
          doc: "README.md",
          publicOutput: "No.",
        }],
      }],
    }),
  /npm flag-forwarding/
);
assert.deepEqual(
  releaseOperationsMapCli.parseArgs([
    "--",
    "--file",
    "ops.json",
    "--phase",
    "dogfood",
    "--summary",
    "--json",
    "--quiet",
  ]),
  {
    file: "ops.json",
    json: true,
    phase: "dogfood",
    quiet: true,
    summary: true,
  }
);
assert.equal(
  releaseOperationsMapCli.main(["--summary", "--json", "--quiet"]).summary.toolCount,
  operationsSummary.toolCount
);
assert.equal(releaseOperationsMapCheck.checkReleaseOperationsMap().toolCount, operationsSummary.toolCount);
const releaseOperationsDocFixture = path.join(os.tmpdir(), `6529-release-operations-${Date.now()}.md`);
fs.writeFileSync(releaseOperationsDocFixture, "`npm run check`\n");
try {
  assert.throws(
    () => releaseOperationsMapCheck.checkReleaseOperationsDoc(operationsMap, releaseOperationsDocFixture),
    /missing local quality command/
  );
} finally {
  fs.rmSync(releaseOperationsDocFixture, { force: true });
}
const renderedGitHubAppManifest = githubAppManifest.renderGitHubAppManifest({
  host: "https://reviewbot.6529.io/",
});
assert.equal(renderedGitHubAppManifest.name, "6529bot");
assert.equal(
  renderedGitHubAppManifest.hook_attributes.url,
  "https://reviewbot.6529.io/webhooks/github"
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
assert.throws(
  () => githubAppManifest.renderGitHubAppManifest({ host: "https://reviewbot.example.com" }),
  /must not use documentation, example, local, or reserved hosts/
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
    "https://reviewbot.6529.io",
    "--form",
    "--owner",
    "6529-Collections",
    "--state",
    "test-state",
  ]),
  {
    form: true,
    host: "https://reviewbot.6529.io",
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
assert.equal(githubWebhook.parseReviewCommand("/6529bot help").reviewKinds.length, 0);
assert.equal(githubWebhook.parseReviewCommand("looks good"), null);
assert.equal(commentCommandsCheck.checkCommentCommands().commandCases, 12);
assert.throws(
  () => commentCommandsCheck.checkCommentCommands({ quiet: true, text: "# Comment Commands\n" }),
  /comment command docs check found/
);
assert.equal(reviewWorkflowKindsCheck.checkReviewWorkflowKinds().reviewKinds, 5);
assert.deepEqual(
  reviewWorkflowKindsCheck.fallbackJsonArrayForVariable(
    "vars.REVIEW_BOT_INITIAL_KINDS || '[\"general\",\"security\"]'",
    "REVIEW_BOT_INITIAL_KINDS"
  ),
  ["general", "security"]
);
assert.throws(
  () =>
    reviewWorkflowKindsCheck.checkReviewWorkflowKinds({
      quiet: true,
      reusableWorkflowText: "missing workflow review-kind defaults",
    }),
  /review workflow kind check found/
);
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
assert.equal(
  workerAdapter.redactSensitiveText("AWS key AKIAABCDEFGHIJKLMNOP in output"),
  "AWS key [redacted-aws-access-key-id] in output"
);
assert.equal(
  workerAdapter.redactSensitiveText(
    "notify https://hooks.slack.com/services/T12345678/B12345678/abcdefghijklmnopqrstuvwxyz"
  ),
  "notify [redacted-alert-webhook-url]"
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
  REVIEWBOT_ALERTS_ENABLED: "true",
  REVIEWBOT_ALERTS_NOTIFY_MODE: "none",
  REVIEW_USAGE_ENABLED: "false",
});
const serverEntrypointQueuePromise = serverEntrypointOptions.enqueueReviewJobs([reviewJobs[0]], {});
const serverAlertStatusPromise = serverEntrypointOptions.loadAlertStatus();
const serverRunClaimReaderOptions = serverCli.createServerOptionsFromEnv({
  REVIEWBOT_WORKER_ADAPTER: "noop",
  REVIEW_USAGE_ENABLED: "false",
  REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED: "true",
});
assert.equal(typeof serverRunClaimReaderOptions.loadRunClaims, "function");
const serverUsageReaderOptions = serverCli.createServerOptionsFromEnv({
  REVIEWBOT_WORKER_ADAPTER: "noop",
  REVIEW_USAGE_ENABLED: "true",
  REVIEW_USAGE_AWS_REGION: "us-east-1",
  REVIEW_USAGE_DB_RESOURCE_ARN: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  REVIEW_USAGE_DB_SECRET_ARN: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
  REVIEW_USAGE_DB_NAME: "reviewbot",
  REVIEW_USAGE_DB_SCHEMA: "reviewbot",
  REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS: "14",
});
assert.equal(typeof serverUsageReaderOptions.loadModelPriceStatus, "function");
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
const runClaimUpdateMetadata = JSON.parse(
  runClaimUpdateQuery.parameters.find((param) => param.name === "metadata").value
    .stringValue
);
assert.equal(runClaimUpdateMetadata.queueReason, "closed");
assert.equal(Object.prototype.hasOwnProperty.call(runClaimUpdateMetadata, "ignored"), false);
const redactedRunClaimUpdateQuery = runControlLedger.buildRunClaimStatusUpdate(
  "reviewbot",
  reviewJobs[0],
  "dispatch_error",
  {
    metadata: {
      queueReason:
        "failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
    },
  }
);
const redactedRunClaimMetadata = JSON.parse(
  redactedRunClaimUpdateQuery.parameters.find((param) => param.name === "metadata").value
    .stringValue
);
assert(redactedRunClaimMetadata.queueReason.includes("Bearer [redacted]"));
assert(redactedRunClaimMetadata.queueReason.includes("sk-[redacted]"));
assert.equal(redactedRunClaimMetadata.queueReason.includes("sk-proj-"), false);
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
assert.equal(
  publicUsageSummary.byRepo.some((item) => item.key === "6529-Collections/public-repo"),
  false
);
assert.equal(Object.prototype.hasOwnProperty.call(publicUsageSummary, "byRequestor"), false);
const publicUsageSummaryWithRepoAllowlist = usageApi.summarizeUsageEvents(usageEvents, {
  visibility: "public",
  range: { days: 7 },
  publicRepos: ["6529-Collections/public-repo"],
});
assert.equal(
  publicUsageSummaryWithRepoAllowlist.byRepo.some(
    (item) => item.key === "6529-Collections/public-repo"
  ),
  true
);
assert.equal(
  publicUsageSummaryWithRepoAllowlist.byRepo.some((item) => item.key === "private"),
  true
);
const publicUsageSummaryWithOrgAllowlist = usageApi.summarizeUsageEvents(usageEvents, {
  visibility: "public",
  range: { days: 7 },
  publicOrganizations: ["6529-Collections"],
});
assert.equal(
  publicUsageSummaryWithOrgAllowlist.byRepo.some(
    (item) => item.key === "6529-Collections/public-repo"
  ),
  true
);
assert.equal(
  usageApi.isPublicUsageRepo("6529-Collections/public-repo", {
    publicRepos: ["6529-Collections/public-repo"],
  }),
  true
);
assert.equal(
  usageApi.isPublicUsageRepo("6529-Collections/public-repo/extra", {
    publicOrganizations: ["6529-Collections"],
  }),
  false
);
assert.equal(
  usageApi.isPublicUsageRepo("6529-Collections/", {
    publicOrganizations: ["6529-Collections"],
  }),
  false
);
const adminUsageSummary = usageApi.summarizeUsageEvents(usageEvents, {
  visibility: "admin",
  range: { days: 7 },
});
assert.equal(
  adminUsageSummary.byRepo.some((item) => item.key === "6529-Collections/public-repo"),
  true
);
assert.equal(adminUsageSummary.byRequestor.some((item) => item.key === "admin"), true);
const unsafeAdminUsageEvent = usageApi.normalizeAdminUsageEvent({
  createdAt: "2026-06-10T01:00:00.000Z",
  repoFullName: "6529-Collections/private",
  prNumber: 12,
  prAuthor: "author",
  prHeadSha: "head",
  workflowRunId: "run-1",
  workflowJob: "review-job",
  requestor: "maintainer",
  reviewKind: "security",
  provider: "openai",
  model: "gpt-5.5",
  lane: "openai:gpt-5.5",
  inputTokens: 10,
  outputTokens: 20,
  metadata: {
    detail:
      "usage row has Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
    nested: { token: "sk-proj-should-not-pass" },
    "bad key": "sk-proj-should-not-pass",
  },
});
assert.equal(unsafeAdminUsageEvent.repoFullName, "6529-Collections/private");
assert.equal(unsafeAdminUsageEvent.totalTokens, 30);
assert(unsafeAdminUsageEvent.metadata.detail.includes("Bearer [redacted]"));
assert(unsafeAdminUsageEvent.metadata.detail.includes("sk-[redacted]"));
assert.equal(unsafeAdminUsageEvent.metadata.detail.includes("sk-proj-"), false);
assert.equal(
  Object.prototype.hasOwnProperty.call(unsafeAdminUsageEvent.metadata, "nested"),
  false
);
assert.equal(usageApi.publicBudgetPolicy({ scope_type: "repo", scope_value: "x", daily_budget_usd: "2" }).dailyBudgetUsd, 2);
const budgetPolicyStatus = usageApi.publicBudgetPolicyStatus({
  scopeType: "repo",
  scopeValue: "6529-Collections/private",
  dailyBudgetUsd: 25,
  weeklyBudgetUsd: null,
  monthlyBudgetUsd: 100,
  currentSpend: {
    dailyUsd: "18",
    weeklyUsd: "42.25",
    monthlyUsd: "125",
  },
});
assert.equal(budgetPolicyStatus.utilization.daily.percentUsed, 72);
assert.equal(budgetPolicyStatus.utilization.daily.remainingUsd, 7);
assert.equal(budgetPolicyStatus.utilization.weekly.percentUsed, null);
assert.equal(budgetPolicyStatus.utilization.monthly.overBudget, true);
assert.equal(budgetPolicyStatus.utilization.monthly.remainingUsd, -25);
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
const alertStatusSummary = alertStatus.alertStatusFromEnv({
  REVIEWBOT_ALERTS_ENABLED: "true",
  REVIEWBOT_ALERTS_NOTIFY_MODE: "sns",
  REVIEWBOT_ALERTS_SNS_TOPIC_ARN: "arn:aws:sns:us-east-1:123456789012:reviewbot-alerts",
  REVIEWBOT_ALERTS_SES_FROM: "ops@example.test",
  REVIEWBOT_ALERTS_SES_TO: "admin@example.test, security@example.test",
  REVIEWBOT_ALERTS_WEBHOOK_URL:
    "https://hooks.example.test/services/github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
  REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED: "true",
  REVIEWBOT_ALERTS_LOOKBACK_DAYS: "40",
  REVIEWBOT_ALERTS_MAX_EVENTS: "123",
});
assert.equal(alertStatusSummary.enabled, true);
assert.equal(alertStatusSummary.spend.enabled, true);
assert.equal(alertStatusSummary.jobHealth.enabled, true);
assert.equal(alertStatusSummary.schedule.lookbackDays, 40);
assert.equal(alertStatusSummary.schedule.maxEvents, 123);
assert.equal(alertStatusSummary.notifier.mode, "sns");
assert.equal(alertStatusSummary.notifier.snsTopicConfigured, true);
assert.equal(alertStatusSummary.notifier.sesFromConfigured, true);
assert.equal(alertStatusSummary.notifier.sesRecipientCount, 2);
assert.equal(alertStatusSummary.notifier.webhookConfigured, true);
assert.equal(JSON.stringify(alertStatusSummary).includes("123456789012"), false);
assert.equal(JSON.stringify(alertStatusSummary).includes("ops@example"), false);
assert.equal(JSON.stringify(alertStatusSummary).includes("github_pat_abcdefghijklmnopqrstuvwxyz"), false);
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
const budgetStatusQuery = budgetLedger.buildBudgetPolicyStatusQuery("reviewbot");
assert.match(budgetStatusQuery.sql, /ai_review_budget_policies/);
assert.match(budgetStatusQuery.sql, /ai_review_usage_events/);
assert.match(budgetStatusQuery.sql, /coalesce\(u\.metadata->>'requestor', u\.pr_author\)/);
assert.match(budgetStatusQuery.sql, /group by/);
assert.deepEqual(budgetStatusQuery.parameters, []);
const budgetStatusRecord = budgetLedger.budgetPolicyStatusRecordToPolicy([
  { stringValue: "repo" },
  { stringValue: "6529-Collections/example" },
  { stringValue: "10" },
  { isNull: true },
  { stringValue: "100" },
  { booleanValue: true },
  { stringValue: "7.5" },
  { stringValue: "12" },
  { stringValue: "25" },
]);
assert.equal(budgetStatusRecord.currentSpend.dailyUsd, 7.5);
assert.equal(budgetStatusRecord.weeklyBudgetUsd, null);
const usageEventsQuery = usageApiLedger.buildUsageEventsQuery("reviewbot", {
  from: "2026-06-01T00:00:00.000Z",
  to: "2026-06-11T00:00:00.000Z",
}, 25);
assert.match(usageEventsQuery.sql, /ai_review_usage_events/);
assert.match(usageEventsQuery.sql, /created_at >= cast\(:from_ts as timestamptz\)/);
assert.equal(usageEventsQuery.parameters[2].value.longValue, 25);
const recentUsageEventsApiQuery = usageApi.usageEventsQueryFromRequest(
  { url: new URL("http://localhost/api/admin/usage/events/recent?days=7&limit=3") },
  usageApi.usageApiSettingsFromEnv({
    REVIEWBOT_USAGE_API_DEFAULT_DAYS: "30",
    REVIEWBOT_USAGE_API_MAX_DAYS: "30",
    REVIEWBOT_USAGE_API_MAX_ITEMS: "50",
  }),
  new Date("2026-06-12T12:00:00.000Z")
);
assert.equal(recentUsageEventsApiQuery.limit, 3);
assert.equal(recentUsageEventsApiQuery.range.days, 7);
assert.equal(recentUsageEventsApiQuery.range.to, "2026-06-12T12:00:00.000Z");
const defaultUsageEventsApiQuery = usageApi.usageEventsQueryFromRequest(
  { url: new URL("http://localhost/api/admin/usage/events/recent?days=7") },
  usageApi.usageApiSettingsFromEnv({
    REVIEWBOT_USAGE_API_MAX_ITEMS: "50",
    REVIEWBOT_USAGE_API_MAX_EVENTS: "5",
  }),
  new Date("2026-06-12T12:00:00.000Z")
);
assert.equal(defaultUsageEventsApiQuery.limit, 5);
assert.throws(
  () =>
    usageApi.usageEventsQueryFromRequest(
      { url: new URL("http://localhost/api/admin/usage/events/recent?limit=6") },
      usageApi.usageApiSettingsFromEnv({
        REVIEWBOT_USAGE_API_MAX_ITEMS: "50",
        REVIEWBOT_USAGE_API_MAX_EVENTS: "5",
      })
    ),
  /limit must be <= 5/
);
assert.throws(() => usageApiLedger.buildUsageEventsQuery("reviewbot", {}, 25), /bounded range/);
assert.throws(
  () =>
    usageApiLedger.readUsageEvents(
      {
        enabled: true,
        region: "us-east-1",
        resourceArn: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
        secretArn: "arn:aws:secretsmanager:us-east-1:123456789012:secret:reviewbot",
        database: "reviewbot",
        schema: "reviewbot",
      },
      {
        range: {
          from: "2026-06-12T00:00:00.000Z",
          to: "2026-06-13T00:00:00.000Z",
        },
        apiSettings: usageApi.usageApiSettingsFromEnv({ REVIEWBOT_USAGE_API_MAX_EVENTS: "5" }),
        limit: 6,
      }
    ),
  /Usage event query limit must be <= 5/
);
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
assert.match(runClaimsQuery.sql, /order by updated_at desc, id desc/);
assert.equal(runClaimsQuery.parameters[0].value.stringValue, "claimed");
assert.equal(runClaimsQuery.parameters[3].value.longValue, 7);
const staleRunClaimsApiQuery = usageApi.runClaimsQueryFromRequest(
  { url: new URL("http://localhost/api/admin/run-claims/recent?active=1&staleMinutes=120&limit=3") },
  usageApi.usageApiSettingsFromEnv({ REVIEWBOT_USAGE_API_MAX_ITEMS: "50" }),
  new Date("2026-06-12T12:00:00.000Z")
);
assert.deepEqual(staleRunClaimsApiQuery.statuses, ["claimed", "dispatching", "running"]);
assert.equal(staleRunClaimsApiQuery.limit, 3);
assert.equal(staleRunClaimsApiQuery.active, true);
assert.equal(staleRunClaimsApiQuery.staleMinutes, 120);
assert.equal(staleRunClaimsApiQuery.updatedBefore, "2026-06-12T10:00:00.000Z");
assert.equal(staleRunClaimsApiQuery.onlyUnexpired, true);
const activeRunningClaimsApiQuery = usageApi.runClaimsQueryFromRequest(
  { url: new URL("http://localhost/api/admin/run-claims/recent?active=1&status=running") },
  usageApi.usageApiSettingsFromEnv({ REVIEWBOT_USAGE_API_MAX_ITEMS: "50" }),
  new Date("2026-06-12T12:00:00.000Z")
);
assert.deepEqual(activeRunningClaimsApiQuery.statuses, ["running"]);
assert.equal(activeRunningClaimsApiQuery.active, true);
assert.throws(
  () => usageApi.runClaimsQueryFromRequest(
    { url: new URL("http://localhost/api/admin/run-claims/recent?active=1&status=completed") },
    usageApi.usageApiSettingsFromEnv({ REVIEWBOT_USAGE_API_MAX_ITEMS: "50" })
  ),
  /status must be an active status/
);
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
const unsafeAdminJobEvent = usageApi.normalizeJobEvent({
  jobId: "job-unsafe",
  status: "dispatch_failed",
  stage: "dispatch",
  repoFullName: "6529-Collections/private",
  prNumber: 12,
  reason:
    "failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
  metadata: {
    detail:
      "failed with github_pat_abcdefghijklmnopqrstuvwxyz1234567890 and sk-proj-abcdefghijklmnopqrstuvwx123456",
    nested: { token: "sk-proj-should-not-pass" },
    "bad key": "sk-proj-should-not-pass",
    github_pat_abcdefghijklmnopqrstuvwxyz1234567890: "should-not-pass",
    count: 2,
    ok: true,
  },
});
assert(unsafeAdminJobEvent.reason.includes("Bearer [redacted]"));
assert(unsafeAdminJobEvent.reason.includes("sk-[redacted]"));
assert.equal(unsafeAdminJobEvent.reason.includes("sk-proj-"), false);
assert(unsafeAdminJobEvent.metadata.detail.includes("github_pat_[redacted]"));
assert(unsafeAdminJobEvent.metadata.detail.includes("sk-[redacted]"));
assert.equal(unsafeAdminJobEvent.metadata.detail.includes("sk-proj-"), false);
assert.equal(Object.prototype.hasOwnProperty.call(unsafeAdminJobEvent.metadata, "nested"), false);
assert.equal(Object.prototype.hasOwnProperty.call(unsafeAdminJobEvent.metadata, "bad key"), false);
assert.equal(
  Object.keys(unsafeAdminJobEvent.metadata).some((key) => key.startsWith("github_pat_")),
  false
);
assert.equal(unsafeAdminJobEvent.metadata.count, 2);
assert.equal(unsafeAdminJobEvent.metadata.ok, true);
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
const unsafeAdminRunClaim = usageApi.normalizeRunClaim({
  claimId: 102,
  runKey: "run-sk-proj-abcdefghijklmnopqrstuvwx123456",
  jobId: "job-claim",
  status: "running",
  repoFullName: "6529-Collections/private",
  prNumber: 12,
  metadata: {
    detail:
      "worker has Bearer abcdefghijklmnopqrstuvwxyz123456 and github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    nested: { token: "sk-proj-should-not-pass" },
    "bad key": "sk-proj-should-not-pass",
  },
});
assert(unsafeAdminRunClaim.runKey.includes("sk-[redacted]"));
assert(unsafeAdminRunClaim.metadata.detail.includes("Bearer [redacted]"));
assert(unsafeAdminRunClaim.metadata.detail.includes("github_pat_[redacted]"));
assert.equal(
  Object.prototype.hasOwnProperty.call(unsafeAdminRunClaim.metadata, "nested"),
  false
);
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
assert.deepEqual(
  adminAuth.adminAuthSettingsFromEnv({
    REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "reviewbot-admin,ReviewBot-Admin",
  }).requiredRoles,
  ["reviewbot-admin"]
);
assert.throws(
  () =>
    adminAuth.adminAuthSettingsFromEnv({
      REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "reviewbot-admin,bad role",
    }),
  /REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES/
);
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
const usageApiClientSettings = usageApiClient.usageApiClientSettingsFromEnv({
  REVIEWBOT_USAGE_API_BASE_URL: "https://reviewbot.example.com",
  REVIEWBOT_USAGE_API_CLIENT_TIMEOUT_MS: "1234",
  REVIEWBOT_USAGE_API_ADMIN_ACTOR: "6529.io-admin",
  REVIEWBOT_USAGE_API_ADMIN_ROLES: "reviewbot-admin,admin",
  REVIEWBOT_ADMIN_AUTH_MODE: "hmac",
  REVIEWBOT_ADMIN_AUTH_HMAC_SECRET: "hmac-secret",
  REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "reviewbot-admin",
});
assert.equal(usageApiClientSettings.baseUrl, "https://reviewbot.example.com");
assert.equal(usageApiClientSettings.timeoutMs, 1234);
assert.deepEqual(usageApiClientSettings.roles, ["reviewbot-admin", "admin"]);
const builtUsageApiUrl = usageApiClient.buildUsageApiUrl(
  "https://reviewbot.example.com/base/",
  "/api/admin/jobs/recent",
  { status: "dispatch_failed", limit: 2 }
);
assert.equal(
  String(builtUsageApiUrl),
  "https://reviewbot.example.com/api/admin/jobs/recent?status=dispatch_failed&limit=2"
);
assert.throws(
  () => usageApiClient.buildUsageApiUrl("https://reviewbot.example.com", "https://evil.test/api"),
  /path must be an absolute path/
);
const usageApiClientHeaders = usageApiClient.createAdminUsageApiHeaders({
  method: "GET",
  url: adminUsageUrl,
  actor: "operator",
  roles: ["reviewbot-admin"],
  expiresAt: String(Math.floor(Date.now() / 1000) + 120),
}, hmacAuthSettings);
assert.equal(usageApiClientHeaders["x-6529-admin-user"], "operator");
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: usageApiClientHeaders,
}, hmacAuthSettings).allowed, true);
const minimalUsageApiClientHeaders = usageApiClient.createAdminUsageApiHeaders({
  method: "GET",
  url: adminUsageUrl,
  actor: "operator",
}, {
  hmacSecret: "hmac-secret",
});
assert.equal(adminAuth.authorizeAdminRequest({
  method: "GET",
  url: adminUsageUrl,
  headers: minimalUsageApiClientHeaders,
}, hmacAuthSettings).allowed, true);
let usageApiClientFetchRequest = null;
const usageApiClientRequestPromise = usageApiClient
  .createUsageApiClient({
    settings: usageApiClientSettings,
    fetchImpl: async (url, options = {}) => {
      usageApiClientFetchRequest = { url: String(url), options };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, kind: "model_price_status" }),
      };
    },
  })
  .modelPriceStatus({
    actor: "operator",
    roles: ["reviewbot-admin"],
    expiresAt: String(Math.floor(Date.now() / 1000) + 120),
  });
const usageApiClientFailurePromise = usageApiClient
  .requestUsageApiJson({
    baseUrl: "https://reviewbot.example.com",
    path: "/api/admin/status",
    admin: true,
    actor: "operator",
    roles: ["reviewbot-admin"],
    expiresAt: String(Math.floor(Date.now() / 1000) + 120),
    adminAuth: hmacAuthSettings,
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      text: async () =>
        JSON.stringify({
          ok: false,
          error:
            "loader failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
        }),
    }),
  })
  .then(
    () => null,
    (error) => error
  );
const adminSnapshotPromise = adminSnapshot.collectAdminSnapshot({
  now: new Date("2026-06-13T00:00:00.000Z"),
  client: {
    adminUsageSummary: async () => ({
      totals: {
        reviewRuns: 4,
        costUsd: 3.5,
        totalTokens: 1234,
        budgetSkippedRuns: 1,
      },
      byRequestor: [{ key: "operator" }],
      byPr: [{ key: "6529-Collections/private#1" }],
    }),
    recentUsageEvents: async () => ({
      events: [{ budgetSkipped: true }, { budgetSkipped: false }],
    }),
    budgetStatus: async () => ({
      policies: [{
        utilization: {
          daily: { percentUsed: 90, overBudget: false },
          weekly: { percentUsed: 110, overBudget: true },
          monthly: { percentUsed: null, overBudget: false },
        },
      }],
    }),
    modelPriceStatus: async () => ({
      status: {
        summary: {
          activeRows: 2,
          providerModelCount: 2,
          staleRows: 1,
          futureRows: 0,
          missingSourceRows: 0,
          invalidSourceRows: 0,
          incompleteRows: 1,
        },
      },
    }),
    alertStatus: async () => ({
      status: {
        enabled: true,
        spend: { enabled: true },
        jobHealth: { enabled: true },
        notifier: {
          mode: "sns",
          webhookConfigured: false,
          snsTopicConfigured: true,
        },
      },
    }),
    jobEvents: async () => ({ events: [{ jobId: "failed" }] }),
    runClaims: async () => ({ active: true, staleMinutes: 120, claims: [{ jobId: "stale" }] }),
    runtimeStatus: async ({ profile }) => ({
      profile,
      preflight: {
        ok: profile === "server",
        checks: [{ name: "webhook" }],
        warnings: profile === "worker" ? [{ name: "worker" }] : [],
        errors: profile === "worker" ? [{ name: "worker" }] : [],
      },
    }),
  },
});
const adminSnapshotFailurePromise = adminSnapshot.collectAdminSnapshot({
  now: new Date("2026-06-13T00:00:00.000Z"),
  client: {
    adminUsageSummary: async () => {
      throw new Error("failed with sk-proj-abcdefghijklmnopqrstuvwx123456");
    },
    recentUsageEvents: async () => ({ events: [] }),
    budgetStatus: async () => ({ policies: [] }),
    modelPriceStatus: async () => ({ status: { summary: {} } }),
    alertStatus: async () => ({ status: { enabled: false, notifier: {} } }),
    jobEvents: async () => ({ events: [] }),
    runClaims: async () => ({ claims: [] }),
    runtimeStatus: async ({ profile }) => ({ profile, preflight: { ok: true } }),
  },
});
assert.deepEqual(
  adminSnapshotCli.parseArgs([
    "--",
    "--json",
    "--quiet",
    "--require-ok",
    "--days",
    "14",
    "--recent-days",
    "3",
    "--limit",
    "9",
    "--stale-minutes",
    "60",
    "--roles",
    "reviewbot-admin,admin",
  ]),
  {
    json: true,
    quiet: true,
    requireOk: true,
    days: "14",
    recentDays: "3",
    limit: "9",
    staleMinutes: "60",
    roles: ["reviewbot-admin", "admin"],
  }
);
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
const invalidSecretConfigText = Buffer.from(
  "sk-proj-secretvalue1234567890: true\n"
).toString("base64");
const invalidRepoConfigPromise = repositoryConfig.loadRepositoryConfigFromGitHub(
  normalizedPullRequest,
  {
    policy: repositoryConfig.repositoryConfigPolicyFromEnv({
      REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "github",
    }),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        type: "file",
        encoding: "base64",
        content: invalidSecretConfigText,
      }),
    }),
  }
);
const publicRepoConfigSummary = repositoryConfig.publicRepositoryConfigSummary(
  {
    status: "invalid",
    source: "github",
    reason:
      "failed with Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890\nsecond line",
  },
  repositoryConfig.defaultRepositoryConfig()
);
assert.equal(
  publicRepoConfigSummary.reason,
  "failed with Bearer [redacted]"
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
  const invalidRepoConfig = await invalidRepoConfigPromise;
  assert.equal(invalidRepoConfig.status, "invalid");
  assert.match(invalidRepoConfig.reason, /sk-\[redacted\]/);
  assert.equal(invalidRepoConfig.reason.includes("sk-proj-secretvalue"), false);
  const noopQueue = await noopQueuePromise;
  assert.equal(noopQueue.accepted, false);
  assert.equal(noopQueue.reason, "No worker adapter configured.");
  const serverEntrypointQueue = await serverEntrypointQueuePromise;
  assert.equal(serverEntrypointQueue.accepted, false);
  assert.equal(serverEntrypointQueue.adapter, "noop");
  assert.equal(serverEntrypointQueue.reason, "No worker adapter configured.");
  const serverAlertStatus = await serverAlertStatusPromise;
  assert.equal(serverAlertStatus.status.spend.enabled, true);
  assert.equal(serverAlertStatus.status.notifier.mode, "none");
  const usageApiClientResult = await usageApiClientRequestPromise;
  assert.equal(usageApiClientResult.kind, "model_price_status");
  assert.equal(
    usageApiClientFetchRequest.url,
    "https://reviewbot.example.com/api/admin/model-prices/status"
  );
  assert.equal(
    usageApiClientFetchRequest.options.headers["x-6529-admin-user"],
    "operator"
  );
  assert.equal(
    adminAuth.authorizeAdminRequest({
      method: "GET",
      url: new URL(usageApiClientFetchRequest.url),
      headers: usageApiClientFetchRequest.options.headers,
    }, hmacAuthSettings).allowed,
    true
  );
  const usageApiRoutesResult = await usageApiRoutesCheck.checkUsageApiRoutes();
  assert.equal(usageApiRoutesResult.routes, 10);
  const webhookReplayResult = await webhookReplayCheck.checkWebhookReplayContract();
  assert.equal(webhookReplayResult.replayCases, 3);
  const dogfoodTargetContractResult =
    dogfoodTargetContractCheck.checkDogfoodTargetContract();
  assert.equal(dogfoodTargetContractResult.cliCases, 3);
  assert.equal(dogfoodTargetContractResult.packetCases, 4);
  assert.throws(
    () =>
      dogfoodTargetContractCheck.checkDogfoodTargetContract({
        quiet: true,
        docTexts: {
          "docs/dogfood-target.md": "# Dogfood Target\n",
        },
      }),
    /dogfood target contract check found/
  );
  const dogfoodStatusContractResult =
    dogfoodStatusContractCheck.checkDogfoodStatusContract();
  assert.equal(dogfoodStatusContractResult.cliCases, 3);
  assert.equal(dogfoodStatusContractResult.statusCases, 6);
  assert.throws(
    () =>
      dogfoodStatusContractCheck.checkDogfoodStatusContract({
        quiet: true,
        docTexts: {
          "docs/dogfood-status.md": "# Dogfood Status\n",
        },
      }),
    /dogfood status contract check found/
  );
  const dogfoodReadinessContractResult =
    dogfoodReadinessContractCheck.checkDogfoodReadinessContract();
  assert.equal(dogfoodReadinessContractResult.cliCases, 4);
  assert.equal(dogfoodReadinessContractResult.reportCases, 4);
  assert.throws(
    () =>
      dogfoodReadinessContractCheck.checkDogfoodReadinessContract({
        quiet: true,
        docTexts: {
          "docs/dogfood-readiness.md": "# Dogfood Readiness\n",
        },
      }),
    /dogfood readiness contract check found/
  );
  const dogfoodPromotionContractResult =
    dogfoodPromotionContractCheck.checkDogfoodPromotionContract();
  assert.equal(dogfoodPromotionContractResult.cliCases, 5);
  assert.equal(dogfoodPromotionContractResult.packetCases, 5);
  assert.throws(
    () =>
      dogfoodPromotionContractCheck.checkDogfoodPromotionContract({
        quiet: true,
        docTexts: {
          "docs/dogfood-promotion.md": "# Dogfood Promotion\n",
        },
      }),
    /dogfood promotion contract check found/
  );
  const dogfoodGoLiveContractResult =
    dogfoodGoLiveContractCheck.checkDogfoodGoLiveContract();
  assert.equal(dogfoodGoLiveContractResult.cliCases, 5);
  assert.equal(dogfoodGoLiveContractResult.packetCases, 5);
  assert.throws(
    () =>
      dogfoodGoLiveContractCheck.checkDogfoodGoLiveContract({
        quiet: true,
        docTexts: {
          "docs/dogfood-go-live.md": "# Dogfood Go-Live\n",
        },
      }),
    /dogfood go-live contract check found/
  );
  const operatorWorkspaceContractResult =
    operatorWorkspaceContractCheck.checkOperatorWorkspaceContract();
  assert.equal(operatorWorkspaceContractResult.cliCases, 4);
  assert.equal(operatorWorkspaceContractResult.workspaceCases, 4);
  assert.throws(
    () =>
      operatorWorkspaceContractCheck.checkOperatorWorkspaceContract({
        quiet: true,
        docTexts: {
          "docs/operator-workspace.md": "# Operator Workspace\n",
        },
      }),
    /operator workspace contract check found/
  );
  const operatorDrillContractResult =
    operatorDrillContractCheck.checkOperatorDrillContract();
  assert.equal(operatorDrillContractResult.drillCases, 2);
  assert.equal(operatorDrillContractResult.commands, 8);
  assert.throws(
    () =>
      operatorDrillContractCheck.checkOperatorDrillContract({
        quiet: true,
        docTexts: {
          "docs/operator-drill.md": "# Operator Drill\n",
        },
      }),
    /operator drill contract check found/
  );
  const operatorEvidenceContractResult =
    operatorEvidenceContractCheck.checkOperatorEvidenceContract();
  assert.equal(operatorEvidenceContractResult.cliCases, 3);
  assert.equal(operatorEvidenceContractResult.evidenceCases, 6);
  assert.throws(
    () =>
      operatorEvidenceContractCheck.checkOperatorEvidenceContract({
        quiet: true,
        docTexts: {
          "docs/operator-evidence-template.md": "# Operator Evidence\n",
        },
      }),
    /operator evidence contract check found/
  );
  const productionCutoverContractResult =
    productionCutoverContractCheck.checkProductionCutoverContract();
  assert.equal(productionCutoverContractResult.cliCases, 3);
  assert.equal(productionCutoverContractResult.statusCases, 5);
  assert.throws(
    () =>
      productionCutoverContractCheck.checkProductionCutoverContract({
        quiet: true,
        docTexts: {
          "docs/production-cutover.md": "# Production Cutover\n",
        },
      }),
    /production cutover contract check found/
  );
  const productionDeploymentPlanContractResult =
    productionDeploymentPlanContractCheck.checkProductionDeploymentPlanContract();
  assert.equal(productionDeploymentPlanContractResult.planCases, 8);
  assert.equal(productionDeploymentPlanContractResult.docs, 6);
  assert.throws(
    () =>
      productionDeploymentPlanContractCheck.checkProductionDeploymentPlanContract({
        quiet: true,
        docTexts: {
          "docs/production-deployment-plan.md": "# Production Deployment Plan\n",
        },
      }),
    /production deployment plan contract check found/
  );
  const dashboardDeploymentPlanContractResult =
    dashboardDeploymentPlanContractCheck.checkDashboardDeploymentPlanContract();
  assert.equal(dashboardDeploymentPlanContractResult.planCases, 7);
  assert.equal(dashboardDeploymentPlanContractResult.docs, 7);
  assert.throws(
    () =>
      dashboardDeploymentPlanContractCheck.checkDashboardDeploymentPlanContract({
        quiet: true,
        docTexts: {
          "docs/dashboard-deployment-plan.md": "# Dashboard Deployment Plan\n",
        },
      }),
    /dashboard deployment plan contract check found/
  );
  const alertDeliveryPlanContractResult =
    alertDeliveryPlanContractCheck.checkAlertDeliveryPlanContract();
  assert.equal(alertDeliveryPlanContractResult.planCases, 6);
  assert.equal(alertDeliveryPlanContractResult.docs, 8);
  assert.throws(
    () =>
      alertDeliveryPlanContractCheck.checkAlertDeliveryPlanContract({
        quiet: true,
        docTexts: {
          "docs/alert-delivery-plan.md": "# Alert Delivery Plan\n",
        },
      }),
    /alert delivery plan contract check found/
  );
  const readyAlertDeliveryPlan = alertDeliveryPlanCli.main([
    "--bot-origin",
    "https://reviewbot.6529.io",
    "--operator-workspace",
    "operator-workspace",
    "--notify-mode",
    "webhook",
    "--alert-channel",
    "operator-webhook",
    "--release",
    "v0.2.0",
    "--require-ready",
    "--quiet",
  ], {
    noExitCode: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  assert.equal(readyAlertDeliveryPlan.ready, true);
  assert.match(
    alertDeliveryPlan.formatAlertDeliveryPlanMarkdown(readyAlertDeliveryPlan),
    /Alert Delivery Plan/
  );
  assert.throws(
    () => alertDeliveryPlan.normalizeNotifyMode("pager"),
    /must be one of/
  );
  const securityReviewStatusContractResult =
    securityReviewStatusContractCheck.checkSecurityReviewStatusContract();
  assert.equal(securityReviewStatusContractResult.cliCases, 3);
  assert.equal(securityReviewStatusContractResult.statusCases, 5);
  assert.throws(
    () =>
      securityReviewStatusContractCheck.checkSecurityReviewStatusContract({
        quiet: true,
        docTexts: {
          "docs/security-review-status.md": "# Security Review Status\n",
        },
      }),
    /security review status contract check found/
  );
  const v0GatesContractResult = v0GatesContractCheck.checkV0GatesContract();
  assert.equal(v0GatesContractResult.cliCases, 3);
  assert.equal(v0GatesContractResult.statusCases, 6);
  assert.throws(
    () =>
      v0GatesContractCheck.checkV0GatesContract({
        quiet: true,
        docTexts: {
          "docs/v0-release-plan.md": "# v0 Release Plan\n",
        },
      }),
    /v0 release gates contract check found/
  );
  const releaseCandidateContractResult =
    releaseCandidateContractCheck.checkReleaseCandidateContract();
  assert.equal(releaseCandidateContractResult.redactionCases, 7);
  assert.equal(releaseCandidateContractResult.pathCases, 3);
  assert.throws(
    () =>
      releaseCandidateContractCheck.checkReleaseCandidateContract({
        quiet: true,
        docTexts: {
          "docs/release-candidate.md": "# Release Candidate\n",
        },
      }),
    /release candidate contract check found/
  );
  const releaseNotesDraftContractResult =
    releaseNotesDraftContractCheck.checkReleaseNotesDraftContract();
  assert.equal(releaseNotesDraftContractResult.draftCases, 3);
  assert.equal(releaseNotesDraftContractResult.docs, 6);
  assert.throws(
    () =>
      releaseNotesDraftContractCheck.checkReleaseNotesDraftContract({
        quiet: true,
        docTexts: {
          "docs/release-notes-draft.md": "# Release Notes Draft\n",
        },
      }),
    /release notes draft contract check found/
  );
  const releaseNotesPublicationContractResult =
    releaseNotesPublicationContractCheck.checkReleaseNotesPublicationContract();
  assert.equal(releaseNotesPublicationContractResult.publicationCases, 11);
  assert.equal(releaseNotesPublicationContractResult.docs, 7);
  assert.throws(
    () =>
      releaseNotesPublicationContractCheck.checkReleaseNotesPublicationContract({
        quiet: true,
        docTexts: {
          "docs/release-notes-publication.md": "# Release Notes Publication\n",
        },
      }),
    /release notes publication contract check found/
  );
  const releaseTagPlanContractResult =
    releaseTagPlanContractCheck.checkReleaseTagPlanContract();
  assert.equal(releaseTagPlanContractResult.planCases, 11);
  assert.equal(releaseTagPlanContractResult.docs, 6);
  assert.throws(
    () =>
      releaseTagPlanContractCheck.checkReleaseTagPlanContract({
        quiet: true,
        docTexts: {
          "docs/release-tag-plan.md": "# Release Tag Plan\n",
        },
      }),
    /release tag plan contract check found/
  );
  const githubAppManifestContractResult =
    await githubAppManifestContractCheck.checkGitHubAppManifestContract();
  assert.equal(githubAppManifestContractResult.manifestCases, 7);
  assert.equal(githubAppManifestContractResult.conversionCases, 6);
  await assert.rejects(
    () =>
      githubAppManifestContractCheck.checkGitHubAppManifestContract({
        quiet: true,
        docTexts: {
          "docs/github-app-registration.md": "# GitHub App Registration\n",
        },
      }),
    /GitHub App manifest contract check found/
  );
  const githubAppAuthContractResult =
    await githubAppAuthContractCheck.checkGitHubAppAuthContract();
  assert.equal(githubAppAuthContractResult.authCases, 7);
  assert.equal(githubAppAuthContractResult.cliCases, 5);
  await assert.rejects(
    () =>
      githubAppAuthContractCheck.checkGitHubAppAuthContract({
        quiet: true,
        docTexts: {
          "docs/github-app.md": "# GitHub App\n",
        },
      }),
    /GitHub App auth contract check found/
  );
  const githubAppRoutesContractResult =
    await githubAppRoutesContractCheck.checkGitHubAppRoutesContract();
  assert.equal(githubAppRoutesContractResult.routeCases, 6);
  await assert.rejects(
    () =>
      githubAppRoutesContractCheck.checkGitHubAppRoutesContract({
        quiet: true,
        docTexts: {
          "docs/github-app.md": "# GitHub App\n",
        },
      }),
    /GitHub App route contract check found/
  );
  const installGuideContractResult =
    installGuideContractCheck.checkInstallGuideContract();
  assert.equal(installGuideContractResult.guideCases, 6);
  await assert.throws(
    () =>
      installGuideContractCheck.checkInstallGuideContract({
        quiet: true,
        docTexts: {
          "docs/install.md": "# Installation\n",
        },
      }),
    /install guide contract check found/
  );
  const deploymentRunbookContractResult =
    deploymentRunbookContractCheck.checkDeploymentRunbookContract();
  assert.equal(deploymentRunbookContractResult.runbookCases, 7);
  await assert.throws(
    () =>
      deploymentRunbookContractCheck.checkDeploymentRunbookContract({
        quiet: true,
        docTexts: {
          "docs/deployment.md": "# Deployment\n",
        },
      }),
    /deployment runbook contract check found/
  );
  const managerMemoryContractResult = managerMemoryContractCheck.checkManagerMemoryContract();
  assert.ok(managerMemoryContractResult.latestPr >= 217);
  assert.equal(managerMemoryContractResult.docs, 5);
  await assert.throws(
    () =>
      managerMemoryContractCheck.checkManagerMemoryContract({
        quiet: true,
        texts: {
          "_manager/roadmap-execution/active-context.md": "# Active Context\n",
        },
      }),
    /manager memory contract check found/
  );
  const configurationReferenceContractResult =
    configurationReferenceContractCheck.checkConfigurationReferenceContract();
  assert.equal(configurationReferenceContractResult.sections, 21);
  await assert.throws(
    () =>
      configurationReferenceContractCheck.checkConfigurationReferenceContract({
        quiet: true,
        docTexts: {
          "docs/configuration.md": "# Configuration\n",
        },
      }),
    /configuration reference contract check found/
  );
  const awsIamTemplatesResult = awsIamTemplatesCheck.checkAwsIamTemplates();
  assert.equal(awsIamTemplatesResult.templates, 3);
  await assert.throws(
    () =>
      awsIamTemplatesCheck.checkAwsIamTemplates({
        quiet: true,
        jsonTexts: {
          "infra/aws/usage-ledger-data-api-policy.example.json": JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Sid: "TooBroad",
                Effect: "Allow",
                Action: ["rds-data:*"],
                Resource: "*",
              },
            ],
          }),
        },
      }),
    /aws iam template check found/
  );
  const securityModelContractResult =
    securityModelContractCheck.checkSecurityModelContract();
  assert.equal(securityModelContractResult.controls, 17);
  assert.equal(securityModelContractResult.sourceFiles, 12);
  await assert.throws(
    () =>
      securityModelContractCheck.checkSecurityModelContract({
        quiet: true,
        docTexts: {
          "docs/security-model.md": "# Security Model\n",
        },
      }),
    /security model contract check found/
  );
  const compatibilityPolicyResult =
    compatibilityPolicyCheck.checkCompatibilityPolicyContract();
  assert.equal(compatibilityPolicyResult.surfaces, 14);
  assert.throws(
    () =>
      compatibilityPolicyCheck.checkCompatibilityPolicyContract({
        quiet: true,
        texts: {
          "docs/compatibility-policy.md": "# Compatibility Policy\n",
        },
      }),
    /compatibility policy contract check found/
  );
  const externalEvidenceBoundariesResult =
    externalEvidenceBoundariesCheck.checkExternalEvidenceBoundariesContract();
  assert.equal(externalEvidenceBoundariesResult.surfaces, 12);
  assert.throws(
    () =>
      externalEvidenceBoundariesCheck.checkExternalEvidenceBoundariesContract({
        quiet: true,
        texts: {
          "docs/external-evidence-boundaries.md": "# External Evidence Boundaries\n",
        },
      }),
    /external evidence boundaries contract check found/
  );
  const repositoryRulesetsContractResult =
    repositoryRulesetsContractCheck.checkRepositoryRulesetsContract();
  assert.equal(repositoryRulesetsContractResult.surfaces, 13);
  assert.throws(
    () =>
      repositoryRulesetsContractCheck.checkRepositoryRulesetsContract({
        quiet: true,
        texts: {
          "docs/repository-rulesets.md": "# Repository Rulesets\n",
        },
      }),
    /repository ruleset contract check found/
  );
  const codeownersContractResult = codeownersContractCheck.checkCodeownersContract();
  assert.equal(codeownersContractResult.rules, 10);
  assert.equal(codeownersContractResult.surfaces, 11);
  assert.throws(
    () =>
      codeownersContractCheck.checkCodeownersContract({
        quiet: true,
        texts: {
          ".github/CODEOWNERS": "* @punk6529\n",
        },
      }),
    /CODEOWNERS contract check found/
  );
  const communityReleaseGatesContractResult =
    communityReleaseGatesContractCheck.checkCommunityReleaseGatesContract();
  assert.equal(communityReleaseGatesContractResult.gates, 14);
  assert.equal(communityReleaseGatesContractResult.evidenceReferences, 14);
  assert.throws(
    () =>
      communityReleaseGatesContractCheck.checkCommunityReleaseGatesContract({
        quiet: true,
        gatesText: JSON.stringify({
          version: 1,
          release: "community-release",
          description: "Broken.",
          checklist: "docs/release-readiness.md",
          gates: [],
        }),
      }),
    /community release gates contract check found/
  );
  const operationsRunbookContractResult =
    operationsRunbookContractCheck.checkOperationsRunbookContract();
  assert.equal(operationsRunbookContractResult.runbookCases, 7);
  await assert.throws(
    () =>
      operationsRunbookContractCheck.checkOperationsRunbookContract({
        quiet: true,
        docTexts: {
          "docs/operations.md": "# Operations\n",
        },
      }),
    /operations runbook contract check found/
  );
  await assert.rejects(
    () =>
      webhookReplayCheck.checkWebhookReplayContract({
        quiet: true,
        docTexts: {
          "README.md": "# 6529reviewbot\n",
          "docs/configuration.md": "# Configuration\n",
          "docs/github-app.md": "# GitHub App\n",
          "docs/incident-response.md": "# Incident Response\n",
          "docs/release-operations-map.md": "# Release Operations Map\n",
          "docs/release-readiness.md": "# Release Readiness\n",
        },
      }),
    /webhook replay contract check found/
  );
  await assert.rejects(
    () =>
      usageApiRoutesCheck.checkUsageApiRoutes({
        quiet: true,
        docTexts: {
          "docs/usage-api.md": "# Usage API\n",
        },
      }),
    /usage api route contract check found/
  );
  const adminSnapshotContractResult =
    await adminSnapshotContractCheck.checkAdminSnapshotContract();
  assert.equal(adminSnapshotContractResult.checks, 9);
  await assert.rejects(
    () =>
      adminSnapshotContractCheck.checkAdminSnapshotContract({
        quiet: true,
        docTexts: {
          "docs/6529-io-admin-integration.md": "# Admin Integration\n",
        },
      }),
    /admin snapshot contract check found/
  );
  const supportBundleContractResult = supportBundleContractCheck.checkSupportBundleContract();
  assert.equal(supportBundleContractResult.safeKeys, 17);
  assert.throws(
    () =>
      supportBundleContractCheck.checkSupportBundleContract({
        quiet: true,
        docTexts: {
          "docs/support.md": "# Support\n",
        },
      }),
    /support bundle contract check found/
  );
  const supportRunbooksContractResult =
    supportRunbooksContractCheck.checkSupportRunbooksContract();
  assert.equal(supportRunbooksContractResult.supportCases, 4);
  assert.equal(supportRunbooksContractResult.incidentCases, 3);
  assert.throws(
    () =>
      supportRunbooksContractCheck.checkSupportRunbooksContract({
        quiet: true,
        docTexts: {
          "docs/support.md": "# Support\n",
        },
    }),
    /support runbooks contract check found/
  );
  const workerCapacityContractResult =
    workerCapacityContractCheck.checkWorkerCapacityContract();
  assert.equal(workerCapacityContractResult.capacityCases, 7);
  assert.throws(
    () =>
      workerCapacityContractCheck.checkWorkerCapacityContract({
        quiet: true,
        docTexts: {
          "docs/worker-capacity.md": "# Worker Capacity\n",
        },
    }),
    /worker capacity contract check found/
  );
  const alertingRunbookContractResult =
    alertingRunbookContractCheck.checkAlertingRunbookContract();
  assert.equal(alertingRunbookContractResult.runbookCases, 7);
  assert.throws(
    () =>
      alertingRunbookContractCheck.checkAlertingRunbookContract({
        quiet: true,
        docTexts: {
          "docs/alerting.md": "# Alerting\n",
        },
      }),
    /alerting runbook contract check found/
  );
  const modelPricingRunbookContractResult =
    modelPricingRunbookContractCheck.checkModelPricingRunbookContract();
  assert.equal(modelPricingRunbookContractResult.runbookCases, 6);
  assert.throws(
    () =>
      modelPricingRunbookContractCheck.checkModelPricingRunbookContract({
        quiet: true,
        docTexts: {
          "docs/model-pricing.md": "# Model Pricing\n",
        },
      }),
    /model pricing runbook contract check found/
  );
  const budgetPoliciesRunbookContractResult =
    budgetPoliciesRunbookContractCheck.checkBudgetPoliciesRunbookContract();
  assert.equal(budgetPoliciesRunbookContractResult.runbookCases, 5);
  assert.throws(
    () =>
      budgetPoliciesRunbookContractCheck.checkBudgetPoliciesRunbookContract({
        quiet: true,
        docTexts: {
          "docs/budget-policies.md": "# Budget Policies\n",
        },
      }),
    /budget policies runbook contract check found/
  );
  const usageApiClientFailure = await usageApiClientFailurePromise;
  assert(usageApiClientFailure instanceof Error);
  assert.match(usageApiClientFailure.message, /Bearer \[redacted\]/);
  assert.match(usageApiClientFailure.message, /sk-\[redacted\]/);
  assert.equal(usageApiClientFailure.message.includes("sk-proj-"), false);
  const adminSnapshotResult = await adminSnapshotPromise;
  assert.equal(adminSnapshotResult.ok, false);
  assert.equal(adminSnapshotResult.checks.length, 9);
  assert.equal(
    adminSnapshotResult.checks.find((check) => check.name === "admin_usage_summary").summary.reviewRuns,
    4
  );
  assert(adminSnapshotResult.warnings.includes("budget_status: over-budget periods present"));
  assert(adminSnapshotResult.warnings.includes("model_price_status: staleRows=1"));
  assert(adminSnapshotResult.warnings.includes("failed_job_events: recent dispatch failures present"));
  assert(adminSnapshotResult.warnings.includes("stale_run_claims: stale active claims present"));
  assert(adminSnapshotResult.warnings.includes("runtime_status_worker: preflight not ok"));
  const adminSnapshotMarkdown = adminSnapshot.formatAdminSnapshotMarkdown(adminSnapshotResult);
  assert.match(adminSnapshotMarkdown, /Admin Snapshot/);
  assert.match(adminSnapshotMarkdown, /model_price_status: ok/);
  const adminSnapshotFailure = await adminSnapshotFailurePromise;
  assert.equal(adminSnapshotFailure.ok, false);
  assert.match(adminSnapshotFailure.checks[0].error, /sk-\[redacted\]/);
  assert.equal(adminSnapshotFailure.checks[0].error.includes("sk-proj-"), false);
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
  assert.equal(
    usageRouteResult.body.byRepo.some((item) => item.key === "6529-Collections/public-repo"),
    false
  );
  const allowlistedUsageRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/public/usage/summary?days=7",
    headers: {},
  }, {
    usageApiSettings: usageApi.usageApiSettingsFromEnv({
      REVIEWBOT_USAGE_API_DEFAULT_DAYS: "7",
      REVIEWBOT_USAGE_API_MAX_DAYS: "30",
      REVIEWBOT_USAGE_API_PUBLIC_ORGS: "6529-Collections",
    }),
    loadUsageEvents: async () => ({ events: usageEvents }),
  });
  assert.equal(
    allowlistedUsageRouteResult.body.byRepo.some(
      (item) => item.key === "6529-Collections/public-repo"
    ),
    true
  );
  const adminUsageEventsRouteUrl = new URL("http://localhost/api/admin/usage/events/recent?days=7&limit=1");
  const adminUsageEventsRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/usage/events/recent?days=7&limit=1",
    headers: signedAdminHeadersFor(adminUsageEventsRouteUrl),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadUsageEvents: async ({ range, visibility, query }) => {
      assert.equal(range.days, 7);
      assert.equal(visibility, "admin");
      assert.equal(query.limit, 1);
      return {
        events: [{
          createdAt: "2026-06-10T01:00:00.000Z",
          repoFullName: "6529-Collections/private",
          prNumber: 12,
          requestor: "maintainer",
          reviewKind: "security",
          provider: "openai",
          model: "gpt-5.5",
          inputTokens: 10,
          outputTokens: 20,
          metadata: {
            detail:
              "usage row has github_pat_abcdefghijklmnopqrstuvwxyz1234567890 and sk-proj-abcdefghijklmnopqrstuvwx123456",
            nested: { token: "sk-proj-should-not-pass" },
          },
        }],
      };
    },
  });
  assert.equal(adminUsageEventsRouteResult.statusCode, 200);
  assert.equal(adminUsageEventsRouteResult.body.kind, "usage_events");
  assert.equal(adminUsageEventsRouteResult.body.limit, 1);
  assert.equal(adminUsageEventsRouteResult.body.events[0].repoFullName, "6529-Collections/private");
  assert(adminUsageEventsRouteResult.body.events[0].metadata.detail.includes("github_pat_[redacted]"));
  assert.equal(
    Object.prototype.hasOwnProperty.call(adminUsageEventsRouteResult.body.events[0].metadata, "nested"),
    false
  );
  const adminBudgetStatusRouteUrl = new URL("http://localhost/api/admin/budget/status");
  const adminBudgetStatusRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/budget/status",
    headers: signedAdminHeadersFor(adminBudgetStatusRouteUrl),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadBudgetStatus: async () => ({
      policies: [{
        scopeType: "repo",
        scopeValue: "6529-Collections/private",
        dailyBudgetUsd: 10,
        weeklyBudgetUsd: 100,
        monthlyBudgetUsd: null,
        enabled: true,
        currentSpend: {
          dailyUsd: "8.5",
          weeklyUsd: "110",
          monthlyUsd: "110",
        },
      }],
    }),
  });
  assert.equal(adminBudgetStatusRouteResult.statusCode, 200);
  assert.equal(adminBudgetStatusRouteResult.body.kind, "budget_status");
  assert.equal(adminBudgetStatusRouteResult.body.policies[0].utilization.daily.percentUsed, 85);
  assert.equal(adminBudgetStatusRouteResult.body.policies[0].utilization.weekly.overBudget, true);
  assert.equal(adminBudgetStatusRouteResult.body.policies[0].utilization.monthly.remainingUsd, null);
  const adminModelPriceStatusRouteUrl = new URL("http://localhost/api/admin/model-prices/status");
  const adminModelPriceStatusRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/model-prices/status",
    headers: signedAdminHeadersFor(adminModelPriceStatusRouteUrl),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadModelPriceStatus: async () => ({
      status: modelPriceStatusSummary,
    }),
  });
  assert.equal(adminModelPriceStatusRouteResult.statusCode, 200);
  assert.equal(adminModelPriceStatusRouteResult.body.kind, "model_price_status");
  assert.equal(adminModelPriceStatusRouteResult.body.status.summary.staleRows, 1);
  assert.equal(
    adminModelPriceStatusRouteResult.body.status.prices[0].sourceHost,
    "docs.anthropic.com"
  );
  assert.equal(JSON.stringify(adminModelPriceStatusRouteResult.body).includes("sourceUrl"), false);
  assert.equal(JSON.stringify(adminModelPriceStatusRouteResult.body).includes("notes"), false);
  const adminAlertStatusRouteUrl = new URL("http://localhost/api/admin/alerts/status");
  const adminAlertStatusRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/alerts/status",
    headers: signedAdminHeadersFor(adminAlertStatusRouteUrl),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadAlertStatus: async () => ({
      status: {
        enabled: true,
        notifier: {
          mode: "webhook",
          webhookConfigured: true,
          unsafe: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
        },
        "bad key": "sk-proj-should-not-pass",
      },
    }),
  });
  assert.equal(adminAlertStatusRouteResult.statusCode, 200);
  assert.equal(adminAlertStatusRouteResult.body.kind, "alert_status");
  assert.equal(adminAlertStatusRouteResult.body.status.notifier.mode, "webhook");
  assert(
    adminAlertStatusRouteResult.body.status.notifier.unsafe.includes("github_pat_[redacted]")
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(adminAlertStatusRouteResult.body.status, "bad key"),
    false
  );
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
      return {
        preflight: {
          ok: false,
          warnings: [{
            name: "test",
            message:
              "warning with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
          }],
          unsafeNested: {
            deeper: {
              token: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
            },
          },
          "bad key": "sk-proj-should-not-pass",
          github_pat_abcdefghijklmnopqrstuvwxyz1234567890: "should-not-pass",
        },
      };
    },
  });
  assert.equal(adminStatusRouteResult.statusCode, 200);
  assert.equal(adminStatusRouteResult.body.kind, "runtime_status");
  assert.equal(adminStatusRouteResult.body.preflight.ok, false);
  assert(
    adminStatusRouteResult.body.preflight.warnings[0].message.includes("Bearer [redacted]")
  );
  assert(adminStatusRouteResult.body.preflight.warnings[0].message.includes("sk-[redacted]"));
  assert.equal(
    adminStatusRouteResult.body.preflight.warnings[0].message.includes("sk-proj-"),
    false
  );
  assert(
    adminStatusRouteResult.body.preflight.unsafeNested.deeper.token.includes("github_pat_[redacted]")
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(adminStatusRouteResult.body.preflight, "bad key"),
    false
  );
  assert.equal(
    Object.keys(adminStatusRouteResult.body.preflight).some((key) => key.startsWith("github_pat_")),
    false
  );
  const scalarAdminStatusRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/status?profile=worker",
    headers: signedAdminHeadersFor(new URL("http://localhost/api/admin/status?profile=worker")),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadAdminStatus: async () => ({ preflight: "sk-proj-should-not-pass" }),
  });
  assert.equal(scalarAdminStatusRouteResult.statusCode, 200);
  assert.equal(scalarAdminStatusRouteResult.body.preflight, null);
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
  const adminRunClaimsRouteUrl = new URL(
    "http://localhost/api/admin/run-claims/recent?active=1&staleMinutes=120&limit=1"
  );
  const adminRunClaimsRouteResult = await appServer.handleHttpRequest({
    method: "GET",
    url: "/api/admin/run-claims/recent?active=1&staleMinutes=120&limit=1",
    headers: signedAdminHeadersFor(adminRunClaimsRouteUrl),
  }, {
    usageApiSettings,
    authorizeUsageApiAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadRunClaims: async ({ query }) => {
      assert.equal(query.limit, 1);
      assert.deepEqual(query.statuses, ["claimed", "dispatching", "running"]);
      assert.equal(query.updatedBefore.length, 24);
      return {
        claims: [{
          claimId: 1,
          runKey: "run-sk-proj-abcdefghijklmnopqrstuvwx123456",
          jobId: "job-claim",
          status: "running",
          repoFullName: "6529-Collections/private",
          metadata: {
            detail:
              "failed with github_pat_abcdefghijklmnopqrstuvwxyz1234567890 and sk-proj-abcdefghijklmnopqrstuvwx123456",
            nested: { token: "sk-proj-should-not-pass" },
          },
        }],
      };
    },
  });
  assert.equal(adminRunClaimsRouteResult.statusCode, 200);
  assert.equal(adminRunClaimsRouteResult.body.kind, "run_claims");
  assert.equal(adminRunClaimsRouteResult.body.active, true);
  assert.equal(adminRunClaimsRouteResult.body.staleMinutes, 120);
  assert(adminRunClaimsRouteResult.body.claims[0].runKey.includes("sk-[redacted]"));
  assert(adminRunClaimsRouteResult.body.claims[0].metadata.detail.includes("github_pat_[redacted]"));
  assert.equal(
    Object.prototype.hasOwnProperty.call(adminRunClaimsRouteResult.body.claims[0].metadata, "nested"),
    false
  );
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
  const adminBudgetStatus = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/budget/status"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
    loadBudgetStatus: async () => ({
      policies: [{
        scopeType: "model",
        scopeValue: "gpt-5.5",
        dailyBudgetUsd: 20,
        weeklyBudgetUsd: 80,
        monthlyBudgetUsd: 250,
        enabled: true,
        currentSpend: {
          dailyUsd: 5,
          weeklyUsd: 82,
          monthlyUsd: 125,
        },
      }],
    }),
  });
  assert.equal(adminBudgetStatus.statusCode, 200);
  assert.equal(adminBudgetStatus.body.kind, "budget_status");
  assert.match(adminBudgetStatus.body.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(adminBudgetStatus.body.policies[0].utilization.daily.percentUsed, 25);
  assert.equal(adminBudgetStatus.body.policies[0].utilization.weekly.overBudget, true);
  const missingBudgetStatus = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/budget/status"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
  });
  assert.equal(missingBudgetStatus.statusCode, 503);
  assert.match(missingBudgetStatus.body.error, /budget status/i);
  const adminModelPriceStatus = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/model-prices/status"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
    loadModelPriceStatus: async () => ({ status: modelPriceStatusSummary }),
  });
  assert.equal(adminModelPriceStatus.statusCode, 200);
  assert.equal(adminModelPriceStatus.body.kind, "model_price_status");
  assert.equal(adminModelPriceStatus.body.status.summary.providerModelCount, 2);
  const missingModelPriceStatus = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/model-prices/status"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
  });
  assert.equal(missingModelPriceStatus.statusCode, 503);
  assert.match(missingModelPriceStatus.body.error, /model price status/i);
  const adminAlertStatus = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/alerts/status"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
    loadAlertStatus: async () => ({ status: alertStatusSummary }),
  });
  assert.equal(adminAlertStatus.statusCode, 200);
  assert.equal(adminAlertStatus.body.kind, "alert_status");
  assert.equal(adminAlertStatus.body.status.notifier.snsTopicConfigured, true);
  assert.equal(JSON.stringify(adminAlertStatus.body).includes("123456789012"), false);
  const missingAlertStatus = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/admin/alerts/status"),
    headers: {},
  }, {
    settings: usageApiSettings,
    authorizeAdmin: async () => ({ allowed: true }),
  });
  assert.equal(missingAlertStatus.statusCode, 503);
  assert.match(missingAlertStatus.body.error, /alert status/i);
  const adminUsageEventsUrl = new URL("http://localhost/api/admin/usage/events/recent?days=7&limit=2");
  const adminUsageEvents = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: adminUsageEventsUrl,
    headers: signedAdminHeadersFor(adminUsageEventsUrl),
  }, {
    settings: usageApiSettings,
    authorizeAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadUsageEvents: async ({ query, visibility }) => {
      assert.equal(visibility, "admin");
      assert.equal(query.limit, 2);
      return { events: usageEvents };
    },
  });
  assert.equal(adminUsageEvents.statusCode, 200);
  assert.equal(adminUsageEvents.body.kind, "usage_events");
  assert.equal(adminUsageEvents.body.events[0].repoFullName, "6529-Collections/public-repo");
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
          reason:
            "queue failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
          metadata: {
            workflow: "review-job",
            detail:
              "failed with github_pat_abcdefghijklmnopqrstuvwxyz1234567890 and sk-proj-abcdefghijklmnopqrstuvwx123456",
            nested: { token: "sk-proj-should-not-pass" },
          },
        }],
      };
    },
  });
  assert.equal(adminJobEvents.statusCode, 200);
  assert.equal(adminJobEvents.body.kind, "job_events");
  assert.equal(adminJobEvents.body.events[0].accepted, false);
  assert(adminJobEvents.body.events[0].reason.includes("Bearer [redacted]"));
  assert(adminJobEvents.body.events[0].reason.includes("sk-[redacted]"));
  assert.equal(adminJobEvents.body.events[0].reason.includes("sk-proj-"), false);
  assert.equal(adminJobEvents.body.events[0].metadata.workflow, "review-job");
  assert(adminJobEvents.body.events[0].metadata.detail.includes("github_pat_[redacted]"));
  assert(adminJobEvents.body.events[0].metadata.detail.includes("sk-[redacted]"));
  assert.equal(adminJobEvents.body.events[0].metadata.detail.includes("sk-proj-"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(adminJobEvents.body.events[0].metadata, "nested"),
    false
  );
  const adminRunClaimsUrl = new URL("http://localhost/api/admin/run-claims/recent?status=running&limit=2");
  const adminRunClaims = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: adminRunClaimsUrl,
    headers: signedAdminHeadersFor(adminRunClaimsUrl),
  }, {
    settings: usageApiSettings,
    authorizeAdmin: adminAuth.createUsageApiAdminAuthorizer(hmacAuthSettings),
    loadRunClaims: async ({ query }) => {
      assert.deepEqual(query.statuses, ["running"]);
      assert.equal(query.onlyUnexpired, true);
      assert.equal(query.limit, 2);
      return {
        claims: [{
          claimId: 2,
          runKey: "run-key",
          jobId: "job-claim-2",
          status: "running",
          repoFullName: "6529-Collections/private",
          metadata: { worker: "review-job" },
        }],
      };
    },
  });
  assert.equal(adminRunClaims.statusCode, 200);
  assert.equal(adminRunClaims.body.status, "running");
  assert.equal(adminRunClaims.body.claims[0].metadata.worker, "review-job");
  const unavailableUsageApi = await usageApi.handleUsageApiRequest({
    method: "GET",
    url: new URL("http://localhost/api/public/usage/summary"),
    headers: {},
  }, {
    settings: usageApiSettings,
    loadUsageEvents: async () => ({
      unavailable: true,
      reason:
        "ledger failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
    }),
  });
  assert.equal(unavailableUsageApi.statusCode, 503);
  assert(unavailableUsageApi.body.error.includes("Bearer [redacted]"));
  assert(unavailableUsageApi.body.error.includes("sk-[redacted]"));
  assert.equal(unavailableUsageApi.body.error.includes("sk-proj-"), false);
  assert.throws(
    () => usageApi.jobEventsQueryFromRequest(
      { url: new URL("http://localhost/api/admin/jobs/recent?limit=999") },
      usageApiSettings
    ),
    /limit must be <= 50/
  );
  assert.throws(
    () => usageApi.usageEventsQueryFromRequest(
      { url: new URL("http://localhost/api/admin/usage/events/recent?limit=5001") },
      usageApiSettings
    ),
    /limit must be <= 5000/
  );
  assert.throws(
    () => usageApi.runClaimsQueryFromRequest(
      { url: new URL("http://localhost/api/admin/run-claims/recent?limit=999") },
      usageApiSettings
    ),
    /limit must be <= 50/
  );
  assert.throws(
    () => usageApi.runClaimsQueryFromRequest(
      { url: new URL("http://localhost/api/admin/run-claims/recent?staleMinutes=100000") },
      usageApiSettings
    ),
    /staleMinutes must be <=/
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
  const slackWebhookFixture = [
    "https://hooks.slack.com/services",
    "T00000000",
    "B00000000",
    "XXXXXXXXXXXXXXXXXXXXXXXX",
  ].join("/");
  const unsafeAlert = {
    kind: "spend_spike",
    severity: "warning",
    title:
      "Bearer abcdefghijklmnopqrstuvwxyz123456 and github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    message: `failed with sk-proj-abcdefghijklmnopqrstuvwx123456 and ${slackWebhookFixture}`,
    scopeType: "requestor",
    scopeValue: "sk-proj-abcdefghijklmnopqrstuvwx123456",
    nested: {
      token: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    },
    github_pat_abcdefghijklmnopqrstuvwxyz1234567890: "should-not-pass",
  };
  const safeAlertPayload = alertNotifier.alertPayload([unsafeAlert], { now: alertNow });
  assert.equal(safeAlertPayload.alertCount, 1);
  assert(safeAlertPayload.alerts[0].title.includes("Bearer [redacted]"));
  assert(safeAlertPayload.alerts[0].title.includes("github_pat_[redacted]"));
  assert(safeAlertPayload.alerts[0].message.includes("sk-[redacted]"));
  assert(safeAlertPayload.alerts[0].message.includes("[redacted-alert-webhook-url]"));
  assert(safeAlertPayload.alerts[0].scopeValue.includes("sk-[redacted]"));
  assert(safeAlertPayload.alerts[0].nested.token.includes("github_pat_[redacted]"));
  assert.equal(JSON.stringify(safeAlertPayload).includes("sk-proj-abcdefghijkl"), false);
  assert.equal(JSON.stringify(safeAlertPayload).includes("hooks.slack.com/services"), false);
  assert.equal(
    Object.keys(safeAlertPayload.alerts[0]).some((key) => key.startsWith("github_pat_")),
    false
  );
  let unsafeAlertOutput = "";
  const unsafeStdoutNotification = await alertNotifier.sendAlerts([unsafeAlert], {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "stdout",
    }),
    now: alertNow,
    write: (text) => {
      unsafeAlertOutput += text;
    },
  });
  assert.equal(unsafeStdoutNotification.alertCount, 1);
  assert(unsafeAlertOutput.includes("sk-[redacted]"));
  assert.equal(unsafeAlertOutput.includes("sk-proj-abcdefghijkl"), false);
  let unsafeWebhookRequest = null;
  const unsafeWebhookNotification = await alertNotifier.sendAlerts([unsafeAlert], {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "webhook",
      REVIEWBOT_ALERTS_WEBHOOK_URL: "https://alerts.example.test/reviewbot",
    }),
    now: alertNow,
    fetchImpl: async (url, options) => {
      unsafeWebhookRequest = { url, options };
      return { ok: true, status: 204 };
    },
  });
  assert.equal(unsafeWebhookNotification.alertCount, 1);
  assert.equal(unsafeWebhookRequest.url, "https://alerts.example.test/reviewbot");
  assert(unsafeWebhookRequest.options.body.includes("sk-[redacted]"));
  assert.equal(unsafeWebhookRequest.options.body.includes("sk-proj-abcdefghijkl"), false);
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
  let sesSendOptions = null;
  let sesContentJson = "";
  let sesDestinationJson = "";
  const sesNotification = await alertNotifier.sendAlerts([unsafeAlert], {
    settings: alertNotifier.alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: "ses",
      REVIEWBOT_ALERTS_SES_FROM: "ops@example.test",
      REVIEWBOT_ALERTS_SES_TO: "admin@example.test, security@example.test",
      REVIEWBOT_ALERTS_SES_TIMEOUT_MS: "4321",
    }),
    now: alertNow,
    execFileSync: (bin, args, options) => {
      assert.equal(bin, "aws");
      assert.equal(args.includes("sesv2"), true);
      assert.equal(args.includes("send-email"), true);
      const destinationArg = args[args.indexOf("--destination") + 1];
      const contentArg = args[args.indexOf("--content") + 1];
      sesDestinationJson = fs.readFileSync(destinationArg.replace(/^file:\/\//, ""), "utf8");
      sesContentJson = fs.readFileSync(contentArg.replace(/^file:\/\//, ""), "utf8");
      sesSendOptions = options;
      return "{}";
    },
  });
  assert.equal(sesNotification.delivered, true);
  assert.equal(sesSendOptions.timeout, 4321);
  assert.match(sesDestinationJson, /admin@example\.test/);
  assert.match(sesContentJson, /sk-\[redacted\]/);
  assert.equal(sesContentJson.includes("sk-proj-abcdefghijkl"), false);
  const missingSesPreflight = preflight.runPreflight({
    env: {
      ...preflightEnv,
      REVIEWBOT_ALERTS_ENABLED: "true",
      REVIEWBOT_ALERTS_NOTIFY_MODE: "ses",
    },
    strict: false,
  });
  assert.equal(
    missingSesPreflight.errors.some((error) => /REVIEWBOT_ALERTS_SES_FROM/.test(error.message)),
    true
  );
  const missingSesRecipientsPreflight = preflight.runPreflight({
    env: {
      ...preflightEnv,
      REVIEWBOT_ALERTS_ENABLED: "true",
      REVIEWBOT_ALERTS_NOTIFY_MODE: "ses",
      REVIEWBOT_ALERTS_SES_FROM: "ops@example.test",
    },
    strict: false,
  });
  assert.equal(
    missingSesRecipientsPreflight.errors.some((error) => /REVIEWBOT_ALERTS_SES_TO/.test(error.message)),
    true
  );
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
  const unsafeScheduledAlertResult = await scheduledSpendCheck.runScheduledSpendCheck({
    settings: {
      alertPolicy: spendAlerts.spendAlertPolicyFromEnv({
        REVIEWBOT_ALERTS_ENABLED: "true",
        REVIEWBOT_ALERTS_SPIKE_ALERT_ON_NEW_SPEND: "false",
      }),
      jobHealthPolicy: jobHealthAlerts.jobHealthAlertPolicyFromEnv({
        REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED: "false",
      }),
      notifierSettings: alertNotifier.alertNotifierSettingsFromEnv({
        REVIEWBOT_ALERTS_NOTIFY_MODE: "none",
      }),
      ledgerSettings: {},
      apiSettings: usageApiSettings,
      lookbackDays: 35,
    },
    events: [{
      createdAt: "2026-06-12T11:00:00.000Z",
      repoFullName: "6529-Collections/sk-proj-abcdefghijklmnopqrstuvwx123456",
      prNumber: 12,
      requestor: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
      reviewKind: "general",
      provider: "anthropic",
      model: "claude-opus-4-8",
      actualCostUsd: 9,
    }],
    budgetPolicies: [{
      scopeType: "repo",
      scopeValue: "6529-Collections/sk-proj-abcdefghijklmnopqrstuvwx123456",
      dailyBudgetUsd: 1,
      enabled: true,
    }],
    now: alertNow,
    dryRun: true,
    force: true,
  });
  assert.equal(unsafeScheduledAlertResult.alertCount, 1);
  assert(JSON.stringify(unsafeScheduledAlertResult.alerts).includes("sk-[redacted]"));
  assert.equal(
    JSON.stringify(unsafeScheduledAlertResult.alerts).includes("sk-proj-abcdefghijkl"),
    false
  );
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
  assert.equal(
    appServer.redactSensitiveText("Bearer abcdefghijklmnopqrstuvwxyz123456"),
    "Bearer [redacted]"
  );
  assert.equal(
    diagnostics.safeErrorLine(
      new Error(
        "discord https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCDE"
      )
    ),
    "Error: discord [redacted-alert-webhook-url]"
  );
  assert.doesNotThrow(() =>
    diagnostics.safeErrorLine({ stack: { not: "a string" } })
  );
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
  const unsafeOutputPath = path.join(
    outputDir,
    "github_pat_abcdefghijklmnopqrstuvwxyz1234567890.json"
  );
  const unsafeSummary = githubAppManifestConversion.manifestConversionSummary(
    {
      id: 456,
      slug: "sk-proj-abcdefghijklmnopqrstuvwx123456",
      name: "6529bot",
      owner: { login: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890" },
      html_url: "https://github.com/apps/sk-ant-api03-secretvalue1234567890",
      external_url: "https://github.com/6529-Collections/6529reviewbot",
      client_id: "client-id",
      client_secret: "client-secret",
      webhook_secret: "webhook-secret",
      pem: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----\n",
    },
    { outputPath: unsafeOutputPath }
  );
  assert.equal(unsafeSummary.slug.includes("sk-proj-"), false);
  assert.equal(unsafeSummary.owner.includes("github_pat_abcdefghijklmnopqrstuvwxyz"), false);
  assert.equal(unsafeSummary.outputPath.includes("github_pat_abcdefghijklmnopqrstuvwxyz"), false);
  await assert.rejects(
    () =>
      githubAppManifestConversion.createGitHubAppFromManifest({
        allowNoAuth: true,
        code: "abc123",
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          text: async () =>
            "bad github_pat_abcdefghijklmnopqrstuvwxyz1234567890 sk-ant-api03-secretvalue1234567890",
        }),
      }),
    (error) => {
      assert(error.message.includes("github_pat_[redacted]"));
      assert(error.message.includes("sk-[redacted]"));
      assert.equal(error.message.includes("github_pat_abcdefghijklmnopqrstuvwxyz"), false);
      assert.equal(error.message.includes("sk-ant-api03-secretvalue"), false);
      return true;
    }
  );
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

function runCliForSmoke(args) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    env: process.env,
  });
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
