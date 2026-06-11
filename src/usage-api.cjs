"use strict";

const DEFAULT_PUBLIC_SUMMARY_PATH = "/api/public/usage/summary";
const DEFAULT_ADMIN_SUMMARY_PATH = "/api/admin/usage/summary";
const DEFAULT_ADMIN_BUDGET_POLICIES_PATH = "/api/admin/budget/policies";
const DEFAULT_DAYS = 30;
const DEFAULT_MAX_DAYS = 365;
const DEFAULT_MAX_ITEMS = 50;

function usageApiSettingsFromEnv(env = process.env) {
  return {
    publicEnabled: parseBool(env.REVIEWBOT_USAGE_API_PUBLIC_ENABLED || "true"),
    adminEnabled: parseBool(env.REVIEWBOT_USAGE_API_ADMIN_ENABLED || "true"),
    publicSummaryPath: env.REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH || DEFAULT_PUBLIC_SUMMARY_PATH,
    adminSummaryPath: env.REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH || DEFAULT_ADMIN_SUMMARY_PATH,
    adminBudgetPoliciesPath:
      env.REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH || DEFAULT_ADMIN_BUDGET_POLICIES_PATH,
    defaultDays: positiveIntEnv(env.REVIEWBOT_USAGE_API_DEFAULT_DAYS, DEFAULT_DAYS, "REVIEWBOT_USAGE_API_DEFAULT_DAYS"),
    maxDays: positiveIntEnv(env.REVIEWBOT_USAGE_API_MAX_DAYS, DEFAULT_MAX_DAYS, "REVIEWBOT_USAGE_API_MAX_DAYS"),
    maxItems: positiveIntEnv(env.REVIEWBOT_USAGE_API_MAX_ITEMS, DEFAULT_MAX_ITEMS, "REVIEWBOT_USAGE_API_MAX_ITEMS"),
    maxEvents: positiveIntEnv(env.REVIEWBOT_USAGE_API_MAX_EVENTS, 5000, "REVIEWBOT_USAGE_API_MAX_EVENTS"),
    publicRepos: csvList(env.REVIEWBOT_USAGE_API_PUBLIC_REPOS || ""),
    publicOrganizations: csvList(env.REVIEWBOT_USAGE_API_PUBLIC_ORGS || ""),
  };
}

function isUsageApiPath(pathname, settings = usageApiSettingsFromEnv()) {
  return [
    settings.publicSummaryPath,
    settings.adminSummaryPath,
    settings.adminBudgetPoliciesPath,
  ].includes(pathname);
}

async function handleUsageApiRequest(request, options = {}) {
  const settings = options.settings || usageApiSettingsFromEnv();
  if (request.method !== "GET") {
    return { statusCode: 405, body: { ok: false, error: "Method not allowed." } };
  }

  const route = usageApiRoute(request.url.pathname, settings);
  if (!route) {
    return { statusCode: 404, body: { ok: false, error: "Not found." } };
  }

  if (route.visibility === "public" && !settings.publicEnabled) {
    return { statusCode: 404, body: { ok: false, error: "Not found." } };
  }

  if (route.visibility === "admin") {
    if (!settings.adminEnabled) {
      return { statusCode: 404, body: { ok: false, error: "Not found." } };
    }
    const authorization = await (options.authorizeAdmin || defaultAuthorizeAdmin)(request);
    if (!authorization.allowed) {
      return {
        statusCode: authorization.statusCode || 403,
        body: { ok: false, error: authorization.reason || "Admin authorization required." },
      };
    }
  }

  if (route.kind === "budget_policies") {
    const result = await (options.loadBudgetPolicies || defaultLoadBudgetPolicies)({ request, settings });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Budget policies are unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "budget_policies",
        policies: (result.policies || []).map(publicBudgetPolicy),
      },
    };
  }

  const range = usageRangeFromRequest(request, settings, options.now || new Date());
  const result = await (options.loadUsageEvents || defaultLoadUsageEvents)({
    request,
    settings,
    range,
    visibility: route.visibility,
  });
  if (result.unavailable) {
    return unavailableResponse(result.reason || "Usage events are unavailable.");
  }

  const summary = summarizeUsageEvents(result.events || [], {
    range,
    visibility: route.visibility,
    maxItems: settings.maxItems,
  });
  return {
    statusCode: 200,
    body: {
      ok: true,
      visibility: route.visibility,
      kind: "usage_summary",
      ...summary,
    },
  };
}

function usageApiRoute(pathname, settings) {
  if (pathname === settings.publicSummaryPath) {
    return { visibility: "public", kind: "usage_summary" };
  }
  if (pathname === settings.adminSummaryPath) {
    return { visibility: "admin", kind: "usage_summary" };
  }
  if (pathname === settings.adminBudgetPoliciesPath) {
    return { visibility: "admin", kind: "budget_policies" };
  }
  return null;
}

function usageRangeFromRequest(request, settings, now) {
  const requestedDays = request.url.searchParams.get("days");
  let days;
  try {
    days = requestedDays
      ? positiveIntEnv(requestedDays, settings.defaultDays, "days")
      : settings.defaultDays;
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
  if (days > settings.maxDays) {
    const error = new Error(`days must be <= ${settings.maxDays}.`);
    error.statusCode = 400;
    throw error;
  }
  const to = new Date(now);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return {
    days,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function summarizeUsageEvents(events, options = {}) {
  const visibility = options.visibility || "public";
  const range = options.range || {};
  const maxItems = options.maxItems || DEFAULT_MAX_ITEMS;
  const normalized = events.map(normalizeUsageEvent);
  const totals = {
    reviewRuns: normalized.length,
    costUsd: roundUsd(sum(normalized, (event) => event.costUsd)),
    totalTokens: sum(normalized, (event) => event.totalTokens),
    budgetSkippedRuns: normalized.filter((event) => event.budgetSkipped).length,
  };

  const summary = {
    range,
    totals,
    byDay: groupedUsage(normalized, (event) => dayKey(event.createdAt))
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, maxItems),
    byRepo: sortedGroups(normalized, (event) => repoKey(event, visibility), maxItems),
    byProviderModel: sortedGroups(
      normalized,
      (event) => `${event.provider || "unknown"}:${event.model || "unknown"}`,
      maxItems
    ),
    byReviewKind: sortedGroups(normalized, (event) => event.reviewKind || "unknown", maxItems),
  };

  if (visibility === "admin") {
    summary.byRequestor = sortedGroups(normalized, (event) => event.requestor || "unknown", maxItems);
    summary.byPr = sortedGroups(normalized, (event) => prKey(event), maxItems);
  }

  return summary;
}

function normalizeUsageEvent(event = {}) {
  const metadata = normalizeMetadata(event.metadata);
  const actualCostUsd = nullableNumber(event.actualCostUsd ?? event.actual_cost_usd);
  const estimatedCostUsd = nullableNumber(event.estimatedCostUsd ?? event.estimated_cost_usd);
  const inputTokens = wholeNumber(event.inputTokens ?? event.input_tokens);
  const cachedInputTokens = wholeNumber(event.cachedInputTokens ?? event.cached_input_tokens);
  const outputTokens = wholeNumber(event.outputTokens ?? event.output_tokens);
  const reasoningTokens = wholeNumber(event.reasoningTokens ?? event.reasoning_tokens);
  const totalTokens = wholeNumber(event.totalTokens ?? event.total_tokens);
  return {
    createdAt: event.createdAt || event.created_at || "",
    repoFullName: event.repoFullName || event.repo_full_name || "",
    repoPrivate: Boolean(event.repoPrivate || event.repo_private),
    prNumber: nullableNumber(event.prNumber ?? event.pr_number),
    prAuthor: event.prAuthor || event.pr_author || "",
    requestor: event.requestor || metadata.requestor || event.prAuthor || event.pr_author || "",
    reviewKind: event.reviewKind || event.review_kind || "",
    provider: event.provider || "",
    model: event.model || "",
    lane: event.lane || "",
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens: totalTokens || inputTokens + outputTokens + reasoningTokens,
    estimatedCostUsd,
    actualCostUsd,
    costUsd: actualCostUsd ?? estimatedCostUsd ?? 0,
    currency: event.currency || "USD",
    budgetSkipped: Boolean(event.budgetSkipped || event.budget_skipped),
  };
}

function publicBudgetPolicy(policy = {}) {
  return {
    scopeType: policy.scopeType || policy.scope_type || "",
    scopeValue: policy.scopeValue || policy.scope_value || "",
    dailyBudgetUsd: nullableNumber(policy.dailyBudgetUsd ?? policy.daily_budget_usd),
    weeklyBudgetUsd: nullableNumber(policy.weeklyBudgetUsd ?? policy.weekly_budget_usd),
    monthlyBudgetUsd: nullableNumber(policy.monthlyBudgetUsd ?? policy.monthly_budget_usd),
    enabled: policy.enabled !== false,
  };
}

function sortedGroups(events, keyFn, maxItems) {
  return groupedUsage(events, keyFn)
    .sort((a, b) => b.costUsd - a.costUsd || b.reviewRuns - a.reviewRuns || a.key.localeCompare(b.key))
    .slice(0, maxItems);
}

function groupedUsage(events, keyFn) {
  const groups = new Map();
  for (const event of events) {
    const key = keyFn(event) || "unknown";
    const current =
      groups.get(key) || {
        key,
        reviewRuns: 0,
        costUsd: 0,
        totalTokens: 0,
        budgetSkippedRuns: 0,
      };
    current.reviewRuns += 1;
    current.costUsd = roundUsd(current.costUsd + event.costUsd);
    current.totalTokens += event.totalTokens;
    current.budgetSkippedRuns += event.budgetSkipped ? 1 : 0;
    groups.set(key, current);
  }
  return Array.from(groups.values());
}

function dayKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toISOString().slice(0, 10);
}

function repoKey(event, visibility) {
  if (visibility !== "admin" && event.repoPrivate) {
    return "private";
  }
  return event.repoFullName || "unknown";
}

function prKey(event) {
  return event.repoFullName && event.prNumber ? `${event.repoFullName}#${event.prNumber}` : "unknown";
}

function sum(values, fn) {
  return values.reduce((total, item) => total + fn(item), 0);
}

function normalizeMetadata(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function wholeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function roundUsd(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function unavailableResponse(reason) {
  return {
    statusCode: 503,
    body: {
      ok: false,
      error: reason,
    },
  };
}

async function defaultAuthorizeAdmin() {
  return {
    allowed: false,
    statusCode: 403,
    reason: "No admin authorizer configured.",
  };
}

async function defaultLoadUsageEvents() {
  return {
    unavailable: true,
    reason: "No usage event loader configured.",
  };
}

async function defaultLoadBudgetPolicies() {
  return {
    unavailable: true,
    reason: "No budget policy loader configured.",
  };
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function csvList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveIntEnv(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

module.exports = {
  DEFAULT_ADMIN_BUDGET_POLICIES_PATH,
  DEFAULT_ADMIN_SUMMARY_PATH,
  DEFAULT_PUBLIC_SUMMARY_PATH,
  handleUsageApiRequest,
  isUsageApiPath,
  normalizeUsageEvent,
  publicBudgetPolicy,
  summarizeUsageEvents,
  usageApiSettingsFromEnv,
  usageRangeFromRequest,
};
