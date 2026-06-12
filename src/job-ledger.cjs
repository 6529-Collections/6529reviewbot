"use strict";

const { executeStatement, stringParam, longParam } = require("./data-api.cjs");
const { redactSensitiveText, safeErrorLine } = require("./diagnostics.cjs");
const { quoteIdent, usageLedgerSettingsFromEnv } = require("./usage-ledger.cjs");

function jobLedgerSettingsFromEnv(env = process.env) {
  const usageSettings = usageLedgerSettingsFromEnv(env);
  return {
    enabled: parseBool(env.REVIEWBOT_JOB_LEDGER_ENABLED || "false"),
    failClosed: parseBool(env.REVIEWBOT_JOB_LEDGER_FAIL_CLOSED || "false"),
    region: env.REVIEWBOT_JOB_LEDGER_AWS_REGION || usageSettings.region,
    resourceArn: env.REVIEWBOT_JOB_LEDGER_DB_RESOURCE_ARN || usageSettings.resourceArn,
    secretArn: env.REVIEWBOT_JOB_LEDGER_DB_SECRET_ARN || usageSettings.secretArn,
    database: env.REVIEWBOT_JOB_LEDGER_DB_NAME || usageSettings.database,
    schema: env.REVIEWBOT_JOB_LEDGER_DB_SCHEMA || usageSettings.schema,
  };
}

function writeJobEvent(settings, event, options = {}) {
  if (!settings.enabled) {
    return { skipped: true };
  }

  try {
    assertJobLedgerConfigured(settings);
    const query = buildJobEventInsert(settings.schema, normalizeJobLedgerEvent(event));
    const execute = options.executeStatement || executeStatement;
    execute(settings, query.sql, query.parameters, {
      tempPrefix: "6529-job-ledger-",
      maxBuffer: 16 * 1024 * 1024,
    });
    return { skipped: false };
  } catch (error) {
    if (settings.failClosed) {
      throw error;
    }
    const log = options.log || console.warn;
    log(`job ledger write failed: ${safeError(error)}`);
    return { skipped: false, error };
  }
}

async function writeJobEvents(settings, events, options = {}) {
  const results = [];
  for (const event of events || []) {
    results.push(await writeJobEvent(settings, event, options));
  }
  return results;
}

function buildJobEventInsert(schema, event) {
  assertJobLedgerEvent(event);
  return {
    sql: `
insert into ${quoteIdent(schema)}.ai_review_job_events (
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
  metadata
) values (
  :job_id,
  :status,
  :stage,
  :repo_full_name,
  :pr_number,
  :pr_author,
  :pr_head_sha,
  :delivery_id,
  :requestor,
  :review_kind,
  :provider,
  :model,
  :lane,
  :adapter,
  :accepted,
  :reason,
  :exit_code,
  cast(:metadata as jsonb)
)`,
    parameters: [
      stringParam("job_id", event.jobId),
      stringParam("status", event.status),
      stringParam("stage", event.stage),
      stringParam("repo_full_name", event.repoFullName),
      longOrNullParam("pr_number", event.prNumber),
      stringOrNullParam("pr_author", event.prAuthor),
      stringOrNullParam("pr_head_sha", event.prHeadSha),
      stringOrNullParam("delivery_id", event.deliveryId),
      stringOrNullParam("requestor", event.requestor),
      stringParam("review_kind", event.reviewKind),
      stringParam("provider", event.provider),
      stringParam("model", event.model),
      stringOrNullParam("lane", event.lane),
      stringOrNullParam("adapter", event.adapter),
      boolOrNullParam("accepted", event.accepted),
      stringOrNullParam("reason", event.reason),
      longOrNullParam("exit_code", event.exitCode),
      stringParam("metadata", JSON.stringify(event.metadata || {})),
    ],
  };
}

function normalizeJobLedgerEvent(event = {}) {
  return {
    jobId: stringValue(event.jobId),
    status: stringValue(event.status),
    stage: stringValue(event.stage),
    repoFullName: stringValue(event.repoFullName),
    prNumber: nullableInteger(event.prNumber),
    prAuthor: stringValue(event.prAuthor),
    prHeadSha: stringValue(event.prHeadSha),
    deliveryId: stringValue(event.deliveryId),
    requestor: stringValue(event.requestor),
    reviewKind: stringValue(event.reviewKind),
    provider: stringValue(event.provider),
    model: stringValue(event.model),
    lane: stringValue(event.lane),
    adapter: stringValue(event.adapter),
    accepted: nullableBool(event.accepted),
    reason: truncateText(redactSensitiveText(event.reason), 1000),
    exitCode: nullableInteger(event.exitCode),
    metadata: normalizeMetadata(event.metadata),
  };
}

function jobEventFromReviewJob(job, status, extra = {}) {
  const budget = job.budget || {};
  const runControl = job.runControl || {};
  return normalizeJobLedgerEvent({
    jobId: job.id,
    status,
    stage: extra.stage || "unknown",
    repoFullName: job.repository?.fullName || "",
    prNumber: job.prNumber,
    prAuthor: job.prAuthor,
    prHeadSha: job.headSha,
    deliveryId: job.deliveryId,
    requestor: job.requestor,
    reviewKind: job.reviewKind,
    provider: job.provider,
    model: job.model,
    lane: job.lane,
    adapter: extra.adapter,
    accepted: extra.accepted,
    reason: extra.reason || budget.reason || "",
    exitCode: extra.exitCode,
    metadata: {
      budgetCode: budget.code || "",
      budgetStatus: budget.status || "",
      runControlCode: runControl.code || "",
      runControlStatus: runControl.status || "",
      runControlRunKey: runControl.runKey || job.runKey || "",
      runControlDuplicateOf: runControl.duplicate?.jobId || "",
      eventName: job.eventName || "",
      eventAction: job.eventAction || "",
      eventKind: job.eventKind || "",
      trigger: job.trigger || "",
      actor: job.actor || "",
      commentId: job.commentId || null,
      commandName: job.commandName || "",
      workflow: extra.workflow || "",
      workflowRepo: extra.workflowRepo || "",
      workflowRef: extra.workflowRef || "",
      queueStatus: extra.queueStatus || "",
      queueJobCount: extra.queueJobCount || null,
      ...normalizeMetadata(extra.metadata),
    },
  });
}

function dispatchJobEventsFromQueueResult(jobs, queueResult = {}) {
  const perJobResults = new Map();
  for (const result of queueResult.jobs || []) {
    if (result.jobId) {
      perJobResults.set(result.jobId, result);
    }
  }

  return (jobs || []).map((job) => {
    const result = perJobResults.get(job.id);
    const hasPerJobResult = Boolean(result);
    const accepted = hasPerJobResult ? Boolean(result.accepted) : queueResult.accepted !== false;
    return jobEventFromReviewJob(
      job,
      accepted ? "dispatch_accepted" : "dispatch_failed",
      {
        stage: "dispatch",
        adapter: result?.adapter || queueResult.adapter || "",
        accepted,
        reason: result?.reason || queueResult.reason || "",
        exitCode: result?.exitCode,
        workflow: result?.workflow || queueResult.workflow || "",
        workflowRepo: result?.workflowRepo || queueResult.workflowRepo || "",
        workflowRef: result?.workflowRef || queueResult.workflowRef || "",
        queueStatus: queueResult.status || "",
        queueJobCount: queueResult.jobCount,
      }
    );
  });
}

function assertJobLedgerConfigured(settings) {
  if (!settings.enabled) {
    return;
  }
  const missing = [];
  for (const key of ["region", "resourceArn", "secretArn", "database", "schema"]) {
    if (!settings[key]) {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(`Job ledger is enabled but missing settings: ${missing.join(", ")}`);
  }
}

function assertJobLedgerEvent(event = {}) {
  const missing = [];
  for (const key of [
    "jobId",
    "status",
    "stage",
    "repoFullName",
    "reviewKind",
    "provider",
    "model",
  ]) {
    if (!event[key]) {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(`Job ledger event is missing required fields: ${missing.join(", ")}`);
  }
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function stringValue(value) {
  return value === undefined || value === null ? "" : String(value);
}

function nullableInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function nullableBool(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return Boolean(value);
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_.-]{1,80}$/.test(key)) {
      continue;
    }
    if (item === undefined) {
      continue;
    }
    if (item === null || ["string", "number", "boolean"].includes(typeof item)) {
      result[key] =
        typeof item === "string" ? truncateText(redactSensitiveText(item), 1000) : item;
    }
  }
  return result;
}

function truncateText(value, maxChars) {
  const text = stringValue(value);
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function stringOrNullParam(name, value) {
  return value === "" || value === null || value === undefined
    ? nullParam(name)
    : stringParam(name, value);
}

function longOrNullParam(name, value) {
  return value === null || value === undefined || value === ""
    ? nullParam(name)
    : longParam(name, value);
}

function boolOrNullParam(name, value) {
  return value === null || value === undefined
    ? nullParam(name)
    : { name, value: { booleanValue: Boolean(value) } };
}

function nullParam(name) {
  return { name, value: { isNull: true } };
}

function safeError(error) {
  return safeErrorLine(error);
}

module.exports = {
  assertJobLedgerConfigured,
  assertJobLedgerEvent,
  buildJobEventInsert,
  dispatchJobEventsFromQueueResult,
  jobEventFromReviewJob,
  jobLedgerSettingsFromEnv,
  normalizeJobLedgerEvent,
  writeJobEvent,
  writeJobEvents,
};
