#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  loadReleaseOperationsMap,
  renderReleaseOperationsMapMarkdown,
  summarizeReleaseOperationsMap,
} = require("../src/release-operations-map.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const map = loadReleaseOperationsMap(args.file);
  if (args.quiet) {
    return { map, summary: summarizeReleaseOperationsMap(map) };
  }
  const output = args.json
    ? `${JSON.stringify(args.summary ? summarizeReleaseOperationsMap(map) : map, null, 2)}\n`
    : renderReleaseOperationsMapMarkdown(map, { phase: args.phase });
  process.stdout.write(output);
  return { map, summary: summarizeReleaseOperationsMap(map) };
}

function parseArgs(argv) {
  const result = {
    file: "config/release-operations-map.json",
    json: false,
    phase: "",
    quiet: false,
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
    if (arg === "--summary") {
      result.summary = true;
      continue;
    }
    if (arg === "--quiet") {
      result.quiet = true;
      continue;
    }
    if (arg === "--file" || arg === "--phase") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      if (arg === "--file") {
        result.file = value;
      } else {
        result.phase = value;
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
  return `Render the release operations map.

Usage:
  npm run release:operations
  npm run release:operations -- -- --json
  npm run release:operations -- -- --summary --json
  npm run release:operations -- -- --phase release-candidate

Options:
  --file <path>   Release operations map JSON file.
                 Default: config/release-operations-map.json
  --phase <id>    Render one phase by id.
  --json          Print normalized JSON instead of Markdown.
  --summary       Print only counts when used with --json.
  --quiet         Validate without printing output.
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
