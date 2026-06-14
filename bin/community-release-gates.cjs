#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const releaseGatesCli = require("./v0-gates.cjs");

const defaultFile = "config/community-release-gates.json";

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(helpText());
    return { help: true };
  }
  return releaseGatesCli.main(["--file", defaultFile, ...argv]);
}

function helpText() {
  return `Render or validate the broad community-release gates.

Usage:
  npm run community:gates
  npm run community:gates -- -- --json
  npm run community:gates -- -- --status-file <operator-status-file> --summary
  npm run community:gates -- -- --status-file <operator-status-file> --require-ready
  npm run community:gates -- -- --init-status <operator-status-file>

Options:
  --file <path>         Release gates JSON file. Default: ${defaultFile}
  --status-file <path>  Optional release gate status/evidence JSON file.
  --init-status <path>  Write a pending status skeleton for the current gates.
  --force               Allow --init-status to overwrite an existing file.
  --json                Print normalized JSON instead of Markdown.
  --summary             Print only the release readiness summary.
  --require-ready       Fail unless every gate is listed and none are pending or blocked.
  --quiet               Validate gates without printing them.
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
  defaultFile,
  helpText,
  main,
};
