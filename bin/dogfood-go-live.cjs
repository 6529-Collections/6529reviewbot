#!/usr/bin/env node

"use strict";

const fs = require("fs");
const {
  assertDogfoodGoLiveReady,
  collectDogfoodGoLivePacket,
  formatDogfoodGoLiveMarkdown,
} = require("../src/dogfood-go-live.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const packet = collectDogfoodGoLivePacket({
    ...options,
    budgetPolicyFile: args.budgetPolicyFile,
    cutoverStatusFile: args.cutoverStatusFile,
    dogfoodStatusFile: args.dogfoodStatusFile,
    gateStatusFile: args.gateStatusFile,
    includeGitStatus: args.includeGitStatus,
    includePreflight: !args.skipPreflight,
    mode: args.mode,
    modelCatalogFile: args.modelCatalogFile,
    modelPriceFile: args.modelPriceFile,
    allowStaleModelPriceSource: args.allowStaleModelPriceSource,
    allowZeroModelPrice: args.allowZeroModelPrice,
    maxModelPriceSourceAgeDays: args.maxModelPriceSourceAgeDays,
    operatorEvidenceFile: args.operatorEvidenceFile,
    operatorWorkspaceDir: args.operatorWorkspaceDir,
    preflightProfile: args.preflightProfile,
    repositoryConfigFile: args.repositoryConfigFile,
    requireOperatorWorkspaceReady: args.requireOperatorWorkspaceReady,
    securityReviewStatusFile: args.securityReviewStatusFile,
    skipSelfDogfoodReplay: args.skipSelfDogfoodReplay,
    strictPreflight: args.strictPreflight,
    targetRepository: args.targetRepository,
  });
  if (args.requireReady) {
    assertDogfoodGoLiveReady(packet);
  }
  const output = args.json
    ? `${JSON.stringify(packet, null, 2)}\n`
    : formatDogfoodGoLiveMarkdown(packet);
  if (args.out) {
    fs.writeFileSync(args.out, output, "utf8");
  }
  if (!args.quiet) {
    process.stdout.write(output);
  }
  return packet;
}

function parseArgs(argv = []) {
  const result = {
    budgetPolicyFile: "",
    cutoverStatusFile: "",
    dogfoodStatusFile: "",
    gateStatusFile: "",
    help: false,
    includeGitStatus: false,
    json: false,
    mode: "command-only",
    modelCatalogFile: "",
    modelPriceFile: "",
    allowStaleModelPriceSource: false,
    allowZeroModelPrice: false,
    maxModelPriceSourceAgeDays: undefined,
    operatorEvidenceFile: "",
    operatorWorkspaceDir: "",
    out: "",
    preflightProfile: "server",
    quiet: false,
    repositoryConfigFile: "",
    requireOperatorWorkspaceReady: false,
    requireReady: false,
    securityReviewStatusFile: "",
    skipPreflight: false,
    skipSelfDogfoodReplay: false,
    strictPreflight: false,
    targetRepository: "",
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
    } else if (arg === "--require-ready") {
      result.requireReady = true;
    } else if (arg === "--require-operator-workspace-ready") {
      result.requireOperatorWorkspaceReady = true;
    } else if (arg === "--strict-preflight") {
      result.strictPreflight = true;
    } else if (arg === "--skip-preflight") {
      result.skipPreflight = true;
    } else if (arg === "--skip-self-dogfood-replay") {
      result.skipSelfDogfoodReplay = true;
    } else if (arg === "--operator-workspace" || arg === "--operator-workspace-dir") {
      result.operatorWorkspaceDir = requireValue(args, (index += 1), arg);
    } else if (arg === "--repository-config" || arg === "--config") {
      result.repositoryConfigFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--repository" || arg === "--target-repository") {
      result.targetRepository = requireValue(args, (index += 1), arg);
    } else if (arg === "--mode") {
      result.mode = enumValue(
        requireValue(args, (index += 1), arg),
        ["command-only", "limited-initial", "auto"],
        arg
      );
    } else if (arg === "--budget-policy-file") {
      result.budgetPolicyFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--model-catalog-file") {
      result.modelCatalogFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--model-price-file") {
      result.modelPriceFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--allow-stale-model-price-source") {
      result.allowStaleModelPriceSource = true;
    } else if (arg === "--allow-zero-model-price") {
      result.allowZeroModelPrice = true;
    } else if (arg === "--max-model-price-source-age-days") {
      result.maxModelPriceSourceAgeDays = parseNonNegativeNumber(
        requireValue(args, (index += 1), arg),
        arg
      );
    } else if (arg === "--status-file" || arg === "--gate-status-file") {
      result.gateStatusFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--operator-evidence-file" || arg === "--evidence-file") {
      result.operatorEvidenceFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--dogfood-status-file") {
      result.dogfoodStatusFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--security-review-status-file") {
      result.securityReviewStatusFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--cutover-status-file") {
      result.cutoverStatusFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--profile" || arg === "--preflight-profile") {
      result.preflightProfile = enumValue(
        requireValue(args, (index += 1), arg),
        ["server", "worker"],
        arg
      );
    } else if (arg === "--out") {
      result.out = requireValue(args, (index += 1), arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (result.requireOperatorWorkspaceReady && !result.operatorWorkspaceDir) {
    throw new Error("--require-operator-workspace-ready requires --operator-workspace.");
  }
  if (result.requireReady && (!result.strictPreflight || result.skipPreflight)) {
    throw new Error("--require-ready requires --strict-preflight and cannot be used with --skip-preflight.");
  }
  if (result.requireReady && !result.modelPriceFile) {
    throw new Error("--require-ready requires --model-price-file for reviewed model price coverage.");
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

function parseNonNegativeNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return number;
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function helpText() {
  return `Build a public-safe dogfood go-live packet.

Usage:
  npm run dogfood:go-live
  npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight
  npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready

Options:
  --operator-workspace <dir>         Read standard private operator workspace files.
  --status-file <file>               Release gate status file.
  --operator-evidence-file <file>    Operator evidence file.
  --dogfood-status-file <file>       Dogfood status file.
  --security-review-status-file <file>
                                     Security-review status file.
  --cutover-status-file <file>       Production cutover status file.
  --repository-config <file>         Target repository config for promotion checks.
  --repository <owner/name>          Optional public target repository name.
  --mode <mode>                      command-only, limited-initial, or auto.
  --budget-policy-file <file>        Dogfood budget policy file.
  --model-catalog-file <file>        Model catalog file.
  --model-price-file <file>          Reviewed model price file for promotion coverage.
  --max-model-price-source-age-days <days>
                                     Override model-price source freshness window.
  --allow-stale-model-price-source   Accept stale model-price source evidence.
  --allow-zero-model-price           Accept documented zero-rate model prices.
  --profile server|worker            Preflight profile. Default: server.
  --strict-preflight                 Treat preflight warnings as not ready.
  --skip-preflight                   Omit promotion preflight from this packet.
  --skip-self-dogfood-replay         Omit synthetic self-dogfood replay.
  --require-operator-workspace-ready Require every workspace overlay to be ready.
  --require-ready                    Exit non-zero unless every go-live gate is ready;
                                     requires --strict-preflight and --model-price-file.
  --include-git-status               Include sanitized git status in JSON.
  --out <file>                       Write Markdown or JSON to a file.
  --json                             Print JSON instead of Markdown.
  --quiet                            Do not print output.

Use npm --silent run when copying output from commands that include private paths.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`dogfood go-live failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
