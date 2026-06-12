"use strict";

const fs = require("fs");
const { adminAuthSettingsFromEnv } = require("./admin-auth.cjs");
const { admissionPolicyFromEnv } = require("./admission-policy.cjs");
const { alertNotifierSettingsFromEnv } = require("./alert-notifier.cjs");
const { budgetPolicyFromEnv } = require("./budget-admission.cjs");
const { assertDataApiSettings } = require("./data-api.cjs");
const { safeErrorLine } = require("./diagnostics.cjs");
const {
  DEFAULT_MAX_SOURCE_AGE_DAYS,
  describeFreshnessIssue,
  staleModelPriceSources,
  validateModelPriceFile,
} = require("./model-prices.cjs");
const {
  githubAppAuthSettingsFromWorkerDispatchEnv,
  githubAppAuthSettingsFromEnv,
  hasWorkerDispatchGitHubAppCredentialOverride,
  isGitHubAppAuthConfigured,
} = require("./github-app-auth.cjs");
const {
  assertWebhookSettings,
  isWeakWebhookSecret,
  MIN_WEBHOOK_SECRET_LENGTH,
  webhookSettingsFromEnv,
} = require("./github-webhook.cjs");
const {
  assertJobLedgerConfigured,
  jobLedgerSettingsFromEnv,
} = require("./job-ledger.cjs");
const { ledgerSchemaStatements } = require("./ledger-schema.cjs");
const { loadModelCatalog } = require("./model-catalog.cjs");
const { repositoryConfigPolicyFromEnv } = require("./repository-config.cjs");
const { reviewJobPolicyFromEnv } = require("./review-job.cjs");
const { runControlLedgerSettingsFromEnv } = require("./run-control-ledger.cjs");
const { runControlPolicyFromEnv } = require("./run-control.cjs");
const {
  runtimeControlPolicyFromEnv,
  runtimeControlPolicySummary,
} = require("./runtime-control.cjs");
const { spendAlertPolicyFromEnv } = require("./spend-alerts.cjs");
const { usageApiSettingsFromEnv } = require("./usage-api.cjs");
const {
  assertUsageLedgerConfigured,
  usageLedgerSettingsFromEnv,
} = require("./usage-ledger.cjs");
const { workerAdapterPolicyFromEnv } = require("./worker-adapter.cjs");

const PROVIDER_KEYS = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

function runPreflight(options = {}) {
  const env = options.env || process.env;
  const result = {
    ok: true,
    profile: options.profile || "server",
    checks: [],
    warnings: [],
    errors: [],
  };

  const state = {};
  check(result, "webhook", () => {
    const settings = webhookSettingsFromEnv(env);
    assertWebhookSettings(settings);
    if (isWeakWebhookSecret(settings.webhookSecret)) {
      addWarning(
        result,
        "webhook",
        `Webhook secret is shorter than ${MIN_WEBHOOK_SECRET_LENGTH} characters; production should use a high-entropy secret.`
      );
    }
    state.webhookSettings = settings;
    return {
      path: settings.webhookPath,
      maxBodyBytes: settings.maxBodyBytes,
      webhookSecretLooksStrong: !isWeakWebhookSecret(settings.webhookSecret),
    };
  });

  check(result, "github_app_auth", () => {
    const settings = githubAppAuthSettingsFromEnv(env);
    state.githubAppSettings = settings;
    if (!isGitHubAppAuthConfigured(settings)) {
      addWarning(result, "github_app_auth", "GitHub App credentials are not fully configured.");
      return { configured: false };
    }
    return { configured: true, apiUrl: settings.apiUrl, fetchTimeoutMs: settings.fetchTimeoutMs };
  });

  check(result, "model_catalog", () => {
    const catalog = loadModelCatalog({ env });
    state.modelCatalog = catalog;
    return {
      defaultProvider: catalog.defaultProvider,
      providers: Object.keys(catalog.providers),
    };
  });

  check(result, "review_jobs", () => {
    const policy = reviewJobPolicyFromEnv(env);
    state.reviewJobPolicy = policy;
    return {
      lanes: policy.lanes.map((lane) => `${lane.provider}:${lane.model}`),
      maxJobsPerDelivery: policy.maxJobsPerDelivery,
    };
  });

  check(result, "admission_policy", () => {
    const policy = admissionPolicyFromEnv(env);
    return {
      publicRepoMode: policy.publicRepoMode,
      privateRepoMode: policy.privateRepoMode,
      draftPrMode: policy.draftPrMode,
      trustedPermission: policy.trustedPermission,
    };
  });

  check(result, "budget_policy", () => {
    const policy = budgetPolicyFromEnv(env);
    return {
      mode: policy.mode,
      defaultEstimatedCostUsd: policy.defaultEstimatedCostUsd,
    };
  });

  check(result, "runtime_control", () => {
    const policy = runtimeControlPolicyFromEnv(env);
    if (!policy.enabled) {
      addWarning(result, "runtime_control", "Review automation is disabled by REVIEWBOT_ENABLED=false.");
    }
    return runtimeControlPolicySummary(policy);
  });

  check(result, "run_control", () => {
    const policy = runControlPolicyFromEnv(env);
    const ledgerSettings = runControlLedgerSettingsFromEnv(env);
    if (policy.mode === "off") {
      addWarning(result, "run_control", "Run control is disabled; duplicate and concurrency claims will not be enforced.");
    }
    if (policy.mode !== "off" && !ledgerSettings.enabled) {
      addWarning(result, "run_control", "Run control is enabled but the built-in run-control ledger is disabled; the server must inject claimReviewJob.");
    }
    if (ledgerSettings.enabled) {
      assertDataApiSettings(ledgerSettings, "Run-control ledger");
    }
    return {
      mode: policy.mode,
      dedupeEnabled: policy.dedupeEnabled,
      dedupeTtlSeconds: policy.dedupeTtlSeconds,
      maxConcurrent: policy.maxConcurrent,
      ledgerEnabled: ledgerSettings.enabled,
    };
  });

  check(result, "repository_config", () => {
    const policy = repositoryConfigPolicyFromEnv(env);
    if (policy.source === "github" && !isGitHubAppAuthConfigured(state.githubAppSettings || {})) {
      addWarning(result, "repository_config", "Repository config uses GitHub; production should use GitHub App installation auth.");
    }
    return {
      source: policy.source,
      required: policy.required,
      paths: policy.paths,
      maxBytes: policy.maxBytes,
    };
  });

  check(result, "worker_adapter", () => {
    const policy = workerAdapterPolicyFromEnv(env);
    state.workerPolicy = policy;
    const workerDispatchGitHubAppSettings =
      githubAppAuthSettingsFromWorkerDispatchEnv(env);
    const workerDispatchCredentialOverride =
      hasWorkerDispatchGitHubAppCredentialOverride(env);
    const workerDispatchAppCredentialSource =
      workerDispatchCredentialOverride ? "worker-dispatch" : "main";
    const githubAppConfigured =
      isGitHubAppAuthConfigured(workerDispatchGitHubAppSettings) ||
      isGitHubAppAuthConfigured(state.githubAppSettings || {});
    const hasApiDispatchTokenSource =
      Boolean(policy.githubToken) ||
      Boolean(policy.githubInstallationId && githubAppConfigured);
    if (policy.mode === "noop") {
      addWarning(result, "worker_adapter", "Worker adapter is noop; admitted jobs will not execute.");
    }
    if (policy.mode === "github_actions" && !policy.githubRepo) {
      throw new Error("REVIEWBOT_WORKER_GITHUB_REPO or GITHUB_REPOSITORY is required for github_actions.");
    }
    if (
      policy.mode === "github_actions" &&
      workerDispatchCredentialOverride &&
      !isGitHubAppAuthConfigured(workerDispatchGitHubAppSettings)
    ) {
      throw new Error(
        "Worker dispatch GitHub App override must include REVIEWBOT_WORKER_GITHUB_APP_ID and REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY or REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY_BASE64."
      );
    }
    if (
      policy.mode === "github_actions" &&
      policy.githubDispatchMode === "api" &&
      !hasApiDispatchTokenSource
    ) {
      throw new Error(
        "REVIEWBOT_WORKER_GITHUB_TOKEN, GH_TOKEN, GITHUB_TOKEN, or REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID with GitHub App auth is required for github_actions API dispatch."
      );
    }
    if (
      policy.mode === "github_actions" &&
      policy.githubDispatchMode === "auto" &&
      !hasApiDispatchTokenSource
    ) {
      addWarning(result, "worker_adapter", "GitHub Actions dispatch has no API token; the server will fall back to the gh CLI.");
    }
    if (
      policy.mode === "github_actions" &&
      policy.githubInstallationId &&
      !workerDispatchCredentialOverride &&
      isGitHubAppAuthConfigured(state.githubAppSettings || {})
    ) {
      addWarning(
        result,
        "worker_adapter",
        "Worker dispatch will reuse the main GitHub App credentials; prefer REVIEWBOT_WORKER_GITHUB_APP_* for a dispatch-only App installed only on the central bot repository."
      );
    }
    return {
      mode: policy.mode,
      githubRepo: policy.githubRepo,
      githubWorkflow: policy.githubWorkflow,
      githubRef: policy.githubRef,
      githubDispatchMode: policy.githubDispatchMode,
      githubApiUrl: policy.githubApiUrl,
      githubTokenConfigured: Boolean(policy.githubToken),
      githubInstallationIdConfigured: Boolean(policy.githubInstallationId),
      githubDispatchAppCredentialSource:
        policy.githubInstallationId && githubAppConfigured
          ? workerDispatchAppCredentialSource
          : "none",
    };
  });

  check(result, "provider_keys", () => {
    const policy = state.reviewJobPolicy || reviewJobPolicyFromEnv(env);
    const providers = [...new Set(policy.lanes.map((lane) => lane.provider))];
    const missing = providers
      .filter((provider) => shouldRequireProviderKey(provider, state.workerPolicy, result.profile))
      .map((provider) => PROVIDER_KEYS[provider])
      .filter((key) => key && !env[key]);
    if (missing.length) {
      throw new Error(`Missing provider keys for executable local work: ${missing.join(", ")}`);
    }
    if (state.workerPolicy?.mode === "github_actions") {
      addWarning(
        result,
        "provider_keys",
        "github_actions provider keys must be configured as central worker secrets."
      );
    }
    return { providers, checkedLocally: missing.length === 0 };
  });

  check(result, "usage_ledger", () => {
    const settings = usageLedgerSettingsFromEnv(env);
    if (!settings.enabled) {
      addWarning(result, "usage_ledger", "Usage ledger is disabled.");
      return { enabled: false };
    }
    assertUsageLedgerConfigured(settings);
    return { enabled: true, database: settings.database, schema: settings.schema };
  });

  check(result, "job_ledger", () => {
    const settings = jobLedgerSettingsFromEnv(env);
    if (!settings.enabled) {
      addWarning(result, "job_ledger", "Job ledger is disabled.");
      return { enabled: false };
    }
    assertJobLedgerConfigured(settings);
    return { enabled: true, database: settings.database, schema: settings.schema };
  });

  check(result, "ledger_schema", () => {
    const settings = usageLedgerSettingsFromEnv(env);
    return {
      schema: settings.schema,
      statements: ledgerSchemaStatements(settings.schema).length,
    };
  });

  check(result, "model_price_sources", () => {
    const file = stringEnv(env.REVIEWBOT_MODEL_PRICE_FILE);
    const maxSourceAgeDays = numberEnv(
      env.REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS,
      DEFAULT_MAX_SOURCE_AGE_DAYS,
      "REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS"
    );
    if (!file) {
      return { configured: false, maxSourceAgeDays };
    }
    const document = loadModelPriceFileForPreflight(file);
    const staleRows = staleModelPriceSources(document, {
      maxSourceAgeDays,
      now: options.now,
    });
    if (staleRows.length) {
      throw new Error(
        `REVIEWBOT_MODEL_PRICE_FILE has stale or invalid sourceCheckedAt evidence: ${staleRows
          .map(describeFreshnessIssue)
          .join(", ")}`
      );
    }
    return {
      configured: true,
      rows: document.prices.length,
      maxSourceAgeDays,
    };
  });

  check(result, "usage_api", () => {
    const settings = usageApiSettingsFromEnv(env);
    return {
      publicEnabled: settings.publicEnabled,
      adminEnabled: settings.adminEnabled,
      defaultDays: settings.defaultDays,
      maxDays: settings.maxDays,
    };
  });

  check(result, "admin_auth", () => {
    const settings = adminAuthSettingsFromEnv(env);
    if (settings.mode === "disabled") {
      addWarning(result, "admin_auth", "Admin auth bridge is disabled.");
    }
    if (settings.mode === "shared_secret" && !settings.sharedSecret) {
      throw new Error("REVIEWBOT_ADMIN_AUTH_SHARED_SECRET is required for shared_secret mode.");
    }
    if (settings.mode === "hmac" && !settings.hmacSecret) {
      throw new Error("REVIEWBOT_ADMIN_AUTH_HMAC_SECRET is required for hmac mode.");
    }
    return { mode: settings.mode, requiredRoles: settings.requiredRoles };
  });

  check(result, "alerts", () => {
    const policy = spendAlertPolicyFromEnv(env);
    const notifier = alertNotifierSettingsFromEnv(env);
    if (!policy.enabled) {
      addWarning(result, "alerts", "Scheduled spend alerts are disabled.");
    }
    if (policy.enabled && notifier.mode === "webhook" && !notifier.webhookUrl) {
      throw new Error("REVIEWBOT_ALERTS_WEBHOOK_URL is required for webhook alerts.");
    }
    if (policy.enabled && notifier.mode === "sns" && !notifier.snsTopicArn) {
      throw new Error("REVIEWBOT_ALERTS_SNS_TOPIC_ARN is required for SNS alerts.");
    }
    return {
      enabled: policy.enabled,
      notifyMode: notifier.mode,
      spikeDimensions: policy.spikeDimensions,
    };
  });

  result.ok = result.errors.length === 0 && (!options.strict || result.warnings.length === 0);
  return result;
}

function check(result, name, fn) {
  try {
    const detail = fn() || {};
    result.checks.push({ name, status: "ok", ...detail });
  } catch (error) {
    const message = safeError(error);
    result.errors.push({ name, message });
    result.checks.push({ name, status: "error", message });
  }
}

function addWarning(result, name, message) {
  result.warnings.push({ name, message });
}

function shouldRequireProviderKey(provider, workerPolicy = {}, profile = "server") {
  if (!PROVIDER_KEYS[provider]) {
    return false;
  }
  return workerPolicy.mode === "local" || profile === "worker";
}

function formatPreflightResult(result) {
  const lines = [];
  lines.push(`6529reviewbot preflight: ${result.ok ? "ok" : "failed"}`);
  lines.push(`profile: ${result.profile}`);
  lines.push("");
  lines.push("Checks:");
  for (const item of result.checks) {
    lines.push(`- ${item.status}: ${item.name}${item.message ? ` - ${item.message}` : ""}`);
  }
  if (result.warnings.length) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning.name}: ${warning.message}`);
    }
  }
  if (result.errors.length) {
    lines.push("");
    lines.push("Errors:");
    for (const error of result.errors) {
      lines.push(`- ${error.name}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function safeError(error) {
  return safeErrorLine(error);
}

function stringEnv(value) {
  return String(value || "").trim();
}

function numberEnv(value, defaultValue, name) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return number;
}

function loadModelPriceFileForPreflight(file) {
  try {
    return validateModelPriceFile(
      JSON.parse(fs.readFileSync(file, "utf8")),
      "REVIEWBOT_MODEL_PRICE_FILE"
    );
  } catch (error) {
    if (error && (error.code || error instanceof SyntaxError)) {
      throw new Error("REVIEWBOT_MODEL_PRICE_FILE could not be read or parsed.");
    }
    throw error;
  }
}

module.exports = {
  formatPreflightResult,
  runPreflight,
};
