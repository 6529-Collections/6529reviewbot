"use strict";

const { readEnabledBudgetPolicies } = require("./budget-ledger.cjs");
const {
  assertDataApiSettings,
  executeStatement,
  fieldValue,
  longParam,
  nullableNumber,
  stringParam,
} = require("./data-api.cjs");
const { usageApiSettingsFromEnv } = require("./usage-api.cjs");
const { quoteIdent, usageLedgerSettingsFromEnv } = require("./usage-ledger.cjs");

function usageApiLedgerLoadersFromEnv(env = process.env) {
  return createUsageApiLedgerLoaders({
    ledgerSettings: usageLedgerSettingsFromEnv(env),
    apiSettings: usageApiSettingsFromEnv(env),
  });
}

function createUsageApiLedgerLoaders(options = {}) {
  const ledgerSettings = options.ledgerSettings || usageLedgerSettingsFromEnv();
  const apiSettings = options.apiSettings || usageApiSettingsFromEnv();
  return {
    loadUsageEvents: async ({ range, visibility }) => ({
      events: readUsageEvents(ledgerSettings, { range, visibility, apiSettings }),
    }),
    loadBudgetPolicies: async () => ({
      policies: readEnabledBudgetPolicies(ledgerSettings),
    }),
    loadJobEvents: async ({ query }) => ({
      events: readJobEvents(ledgerSettings, { query }),
    }),
  };
}

function readUsageEvents(settings, options = {}) {
  assertDataApiSettings(settings, "Usage API ledger");
  const apiSettings = options.apiSettings || usageApiSettingsFromEnv();
  const range = options.range || {};
  assertUsageRange(range);
  const query = buildUsageEventsQuery(settings.schema, range, apiSettings.maxEvents);
  const response = executeStatement(settings, query.sql, query.parameters, {
    tempPrefix: "6529-usage-api-",
    maxBuffer: 32 * 1024 * 1024,
  });
  return (response.records || []).map((record) =>
    usageRecordToEvent(record, {
      visibility: options.visibility || "public",
      apiSettings,
    })
  );
}

function buildUsageEventsQuery(schema, range = {}, limit = 5000) {
  assertUsageRange(range);
  return {
    sql: `
select
  created_at::text,
  repo_full_name,
  pr_number,
  pr_author,
  pr_head_sha,
  workflow_run_id,
  workflow_job,
  review_kind,
  provider,
  model,
  lane,
  input_tokens,
  cached_input_tokens,
  output_tokens,
  reasoning_tokens,
  total_tokens,
  estimated_cost_usd::text,
  actual_cost_usd::text,
  currency,
  budget_skipped,
  metadata::text
from ${quoteIdent(schema)}.ai_review_usage_events
where created_at >= cast(:from_ts as timestamptz)
  and created_at < cast(:to_ts as timestamptz)
order by created_at desc
limit :limit
`,
    parameters: [
      stringParam("from_ts", range.from),
      stringParam("to_ts", range.to),
      longParam("limit", limit),
    ],
  };
}

function readJobEvents(settings, options = {}) {
  assertDataApiSettings(settings, "Job events API ledger");
  const query = buildJobEventsQuery(settings.schema, options.query || {});
  const response = executeStatement(settings, query.sql, query.parameters, {
    tempPrefix: "6529-job-events-api-",
    maxBuffer: 16 * 1024 * 1024,
  });
  return (response.records || []).map(jobEventRecordToEvent);
}

function buildJobEventsQuery(schema, options = {}) {
  const limit = positiveLimit(options.limit ?? 50);
  const status = String(options.status || "").trim();
  const where = status ? "\nwhere status = :status" : "";
  const parameters = status ? [stringParam("status", status)] : [];
  parameters.push(longParam("limit", limit));
  return {
    sql: `
select
  id,
  created_at::text,
  job_id,
  status,
  stage,
  repo_full_name,
  pr_number,
  pr_author,
  pr_head_sha,
  delivery_id,
  requestor,
  review_kind,
  provider,
  model,
  lane,
  adapter,
  accepted,
  reason,
  exit_code,
  metadata::text
from ${quoteIdent(schema)}.ai_review_job_events${where}
order by created_at desc, id desc
limit :limit
`,
    parameters,
  };
}

function assertUsageRange(range) {
  if (!range.from || !range.to) {
    throw new Error("Usage API ledger reads require bounded range.from and range.to values.");
  }
}

function jobEventRecordToEvent(record) {
  return {
    eventId: nullableNumber(fieldValue(record[0])),
    createdAt: fieldValue(record[1]),
    jobId: fieldValue(record[2]),
    status: fieldValue(record[3]),
    stage: fieldValue(record[4]),
    repoFullName: fieldValue(record[5]),
    prNumber: nullableNumber(fieldValue(record[6])),
    prAuthor: fieldValue(record[7]),
    prHeadSha: fieldValue(record[8]),
    deliveryId: fieldValue(record[9]),
    requestor: fieldValue(record[10]),
    reviewKind: fieldValue(record[11]),
    provider: fieldValue(record[12]),
    model: fieldValue(record[13]),
    lane: fieldValue(record[14]),
    adapter: fieldValue(record[15]),
    accepted: nullableBoolean(fieldValue(record[16])),
    reason: fieldValue(record[17]),
    exitCode: nullableNumber(fieldValue(record[18])),
    metadata: safeJson(fieldValue(record[19])),
  };
}

function usageRecordToEvent(record, options = {}) {
  const repoFullName = fieldValue(record[1]) || "";
  const visibility = options.visibility || "public";
  const apiSettings = options.apiSettings || usageApiSettingsFromEnv();
  return {
    createdAt: fieldValue(record[0]),
    repoFullName,
    repoPrivate: visibility === "public" ? !isPublicUsageRepo(repoFullName, apiSettings) : false,
    prNumber: nullableNumber(fieldValue(record[2])),
    prAuthor: fieldValue(record[3]),
    prHeadSha: fieldValue(record[4]),
    workflowRunId: fieldValue(record[5]),
    workflowJob: fieldValue(record[6]),
    reviewKind: fieldValue(record[7]),
    provider: fieldValue(record[8]),
    model: fieldValue(record[9]),
    lane: fieldValue(record[10]),
    inputTokens: nullableNumber(fieldValue(record[11])) || 0,
    cachedInputTokens: nullableNumber(fieldValue(record[12])) || 0,
    outputTokens: nullableNumber(fieldValue(record[13])) || 0,
    reasoningTokens: nullableNumber(fieldValue(record[14])) || 0,
    totalTokens: nullableNumber(fieldValue(record[15])) || 0,
    estimatedCostUsd: nullableNumber(fieldValue(record[16])),
    actualCostUsd: nullableNumber(fieldValue(record[17])),
    currency: fieldValue(record[18]) || "USD",
    budgetSkipped: Boolean(fieldValue(record[19])),
    metadata: safeJson(fieldValue(record[20])),
  };
}

function positiveLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Job event query limit must be a positive integer.");
  }
  return parsed;
}

function nullableBoolean(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return Boolean(value);
}

function isPublicUsageRepo(repoFullName, apiSettings = usageApiSettingsFromEnv()) {
  const repo = String(repoFullName || "").toLowerCase();
  if (!repo.includes("/")) {
    return false;
  }
  const publicRepos = new Set((apiSettings.publicRepos || []).map((item) => item.toLowerCase()));
  if (publicRepos.has(repo)) {
    return true;
  }
  const org = repo.split("/")[0];
  const publicOrganizations = new Set(
    (apiSettings.publicOrganizations || []).map((item) => item.toLowerCase())
  );
  return publicOrganizations.has(org);
}

function safeJson(value) {
  if (!value) {
    return {};
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

module.exports = {
  buildJobEventsQuery,
  buildUsageEventsQuery,
  createUsageApiLedgerLoaders,
  isPublicUsageRepo,
  jobEventRecordToEvent,
  readJobEvents,
  readUsageEvents,
  assertUsageRange,
  usageApiLedgerLoadersFromEnv,
  usageRecordToEvent,
};
