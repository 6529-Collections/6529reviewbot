#!/usr/bin/env node

"use strict";

const { createReviewbotServer } = require("../src/app-server.cjs");
const {
  adminAuthSettingsFromEnv,
  createUsageApiAdminAuthorizer,
} = require("../src/admin-auth.cjs");
const { budgetSubjectFromEvent } = require("../src/budget-admission.cjs");
const { readBudgetSpendSnapshot } = require("../src/budget-ledger.cjs");
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

const port = Number.parseInt(process.env.PORT || process.env.REVIEWBOT_PORT || "8080", 10);
if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT or REVIEWBOT_PORT must be a valid TCP port.");
}

const serverOptions = {};
serverOptions.loadAdminStatus = async ({ query }) => ({
  preflight: runPreflight({
    profile: query.profile,
    strict: query.strict,
  }),
});
const usageApiReadersEnabled = parseBool(process.env.REVIEW_USAGE_ENABLED || "false");
if (usageApiReadersEnabled) {
  Object.assign(serverOptions, usageApiLedgerLoadersFromEnv());
  const budgetLedgerSettings = usageLedgerSettingsFromEnv();
  serverOptions.resolveBudgetSnapshot = async (jobEvent, admission, job, budgetPolicy) =>
    readBudgetSpendSnapshot(
      budgetLedgerSettings,
      budgetSubjectFromEvent(jobEvent, admission, jobEvent.run || job),
      budgetPolicy
    );
}
const jobLedgerSettings = jobLedgerSettingsFromEnv();
if (jobLedgerSettings.enabled) {
  serverOptions.recordJobEvent = async (event) => writeJobEvent(jobLedgerSettings, event);
  if (!serverOptions.loadJobEvents) {
    serverOptions.loadJobEvents = createUsageApiLedgerLoaders({
      ledgerSettings: jobLedgerSettings,
    }).loadJobEvents;
  }
}
const runControlLedgerSettings = runControlLedgerSettingsFromEnv();
if (runControlLedgerSettings.enabled) {
  serverOptions.claimReviewJob = async (job, context) =>
    claimReviewJobWithLedger(runControlLedgerSettings, job, context);
  serverOptions.updateRunClaimStatus = async (job, status, options) =>
    updateRunClaimStatus(runControlLedgerSettings, job, status, options);
}
const adminAuthSettings = adminAuthSettingsFromEnv();
if (adminAuthSettings.mode !== "disabled") {
  serverOptions.authorizeUsageApiAdmin = createUsageApiAdminAuthorizer(adminAuthSettings);
}
const githubAppAuthSettings = githubAppAuthSettingsFromEnv();
if (isGitHubAppAuthConfigured(githubAppAuthSettings)) {
  const githubApp = createGitHubAppIntegration({ settings: githubAppAuthSettings });
  serverOptions.resolveActorContext = githubApp.resolveActorContext;
  serverOptions.loadRepositoryConfig = githubApp.loadRepositoryConfig;
}

const server = createReviewbotServer(serverOptions);
server.listen(port, () => {
  console.log(`[reviewbot-app] listening on port ${port}`);
});

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
