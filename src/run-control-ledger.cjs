"use strict";

const {
  RUN_CONTROL_SCOPES,
  evaluateRunControl,
  runControlPolicyFromEnv,
  runControlScopeKey,
  runControlScopeValue,
  runControlSubjectFromJob,
} = require("./run-control.cjs");
const {
  assertDataApiSettings,
  executeStatement,
  fieldValue,
  longParam,
  stringParam,
} = require("./data-api.cjs");
const { quoteIdent, usageLedgerSettingsFromEnv } = require("./usage-ledger.cjs");

function runControlLedgerSettingsFromEnv(env = process.env) {
  const usageSettings = usageLedgerSettingsFromEnv(env);
  return {
    enabled: parseBool(env.REVIEWBOT_RUN_CONTROL_LEDGER_ENABLED || "false"),
    region: env.REVIEWBOT_RUN_CONTROL_LEDGER_AWS_REGION || usageSettings.region,
    resourceArn:
      env.REVIEWBOT_RUN_CONTROL_LEDGER_DB_RESOURCE_ARN || usageSettings.resourceArn,
    secretArn:
      env.REVIEWBOT_RUN_CONTROL_LEDGER_DB_SECRET_ARN || usageSettings.secretArn,
    database: env.REVIEWBOT_RUN_CONTROL_LEDGER_DB_NAME || usageSettings.database,
    schema: env.REVIEWBOT_RUN_CONTROL_LEDGER_DB_SCHEMA || usageSettings.schema,
    claimTtlSeconds: positiveIntEnv(
      env.REVIEWBOT_RUN_CONTROL_LEDGER_CLAIM_TTL_SECONDS,
      60 * 60,
      "REVIEWBOT_RUN_CONTROL_LEDGER_CLAIM_TTL_SECONDS"
    ),
  };
}

async function claimReviewJobWithLedger(settings, job, context = {}, options = {}) {
  const policy = context.policy || runControlPolicyFromEnv();
  if (policy.mode === "off") {
    return evaluateRunControl({
      job,
      policy,
      snapshot: { unavailable: false, active: {} },
    });
  }

  if (!settings.enabled) {
    return unavailableDecision(job, policy, "Run-control ledger is disabled.");
  }

  try {
    assertDataApiSettings(settings, "Run-control ledger");
    const query = buildRunClaimQuery(settings.schema, job, policy, {
      claimTtlSeconds: settings.claimTtlSeconds,
    });
    const execute = options.executeStatement || executeStatement;
    const response = execute(settings, query.sql, query.parameters, {
      tempPrefix: "6529-run-control-",
      maxBuffer: 16 * 1024 * 1024,
    });
    return runClaimRecordToDecision(response.records?.[0], job, policy);
  } catch (error) {
    return unavailableDecision(job, policy, `Run-control claim failed: ${safeError(error)}`);
  }
}

function buildRunClaimQuery(schema, job, policy, options = {}) {
  assertClaimableJob(job);
  const schemaIdent = quoteIdent(schema);
  const subject = runControlSubjectFromJob(job);
  const caps = cappedScopes(subject, policy);
  const capSql = caps.length
    ? `values ${caps
        .map((_, index) => `(:scope_type_${index}, :scope_value_${index}, :max_concurrent_${index})`)
        .join(",\n      ")}`
    : "select cast(null as text), cast(null as text), cast(null as integer) where false";
  const claimTtlSeconds = positiveInteger(
    options.claimTtlSeconds || 60 * 60,
    "claimTtlSeconds"
  );

  return {
    sql: `
with claim_lock as (
  select pg_advisory_xact_lock(hashtext(cast(:lock_key as text)))
),
input as (
  select
    cast(:run_key as text) as run_key,
    cast(:job_id as text) as job_id,
    cast(:repo_full_name as text) as repo_full_name,
    cast(:org as text) as org,
    cast(:pr_number as bigint) as pr_number,
    cast(:requestor as text) as requestor,
    cast(:pr_head_sha as text) as pr_head_sha,
    cast(:review_kind as text) as review_kind,
    cast(:provider as text) as provider,
    cast(:model as text) as model,
    cast(:lane as text) as lane,
    cast(:delivery_id as text) as delivery_id,
    cast(:comment_id as text) as comment_id,
    cast(:command_name as text) as command_name,
    cast(:dedupe_enabled as boolean) as dedupe_enabled,
    cast(:dedupe_ttl_seconds as integer) as dedupe_ttl_seconds,
    cast(:claim_ttl_seconds as integer) as claim_ttl_seconds
  from claim_lock
),
caps(scope_type, scope_value, max_concurrent) as (
  ${capSql}
),
duplicate as (
  select c.run_key, c.job_id, c.status, c.created_at
  from ${schemaIdent}.ai_review_run_claims c, input i
  where i.dedupe_enabled
    and c.run_key = i.run_key
    and c.status <> 'expired'
    and (
      c.expires_at is null
      or c.expires_at > now()
      or c.created_at >= now() - make_interval(secs => i.dedupe_ttl_seconds)
    )
  limit 1
),
active_counts as (
  select
    caps.scope_type,
    caps.scope_value,
    caps.max_concurrent,
    count(c.id)::integer as active
  from caps
  left join ${schemaIdent}.ai_review_run_claims c
    on c.status in ('claimed', 'dispatching', 'running')
   and (c.expires_at is null or c.expires_at > now())
   and (
     (caps.scope_type = 'global')
     or (caps.scope_type = 'org' and c.org = caps.scope_value)
     or (caps.scope_type = 'repo' and c.repo_full_name = caps.scope_value)
     or (caps.scope_type = 'requestor' and c.requestor = caps.scope_value)
     or (caps.scope_type = 'pr' and c.repo_full_name || '#' || c.pr_number::text = caps.scope_value)
     or (caps.scope_type = 'provider' and c.provider = caps.scope_value)
     or (caps.scope_type = 'model' and c.model = caps.scope_value)
     or (caps.scope_type = 'review_kind' and c.review_kind = caps.scope_value)
   )
  group by caps.scope_type, caps.scope_value, caps.max_concurrent
),
exceeded as (
  select scope_type, scope_value, active, max_concurrent
  from active_counts
  where active >= max_concurrent
),
inserted as (
  insert into ${schemaIdent}.ai_review_run_claims (
    run_key,
    job_id,
    status,
    repo_full_name,
    org,
    pr_number,
    requestor,
    pr_head_sha,
    review_kind,
    provider,
    model,
    lane,
    delivery_id,
    comment_id,
    command_name,
    expires_at,
    metadata
  )
  select
    run_key,
    job_id,
    'claimed',
    repo_full_name,
    org,
    pr_number,
    requestor,
    pr_head_sha,
    review_kind,
    provider,
    model,
    lane,
    delivery_id,
    comment_id,
    command_name,
    now() + make_interval(secs => claim_ttl_seconds),
    '{}'::jsonb
  from input
  where not exists (select 1 from duplicate)
    and not exists (select 1 from exceeded)
  on conflict (run_key) do update set
    updated_at = now(),
    completed_at = null,
    expires_at = excluded.expires_at,
    job_id = excluded.job_id,
    status = excluded.status,
    repo_full_name = excluded.repo_full_name,
    org = excluded.org,
    pr_number = excluded.pr_number,
    requestor = excluded.requestor,
    pr_head_sha = excluded.pr_head_sha,
    review_kind = excluded.review_kind,
    provider = excluded.provider,
    model = excluded.model,
    lane = excluded.lane,
    delivery_id = excluded.delivery_id,
    comment_id = excluded.comment_id,
    command_name = excluded.command_name
  where ${schemaIdent}.ai_review_run_claims.status = 'expired'
     or ${schemaIdent}.ai_review_run_claims.expires_at < now()
  returning run_key, job_id, status, created_at
),
result as (
  select
    'claimed'::text as result_code,
    run_key,
    job_id,
    status,
    created_at::text as created_at,
    null::text as duplicate_json,
    '[]'::text as exceeded_json
  from inserted
  union all
  select
    'duplicate_run',
    run_key,
    job_id,
    status,
    created_at::text,
    json_build_object(
      'runKey', run_key,
      'jobId', job_id,
      'status', status,
      'createdAt', created_at::text
    )::text,
    '[]'
  from duplicate
  where not exists (select 1 from inserted)
  union all
  select
    'concurrency_limit_exceeded',
    null,
    null,
    null,
    null,
    null,
    coalesce(json_agg(json_build_object(
      'scopeType', scope_type,
      'scopeValue', scope_value,
      'active', active,
      'maxConcurrent', max_concurrent
    ))::text, '[]')
  from exceeded
  where exists (select 1 from exceeded)
    and not exists (select 1 from inserted)
    and not exists (select 1 from duplicate)
  union all
  select
    'claim_conflict',
    null,
    null,
    null,
    null,
    null,
    '[]'
  where not exists (select 1 from inserted)
    and not exists (select 1 from duplicate)
    and not exists (select 1 from exceeded)
)
select result_code, run_key, job_id, status, created_at, duplicate_json, exceeded_json
from result
limit 1
`,
    parameters: [
      stringParam("lock_key", "6529reviewbot-run-control"),
      stringParam("run_key", job.runKey),
      stringParam("job_id", job.id),
      stringParam("repo_full_name", subject.repo),
      stringParam("org", subject.org),
      longOrNullParam("pr_number", subject.prNumber),
      stringParam("requestor", subject.requestor),
      stringParam("pr_head_sha", job.headSha || ""),
      stringParam("review_kind", subject.reviewKind),
      stringParam("provider", subject.provider),
      stringParam("model", subject.model),
      stringParam("lane", job.lane || ""),
      stringOrNullParam("delivery_id", job.deliveryId),
      stringOrNullParam("comment_id", job.commentId),
      stringOrNullParam("command_name", job.commandName),
      boolParam("dedupe_enabled", policy.dedupeEnabled),
      longParam("dedupe_ttl_seconds", policy.dedupeTtlSeconds),
      longParam("claim_ttl_seconds", claimTtlSeconds),
      ...caps.flatMap((cap, index) => [
        stringParam(`scope_type_${index}`, cap.scopeType),
        stringParam(`scope_value_${index}`, cap.scopeValue),
        longParam(`max_concurrent_${index}`, cap.maxConcurrent),
      ]),
    ],
  };
}

function assertClaimableJob(job = {}) {
  const missing = [];
  for (const key of ["id", "runKey"]) {
    if (!job[key]) {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(`Run-control claim is missing job fields: ${missing.join(", ")}`);
  }
}

function runClaimRecordToDecision(record, job, policy) {
  if (!record) {
    return unavailableDecision(job, policy, "Run-control claim returned no result.");
  }
  const code = fieldValue(record[0]);
  if (code === "claimed") {
    return evaluateRunControl({
      job,
      policy,
      snapshot: { unavailable: false, active: {} },
    });
  }
  if (code === "duplicate_run") {
    return evaluateRunControl({
      job,
      policy,
      snapshot: {
        unavailable: false,
        duplicate: parseJson(fieldValue(record[5])) || {
          runKey: fieldValue(record[1]) || job.runKey,
          jobId: fieldValue(record[2]) || "",
          status: fieldValue(record[3]) || "",
          createdAt: fieldValue(record[4]) || "",
        },
      },
    });
  }
  if (code === "concurrency_limit_exceeded") {
    const active = {};
    for (const exceeded of parseJson(fieldValue(record[6])) || []) {
      active[runControlScopeKey(exceeded.scopeType, exceeded.scopeValue)] =
        Number(exceeded.active || 0);
    }
    return evaluateRunControl({
      job,
      policy,
      snapshot: { unavailable: false, active },
    });
  }
  return unavailableDecision(job, policy, "Run-control claim conflicted.");
}

function cappedScopes(subject, policy) {
  const result = [];
  for (const scopeType of RUN_CONTROL_SCOPES) {
    const maxConcurrent = policy.maxConcurrent?.[scopeType];
    if (maxConcurrent === null || maxConcurrent === undefined) {
      continue;
    }
    const scopeValue = runControlScopeValue(subject, scopeType);
    if (!scopeValue) {
      continue;
    }
    result.push({ scopeType, scopeValue, maxConcurrent });
  }
  return result;
}

function unavailableDecision(job, policy, reason) {
  return evaluateRunControl({
    job,
    policy,
    snapshot: { unavailable: true, reason },
  });
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function positiveIntEnv(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  return positiveInteger(value, name);
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function stringOrNullParam(name, value) {
  if (value === undefined || value === null || value === "") {
    return nullParam(name);
  }
  return stringParam(name, value);
}

function longOrNullParam(name, value) {
  if (value === undefined || value === null || value === "") {
    return nullParam(name);
  }
  return longParam(name, value);
}

function boolParam(name, value) {
  return { name, value: { booleanValue: Boolean(value) } };
}

function nullParam(name) {
  return { name, value: { isNull: true } };
}

function parseJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function safeError(error) {
  const message = error && error.message ? error.message : String(error);
  return message.split(/\r?\n/)[0].slice(0, 500);
}

module.exports = {
  buildRunClaimQuery,
  claimReviewJobWithLedger,
  runClaimRecordToDecision,
  runControlLedgerSettingsFromEnv,
};
