#!/usr/bin/env node

"use strict";

const {
  DEFAULT_GITHUB_APP_MANIFEST_TEMPLATE_PATH,
  loadGitHubAppManifestTemplate,
  renderGitHubAppManifest,
  renderGitHubAppRegistrationForm,
} = require("../src/github-app-manifest.cjs");

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const template = loadGitHubAppManifestTemplate({ path: options.template });
  const manifest = renderGitHubAppManifest({
    template,
    host: options.host,
    name: options.name,
  });
  if (options.quiet) {
    return manifest;
  }
  const output = options.form
    ? renderGitHubAppRegistrationForm({
        manifest,
        owner: options.owner,
        state: options.state,
      })
    : `${JSON.stringify(manifest, null, 2)}\n`;
  process.stdout.write(output);
  return manifest;
}

function parseArgs(argv) {
  const options = {
    form: false,
    host: "",
    name: "",
    owner: "",
    quiet: false,
    state: "",
    template: DEFAULT_GITHUB_APP_MANIFEST_TEMPLATE_PATH,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--form") {
      options.form = true;
      continue;
    }
    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }
    if (arg === "--host") {
      options.host = requireValue(argv, index, "--host");
      index += 1;
      continue;
    }
    if (arg === "--name") {
      options.name = requireValue(argv, index, "--name");
      index += 1;
      continue;
    }
    if (arg === "--owner") {
      options.owner = requireValue(argv, index, "--owner");
      index += 1;
      continue;
    }
    if (arg === "--state") {
      options.state = requireValue(argv, index, "--state");
      index += 1;
      continue;
    }
    if (arg === "--template") {
      options.template = requireValue(argv, index, "--template");
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

function requireValue(argv, index, name) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function helpText() {
  return `Render the reviewed 6529bot GitHub App manifest.

Usage:
  npm run github-app:manifest -- -- --host https://reviewbot.example.com
  npm run github-app:manifest -- -- --host https://reviewbot.example.com --form --owner 6529-Collections

Options:
  --host <url>       Production HTTPS origin for the App server.
  --template <path>  Manifest template path.
  --name <name>      Override the App name in rendered output.
  --form             Print a GitHub registration HTML form instead of JSON.
  --owner <slug>     Organization slug for the registration form action.
  --state <value>    CSRF state for the registration form. Random by default.
  --quiet            Validate and render without printing output.
`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
};
