"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function usageLedgerSettingsFromEnv(env = process.env) {
  return {
    enabled: parseBool(env.REVIEW_USAGE_ENABLED || "false"),
    failClosed: parseBool(env.REVIEW_USAGE_FAIL_CLOSED || "false"),
    region: env.REVIEW_USAGE_AWS_REGION || env.AWS_REGION || "us-east-1",
    resourceArn: env.REVIEW_USAGE_DB_RESOURCE_ARN || "",
    secretArn: env.REVIEW_USAGE_DB_SECRET_ARN || "",
    database: env.REVIEW_USAGE_DB_NAME || "reviewbot",
    schema: env.REVIEW_USAGE_DB_SCHEMA || "reviewbot",
  };
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function assertUsageLedgerConfigured(settings) {
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
    throw new Error(`Usage ledger is enabled but missing settings: ${missing.join(", ")}`);
  }
}

function writeUsageEvent(settings, event, log = console.warn) {
  if (!settings.enabled) {
    return { skipped: true };
  }

  try {
    assertUsageLedgerConfigured(settings);
    const sql = `
insert into ${quoteIdent(settings.schema)}.ai_review_usage_events (
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
  request_id,
  provider_response_id,
  input_tokens,
  cached_input_tokens,
  output_tokens,
  reasoning_tokens,
  total_tokens,
  estimated_cost_usd,
  actual_cost_usd,
  currency,
  budget_skipped,
  metadata
) values (
  :repo_full_name,
  :pr_number,
  :pr_author,
  :pr_head_sha,
  :workflow_run_id,
  :workflow_job,
  :review_kind,
  :provider,
  :model,
  :lane,
  :request_id,
  :provider_response_id,
  :input_tokens,
  :cached_input_tokens,
  :output_tokens,
  :reasoning_tokens,
  :total_tokens,
  cast(:estimated_cost_usd as numeric),
  cast(:actual_cost_usd as numeric),
  :currency,
  :budget_skipped,
  cast(:metadata as jsonb)
)`;

    const payload = {
      resourceArn: settings.resourceArn,
      secretArn: settings.secretArn,
      database: settings.database,
      sql,
      parameters: [
        stringParam("repo_full_name", event.repoFullName),
        longParam("pr_number", event.prNumber),
        stringParam("pr_author", event.prAuthor),
        stringParam("pr_head_sha", event.prHeadSha),
        stringParam("workflow_run_id", event.workflowRunId),
        stringParam("workflow_job", event.workflowJob),
        stringParam("review_kind", event.reviewKind),
        stringParam("provider", event.provider),
        stringParam("model", event.model),
        stringParam("lane", event.lane),
        stringParam("request_id", event.requestId),
        stringParam("provider_response_id", event.providerResponseId),
        longParam("input_tokens", event.inputTokens || 0),
        longParam("cached_input_tokens", event.cachedInputTokens || 0),
        longParam("output_tokens", event.outputTokens || 0),
        longParam("reasoning_tokens", event.reasoningTokens || 0),
        longParam("total_tokens", event.totalTokens || 0),
        decimalParam("estimated_cost_usd", event.estimatedCostUsd),
        decimalParam("actual_cost_usd", event.actualCostUsd),
        stringParam("currency", event.currency || "USD"),
        boolParam("budget_skipped", Boolean(event.budgetSkipped)),
        stringParam("metadata", JSON.stringify(event.metadata || {})),
      ],
    };

    executeDataApi(settings.region, payload);
    return { skipped: false };
  } catch (error) {
    if (settings.failClosed) {
      throw error;
    }
    log(`usage ledger write failed: ${safeError(error)}`);
    return { skipped: false, error };
  }
}

function executeDataApi(region, payload) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529reviewbot-"));
  const payloadPath = path.join(tmpDir, "rds-data-input.json");
  try {
    fs.writeFileSync(payloadPath, JSON.stringify(payload), "utf8");
    execFileSync(
      "aws",
      ["rds-data", "execute-statement", "--region", region, "--cli-input-json", `file://${payloadPath}`],
      {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore temporary cleanup failures.
    }
  }
}

function stringParam(name, value) {
  if (value === undefined || value === null || value === "") {
    return nullParam(name);
  }
  return { name, value: { stringValue: String(value) } };
}

function longParam(name, value) {
  if (value === undefined || value === null || value === "") {
    return { name, value: { longValue: 0 } };
  }
  return { name, value: { longValue: Number(value) || 0 } };
}

function decimalParam(name, value) {
  if (value === undefined || value === null || value === "") {
    return nullParam(name);
  }
  return { name, value: { stringValue: String(value) } };
}

function boolParam(name, value) {
  return { name, value: { booleanValue: Boolean(value) } };
}

function nullParam(name) {
  return { name, value: { isNull: true } };
}

function quoteIdent(value) {
  const text = String(value || "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
    throw new Error(`Invalid SQL identifier '${text}'.`);
  }
  return `"${text}"`;
}

function safeError(error) {
  const message = error && error.message ? error.message : String(error);
  return message.split(/\r?\n/)[0].slice(0, 500);
}

module.exports = {
  usageLedgerSettingsFromEnv,
  writeUsageEvent,
  quoteIdent,
};
