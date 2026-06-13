#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  DEFAULT_SECURITY_REVIEW_CHECKLIST_PATH,
  assertSecurityReviewReady,
  createSecurityReviewStatusSkeleton,
  loadSecurityReviewChecklist,
  loadSecurityReviewStatus,
  mergeSecurityReviewStatus,
  renderSecurityReviewMarkdown,
  renderSecurityReviewSummaryMarkdown,
  summarizeSecurityReview,
  writeSecurityReviewStatusFile,
} = require("../src/security-review-status.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let checklist = loadSecurityReviewChecklist(args.file);
  if (args.initStatusFile) {
    const status = writeSecurityReviewStatusFile(
      args.initStatusFile,
      createSecurityReviewStatusSkeleton(checklist),
      { force: args.force }
    );
    const summary = summarizeSecurityReview(mergeSecurityReviewStatus(checklist, status));
    if (!args.quiet) {
      const output = args.json
        ? `${JSON.stringify(status, null, 2)}\n`
        : `Wrote security review status skeleton to ${args.initStatusFile}\n`;
      process.stdout.write(output);
    }
    return { checklist, status, summary };
  }
  if (args.statusFile) {
    checklist = mergeSecurityReviewStatus(checklist, loadSecurityReviewStatus(args.statusFile), {
      requireComplete: args.requireReady,
    });
  }
  const summary = summarizeSecurityReview(checklist);
  if (args.requireReady) {
    assertSecurityReviewReady(checklist);
  }
  if (args.quiet) {
    return { checklist, summary };
  }
  const output = args.json
    ? `${JSON.stringify(args.summary ? summary : checklist, null, 2)}\n`
    : args.summary
      ? renderSecurityReviewSummaryMarkdown(checklist)
      : renderSecurityReviewMarkdown(checklist);
  process.stdout.write(output);
  return { checklist, summary };
}

function parseArgs(argv) {
  const result = {
    file: DEFAULT_SECURITY_REVIEW_CHECKLIST_PATH,
    force: false,
    initStatusFile: "",
    json: false,
    quiet: false,
    requireReady: false,
    statusFile: "",
    summary: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (arg === "--force") {
      result.force = true;
      continue;
    }
    if (arg === "--quiet") {
      result.quiet = true;
      continue;
    }
    if (arg === "--require-ready") {
      result.requireReady = true;
      continue;
    }
    if (arg === "--summary") {
      result.summary = true;
      continue;
    }
    if (arg === "--file" || arg === "--status-file" || arg === "--init-status") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      if (arg === "--file") {
        result.file = value;
      } else if (arg === "--status-file") {
        result.statusFile = value;
      } else {
        result.initStatusFile = value;
      }
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(helpText());
      process.exit(0);
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }
  return result;
}

function helpText() {
  return `Render or validate the security review checklist.

Usage:
  npm run security:review
  npm run security:review -- -- --json
  npm run security:review -- -- --status-file config/security-review-status.example.json
  npm run security:review -- -- --status-file <operator-security-status-file> --summary
  npm run security:review -- -- --status-file <operator-security-status-file> --require-ready
  npm run security:review -- -- --init-status <operator-security-status-file>

Options:
  --file <path>         Security review checklist JSON file.
                       Default: config/security-review-checklist.json
  --status-file <path>  Optional private security-review status/evidence JSON file.
  --init-status <path>  Write a pending status skeleton for the current checklist.
  --force               Allow --init-status to overwrite an existing file.
  --json                Print normalized JSON instead of Markdown.
  --summary             Print only the security review summary.
  --require-ready       Fail unless every item is listed and none are pending or blocked.
  --quiet               Validate without printing output.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(safeErrorLine(error));
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
