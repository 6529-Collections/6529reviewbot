"use strict";

const { assertDataApiSettings, executeStatement } = require("./data-api.cjs");
const { BUDGET_SCOPES } = require("./budget-admission.cjs");
const { quoteIdent } = require("./usage-ledger.cjs");

const BUDGET_SCOPE_VALUES_SQL = BUDGET_SCOPES.map(sqlString).join(", ");

function ledgerSchemaStatements(schema = "reviewbot") {
  const schemaIdent = quoteIdent(schema);
  return [
    {
      name: "create_schema",
      sql: `create schema if not exists ${schemaIdent}`,
    },
    {
      name: "create_usage_events",
      sql: `
create table if not exists ${schemaIdent}.ai_review_usage_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  repo_full_name text not null,
  pr_number bigint,
  pr_author text,
  pr_head_sha text,
  workflow_run_id text,
  workflow_job text,
  review_kind text not null,
  provider text not null,
  model text not null,
  lane text,
  request_id text,
  provider_response_id text,
  input_tokens bigint not null default 0,
  cached_input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reasoning_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost_usd numeric(18, 8),
  actual_cost_usd numeric(18, 8),
  currency text not null default 'USD',
  budget_skipped boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
)`,
    },
    {
      name: "create_job_events",
      sql: `
create table if not exists ${schemaIdent}.ai_review_job_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  job_id text not null,
  status text not null,
  stage text not null,
  repo_full_name text not null,
  pr_number bigint,
  pr_author text,
  pr_head_sha text,
  delivery_id text,
  requestor text,
  review_kind text not null,
  provider text not null,
  model text not null,
  lane text,
  adapter text,
  accepted boolean,
  reason text,
  exit_code integer,
  metadata jsonb not null default '{}'::jsonb
)`,
    },
    {
      name: "create_run_claims",
      sql: `
create table if not exists ${schemaIdent}.ai_review_run_claims (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  run_key text not null unique,
  job_id text not null,
  status text not null,
  repo_full_name text not null,
  org text,
  pr_number bigint,
  requestor text,
  pr_head_sha text,
  review_kind text not null,
  provider text not null,
  model text not null,
  lane text,
  delivery_id text,
  comment_id text,
  command_name text,
  metadata jsonb not null default '{}'::jsonb
)`,
    },
    {
      name: "create_model_prices",
      sql: `
create table if not exists ${schemaIdent}.ai_model_prices (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  input_usd_per_million numeric(18, 8),
  cached_input_usd_per_million numeric(18, 8),
  output_usd_per_million numeric(18, 8),
  reasoning_usd_per_million numeric(18, 8),
  currency text not null default 'USD',
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  source_url text,
  notes text
)`,
    },
    {
      name: "alter_model_prices_add_id",
      sql: `
alter table ${schemaIdent}.ai_model_prices
  add column if not exists id bigserial`,
    },
    {
      name: "alter_model_prices_add_created_at",
      sql: `
alter table ${schemaIdent}.ai_model_prices
  add column if not exists created_at timestamptz not null default now()`,
    },
    {
      name: "alter_model_prices_add_source_url",
      sql: `
alter table ${schemaIdent}.ai_model_prices
  add column if not exists source_url text`,
    },
    {
      name: "create_budget_policies",
      sql: `
create table if not exists ${schemaIdent}.ai_review_budget_policies (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scope_type text not null,
  scope_value text not null,
  daily_budget_usd numeric(18, 8),
  weekly_budget_usd numeric(18, 8),
  monthly_budget_usd numeric(18, 8),
  enabled boolean not null default true,
  notes text,
  constraint ai_review_budget_policies_scope_type_check
    check (scope_type in (${BUDGET_SCOPE_VALUES_SQL})),
  unique (scope_type, scope_value)
)`,
    },
    {
      name: "alter_budget_policies_add_notes",
      sql: `
alter table ${schemaIdent}.ai_review_budget_policies
  add column if not exists notes text`,
    },
    {
      name: "normalize_budget_policies_requester_scope",
      sql: `
update ${schemaIdent}.ai_review_budget_policies
set scope_type = 'requestor'
where scope_type = 'requester'`,
    },
    {
      name: "drop_budget_policies_scope_type_check",
      sql: `
alter table ${schemaIdent}.ai_review_budget_policies
  drop constraint if exists ai_review_budget_policies_scope_type_check`,
    },
    {
      name: "add_budget_policies_scope_type_check",
      sql: `
alter table ${schemaIdent}.ai_review_budget_policies
  add constraint ai_review_budget_policies_scope_type_check
  check (scope_type in (${BUDGET_SCOPE_VALUES_SQL}))`,
    },
    {
      name: "index_usage_repo_pr_created",
      sql: `
create index if not exists ai_review_usage_events_repo_pr_created_idx
  on ${schemaIdent}.ai_review_usage_events (repo_full_name, pr_number, created_at desc)`,
    },
    {
      name: "index_usage_requestor_created",
      sql: `
create index if not exists ai_review_usage_events_requestor_created_idx
  on ${schemaIdent}.ai_review_usage_events ((coalesce(metadata->>'requestor', pr_author)), created_at desc)`,
    },
    {
      name: "index_usage_provider_model_created",
      sql: `
create index if not exists ai_review_usage_events_provider_model_created_idx
  on ${schemaIdent}.ai_review_usage_events (provider, model, created_at desc)`,
    },
    {
      name: "index_usage_review_kind_created",
      sql: `
create index if not exists ai_review_usage_events_review_kind_created_idx
  on ${schemaIdent}.ai_review_usage_events (review_kind, created_at desc)`,
    },
    {
      name: "index_job_events_job_created",
      sql: `
create index if not exists ai_review_job_events_job_created_idx
  on ${schemaIdent}.ai_review_job_events (job_id, created_at desc)`,
    },
    {
      name: "index_job_events_repo_pr_created",
      sql: `
create index if not exists ai_review_job_events_repo_pr_created_idx
  on ${schemaIdent}.ai_review_job_events (repo_full_name, pr_number, created_at desc)`,
    },
    {
      name: "index_job_events_status_created",
      sql: `
create index if not exists ai_review_job_events_status_created_idx
  on ${schemaIdent}.ai_review_job_events (status, created_at desc)`,
    },
    {
      name: "index_job_events_requestor_created",
      sql: `
create index if not exists ai_review_job_events_requestor_created_idx
  on ${schemaIdent}.ai_review_job_events (requestor, created_at desc)`,
    },
    {
      name: "index_run_claims_status_expires",
      sql: `
create index if not exists ai_review_run_claims_status_expires_idx
  on ${schemaIdent}.ai_review_run_claims (status, expires_at)`,
    },
    {
      name: "index_run_claims_repo_status",
      sql: `
create index if not exists ai_review_run_claims_repo_status_idx
  on ${schemaIdent}.ai_review_run_claims (repo_full_name, status, created_at desc)`,
    },
    {
      name: "index_run_claims_requestor_status",
      sql: `
create index if not exists ai_review_run_claims_requestor_status_idx
  on ${schemaIdent}.ai_review_run_claims (requestor, status, created_at desc)`,
    },
    {
      name: "index_run_claims_provider_model_status",
      sql: `
create index if not exists ai_review_run_claims_provider_model_status_idx
  on ${schemaIdent}.ai_review_run_claims (provider, model, status, created_at desc)`,
    },
    {
      name: "index_model_prices_provider_model_effective",
      sql: `
create unique index if not exists ai_model_prices_provider_model_effective_idx
  on ${schemaIdent}.ai_model_prices (provider, model, effective_from)`,
    },
    {
      name: "drop_view_daily_spend_by_requester",
      sql: `
drop view if exists ${schemaIdent}.daily_ai_review_spend_by_requester`,
    },
    {
      name: "drop_view_daily_spend_by_model",
      sql: `
drop view if exists ${schemaIdent}.daily_ai_review_spend_by_model`,
    },
    {
      name: "drop_view_daily_spend_by_pr",
      sql: `
drop view if exists ${schemaIdent}.daily_ai_review_spend_by_pr`,
    },
    {
      name: "view_daily_spend_by_requester",
      sql: `
create or replace view ${schemaIdent}.daily_ai_review_spend_by_requester as
select
  date_trunc('day', created_at)::date as day,
  coalesce(metadata->>'requestor', pr_author, 'unknown') as requestor,
  count(*) as review_runs,
  coalesce(sum(total_tokens), 0) as total_tokens,
  coalesce(sum(coalesce(actual_cost_usd, estimated_cost_usd, 0)), 0) as cost_usd
from ${schemaIdent}.ai_review_usage_events
group by 1, 2`,
    },
    {
      name: "view_daily_spend_by_model",
      sql: `
create or replace view ${schemaIdent}.daily_ai_review_spend_by_model as
select
  date_trunc('day', created_at)::date as day,
  provider,
  model,
  count(*) as review_runs,
  coalesce(sum(total_tokens), 0) as total_tokens,
  coalesce(sum(coalesce(actual_cost_usd, estimated_cost_usd, 0)), 0) as cost_usd
from ${schemaIdent}.ai_review_usage_events
group by 1, 2, 3`,
    },
    {
      name: "view_daily_spend_by_pr",
      sql: `
create or replace view ${schemaIdent}.daily_ai_review_spend_by_pr as
select
  date_trunc('day', created_at)::date as day,
  repo_full_name,
  pr_number,
  count(*) as review_runs,
  coalesce(sum(total_tokens), 0) as total_tokens,
  coalesce(sum(coalesce(actual_cost_usd, estimated_cost_usd, 0)), 0) as cost_usd
from ${schemaIdent}.ai_review_usage_events
group by 1, 2, 3`,
    },
  ];
}

function applyLedgerSchema(settings, options = {}) {
  const schema = options.schema || settings.schema || "reviewbot";
  const statements = options.statements || ledgerSchemaStatements(schema);
  assertDataApiSettings({ ...settings, schema }, "Ledger schema");
  const execute = options.executeStatement || executeStatement;
  const results = [];
  for (const statement of statements) {
    execute(
      { ...settings, schema },
      statement.sql,
      [],
      { tempPrefix: "6529-ledger-schema-", maxBuffer: 16 * 1024 * 1024 }
    );
    results.push({ name: statement.name, applied: true });
  }
  return results;
}

function renderLedgerSchema(schema = "reviewbot") {
  return ledgerSchemaStatements(schema)
    .map((statement) => `-- ${statement.name}\n${statement.sql.trim()};`)
    .join("\n\n");
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

module.exports = {
  applyLedgerSchema,
  ledgerSchemaStatements,
  renderLedgerSchema,
};
