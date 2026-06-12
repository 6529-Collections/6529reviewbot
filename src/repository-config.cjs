"use strict";

const YAML = require("yaml");
const { REVIEW_KINDS, INITIAL_REVIEW_KINDS } = require("./github-webhook.cjs");
const { TRUSTED_PERMISSION_ORDER } = require("./admission-policy.cjs");
const { BUDGET_SCOPES } = require("./budget-admission.cjs");
const { parseReviewLanes } = require("./review-job.cjs");

const CONFIG_VERSION = 1;
const DEFAULT_CONFIG_PATHS = [
  ".github/6529bot.yml",
  ".github/6529bot.yaml",
  ".github/6529bot.json",
  ".6529reviewbot.yml",
  ".6529reviewbot.yaml",
  ".6529reviewbot.json",
];
const DEFAULT_MAX_CONFIG_BYTES = 64 * 1024;
const DEFAULT_FOLLOWUP_REVIEW_KINDS = ["followup"];
const TOP_LEVEL_KEYS = new Set([
  "version",
  "enabled",
  "reviewKinds",
  "commands",
  "lanes",
  "limits",
  "admission",
  "budget",
]);

function repositoryConfigPolicyFromEnv(env = process.env) {
  const configuredPaths = csv(env.REVIEWBOT_REPOSITORY_CONFIG_PATHS || "");
  return {
    source: enumValue(
      env.REVIEWBOT_REPOSITORY_CONFIG_SOURCE || "none",
      ["none", "github"],
      "REVIEWBOT_REPOSITORY_CONFIG_SOURCE"
    ),
    paths: normalizeConfigPaths(
      configuredPaths.length ? configuredPaths : DEFAULT_CONFIG_PATHS
    ),
    required: parseBool(env.REVIEWBOT_REPOSITORY_CONFIG_REQUIRED || "false"),
    maxBytes: positiveInt(
      env.REVIEWBOT_REPOSITORY_CONFIG_MAX_BYTES,
      DEFAULT_MAX_CONFIG_BYTES,
      "REVIEWBOT_REPOSITORY_CONFIG_MAX_BYTES"
    ),
    githubToken: env.REVIEWBOT_GITHUB_TOKEN || env.GITHUB_TOKEN || "",
  };
}

async function loadRepositoryConfigForEvent(event, options = {}) {
  const policy = options.policy || repositoryConfigPolicyFromEnv(options.env);
  if (policy.source === "none") {
    return repositoryConfigLoadResult({
      status: "not_configured",
      reason: "Repository config loading is disabled.",
      config: defaultRepositoryConfig(),
    });
  }
  return await loadRepositoryConfigFromGitHub(event, {
    ...options,
    policy,
  });
}

async function loadRepositoryConfigFromGitHub(event, options = {}) {
  const policy = options.policy || repositoryConfigPolicyFromEnv(options.env);
  const repo = event?.repository?.fullName || "";
  const ref = repositoryConfigRefForEvent(event);
  const fetchImpl = options.fetchImpl || fetch;
  const token = options.githubToken || policy.githubToken || "";

  if (!repo || !repo.includes("/")) {
    return repositoryConfigLoadResult({
      status: "missing",
      reason: "Repository name is unavailable.",
      ref,
      config: defaultRepositoryConfig(),
    });
  }

  for (const configPath of policy.paths) {
    const loaded = await fetchGitHubConfigText({
      repo,
      ref,
      path: configPath,
      fetchImpl,
      token,
      maxBytes: policy.maxBytes,
    });
    if (loaded.status === "missing") {
      continue;
    }
    if (loaded.status !== "loaded") {
      return repositoryConfigLoadResult(loaded);
    }

    try {
      return repositoryConfigLoadResult({
        status: "loaded",
        source: "github",
        path: configPath,
        ref,
        config: parseRepositoryConfigText(loaded.text, configPath),
      });
    } catch (error) {
      return repositoryConfigLoadResult({
        status: "invalid",
        source: "github",
        path: configPath,
        ref,
        reason: error.message,
      });
    }
  }

  return repositoryConfigLoadResult({
    status: "missing",
    source: "github",
    ref,
    reason: "No repository config file was found.",
    config: defaultRepositoryConfig(),
  });
}

async function fetchGitHubConfigText(input) {
  const [owner, repoName] = input.repo.split("/", 2);
  const url = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repoName
    )}/contents/${encodePath(input.path)}`
  );
  if (input.ref) {
    url.searchParams.set("ref", input.ref);
  }

  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "6529reviewbot",
  };
  if (input.token) {
    headers.authorization = `Bearer ${input.token}`;
  }

  const response = await input.fetchImpl(url, { headers });
  if (response.status === 404) {
    return { status: "missing", path: input.path, ref: input.ref };
  }
  if (!response.ok) {
    return {
      status: "unavailable",
      path: input.path,
      ref: input.ref,
      reason: `GitHub contents API returned HTTP ${response.status}.`,
    };
  }

  const body = await response.json();
  if (body.type !== "file" || body.encoding !== "base64" || !body.content) {
    return {
      status: "invalid",
      path: input.path,
      ref: input.ref,
      reason: "Repository config content is not a base64-encoded file.",
    };
  }

  const bytes = Buffer.from(String(body.content).replace(/\s+/g, ""), "base64");
  if (bytes.length > input.maxBytes) {
    return {
      status: "invalid",
      path: input.path,
      ref: input.ref,
      reason: `Repository config exceeds ${input.maxBytes} bytes.`,
    };
  }

  return {
    status: "loaded",
    path: input.path,
    ref: input.ref,
    text: bytes.toString("utf8"),
  };
}

function repositoryConfigRefForEvent(event = {}) {
  return event.baseSha || event.repository?.defaultBranch || "";
}

function parseRepositoryConfigText(text, filePath = "") {
  const raw = filePath.endsWith(".json") ? JSON.parse(text) : YAML.parse(text);
  return normalizeRepositoryConfig(raw || {});
}

function normalizeRepositoryConfig(raw) {
  assertPlainObject(raw, "repository config");
  assertKnownKeys(raw, TOP_LEVEL_KEYS, "repository config");

  const version = optionalPositiveInt(raw.version, CONFIG_VERSION, "version");
  if (version !== CONFIG_VERSION) {
    throw new Error(`Unsupported repository config version '${version}'.`);
  }

  const reviewKinds = normalizeReviewKindsConfig(raw.reviewKinds || {});
  return {
    version,
    enabled: optionalBoolean(raw.enabled, true, "enabled"),
    reviewKinds,
    commands: normalizeCommandsConfig(raw.commands || {}),
    lanes: normalizeLaneConfig(raw.lanes || []),
    limits: normalizeLimitsConfig(raw.limits || {}),
    admission: normalizeAdmissionConfig(raw.admission || {}),
    budget: normalizeBudgetConfig(raw.budget || {}),
  };
}

function defaultRepositoryConfig() {
  return {
    version: CONFIG_VERSION,
    enabled: true,
    reviewKinds: {
      allowed: [...REVIEW_KINDS],
      initial: [...INITIAL_REVIEW_KINDS],
      followup: [...DEFAULT_FOLLOWUP_REVIEW_KINDS],
    },
    commands: {
      enabled: true,
    },
    lanes: [],
    limits: {},
    admission: {},
    budget: {},
  };
}

function applyRepositoryConfigToEvent(event, config = defaultRepositoryConfig()) {
  if (!config.enabled) {
    return {
      ...event,
      shouldEnqueue: false,
      reviewKinds: [],
      reason: "Repository config disables 6529bot.",
    };
  }

  if (event.trigger === "comment" && config.commands.enabled === false) {
    return {
      ...event,
      shouldEnqueue: false,
      reviewKinds: [],
      reason: "Repository config disables comment commands.",
    };
  }

  const reviewKinds = reviewKindsForConfiguredEvent(event, config);
  if (event.shouldEnqueue && reviewKinds.length === 0) {
    return {
      ...event,
      shouldEnqueue: false,
      reviewKinds,
      reason: "Repository config does not allow any requested review kinds.",
    };
  }

  return {
    ...event,
    reviewKinds,
  };
}

function reviewKindsForConfiguredEvent(event, config) {
  if (event.trigger === "pull_request") {
    const desired =
      event.action === "synchronize"
        ? config.reviewKinds.followup
        : config.reviewKinds.initial;
    return filterAllowedReviewKinds(desired, config.reviewKinds.allowed);
  }
  return filterAllowedReviewKinds(event.reviewKinds || [], config.reviewKinds.allowed);
}

function mergeRepositoryJobPolicy(basePolicy, config = defaultRepositoryConfig()) {
  const maxJobsPerDelivery = config.limits.maxJobsPerDelivery
    ? Math.min(basePolicy.maxJobsPerDelivery, config.limits.maxJobsPerDelivery)
    : basePolicy.maxJobsPerDelivery;

  if (!config.lanes.length) {
    return { ...basePolicy, maxJobsPerDelivery };
  }

  const allowed = new Set((basePolicy.lanes || []).map(laneKey));
  return {
    ...basePolicy,
    maxJobsPerDelivery,
    lanes: config.lanes.filter((lane) => allowed.has(laneKey(lane))),
  };
}

function mergeRepositoryAdmissionPolicy(basePolicy, config = defaultRepositoryConfig()) {
  const admission = config.admission || {};
  return {
    ...basePolicy,
    publicRepoMode: restrictiveRepoMode(basePolicy.publicRepoMode, admission.publicRepoMode),
    privateRepoMode: restrictiveRepoMode(basePolicy.privateRepoMode, admission.privateRepoMode),
    draftPrMode:
      basePolicy.draftPrMode === "skip" || admission.draftPrMode === "skip"
        ? "skip"
        : basePolicy.draftPrMode,
    trustedUsers: unionSet(basePolicy.trustedUsers, admission.trustedUsers),
    trustedTeams: unionSet(basePolicy.trustedTeams, admission.trustedTeams),
    trustedOrganizations: unionSet(
      basePolicy.trustedOrganizations,
      admission.trustedOrganizations
    ),
    trustedPermission: stricterPermission(
      basePolicy.trustedPermission,
      admission.trustedPermission
    ),
    denyUsers: unionSet(basePolicy.denyUsers, admission.denyUsers),
  };
}

function mergeRepositoryBudgetPolicy(basePolicy, config = defaultRepositoryConfig()) {
  const budget = config.budget || {};
  const caps = {};
  for (const scope of BUDGET_SCOPES) {
    caps[scope] = mergeCaps(basePolicy.caps?.[scope] || {}, budget.caps?.[scope] || {});
  }

  return {
    ...basePolicy,
    mode: restrictiveBudgetMode(basePolicy.mode, budget.mode),
    defaultEstimatedCostUsd:
      budget.defaultEstimatedCostUsd === undefined
        ? basePolicy.defaultEstimatedCostUsd
        : Math.max(basePolicy.defaultEstimatedCostUsd, budget.defaultEstimatedCostUsd),
    caps,
    explicitPolicies: [
      ...(basePolicy.explicitPolicies || []),
      ...(budget.explicitPolicies || []),
    ],
  };
}

function repositoryConfigBlocksWork(loadResult, policy = repositoryConfigPolicyFromEnv()) {
  if (loadResult.status === "invalid" || loadResult.status === "unavailable") {
    return true;
  }
  return policy.required && ["missing", "not_configured"].includes(loadResult.status);
}

function publicRepositoryConfigSummary(loadResult, config) {
  return {
    status: loadResult.status,
    source: loadResult.source || "",
    path: loadResult.path || "",
    ref: loadResult.ref || "",
    reason: loadResult.reason || "",
    enabled: Boolean(config?.enabled),
    reviewKinds: config?.reviewKinds || null,
    lanes: (config?.lanes || []).map((lane) => ({
      provider: lane.provider,
      model: lane.model,
      lane: lane.lane,
    })),
  };
}

function repositoryConfigLoadResult(result) {
  return {
    source: result.source || "",
    path: result.path || "",
    ref: result.ref || "",
    reason: result.reason || "",
    config: result.config || defaultRepositoryConfig(),
    ...result,
  };
}

function normalizeReviewKindsConfig(raw) {
  assertPlainObject(raw, "reviewKinds");
  assertKnownKeys(raw, new Set(["allowed", "initial", "followup"]), "reviewKinds");
  const allowed = reviewKindList(raw.allowed, REVIEW_KINDS, "reviewKinds.allowed");
  return {
    allowed,
    initial: filterAllowedReviewKinds(
      reviewKindList(raw.initial, INITIAL_REVIEW_KINDS, "reviewKinds.initial"),
      allowed
    ),
    followup: filterAllowedReviewKinds(
      reviewKindList(raw.followup, DEFAULT_FOLLOWUP_REVIEW_KINDS, "reviewKinds.followup"),
      allowed
    ),
  };
}

function normalizeCommandsConfig(raw) {
  assertPlainObject(raw, "commands");
  assertKnownKeys(raw, new Set(["enabled"]), "commands");
  return {
    enabled: optionalBoolean(raw.enabled, true, "commands.enabled"),
  };
}

function normalizeLaneConfig(raw) {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error("lanes must be an array.");
  }
  if (!raw.length) {
    return [];
  }

  const entries = raw.map((item, index) => {
    if (typeof item === "string") {
      return item;
    }
    assertPlainObject(item, `lanes[${index}]`);
    assertKnownKeys(item, new Set(["provider", "model"]), `lanes[${index}]`);
    if (!item.provider) {
      throw new Error(`lanes[${index}].provider is required.`);
    }
    return `${item.provider}:${item.model || ""}`;
  });

  return parseReviewLanes(entries.join(","));
}

function normalizeLimitsConfig(raw) {
  assertPlainObject(raw, "limits");
  assertKnownKeys(raw, new Set(["maxJobsPerDelivery"]), "limits");
  return {
    maxJobsPerDelivery:
      raw.maxJobsPerDelivery === undefined
        ? undefined
        : positiveInt(raw.maxJobsPerDelivery, undefined, "limits.maxJobsPerDelivery"),
  };
}

function normalizeAdmissionConfig(raw) {
  assertPlainObject(raw, "admission");
  assertKnownKeys(
    raw,
    new Set([
      "publicRepoMode",
      "privateRepoMode",
      "draftPrMode",
      "trustedUsers",
      "trustedTeams",
      "trustedOrganizations",
      "trustedOrgs",
      "trustedPermission",
      "denyUsers",
    ]),
    "admission"
  );
  return {
    publicRepoMode:
      raw.publicRepoMode === undefined
        ? undefined
        : enumValue(raw.publicRepoMode, ["trusted", "off", "open"], "admission.publicRepoMode"),
    privateRepoMode:
      raw.privateRepoMode === undefined
        ? undefined
        : enumValue(raw.privateRepoMode, ["trusted", "off", "open"], "admission.privateRepoMode"),
    draftPrMode:
      raw.draftPrMode === undefined
        ? undefined
        : enumValue(raw.draftPrMode, ["skip", "allow"], "admission.draftPrMode"),
    trustedUsers: stringSet(raw.trustedUsers, "admission.trustedUsers"),
    trustedTeams: stringSet(raw.trustedTeams, "admission.trustedTeams"),
    trustedOrganizations: stringSet(
      raw.trustedOrganizations || raw.trustedOrgs,
      "admission.trustedOrganizations"
    ),
    trustedPermission:
      raw.trustedPermission === undefined
        ? undefined
        : enumValue(
            raw.trustedPermission,
            TRUSTED_PERMISSION_ORDER,
            "admission.trustedPermission"
          ),
    denyUsers: stringSet(raw.denyUsers, "admission.denyUsers"),
  };
}

function normalizeBudgetConfig(raw) {
  assertPlainObject(raw, "budget");
  assertKnownKeys(
    raw,
    new Set(["mode", "defaultEstimatedCostUsd", "caps", "explicitPolicies"]),
    "budget"
  );
  return {
    mode:
      raw.mode === undefined
        ? undefined
        : enumValue(raw.mode, ["enforce", "warn", "off"], "budget.mode"),
    defaultEstimatedCostUsd:
      raw.defaultEstimatedCostUsd === undefined
        ? undefined
        : nonNegativeNumber(raw.defaultEstimatedCostUsd, "budget.defaultEstimatedCostUsd"),
    caps: normalizeBudgetCaps(raw.caps || {}),
    explicitPolicies: normalizeExplicitBudgetPolicies(raw.explicitPolicies || []),
  };
}

function normalizeBudgetCaps(raw) {
  assertPlainObject(raw, "budget.caps");
  const caps = {};
  for (const [scope, value] of Object.entries(raw)) {
    if (!BUDGET_SCOPES.includes(scope)) {
      throw new Error(`budget.caps has unsupported scope '${scope}'.`);
    }
    caps[scope] = normalizeCap(value, `budget.caps.${scope}`);
  }
  return caps;
}

function normalizeCap(raw, name) {
  assertPlainObject(raw, name);
  assertKnownKeys(raw, new Set(["dailyUsd", "weeklyUsd", "monthlyUsd"]), name);
  return {
    dailyBudgetUsd: optionalUsd(raw.dailyUsd, `${name}.dailyUsd`),
    weeklyBudgetUsd: optionalUsd(raw.weeklyUsd, `${name}.weeklyUsd`),
    monthlyBudgetUsd: optionalUsd(raw.monthlyUsd, `${name}.monthlyUsd`),
  };
}

function normalizeExplicitBudgetPolicies(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("budget.explicitPolicies must be an array.");
  }
  return raw.map((item, index) => {
    assertPlainObject(item, `budget.explicitPolicies[${index}]`);
    assertKnownKeys(
      item,
      new Set([
        "scopeType",
        "scopeValue",
        "dailyUsd",
        "weeklyUsd",
        "monthlyUsd",
        "enabled",
      ]),
      `budget.explicitPolicies[${index}]`
    );
    const scopeType = enumValue(
      item.scopeType,
      BUDGET_SCOPES,
      `budget.explicitPolicies[${index}].scopeType`
    );
    const scopeValue = stringValue(
      item.scopeValue || "*",
      `budget.explicitPolicies[${index}].scopeValue`
    );
    return {
      scopeType,
      scopeValue,
      dailyBudgetUsd: optionalUsd(item.dailyUsd, `budget.explicitPolicies[${index}].dailyUsd`),
      weeklyBudgetUsd: optionalUsd(item.weeklyUsd, `budget.explicitPolicies[${index}].weeklyUsd`),
      monthlyBudgetUsd: optionalUsd(item.monthlyUsd, `budget.explicitPolicies[${index}].monthlyUsd`),
      enabled: optionalBoolean(item.enabled, true, `budget.explicitPolicies[${index}].enabled`),
    };
  });
}

function reviewKindList(value, fallback, name) {
  const items = value === undefined ? fallback : value;
  if (!Array.isArray(items)) {
    throw new Error(`${name} must be an array.`);
  }
  return uniqueStrings(items.map((item) => enumValue(item, REVIEW_KINDS, name)));
}

function filterAllowedReviewKinds(values, allowedValues) {
  const allowed = new Set(allowedValues);
  return uniqueStrings(values.filter((kind) => allowed.has(kind)));
}

function mergeCaps(base, override) {
  return {
    dailyBudgetUsd: minNullable(base.dailyBudgetUsd, override.dailyBudgetUsd),
    weeklyBudgetUsd: minNullable(base.weeklyBudgetUsd, override.weeklyBudgetUsd),
    monthlyBudgetUsd: minNullable(base.monthlyBudgetUsd, override.monthlyBudgetUsd),
  };
}

function restrictiveRepoMode(base = "trusted", override) {
  if (!override) {
    return base;
  }
  const rank = { off: 3, trusted: 2, open: 1 };
  return rank[override] > rank[base] ? override : base;
}

function restrictiveBudgetMode(base = "enforce", override) {
  if (!override) {
    return base;
  }
  const rank = { enforce: 3, warn: 2, off: 1 };
  return rank[override] > rank[base] ? override : base;
}

function stricterPermission(base = "write", override) {
  if (!override) {
    return base;
  }
  const baseIndex = TRUSTED_PERMISSION_ORDER.indexOf(base);
  const overrideIndex = TRUSTED_PERMISSION_ORDER.indexOf(override);
  return overrideIndex > baseIndex ? override : base;
}

function minNullable(a, b) {
  if (a === null || a === undefined) {
    return b === undefined ? null : b;
  }
  if (b === null || b === undefined) {
    return a;
  }
  return Math.min(a, b);
}

function laneKey(lane) {
  return `${lane.provider}\0${lane.model}`;
}

function unionSet(left, right) {
  return new Set([...(left || []), ...(right || [])].map((item) => String(item).toLowerCase()));
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function assertKnownKeys(value, allowed, name) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${name} has unsupported key '${key}'.`);
    }
  }
}

function optionalBoolean(value, fallback, name) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${name} must be true or false.`);
  }
  return value;
}

function optionalPositiveInt(value, fallback, name) {
  if (value === undefined) {
    return fallback;
  }
  return positiveInt(value, fallback, name);
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === "") {
    if (fallback === undefined) {
      throw new Error(`${name} is required.`);
    }
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function optionalUsd(value, name) {
  return value === undefined || value === null ? null : nonNegativeNumber(value, name);
}

function nonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function stringSet(value, name) {
  if (value === undefined || value === null) {
    return new Set();
  }
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  return new Set(value.map((item) => stringValue(item, name).toLowerCase()));
}

function stringValue(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must contain non-empty strings.`);
  }
  return value.trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeConfigPaths(paths) {
  return paths.map((item) => {
    const normalized = String(item || "").trim().replace(/\\/g, "/");
    if (
      !normalized ||
      normalized.startsWith("/") ||
      normalized.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      throw new Error(`Invalid repository config path '${item}'.`);
    }
    return normalized;
  });
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function encodePath(filePath) {
  return String(filePath || "")
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

module.exports = {
  CONFIG_VERSION,
  DEFAULT_CONFIG_PATHS,
  DEFAULT_MAX_CONFIG_BYTES,
  applyRepositoryConfigToEvent,
  defaultRepositoryConfig,
  fetchGitHubConfigText,
  loadRepositoryConfigForEvent,
  loadRepositoryConfigFromGitHub,
  mergeRepositoryAdmissionPolicy,
  mergeRepositoryBudgetPolicy,
  mergeRepositoryJobPolicy,
  normalizeRepositoryConfig,
  parseRepositoryConfigText,
  publicRepositoryConfigSummary,
  repositoryConfigBlocksWork,
  repositoryConfigPolicyFromEnv,
  repositoryConfigRefForEvent,
};
