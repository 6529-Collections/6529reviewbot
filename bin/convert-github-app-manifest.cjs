#!/usr/bin/env node

"use strict";

const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  convertGitHubAppManifest,
  formatManifestConversionSummary,
  githubAppManifestConversionSettingsFromEnv,
} = require("../src/github-app-manifest-conversion.cjs");

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const settings = githubAppManifestConversionSettingsFromEnv(env);
  const token = resolveToken(options, settings, env);
  const summary = await convertGitHubAppManifest({
    allowNoAuth: options.noAuth,
    allowRepoOutput: options.allowRepoOutput,
    apiUrl: options.apiUrl || settings.apiUrl,
    code: options.code,
    cwd: process.cwd(),
    outputPath: options.outputPath || settings.outputPath,
    overwrite: options.overwrite,
    timeoutMs: options.timeoutMs || settings.timeoutMs,
    token,
  });
  process.stdout.write(
    options.json
      ? `${JSON.stringify(summary, null, 2)}\n`
      : formatManifestConversionSummary(summary)
  );
  return summary;
}

function parseArgs(argv) {
  const options = {
    allowRepoOutput: false,
    apiUrl: "",
    code: "",
    json: false,
    noAuth: false,
    outputPath: "",
    overwrite: false,
    timeoutMs: 0,
    tokenEnv: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--allow-repo-output") {
      options.allowRepoOutput = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--no-auth") {
      options.noAuth = true;
      continue;
    }
    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (arg === "--api-url") {
      options.apiUrl = requireValue(argv, index, "--api-url");
      index += 1;
      continue;
    }
    if (arg === "--code") {
      options.code = requireValue(argv, index, "--code");
      index += 1;
      continue;
    }
    if (arg === "--output") {
      options.outputPath = requireValue(argv, index, "--output");
      index += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInt(
        requireValue(argv, index, "--timeout-ms"),
        "--timeout-ms"
      );
      index += 1;
      continue;
    }
    if (arg === "--token-env") {
      options.tokenEnv = requireValue(argv, index, "--token-env");
      index += 1;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(helpText());
      process.exit(0);
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }
  return options;
}

function resolveToken(options, settings, env) {
  if (options.noAuth) {
    return "";
  }
  if (options.tokenEnv) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(options.tokenEnv)) {
      throw new Error("--token-env must be an environment variable name.");
    }
    return env[options.tokenEnv] || "";
  }
  return settings.token || "";
}

function requireValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function helpText() {
  return `Convert a GitHub App manifest code into operator-owned credentials.

Usage:
  npm run github-app:convert -- -- --code <code> --output C:\\private\\6529bot-app.json
  npm run github-app:convert -- -- --code <production-bot-origin>/github-app/manifest-complete?code=<code> --output /private/6529bot-app.json

Options:
  --code <code|url>       Temporary GitHub manifest conversion code or callback URL.
  --output <path>         Private JSON file for the one-time credential response.
  --api-url <url>         GitHub API origin. Defaults to https://api.github.com.
  --token-env <name>      Environment variable containing a GitHub token. Defaults to REVIEWBOT_GITHUB_MANIFEST_TOKEN, GH_TOKEN, then GITHUB_TOKEN.
  --timeout-ms <ms>       GitHub API timeout.
  --json                  Print the redacted summary as JSON.
  --overwrite             Replace an existing private output file.
  --allow-repo-output     Permit output under this repository. Use only for isolated tests.
  --no-auth               Omit Authorization. Use only if the target GitHub API accepts unauthenticated conversion.
`;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(safeErrorLine(error));
    process.exitCode = 1;
  });
}

module.exports = {
  helpText,
  main,
  parseArgs,
  resolveToken,
};
