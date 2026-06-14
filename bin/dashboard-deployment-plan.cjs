#!/usr/bin/env node

"use strict";

const {
  collectDashboardDeploymentPlan,
  formatDashboardDeploymentPlanMarkdown,
} = require("../src/dashboard-deployment-plan.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const plan = collectDashboardDeploymentPlan({
    ...options,
    frontendOrigin: args.frontendOrigin,
    botOrigin: args.botOrigin,
    operatorWorkspace: args.operatorWorkspace,
    authCheckUrl: args.authCheckUrl,
    publicOrg: args.publicOrg,
    publicRoute: args.publicRoute,
    adminRoute: args.adminRoute,
    release: args.release,
    requireInputs: args.requireReady,
  });
  const output = args.json
    ? `${JSON.stringify(plan, null, 2)}\n`
    : formatDashboardDeploymentPlanMarkdown(plan);
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
    adminRoute: "",
    authCheckUrl: "",
    botOrigin: "",
    frontendOrigin: "",
    help: false,
    json: false,
    operatorWorkspace: "",
    publicOrg: "",
    publicRoute: "",
    quiet: false,
    release: "",
    requireReady: false,
  };
  const args = argv.filter((item) => item !== "--");
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--frontend-origin" || arg === "--frontend") {
      result.frontendOrigin = requireValue(args, (index += 1), arg);
    } else if (arg === "--bot-origin" || arg === "--host" || arg === "--origin") {
      result.botOrigin = requireValue(args, (index += 1), arg);
    } else if (arg === "--operator-workspace" || arg === "--workspace") {
      result.operatorWorkspace = requireValue(args, (index += 1), arg);
    } else if (arg === "--auth-check-url") {
      result.authCheckUrl = requireValue(args, (index += 1), arg);
    } else if (arg === "--public-org") {
      result.publicOrg = requireValue(args, (index += 1), arg);
    } else if (arg === "--public-route") {
      result.publicRoute = requireValue(args, (index += 1), arg);
    } else if (arg === "--admin-route") {
      result.adminRoute = requireValue(args, (index += 1), arg);
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
  return `Build a dry-run 6529.io dashboard deployment plan.

Usage:
  npm run dashboard:deployment-plan
  npm run dashboard:deployment-plan -- -- --frontend-origin <6529-io-origin> --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --auth-check-url <6529-auth-check-url> --release v0.1.0
  npm run dashboard:deployment-plan -- -- --frontend-origin <6529-io-origin> --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --auth-check-url <6529-auth-check-url> --require-ready

Options:
  --frontend-origin <origin>      6529.io production origin.
  --frontend <origin>             Alias for --frontend-origin.
  --bot-origin <origin>           Production bot API origin.
  --host <origin>                 Alias for --bot-origin.
  --origin <origin>               Alias for --bot-origin.
  --operator-workspace <path>     Private operator workspace directory.
  --workspace <path>              Alias for --operator-workspace.
  --auth-check-url <url>          6529.io server-side admin auth-check URL.
  --public-org <org>              Public usage org allowlist. Default: 6529-Collections.
  --public-route <path>           6529.io public dashboard route.
  --admin-route <path>            6529.io private admin dashboard route.
  --release <version>             Release version. Default: v0.1.0.
  --version <version>             Alias for --release.
  --require-ready                 Exit non-zero unless all deployment inputs are supplied.
  --json                          Print JSON instead of Markdown.
  --quiet                         Suppress stdout.

This command does not deploy 6529.io, create secrets, call auth endpoints, run checks, or expose dashboards.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`dashboard deployment plan failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
