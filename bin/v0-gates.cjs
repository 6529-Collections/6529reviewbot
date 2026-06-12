#!/usr/bin/env node

"use strict";

const {
  loadReleaseGateStatus,
  loadReleaseGates,
  mergeReleaseGateStatus,
  renderReleaseGatesMarkdown,
} = require("../src/release-gates.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let gates = loadReleaseGates(args.file);
  if (args.statusFile) {
    gates = mergeReleaseGateStatus(gates, loadReleaseGateStatus(args.statusFile));
  }
  if (args.quiet) {
    return gates;
  }
  const output = args.json
    ? `${JSON.stringify(gates, null, 2)}\n`
    : renderReleaseGatesMarkdown(gates);
  process.stdout.write(output);
  return gates;
}

function parseArgs(argv) {
  const result = {
    file: "config/v0-release-gates.json",
    json: false,
    quiet: false,
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

Options:
  --file <path>         Release gates JSON file. Default: config/v0-release-gates.json
  --status-file <path>  Optional release gate status/evidence JSON file.
  --json                Print normalized JSON instead of Markdown.
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
