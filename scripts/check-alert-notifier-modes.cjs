#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  NOTIFY_MODES,
  alertNotifierSettingsFromEnv,
} = require("../src/alert-notifier.cjs");

const root = path.resolve(__dirname, "..");
const expectedNotifyModes = ["none", "stdout", "webhook", "sns", "ses"];
const notifyModeDocs = [
  "README.md",
  "docs/alerting.md",
  "docs/configuration.md",
];

function main() {
  const result = checkAlertNotifierModes();
  console.log(
    `alert notifier modes ok (${result.modes} modes, ${result.docs} docs checked)`
  );
}

function checkAlertNotifierModes(options = {}) {
  const findings = [];
  const modes = options.modes || NOTIFY_MODES;

  checkModeConstants(modes, findings);
  checkEnvParsing(modes, findings);
  checkDocs(modes, options.docTexts || {}, findings);
  checkEnvExample(modes, options.envExampleText, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`alert notifier mode check found ${findings.length} issue(s).`);
  }

  return {
    modes: modes.length,
    docs: notifyModeDocs.length,
  };
}

function checkModeConstants(modes, findings) {
  if (!arraysEqual(modes, expectedNotifyModes)) {
    findings.push(
      `src/alert-notifier.cjs NOTIFY_MODES must be ${JSON.stringify(
        expectedNotifyModes
      )}, got ${JSON.stringify(modes)}.`
    );
  }
}

function checkEnvParsing(modes, findings) {
  const defaultMode = alertNotifierSettingsFromEnv({}).mode;
  if (defaultMode !== "stdout") {
    findings.push(`alert notifier default mode must be stdout, got ${defaultMode}.`);
  }
  for (const mode of modes) {
    const settings = alertNotifierSettingsFromEnv({
      REVIEWBOT_ALERTS_NOTIFY_MODE: mode,
    });
    if (settings.mode !== mode) {
      findings.push(`REVIEWBOT_ALERTS_NOTIFY_MODE=${mode} must parse to mode '${mode}'.`);
    }
  }
  try {
    alertNotifierSettingsFromEnv({ REVIEWBOT_ALERTS_NOTIFY_MODE: "email" });
    findings.push("alertNotifierSettingsFromEnv must reject unsupported notify mode 'email'.");
  } catch (error) {
    const expected = `REVIEWBOT_ALERTS_NOTIFY_MODE must be one of: ${modes.join(", ")}.`;
    if (error.message !== expected) {
      findings.push(`unsupported notify mode error changed: ${error.message}`);
    }
  }
}

function checkDocs(modes, docTexts, findings) {
  const envLine = `REVIEWBOT_ALERTS_NOTIFY_MODE=${modes.join("|")}`;
  for (const docPath of notifyModeDocs) {
    const text = docTexts[docPath] || readText(docPath);
    if (!text.includes(envLine)) {
      findings.push(`${docPath} must include ${envLine}.`);
    }
  }

  const alertingDoc = docTexts["docs/alerting.md"] || readText("docs/alerting.md");
  for (const mode of modes) {
    if (!alertingDoc.includes(`\`${mode}\``)) {
      findings.push(`docs/alerting.md must describe '${mode}' delivery mode.`);
    }
  }
}

function checkEnvExample(modes, text, findings) {
  const envText = text || readText(".env.example");
  const match = envText.match(/^REVIEWBOT_ALERTS_NOTIFY_MODE=(.*)$/m);
  if (!match) {
    findings.push(".env.example must include REVIEWBOT_ALERTS_NOTIFY_MODE.");
    return;
  }
  const value = match[1].trim();
  if (!modes.includes(value)) {
    findings.push(`.env.example REVIEWBOT_ALERTS_NOTIFY_MODE must be one of ${modes.join(", ")}.`);
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
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
  checkAlertNotifierModes,
  expectedNotifyModes,
};
