"use strict";

const { readEnabledBudgetPolicies } = require("./budget-ledger.cjs");
const { alertNotifierSettingsFromEnv, sanitizeAlerts, sendAlerts } = require("./alert-notifier.cjs");
const {
  ACTIVE_CLAIM_STATUSES,
  FAILURE_STATUSES,
  evaluateJobHealthAlerts,
  jobHealthAlertPolicyFromEnv,
} = require("./job-health-alerts.cjs");
const { evaluateSpendAlerts, spendAlertPolicyFromEnv } = require("./spend-alerts.cjs");
const { usageApiSettingsFromEnv } = require("./usage-api.cjs");
const { readJobEvents, readRunClaims, readUsageEvents } = require("./usage-api-ledger.cjs");
const { usageLedgerSettingsFromEnv } = require("./usage-ledger.cjs");

function scheduledSpendCheckSettingsFromEnv(env = process.env) {
  const alertPolicy = spendAlertPolicyFromEnv(env);
  const lookbackDays = positiveInt(
    env.REVIEWBOT_ALERTS_LOOKBACK_DAYS,
    defaultLookbackDays(alertPolicy),
    "REVIEWBOT_ALERTS_LOOKBACK_DAYS"
  );
  const apiSettings = usageApiSettingsFromEnv(env);
  apiSettings.maxEvents = positiveInt(
    env.REVIEWBOT_ALERTS_MAX_EVENTS,
    apiSettings.maxEvents,
    "REVIEWBOT_ALERTS_MAX_EVENTS"
  );
  return {
    alertPolicy,
    jobHealthPolicy: jobHealthAlertPolicyFromEnv(env),
    notifierSettings: alertNotifierSettingsFromEnv(env),
    ledgerSettings: usageLedgerSettingsFromEnv(env),
    apiSettings,
    lookbackDays,
  };
}

async function runScheduledSpendCheck(options = {}) {
  const settings = options.settings || scheduledSpendCheckSettingsFromEnv(options.env);
  const now = options.now ? new Date(options.now) : new Date();
  if (!settings.alertPolicy.enabled && !options.force) {
    return {
      ok: true,
      enabled: false,
      alertCount: 0,
      alerts: [],
      notification: {
        ok: true,
        delivered: false,
        reason: "Spend alerts are disabled.",
      },
    };
  }

  const range = alertRange(now, settings.lookbackDays);
  const events =
    options.events ||
    readUsageEvents(settings.ledgerSettings, {
      range,
      visibility: "admin",
      apiSettings: settings.apiSettings,
    });
  const budgetPolicies = options.budgetPolicies || readEnabledBudgetPolicies(settings.ledgerSettings);
  const alerts = sanitizeAlerts([
    ...evaluateSpendAlerts({
      events,
      budgetPolicies,
      now,
      policy: settings.alertPolicy,
    }),
    ...readAndEvaluateJobHealthAlerts(settings, options, now),
  ]);
  const notification = options.dryRun
    ? { ok: true, delivered: false, mode: "dry_run", alertCount: alerts.length }
    : await sendAlerts(alerts, {
        settings: settings.notifierSettings,
        now,
        fetchImpl: options.fetchImpl,
        execFileSync: options.execFileSync,
        write: options.write,
      });

  return {
    ok: notification.ok !== false,
    enabled: true,
    range,
    alertCount: alerts.length,
    alerts,
    notification,
  };
}

function readAndEvaluateJobHealthAlerts(settings, options, now) {
  const policy = settings.jobHealthPolicy || jobHealthAlertPolicyFromEnv(options.env);
  if (!policy.enabled) {
    return [];
  }
  const failureCutoff = new Date(now.getTime() - policy.failureLookbackHours * 60 * 60 * 1000);
  const staleBefore = new Date(now.getTime() - policy.staleClaimHours * 60 * 60 * 1000);
  const jobEvents =
    options.jobEvents ||
    readJobEvents(settings.ledgerSettings, {
      query: {
        statuses: FAILURE_STATUSES,
        createdAfter: failureCutoff.toISOString(),
        createdBefore: now.toISOString(),
        limit: policy.maxAlerts * 10,
      },
    });
  const runClaims =
    options.runClaims ||
    readRunClaims(settings.ledgerSettings, {
      query: {
        statuses: ACTIVE_CLAIM_STATUSES,
        updatedBefore: staleBefore.toISOString(),
        onlyUnexpired: true,
        limit: policy.maxAlerts * 10,
      },
    });
  return evaluateJobHealthAlerts({
    jobEvents,
    runClaims,
    now,
    policy,
  });
}

function alertRange(now, lookbackDays) {
  const to = new Date(now);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - lookbackDays);
  return {
    days: lookbackDays,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function defaultLookbackDays(policy) {
  const spikeDays = policy.spikeBaselineDays + Math.ceil(policy.spikeWindowHours / 24) + 1;
  return Math.max(35, spikeDays);
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

module.exports = {
  alertRange,
  defaultLookbackDays,
  readAndEvaluateJobHealthAlerts,
  runScheduledSpendCheck,
  scheduledSpendCheckSettingsFromEnv,
};
