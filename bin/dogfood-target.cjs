#!/usr/bin/env node

"use strict";

const {
  assertDogfoodTargetReady,
  collectDogfoodTargetPacket,
  formatDogfoodTargetMarkdown,
} = require("../src/dogfood-target.cjs");
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
    const packet = collectDogfoodTargetPacket(options);
    if (options.requireReady) {
      assertDogfoodTargetReady(packet);
    }
    if (!options.quiet) {
      if (options.json) {
        console.log(JSON.stringify(packet, null, 2));
      } else {
        process.stdout.write(formatDogfoodTargetMarkdown(packet));
      }
    }
    return packet;
  } catch (error) {
    console.error(`dogfood target failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
    return null;
  }
}

function parseArgs(argv = []) {
  const options = {
    json: false,
    mode: "command-only",
    quiet: false,
    repositoryConfigFile: undefined,
    requireReady: false,
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
  console.log(`Usage: node bin/dogfood-target.cjs [options]

Examples:
  npm run dogfood:target
  npm run dogfood:target -- -- --mode limited-initial
  npm run dogfood:target -- -- --repository 6529-Collections/example --require-ready

Options:
  --repository-config <file>  Target repository config to validate.
  --config <file>             Alias for --repository-config.
  --repository <owner/name>   Optional public target repository name.
  --mode <mode>               command-only, limited-initial, or auto.
  --json                      Print JSON instead of Markdown.
  --quiet                     Do not print output.
  --require-ready             Exit non-zero unless target packet checks pass.

Use npm --silent run when copying output from commands that include private paths.
`);
}

module.exports = {
  main,
  parseArgs,
};
