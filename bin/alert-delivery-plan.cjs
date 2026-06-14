#!/usr/bin/env node

"use strict";

const {
  collectAlertDeliveryPlan,
  formatAlertDeliveryPlanMarkdown,
} = require("../src/alert-delivery-plan.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function main(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(helpText());
    return null;
  }
  const plan = collectAlertDeliveryPlan({
    ...options,
    botOrigin: args.botOrigin,
    operatorWorkspace: args.operatorWorkspace,
    notifyMode: args.notifyMode,
    alertChannel: args.alertChannel,
    alertStatusPath: args.alertStatusPath,
    release: args.release,
    requireInputs: args.requireReady,
  });
  const output = args.json
    ? `${JSON.stringify(plan, null, 2)}\n`
    : formatAlertDeliveryPlanMarkdown(plan);
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
    alertChannel: "",
    alertStatusPath: "",
    botOrigin: "",
    help: false,
    json: false,
    notifyMode: "",
    operatorWorkspace: "",
    quiet: false,
    release: "",
    requireReady: false,
  };
  const args = argv.filter((item) => item !== "--");
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-h" || arg === "--help") {
      result.help = true;
    } else if (arg === "--bot-origin" || arg === "--host" || arg === "--origin") {
      result.botOrigin = requireValue(args, (index += 1), arg);
    } else if (arg === "--operator-workspace" || arg === "--workspace") {
      result.operatorWorkspace = requireValue(args, (index += 1), arg);
    } else if (arg === "--notify-mode") {
      result.notifyMode = requireValue(args, (index += 1), arg);
    } else if (arg === "--alert-channel" || arg === "--channel") {
      result.alertChannel = requireValue(args, (index += 1), arg);
    } else if (arg === "--alert-status-path") {
      result.alertStatusPath = requireValue(args, (index += 1), arg);
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
  return `Build a dry-run production alert delivery plan.

Usage:
  npm run alerts:delivery-plan
  npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --release v0.1.0
  npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --require-ready

Options:
  --bot-origin <origin>           Production bot API origin.
  --host <origin>                 Alias for --bot-origin.
  --origin <origin>               Alias for --bot-origin.
  --operator-workspace <path>     Private operator workspace directory.
  --workspace <path>              Alias for --operator-workspace.
  --notify-mode <mode>            Alert delivery mode: webhook, sns, or ses for production.
  --alert-channel <label>         Public-safe operator-owned channel label.
  --channel <label>               Alias for --alert-channel.
  --alert-status-path <path>      Admin alert-status API path.
  --release <version>             Release version. Default: v0.1.0.
  --version <version>             Alias for --release.
  --require-ready                 Exit non-zero unless production delivery inputs are supplied.
  --json                          Print JSON instead of Markdown.
  --quiet                         Suppress stdout.

This command does not send alerts, create topics, verify SES identities, call webhooks, call AWS, or read live ledgers.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`alert delivery plan failed: ${safeErrorLine(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
