#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  assertProductionCutoverReady,
  createProductionCutoverStatusSkeleton,
  loadProductionCutoverChecklist,
  loadProductionCutoverStatus,
  mergeProductionCutoverStatus,
  renderProductionCutoverMarkdown,
  renderProductionCutoverSummaryMarkdown,
  summarizeProductionCutover,
  writeProductionCutoverStatusFile,
} = require("../src/production-cutover.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let checklist = loadProductionCutoverChecklist(args.file);
  if (args.initStatusFile) {
    const status = writeProductionCutoverStatusFile(
      args.initStatusFile,
      createProductionCutoverStatusSkeleton(checklist),
      { force: args.force }
    );
    const summary = summarizeProductionCutover(mergeProductionCutoverStatus(checklist, status));
    if (!args.quiet) {
      const output = args.json
        ? `${JSON.stringify(status, null, 2)}\n`
        : `Wrote production cutover status skeleton to ${args.initStatusFile}\n`;
      process.stdout.write(output);
    }
    return { checklist, status, summary };
  }
  if (args.statusFile) {
    checklist = mergeProductionCutoverStatus(checklist, loadProductionCutoverStatus(args.statusFile), {
      requireComplete: args.requireReady,
    });
  }
  const summary = summarizeProductionCutover(checklist);
  if (args.requireReady) {
    assertProductionCutoverReady(checklist);
  }
  if (args.quiet) {
    return { checklist, summary };
  }
  const output = args.json
    ? `${JSON.stringify(args.summary ? summary : checklist, null, 2)}\n`
    : args.summary
      ? renderProductionCutoverSummaryMarkdown(checklist)
      : renderProductionCutoverMarkdown(checklist);
  process.stdout.write(output);
  return { checklist, summary };
}

function parseArgs(argv) {
  const result = {
    file: "config/production-cutover-checklist.json",
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
  return `Render or validate the production cutover checklist.

Usage:
  npm run production:cutover
  npm run production:cutover -- -- --json
  npm run production:cutover -- -- --status-file config/production-cutover-status.example.json
  npm run production:cutover -- -- --status-file <operator-status-file> --summary
  npm run production:cutover -- -- --status-file <operator-status-file> --require-ready
  npm run production:cutover -- -- --init-status <operator-status-file>

Options:
  --file <path>         Production cutover checklist JSON file.
                       Default: config/production-cutover-checklist.json
  --status-file <path>  Optional private cutover status/evidence JSON file.
  --init-status <path>  Write a pending status skeleton for the current checklist.
  --force               Allow --init-status to overwrite an existing file.
  --json                Print normalized JSON instead of Markdown.
  --summary             Print only the cutover readiness summary.
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
