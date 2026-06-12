#!/usr/bin/env node

"use strict";

const {
  loadReleaseGates,
  renderReleaseGatesMarkdown,
} = require("../src/release-gates.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const gates = loadReleaseGates(args.file);
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
  const result = { file: "config/v0-release-gates.json", json: false, quiet: false };
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
    if (arg === "--file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--file requires a value.");
      }
      result.file = value;
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
  npm run v0:gates -- --json

Options:
  --file <path>  Release gates JSON file. Default: config/v0-release-gates.json
  --json         Print normalized JSON instead of Markdown.
  --quiet        Validate gates without printing them.
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
