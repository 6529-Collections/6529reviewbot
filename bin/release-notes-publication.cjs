#!/usr/bin/env node

"use strict";

const fs = require("fs");
const {
  formatPublicationReport,
  validateReleaseNotesPublication,
} = require("../src/release-notes-publication.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const markdown = options.markdown ?? fs.readFileSync(args.file, "utf8");
  const report = validateReleaseNotesPublication(markdown, {
    requireNoWarnings: args.requireNoWarnings,
  });
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : formatPublicationReport(report);
  if (!args.quiet) {
    process.stdout.write(output);
  }
  if (!report.ready && !options.noExitCode) {
    process.exitCode = 1;
  }
  return report;
}

function parseArgs(argv = []) {
  const result = {
    file: "",
    help: false,
    json: false,
    quiet: false,
    requireNoWarnings: false,
  };
  const args = argv.filter((item) => item !== "--");
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--quiet") {
      result.quiet = true;
    } else if (arg === "--require-no-warnings") {
      result.requireNoWarnings = true;
    } else if (arg === "--file") {
      result.file = requireValue(args, (index += 1), arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!result.help && !result.file) {
    throw new Error("Pass --file <release-notes.md>.");
  }
  return result;
}

function requireValue(args, index, name) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function helpText() {
  return `Check completed pre-v1 release notes before publication.

Usage:
  npm run release:notes:check -- -- --file <release-notes.md>
  npm run release:notes:check -- -- --file <release-notes.md> --json

Options:
  --file <path>             Completed release notes Markdown to check.
  --require-no-warnings     Treat recommendation warnings as errors.
  --json                    Print JSON instead of Markdown.
  --quiet                   Suppress stdout.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`release notes publication check failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
