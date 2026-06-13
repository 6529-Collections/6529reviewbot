#!/usr/bin/env node

"use strict";

const {
  collectContainerPublishPlan,
  formatContainerPublishPlanMarkdown,
} = require("../src/container-publish-plan.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const plan = collectContainerPublishPlan({
    ...options,
    allowNonMain: args.allowNonMain,
    image: args.image,
    nodeImage: args.nodeImage,
    release: args.release,
    requireImage: args.requireReady,
  });
  const output = args.json
    ? `${JSON.stringify(plan, null, 2)}\n`
    : formatContainerPublishPlanMarkdown(plan);
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
    image: "",
    json: false,
    nodeImage: "",
    quiet: false,
    release: "",
    requireReady: false,
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
    } else if (arg === "--require-ready") {
      result.requireReady = true;
    } else if (arg === "--image") {
      result.image = requireValue(args, (index += 1), arg);
    } else if (arg === "--node-image") {
      result.nodeImage = requireValue(args, (index += 1), arg);
    } else if (arg === "--release" || arg === "--tag" || arg === "--version") {
      result.release = requireValue(args, (index += 1), arg);
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
  return `Build a dry-run container publish plan.

Usage:
  npm run container:publish-plan
  npm run container:publish-plan -- -- --image <operator-registry>/6529reviewbot --release v0.1.0
  npm run container:publish-plan -- -- --image <operator-registry>/6529reviewbot --release v0.1.0 --require-ready

Options:
  --image <ref>          Container repository without tag or digest.
  --release <version>   Release tag. Default: v0.1.0.
  --tag <version>       Alias for --release.
  --version <version>   Alias for --release.
  --node-image <ref>    Runtime base image. Default: node:22-bookworm-slim.
  --require-ready       Exit non-zero unless the plan is ready.
  --allow-non-main      Permit planning from a non-main branch.
  --json                Print JSON instead of Markdown.
  --quiet               Suppress stdout.

This command does not build, push, scan, or publish container images.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`container publish plan failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
