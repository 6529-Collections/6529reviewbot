#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  collectAlertDeliveryPlan,
  formatAlertDeliveryPlanMarkdown,
  normalizeAlertChannel,
  normalizeNotifyMode,
  normalizePath,
  normalizePlanOrigin,
} = require("../src/alert-delivery-plan.cjs");
const alertDeliveryPlanCli = require("../bin/alert-delivery-plan.cjs");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/alert-delivery-plan.md",
  "docs/alerting.md",
  "docs/deployment.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
  "docs/release-operations-map.md",
];

function main() {
  const result = checkAlertDeliveryPlanContract();
  console.log(
    `alert delivery plan contract ok (${result.planCases} plan cases, ${result.docs} docs checked)`
  );
}

function checkAlertDeliveryPlanContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkReadyPlan(findings);
  checkMissingInputsPlan(findings);
  checkValidation(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`alert delivery plan contract check found ${findings.length} issue(s).`);
  }

  return {
    planCases: 5,
    docs: targetDocs.length,
  };
}

function checkReadyPlan(findings) {
  const plan = collectAlertDeliveryPlan({
    release: "0.2.0",
    botOrigin: "https://reviewbot.example.com",
    operatorWorkspace: "operator-workspace",
    notifyMode: "sns",
    alertChannel: "operator-sns",
    requireInputs: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  if (!plan.ready) {
    findings.push(`complete alert delivery plan inputs must be ready: ${plan.errors.join("; ")}`);
  }
  if (plan.release !== "v0.2.0") {
    findings.push("alert delivery plan must normalize versions with a v prefix.");
  }
  const markdown = formatAlertDeliveryPlanMarkdown(plan);
  for (const snippet of [
    "Ready to execute: yes",
    "This command does not send alerts",
    "REVIEWBOT_ALERTS_NOTIFY_MODE=sns",
    "REVIEWBOT_ALERTS_SNS_TOPIC_ARN",
    "npm run alerts:operator -- -- --dry-run --force",
    "/api/admin/alerts/status",
    "alert-delivery-plan-reviewed",
    "alerts-deliver",
    "npm run release:tag-plan",
  ]) {
    if (!markdown.includes(snippet)) {
      findings.push(`ready alert delivery plan markdown must include '${snippet}'.`);
    }
  }
}

function checkMissingInputsPlan(findings) {
  const plan = collectAlertDeliveryPlan({
    release: "v0.2.0",
    requireInputs: true,
  });
  if (plan.ready) {
    findings.push("required alert delivery plans must block placeholder inputs.");
  }
  for (const snippet of [
    "production bot origin",
    "private operator workspace",
    "alert notify mode",
    "operator alert channel",
  ]) {
    if (!plan.errors.some((error) => error.includes(snippet))) {
      findings.push(`missing input errors must include '${snippet}'.`);
    }
  }

  const disabledDeliveryPlan = collectAlertDeliveryPlan({
    botOrigin: "https://reviewbot.example.com",
    operatorWorkspace: "operator-workspace",
    notifyMode: "none",
    alertChannel: "operator-channel",
    requireInputs: true,
  });
  if (disabledDeliveryPlan.ready) {
    findings.push("required alert delivery plans must reject non-delivery notify modes.");
  }
}

function checkValidation(findings) {
  try {
    normalizePlanOrigin("http://reviewbot.example.com", "production bot origin", "<production-bot-origin>");
    findings.push("alert delivery plan must reject non-https bot origins.");
  } catch (error) {
    if (!String(error.message).includes("must use https")) {
      findings.push("non-https bot origin rejection should be explicit.");
    }
  }
  try {
    normalizeNotifyMode("pager");
    findings.push("alert delivery plan must reject unsupported notify modes.");
  } catch (error) {
    if (!String(error.message).includes("must be one of")) {
      findings.push("unsupported notify mode rejection should be explicit.");
    }
  }
  try {
    normalizeAlertChannel("ops;curl secret");
    findings.push("alert delivery plan must reject unsafe alert channel labels.");
  } catch (error) {
    if (!String(error.message).includes("unsupported shell characters")) {
      findings.push("unsafe alert channel rejection should be explicit.");
    }
  }
  try {
    normalizePath("api/admin/alerts/status", "alert status API path");
    findings.push("alert delivery plan must reject relative alert-status paths.");
  } catch (error) {
    if (!String(error.message).includes("absolute API path")) {
      findings.push("relative alert-status path rejection should be explicit.");
    }
  }
}

function checkCli(findings) {
  try {
    alertDeliveryPlanCli.parseArgs(["--nope"]);
    findings.push("alert delivery plan CLI must reject unknown arguments.");
  } catch (error) {
    if (!String(error.message).includes("Unknown argument")) {
      findings.push("alert delivery plan CLI unknown-argument error should be explicit.");
    }
  }

  const plan = alertDeliveryPlanCli.main([
    "--bot-origin",
    "https://reviewbot.example.com",
    "--operator-workspace",
    "operator-workspace",
    "--notify-mode",
    "sns",
    "--alert-channel",
    "operator-sns",
    "--release",
    "v0.2.0",
    "--require-ready",
    "--quiet",
  ], {
    noExitCode: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  if (!plan.ready) {
    findings.push("alert delivery plan CLI must return ready for complete required inputs.");
  }
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["alerts:delivery-plan", "check:alert-delivery-plan"],
    "src/alert-delivery-plan.cjs": [
      "collectAlertDeliveryPlan",
      "REVIEWBOT_ALERTS_NOTIFY_MODE",
      "This command does not send alerts",
    ],
    "bin/alert-delivery-plan.cjs": [
      "npm run alerts:delivery-plan",
      "--notify-mode",
      "This command does not send alerts",
    ],
    "scripts/release-check.cjs": ["scripts/check-alert-delivery-plan-contract.cjs"],
    "scripts/smoke-test.cjs": [
      "alertDeliveryPlanContractCheck",
      "alertDeliveryPlanContractCheck.checkAlertDeliveryPlanContract",
    ],
    "config/release-operations-map.json": [
      "alert-delivery-plan-contract",
      "alert-delivery-plan",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run alerts:delivery-plan",
      "npm run check:alert-delivery-plan",
      "[Alert Delivery Plan](docs/alert-delivery-plan.md)",
    ],
    "docs/alert-delivery-plan.md": [
      "npm run alerts:delivery-plan",
      "--notify-mode",
      "does not send alerts",
      "npm run check:alert-delivery-plan",
    ],
    "docs/alerting.md": [
      "npm run alerts:delivery-plan",
      "alert delivery plan",
    ],
    "docs/deployment.md": [
      "npm run alerts:delivery-plan",
      "alert delivery plan",
    ],
    "docs/release-readiness.md": [
      "alert delivery plan",
      "npm run check:alert-delivery-plan",
    ],
    "docs/roadmap.md": [
      "alert delivery plan",
      "production alert routing",
    ],
    "docs/release-operations-map.md": [
      "npm run check:alert-delivery-plan",
      "alerts:delivery-plan",
    ],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function checkSnippets(text, snippets, label, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of snippets) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`${label} must include '${snippet}'.`);
    }
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkAlertDeliveryPlanContract,
};
