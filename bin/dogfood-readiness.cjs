#!/usr/bin/env node

"use strict";

const {
  collectDogfoodReadiness,
  formatDogfoodReadinessMarkdown,
} = require("../src/dogfood-readiness.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

if (require.main === module) {
  main();
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      printUsage();
      return;
    }
    const report = collectDogfoodReadiness(options);
    if (!options.quiet) {
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        process.stdout.write(formatDogfoodReadinessMarkdown(report));
      }
    }
    if (options.requireReady && !report.ready) {
      throw new Error("dogfood readiness check is not ready.");
    }
  } catch (error) {
    console.error(`dogfood readiness failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

function parseArgs(argv = []) {
  const options = {
    budgetPolicyFile: undefined,
    includePreflight: false,
    json: false,
    modelCatalogFile: undefined,
    operatorWorkspaceDir: undefined,
    preflightProfile: "server",
    quiet: false,
    requireOperatorWorkspaceReady: false,
    repositoryConfigFiles: [],
    requireReady: false,
    strictPreflight: false,
  };
  const args = argv.filter((item) => item !== "--");

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--repository-config") {
      options.repositoryConfigFiles.push(requireValue(args, (index += 1), arg));
    } else if (arg === "--budget-policy-file") {
      options.budgetPolicyFile = requireValue(args, (index += 1), arg);
    } else if (arg === "--model-catalog-file") {
      options.modelCatalogFile = requireValue(args, (index += 1), arg);
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

  if (!options.repositoryConfigFiles.length) {
    delete options.repositoryConfigFiles;
  }
  if (options.requireOperatorWorkspaceReady && !options.operatorWorkspaceDir) {
    throw new Error("--require-operator-workspace-ready requires --operator-workspace.");
  }
  return options;
}

function requireValue(args, index, name) {
  const value = args[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage: node bin/dogfood-readiness.cjs [options]

Options:
  --repository-config <file>   Repository config file to validate. Repeatable.
  --budget-policy-file <file>  Dogfood budget policy file.
  --model-catalog-file <file>  Model catalog file.
  --operator-workspace <dir>   Include a private operator workspace parse check.
  --require-operator-workspace-ready
                               Require every private workspace checklist to be ready.
  --preflight                  Include no-network runtime preflight summary.
  --strict-preflight           Treat preflight warnings as not ready.
  --preflight-profile <name>   Preflight profile, usually server or worker.
  --json                       Print JSON instead of Markdown.
  --quiet                      Do not print output.
  --require-ready              Exit non-zero unless all included checks are ready.
`);
}

module.exports = {
  main,
  parseArgs,
};
