#!/usr/bin/env node

"use strict";

const { createReviewbotServer } = require("../src/app-server.cjs");
const {
  adminAuthSettingsFromEnv,
  createUsageApiAdminAuthorizer,
} = require("../src/admin-auth.cjs");
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
} = require("../src/run-control-ledger.cjs");
const { usageApiLedgerLoadersFromEnv } = require("../src/usage-api-ledger.cjs");

const port = Number.parseInt(process.env.PORT || process.env.REVIEWBOT_PORT || "8080", 10);
if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT or REVIEWBOT_PORT must be a valid TCP port.");
}

const serverOptions = {};
if (parseBool(process.env.REVIEW_USAGE_ENABLED || "false")) {
  Object.assign(serverOptions, usageApiLedgerLoadersFromEnv());
}
const jobLedgerSettings = jobLedgerSettingsFromEnv();
if (jobLedgerSettings.enabled) {
  serverOptions.recordJobEvent = async (event) => writeJobEvent(jobLedgerSettings, event);
}
const runControlLedgerSettings = runControlLedgerSettingsFromEnv();
if (runControlLedgerSettings.enabled) {
  serverOptions.claimReviewJob = async (job, context) =>
    claimReviewJobWithLedger(runControlLedgerSettings, job, context);
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
