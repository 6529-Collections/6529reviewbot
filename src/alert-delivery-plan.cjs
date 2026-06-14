"use strict";

const { NOTIFY_MODES } = require("./alert-notifier.cjs");
const { isPlaceholderOrigin, normalizeOrigin, normalizeWorkspace } = require("./production-deployment-plan.cjs");
const { normalizeReleaseVersion } = require("./release-notes-draft.cjs");
const { DEFAULT_ADMIN_ALERT_STATUS_PATH } = require("./usage-api.cjs");

const DEFAULT_BOT_ORIGIN = "<production-bot-origin>";
const DEFAULT_OPERATOR_WORKSPACE = "<private-workspace-dir>";
const DEFAULT_NOTIFY_MODE = "<alert-notify-mode>";
const DEFAULT_ALERT_CHANNEL = "<operator-alert-channel>";
const DEFAULT_ALERT_STATUS_PATH = DEFAULT_ADMIN_ALERT_STATUS_PATH;
const PRODUCTION_NOTIFY_MODES = ["webhook", "sns", "ses"];
const DRY_RUN_NOTICE =
  "This command does not send alerts, create topics, verify SES identities, call webhooks, call AWS, or read live ledgers.";

function collectAlertDeliveryPlan(options = {}) {
  const release = normalizeReleaseVersion(options.release || options.version || "v0.1.0");
  const botOrigin = normalizePlanOrigin(
    options.botOrigin || options.host || options.origin || DEFAULT_BOT_ORIGIN,
    "production bot origin",
    DEFAULT_BOT_ORIGIN
  );
  const operatorWorkspace = normalizeWorkspace(
    options.operatorWorkspace || options.workspace || DEFAULT_OPERATOR_WORKSPACE
  );
  const notifyMode = normalizeNotifyMode(options.notifyMode || DEFAULT_NOTIFY_MODE);
  const alertChannel = normalizeAlertChannel(options.alertChannel || options.channel || DEFAULT_ALERT_CHANNEL);
  const alertStatusPath = normalizePath(options.alertStatusPath || DEFAULT_ALERT_STATUS_PATH, "alert status API path");
  const errors = [];
  const warnings = [];

  if (options.requireInputs) {
    if (botOrigin === DEFAULT_BOT_ORIGIN) {
      errors.push("production bot origin was not supplied.");
    } else if (isPlaceholderOrigin(botOrigin)) {
      errors.push("production bot origin must not use documentation, example, local, or reserved hosts.");
    }
    if (operatorWorkspace === DEFAULT_OPERATOR_WORKSPACE) {
      errors.push("private operator workspace was not supplied.");
    }
    if (notifyMode === DEFAULT_NOTIFY_MODE) {
      errors.push("alert notify mode was not supplied.");
    } else if (!PRODUCTION_NOTIFY_MODES.includes(notifyMode)) {
      errors.push("production alert notify mode must be webhook, sns, or ses.");
    }
    if (alertChannel === DEFAULT_ALERT_CHANNEL) {
      errors.push("operator alert channel was not supplied.");
    }
  } else {
    if (botOrigin === DEFAULT_BOT_ORIGIN) {
      warnings.push("production bot origin was not supplied; using placeholder commands.");
    }
    if (operatorWorkspace === DEFAULT_OPERATOR_WORKSPACE) {
      warnings.push("private operator workspace was not supplied; using placeholder commands.");
    }
    if (notifyMode === DEFAULT_NOTIFY_MODE) {
      warnings.push("alert notify mode was not supplied; using placeholder commands.");
    }
    if (alertChannel === DEFAULT_ALERT_CHANNEL) {
      warnings.push("operator alert channel was not supplied; using placeholder evidence.");
    }
  }

  if (
    botOrigin !== DEFAULT_BOT_ORIGIN ||
    operatorWorkspace !== DEFAULT_OPERATOR_WORKSPACE ||
    alertChannel !== DEFAULT_ALERT_CHANNEL
  ) {
    warnings.push("alert delivery plan output can include private origins, workspace paths, or channel labels.");
  }

  const ready = errors.length === 0;
  return {
    version: 1,
    release,
    ready,
    generatedAt: (options.now || new Date()).toISOString(),
    inputs: {
      botOrigin,
      operatorWorkspace,
      notifyMode,
      alertChannel,
      alertStatusPath,
    },
    errors,
    warnings,
    phases: alertDeliveryPhases({
      release,
      botOrigin,
      operatorWorkspace,
      notifyMode,
      alertChannel,
      alertStatusPath,
    }),
  };
}

function alertDeliveryPhases({
  release,
  botOrigin,
  operatorWorkspace,
  notifyMode,
  alertChannel,
  alertStatusPath,
}) {
  const cutoverStatus = `${operatorWorkspace}/production-cutover-status.json`;
  const evidenceFile = `${operatorWorkspace}/operator-evidence.json`;
  return [
    {
      id: "routing-configuration",
      title: "Routing Configuration",
      commands: [
        "configure REVIEWBOT_ALERTS_ENABLED=true",
        `configure REVIEWBOT_ALERTS_NOTIFY_MODE=${notifyMode}`,
        ...modeSpecificConfiguration(notifyMode),
        `record operator alert channel label ${alertChannel}`,
        "npm run check:alert-notifier-modes",
        "npm run check:alerting-runbook",
      ],
      evidence:
        "Record notify mode, channel owner, secret custody, sender/recipient or topic verification, and fail-open/fail-closed posture without publishing webhook URLs, SNS ARNs, email addresses, or AWS account ids.",
    },
    {
      id: "alert-policy",
      title: "Alert Policy",
      commands: [
        "configure REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT=80",
        "configure REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT=100",
        "configure REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED=true",
        "configure REVIEWBOT_ALERTS_STALE_CLAIM_HOURS=2",
        "npm run check:alert-dimensions",
        "npm run preflight -- -- --strict",
      ],
      evidence:
        "Record budget utilization, spend-spike, failed-job, and stale-claim thresholds plus strict preflight posture before enabling scheduled delivery.",
    },
    {
      id: "dry-run-and-status",
      title: "Dry-Run And Status",
      commands: [
        "npm run alerts:operator -- -- --dry-run --force",
        `verify private alert-status API ${botOrigin}${alertStatusPath} through 6529.io admin auth`,
        `npm run admin:snapshot -- -- --base-url ${botOrigin} --require-ok`,
      ],
      evidence:
        "Record dry-run alert count, alert-status posture, and admin snapshot warnings without copying raw alert payloads, private repo names, job ids, webhook targets, SNS ARNs, or email addresses into public artifacts.",
    },
    {
      id: "cutover-evidence",
      title: "Cutover Evidence",
      commands: [
        `npm run production:cutover -- -- --status-file ${cutoverStatus} --summary`,
        `npm run production:cutover -- -- --status-file ${cutoverStatus} --require-ready`,
        `npm run operator:evidence -- -- --file ${evidenceFile} --summary`,
      ],
      evidence:
        "Record production cutover items alert-delivery-plan-reviewed and alerts-deliver plus alert-delivery-plan and worker-and-alerts operator evidence as complete or explicitly deferred with owner and risk.",
    },
    {
      id: "release-notes",
      title: "Release Notes",
      commands: [
        "npm run release:notes",
        `npm run release:tag-plan -- -- --release ${release} --release-notes <release-notes.md> --require-ready`,
      ],
      evidence:
        "Summarize alert routing status in public release notes without publishing channel details, destinations, AWS identifiers, private payloads, or raw alert output.",
    },
  ];
}

function formatAlertDeliveryPlanMarkdown(plan) {
  const lines = [
    `# Alert Delivery Plan ${plan.release}`,
    "",
    `Ready to execute: ${plan.ready ? "yes" : "no"}`,
    `Generated: ${plan.generatedAt}`,
    DRY_RUN_NOTICE,
    "",
    "## Inputs",
    "",
    `- bot origin: ${plan.inputs.botOrigin}`,
    `- operator workspace: ${plan.inputs.operatorWorkspace}`,
    `- notify mode: ${plan.inputs.notifyMode}`,
    `- alert channel: ${plan.inputs.alertChannel}`,
    `- alert status path: ${plan.inputs.alertStatusPath}`,
  ];

  for (const phase of plan.phases) {
    lines.push("", `## ${phase.title}`, "");
    for (const command of phase.commands) {
      lines.push(`- \`${command}\``);
    }
    lines.push(`- Evidence: ${phase.evidence}`);
  }
  if (plan.errors.length) {
    lines.push("", "## Errors", "", ...plan.errors.map((error) => `- ${error}`));
  }
  if (plan.warnings.length) {
    lines.push("", "## Warnings", "", ...plan.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

function modeSpecificConfiguration(mode) {
  if (mode === "webhook") {
    return [
      "configure REVIEWBOT_ALERTS_WEBHOOK_URL=<private-webhook-url>",
      "configure REVIEWBOT_ALERTS_WEBHOOK_TIMEOUT_MS=10000",
    ];
  }
  if (mode === "sns") {
    return [
      "configure REVIEWBOT_ALERTS_SNS_TOPIC_ARN=<operator-sns-topic-arn>",
      "configure REVIEWBOT_ALERTS_SNS_REGION=<aws-region>",
      "configure REVIEWBOT_ALERTS_SNS_SUBJECT=\"6529bot spend alert\"",
    ];
  }
  if (mode === "ses") {
    return [
      "configure REVIEWBOT_ALERTS_SES_FROM=<verified-sender>",
      "configure REVIEWBOT_ALERTS_SES_TO=<operator-recipient-list>",
      "configure REVIEWBOT_ALERTS_SES_REGION=<aws-region>",
      "configure REVIEWBOT_ALERTS_SES_SUBJECT=\"6529bot operator alert\"",
    ];
  }
  if (mode === "stdout") {
    return ["keep stdout mode for local dry-run only; choose webhook, sns, or ses before production delivery"];
  }
  if (mode === "none") {
    return ["keep none mode for disabled delivery only; choose webhook, sns, or ses before production delivery"];
  }
  return ["configure production alert delivery settings after choosing a notify mode"];
}

function normalizePlanOrigin(value, label, placeholder) {
  if (String(value || "").trim() === placeholder) {
    return placeholder;
  }
  try {
    return normalizeOrigin(value);
  } catch (error) {
    throw new Error(`${label} ${String(error.message).replace(/^production bot origin /, "")}`);
  }
}

function normalizeNotifyMode(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    throw new Error("alert notify mode is required.");
  }
  if (text === DEFAULT_NOTIFY_MODE) {
    return text;
  }
  if (!NOTIFY_MODES.includes(text)) {
    throw new Error(`alert notify mode must be one of: ${NOTIFY_MODES.join(", ")}.`);
  }
  return text;
}

function normalizeAlertChannel(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("operator alert channel is required.");
  }
  if (text === DEFAULT_ALERT_CHANNEL) {
    return text;
  }
  if (/[\r\n`"';&|<>]/.test(text)) {
    throw new Error("operator alert channel contains unsupported shell characters.");
  }
  return text.slice(0, 160);
}

function normalizePath(value, label) {
  const text = String(value || "").trim();
  if (!text || !text.startsWith("/") || text.startsWith("//")) {
    throw new Error(`${label} must be an absolute API path.`);
  }
  if (/[`"';&|<>]/.test(text)) {
    throw new Error(`${label} contains unsupported shell characters.`);
  }
  return text.replace(/\/+$/, "") || "/";
}

module.exports = {
  DEFAULT_ALERT_CHANNEL,
  DEFAULT_ALERT_STATUS_PATH,
  DEFAULT_BOT_ORIGIN,
  DEFAULT_NOTIFY_MODE,
  DEFAULT_OPERATOR_WORKSPACE,
  DRY_RUN_NOTICE,
  PRODUCTION_NOTIFY_MODES,
  alertDeliveryPhases,
  collectAlertDeliveryPlan,
  formatAlertDeliveryPlanMarkdown,
  normalizeAlertChannel,
  normalizeNotifyMode,
  normalizePath,
  normalizePlanOrigin,
};
