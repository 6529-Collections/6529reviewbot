#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  collectReleaseCandidateBundle,
  formatReleaseCandidateBundleMarkdown,
} = require("../src/release-candidate.cjs");
const { DEFAULT_OPERATOR_WORKSPACE_FILES } = require("../src/operator-workspace.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = applyOperatorWorkspaceDefaults(parseArgs(argv));
  const bundle = collectReleaseCandidateBundle({
    ...options,
    gateStatusFile: args.gateStatusFile,
    gatesFile: args.gatesFile,
    cutoverChecklistFile: args.cutoverChecklistFile,
    cutoverStatusFile: args.cutoverStatusFile,
    dogfoodChecklistFile: args.dogfoodChecklistFile,
    dogfoodStatusFile: args.dogfoodStatusFile,
    securityReviewChecklistFile: args.securityReviewChecklistFile,
    securityReviewStatusFile: args.securityReviewStatusFile,
    includeGitStatus: args.includeGitStatus,
    operatorEvidenceFile: args.operatorEvidenceFile,
    preflightProfile: args.preflightProfile,
    privatePathRoots: [
      ...(options.privatePathRoots || []),
      ...(args.operatorWorkspaceDir ? [args.operatorWorkspaceDir] : []),
    ],
    requireReady: args.requireReady,
    strictPreflight: args.strictPreflight,
  });
  const output = args.json
    ? `${JSON.stringify(bundle, null, 2)}\n`
    : formatReleaseCandidateBundleMarkdown(bundle);
  if (args.out) {
    fs.writeFileSync(args.out, output, "utf8");
  }
  if (!args.quiet) {
    process.stdout.write(output);
  }
  return bundle;
}

function parseArgs(argv) {
  const result = {
    gateStatusFile: "",
    gatesFile: "config/v0-release-gates.json",
    cutoverChecklistFile: "config/production-cutover-checklist.json",
    cutoverStatusFile: "",
    dogfoodChecklistFile: "config/dogfood-checklist.json",
    dogfoodStatusFile: "",
    securityReviewChecklistFile: "config/security-review-checklist.json",
    securityReviewStatusFile: "",
    includeGitStatus: false,
    json: false,
    operatorWorkspaceDir: "",
    operatorEvidenceFile: "config/production-evidence.example.json",
    out: "",
    preflightProfile: "server",
    quiet: false,
    requireReady: false,
    strictPreflight: false,
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
    if (arg === "--quiet") {
      result.quiet = true;
      continue;
    }
    if (arg === "--include-git-status") {
      result.includeGitStatus = true;
      continue;
    }
    if (arg === "--require-ready") {
      result.requireReady = true;
      continue;
    }
    if (arg === "--strict-preflight") {
      result.strictPreflight = true;
      continue;
    }
    if (arg === "--gate-file" || arg === "--gates-file") {
      result.gatesFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--status-file" || arg === "--gate-status-file") {
      result.gateStatusFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--operator-evidence-file" || arg === "--evidence-file") {
      result.operatorEvidenceFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--operator-workspace" || arg === "--operator-workspace-dir") {
      result.operatorWorkspaceDir = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--cutover-file" || arg === "--cutover-checklist-file") {
      result.cutoverChecklistFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--cutover-status-file") {
      result.cutoverStatusFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--dogfood-file" || arg === "--dogfood-checklist-file") {
      result.dogfoodChecklistFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--dogfood-status-file") {
      result.dogfoodStatusFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--security-review-file" || arg === "--security-review-checklist-file") {
      result.securityReviewChecklistFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--security-review-status-file") {
      result.securityReviewStatusFile = requiredValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--profile") {
      result.preflightProfile = enumValue(requiredValue(argv, index, arg), ["server", "worker"], arg);
      index += 1;
      continue;
    }
    if (arg === "--out") {
      result.out = requiredValue(argv, index, arg);
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

function applyOperatorWorkspaceDefaults(args) {
  if (!args.operatorWorkspaceDir) {
    return args;
  }
  const directory = args.operatorWorkspaceDir;
  return {
    ...args,
    gateStatusFile:
      args.gateStatusFile || path.join(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.releaseGateStatus),
    operatorEvidenceFile:
      args.operatorEvidenceFile === "config/production-evidence.example.json"
        ? path.join(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.operatorEvidence)
        : args.operatorEvidenceFile,
    dogfoodStatusFile:
      args.dogfoodStatusFile || path.join(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.dogfoodStatus),
    securityReviewStatusFile:
      args.securityReviewStatusFile ||
      path.join(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.securityReviewStatus),
    cutoverStatusFile:
      args.cutoverStatusFile || path.join(directory, DEFAULT_OPERATOR_WORKSPACE_FILES.productionCutoverStatus),
  };
}

function requiredValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${arg} requires a value.`);
  }
  return value;
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function helpText() {
  return `Build a public-safe release candidate bundle.

Usage:
  npm run release:candidate
  npm run release:candidate -- -- --json
  npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file>
  npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --dogfood-status-file <operator-dogfood-status-file>
  npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --security-review-status-file <operator-security-status-file>
  npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --cutover-status-file <operator-cutover-status-file>
  npm run release:candidate -- -- --operator-workspace <private-workspace-dir>
  npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --out <public-bundle-file.md> --quiet
  npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready

Options:
  --gate-file <path>              Release gates JSON file. Default: config/v0-release-gates.json
  --status-file <path>            Optional release gate status/evidence JSON file.
  --operator-evidence-file <path> Operator evidence JSON file. Default: config/production-evidence.example.json
  --operator-workspace <path>     Use standard private workspace files from npm run operator:workspace.
  --dogfood-file <path>            Dogfood checklist JSON file. Default: config/dogfood-checklist.json
  --dogfood-status-file <path>     Optional dogfood status/evidence JSON file.
  --security-review-file <path>    Security review checklist JSON file. Default: config/security-review-checklist.json
  --security-review-status-file <path>
                                   Optional security review status/evidence JSON file.
  --cutover-file <path>            Production cutover checklist JSON file. Default: config/production-cutover-checklist.json
  --cutover-status-file <path>     Optional production cutover status/evidence JSON file.
  --profile server|worker         Preflight profile. Default: server.
  --strict-preflight              Treat preflight warnings as failures.
  --require-ready                 Fail unless gates, operator evidence, and preflight are ready.
  --include-git-status            Include sanitized git status --short output in JSON.
  --out <path>                    Write the bundle to a file.
  --json                          Print JSON instead of Markdown.
  --quiet                         Suppress stdout.
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
  applyOperatorWorkspaceDefaults,
  main,
  parseArgs,
};
