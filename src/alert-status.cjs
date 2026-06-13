"use strict";

const { alertNotifierSettingsFromEnv } = require("./alert-notifier.cjs");
const { redactSensitiveText } = require("./diagnostics.cjs");
const { defaultLookbackDays } = require("./scheduled-spend-check.cjs");
const { spendAlertPolicyFromEnv } = require("./spend-alerts.cjs");
const { jobHealthAlertPolicyFromEnv } = require("./job-health-alerts.cjs");
const { usageApiSettingsFromEnv } = require("./usage-api.cjs");

function alertStatusFromEnv(env = process.env) {
  const spend = spendAlertPolicyFromEnv(env);
  const jobHealth = jobHealthAlertPolicyFromEnv(env);
  const notifier = alertNotifierSettingsFromEnv(env);
  const apiSettings = usageApiSettingsFromEnv(env);
  const lookbackDays = positiveInt(
    env.REVIEWBOT_ALERTS_LOOKBACK_DAYS,
    defaultLookbackDays(spend),
    "REVIEWBOT_ALERTS_LOOKBACK_DAYS"
  );
  const maxEvents = positiveInt(
    env.REVIEWBOT_ALERTS_MAX_EVENTS,
    apiSettings.maxEvents,
    "REVIEWBOT_ALERTS_MAX_EVENTS"
  );

  return {
    enabled: spend.enabled || jobHealth.enabled,
    spend: {
      enabled: spend.enabled,
      budgetWarningPercent: spend.budgetWarningPercent,
      budgetCriticalPercent: spend.budgetCriticalPercent,
      spikeWindowHours: spend.spikeWindowHours,
      spikeBaselineDays: spend.spikeBaselineDays,
      spikeMultiplier: spend.spikeMultiplier,
      spikeMinUsd: spend.spikeMinUsd,
      spikeDimensions: spend.spikeDimensions,
      alertOnNewSpend: spend.alertOnNewSpend,
      maxAlerts: spend.maxAlerts,
    },
    jobHealth: {
      enabled: jobHealth.enabled,
      failureLookbackHours: jobHealth.failureLookbackHours,
      failureThreshold: jobHealth.failureThreshold,
      staleClaimHours: jobHealth.staleClaimHours,
      staleClaimThreshold: jobHealth.staleClaimThreshold,
      maxAlerts: jobHealth.maxAlerts,
    },
    schedule: {
      lookbackDays,
      maxEvents,
    },
    notifier: {
      mode: notifier.mode,
      failClosed: notifier.failClosed,
      webhookConfigured: Boolean(notifier.webhookUrl),
      webhookTimeoutMs: notifier.webhookTimeoutMs,
      snsTopicConfigured: Boolean(notifier.snsTopicArn),
      snsRegion: safeText(notifier.snsRegion, 120),
      snsSubjectConfigured: Boolean(notifier.snsSubject),
      snsTimeoutMs: notifier.snsTimeoutMs,
      sesFromConfigured: Boolean(notifier.sesFrom),
      sesRecipientCount: notifier.sesTo.length,
      sesRegion: safeText(notifier.sesRegion, 120),
      sesSubjectConfigured: Boolean(notifier.sesSubject),
      sesTimeoutMs: notifier.sesTimeoutMs,
    },
  };
}

function safeText(value, maxChars = 1000) {
  return redactSensitiveText(value).slice(0, maxChars);
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
  alertStatusFromEnv,
};
