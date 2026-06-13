#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  DEFAULT_DOGFOOD_CHECKLIST_PATH,
  assertDogfoodReady,
  createDogfoodStatusSkeleton,
  loadDogfoodChecklist,
  loadDogfoodStatus,
  mergeDogfoodStatus,
  renderDogfoodMarkdown,
  renderDogfoodSummaryMarkdown,
  summarizeDogfood,
  writeDogfoodStatusFile,
} = require("../src/dogfood-status.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let checklist = loadDogfoodChecklist(args.file);
  if (args.initStatusFile) {
    const status = writeDogfoodStatusFile(
      args.initStatusFile,
      createDogfoodStatusSkeleton(checklist),
      { force: args.force }
    );
    const summary = summarizeDogfood(mergeDogfoodStatus(checklist, status));
    if (!args.quiet) {
      const output = args.json
        ? `${JSON.stringify(status, null, 2)}\n`
        : `Wrote dogfood status skeleton to ${args.initStatusFile}\n`;
      process.stdout.write(output);
    }
    return { checklist, status, summary };
  }
  if (args.statusFile) {
    checklist = mergeDogfoodStatus(checklist, loadDogfoodStatus(args.statusFile), {
      requireComplete: args.requireReady,
    });
  }
  const summary = summarizeDogfood(checklist);
  if (args.requireReady) {
    assertDogfoodReady(checklist);
  }
  if (args.quiet) {
    return { checklist, summary };
  }
  const output = args.json
    ? `${JSON.stringify(args.summary ? summary : checklist, null, 2)}\n`
    : args.summary
      ? renderDogfoodSummaryMarkdown(checklist)
      : renderDogfoodMarkdown(checklist);
  process.stdout.write(output);
  return { checklist, summary };
}

function parseArgs(argv) {
  const result = {
    file: DEFAULT_DOGFOOD_CHECKLIST_PATH,
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
  return `Render or validate the dogfood execution checklist.

Usage:
  npm run dogfood:status
  npm run dogfood:status -- -- --json
  npm run dogfood:status -- -- --status-file config/dogfood-status.example.json
  npm run dogfood:status -- -- --status-file <operator-status-file> --summary
  npm run dogfood:status -- -- --status-file <operator-status-file> --require-ready
  npm run dogfood:status -- -- --init-status <operator-status-file>

Options:
  --file <path>         Dogfood checklist JSON file.
                       Default: config/dogfood-checklist.json
  --status-file <path>  Optional private dogfood status/evidence JSON file.
  --init-status <path>  Write a pending status skeleton for the current checklist.
  --force               Allow --init-status to overwrite an existing file.
  --json                Print normalized JSON instead of Markdown.
  --summary             Print only the dogfood execution summary.
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
