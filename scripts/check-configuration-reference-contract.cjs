#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/configuration.md",
  "docs/deployment.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

const requiredSections = [
  "## Required Runtime Environment",
  "## GitHub App Webhook",
  "## GitHub App Installation Auth",
  "## Admission Policy",
  "## Budget Admission",
  "## Providers",
  "## Review Job Lanes",
  "## Runtime Control",
  "## Run Control",
  "## Repository Configuration",
  "## Job Ledger",
  "## Worker Adapters",
  "## Webhook Replay Diagnostics",
  "## Production Preflight",
  "## Usage API",
  "## Admin Auth Bridge",
  "## Alerting And Scheduled Operator Checks",
  "## Cost And Context Controls",
  "## OpenAI Options",
  "## Trusted Metadata Authors",
  "## Usage Ledger",
];

const documentedEnvKeys = [
  "GH_TOKEN",
  "GH_REPO",
  "PR_NUMBER",
  "REVIEW_PROVIDER",
  "GITHUB_WEBHOOK_SECRET",
  "REVIEWBOT_GITHUB_WEBHOOK_SECRET",
  "REVIEWBOT_WEBHOOK_PATH",
  "REVIEWBOT_WEBHOOK_MAX_BODY_BYTES",
  "REVIEWBOT_GITHUB_APP_ID",
  "REVIEWBOT_GITHUB_APP_PRIVATE_KEY",
  "REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64",
  "REVIEWBOT_GITHUB_APP_API_URL",
  "REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS",
  "REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS",
  "REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS",
  "REVIEWBOT_PUBLIC_REPO_MODE",
  "REVIEWBOT_PRIVATE_REPO_MODE",
  "REVIEWBOT_DRAFT_PR_MODE",
  "REVIEWBOT_ALLOWED_PR_AUTHORS",
  "REVIEWBOT_TRUSTED_PERMISSION",
  "REVIEWBOT_BUDGET_MODE",
  "REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD",
  "REVIEWBOT_BUDGET_GLOBAL_DAILY_USD",
  "REVIEWBOT_BUDGET_GLOBAL_WEEKLY_USD",
  "REVIEWBOT_BUDGET_GLOBAL_MONTHLY_USD",
  "REVIEWBOT_BUDGET_ORG_DAILY_USD",
  "REVIEWBOT_BUDGET_REPO_DAILY_USD",
  "REVIEWBOT_BUDGET_REQUESTOR_DAILY_USD",
  "REVIEWBOT_BUDGET_PR_DAILY_USD",
  "REVIEWBOT_BUDGET_PROVIDER_DAILY_USD",
  "REVIEWBOT_BUDGET_MODEL_DAILY_USD",
  "REVIEWBOT_BUDGET_REVIEW_KIND_DAILY_USD",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "REVIEWBOT_MODEL_CATALOG_PATH",
  "REVIEW_DEFAULT_ANTHROPIC_MODEL",
  "REVIEW_DEFAULT_OPENAI_MODEL",
  "REVIEW_DEFAULT_OPENROUTER_MODEL",
  "REVIEWBOT_MODEL_PRICE_FILE",
  "REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS",
  "REVIEWBOT_REVIEW_LANES",
  "REVIEWBOT_MAX_JOBS_PER_DELIVERY",
  "REVIEWBOT_ENABLED",
  "REVIEWBOT_DISABLED_REASON",
  "REVIEWBOT_DISABLED_ORGS",
  "REVIEWBOT_DISABLED_REPOS",
  "REVIEWBOT_DISABLED_PROVIDERS",
  "REVIEWBOT_DISABLED_MODELS",
  "REVIEWBOT_DISABLED_REVIEW_KINDS",
  "REVIEWBOT_RUN_CONTROL_MODE",
  "REVIEWBOT_RUN_CONTROL_DEDUPE_ENABLED",
  "REVIEWBOT_RUN_CONTROL_DEDUPE_TTL_SECONDS",
  "REVIEWBOT_RUN_CONTROL_GLOBAL_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_ORG_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_MODEL_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_REVIEW_KIND_MAX_CONCURRENT",
  "REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED",
  "REVIEWBOT_RUN_CONTROL_LEDGER_CLAIM_TTL_SECONDS",
  "REVIEWBOT_REPOSITORY_CONFIG_SOURCE",
  "REVIEWBOT_REPOSITORY_CONFIG_PATHS",
  "REVIEWBOT_REPOSITORY_CONFIG_REQUIRED",
  "REVIEWBOT_REPOSITORY_CONFIG_MAX_BYTES",
  "REVIEWBOT_GITHUB_TOKEN",
  "GITHUB_TOKEN",
  "REVIEWBOT_JOB_LEDGER_ENABLED",
  "REVIEWBOT_JOB_LEDGER_FAIL_CLOSED",
  "REVIEWBOT_WORKER_ADAPTER",
  "REVIEWBOT_WORKER_LOCAL_TIMEOUT_MS",
  "REVIEWBOT_WORKER_GITHUB_REPO",
  "REVIEWBOT_WORKER_GITHUB_WORKFLOW",
  "REVIEWBOT_WORKER_GITHUB_REF",
  "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE",
  "REVIEWBOT_WORKER_GITHUB_TOKEN",
  "REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID",
  "REVIEWBOT_WORKER_GITHUB_APP_ID",
  "REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY",
  "REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY_BASE64",
  "REVIEWBOT_USAGE_API_PUBLIC_ENABLED",
  "REVIEWBOT_USAGE_API_ADMIN_ENABLED",
  "REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_USAGE_EVENTS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_MODEL_PRICE_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH",
  "REVIEWBOT_USAGE_API_DEFAULT_DAYS",
  "REVIEWBOT_USAGE_API_MAX_DAYS",
  "REVIEWBOT_USAGE_API_MAX_ITEMS",
  "REVIEWBOT_USAGE_API_MAX_EVENTS",
  "REVIEWBOT_USAGE_API_PUBLIC_REPOS",
  "REVIEWBOT_USAGE_API_PUBLIC_ORGS",
  "REVIEWBOT_USAGE_API_BASE_URL",
  "REVIEWBOT_USAGE_API_CLIENT_TIMEOUT_MS",
  "REVIEWBOT_USAGE_API_ADMIN_ACTOR",
  "REVIEWBOT_USAGE_API_ADMIN_ROLES",
  "REVIEWBOT_ADMIN_AUTH_MODE",
  "REVIEWBOT_ADMIN_AUTH_SHARED_SECRET",
  "REVIEWBOT_ADMIN_AUTH_HMAC_SECRET",
  "REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES",
  "REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS",
  "REVIEWBOT_ALERTS_ENABLED",
  "REVIEWBOT_ALERTS_NOTIFY_MODE",
  "REVIEWBOT_ALERTS_NOTIFY_FAIL_CLOSED",
  "REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT",
  "REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT",
  "REVIEWBOT_ALERTS_SPIKE_DIMENSIONS",
  "REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED",
  "REVIEW_MAX_OUTPUT_TOKENS",
  "REVIEW_MAX_CHANGED_FILES",
  "REVIEW_MAX_CHANGED_LINES",
  "REVIEW_MAX_DIFF_CHARS",
  "REVIEW_MAX_CONTEXT_CHARS",
  "REVIEW_MAX_INPUT_CHARS",
  "REVIEW_MAX_PRIOR_COMMENTS_CHARS",
  "REVIEW_CONTEXT_LINES",
  "REVIEW_OVERSIZE_BEHAVIOR",
  "REVIEW_POST_SKIP_COMMENT",
  "REVIEW_PROVIDER_TIMEOUT_MS",
  "REVIEW_TEMPERATURE",
  "REVIEW_OPENAI_REASONING",
  "REVIEW_OPENAI_VERBOSITY",
  "REVIEW_REASONING_EFFORT",
  "REVIEW_VERBOSITY",
  "REVIEW_TRUSTED_MARKER_AUTHORS",
  "REVIEW_USAGE_ENABLED",
  "REVIEW_USAGE_AWS_REGION",
  "REVIEW_USAGE_AWS_ROLE_ARN",
  "REVIEW_USAGE_DB_RESOURCE_ARN",
  "REVIEW_USAGE_DB_SECRET_ARN",
  "REVIEW_USAGE_DB_NAME",
  "REVIEW_USAGE_DB_SCHEMA",
  "REVIEW_USAGE_FAIL_CLOSED",
  "AWS_CLI_BIN",
];

const envExampleKeys = [
  "GH_REPO",
  "PR_NUMBER",
  "REVIEW_PROVIDER",
  "REVIEW_USAGE_ENABLED",
  "GITHUB_WEBHOOK_SECRET",
  "REVIEWBOT_GITHUB_APP_ID",
  "REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64",
  "REVIEWBOT_PUBLIC_REPO_MODE",
  "REVIEWBOT_PRIVATE_REPO_MODE",
  "REVIEWBOT_DRAFT_PR_MODE",
  "REVIEWBOT_ALLOWED_PR_AUTHORS",
  "REVIEWBOT_BUDGET_MODE",
  "REVIEWBOT_REVIEW_LANES",
  "REVIEWBOT_MAX_JOBS_PER_DELIVERY",
  "REVIEWBOT_RUN_CONTROL_MODE",
  "REVIEWBOT_REPOSITORY_CONFIG_SOURCE",
  "REVIEWBOT_WORKER_ADAPTER",
  "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE",
  "REVIEWBOT_USAGE_API_PUBLIC_ENABLED",
  "REVIEWBOT_USAGE_API_ADMIN_ENABLED",
  "REVIEWBOT_ADMIN_AUTH_MODE",
  "REVIEWBOT_ALERTS_ENABLED",
  "REVIEWBOT_ALERTS_NOTIFY_MODE",
];

function main() {
  const result = checkConfigurationReferenceContract();
  console.log(
    `configuration reference contract ok (${result.sections} sections, ${result.envKeys} env keys, ${result.docs} docs/templates checked)`
  );
}

function checkConfigurationReferenceContract(options = {}) {
  const findings = [];
  const docTexts = options.docTexts || {};
  const envTexts = options.envTexts || {};

  const configText = getText("docs/configuration.md", docTexts);
  checkSections(configText, findings);
  checkConfigurationGuidance(configText, findings);
  checkEnvKeys(configText, getText(".env.example", envTexts), findings);
  checkSourceAnchors(findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`configuration reference contract check found ${findings.length} issue(s).`);
  }

  return {
    sections: requiredSections.length,
    envKeys: documentedEnvKeys.length,
    docs: targetDocs.length + 1,
  };
}

function checkSections(text, findings) {
  let lastIndex = -1;
  for (const section of requiredSections) {
    const index = text.indexOf(section);
    if (index === -1) {
      findings.push(`docs/configuration.md must include '${section}'.`);
      continue;
    }
    if (index <= lastIndex) {
      findings.push("docs/configuration.md sections must stay in release-checked order.");
    }
    lastIndex = index;
  }
}

function checkConfigurationGuidance(text, findings) {
  for (const snippet of [
    "Run `npm run check:configuration-reference` after editing this reference",
    "`GITHUB_WEBHOOK_SECRET` and `REVIEWBOT_GITHUB_WEBHOOK_SECRET` are aliases",
    "Production secrets should be high-entropy and at least 32 characters",
    "fail closed when token or collaborator-permission reads cannot complete",
    "Public repositories require trusted actors by default",
    "Every budget scope supports `_DAILY_USD`, `_WEEKLY_USD`, and `_MONTHLY_USD`.",
    "are loaded into admission when `REVIEW_USAGE_ENABLED=true`",
    "OpenRouter has no built-in default. Configure it explicitly.",
    "preflight validates that every row has a current `sourceCheckedAt` timestamp",
    "Use explicit OpenRouter lanes because OpenRouter model routing affects cost and provider trust",
    "Runtime control is a central pause layer that runs before budget checks",
    "Run control claims jobs after budget admission and before worker dispatch",
    "Repository config is intentionally not a second source of unlimited authority.",
    "By default it reuses the usage-ledger Aurora Data API settings.",
    "`noop` is the safe default.",
    "Partial worker App credential overrides fail preflight.",
    "The replay command reads a saved GitHub webhook JSON payload, signs it locally",
    "validates runtime configuration without calling GitHub, AWS, model providers, or alert endpoints",
    "Admin endpoints still fail closed unless the server injects an admin authorizer.",
    "Do not expose the matching HMAC secret to browser JavaScript.",
    "`disabled` is the fail-closed default.",
    "Scheduled operator checks read the usage/job ledgers",
    "The engine enforces hard maximums above these configurable values.",
    "Only comments by these authors can contribute hidden 6529bot metadata",
    "When `REVIEW_USAGE_FAIL_CLOSED=false`, a failed ledger write logs a warning",
  ]) {
    requireSnippet(text, snippet, "configuration guidance", findings);
  }
}

function checkEnvKeys(configText, envExampleText, findings) {
  const normalizedConfig = normalizeWhitespace(configText);
  for (const key of documentedEnvKeys) {
    if (!normalizedConfig.includes(key)) {
      findings.push(`docs/configuration.md must document ${key}.`);
    }
  }

  for (const key of envExampleKeys) {
    if (!envExampleText.includes(`${key}=`)) {
      findings.push(`.env.example must include ${key}=.`);
    }
  }
}

function checkSourceAnchors(findings) {
  const sourceExpectations = {
    "src/github-webhook.cjs": [
      "GITHUB_WEBHOOK_SECRET",
      "REVIEWBOT_GITHUB_WEBHOOK_SECRET",
      "REVIEWBOT_WEBHOOK_PATH",
      "REVIEWBOT_WEBHOOK_MAX_BODY_BYTES",
    ],
    "src/github-app-auth.cjs": [
      "REVIEWBOT_GITHUB_APP_ID",
      "REVIEWBOT_GITHUB_APP_PRIVATE_KEY",
      "REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64",
      "REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS",
    ],
    "src/budget-admission.cjs": [
      "REVIEWBOT_BUDGET_MODE",
      "REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD",
      "REVIEWBOT_BUDGET_${prefix}_DAILY_USD",
    ],
    "src/repository-config.cjs": [
      "REVIEWBOT_REPOSITORY_CONFIG_SOURCE",
      "REVIEWBOT_REPOSITORY_CONFIG_PATHS",
      "REVIEWBOT_REPOSITORY_CONFIG_MAX_BYTES",
    ],
    "src/worker-adapter.cjs": [
      "REVIEWBOT_WORKER_ADAPTER",
      "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE",
      "REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID",
    ],
    "src/usage-api.cjs": [
      "REVIEWBOT_USAGE_API_PUBLIC_ENABLED",
      "REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH",
      "REVIEWBOT_USAGE_API_PUBLIC_ORGS",
    ],
    "src/admin-auth.cjs": [
      "REVIEWBOT_ADMIN_AUTH_MODE",
      "REVIEWBOT_ADMIN_AUTH_HMAC_SECRET",
      "REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS",
    ],
    "src/spend-alerts.cjs": [
      "REVIEWBOT_ALERTS_ENABLED",
      "REVIEWBOT_ALERTS_SPIKE_DIMENSIONS",
      "REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT",
    ],
    "src/review-bot.cjs": [
      "REVIEW_MAX_INPUT_CHARS",
      "REVIEW_OPENAI_REASONING",
      "REVIEW_TRUSTED_MARKER_AUTHORS",
    ],
    "src/usage-ledger.cjs": [
      "REVIEW_USAGE_ENABLED",
      "REVIEW_USAGE_DB_RESOURCE_ARN",
      "REVIEW_USAGE_FAIL_CLOSED",
    ],
    "src/preflight.cjs": [
      "REVIEWBOT_MODEL_PRICE_FILE",
      "REVIEWBOT_ADMIN_AUTH_HMAC_SECRET is required for hmac mode.",
      "provider_keys",
    ],
  };

  for (const [file, snippets] of Object.entries(sourceExpectations)) {
    const text = readText(file);
    for (const snippet of snippets) {
      if (!text.includes(snippet)) {
        findings.push(`${file} must include '${snippet}'.`);
      }
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:configuration-reference",
      "[Configuration](docs/configuration.md)",
    ],
    "docs/configuration.md": [
      "configuration reference contract",
      "npm run check:configuration-reference",
    ],
    "docs/deployment.md": [
      "npm run check:configuration-reference",
      "Configuration",
    ],
    "docs/release-operations-map.md": [
      "npm run check:configuration-reference",
      "configuration reference",
    ],
    "docs/release.md": [
      "npm run check:configuration-reference",
      "configuration reference",
    ],
    "docs/release-readiness.md": [
      "npm run check:configuration-reference",
      "configuration reference",
    ],
    "docs/roadmap.md": [
      "configuration reference contract",
      "runtime configuration",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(getText(doc, docTexts));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function requireSnippet(text, snippet, label, findings) {
  if (!normalizeWhitespace(text).includes(normalizeWhitespace(snippet))) {
    findings.push(`${label} must include '${snippet}'.`);
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return readText(relativePath);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkConfigurationReferenceContract,
  documentedEnvKeys,
  requiredSections,
};
