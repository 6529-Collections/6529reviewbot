#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const { parseEnvTemplate } = require("./check-6529-io-env-template.cjs");
const {
  PROVIDERS,
  loadModelCatalog,
} = require("../src/model-catalog.cjs");

const root = path.resolve(__dirname, "..");
const reusableWorkflowPath = ".github/workflows/review.yml";
const providerDefaultDocs = ["README.md", "docs/configuration.md"];
const catalogDocPath = "docs/model-catalog.md";
const dogfoodEnvTemplatePath = "templates/dogfood-central-env.example";
const anthropicLaneConfigPaths = [
  ".github/6529bot.yml",
  "templates/dogfood-command-only-config.yml",
  "templates/dogfood-repository-config.yml",
  "templates/repository-config.yml",
];

function main() {
  const result = checkModelDefaults();
  console.log(
    `model defaults ok (${result.providers} providers, ${result.configs} lane configs checked)`
  );
}

function checkModelDefaults(options = {}) {
  const findings = [];
  const catalog = options.catalog || loadModelCatalog();
  const workflowText =
    options.workflowText ||
    fs.readFileSync(path.join(root, reusableWorkflowPath), "utf8");

  checkWorkflowDefaults(catalog, workflowText, findings);
  checkProviderDefaultDocs(catalog, options.docTexts || {}, findings);
  checkCatalogDoc(catalog, options.catalogDocText, findings);
  checkDogfoodEnvTemplate(catalog, options.dogfoodEnvText, findings);
  checkAnthropicLaneConfigs(catalog, options.configTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`model default check found ${findings.length} issue(s).`);
  }

  return {
    providers: PROVIDERS.length,
    configs: anthropicLaneConfigPaths.length,
  };
}

function checkWorkflowDefaults(catalog, text, findings) {
  const workflow = YAML.parse(text);
  const providerInputDefault =
    workflow?.on?.workflow_call?.inputs?.provider?.default ||
    workflow?.true?.workflow_call?.inputs?.provider?.default;
  if (providerInputDefault !== catalog.defaultProvider) {
    findings.push(
      `${reusableWorkflowPath} provider input default must be '${catalog.defaultProvider}'.`
    );
  }

  const providerFallback = workflowEnvFallback(text, "REVIEW_PROVIDER");
  if (providerFallback !== catalog.defaultProvider) {
    findings.push(
      `${reusableWorkflowPath} REVIEW_PROVIDER fallback must be '${catalog.defaultProvider}'.`
    );
  }

  for (const provider of PROVIDERS) {
    const envName = `REVIEW_DEFAULT_${provider.toUpperCase()}_MODEL`;
    const expected = catalog.providers[provider].defaultModel || "";
    const actual = workflowEnvFallback(text, envName);
    if (actual !== expected) {
      findings.push(
        `${reusableWorkflowPath} ${envName} fallback must be '${expected}', got '${actual || ""}'.`
      );
    }
  }
}

function checkProviderDefaultDocs(catalog, docTexts, findings) {
  for (const docPath of providerDefaultDocs) {
    const text = docTexts[docPath] || fs.readFileSync(path.join(root, docPath), "utf8");
    for (const provider of PROVIDERS) {
      const envName = `REVIEW_DEFAULT_${provider.toUpperCase()}_MODEL`;
      const expected = `${envName}=${catalog.providers[provider].defaultModel || ""}`;
      if (!text.includes(expected)) {
        findings.push(`${docPath} must include '${expected}'.`);
      }
    }
  }
}

function checkCatalogDoc(catalog, text, findings) {
  const doc = text || fs.readFileSync(path.join(root, catalogDocPath), "utf8");
  for (const provider of PROVIDERS) {
    const expectedLabel = catalog.providers[provider].defaultModel || "explicit model required";
    const pattern = new RegExp(`^${escapeRegExp(provider)}\\s+${escapeRegExp(expectedLabel)}$`, "m");
    if (!pattern.test(doc)) {
      findings.push(`${catalogDocPath} must list '${provider} ${expectedLabel}'.`);
    }
  }
}

function checkDogfoodEnvTemplate(catalog, text, findings) {
  const envText = text || fs.readFileSync(path.join(root, dogfoodEnvTemplatePath), "utf8");
  const values = parseEnvTemplate(envText);
  const expected = anthropicDefaultLane(catalog);
  if (values.REVIEWBOT_REVIEW_LANES !== expected) {
    findings.push(
      `${dogfoodEnvTemplatePath}:REVIEWBOT_REVIEW_LANES must be '${expected}'.`
    );
  }
}

function checkAnthropicLaneConfigs(catalog, configTexts, findings) {
  const expected = catalog.providers.anthropic.defaultModel;
  for (const configPath of anthropicLaneConfigPaths) {
    const text = configTexts[configPath] || fs.readFileSync(path.join(root, configPath), "utf8");
    const config = YAML.parse(text);
    const lanes = Array.isArray(config?.lanes) ? config.lanes : [];
    const anthropicLanes = lanes.filter((lane) => lane?.provider === "anthropic");
    if (!anthropicLanes.length) {
      findings.push(`${configPath} must include an Anthropic starter lane.`);
      continue;
    }
    for (const lane of anthropicLanes) {
      if (lane.model !== expected) {
        findings.push(`${configPath} Anthropic lane must use '${expected}'.`);
      }
    }
  }
}

function workflowEnvFallback(text, envName) {
  const pattern = new RegExp(
    `${escapeRegExp(envName)}:\\s*\\$\\{\\{\\s*(?:inputs\\.[A-Za-z_]+\\s*\\|\\|\\s*)?vars\\.${escapeRegExp(
      envName
    )}\\s*\\|\\|\\s*'([^']*)'\\s*\\}\\}`
  );
  return text.match(pattern)?.[1] ?? null;
}

function anthropicDefaultLane(catalog) {
  return `anthropic:${catalog.providers.anthropic.defaultModel}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  anthropicDefaultLane,
  checkModelDefaults,
  workflowEnvFallback,
};
