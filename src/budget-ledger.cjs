"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { budgetPoliciesForSubject, budgetScopeKey } = require("./budget-admission.cjs");
const { quoteIdent } = require("./usage-ledger.cjs");

function readEnabledBudgetPolicies(settings) {
  assertDataApiSettings(settings);
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
  assertDataApiSettings(settings);
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
  const response = executeStatement(settings, query.sql, query.parameters);
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

function assertDataApiSettings(settings) {
  const missing = [];
  for (const key of ["region", "resourceArn", "secretArn", "database", "schema"]) {
    if (!settings[key]) {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(`Budget ledger settings are missing: ${missing.join(", ")}`);
  }
}

function executeStatement(settings, sql, parameters) {
  const payload = {
    resourceArn: settings.resourceArn,
    secretArn: settings.secretArn,
    database: settings.database,
    sql,
    parameters,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-budget-ledger-"));
  const payloadPath = path.join(tmpDir, "payload.json");
  try {
    fs.writeFileSync(payloadPath, JSON.stringify(payload), "utf8");
    const stdout = execFileSync(
      awsCliBin(),
      ["rds-data", "execute-statement", "--region", settings.region, "--cli-input-json", `file://${payloadPath}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: shouldUseShellForAwsCli() }
    );
    return JSON.parse(stdout);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function awsCliBin() {
  return process.env.AWS_CLI_BIN || "aws";
}

function shouldUseShellForAwsCli() {
  return process.platform === "win32" && !process.env.AWS_CLI_BIN;
}

function fieldValue(field = {}) {
  if (field.isNull) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(field, "stringValue")) {
    return field.stringValue;
  }
  if (Object.prototype.hasOwnProperty.call(field, "longValue")) {
    return field.longValue;
  }
  if (Object.prototype.hasOwnProperty.call(field, "doubleValue")) {
    return field.doubleValue;
  }
  if (Object.prototype.hasOwnProperty.call(field, "booleanValue")) {
    return field.booleanValue;
  }
  return null;
}

function numberValue(field) {
  const value = fieldValue(field);
  return value === null ? 0 : Number(value);
}

function nullableNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function stringParam(name, value) {
  return { name, value: { stringValue: String(value) } };
}

function longParam(name, value) {
  return { name, value: { longValue: Number(value) } };
}

module.exports = {
  awsCliBin,
  buildScopeSpendQuery,
  readBudgetSpendSnapshot,
  readEnabledBudgetPolicies,
  scopeWhere,
  shouldUseShellForAwsCli,
};
