"use strict";

const { execFileSync } = require("child_process");
const os = require("os");
const path = require("path");
const { redactSensitiveText } = require("./diagnostics.cjs");
const { runPreflight } = require("./preflight.cjs");
const packageJson = require("../package.json");

const SUPPORT_VALUE_MAX_CHARS = 1000;
const SUPPORT_GIT_MAX_CHARS = 4000;

const SAFE_ENV_KEYS = [
  "NODE_ENV",
  "REVIEW_PROVIDER",
  "REVIEW_MODEL",
  "REVIEW_DEFAULT_ANTHROPIC_MODEL",
  "REVIEW_DEFAULT_OPENAI_MODEL",
  "REVIEW_DEFAULT_OPENROUTER_MODEL",
  "REVIEWBOT_MODEL_CATALOG_PATH",
  "REVIEWBOT_WORKER_ADAPTER",
  "REVIEWBOT_WORKER_GITHUB_WORKFLOW",
  "REVIEWBOT_WORKER_GITHUB_REF",
  "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE",
  "REVIEWBOT_WORKER_GITHUB_API_URL",
  "REVIEWBOT_WORKER_GITHUB_FETCH_TIMEOUT_MS",
  "REVIEWBOT_BUDGET_MODE",
  "REVIEWBOT_PUBLIC_REPO_MODE",
  "REVIEWBOT_DRAFT_PR_MODE",
  "REVIEWBOT_REPOSITORY_CONFIG_SOURCE",
  "REVIEWBOT_RUN_CONTROL_MODE",
  "REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED",
  "REVIEW_USAGE_ENABLED",
  "REVIEWBOT_JOB_LEDGER_ENABLED",
  "REVIEWBOT_USAGE_API_PUBLIC_ENABLED",
  "REVIEWBOT_USAGE_API_ADMIN_ENABLED",
  "REVIEWBOT_ALERTS_ENABLED",
  "REVIEWBOT_ALERTS_NOTIFY_MODE",
  "REVIEWBOT_ADMIN_AUTH_MODE",
];

const PRESENCE_ONLY_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "REVIEWBOT_WORKER_GITHUB_TOKEN",
  "REVIEWBOT_WORKER_GITHUB_REPO",
  "REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID",
  "REVIEWBOT_WORKER_GITHUB_APP_INSTALLATION_ID",
  "REVIEWBOT_WORKER_GITHUB_APP_ID",
  "REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY",
  "REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY_BASE64",
  "GITHUB_WEBHOOK_SECRET",
  "REVIEWBOT_GITHUB_APP_ID",
  "REVIEWBOT_GITHUB_APP_PRIVATE_KEY",
  "REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64",
  "REVIEW_USAGE_AWS_REGION",
  "REVIEW_USAGE_DB_RESOURCE_ARN",
  "REVIEW_USAGE_DB_SECRET_ARN",
  "REVIEW_USAGE_DB_NAME",
  "REVIEW_USAGE_DB_SCHEMA",
  "REVIEWBOT_RUN_CONTROL_LEDGER_DB_RESOURCE_ARN",
  "REVIEWBOT_RUN_CONTROL_LEDGER_DB_SECRET_ARN",
  "REVIEWBOT_ALERTS_WEBHOOK_URL",
  "REVIEWBOT_ALERTS_SNS_TOPIC_ARN",
  "REVIEWBOT_ADMIN_AUTH_HMAC_SECRET",
];

function collectSupportBundle(options = {}) {
  const env = options.env || process.env;
  const now = options.now || new Date();
  return {
    generatedAt: now.toISOString(),
    package: {
      name: packageJson.name,
      version: packageJson.version,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
    },
    git: gitInfo(options),
    environment: environmentSummary(env),
    preflight: preflightSummary(runPreflight({ env, strict: false })),
  };
}

function gitInfo(options = {}) {
  const run = options.execFileSync || execFileSync;
  const info = {
    commit: safeGit(run, ["rev-parse", "--short=12", "HEAD"]),
    branch: safeGit(run, ["branch", "--show-current"]),
  };
  if (options.includeGitStatus) {
    info.status = safeGit(run, ["status", "--short"]);
  }
  return info;
}

function environmentSummary(env = {}) {
  const safe = {};
  for (const key of SAFE_ENV_KEYS) {
    if (env[key] !== undefined && env[key] !== "") {
      safe[key] = safeEnvValue(key, env[key]);
    }
  }
  const presence = {};
  for (const key of PRESENCE_ONLY_ENV_KEYS) {
    presence[key] = env[key] === undefined || env[key] === "" ? "unset" : "set";
  }
  return { safe, presence };
}

function safeEnvValue(key, value) {
  const text = String(value);
  const isAbsolutePath = path.posix.isAbsolute(text) || path.win32.isAbsolute(text);
  if (key.endsWith("_PATH") && isAbsolutePath) {
    return "[absolute-path-set]";
  }
  return supportText(text);
}

function preflightSummary(result) {
  return {
    ok: Boolean(result.ok),
    errors: (result.errors || []).map((item) => ({
      name: item.name,
      message: supportText(item.message),
    })),
    warnings: (result.warnings || []).map((item) => ({
      name: item.name,
      message: supportText(item.message),
    })),
  };
}

function formatSupportBundleMarkdown(bundle) {
  const gitBranch = supportText(bundle.git.branch || "unknown");
  const gitCommit = supportText(bundle.git.commit || "unknown");
  const lines = [
    "# 6529reviewbot Support Bundle",
    "",
    "This bundle is sanitized. It reports secret presence, not secret values.",
    "",
    "## Runtime",
    "",
    `- generatedAt: ${bundle.generatedAt}`,
    `- package: ${bundle.package.name}@${bundle.package.version}`,
    `- node: ${bundle.runtime.node}`,
    `- platform: ${bundle.runtime.platform}/${bundle.runtime.arch}`,
    `- osRelease: ${bundle.runtime.osRelease}`,
    "",
    "## Git",
    "",
    `- branch: ${gitBranch}`,
    `- commit: ${gitCommit}`,
  ];
  if (bundle.git.status !== undefined) {
    lines.push(
      "",
      "```text",
      supportText(bundle.git.status || "clean", SUPPORT_GIT_MAX_CHARS),
      "```"
    );
  }
  lines.push("", "## Environment", "", "Safe values:");
  lines.push(...markdownKeyValues(bundle.environment.safe));
  lines.push("", "Secret or account-linked values:");
  lines.push(...markdownKeyValues(bundle.environment.presence));
  lines.push("", "## Preflight", "", `- ok: ${bundle.preflight.ok}`);
  lines.push("", "Errors:");
  lines.push(...markdownMessages(bundle.preflight.errors));
  lines.push("", "Warnings:");
  lines.push(...markdownMessages(bundle.preflight.warnings));
  return `${lines.join("\n")}\n`;
}

function markdownKeyValues(values) {
  const entries = Object.entries(values || {});
  if (!entries.length) {
    return ["- none"];
  }
  return entries.map(([key, value]) => `- ${key}: ${supportText(value)}`);
}

function markdownMessages(messages) {
  if (!messages || messages.length === 0) {
    return ["- none"];
  }
  return messages.map((item) => `- ${item.name}: ${supportText(item.message)}`);
}

function safeGit(run, args) {
  try {
    const output = String(
      run("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    ).trim();
    return supportText(output, SUPPORT_GIT_MAX_CHARS);
  } catch {
    return "";
  }
}

function supportText(value, maxChars = SUPPORT_VALUE_MAX_CHARS) {
  return redactSensitiveText(value).slice(0, maxChars);
}

module.exports = {
  SAFE_ENV_KEYS,
  PRESENCE_ONLY_ENV_KEYS,
  collectSupportBundle,
  environmentSummary,
  formatSupportBundleMarkdown,
  preflightSummary,
  safeEnvValue,
};
