"use strict";

const {
  DEFAULT_MAX_TTL_SECONDS,
  DEFAULT_REQUIRED_ROLES,
  adminAuthSettingsFromEnv,
  signAdminAuthRequest,
} = require("./admin-auth.cjs");
const { redactSensitiveText } = require("./diagnostics.cjs");
const {
  DEFAULT_ADMIN_ALERT_STATUS_PATH,
  DEFAULT_ADMIN_BUDGET_POLICIES_PATH,
  DEFAULT_ADMIN_BUDGET_STATUS_PATH,
  DEFAULT_ADMIN_JOB_EVENTS_PATH,
  DEFAULT_ADMIN_MODEL_PRICE_STATUS_PATH,
  DEFAULT_ADMIN_RUN_CLAIMS_PATH,
  DEFAULT_ADMIN_STATUS_PATH,
  DEFAULT_ADMIN_SUMMARY_PATH,
  DEFAULT_ADMIN_USAGE_EVENTS_PATH,
  DEFAULT_PUBLIC_SUMMARY_PATH,
} = require("./usage-api.cjs");

const DEFAULT_CLIENT_TIMEOUT_MS = 10000;

function usageApiClientSettingsFromEnv(env = process.env) {
  return {
    baseUrl: env.REVIEWBOT_USAGE_API_BASE_URL || "",
    timeoutMs: positiveInt(
      env.REVIEWBOT_USAGE_API_CLIENT_TIMEOUT_MS,
      DEFAULT_CLIENT_TIMEOUT_MS,
      "REVIEWBOT_USAGE_API_CLIENT_TIMEOUT_MS"
    ),
    actor: env.REVIEWBOT_USAGE_API_ADMIN_ACTOR || "6529.io",
    roles: csv(
      env.REVIEWBOT_USAGE_API_ADMIN_ROLES ||
        env.REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES ||
        "reviewbot-admin"
    ),
    adminAuth: adminAuthSettingsFromEnv(env),
  };
}

function createUsageApiClient(options = {}) {
  const settings = options.settings || usageApiClientSettingsFromEnv(options.env);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Usage API client requires a fetch implementation.");
  }
  const baseUrl = settings.baseUrl || options.baseUrl;
  return {
    request: (path, requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        path,
        baseUrl,
        fetchImpl,
        settings,
      }),
    publicUsageSummary: (query) =>
      requestUsageApiJson({
        ...options,
        path: DEFAULT_PUBLIC_SUMMARY_PATH,
        query,
        baseUrl,
        fetchImpl,
        settings,
      }),
    adminUsageSummary: (query, requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_SUMMARY_PATH,
        query,
        baseUrl,
        fetchImpl,
        settings,
      }),
    recentUsageEvents: (query, requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_USAGE_EVENTS_PATH,
        query,
        baseUrl,
        fetchImpl,
        settings,
      }),
    budgetPolicies: (requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_BUDGET_POLICIES_PATH,
        baseUrl,
        fetchImpl,
        settings,
      }),
    budgetStatus: (requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_BUDGET_STATUS_PATH,
        baseUrl,
        fetchImpl,
        settings,
      }),
    modelPriceStatus: (requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_MODEL_PRICE_STATUS_PATH,
        baseUrl,
        fetchImpl,
        settings,
      }),
    alertStatus: (requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_ALERT_STATUS_PATH,
        baseUrl,
        fetchImpl,
        settings,
      }),
    jobEvents: (query, requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_JOB_EVENTS_PATH,
        query,
        baseUrl,
        fetchImpl,
        settings,
      }),
    runClaims: (query, requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_RUN_CLAIMS_PATH,
        query,
        baseUrl,
        fetchImpl,
        settings,
      }),
    runtimeStatus: (query, requestOptions) =>
      requestUsageApiJson({
        ...options,
        ...requestOptions,
        admin: true,
        path: DEFAULT_ADMIN_STATUS_PATH,
        query,
        baseUrl,
        fetchImpl,
        settings,
      }),
  };
}

async function requestUsageApiJson(options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const url = buildUsageApiUrl(options.baseUrl || options.settings?.baseUrl, options.path, options.query);
  const headers = {
    accept: "application/json",
    ...(options.headers || {}),
  };
  if (options.admin) {
    Object.assign(
      headers,
      createAdminUsageApiHeaders({
        method,
        url,
        actor: options.actor || options.settings?.actor,
        roles: options.roles || options.settings?.roles,
        expiresAt: options.expiresAt,
        ttlSeconds: options.ttlSeconds,
        now: options.now,
      }, options.adminAuth || options.settings?.adminAuth)
    );
  }
  const response = await fetchWithTimeout(
    options.fetchImpl || globalThis.fetch,
    url,
    { method, headers },
    options.timeoutMs ?? options.settings?.timeoutMs ?? DEFAULT_CLIENT_TIMEOUT_MS
  );
  const text = await responseText(response);
  const body = parseJsonBody(text);
  const status = Number(response?.status || 0);
  const ok = typeof response?.ok === "boolean" ? response.ok : status >= 200 && status < 300;
  if (!ok) {
    const reason = body?.error || text || `HTTP ${status}`;
    throw new Error(`Usage API request failed (${status || "unknown"}): ${redactSensitiveText(reason).slice(0, 500)}`);
  }
  return body;
}

function createAdminUsageApiHeaders(input, settings = adminAuthSettingsFromEnv()) {
  const now = input.now ? new Date(input.now) : new Date();
  const maxTtlSeconds = positiveInt(
    settings.maxTtlSeconds,
    DEFAULT_MAX_TTL_SECONDS,
    "maxTtlSeconds"
  );
  const ttlSeconds = positiveInt(
    input.ttlSeconds,
    maxTtlSeconds,
    "ttlSeconds"
  );
  const boundedTtl = Math.min(ttlSeconds, maxTtlSeconds);
  const expiresAt =
    input.expiresAt ||
    String(Math.floor(now.getTime() / 1000) + boundedTtl);
  const actor = String(input.actor || "6529.io").trim();
  const roles = csv(input.roles || settings.requiredRoles || DEFAULT_REQUIRED_ROLES);
  const signature = signAdminAuthRequest(
    {
      method: input.method || "GET",
      url: input.url,
      actor,
      roles,
      expiresAt,
    },
    settings
  );
  return {
    "x-6529-admin-user": actor,
    "x-6529-admin-roles": roles.join(","),
    "x-6529-admin-expires-at": expiresAt,
    "x-6529-admin-signature": `sha256=${signature}`,
  };
}

function buildUsageApiUrl(baseUrl, path, query = {}) {
  if (!baseUrl) {
    throw new Error("Usage API base URL is required.");
  }
  const base = new URL(String(baseUrl));
  if (!["http:", "https:"].includes(base.protocol)) {
    throw new Error("Usage API base URL must use http or https.");
  }
  const safePath = String(path || "");
  if (!safePath.startsWith("/") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(safePath)) {
    throw new Error("Usage API path must be an absolute path, not a URL.");
  }
  const url = new URL(safePath, base);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      url.searchParams.append(key, String(item));
    }
  }
  return url;
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = DEFAULT_CLIENT_TIMEOUT_MS) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Usage API client requires a fetch implementation.");
  }
  if (!timeoutMs) {
    return await fetchImpl(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function responseText(response) {
  if (!response || typeof response.text !== "function") {
    return "";
  }
  return await response.text();
}

function parseJsonBody(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function csv(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  DEFAULT_CLIENT_TIMEOUT_MS,
  buildUsageApiUrl,
  createAdminUsageApiHeaders,
  createUsageApiClient,
  requestUsageApiJson,
  usageApiClientSettingsFromEnv,
};
