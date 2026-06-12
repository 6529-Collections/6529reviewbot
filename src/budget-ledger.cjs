"use strict";

const { budgetPoliciesForSubject, budgetScopeKey } = require("./budget-admission.cjs");
const {
  assertDataApiSettings,
  awsCliBin,
  executeStatement,
  fieldValue,
  longParam,
  nullableNumber,
  numberValue,
  shouldUseShellForAwsCli,
  stringParam,
} = require("./data-api.cjs");
const { quoteIdent } = require("./usage-ledger.cjs");

function readEnabledBudgetPolicies(settings) {
  assertDataApiSettings(settings, "Budget ledger");
  const sql = `
select scope_type, scope_value, daily_budget_usd, weekly_budget_usd, monthly_budget_usd, enabled
from ${quoteIdent(settings.schema)}.ai_review_budget_policies
where enabled = true
order by scope_type, scope_value
`;
  const response = executeStatement(settings, sql, []);
  return response.records.map((record) => ({
    scopeType: fieldValue(record[0]),
    scopeValue: fieldValue(record[1]),
    dailyBudgetUsd: nullableNumber(fieldValue(record[2])),
    weeklyBudgetUsd: nullableNumber(fieldValue(record[3])),
    monthlyBudgetUsd: nullableNumber(fieldValue(record[4])),
    enabled: fieldValue(record[5]) === true,
  }));
}

function readBudgetPolicyStatus(settings) {
  assertDataApiSettings(settings, "Budget status ledger");
  const query = buildBudgetPolicyStatusQuery(settings.schema);
  const response = executeStatement(settings, query.sql, query.parameters, {
    tempPrefix: "6529-budget-status-",
    maxBuffer: 16 * 1024 * 1024,
  });
  return response.records.map(budgetPolicyStatusRecordToPolicy);
}

function readBudgetSpendSnapshot(settings, subject, policy) {
  assertDataApiSettings(settings, "Budget ledger");
  const policies = budgetPoliciesForSubject(subject, policy);
  const totals = {};
  for (const budget of policies) {
    const key = budgetScopeKey(budget.scopeType, budget.scopeValue);
    if (totals[key]) {
      continue;
    }
    totals[key] = readScopeSpend(settings, budget.scopeType, budget.scopeValue);
  }
  return { unavailable: false, totals };
}

function readScopeSpend(settings, scopeType, scopeValue) {
  const query = buildScopeSpendQuery(settings.schema, scopeType, scopeValue);
  const response = executeStatement(settings, query.sql, query.parameters, {
    tempPrefix: "6529-budget-ledger-",
  });
  const record = response.records[0] || [];
  return {
    dailyUsd: numberValue(record[0]),
    weeklyUsd: numberValue(record[1]),
    monthlyUsd: numberValue(record[2]),
  };
}

function buildScopeSpendQuery(schema, scopeType, scopeValue) {
  const where = scopeWhere(scopeType, scopeValue);
  return {
    sql: `
select
  coalesce(sum(coalesce(actual_cost_usd, estimated_cost_usd, 0)) filter (where created_at >= date_trunc('day', now())), 0)::text as daily_usd,
  coalesce(sum(coalesce(actual_cost_usd, estimated_cost_usd, 0)) filter (where created_at >= date_trunc('week', now())), 0)::text as weekly_usd,
  coalesce(sum(coalesce(actual_cost_usd, estimated_cost_usd, 0)) filter (where created_at >= date_trunc('month', now())), 0)::text as monthly_usd
from ${quoteIdent(schema)}.ai_review_usage_events
where ${where.sql}
`,
    parameters: where.parameters,
  };
}

function buildBudgetPolicyStatusQuery(schema) {
  const schemaIdent = quoteIdent(schema);
  return {
    sql: `
with enabled_policies as (
  select
    scope_type,
    scope_value,
    daily_budget_usd,
    weekly_budget_usd,
    monthly_budget_usd,
    enabled
  from ${schemaIdent}.ai_review_budget_policies
  where enabled = true
)
select
  p.scope_type,
  p.scope_value,
  p.daily_budget_usd::text,
  p.weekly_budget_usd::text,
  p.monthly_budget_usd::text,
  p.enabled,
  coalesce(sum(coalesce(u.actual_cost_usd, u.estimated_cost_usd, 0)) filter (where u.created_at >= date_trunc('day', now())), 0)::text as daily_usd,
  coalesce(sum(coalesce(u.actual_cost_usd, u.estimated_cost_usd, 0)) filter (where u.created_at >= date_trunc('week', now())), 0)::text as weekly_usd,
  coalesce(sum(coalesce(u.actual_cost_usd, u.estimated_cost_usd, 0)) filter (where u.created_at >= date_trunc('month', now())), 0)::text as monthly_usd
from enabled_policies p
left join ${schemaIdent}.ai_review_usage_events u
  on u.created_at >= least(date_trunc('week', now()), date_trunc('month', now()))
 and (
   p.scope_type = 'global'
   or (p.scope_type = 'org' and u.repo_full_name like p.scope_value || '/%')
   or (p.scope_type = 'repo' and u.repo_full_name = p.scope_value)
   or (p.scope_type = 'requestor' and coalesce(u.metadata->>'requestor', u.pr_author) = p.scope_value)
   or (p.scope_type = 'pr' and u.repo_full_name = split_part(p.scope_value, '#', 1) and u.pr_number::text = split_part(p.scope_value, '#', 2))
   or (p.scope_type = 'provider' and u.provider = p.scope_value)
   or (p.scope_type = 'model' and u.model = p.scope_value)
   or (p.scope_type = 'review_kind' and (p.scope_value = '*' or u.review_kind = p.scope_value))
 )
group by
  p.scope_type,
  p.scope_value,
  p.daily_budget_usd,
  p.weekly_budget_usd,
  p.monthly_budget_usd,
  p.enabled
order by p.scope_type, p.scope_value
`,
    parameters: [],
  };
}

function budgetPolicyStatusRecordToPolicy(record) {
  return {
    scopeType: fieldValue(record[0]),
    scopeValue: fieldValue(record[1]),
    dailyBudgetUsd: nullableNumber(fieldValue(record[2])),
    weeklyBudgetUsd: nullableNumber(fieldValue(record[3])),
    monthlyBudgetUsd: nullableNumber(fieldValue(record[4])),
    enabled: fieldValue(record[5]) === true,
    currentSpend: {
      dailyUsd: numberValue(record[6]),
      weeklyUsd: numberValue(record[7]),
      monthlyUsd: numberValue(record[8]),
    },
  };
}

function scopeWhere(scopeType, scopeValue) {
  if (scopeType === "global") {
    return { sql: "true", parameters: [] };
  }
  if (scopeType === "org") {
    return {
      sql: "repo_full_name like :org_prefix",
      parameters: [stringParam("org_prefix", `${scopeValue}/%`)],
    };
  }
  if (scopeType === "repo") {
    return {
      sql: "repo_full_name = :scope_value",
      parameters: [stringParam("scope_value", scopeValue)],
    };
  }
  if (scopeType === "requestor") {
    return {
      sql: "coalesce(metadata->>'requestor', pr_author) = :scope_value",
      parameters: [stringParam("scope_value", scopeValue)],
    };
  }
  if (scopeType === "pr") {
    const match = /^(.+)#(\d+)$/.exec(scopeValue);
    if (!match) {
      return { sql: "false", parameters: [] };
    }
    return {
      sql: "repo_full_name = :repo_full_name and pr_number = :pr_number",
      parameters: [stringParam("repo_full_name", match[1]), longParam("pr_number", Number(match[2]))],
    };
  }
  if (scopeType === "provider") {
    return {
      sql: "provider = :scope_value",
      parameters: [stringParam("scope_value", scopeValue)],
    };
  }
  if (scopeType === "model") {
    return {
      sql: "model = :scope_value",
      parameters: [stringParam("scope_value", scopeValue)],
    };
  }
  if (scopeType === "review_kind") {
    if (scopeValue === "*") {
      return { sql: "true", parameters: [] };
    }
    return {
      sql: "review_kind = :scope_value",
      parameters: [stringParam("scope_value", scopeValue)],
    };
  }
  throw new Error(`Unsupported budget scope '${scopeType}'.`);
}

module.exports = {
  awsCliBin,
  budgetPolicyStatusRecordToPolicy,
  buildBudgetPolicyStatusQuery,
  buildScopeSpendQuery,
  readBudgetPolicyStatus,
  readBudgetSpendSnapshot,
  readEnabledBudgetPolicies,
  scopeWhere,
  shouldUseShellForAwsCli,
};
