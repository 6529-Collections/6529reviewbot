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
  buildScopeSpendQuery,
  readBudgetSpendSnapshot,
  readEnabledBudgetPolicies,
  scopeWhere,
  shouldUseShellForAwsCli,
};
