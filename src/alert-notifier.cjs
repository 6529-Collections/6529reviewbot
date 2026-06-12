"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { awsCliBin, shouldUseShellForAwsCli } = require("./data-api.cjs");

const NOTIFY_MODES = ["none", "stdout", "webhook", "sns"];

function alertNotifierSettingsFromEnv(env = process.env) {
  return {
    mode: enumValue(
      env.REVIEWBOT_ALERTS_NOTIFY_MODE || "stdout",
      NOTIFY_MODES,
      "REVIEWBOT_ALERTS_NOTIFY_MODE"
    ),
    webhookUrl: env.REVIEWBOT_ALERTS_WEBHOOK_URL || "",
    webhookTimeoutMs: positiveInt(
      env.REVIEWBOT_ALERTS_WEBHOOK_TIMEOUT_MS,
      10000,
      "REVIEWBOT_ALERTS_WEBHOOK_TIMEOUT_MS"
    ),
    snsTopicArn: env.REVIEWBOT_ALERTS_SNS_TOPIC_ARN || "",
    snsRegion: env.REVIEWBOT_ALERTS_SNS_REGION || env.REVIEW_USAGE_AWS_REGION || process.env.AWS_REGION || "us-east-1",
    snsSubject: env.REVIEWBOT_ALERTS_SNS_SUBJECT || "6529bot spend alert",
    snsTimeoutMs: positiveInt(
      env.REVIEWBOT_ALERTS_SNS_TIMEOUT_MS,
      10000,
      "REVIEWBOT_ALERTS_SNS_TIMEOUT_MS"
    ),
    awsCliBin: env.AWS_CLI_BIN || awsCliBin(),
    failClosed: parseBool(env.REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED || "false"),
  };
}

async function sendAlerts(alerts, options = {}) {
  const normalizedAlerts = Array.isArray(alerts) ? alerts : [];
  const settings = options.settings || alertNotifierSettingsFromEnv(options.env);
  if (normalizedAlerts.length === 0) {
    return {
      ok: true,
      delivered: false,
      mode: settings.mode,
      alertCount: 0,
      reason: "No alerts generated.",
    };
  }

  const payload = alertPayload(normalizedAlerts, options);
  try {
    if (settings.mode === "none") {
      return { ok: true, delivered: false, mode: settings.mode, alertCount: normalizedAlerts.length };
    }
    if (settings.mode === "stdout") {
      const write = options.write || ((text) => process.stdout.write(text));
      write(`${JSON.stringify(payload, null, 2)}\n`);
      return { ok: true, delivered: true, mode: settings.mode, alertCount: normalizedAlerts.length };
    }
    if (settings.mode === "webhook") {
      await sendWebhookAlert(payload, settings, options);
      return { ok: true, delivered: true, mode: settings.mode, alertCount: normalizedAlerts.length };
    }
    if (settings.mode === "sns") {
      sendSnsAlert(payload, settings, options);
      return { ok: true, delivered: true, mode: settings.mode, alertCount: normalizedAlerts.length };
    }
  } catch (error) {
    if (settings.failClosed) {
      throw error;
    }
    return {
      ok: true,
      delivered: false,
      mode: settings.mode,
      alertCount: normalizedAlerts.length,
      error: safeError(error),
    };
  }

  throw new Error(`Unsupported alert notify mode '${settings.mode}'.`);
}

function alertPayload(alerts, options = {}) {
  return {
    ok: true,
    generatedAt: (options.now ? new Date(options.now) : new Date()).toISOString(),
    source: "6529reviewbot",
    alertCount: alerts.length,
    highestSeverity: highestSeverity(alerts),
    alerts,
  };
}

async function sendWebhookAlert(payload, settings, options = {}) {
  if (!settings.webhookUrl) {
    throw new Error("REVIEWBOT_ALERTS_WEBHOOK_URL is required for webhook alerts.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.webhookTimeoutMs);
  try {
    const fetchImpl = options.fetchImpl || fetch;
    const response = await fetchImpl(settings.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Alert webhook returned HTTP ${response.status}.`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function sendSnsAlert(payload, settings, options = {}) {
  if (!settings.snsTopicArn) {
    throw new Error("REVIEWBOT_ALERTS_SNS_TOPIC_ARN is required for SNS alerts.");
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-alerts-"));
  const payloadPath = path.join(tmpDir, "payload.json");
  try {
    fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), "utf8");
    const runner = options.execFileSync || execFileSync;
    runner(
      settings.awsCliBin,
      [
        "sns",
        "publish",
        "--region",
        settings.snsRegion,
        "--topic-arn",
        settings.snsTopicArn,
        "--subject",
        truncate(settings.snsSubject, 100),
        "--message",
        `file://${payloadPath}`,
      ],
      {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        shell: shouldShellForAwsCliBin(settings.awsCliBin),
        timeout: settings.snsTimeoutMs,
      }
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function highestSeverity(alerts) {
  return alerts.some((alert) => alert.severity === "critical") ? "critical" : "warning";
}

function shouldShellForAwsCliBin(configuredBin) {
  return String(configuredBin || "") === awsCliBin() && shouldUseShellForAwsCli();
}

function truncate(value, maxLength) {
  const text = String(value || "");
  return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
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

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function safeError(error) {
  return error && error.message ? error.message : String(error);
}

module.exports = {
  NOTIFY_MODES,
  alertNotifierSettingsFromEnv,
  alertPayload,
  sendAlerts,
  shouldShellForAwsCliBin,
};
