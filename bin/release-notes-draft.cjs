#!/usr/bin/env node

"use strict";

const fs = require("fs");
const {
  collectReleaseNotesDraft,
  formatReleaseNotesMarkdown,
} = require("../src/release-notes-draft.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const draft = collectReleaseNotesDraft({
    ...options,
    candidateFile: args.candidateFile,
    includeGitStatus: args.includeGitStatus,
    modelCatalogPath: args.modelCatalogPath,
    release: args.release,
    status: args.status,
    strictPreflight: args.strictPreflight,
  });
  const output = args.json
    ? `${JSON.stringify(draft, null, 2)}\n`
    : formatReleaseNotesMarkdown(draft);
  if (args.out) {
    fs.writeFileSync(args.out, output, "utf8");
  }
  if (!args.quiet) {
    process.stdout.write(output);
  }
  return draft;
}

function parseArgs(argv = []) {
  const result = {
    candidateFile: "",
    help: false,
    includeGitStatus: false,
    json: false,
    modelCatalogPath: "",
    out: "",
    quiet: false,
    release: "",
    status: "",
    strictPreflight: false,
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
    } else if (arg === "--include-git-status") {
      result.includeGitStatus = true;
    } else if (arg === "--strict-preflight") {
      result.strictPreflight = true;
    } else if (arg === "--candidate-file") {
      result.candidateFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--model-catalog") {
      result.modelCatalogPath = requireValue(args, (index += 1), arg);
    } else if (arg === "--out") {
      result.out = requireValue(args, (index += 1), arg);
    } else if (arg === "--release" || arg === "--version") {
      result.release = requireValue(args, (index += 1), arg);
    } else if (arg === "--status") {
      result.status = requireValue(args, (index += 1), arg);
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
  return `Build a public-safe pre-v1 release notes draft.

Usage:
  npm run release:notes
  npm run release:notes -- -- --candidate-file <release-candidate.json>
  npm --silent run release:notes -- -- --candidate-file <release-candidate.json> --out <release-notes.md> --quiet

Options:
  --candidate-file <path>  Read a saved release-candidate JSON bundle.
  --release <version>      Release version. Default: package version with v prefix.
  --version <version>      Alias for --release.
  --status <text>          Release status line.
  --model-catalog <path>   Model catalog path. Default: config/model-catalog.json.
  --strict-preflight       Use strict preflight when generating the default candidate.
  --include-git-status     Include sanitized git status in the default candidate JSON.
  --out <file>             Write Markdown or JSON to a file.
  --json                   Print JSON instead of Markdown.
  --quiet                  Suppress stdout.

Use npm --silent run when command arguments include private operator paths.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`release notes draft failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
