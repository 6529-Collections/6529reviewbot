#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const githubWebhook = require("../src/github-webhook.cjs");

const root = path.resolve(__dirname, "..");
const docPath = path.join(root, "docs", "comment-commands.md");
const requiredCommandCases = [
  { command: "/6529bot", reviewKinds: ["general"] },
  { command: "/6529bot review", reviewKinds: ["general"] },
  { command: "/6529bot review all", reviewKinds: githubWebhook.INITIAL_REVIEW_KINDS },
  { command: "/6529bot review general security", reviewKinds: ["general", "security"] },
  { command: "/6529bot review wcag i18n", reviewKinds: ["wcag", "i18n"] },
  { command: "/6529bot general", reviewKinds: ["general"] },
  { command: "/6529bot followup", reviewKinds: ["followup"] },
  { command: "/6529bot wcag", reviewKinds: ["wcag"] },
  { command: "/6529bot i18n", reviewKinds: ["i18n"] },
  { command: "/6529bot security", reviewKinds: ["security"] },
  { command: "/6529bot help", reviewKinds: [] },
  { command: "@6529bot review wcag i18n", reviewKinds: ["wcag", "i18n"] },
];

function main() {
  const result = checkCommentCommands();
  console.log(
    `comment command docs ok (${result.commandCases} documented examples, ${result.reviewKinds} review kinds checked)`
  );
}

function checkCommentCommands(options = {}) {
  const text = options.text || fs.readFileSync(docPath, "utf8");
  const findings = [];
  for (const commandCase of requiredCommandCases) {
    if (!text.includes(commandCase.command)) {
      findings.push(`docs/comment-commands.md must document '${commandCase.command}'.`);
    }
    const parsed = githubWebhook.parseReviewCommand(commandCase.command);
    const actualReviewKinds = parsed?.reviewKinds || null;
    if (!arraysEqual(actualReviewKinds, commandCase.reviewKinds)) {
      findings.push(
        `${commandCase.command} parser contract changed: expected ${JSON.stringify(
          commandCase.reviewKinds
        )}, got ${JSON.stringify(actualReviewKinds)}.`
      );
    }
  }
  for (const reviewKind of githubWebhook.REVIEW_KINDS) {
    if (!new RegExp(`^${reviewKind}\\s+`, "m").test(text)) {
      findings.push(`docs/comment-commands.md must describe review kind '${reviewKind}'.`);
    }
  }
  for (const requiredText of [
    "case-insensitive",
    "Unknown commands are ignored.",
    "`followup` is intentionally not included in `all`",
    "commands.enabled: false",
    "trusted maintainer comments a command",
  ]) {
    if (!text.includes(requiredText)) {
      findings.push(`docs/comment-commands.md must include '${requiredText}'.`);
    }
  }
  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`comment command docs check found ${findings.length} issue(s).`);
  }
  return {
    commandCases: requiredCommandCases.length,
    reviewKinds: githubWebhook.REVIEW_KINDS.length,
  };
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
  arraysEqual,
  checkCommentCommands,
  requiredCommandCases,
};
