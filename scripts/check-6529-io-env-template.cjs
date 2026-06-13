#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const DEFAULT_TEMPLATE_PATH = "templates/6529-io-reviewbot-env.example";
const DEFAULT_OPENAPI_PATH = "docs/usage-api.openapi.json";

const REQUIRED_KEYS = [
  "REVIEWBOT_USAGE_API_BASE_URL",
  "REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH",
  "REVIEWBOT_USAGE_ADMIN_ALLOWED_WALLETS",
  "REVIEWBOT_USAGE_ADMIN_AUTH_CHECK_URL",
  "REVIEWBOT_USAGE_API_ADMIN_HMAC_SECRET",
  "REVIEWBOT_USAGE_API_ADMIN_ROLES",
  "REVIEWBOT_USAGE_API_ADMIN_TTL_SECONDS",
  "REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_MODEL_PRICE_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH",
];

const BLANK_PLACEHOLDER_KEYS = [
  "REVIEWBOT_USAGE_ADMIN_ALLOWED_WALLETS",
  "REVIEWBOT_USAGE_ADMIN_AUTH_CHECK_URL",
  "REVIEWBOT_USAGE_API_ADMIN_HMAC_SECRET",
];

const PATH_KEYS = [
  "REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_MODEL_PRICE_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH",
  "REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH",
];

function main() {
  try {
    check6529IoEnvTemplate();
    console.log("6529.io env template ok");
  } catch (error) {
    console.error(`6529.io env template check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

function check6529IoEnvTemplate(options = {}) {
  const templatePath = path.resolve(root, options.templatePath || DEFAULT_TEMPLATE_PATH);
  const openapiPath = path.resolve(root, options.openapiPath || DEFAULT_OPENAPI_PATH);
  const values = parseEnvTemplate(fs.readFileSync(templatePath, "utf8"));
  const openapi = JSON.parse(fs.readFileSync(openapiPath, "utf8"));
  const openapiPaths = new Set(Object.keys(openapi.paths || {}));

  for (const key of REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`${key} is missing from ${relative(templatePath)}`);
    }
  }

  for (const key of BLANK_PLACEHOLDER_KEYS) {
    if (values[key]) {
      throw new Error(`${key} must stay blank in the public template.`);
    }
  }

  const baseUrl = new URL(values.REVIEWBOT_USAGE_API_BASE_URL);
  if (baseUrl.hostname !== "reviewbot.example.com") {
    throw new Error("REVIEWBOT_USAGE_API_BASE_URL must use reviewbot.example.com.");
  }
  if (baseUrl.protocol !== "https:") {
    throw new Error("REVIEWBOT_USAGE_API_BASE_URL must use https.");
  }

  if (values.REVIEWBOT_USAGE_API_ADMIN_ROLES !== "reviewbot-admin") {
    throw new Error("REVIEWBOT_USAGE_API_ADMIN_ROLES must default to reviewbot-admin.");
  }
  if (values.REVIEWBOT_USAGE_API_ADMIN_TTL_SECONDS !== "300") {
    throw new Error("REVIEWBOT_USAGE_API_ADMIN_TTL_SECONDS must default to 300.");
  }

  for (const key of PATH_KEYS) {
    const configuredPath = pathWithoutQuery(values[key]);
    if (!openapiPaths.has(configuredPath)) {
      throw new Error(`${key} path '${configuredPath}' is not in ${relative(openapiPath)}.`);
    }
  }

  return {
    keyCount: Object.keys(values).length,
    pathCount: PATH_KEYS.length,
  };
}

function parseEnvTemplate(text) {
  const values = {};
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      throw new Error(`invalid env line ${index + 1}`);
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) {
      throw new Error(`invalid env key '${key}' on line ${index + 1}`);
    }
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`duplicate env key '${key}'`);
    }
    values[key] = value;
  }
  return values;
}

function pathWithoutQuery(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    throw new Error(`invalid API path '${raw}'`);
  }
  return raw.split("?", 1)[0];
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

if (require.main === module) {
  main();
}

module.exports = {
  check6529IoEnvTemplate,
  parseEnvTemplate,
};
