"use strict";

const { redactSensitiveText } = require("./diagnostics.cjs");

const REQUIRED_HEADINGS = [
  "# 6529reviewbot ",
  "## Who Should Use This",
  "## Highlights",
  "## Tested Configuration",
  "## Safety Requirements",
  "## Known Gaps",
  "## Deferrals And Accepted Risks",
  "## Upgrade Notes",
  "## Rollback",
  "## Validation",
];
const TESTED_CONFIGURATION_FIELDS = [
  "Worker path:",
  "GitHub Actions dispatch mode:",
  "GitHub Actions dispatch token source:",
  "App server runtime:",
  "Container image contract check:",
  "Container image digest, if used:",
  "GitHub App permissions/events:",
  "Providers/models:",
  "Default Anthropic model:",
  "Repository config template:",
  "Budget mode and caps:",
  "Run-control mode and caps:",
  "Ledger schema status:",
  "Model pricing status:",
  "Model price source freshness policy:",
  "Alert delivery:",
  "Empty provider output fail-closed evidence:",
  "Worker diagnostic redaction evidence:",
  "6529.io dashboard/admin status:",
  "Release candidate bundle:",
  "Dogfood promotion packet:",
  "Dogfood go-live packet:",
  "Production cutover status:",
  "Preflight result:",
  "v0 gate checklist:",
  "v0 gate status file/evidence:",
  "v0 gate summary:",
];
const KNOWN_GAP_FIELDS = [
  "Production GitHub App deployment:",
  "6529.io public dashboard:",
  "6529.io private admin UI:",
  "Dogfood repositories:",
  "Provider pricing/model update process:",
  "Accepted model-price overrides:",
  "Incident response readiness:",
  "Compatibility guarantees:",
];
const DEFERRAL_FIELDS = [
  "Gate:",
  "Risk accepted:",
  "Follow-up owner:",
  "Follow-up trigger/date:",
  "Public-safe evidence:",
];
const VALIDATION_FIELDS = [
  "`npm run release:check`:",
  "`npm run check:container-image`:",
  "`npm run v0:gates`:",
  "`npm run preflight -- -- --strict`:",
  "`npm run release:candidate",
  "`npm --silent run dogfood:promotion",
  "`npm --silent run dogfood:go-live",
  "`npm run production:cutover",
  "CI:",
  "Dependency Review:",
  "OpenSSF Scorecard:",
  "Manual security checklist:",
];
const PLACEHOLDER_PATTERN = /\b(?:TODO(?:\(operator\))?|TBD|fill me|pending evidence)\b/i;
const AWS_ARN_PATTERN = /\barn:aws:[^\s)`]+/i;
const AWS_ACCOUNT_ID_PATTERN = /\b\d{12}\b/;
const LOCAL_PATH_PATTERN = /\b[A-Za-z]:\\[^\s`]+/;

function validateReleaseNotesPublication(markdown, options = {}) {
  const text = String(markdown || "");
  const errors = [];
  const warnings = [];

  checkRequiredHeadings(text, errors);
  checkTitle(text, errors);
  checkStatus(text, errors);
  checkNoPlaceholders(text, errors);
  checkPublicSafeText(text, errors);
  checkSectionFields(text, "## Tested Configuration", "## Safety Requirements", TESTED_CONFIGURATION_FIELDS, errors);
  checkSectionFields(text, "## Known Gaps", "## Deferrals And Accepted Risks", KNOWN_GAP_FIELDS, errors);
  checkDeferrals(text, errors);
  checkSectionFields(text, "## Validation", "", VALIDATION_FIELDS, errors);
  checkRecommendedText(text, warnings);

  if (options.requireNoWarnings && warnings.length) {
    errors.push(...warnings.map((warning) => `warning promoted to error: ${warning}`));
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    counts: {
      headings: REQUIRED_HEADINGS.length,
      testedConfigurationFields: TESTED_CONFIGURATION_FIELDS.length,
      knownGapFields: KNOWN_GAP_FIELDS.length,
      validationFields: VALIDATION_FIELDS.length,
    },
  };
}

function formatPublicationReport(report) {
  const lines = [
    `Release notes publication ready: ${report.ready ? "yes" : "no"}`,
    `Required headings: ${report.counts.headings}`,
    `Tested configuration fields: ${report.counts.testedConfigurationFields}`,
    `Known-gap fields: ${report.counts.knownGapFields}`,
    `Validation fields: ${report.counts.validationFields}`,
  ];
  if (report.errors.length) {
    lines.push("", "Errors:");
    for (const error of report.errors) {
      lines.push(`- ${error}`);
    }
  }
  if (report.warnings.length) {
    lines.push("", "Warnings:");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function checkRequiredHeadings(text, errors) {
  for (const heading of REQUIRED_HEADINGS) {
    if (!text.includes(heading)) {
      errors.push(`release notes must include '${heading}'.`);
    }
  }
}

function checkTitle(text, errors) {
  if (!/^# 6529reviewbot v[0-9][0-9A-Za-z._-]*\s*$/m.test(text)) {
    errors.push("release notes title must look like '# 6529reviewbot v0.1.0'.");
  }
}

function checkStatus(text, errors) {
  const match = text.match(/^Status:\s*(.+)$/m);
  if (!match || !filledValue(match[1])) {
    errors.push("release notes must include a filled Status line.");
  }
}

function checkNoPlaceholders(text, errors) {
  if (/TODO\(operator\)/i.test(text)) {
    errors.push("release notes must not contain TODO(operator) markers.");
  }
  if (PLACEHOLDER_PATTERN.test(text)) {
    errors.push("release notes must not contain placeholder text.");
  }
}

function checkPublicSafeText(text, errors) {
  if (redactSensitiveText(text) !== text) {
    errors.push("release notes contain token-shaped or key-shaped sensitive text.");
  }
  if (AWS_ARN_PATTERN.test(text)) {
    errors.push("release notes must not include raw AWS ARNs.");
  }
  if (AWS_ACCOUNT_ID_PATTERN.test(text)) {
    errors.push("release notes must not include raw 12-digit AWS account ids.");
  }
  if (LOCAL_PATH_PATTERN.test(text)) {
    errors.push("release notes must not include local absolute filesystem paths.");
  }
}

function checkSectionFields(text, startHeading, endHeading, labels, errors) {
  const section = sectionText(text, startHeading, endHeading);
  if (!section) {
    errors.push(`release notes must include section '${startHeading}'.`);
    return;
  }
  for (const label of labels) {
    const value = fieldValue(section, label);
    if (!filledValue(value)) {
      errors.push(`${startHeading} field '${label}' must be filled before publication.`);
    }
  }
}

function checkDeferrals(text, errors) {
  const section = sectionText(text, "## Deferrals And Accepted Risks", "## Upgrade Notes");
  if (!section) {
    errors.push("release notes must include deferrals and accepted risks.");
    return;
  }
  if (/\bNo accepted deferrals\b/i.test(section)) {
    return;
  }
  for (const label of DEFERRAL_FIELDS) {
    const value = fieldValue(section, label);
    if (!filledValue(value)) {
      errors.push(`deferral field '${label}' must be filled, or state 'No accepted deferrals'.`);
    }
  }
}

function checkRecommendedText(text, warnings) {
  for (const snippet of [
    "trusted-actor admission",
    "budget mode is `enforce`",
    "provider keys and AWS credentials live only in bot-owned infrastructure",
    "Pin target repositories to an exact tag or commit SHA",
    "Set `REVIEWBOT_ENABLED=false`",
  ]) {
    if (!normalizeWhitespace(text).includes(normalizeWhitespace(snippet))) {
      warnings.push(`release notes should mention '${snippet}'.`);
    }
  }
}

function sectionText(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  if (start < 0) {
    return "";
  }
  const fromStart = text.slice(start + startHeading.length);
  if (!endHeading) {
    return fromStart;
  }
  const end = fromStart.indexOf(endHeading);
  return end < 0 ? fromStart : fromStart.slice(0, end);
}

function fieldValue(section, label) {
  const match = section.match(new RegExp(`^\\s*-?\\s*${escapeRegExp(label)}\\s*(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function filledValue(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !PLACEHOLDER_PATTERN.test(text) && !/^[-_:]+$/.test(text);
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  DEFERRAL_FIELDS,
  KNOWN_GAP_FIELDS,
  REQUIRED_HEADINGS,
  TESTED_CONFIGURATION_FIELDS,
  VALIDATION_FIELDS,
  formatPublicationReport,
  validateReleaseNotesPublication,
};
