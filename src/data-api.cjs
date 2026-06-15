"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DATA_API_CLIENTS = ["auto", "aws-cli", "node"];

function assertDataApiSettings(settings, label = "Data API") {
  const missing = [];
  for (const key of ["region", "resourceArn", "secretArn", "database", "schema"]) {
    if (!settings[key]) {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(`${label} settings are missing: ${missing.join(", ")}`);
  }
}

function executeStatement(settings, sql, parameters = [], options = {}) {
  const payload = {
    resourceArn: settings.resourceArn,
    secretArn: settings.secretArn,
    database: settings.database,
    sql,
    parameters,
  };
  const client = options.client || dataApiClientFromEnv();
  if (client === "node") {
    return executeStatementWithNodeClient(settings, payload, options);
  }
  if (client === "aws-cli") {
    return executeStatementWithAwsCli(settings, payload, options);
  }
  try {
    return executeStatementWithAwsCli(settings, payload, options);
  } catch (error) {
    if (isMissingAwsCliError(error)) {
      return executeStatementWithNodeClient(settings, payload, options);
    }
    throw error;
  }
}

function executeStatementWithAwsCli(settings, payload, options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), options.tempPrefix || "6529-data-api-"));
  const payloadPath = path.join(tmpDir, "payload.json");
  const execFile = options.execFileSync || execFileSync;
  try {
    fs.writeFileSync(payloadPath, JSON.stringify(payload), "utf8");
    const maxAttempts = options.maxAttempts || 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const stdout = execFile(
          awsCliBin(),
          ["rds-data", "execute-statement", "--region", settings.region, "--cli-input-json", `file://${payloadPath}`],
          {
            encoding: "utf8",
            maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
            stdio: ["ignore", "pipe", "pipe"],
            shell: shouldUseShellForAwsCli(),
          }
        );
        return JSON.parse(stdout || "{}");
      } catch (error) {
        if (attempt >= maxAttempts || !isRetriableDataApiError(error)) {
          throw error;
        }
        sleepSync((options.retryDelayMs || 2000) * attempt);
      }
    }
    return {};
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function executeStatementWithNodeClient(settings, payload, options = {}) {
  const childPath = path.join(__dirname, "data-api-node-client.cjs");
  const execFile = options.execFileSync || execFileSync;
  const input = JSON.stringify({
    region: settings.region,
    payload,
    timeoutMs: options.requestTimeoutMs || options.fetchTimeoutMs || 30000,
  });
  const maxAttempts = options.maxAttempts || 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const stdout = execFile(process.execPath, [childPath], {
        encoding: "utf8",
        input,
        maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return JSON.parse(stdout || "{}");
    } catch (error) {
      if (attempt >= maxAttempts || !isRetriableDataApiError(error)) {
        throw error;
      }
      sleepSync((options.retryDelayMs || 2000) * attempt);
    }
  }
  return {};
}

function dataApiClientFromEnv(env = process.env) {
  const value = String(env.REVIEWBOT_DATA_API_CLIENT || "auto").toLowerCase();
  if (!DATA_API_CLIENTS.includes(value)) {
    throw new Error(
      `REVIEWBOT_DATA_API_CLIENT must be one of: ${DATA_API_CLIENTS.join(", ")}.`
    );
  }
  return value;
}

function awsCliBin() {
  return process.env.AWS_CLI_BIN || "aws";
}

function shouldUseShellForAwsCli() {
  return process.platform === "win32" && !process.env.AWS_CLI_BIN;
}

function isRetriableDataApiError(error) {
  const text = [
    error?.message || "",
    error?.stderr || "",
    Array.isArray(error?.output) ? error.output.join("\n") : "",
  ].join("\n");
  return /DatabaseResumingException|ThrottlingException|TooManyRequestsException|ServiceUnavailable/i.test(text);
}

function isMissingAwsCliError(error) {
  const text = [error?.code || "", error?.message || "", error?.stderr || ""].join("\n");
  return /ENOENT|not found|not recognized/i.test(text);
}

function sleepSync(ms) {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
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
  assertDataApiSettings,
  awsCliBin,
  dataApiClientFromEnv,
  executeStatement,
  fieldValue,
  isMissingAwsCliError,
  isRetriableDataApiError,
  longParam,
  nullableNumber,
  numberValue,
  shouldUseShellForAwsCli,
  stringParam,
};
