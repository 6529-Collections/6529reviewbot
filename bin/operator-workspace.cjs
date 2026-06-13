#!/usr/bin/env node

"use strict";

const path = require("path");
const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  checkOperatorWorkspace,
  createOperatorWorkspace,
  publicOperatorWorkspaceSummary,
  renderOperatorWorkspaceSummaryMarkdown,
} = require("../src/operator-workspace.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.requireReady && !args.check) {
    throw new Error("--require-ready requires --check.");
  }
  const workspaceOptions = {
    allowRepoDir: args.allowRepoDir,
    commit: args.commit,
    date: args.date,
    directory: args.directory,
    environment: args.environment,
    force: args.force,
    operator: args.operator,
    privateEvidenceLocation: args.privateEvidenceLocation,
    publicSummaryLocation: args.publicSummaryLocation,
    release: args.release,
    requireReady: args.requireReady,
    repoRoot: options.repoRoot || path.resolve(__dirname, ".."),
  };
  const workspace = args.check
    ? checkOperatorWorkspace(workspaceOptions)
    : createOperatorWorkspace(workspaceOptions);
  if (args.quiet) {
    return workspace;
  }
  const output = args.json
    ? `${JSON.stringify(publicOperatorWorkspaceSummary(workspace, { showPaths: args.showPaths }), null, 2)}\n`
    : renderOperatorWorkspaceSummaryMarkdown(workspace, { showPaths: args.showPaths });
  process.stdout.write(output);
  return workspace;
}

function parseArgs(argv) {
  const result = {
    allowRepoDir: false,
    check: false,
    commit: "",
    date: "",
    directory: "",
    environment: "",
    force: false,
    json: false,
    operator: "",
    privateEvidenceLocation: "",
    publicSummaryLocation: "",
    quiet: false,
    release: "",
    requireReady: false,
    showPaths: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--allow-repo-dir") {
      result.allowRepoDir = true;
      continue;
    }
    if (arg === "--check") {
      result.check = true;
      continue;
    }
    if (arg === "--force") {
      result.force = true;
      continue;
    }
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
    if (arg === "--show-paths") {
      result.showPaths = true;
      continue;
    }
    if ([
      "--commit",
      "--date",
      "--dir",
      "--environment",
      "--operator",
      "--private-evidence-location",
      "--public-summary-location",
      "--release",
    ].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      if (arg === "--dir") {
        result.directory = value;
      } else if (arg === "--private-evidence-location") {
        result.privateEvidenceLocation = value;
      } else if (arg === "--public-summary-location") {
        result.publicSummaryLocation = value;
      } else {
        result[arg.slice(2).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())] = value;
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
  return `Create a private release operator workspace skeleton.

Usage:
  npm run operator:workspace -- -- --dir <private-workspace-dir>
  npm run operator:workspace -- -- --dir <private-workspace-dir> --check
  npm run operator:workspace -- -- --dir <private-workspace-dir> --check --require-ready
  npm run operator:workspace -- -- --dir <private-workspace-dir> --json
  npm run operator:workspace -- -- --dir <private-workspace-dir> --force

Options:
  --dir <path>                       Private workspace output directory. Required.
  --release <name>                   Release label for operator evidence.
  --date <YYYY-MM-DD>                Evidence date placeholder.
  --operator <name>                  Operator placeholder.
  --commit <sha-or-tag>              Commit/tag placeholder.
  --environment <name>               Environment placeholder.
  --private-evidence-location <text> Private evidence location placeholder.
  --public-summary-location <text>   Public summary location placeholder.
  --force                            Overwrite existing skeleton files.
  --check                            Validate and summarize an existing workspace.
  --require-ready                    With --check, fail unless every overlay is ready.
  --json                             Print public-safe JSON summary.
  --show-paths                       Include the absolute workspace path in output.
  --allow-repo-dir                   Allow writing inside the public repository.
  --quiet                            Create files without printing output.

By default this command refuses to write inside the public repository.
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
