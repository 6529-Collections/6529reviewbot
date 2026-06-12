#!/usr/bin/env node

"use strict";

const fs = require("fs");
const { createGitHubAppIntegration } = require("../src/github-app-auth.cjs");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const installationId =
    options.installationId ||
    process.env.REVIEWBOT_GITHUB_INSTALLATION_ID ||
    process.env.GITHUB_APP_INSTALLATION_ID;
  if (!installationId) {
    throw new Error("Pass --installation-id or set REVIEWBOT_GITHUB_INSTALLATION_ID.");
  }

  const integration = createGitHubAppIntegration();
  const token = await integration.getInstallationToken(installationId);
  if (options.githubActionsOutput) {
    writeGitHubActionsOutput(token);
  } else {
    process.stdout.write(`${token}\n`);
  }
}

function parseArgs(args) {
  const options = {
    githubActionsOutput: false,
    installationId: "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--github-actions-output") {
      options.githubActionsOutput = true;
    } else if (arg === "--installation-id") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--installation-id requires a value.");
      }
      options.installationId = value;
      index += 1;
    } else if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument '${arg}'.`);
    }
  }
  return options;
}

function writeGitHubActionsOutput(token) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    throw new Error("--github-actions-output requires GITHUB_OUTPUT.");
  }
  process.stdout.write(`::add-mask::${token}\n`);
  fs.appendFileSync(outputPath, `token=${token}\n`);
}

function printUsage() {
  console.log("Usage: node bin/github-app-installation-token.cjs --installation-id <id> [--github-actions-output]");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
};
