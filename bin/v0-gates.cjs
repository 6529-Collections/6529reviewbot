#!/usr/bin/env node

"use strict";

const {
  assertReleaseGatesReady,
  loadReleaseGateStatus,
  loadReleaseGates,
  mergeReleaseGateStatus,
  renderReleaseGateSummaryMarkdown,
  renderReleaseGatesMarkdown,
  summarizeReleaseGates,
} = require("../src/release-gates.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let gates = loadReleaseGates(args.file);
  if (args.statusFile) {
    gates = mergeReleaseGateStatus(gates, loadReleaseGateStatus(args.statusFile));
  }
  const summary = summarizeReleaseGates(gates);
  if (args.requireReady) {
    assertReleaseGatesReady(gates);
  }
  if (args.quiet) {
    return { gates, summary };
  }
  const output = args.json
    ? `${JSON.stringify(args.summary ? summary : gates, null, 2)}\n`
    : args.summary
      ? renderReleaseGateSummaryMarkdown(gates)
      : renderReleaseGatesMarkdown(gates);
  process.stdout.write(output);
  return { gates, summary };
}

function parseArgs(argv) {
  const result = {
    file: "config/v0-release-gates.json",
    json: false,
    quiet: false,
    requireReady: false,
    summary: false,
    statusFile: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      result.json = true;
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
    if (arg === "--file" || arg === "--status-file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      if (arg === "--file") {
        result.file = value;
      } else {
        result.statusFile = value;
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
  return `Render or validate the v0 release gates.

Usage:
  npm run v0:gates
  npm run v0:gates -- -- --json
  npm run v0:gates -- -- --status-file config/v0-release-status.example.json
  npm run v0:gates -- -- --status-file <operator-status-file> --summary
  npm run v0:gates -- -- --status-file <operator-status-file> --require-ready

Options:
  --file <path>         Release gates JSON file. Default: config/v0-release-gates.json
  --status-file <path>  Optional release gate status/evidence JSON file.
  --json                Print normalized JSON instead of Markdown.
  --summary             Print only the release readiness summary.
  --require-ready       Fail unless there are zero pending or blocked gates.
  --quiet               Validate gates without printing them.
`;
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
  main,
  parseArgs,
};
