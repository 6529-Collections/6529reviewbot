#!/usr/bin/env node

"use strict";

const {
  collectSupportBundle,
  formatSupportBundleMarkdown,
} = require("../src/support-bundle.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  const bundle = collectSupportBundle({
    ...options,
    includeGitStatus: args.includeGitStatus,
  });
  if (args.quiet) {
    return bundle;
  }
  const output = args.json
    ? `${JSON.stringify(bundle, null, 2)}\n`
    : formatSupportBundleMarkdown(bundle);
  process.stdout.write(output);
  return bundle;
}

function parseArgs(argv) {
  const result = { includeGitStatus: false, json: false, quiet: false };
  for (const arg of argv) {
    if (arg === "--json") {
      result.json = true;
      continue;
    }
    if (arg === "--include-git-status") {
      result.includeGitStatus = true;
      continue;
    }
    if (arg === "--quiet") {
      result.quiet = true;
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
  return `Generate a sanitized 6529reviewbot support bundle.

Usage:
  npm run support:bundle
  npm run support:bundle -- --json
  npm run support:bundle -- --include-git-status

Options:
  --json                Print JSON instead of Markdown.
  --include-git-status  Include git status --short output.
  --quiet               Validate bundle generation without printing it.
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
