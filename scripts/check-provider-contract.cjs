#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const {
  PROVIDERS,
  loadModelCatalog,
} = require("../src/model-catalog.cjs");
const {
  PROVIDER_KEYS,
} = require("../src/preflight.cjs");

const root = path.resolve(__dirname, "..");
const providerDispatchWorkflowPaths = [
  ".github/workflows/review-job.yml",
  "templates/review-job-workflow.yml",
];
const providerDocs = [
  {
    path: "README.md",
    requiredText: `REVIEW_PROVIDER               ${humanProviderList(PROVIDERS)}`,
  },
  {
    path: "docs/configuration.md",
    requiredText: `REVIEW_PROVIDER=${PROVIDERS.join("|")}`,
  },
  {
    path: "docs/budget-policies.md",
    requiredText: `\`provider\`, with ${backtickProviderList(PROVIDERS)};`,
  },
];

function main() {
  const result = checkProviderContract();
  console.log(
    `provider contract ok (${result.providers} providers, ${result.dispatchWorkflows} dispatch workflows checked)`
  );
}

function checkProviderContract(options = {}) {
  const findings = [];
  const providers = options.providers || PROVIDERS;
  const catalog = options.catalog || loadModelCatalog();
  const providerKeys = options.providerKeys || PROVIDER_KEYS;

  checkCatalogProviders(catalog, providers, findings);
  checkProviderKeys(providerKeys, providers, findings);
  checkDispatchWorkflowProviderOptions(
    options.dispatchWorkflowTexts || {},
    providers,
    findings
  );
  checkProviderDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`provider contract check found ${findings.length} issue(s).`);
  }

  return {
    providers: providers.length,
    dispatchWorkflows: providerDispatchWorkflowPaths.length,
  };
}

function checkCatalogProviders(catalog, providers, findings) {
  const catalogProviders = Object.keys(catalog.providers || {});
  if (!arraysEqual(catalogProviders, providers)) {
    findings.push(
      `config/model-catalog.json provider keys must be ${JSON.stringify(
        providers
      )}, got ${JSON.stringify(catalogProviders)}.`
    );
  }
}

function checkProviderKeys(providerKeys, providers, findings) {
  const keyProviders = Object.keys(providerKeys || {});
  if (!arraysEqual(keyProviders, providers)) {
    findings.push(
      `src/preflight.cjs PROVIDER_KEYS keys must be ${JSON.stringify(
        providers
      )}, got ${JSON.stringify(keyProviders)}.`
    );
  }
  for (const provider of providers) {
    const expected = `${provider.toUpperCase()}_API_KEY`;
    if (providerKeys[provider] !== expected) {
      findings.push(`src/preflight.cjs provider '${provider}' key must be ${expected}.`);
    }
  }
}

function checkDispatchWorkflowProviderOptions(workflowTexts, providers, findings) {
  for (const workflowPath of providerDispatchWorkflowPaths) {
    const text = workflowTexts[workflowPath] || fs.readFileSync(path.join(root, workflowPath), "utf8");
    const workflow = YAML.parse(text);
    const providerInput =
      workflow?.on?.workflow_dispatch?.inputs?.provider ||
      workflow?.true?.workflow_dispatch?.inputs?.provider;
    if (!providerInput) {
      findings.push(`${workflowPath} must define workflow_dispatch input provider.`);
      continue;
    }
    if (providerInput.type !== "choice") {
      findings.push(`${workflowPath} provider input must be a choice.`);
    }
    if (!arraysEqual(providerInput.options, providers)) {
      findings.push(
        `${workflowPath} provider options must be ${JSON.stringify(
          providers
        )}, got ${JSON.stringify(providerInput.options || null)}.`
      );
    }
  }
}

function checkProviderDocs(docTexts, findings) {
  for (const doc of providerDocs) {
    const text = docTexts[doc.path] || fs.readFileSync(path.join(root, doc.path), "utf8");
    if (!text.includes(doc.requiredText)) {
      findings.push(`${doc.path} must include '${doc.requiredText}'.`);
    }
  }
}

function humanProviderList(providers) {
  if (providers.length <= 2) {
    return providers.join(" or ");
  }
  return `${providers.slice(0, -1).join(", ")}, or ${providers.at(-1)}`;
}

function backtickProviderList(providers) {
  if (providers.length <= 2) {
    return providers.map((provider) => `\`${provider}\``).join(" or ");
  }
  return `${providers
    .slice(0, -1)
    .map((provider) => `\`${provider}\``)
    .join(", ")}, or \`${providers.at(-1)}\``;
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
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
  arraysEqual,
  backtickProviderList,
  checkProviderContract,
  humanProviderList,
};
