"use strict";

const { redactSensitiveText } = require("./diagnostics.cjs");

const DEFAULT_SNAPSHOT_OPTIONS = {
  days: 30,
  recentDays: 7,
  limit: 50,
  staleMinutes: 120,
};

async function collectAdminSnapshot(options = {}) {
  const client = options.client;
  if (!client) {
    throw new Error("Admin snapshot requires a usage API client.");
  }
  const policy = {
    days: positiveInt(options.days, DEFAULT_SNAPSHOT_OPTIONS.days, "days"),
    recentDays: positiveInt(options.recentDays, DEFAULT_SNAPSHOT_OPTIONS.recentDays, "recentDays"),
    limit: positiveInt(options.limit, DEFAULT_SNAPSHOT_OPTIONS.limit, "limit"),
    staleMinutes: positiveInt(
      options.staleMinutes,
      DEFAULT_SNAPSHOT_OPTIONS.staleMinutes,
      "staleMinutes"
    ),
  };
  const checks = [];
  checks.push(
    await snapshotCheck("admin_usage_summary", async () =>
      summarizeUsageSummary(await client.adminUsageSummary({ days: policy.days }))
    )
  );
  checks.push(
    await snapshotCheck("recent_usage_events", async () =>
      summarizeRecentUsageEvents(
        await client.recentUsageEvents({ days: policy.recentDays, limit: policy.limit })
      )
    )
  );
  checks.push(
    await snapshotCheck("budget_status", async () =>
      summarizeBudgetStatus(await client.budgetStatus())
    )
  );
  checks.push(
    await snapshotCheck("model_price_status", async () =>
      summarizeModelPriceStatus(await client.modelPriceStatus())
    )
  );
  checks.push(
    await snapshotCheck("alert_status", async () =>
      summarizeAlertStatus(await client.alertStatus())
    )
  );
  checks.push(
    await snapshotCheck("failed_job_events", async () =>
      summarizeJobEvents(await client.jobEvents({ status: "dispatch_failed", limit: policy.limit }))
    )
  );
  checks.push(
    await snapshotCheck("stale_run_claims", async () =>
      summarizeRunClaims(
        await client.runClaims({
          active: true,
          staleMinutes: policy.staleMinutes,
          limit: policy.limit,
        })
      )
    )
  );
  checks.push(
    await snapshotCheck("runtime_status_server", async () =>
      summarizeRuntimeStatus(await client.runtimeStatus({ profile: "server" }))
    )
  );
  checks.push(
    await snapshotCheck("runtime_status_worker", async () =>
      summarizeRuntimeStatus(await client.runtimeStatus({ profile: "worker" }))
    )
  );
  const warnings = snapshotWarnings(checks);
  return {
    generatedAt: (options.now || new Date()).toISOString(),
    policy,
    ok: checks.every((check) => check.ok) && warnings.length === 0,
    checks,
    warnings,
  };
}

async function snapshotCheck(name, fn) {
  try {
    return {
      name,
      ok: true,
      summary: await fn(),
    };
  } catch (error) {
    return {
      name,
      ok: false,
      error: redactSensitiveText(error?.message || error).slice(0, 500),
    };
  }
}

function summarizeUsageSummary(body = {}) {
  const totals = body.totals || {};
  return {
    reviewRuns: wholeNumber(totals.reviewRuns),
    costUsd: nullableNumber(totals.costUsd) || 0,
    totalTokens: wholeNumber(totals.totalTokens),
    budgetSkippedRuns: wholeNumber(totals.budgetSkippedRuns),
    requestorGroups: Array.isArray(body.byRequestor) ? body.byRequestor.length : 0,
    prGroups: Array.isArray(body.byPr) ? body.byPr.length : 0,
  };
}

function summarizeRecentUsageEvents(body = {}) {
  const events = Array.isArray(body.events) ? body.events : [];
  return {
    eventCount: events.length,
    budgetSkippedRuns: events.filter((event) => Boolean(event.budgetSkipped)).length,
  };
}

function summarizeBudgetStatus(body = {}) {
  const policies = Array.isArray(body.policies) ? body.policies : [];
  return {
    policyCount: policies.length,
    overBudgetPeriods: policies.reduce(
      (total, policy) =>
        total +
        ["daily", "weekly", "monthly"].filter(
          (period) => Boolean(policy.utilization?.[period]?.overBudget)
        ).length,
      0
    ),
    highUtilizationPeriods: policies.reduce(
      (total, policy) =>
        total +
        ["daily", "weekly", "monthly"].filter((period) => {
          const percent = nullableNumber(policy.utilization?.[period]?.percentUsed);
          return percent !== null && percent >= 80;
        }).length,
      0
    ),
  };
}

function summarizeModelPriceStatus(body = {}) {
  const summary = body.status?.summary || {};
  return {
    activeRows: wholeNumber(summary.activeRows),
    providerModelCount: wholeNumber(summary.providerModelCount),
    staleRows: wholeNumber(summary.staleRows),
    futureRows: wholeNumber(summary.futureRows),
    missingSourceRows: wholeNumber(summary.missingSourceRows),
    invalidSourceRows: wholeNumber(summary.invalidSourceRows),
    incompleteRows: wholeNumber(summary.incompleteRows),
  };
}

function summarizeAlertStatus(body = {}) {
  const status = body.status || {};
  const notifier = status.notifier || {};
  return {
    enabled: Boolean(status.enabled),
    spendEnabled: Boolean(status.spend?.enabled),
    jobHealthEnabled: Boolean(status.jobHealth?.enabled),
    notifierMode: String(notifier.mode || "unknown"),
    webhookConfigured: Boolean(notifier.webhookConfigured),
    snsTopicConfigured: Boolean(notifier.snsTopicConfigured),
  };
}

function summarizeJobEvents(body = {}) {
  const events = Array.isArray(body.events) ? body.events : [];
  return {
    eventCount: events.length,
  };
}

function summarizeRunClaims(body = {}) {
  const claims = Array.isArray(body.claims) ? body.claims : [];
  return {
    claimCount: claims.length,
    active: Boolean(body.active),
    staleMinutes: nullableNumber(body.staleMinutes),
  };
}

function summarizeRuntimeStatus(body = {}) {
  const preflight = body.preflight || {};
  return {
    profile: String(body.profile || ""),
    ok: preflight.ok === true,
    checkCount: Array.isArray(preflight.checks) ? preflight.checks.length : 0,
    warningCount: Array.isArray(preflight.warnings) ? preflight.warnings.length : 0,
    errorCount: Array.isArray(preflight.errors) ? preflight.errors.length : 0,
  };
}

function snapshotWarnings(checks = []) {
  const warnings = [];
  for (const check of checks) {
    if (!check.ok) {
      warnings.push(`${check.name}: unavailable`);
      continue;
    }
    const summary = check.summary || {};
    if (check.name === "budget_status" && summary.overBudgetPeriods > 0) {
      warnings.push("budget_status: over-budget periods present");
    }
    if (check.name === "budget_status" && summary.highUtilizationPeriods > 0) {
      warnings.push("budget_status: high utilization periods present");
    }
    if (check.name === "model_price_status") {
      for (const key of ["staleRows", "futureRows", "missingSourceRows", "invalidSourceRows", "incompleteRows"]) {
        if (summary[key] > 0) {
          warnings.push(`model_price_status: ${key}=${summary[key]}`);
        }
      }
    }
    if (check.name === "alert_status" && !summary.enabled) {
      warnings.push("alert_status: alerts disabled");
    }
    if (check.name.startsWith("runtime_status") && summary.ok === false) {
      warnings.push(`${check.name}: preflight not ok`);
    }
    if (check.name === "failed_job_events" && summary.eventCount > 0) {
      warnings.push("failed_job_events: recent dispatch failures present");
    }
    if (check.name === "stale_run_claims" && summary.claimCount > 0) {
      warnings.push("stale_run_claims: stale active claims present");
    }
  }
  return warnings;
}

function formatAdminSnapshotMarkdown(snapshot) {
  const lines = [
    "# 6529reviewbot Admin Snapshot",
    "",
    `Generated: ${snapshot.generatedAt}`,
    `Overall: ${snapshot.ok ? "ok" : "attention required"}`,
    "",
    "## Checks",
    "",
  ];
  for (const check of snapshot.checks || []) {
    if (!check.ok) {
      lines.push(`- ${check.name}: failed - ${check.error || "unavailable"}`);
      continue;
    }
    lines.push(`- ${check.name}: ok - ${compactSummary(check.summary)}`);
  }
  lines.push("", "## Warnings", "");
  if (snapshot.warnings?.length) {
    for (const warning of snapshot.warnings) {
      lines.push(`- ${warning}`);
    }
  } else {
    lines.push("- none");
  }
  return `${lines.join("\n")}\n`;
}

function compactSummary(value = {}) {
  const parts = [];
  for (const [key, item] of Object.entries(value)) {
    parts.push(`${key}=${item}`);
  }
  return parts.join(", ") || "no summary";
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function wholeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

module.exports = {
  DEFAULT_SNAPSHOT_OPTIONS,
  collectAdminSnapshot,
  formatAdminSnapshotMarkdown,
  snapshotWarnings,
};
