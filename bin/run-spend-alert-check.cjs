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
    notification: notificationSummary(result.notification),
    alerts: (result.alerts || []).map((alert, index) => ({
      index,
      kind: alert.kind,
      severity: alert.severity,
      scopeType: alert.scopeType,
      status: alert.status,
      period: alert.period,
      windowHours: alert.windowHours,
      lookbackHours: alert.lookbackHours,
      staleClaimHours: alert.staleClaimHours,
    })),
  };
}

function notificationSummary(notification) {
  if (!notification) {
    return null;
  }
  return {
    ok: notification.ok,
    delivered: notification.delivered,
    mode: notification.mode,
    alertCount: notification.alertCount,
    reason: notification.reason,
  };
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
