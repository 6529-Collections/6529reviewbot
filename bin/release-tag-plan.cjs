#!/usr/bin/env node

"use strict";

const {
  collectReleaseTagPlan,
  formatReleaseTagPlanMarkdown,
} = require("../src/release-tag-plan.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const plan = collectReleaseTagPlan({
    ...options,
    allowNonMain: args.allowNonMain,
    release: args.release,
    releaseNotesFile: args.releaseNotesFile,
    requireNoWarnings: args.requireNoWarnings,
    requireReleaseNotes: args.requireReleaseNotes,
  });
  const output = args.json
    ? `${JSON.stringify(plan, null, 2)}\n`
    : formatReleaseTagPlanMarkdown(plan);
  if (!args.quiet) {
    process.stdout.write(output);
  }
  if (args.requireReady && !plan.ready && !options.noExitCode) {
    process.exitCode = 1;
  }
  return plan;
}

function parseArgs(argv = []) {
  const result = {
    allowNonMain: false,
    help: false,
    json: false,
    quiet: false,
    release: "",
    releaseNotesFile: "",
    requireNoWarnings: false,
    requireReady: false,
    requireReleaseNotes: false,
  };
  const args = argv.filter((item) => item !== "--");
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--allow-non-main") {
      result.allowNonMain = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--quiet") {
      result.quiet = true;
    } else if (arg === "--require-no-warnings") {
      result.requireNoWarnings = true;
    } else if (arg === "--require-ready") {
      result.requireReady = true;
      result.requireReleaseNotes = true;
      result.requireNoWarnings = true;
    } else if (arg === "--release" || arg === "--version") {
      result.release = requireValue(args, (index += 1), arg);
    } else if (arg === "--release-notes" || arg === "--notes") {
      result.releaseNotesFile = requireValue(args, (index += 1), arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
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
  return `Build a dry-run release tag plan.

Usage:
  npm run release:tag-plan
  npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md>
  npm run release:tag-plan -- -- --release v0.1.0 --release-notes <release-notes.md> --require-ready

Options:
  --release <version>          Release version. Default: v0.1.0.
  --version <version>          Alias for --release.
  --release-notes <path>       Completed release notes Markdown.
  --notes <path>               Alias for --release-notes.
  --require-ready              Exit non-zero unless the plan is ready; also requires release notes and no release-note warnings.
  --require-no-warnings        Treat release-notes warnings as errors in non-final dry runs too.
  --allow-non-main             Permit planning from a non-main branch.
  --json                       Print JSON instead of Markdown.
  --quiet                      Suppress stdout.

This command does not create tags or GitHub Releases.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`release tag plan failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
