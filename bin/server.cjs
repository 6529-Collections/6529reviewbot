#!/usr/bin/env node

"use strict";

const {
  createReviewbotServer,
  startWebhookInboxProcessor,
} = require("../src/app-server.cjs");
const {
  adminAuthSettingsFromEnv,
  createUsageApiAdminAuthorizer,
} = require("../src/admin-auth.cjs");
const { alertStatusFromEnv } = require("../src/alert-status.cjs");
const { budgetSubjectFromEvent } = require("../src/budget-admission.cjs");
const { mergeBudgetPolicyRows } = require("../src/budget-policies.cjs");
const {
  readBudgetSpendSnapshot,
  readEnabledBudgetPolicies,
} = require("../src/budget-ledger.cjs");
const {
  createGitHubAppIntegration,
  githubAppAuthSettingsFromEnv,
  githubAppAuthSettingsFromWorkerDispatchEnv,
  isGitHubAppAuthConfigured,
} = require("../src/github-app-auth.cjs");
const {
  jobLedgerSettingsFromEnv,
  writeJobEvent,
} = require("../src/job-ledger.cjs");
const {
  claimReviewJobWithLedger,
  runControlLedgerSettingsFromEnv,
  updateRunClaimStatus,
} = require("../src/run-control-ledger.cjs");
const { runPreflight } = require("../src/preflight.cjs");
const {
  createUsageApiLedgerLoaders,
  usageApiLedgerLoadersFromEnv,
} = require("../src/usage-api-ledger.cjs");
const { usageLedgerSettingsFromEnv } = require("../src/usage-ledger.cjs");
const {
  createWebhookInbox,
  webhookInboxSettingsFromEnv,
} = require("../src/webhook-inbox.cjs");
const {
  createReviewJobEnqueuer,
  enqueueReviewJobsWithAdapter,
  workerAdapterPolicyFromEnv,
} = require("../src/worker-adapter.cjs");

function createServerOptionsFromEnv(env = process.env, options = {}) {
  const serverOptions = {};
  const workerFetchImpl = options.workerFetchImpl || options.fetchImpl;
  const workerPolicy = workerAdapterPolicyFromEnv(env);
  serverOptions.estimateBudgetCost =
    options.estimateBudgetCost || ((jobEvent, admission, job) => {
      if (job?.reviewKind === "responsiveness") {
        return {
          estimatedCostUsd: responsivenessEstimatedCostUsdFromEnv(env),
        };
      }
      return {};
    });
  serverOptions.enqueueReviewJobs = createReviewJobEnqueuer({
    env,
    fetchImpl: workerFetchImpl,
    policy: workerPolicy,
  });
  serverOptions.loadAdminStatus = async ({ query }) => ({
    preflight: runPreflight({
      profile: query.profile,
      strict: query.strict,
      env,
    }),
  });
  serverOptions.loadAlertStatus = async () => ({
    status: alertStatusFromEnv(env),
  });
  const usageApiReadersEnabled = parseBool(env.REVIEW_USAGE_ENABLED || "false");
  if (usageApiReadersEnabled) {
    Object.assign(serverOptions, usageApiLedgerLoadersFromEnv(env));
    const budgetLedgerSettings = usageLedgerSettingsFromEnv(env);
    serverOptions.loadBudgetPolicy = async (basePolicy) =>
      mergeBudgetPolicyRows(basePolicy, readEnabledBudgetPolicies(budgetLedgerSettings));
    serverOptions.resolveBudgetSnapshot = async (jobEvent, admission, job, budgetPolicy) =>
      readBudgetSpendSnapshot(
        budgetLedgerSettings,
        budgetSubjectFromEvent(jobEvent, admission, jobEvent.run || job),
        budgetPolicy
      );
  }
  const jobLedgerSettings = jobLedgerSettingsFromEnv(env);
  if (jobLedgerSettings.enabled) {
    serverOptions.recordJobEvent = async (event) => writeJobEvent(jobLedgerSettings, event);
    if (!serverOptions.loadJobEvents) {
      serverOptions.loadJobEvents = createUsageApiLedgerLoaders({
        ledgerSettings: jobLedgerSettings,
      }).loadJobEvents;
    }
  }
  const runControlLedgerSettings = runControlLedgerSettingsFromEnv(env);
  if (runControlLedgerSettings.enabled) {
    serverOptions.claimReviewJob = async (job, context) =>
      claimReviewJobWithLedger(runControlLedgerSettings, job, context);
    serverOptions.updateRunClaimStatus = async (job, status, options) =>
      updateRunClaimStatus(runControlLedgerSettings, job, status, options);
    if (!serverOptions.loadRunClaims) {
      serverOptions.loadRunClaims = createUsageApiLedgerLoaders({
        ledgerSettings: runControlLedgerSettings,
      }).loadRunClaims;
    }
  }
  const adminAuthSettings = adminAuthSettingsFromEnv(env);
  if (adminAuthSettings.mode !== "disabled") {
    serverOptions.authorizeUsageApiAdmin = createUsageApiAdminAuthorizer(adminAuthSettings);
  }
  const webhookInboxSettings = webhookInboxSettingsFromEnv(env);
  if (webhookInboxSettings.enabled) {
    serverOptions.webhookInbox = createWebhookInbox(webhookInboxSettings);
    if (!serverOptions.loadWebhookInbox) {
      serverOptions.loadWebhookInbox = createUsageApiLedgerLoaders({
        ledgerSettings: webhookInboxSettings,
      }).loadWebhookInbox;
    }
  }
  const githubAppAuthSettings = githubAppAuthSettingsFromEnv(env);
  if (isGitHubAppAuthConfigured(githubAppAuthSettings)) {
    const githubApp = createGitHubAppIntegration({
      settings: githubAppAuthSettings,
      fetchImpl: options.githubFetchImpl || options.fetchImpl,
    });
    serverOptions.resolveActorContext = githubApp.resolveActorContext;
    serverOptions.hydrateEvent = githubApp.hydratePullRequestContext;
    serverOptions.loadRepositoryConfig = githubApp.loadRepositoryConfig;
  }
  const workerDispatchGitHubAppSettings =
    githubAppAuthSettingsFromWorkerDispatchEnv(env);
  if (
    workerPolicy.githubInstallationId &&
    isGitHubAppAuthConfigured(workerDispatchGitHubAppSettings)
  ) {
    const workerDispatchGitHubApp = createGitHubAppIntegration({
      settings: workerDispatchGitHubAppSettings,
      fetchImpl: options.workerGitHubFetchImpl || options.fetchImpl,
    });
    serverOptions.enqueueReviewJobs = async (jobs, controls) =>
      enqueueReviewJobsWithAdapter(jobs, controls, {
        env,
        fetchImpl: workerFetchImpl,
        policy: {
          ...workerPolicy,
          githubToken: await workerDispatchGitHubApp.getInstallationToken(
            workerPolicy.githubInstallationId
          ),
        },
      });
  }
  return serverOptions;
}

function serverPortFromEnv(env = process.env) {
  const value = env.PORT || env.REVIEWBOT_PORT || "8080";
  if (!/^\d+$/.test(String(value))) {
    throw new Error("PORT or REVIEWBOT_PORT must be a valid TCP port.");
  }
  const port = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT or REVIEWBOT_PORT must be a valid TCP port.");
  }
  return port;
}

function startServer(env = process.env) {
  const port = serverPortFromEnv(env);
  const serverOptions = createServerOptionsFromEnv(env);
  const server = createReviewbotServer(serverOptions);
  const webhookInboxProcessor = startWebhookInboxProcessor({
    ...serverOptions,
    logger: console,
  });
  server.on("close", () => webhookInboxProcessor.stop());
  server.listen(port, () => {
    console.log(`[reviewbot-app] listening on port ${port}`);
  });
  return server;
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function responsivenessEstimatedCostUsdFromEnv(env = process.env) {
  return nonNegativeNumberEnv(
    env.REVIEWBOT_RESPONSIVENESS_ESTIMATED_COST_USD ||
      env.REVIEWBOT_GITHUB_ACTIONS_ESTIMATED_COST_USD ||
      env.REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD ||
      "1",
    "REVIEWBOT_RESPONSIVENESS_ESTIMATED_COST_USD"
  );
}

function nonNegativeNumberEnv(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServerOptionsFromEnv,
  parseBool,
  responsivenessEstimatedCostUsdFromEnv,
  serverPortFromEnv,
  startServer,
};
