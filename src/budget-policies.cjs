"use strict";

const fs = require("fs");
const { BUDGET_SCOPES } = require("./budget-admission.cjs");
const { stringParam } = require("./data-api.cjs");
const { REVIEW_KINDS } = require("./github-webhook.cjs");
const { normalizeProvider } = require("./model-catalog.cjs");
const { executeStatement, assertDataApiSettings } = require("./data-api.cjs");
const { quoteIdent } = require("./usage-ledger.cjs");

function loadBudgetPolicyFile(filePath) {
  return validateBudgetPolicyFile(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function validateBudgetPolicyFile(document, source = "budget policy file") {
  assertPlainObject(document, source);
  assertKnownKeys(document, new Set(["version", "currency", "policies"]), source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const currency = String(document.currency || "USD").trim().toUpperCase();
  if (currency !== "USD") {
    throw new Error(`${source} currency must be USD.`);
  }
  if (!Array.isArray(document.policies)) {
    throw new Error(`${source} policies must be an array.`);
  }
  const seen = new Set();
  const policies = document.policies.map((policy, index) => {
    const normalized = normalizeBudgetPolicy(policy, `${source} policies[${index}]`);
    const key = `${normalized.scopeType}\0${normalized.scopeValue}`;
    if (seen.has(key)) {
      throw new Error(`${source} contains a duplicate policy for ${normalized.scopeType}:${normalized.scopeValue}.`);
    }
    seen.add(key);
    return normalized;
  });
  return {
    version: 1,
    currency,
    policies,
  };
}

function normalizeBudgetPolicy(policy, source) {
  assertPlainObject(policy, source);
  assertKnownKeys(
    policy,
    new Set([
      "scopeType",
      "scopeValue",
      "dailyUsd",
      "weeklyUsd",
      "monthlyUsd",
      "dailyBudgetUsd",
      "weeklyBudgetUsd",
      "monthlyBudgetUsd",
      "enabled",
      "notes",
    ]),
    source
  );
  const scopeType = normalizeScopeType(policy.scopeType, `${source}.scopeType`);
  const scopeValue = normalizeScopeValue(scopeType, policy.scopeValue, `${source}.scopeValue`);
  const normalized = {
    scopeType,
    scopeValue,
    dailyBudgetUsd: nullableUsd(policy.dailyUsd ?? policy.dailyBudgetUsd, `${source}.dailyUsd`),
    weeklyBudgetUsd: nullableUsd(policy.weeklyUsd ?? policy.weeklyBudgetUsd, `${source}.weeklyUsd`),
    monthlyBudgetUsd: nullableUsd(policy.monthlyUsd ?? policy.monthlyBudgetUsd, `${source}.monthlyUsd`),
    enabled: booleanField(policy.enabled, true, `${source}.enabled`),
    notes: optionalString(policy.notes),
  };
  if (normalized.enabled && !hasCaps(normalized)) {
    throw new Error(`${source} must include at least one budget cap when enabled is true.`);
  }
  return normalized;
}

function budgetPolicyStatements(schema, document) {
  const schemaIdent = quoteIdent(schema);
  const policyFile = validateBudgetPolicyFile(document);
  return policyFile.policies.map((policy) => ({
    name: `upsert_budget_${policy.scopeType}_${safeName(policy.scopeValue)}`,
    sql: `
insert into ${schemaIdent}.ai_review_budget_policies (
  scope_type,
  scope_value,
  daily_budget_usd,
  weekly_budget_usd,
  monthly_budget_usd,
  enabled,
  notes
) values (
  :scope_type,
  :scope_value,
  cast(:daily_budget_usd as numeric),
  cast(:weekly_budget_usd as numeric),
  cast(:monthly_budget_usd as numeric),
  :enabled,
  :notes
) on conflict (scope_type, scope_value) do update set
  updated_at = now(),
  daily_budget_usd = excluded.daily_budget_usd,
  weekly_budget_usd = excluded.weekly_budget_usd,
  monthly_budget_usd = excluded.monthly_budget_usd,
  enabled = excluded.enabled,
  notes = excluded.notes`,
    parameters: [
      stringParam("scope_type", policy.scopeType),
      stringParam("scope_value", policy.scopeValue),
      decimalOrNullParam("daily_budget_usd", policy.dailyBudgetUsd),
      decimalOrNullParam("weekly_budget_usd", policy.weeklyBudgetUsd),
      decimalOrNullParam("monthly_budget_usd", policy.monthlyBudgetUsd),
      boolParam("enabled", policy.enabled),
      stringOrNullParam("notes", policy.notes),
    ],
  }));
}

function applyBudgetPolicies(settings, document, options = {}) {
  assertDataApiSettings(settings, "Budget policy ledger");
  const statements = options.statements || budgetPolicyStatements(settings.schema, document);
  const execute = options.executeStatement || executeStatement;
  const results = [];
  for (const statement of statements) {
    execute(settings, statement.sql, statement.parameters, {
      tempPrefix: "6529-budget-policies-",
      maxBuffer: 16 * 1024 * 1024,
    });
    results.push({ name: statement.name, applied: true });
  }
  return results;
}

function renderBudgetPolicySql(schema, document) {
  return budgetPolicyStatements(schema, document)
    .map((statement) => {
      const params = Object.fromEntries(
        statement.parameters.map((param) => [param.name, param.value])
      );
      return [
        `-- ${statement.name}`,
        `-- parameters: ${JSON.stringify(params)}`,
        `${statement.sql.trim()};`,
      ].join("\n");
    })
    .join("\n\n");
}

function mergeBudgetPolicyRows(basePolicy, rows = []) {
  return {
    ...basePolicy,
    explicitPolicies: [
      ...(basePolicy.explicitPolicies || []),
      ...rows.filter((row) => row.enabled !== false).map(normalizeLedgerPolicyRow),
    ],
  };
}

function normalizeLedgerPolicyRow(row = {}) {
  return normalizeBudgetPolicy(
    {
      scopeType: row.scopeType ?? row.scope_type,
      scopeValue: row.scopeValue ?? row.scope_value,
      dailyBudgetUsd: row.dailyBudgetUsd ?? row.daily_budget_usd,
      weeklyBudgetUsd: row.weeklyBudgetUsd ?? row.weekly_budget_usd,
      monthlyBudgetUsd: row.monthlyBudgetUsd ?? row.monthly_budget_usd,
      enabled: row.enabled,
      notes: row.notes,
    },
    "budget policy row"
  );
}

function normalizeScopeType(value, source) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  const scopeType = normalized === "reviewkind" ? "review_kind" : normalized;
  if (!BUDGET_SCOPES.includes(scopeType)) {
    throw new Error(`${source} must be one of: ${BUDGET_SCOPES.join(", ")}.`);
  }
  return scopeType;
}

function normalizeScopeValue(scopeType, value, source) {
  let text = stringField(value === undefined ? "*" : value, source);
  if (scopeType === "global") {
    if (text !== "*") {
      throw new Error(`${source} must be "*" when scopeType is global.`);
    }
    return text;
  }
  if (text === "*") {
    throw new Error(`${source} must be concrete for ${scopeType} budget policies.`);
  }
  if (scopeType === "provider") {
    return normalizeProvider(text);
  }
  if (scopeType === "review_kind") {
    if (!REVIEW_KINDS.includes(text)) {
      throw new Error(`${source} must be one of: ${REVIEW_KINDS.join(", ")}.`);
    }
    return text;
  }
  if (scopeType === "org" && text.includes("/")) {
    throw new Error(`${source} must be an organization or user login without "/".`);
  }
  if (scopeType === "repo" && !/^[^/\s]+\/[^/\s]+$/.test(text)) {
    throw new Error(`${source} must be a repository full name like owner/repo.`);
  }
  if (scopeType === "pr" && !/^[^/\s]+\/[^#\s]+#[1-9][0-9]*$/.test(text)) {
    throw new Error(`${source} must be a PR key like owner/repo#123.`);
  }
  return text;
}

function nullableUsd(value, source) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${source} must be a non-negative number.`);
  }
  return parsed;
}

function hasCaps(policy) {
  return ["dailyBudgetUsd", "weeklyBudgetUsd", "monthlyBudgetUsd"].some(
    (key) => policy[key] !== null && policy[key] !== undefined
  );
}

function booleanField(value, fallback, source) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${source} must be true or false.`);
  }
  return value;
}

function stringField(value, source) {
  const text = String(value || "").trim();
  if (!text || /\s/.test(text)) {
    throw new Error(`${source} must be a non-empty string without whitespace.`);
  }
  if (text.length > 256) {
    throw new Error(`${source} must be 256 characters or fewer.`);
  }
  return text;
}

function optionalString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function decimalOrNullParam(name, value) {
  if (value === null || value === undefined) {
    return nullParam(name);
  }
  return stringParam(name, String(value));
}

function stringOrNullParam(name, value) {
  if (!value) {
    return nullParam(name);
  }
  return stringParam(name, value);
}

function boolParam(name, value) {
  return { name, value: { booleanValue: Boolean(value) } };
}

function nullParam(name) {
  return { name, value: { isNull: true } };
}

function safeName(value) {
  return String(value).replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "global";
}

function assertPlainObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object.`);
  }
}

function assertKnownKeys(value, allowed, source) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${source} has unsupported key '${key}'.`);
    }
  }
}

module.exports = {
  applyBudgetPolicies,
  budgetPolicyStatements,
  loadBudgetPolicyFile,
  mergeBudgetPolicyRows,
  normalizeBudgetPolicy,
  normalizeLedgerPolicyRow,
  renderBudgetPolicySql,
  validateBudgetPolicyFile,
};
