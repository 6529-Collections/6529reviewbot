"use strict";

const { redactSensitiveText, safeErrorLine } = require("./diagnostics.cjs");
const { normalizeLedgerMetadata } = require("./ledger-metadata.cjs");

const DEFAULT_PUBLIC_SUMMARY_PATH = "/api/public/usage/summary";
const DEFAULT_ADMIN_SUMMARY_PATH = "/api/admin/usage/summary";
const DEFAULT_ADMIN_USAGE_EVENTS_PATH = "/api/admin/usage/events/recent";
const DEFAULT_ADMIN_BUDGET_POLICIES_PATH = "/api/admin/budget/policies";
const DEFAULT_ADMIN_BUDGET_STATUS_PATH = "/api/admin/budget/status";
const DEFAULT_ADMIN_MODEL_PRICE_STATUS_PATH = "/api/admin/model-prices/status";
const DEFAULT_ADMIN_ALERT_STATUS_PATH = "/api/admin/alerts/status";
const DEFAULT_ADMIN_JOB_EVENTS_PATH = "/api/admin/jobs/recent";
const DEFAULT_ADMIN_RUN_CLAIMS_PATH = "/api/admin/run-claims/recent";
const DEFAULT_ADMIN_STATUS_PATH = "/api/admin/status";
const DEFAULT_DAYS = 30;
const DEFAULT_MAX_DAYS = 365;
const DEFAULT_MAX_ITEMS = 50;
const DEFAULT_ADMIN_TEXT_MAX_CHARS = 1000;
const MAX_STALE_MINUTES = 7 * 24 * 60;
const ACTIVE_RUN_CLAIM_STATUSES = ["claimed", "dispatching", "running"];
const ADMIN_STATUS_MAX_ARRAY_ITEMS = 100;
const ADMIN_STATUS_MAX_OBJECT_KEYS = 100;
const ADMIN_STATUS_MAX_DEPTH = 6;
const ADMIN_STATUS_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/;

function usageApiSettingsFromEnv(env = process.env) {
  return {
    publicEnabled: parseBool(env.REVIEWBOT_USAGE_API_PUBLIC_ENABLED || "true"),
    adminEnabled: parseBool(env.REVIEWBOT_USAGE_API_ADMIN_ENABLED || "true"),
    publicSummaryPath: env.REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH || DEFAULT_PUBLIC_SUMMARY_PATH,
    adminSummaryPath: env.REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH || DEFAULT_ADMIN_SUMMARY_PATH,
    adminUsageEventsPath:
      env.REVIEWBOT_USAGE_API_ADMIN_USAGE_EVENTS_PATH || DEFAULT_ADMIN_USAGE_EVENTS_PATH,
    adminBudgetPoliciesPath:
      env.REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH || DEFAULT_ADMIN_BUDGET_POLICIES_PATH,
    adminBudgetStatusPath:
      env.REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH || DEFAULT_ADMIN_BUDGET_STATUS_PATH,
    adminModelPriceStatusPath:
      env.REVIEWBOT_USAGE_API_ADMIN_MODEL_PRICE_STATUS_PATH ||
      DEFAULT_ADMIN_MODEL_PRICE_STATUS_PATH,
    adminAlertStatusPath:
      env.REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH || DEFAULT_ADMIN_ALERT_STATUS_PATH,
    adminJobEventsPath:
      env.REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH || DEFAULT_ADMIN_JOB_EVENTS_PATH,
    adminRunClaimsPath:
      env.REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH || DEFAULT_ADMIN_RUN_CLAIMS_PATH,
    adminStatusPath: env.REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH || DEFAULT_ADMIN_STATUS_PATH,
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
    settings.adminUsageEventsPath,
    settings.adminBudgetPoliciesPath,
    settings.adminBudgetStatusPath,
    settings.adminModelPriceStatusPath,
    settings.adminAlertStatusPath,
    settings.adminJobEventsPath,
    settings.adminRunClaimsPath,
    settings.adminStatusPath,
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

  if (route.kind === "budget_status") {
    const result = await (options.loadBudgetStatus || defaultLoadBudgetStatus)({ request, settings });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Budget status is unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "budget_status",
        generatedAt: new Date().toISOString(),
        policies: (result.policies || []).map(publicBudgetPolicyStatus),
      },
    };
  }

  if (route.kind === "model_price_status") {
    const result = await (options.loadModelPriceStatus || defaultLoadModelPriceStatus)({
      request,
      settings,
    });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Model price status is unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "model_price_status",
        generatedAt: new Date().toISOString(),
        status: normalizeAdminStatusObject(
          sanitizeAdminDiagnosticPayload(result.status || result.modelPriceStatus || {})
        ),
      },
    };
  }

  if (route.kind === "alert_status") {
    const result = await (options.loadAlertStatus || defaultLoadAlertStatus)({ request, settings });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Alert status is unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "alert_status",
        generatedAt: new Date().toISOString(),
        status: normalizeAdminStatusObject(
          sanitizeAdminDiagnosticPayload(result.status || result.alertStatus || {})
        ),
      },
    };
  }

  if (route.kind === "usage_events") {
    const query = usageEventsQueryFromRequest(request, settings, options.now || new Date());
    const result = await (options.loadUsageEvents || defaultLoadUsageEvents)({
      request,
      settings,
      range: query.range,
      visibility: "admin",
      query,
    });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Usage events are unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "usage_events",
        range: query.range,
        limit: query.limit,
        events: (result.events || []).map(normalizeAdminUsageEvent),
      },
    };
  }

  if (route.kind === "job_events") {
    const query = jobEventsQueryFromRequest(request, settings);
    const result = await (options.loadJobEvents || defaultLoadJobEvents)({
      request,
      settings,
      query,
    });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Job events are unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "job_events",
        limit: query.limit,
        status: query.status || null,
        events: (result.events || []).map(normalizeJobEvent),
      },
    };
  }

  if (route.kind === "run_claims") {
    const query = runClaimsQueryFromRequest(request, settings, options.now || new Date());
    const result = await (options.loadRunClaims || defaultLoadRunClaims)({
      request,
      settings,
      query,
    });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Run claims are unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "run_claims",
        limit: query.limit,
        status: query.status || null,
        active: query.active,
        staleMinutes: query.staleMinutes,
        updatedBefore: query.updatedBefore || null,
        claims: (result.claims || []).map(normalizeRunClaim),
      },
    };
  }

  if (route.kind === "runtime_status") {
    const query = adminStatusQueryFromRequest(request);
    const result = await (options.loadAdminStatus || defaultLoadAdminStatus)({
      request,
      settings,
      query,
    });
    if (result.unavailable) {
      return unavailableResponse(result.reason || "Runtime status is unavailable.");
    }
    return {
      statusCode: 200,
      body: {
        ok: true,
        visibility: "admin",
        kind: "runtime_status",
        generatedAt: new Date().toISOString(),
        profile: query.profile,
        strict: query.strict,
        preflight: normalizeAdminStatusPayload(result),
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
    publicRepos: settings.publicRepos,
    publicOrganizations: settings.publicOrganizations,
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
  if (pathname === settings.adminUsageEventsPath) {
    return { visibility: "admin", kind: "usage_events" };
  }
  if (pathname === settings.adminBudgetPoliciesPath) {
    return { visibility: "admin", kind: "budget_policies" };
  }
  if (pathname === settings.adminBudgetStatusPath) {
    return { visibility: "admin", kind: "budget_status" };
  }
  if (pathname === settings.adminModelPriceStatusPath) {
    return { visibility: "admin", kind: "model_price_status" };
  }
  if (pathname === settings.adminAlertStatusPath) {
    return { visibility: "admin", kind: "alert_status" };
  }
  if (pathname === settings.adminJobEventsPath) {
    return { visibility: "admin", kind: "job_events" };
  }
  if (pathname === settings.adminRunClaimsPath) {
    return { visibility: "admin", kind: "run_claims" };
  }
  if (pathname === settings.adminStatusPath) {
    return { visibility: "admin", kind: "runtime_status" };
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

function adminStatusQueryFromRequest(request) {
  const profile = String(request.url.searchParams.get("profile") || "server").trim();
  if (!["server", "worker"].includes(profile)) {
    const error = new Error("profile must be one of: server, worker.");
    error.statusCode = 400;
    throw error;
  }
  return {
    profile,
    strict: parseQueryBool(request.url.searchParams.get("strict")),
  };
}

function usageEventsQueryFromRequest(request, settings, now = new Date()) {
  const range = usageRangeFromRequest(request, settings, now);
  const requestedLimit = request.url.searchParams.get("limit");
  const defaultLimit = Math.min(settings.maxItems, settings.maxEvents);
  const maxLimit = settings.maxEvents;
  let limit;
  try {
    limit = requestedLimit
      ? positiveIntEnv(requestedLimit, defaultLimit, "limit")
      : defaultLimit;
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
  if (limit > maxLimit) {
    const error = new Error(`limit must be <= ${maxLimit}.`);
    error.statusCode = 400;
    throw error;
  }
  return { range, limit };
}

function jobEventsQueryFromRequest(request, settings) {
  const requestedLimit = request.url.searchParams.get("limit");
  let limit;
  try {
    limit = requestedLimit
      ? positiveIntEnv(requestedLimit, settings.maxItems, "limit")
      : settings.maxItems;
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
  if (limit > settings.maxItems) {
    const error = new Error(`limit must be <= ${settings.maxItems}.`);
    error.statusCode = 400;
    throw error;
  }
  const status = String(request.url.searchParams.get("status") || "").trim();
  if (status && !/^[A-Za-z0-9_.:-]{1,80}$/.test(status)) {
    const error = new Error("status contains unsupported characters.");
    error.statusCode = 400;
    throw error;
  }
  return { limit, status };
}

function runClaimsQueryFromRequest(request, settings, now = new Date()) {
  const requestedLimit = request.url.searchParams.get("limit");
  let limit;
  try {
    limit = requestedLimit
      ? positiveIntEnv(requestedLimit, settings.maxItems, "limit")
      : settings.maxItems;
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
  if (limit > settings.maxItems) {
    const error = new Error(`limit must be <= ${settings.maxItems}.`);
    error.statusCode = 400;
    throw error;
  }

  const status = String(request.url.searchParams.get("status") || "").trim();
  if (status && !/^[A-Za-z0-9_.:-]{1,80}$/.test(status)) {
    const error = new Error("status contains unsupported characters.");
    error.statusCode = 400;
    throw error;
  }

  const staleMinutesParam = request.url.searchParams.get("staleMinutes");
  let staleMinutes = null;
  if (staleMinutesParam !== null && staleMinutesParam !== "") {
    try {
      staleMinutes = positiveIntEnv(staleMinutesParam, null, "staleMinutes");
    } catch (error) {
      error.statusCode = 400;
      throw error;
    }
    if (staleMinutes > MAX_STALE_MINUTES) {
      const error = new Error(`staleMinutes must be <= ${MAX_STALE_MINUTES}.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const explicitActive = parseQueryBool(request.url.searchParams.get("active"));
  const active = explicitActive || (!status && staleMinutes !== null);
  let statuses = status ? [status] : [];
  if (active) {
    statuses = statuses.length
      ? statuses.filter((item) => ACTIVE_RUN_CLAIM_STATUSES.includes(item))
      : ACTIVE_RUN_CLAIM_STATUSES;
  }
  if (active && status && statuses.length === 0) {
    const error = new Error("status must be an active status when active=true.");
    error.statusCode = 400;
    throw error;
  }
  const onlyUnexpired =
    active || (statuses.length === 1 && ACTIVE_RUN_CLAIM_STATUSES.includes(statuses[0]));
  let updatedBefore = null;
  if (staleMinutes !== null) {
    const threshold = new Date(now);
    threshold.setUTCMinutes(threshold.getUTCMinutes() - staleMinutes);
    updatedBefore = threshold.toISOString();
  }

  return {
    limit,
    status,
    statuses,
    active,
    staleMinutes,
    updatedBefore,
    onlyUnexpired,
  };
}

function parseQueryBool(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
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
    byRepo: sortedGroups(normalized, (event) => repoKey(event, visibility, options), maxItems),
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

function normalizeJobEvent(event = {}) {
  const metadata = normalizeJobMetadata(event.metadata);
  return {
    eventId: nullableNumber(event.eventId ?? event.id),
    createdAt: adminText(event.createdAt || event.created_at || ""),
    jobId: adminText(event.jobId || event.job_id || ""),
    status: adminText(event.status || ""),
    stage: adminText(event.stage || ""),
    repoFullName: adminText(event.repoFullName || event.repo_full_name || ""),
    prNumber: nullableNumber(event.prNumber ?? event.pr_number),
    prAuthor: adminText(event.prAuthor || event.pr_author || ""),
    prHeadSha: adminText(event.prHeadSha || event.pr_head_sha || ""),
    deliveryId: adminText(event.deliveryId || event.delivery_id || ""),
    requestor: adminText(event.requestor || ""),
    reviewKind: adminText(event.reviewKind || event.review_kind || ""),
    provider: adminText(event.provider || ""),
    model: adminText(event.model || ""),
    lane: adminText(event.lane || ""),
    adapter: adminText(event.adapter || ""),
    accepted: nullableBoolean(event.accepted),
    reason: adminText(event.reason || ""),
    exitCode: nullableNumber(event.exitCode ?? event.exit_code),
    metadata,
  };
}

function normalizeAdminUsageEvent(event = {}) {
  const normalized = normalizeUsageEvent(event);
  return {
    createdAt: adminText(normalized.createdAt),
    repoFullName: adminText(normalized.repoFullName),
    prNumber: normalized.prNumber,
    prAuthor: adminText(normalized.prAuthor),
    prHeadSha: adminText(normalized.prHeadSha || event.prHeadSha || event.pr_head_sha || ""),
    workflowRunId: adminText(normalized.workflowRunId || event.workflowRunId || event.workflow_run_id || ""),
    workflowJob: adminText(normalized.workflowJob || event.workflowJob || event.workflow_job || ""),
    requestor: adminText(normalized.requestor),
    reviewKind: adminText(normalized.reviewKind),
    provider: adminText(normalized.provider),
    model: adminText(normalized.model),
    lane: adminText(normalized.lane),
    inputTokens: normalized.inputTokens,
    cachedInputTokens: normalized.cachedInputTokens,
    outputTokens: normalized.outputTokens,
    reasoningTokens: normalized.reasoningTokens,
    totalTokens: normalized.totalTokens,
    estimatedCostUsd: normalized.estimatedCostUsd,
    actualCostUsd: normalized.actualCostUsd,
    costUsd: normalized.costUsd,
    currency: adminText(normalized.currency),
    budgetSkipped: normalized.budgetSkipped,
    metadata: normalizeJobMetadata(normalized.metadata),
  };
}

function normalizeRunClaim(claim = {}) {
  return {
    claimId: nullableNumber(claim.claimId ?? claim.id),
    createdAt: adminText(claim.createdAt || claim.created_at || ""),
    updatedAt: adminText(claim.updatedAt || claim.updated_at || ""),
    completedAt: adminText(claim.completedAt || claim.completed_at || ""),
    expiresAt: adminText(claim.expiresAt || claim.expires_at || ""),
    runKey: adminText(claim.runKey || claim.run_key || ""),
    jobId: adminText(claim.jobId || claim.job_id || ""),
    status: adminText(claim.status || ""),
    repoFullName: adminText(claim.repoFullName || claim.repo_full_name || ""),
    org: adminText(claim.org || ""),
    prNumber: nullableNumber(claim.prNumber ?? claim.pr_number),
    requestor: adminText(claim.requestor || ""),
    prHeadSha: adminText(claim.prHeadSha || claim.pr_head_sha || ""),
    reviewKind: adminText(claim.reviewKind || claim.review_kind || ""),
    provider: adminText(claim.provider || ""),
    model: adminText(claim.model || ""),
    lane: adminText(claim.lane || ""),
    deliveryId: adminText(claim.deliveryId || claim.delivery_id || ""),
    commandName: adminText(claim.commandName || claim.command_name || ""),
    metadata: normalizeJobMetadata(claim.metadata),
  };
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
    prHeadSha: event.prHeadSha || event.pr_head_sha || "",
    workflowRunId: event.workflowRunId || event.workflow_run_id || "",
    workflowJob: event.workflowJob || event.workflow_job || "",
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
    metadata,
  };
}

function normalizeJobMetadata(value) {
  const metadata = normalizeMetadata(value);
  return normalizeLedgerMetadata(metadata, {
    includeNull: true,
    maxStringChars: DEFAULT_ADMIN_TEXT_MAX_CHARS,
  });
}

function publicBudgetPolicy(policy = {}) {
  return {
    scopeType: adminText(policy.scopeType || policy.scope_type || "", 80),
    scopeValue: adminText(policy.scopeValue || policy.scope_value || ""),
    dailyBudgetUsd: nullableNumber(policy.dailyBudgetUsd ?? policy.daily_budget_usd),
    weeklyBudgetUsd: nullableNumber(policy.weeklyBudgetUsd ?? policy.weekly_budget_usd),
    monthlyBudgetUsd: nullableNumber(policy.monthlyBudgetUsd ?? policy.monthly_budget_usd),
    enabled: policy.enabled !== false,
  };
}

function publicBudgetPolicyStatus(policy = {}) {
  const base = publicBudgetPolicy(policy);
  const currentSpend = policy.currentSpend || policy.current_spend || policy.spend || {};
  return {
    ...base,
    utilization: {
      daily: budgetPeriodStatus(
        base.dailyBudgetUsd,
        currentSpend.dailyUsd ?? currentSpend.daily_usd
      ),
      weekly: budgetPeriodStatus(
        base.weeklyBudgetUsd,
        currentSpend.weeklyUsd ?? currentSpend.weekly_usd
      ),
      monthly: budgetPeriodStatus(
        base.monthlyBudgetUsd,
        currentSpend.monthlyUsd ?? currentSpend.monthly_usd
      ),
    },
  };
}

function budgetPeriodStatus(budgetUsd, usedUsd) {
  const budget = nullableNumber(budgetUsd);
  const used = nullableNumber(usedUsd) ?? 0;
  return {
    budgetUsd: budget,
    usedUsd: roundUsd(used),
    remainingUsd: budget === null ? null : roundUsd(budget - used),
    percentUsed: budget && budget > 0 ? roundPercent((used / budget) * 100) : null,
    overBudget: budget !== null && used > budget,
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

function repoKey(event, visibility, options = {}) {
  const repo = event.repoFullName || "";
  if (visibility === "admin") {
    return repo || "unknown";
  }
  if (!repo) {
    return "unknown";
  }
  if (event.repoPrivate) {
    return "private";
  }
  return isPublicUsageRepo(repo, options) ? repo : "private";
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

function nullableBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return Boolean(value);
}

function wholeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function roundUsd(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function roundPercent(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function unavailableResponse(reason) {
  return {
    statusCode: 503,
    body: {
      ok: false,
      error: safeErrorLine(reason || "Unavailable."),
    },
  };
}

function normalizeAdminStatusPayload(result = {}) {
  const sanitized = sanitizeAdminDiagnosticPayload(result.preflight ?? result.status ?? null);
  return normalizeAdminStatusObject(sanitized);
}

function normalizeAdminStatusObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function sanitizeAdminDiagnosticPayload(value, depth = ADMIN_STATUS_MAX_DEPTH) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return adminText(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (depth <= 0) {
    return "[nested value omitted]";
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, ADMIN_STATUS_MAX_ARRAY_ITEMS)
      .map((item) => sanitizeAdminDiagnosticPayload(item, depth - 1));
  }
  if (typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value).slice(0, ADMIN_STATUS_MAX_OBJECT_KEYS)) {
      if (!isSafeAdminKey(key, ADMIN_STATUS_KEY_PATTERN)) {
        continue;
      }
      result[key] = sanitizeAdminDiagnosticPayload(item, depth - 1);
    }
    return result;
  }
  return "";
}

function adminText(value, maxChars = DEFAULT_ADMIN_TEXT_MAX_CHARS) {
  return redactSensitiveText(value).slice(0, maxChars);
}

function isSafeAdminKey(key, pattern) {
  const text = String(key || "");
  return pattern.test(text) && redactSensitiveText(text) === text;
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

async function defaultLoadBudgetStatus() {
  return {
    unavailable: true,
    reason: "No budget status loader configured.",
  };
}

async function defaultLoadModelPriceStatus() {
  return {
    unavailable: true,
    reason: "No model price status loader configured.",
  };
}

async function defaultLoadAlertStatus() {
  return {
    unavailable: true,
    reason: "No alert status loader configured.",
  };
}

async function defaultLoadJobEvents() {
  return {
    unavailable: true,
    reason: "No job event loader configured.",
  };
}

async function defaultLoadRunClaims() {
  return {
    unavailable: true,
    reason: "No run claims loader configured.",
  };
}

async function defaultLoadAdminStatus() {
  return {
    unavailable: true,
    reason: "No runtime status loader configured.",
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

function isPublicUsageRepo(repoFullName, settings = usageApiSettingsFromEnv()) {
  const normalized = String(repoFullName || "").trim().toLowerCase();
  const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  const [org, repoName] = parts;
  const repo = `${org}/${repoName}`;
  const publicRepos = new Set(
    (settings.publicRepos || []).map((item) => String(item || "").toLowerCase())
  );
  if (publicRepos.has(repo)) {
    return true;
  }
  const publicOrganizations = new Set(
    (settings.publicOrganizations || []).map((item) => String(item || "").toLowerCase())
  );
  return publicOrganizations.has(org);
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
  DEFAULT_ADMIN_ALERT_STATUS_PATH,
  DEFAULT_ADMIN_BUDGET_STATUS_PATH,
  DEFAULT_ADMIN_BUDGET_POLICIES_PATH,
  DEFAULT_ADMIN_MODEL_PRICE_STATUS_PATH,
  DEFAULT_ADMIN_JOB_EVENTS_PATH,
  DEFAULT_ADMIN_RUN_CLAIMS_PATH,
  DEFAULT_ADMIN_STATUS_PATH,
  DEFAULT_ADMIN_SUMMARY_PATH,
  DEFAULT_ADMIN_USAGE_EVENTS_PATH,
  DEFAULT_PUBLIC_SUMMARY_PATH,
  adminStatusQueryFromRequest,
  handleUsageApiRequest,
  isPublicUsageRepo,
  isUsageApiPath,
  jobEventsQueryFromRequest,
  normalizeAdminUsageEvent,
  normalizeJobEvent,
  normalizeRunClaim,
  normalizeUsageEvent,
  publicBudgetPolicy,
  publicBudgetPolicyStatus,
  runClaimsQueryFromRequest,
  sanitizeAdminDiagnosticPayload,
  summarizeUsageEvents,
  usageApiSettingsFromEnv,
  usageEventsQueryFromRequest,
  usageRangeFromRequest,
};
