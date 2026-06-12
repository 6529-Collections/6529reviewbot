"use strict";

const { readEnabledBudgetPolicies } = require("./budget-ledger.cjs");
const { alertNotifierSettingsFromEnv, sendAlerts } = require("./alert-notifier.cjs");
const { evaluateSpendAlerts, spendAlertPolicyFromEnv } = require("./spend-alerts.cjs");
const { usageApiSettingsFromEnv } = require("./usage-api.cjs");
const { readUsageEvents } = require("./usage-api-ledger.cjs");
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
  const alerts = evaluateSpendAlerts({
    events,
    budgetPolicies,
    now,
    policy: settings.alertPolicy,
  });
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
  runScheduledSpendCheck,
  scheduledSpendCheckSettingsFromEnv,
};
