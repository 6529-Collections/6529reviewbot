#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  assertOperatorEvidenceReady,
  loadOperatorEvidence,
  publicOperatorEvidenceDocument,
  renderOperatorEvidenceSummaryMarkdown,
  summarizeOperatorEvidence,
} = require("../src/operator-evidence.cjs");

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const evidence = loadOperatorEvidence(args.file);
  const summary = summarizeOperatorEvidence(evidence);
  if (args.requireReady) {
    assertOperatorEvidenceReady(evidence);
  }
  if (args.quiet) {
    return { evidence, summary };
  }
  const publicEvidence = publicOperatorEvidenceDocument(evidence);
  const output = args.json
    ? `${JSON.stringify(args.summary ? summary : publicEvidence, null, 2)}\n`
    : renderOperatorEvidenceSummaryMarkdown(evidence);
  process.stdout.write(output);
  return { evidence, summary };
}

function parseArgs(argv) {
  const result = {
    file: "config/production-evidence.example.json",
    json: false,
    quiet: false,
    requireReady: false,
    summary: false,
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
  return `Validate and render public-safe operator evidence.

Usage:
  npm run operator:evidence
  npm run operator:evidence -- -- --file <private-evidence-file>
  npm run operator:evidence -- -- --file <private-evidence-file> --summary
  npm run operator:evidence -- -- --file <private-evidence-file> --summary --json
  npm run operator:evidence -- -- --file <private-evidence-file> --require-ready

Options:
  --file <path>      Operator evidence JSON file. Default: config/production-evidence.example.json
  --json             Print normalized JSON or summary JSON.
  --summary          Print a redacted public summary.
  --require-ready    Fail unless every section is complete or deferred and none are pending or blocked.
  --quiet            Validate without printing output.
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
