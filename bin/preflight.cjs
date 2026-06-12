#!/usr/bin/env node

"use strict";

const {
  formatPreflightResult,
  runPreflight,
} = require("../src/preflight.cjs");

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }
  const result = runPreflight(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(formatPreflightResult(result));
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const options = {
    json: false,
    profile: "server",
    strict: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--strict") {
      options.strict = true;
      continue;
    }
    if (arg === "--profile") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--profile requires a value.");
      }
      index += 1;
      options.profile = enumValue(value, ["server", "worker"], "--profile");
      continue;
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }
  return options;
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function printUsage() {
  console.log(`Usage: node bin/preflight.cjs [options]

Validate 6529reviewbot runtime configuration without calling GitHub, AWS,
model providers, or alert endpoints.

Options:
  --profile server|worker  Configuration posture to check. Default: server.
  --strict                 Treat warnings as failures.
  --json                   Print machine-readable JSON.
  -h, --help               Show this help.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs,
};
