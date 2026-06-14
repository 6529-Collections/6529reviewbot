#!/usr/bin/env node

"use strict";

const {
  assertDogfoodPromotionReady,
  collectDogfoodPromotionPacket,
  formatDogfoodPromotionMarkdown,
} = require("../src/dogfood-promotion.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

if (require.main === module) {
  main();
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      printUsage();
      return null;
    }
    const packet = collectDogfoodPromotionPacket(options);
    if (options.requireReady) {
      assertDogfoodPromotionReady(packet);
    }
    if (!options.quiet) {
      if (options.json) {
        console.log(JSON.stringify(packet, null, 2));
      } else {
        process.stdout.write(formatDogfoodPromotionMarkdown(packet));
      }
    }
    return packet;
  } catch (error) {
    console.error(`dogfood promotion failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
    return null;
  }
}

function parseArgs(argv = []) {
  const options = {
    budgetPolicyFile: undefined,
    includePreflight: false,
    json: false,
    mode: "command-only",
    modelCatalogFile: undefined,
    modelPriceFile: undefined,
    allowStaleModelPriceSource: false,
    allowZeroModelPrice: false,
    maxModelPriceSourceAgeDays: undefined,
    operatorWorkspaceDir: undefined,
    preflightProfile: "server",
    quiet: false,
    repositoryConfigFile: undefined,
    requireOperatorWorkspaceReady: false,
    requireReady: false,
    skipSelfDogfoodReplay: false,
    strictPreflight: false,
    targetRepository: "",
  };
  const args = argv.filter((item) => item !== "--");

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--repository-config" || arg === "--config") {
      options.repositoryConfigFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--repository" || arg === "--target-repository") {
      options.targetRepository = requireValue(args, (index += 1), arg);
    } else if (arg === "--mode") {
      options.mode = requireValue(args, (index += 1), arg);
    } else if (arg === "--budget-policy-file") {
      options.budgetPolicyFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--model-catalog-file") {
      options.modelCatalogFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--model-price-file") {
      options.modelPriceFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--allow-stale-model-price-source") {
      options.allowStaleModelPriceSource = true;
    } else if (arg === "--allow-zero-model-price") {
      options.allowZeroModelPrice = true;
    } else if (arg === "--max-model-price-source-age-days") {
      options.maxModelPriceSourceAgeDays = parseNonNegativeNumber(
        requireValue(args, (index += 1), arg),
        arg
      );
    } else if (arg === "--operator-workspace" || arg === "--operator-workspace-dir") {
      options.operatorWorkspaceDir = requireValue(args, (index += 1), arg);
    } else if (arg === "--require-operator-workspace-ready") {
      options.requireOperatorWorkspaceReady = true;
    } else if (arg === "--preflight") {
      options.includePreflight = true;
    } else if (arg === "--preflight-profile") {
      options.preflightProfile = requireValue(args, (index += 1), arg);
    } else if (arg === "--strict-preflight") {
      options.includePreflight = true;
      options.strictPreflight = true;
    } else if (arg === "--skip-self-dogfood-replay") {
      options.skipSelfDogfoodReplay = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--quiet") {
      options.quiet = true;
    } else if (arg === "--require-ready") {
      options.requireReady = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.requireOperatorWorkspaceReady && !options.operatorWorkspaceDir) {
    throw new Error("--require-operator-workspace-ready requires --operator-workspace.");
  }
  if (options.requireReady && !options.strictPreflight) {
    throw new Error("--require-ready requires --strict-preflight.");
  }
  if (options.requireReady && !options.modelPriceFile) {
    throw new Error("--require-ready requires --model-price-file for reviewed model price coverage.");
  }
  return options;
}

function parseNonNegativeNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return number;
}

function requireValue(args, index, name) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage: node bin/dogfood-promotion.cjs [options]

Examples:
  npm run dogfood:promotion
  npm run dogfood:promotion -- -- --repository 6529-Collections/example
  npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready

Options:
  --repository-config <file>  Target repository config to validate.
  --config <file>             Alias for --repository-config.
  --repository <owner/name>   Optional public target repository name.
  --mode <mode>               command-only, limited-initial, or auto.
  --budget-policy-file <file> Dogfood budget policy file.
  --model-catalog-file <file> Model catalog file.
  --model-price-file <file>   Reviewed model price file for readiness coverage.
  --max-model-price-source-age-days <days>
                              Override model-price source freshness window.
  --allow-stale-model-price-source
                              Accept stale model-price source evidence.
  --allow-zero-model-price    Accept documented zero-rate model prices.
  --operator-workspace <dir>  Include a private operator workspace parse check.
  --require-operator-workspace-ready
                              Require every private workspace checklist to be ready.
  --preflight                 Include no-network runtime preflight summary.
  --strict-preflight          Treat preflight warnings as not ready.
  --preflight-profile <name>  Preflight profile, usually server or worker.
  --skip-self-dogfood-replay  Omit the synthetic self-dogfood replay gate.
  --json                      Print JSON instead of Markdown.
  --quiet                     Do not print output.
  --require-ready             Exit non-zero unless the promotion packet is ready;
                              requires --strict-preflight and --model-price-file.

Use npm --silent run when copying output from commands that include private paths.
`);
}

module.exports = {
  main,
  parseArgs,
};
