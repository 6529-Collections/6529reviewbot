#!/usr/bin/env node

"use strict";

const { createReviewbotServer } = require("../src/app-server.cjs");
const { usageApiLedgerLoadersFromEnv } = require("../src/usage-api-ledger.cjs");

const port = Number.parseInt(process.env.PORT || process.env.REVIEWBOT_PORT || "8080", 10);
if (!Number.isSafeInteger(port) || port <= 0 || port > 65535) {
  throw new Error("PORT or REVIEWBOT_PORT must be a valid TCP port.");
}

const serverOptions = {};
if (parseBool(process.env.REVIEW_USAGE_ENABLED || "false")) {
  Object.assign(serverOptions, usageApiLedgerLoadersFromEnv());
}

const server = createReviewbotServer(serverOptions);
server.listen(port, () => {
  console.log(`[reviewbot-app] listening on port ${port}`);
});

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}
