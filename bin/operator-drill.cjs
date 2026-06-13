#!/usr/bin/env node

"use strict";

const fs = require("fs");
const {
  formatOperatorDrillMarkdown,
  runOperatorDrill,
} = require("../src/operator-drill.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const report = runOperatorDrill({
    ...options,
    allowRepoDir: args.allowRepoDir,
    commit: args.commit,
    date: args.date,
    directory: args.directory,
    environment: args.environment,
    force: args.force,
    includeGitStatus: args.includeGitStatus,
    operator: args.operator,
    privateEvidenceLocation: args.privateEvidenceLocation,
    publicSummaryLocation: args.publicSummaryLocation,
    release: args.release,
    skipSelfDogfoodReplay: args.skipSelfDogfoodReplay,
  });
  const output = args.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : formatOperatorDrillMarkdown(report);
  if (args.out) {
    fs.writeFileSync(args.out, output, "utf8");
  }
  if (!args.quiet) {
    process.stdout.write(output);
  }
  return report;
}

function parseArgs(argv = []) {
  const result = {
    allowRepoDir: false,
    commit: "",
    date: "",
    directory: "",
    environment: "",
    force: false,
    help: false,
    includeGitStatus: false,
    json: false,
    operator: "",
    out: "",
    privateEvidenceLocation: "",
    publicSummaryLocation: "",
    quiet: false,
    release: "",
    skipSelfDogfoodReplay: false,
  };
  const args = argv.filter((item) => item !== "--");

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--allow-repo-dir") {
      result.allowRepoDir = true;
    } else if (arg === "--force") {
      result.force = true;
    } else if (arg === "--include-git-status") {
      result.includeGitStatus = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--quiet") {
      result.quiet = true;
    } else if (arg === "--skip-self-dogfood-replay") {
      result.skipSelfDogfoodReplay = true;
    } else if (arg === "--dir") {
      result.directory = requireValue(args, (index += 1), arg);
    } else if (arg === "--out") {
      result.out = requireValue(args, (index += 1), arg);
    } else if ([
      "--commit",
      "--date",
      "--environment",
      "--operator",
      "--private-evidence-location",
      "--public-summary-location",
      "--release",
    ].includes(arg)) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      result[key] = requireValue(args, (index += 1), arg);
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
  return `Run a public-safe release and dogfood operator drill.

Usage:
  npm run operator:drill
  npm --silent run operator:drill -- -- --dir <private-workspace-dir>
  npm --silent run operator:drill -- -- --dir <private-workspace-dir> --out <public-drill.md> --quiet

Options:
  --dir <path>                       Use a private operator workspace directory.
                                     Without --dir, a temporary workspace is created and removed.
  --release <name>                   Release label for generated workspace skeletons.
  --date <YYYY-MM-DD>                Evidence date placeholder.
  --operator <name>                  Operator placeholder.
  --commit <sha-or-tag>              Commit/tag placeholder.
  --environment <name>               Environment placeholder.
  --private-evidence-location <text> Private evidence location placeholder.
  --public-summary-location <text>   Public summary location placeholder.
  --force                            Overwrite generated workspace files when --dir is set.
  --allow-repo-dir                   Allow writing the workspace inside the public repo.
  --skip-self-dogfood-replay         Skip the synthetic self-dogfood replay during the drill.
  --include-git-status               Include sanitized git status in release-candidate JSON.
  --out <file>                       Write Markdown or JSON to a file.
  --json                             Print JSON instead of Markdown.
  --quiet                            Suppress stdout.

Use npm --silent run when copying output from commands that include private paths.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`operator drill failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
