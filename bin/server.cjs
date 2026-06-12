#!/usr/bin/env node

"use strict";

const { createReviewbotServer } = require("../src/app-server.cjs");
const {
  adminAuthSettingsFromEnv,
  createUsageApiAdminAuthorizer,
} = require("../src/admin-auth.cjs");
const { budgetSubjectFromEvent } = require("../src/budget-admission.cjs");
const { mergeBudgetPolicyRows } = require("../src/budget-policies.cjs");
const {
  readBudgetSpendSnapshot,
  readEnabledBudgetPolicies,
} = require("../src/budget-ledger.cjs");
const {
  createGitHubAppIntegration,
  githubAppAuthSettingsFromEnv,
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
const { createReviewJobEnqueuer } = require("../src/worker-adapter.cjs");

function createServerOptionsFromEnv(env = process.env) {
  const serverOptions = {};
  serverOptions.enqueueReviewJobs = createReviewJobEnqueuer({ env });
  serverOptions.loadAdminStatus = async ({ query }) => ({
    preflight: runPreflight({
      profile: query.profile,
      strict: query.strict,
      env,
    }),
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
  }
  const adminAuthSettings = adminAuthSettingsFromEnv(env);
  if (adminAuthSettings.mode !== "disabled") {
    serverOptions.authorizeUsageApiAdmin = createUsageApiAdminAuthorizer(adminAuthSettings);
  }
  const githubAppAuthSettings = githubAppAuthSettingsFromEnv(env);
  if (isGitHubAppAuthConfigured(githubAppAuthSettings)) {
    const githubApp = createGitHubAppIntegration({ settings: githubAppAuthSettings });
    serverOptions.resolveActorContext = githubApp.resolveActorContext;
    serverOptions.loadRepositoryConfig = githubApp.loadRepositoryConfig;
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
  const server = createReviewbotServer(createServerOptionsFromEnv(env));
  server.listen(port, () => {
    console.log(`[reviewbot-app] listening on port ${port}`);
  });
  return server;
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServerOptionsFromEnv,
  parseBool,
  serverPortFromEnv,
  startServer,
};
