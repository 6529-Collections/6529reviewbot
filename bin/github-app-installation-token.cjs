#!/usr/bin/env node

"use strict";

const fs = require("fs");
const {
  createGitHubAppIntegration,
  githubAppAuthSettingsFromEnv,
  githubAppAuthSettingsFromWorkerDispatchEnv,
} = require("../src/github-app-auth.cjs");

const PROFILES = ["main", "worker-dispatch"];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const installationId =
    options.installationId || installationIdFromEnv(options.profile);
  if (!installationId) {
    throw new Error(`Pass --installation-id or set ${installationIdEnvHelp(options.profile)}.`);
  }

  const integration = createGitHubAppIntegration({
    settings: githubAppAuthSettingsForProfile(options.profile),
  });
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
    profile: "main",
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
    } else if (arg === "--profile") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--profile requires a value.");
      }
      if (!PROFILES.includes(value)) {
        throw new Error(`--profile must be one of: ${PROFILES.join(", ")}.`);
      }
      options.profile = value;
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

function githubAppAuthSettingsForProfile(profile = "main", env = process.env) {
  if (profile === "worker-dispatch") {
    return githubAppAuthSettingsFromWorkerDispatchEnv(env);
  }
  if (profile === "main") {
    return githubAppAuthSettingsFromEnv(env);
  }
  throw new Error(`Unsupported GitHub App token profile '${profile}'.`);
}

function installationIdFromEnv(profile = "main", env = process.env) {
  if (profile === "worker-dispatch") {
    return (
      env.REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID ||
      env.REVIEWBOT_WORKER_GITHUB_APP_INSTALLATION_ID ||
      env.REVIEWBOT_GITHUB_INSTALLATION_ID ||
      env.GITHUB_APP_INSTALLATION_ID ||
      ""
    );
  }
  if (profile === "main") {
    return (
      env.REVIEWBOT_GITHUB_INSTALLATION_ID || env.GITHUB_APP_INSTALLATION_ID || ""
    );
  }
  throw new Error(`Unsupported GitHub App token profile '${profile}'.`);
}

function installationIdEnvHelp(profile = "main") {
  if (profile === "worker-dispatch") {
    return "REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID";
  }
  return "REVIEWBOT_GITHUB_INSTALLATION_ID";
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
  console.log(
    [
      "Usage: node bin/github-app-installation-token.cjs [--profile main|worker-dispatch] --installation-id <id> [--github-actions-output]",
      "",
      "Profiles:",
      "  main              Use REVIEWBOT_GITHUB_APP_* credentials.",
      "  worker-dispatch   Use REVIEWBOT_WORKER_GITHUB_APP_* credentials, falling back to main App credentials.",
    ].join("\n")
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : String(error));
    process.exit(1);
  });
}

module.exports = {
  githubAppAuthSettingsForProfile,
  installationIdFromEnv,
  parseArgs,
};
