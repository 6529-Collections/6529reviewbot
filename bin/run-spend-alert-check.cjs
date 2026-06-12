#!/usr/bin/env node

"use strict";

const { runScheduledSpendCheck } = require("../src/scheduled-spend-check.cjs");

async function main() {
  const args = new Set(process.argv.slice(2));
  const result = await runScheduledSpendCheck({
    dryRun: args.has("--dry-run"),
    force: args.has("--force"),
  });
  console.log(`${JSON.stringify(publicResult(result), null, 2)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

function publicResult(result) {
  return {
    ok: result.ok,
    enabled: result.enabled,
    alertCount: result.alertCount,
    range: result.range,
    notification: result.notification,
    alerts: result.alerts,
  };
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
