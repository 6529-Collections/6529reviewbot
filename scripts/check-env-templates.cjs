#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { parseEnvTemplate } = require("./check-6529-io-env-template.cjs");
const { loadModelCatalog } = require("../src/model-catalog.cjs");

const root = path.resolve(__dirname, "..");
const DEFAULT_ENV_TEMPLATES = [
  ".env.example",
  "templates/dogfood-central-env.example",
  "templates/6529-io-reviewbot-env.example",
];
const SENSITIVE_KEY_SUFFIXES = [
  "_API_KEY",
  "_ARN",
  "_HMAC_SECRET",
  "_PRIVATE_KEY",
  "_PRIVATE_KEY_BASE64",
  "_SECRET",
  "_SES_FROM",
  "_SES_TO",
  "_TOKEN",
  "_WEBHOOK_URL",
];
function main() {
  try {
    const result = checkEnvTemplates();
    console.log(`env templates ok (${result.files.length} files checked)`);
  } catch (error) {
    console.error(`env template check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

function checkEnvTemplates(options = {}) {
  const files = options.files || DEFAULT_ENV_TEMPLATES;
  const requiredValues = options.requiredValues || requiredTemplateValues(options.catalog);
  const checked = [];
  for (const file of files) {
    checked.push(checkEnvTemplate(file, { requiredValues }));
  }
  return { files: checked };
}

function checkEnvTemplate(file, options = {}) {
  const absolutePath = path.resolve(root, file);
  const relativePath = relative(absolutePath);
  const requiredValues = options.requiredValues || requiredTemplateValues(options.catalog);
  const values = parseEnvTemplate(fs.readFileSync(absolutePath, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (/[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error(`${relativePath}:${key} contains a control character.`);
    }
    if (isSensitiveTemplateKey(key) && value) {
      throw new Error(`${relativePath}:${key} must stay blank in public env templates.`);
    }
  }
  for (const [key, expected] of Object.entries(requiredValues[relativePath] || {})) {
    if (values[key] !== expected) {
      throw new Error(`${relativePath}:${key} must be '${expected}'.`);
    }
  }
  return {
    file: relativePath,
    keyCount: Object.keys(values).length,
    blankSensitiveKeyCount: Object.keys(values).filter(isSensitiveTemplateKey).length,
  };
}

function requiredTemplateValues(catalog = loadModelCatalog()) {
  return {
    "templates/dogfood-central-env.example": {
      REVIEWBOT_BUDGET_MODE: "enforce",
      REVIEWBOT_ENABLED: "true",
      REVIEWBOT_PUBLIC_REPO_MODE: "trusted",
      REVIEWBOT_REPOSITORY_CONFIG_SOURCE: "github",
      REVIEWBOT_REVIEW_LANES: `anthropic:${catalog.providers.anthropic.defaultModel}`,
      REVIEWBOT_WORKER_ADAPTER: "noop",
      REVIEW_USAGE_ENABLED: "true",
    },
    "templates/6529-io-reviewbot-env.example": {
      REVIEWBOT_USAGE_API_ADMIN_ROLES: "reviewbot-admin",
      REVIEWBOT_USAGE_API_ADMIN_TTL_SECONDS: "300",
    },
  };
}

function isSensitiveTemplateKey(key) {
  return SENSITIVE_KEY_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_ENV_TEMPLATES,
  checkEnvTemplate,
  checkEnvTemplates,
  isSensitiveTemplateKey,
  requiredTemplateValues,
};
