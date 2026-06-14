#!/usr/bin/env node

"use strict";

const {
  collectProductionDeploymentPlan,
  formatProductionDeploymentPlanMarkdown,
} = require("../src/production-deployment-plan.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const plan = collectProductionDeploymentPlan({
    ...options,
    host: args.host,
    image: args.image,
    operatorWorkspace: args.operatorWorkspace,
    release: args.release,
    requireInputs: args.requireReady,
    workerDispatchInstallationId: args.workerDispatchInstallationId,
  });
  const output = args.json
    ? `${JSON.stringify(plan, null, 2)}\n`
    : formatProductionDeploymentPlanMarkdown(plan);
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
    help: false,
    host: "",
    image: "",
    json: false,
    operatorWorkspace: "",
    quiet: false,
    release: "",
    requireReady: false,
    workerDispatchInstallationId: "",
  };
  const args = argv.filter((item) => item !== "--");
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--host" || arg === "--origin") {
      result.host = requireValue(args, (index += 1), arg);
    } else if (arg === "--image") {
      result.image = requireValue(args, (index += 1), arg);
    } else if (arg === "--operator-workspace" || arg === "--workspace") {
      result.operatorWorkspace = requireValue(args, (index += 1), arg);
    } else if (
      arg === "--worker-dispatch-installation-id" ||
      arg === "--central-installation-id"
    ) {
      result.workerDispatchInstallationId = requireValue(args, (index += 1), arg);
    } else if (arg === "--release" || arg === "--version") {
      result.release = requireValue(args, (index += 1), arg);
    } else if (arg === "--require-ready") {
      result.requireReady = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--quiet") {
      result.quiet = true;
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
  return `Build a dry-run production deployment plan.

Usage:
  npm run production:deployment-plan
  npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --worker-dispatch-installation-id <central-repo-installation-id> --release v0.1.0
  npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --worker-dispatch-installation-id <central-repo-installation-id> --release v0.1.0 --require-ready

Options:
  --host <origin>                 Production bot origin.
  --origin <origin>               Alias for --host.
  --image <ref>                   Container repository without tag or digest.
  --operator-workspace <path>     Private operator workspace directory.
  --workspace <path>              Alias for --operator-workspace.
  --worker-dispatch-installation-id <id>
                                  Central repo installation id for dispatch token smoke.
  --central-installation-id <id>  Alias for --worker-dispatch-installation-id.
  --release <version>             Release version. Default: v0.1.0.
  --version <version>             Alias for --release.
  --require-ready                 Exit non-zero unless host, image, workspace, and dispatch installation id are supplied.
  --json                          Print JSON instead of Markdown.
  --quiet                         Suppress stdout.

This command does not create GitHub Apps, convert manifest codes, deploy services, run checks, or send traffic.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`production deployment plan failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
