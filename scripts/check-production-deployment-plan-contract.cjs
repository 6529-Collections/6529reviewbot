#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  collectProductionDeploymentPlan,
  formatProductionDeploymentPlanMarkdown,
  normalizeImageRef,
  normalizeWorkspace,
  normalizeOrigin,
} = require("../src/production-deployment-plan.cjs");
const productionDeploymentPlanCli = require("../bin/production-deployment-plan.cjs");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/production-deployment-plan.md",
  "docs/deployment.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
  "docs/release-operations-map.md",
];

function main() {
  const result = checkProductionDeploymentPlanContract();
  console.log(
    `production deployment plan contract ok (${result.planCases} plan cases, ${result.docs} docs checked)`
  );
}

function checkProductionDeploymentPlanContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkReadyPlan(findings);
  checkMissingInputsPlan(findings);
  checkOriginValidation(findings);
  checkImageValidation(findings);
  checkWorkspaceValidation(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`production deployment plan contract check found ${findings.length} issue(s).`);
  }

  return {
    planCases: 5,
    docs: targetDocs.length,
  };
}

function checkReadyPlan(findings) {
  const plan = collectProductionDeploymentPlan({
    release: "0.2.0",
    host: "https://reviewbot.example.com",
    image: "registry.example.com/6529reviewbot",
    operatorWorkspace: "operator-workspace",
    requireInputs: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  if (!plan.ready) {
    findings.push(`complete production deployment plan inputs must be ready: ${plan.errors.join("; ")}`);
  }
  if (plan.release !== "v0.2.0") {
    findings.push("production deployment plan must normalize versions with a v prefix.");
  }
  const markdown = formatProductionDeploymentPlanMarkdown(plan);
  for (const snippet of [
    "Ready to execute: yes",
    "This command does not create GitHub Apps",
    "npm run github-app:manifest",
    "npm run container:publish-plan",
    "npm run admin:snapshot",
    "npm --silent run dogfood:go-live",
  ]) {
    if (!markdown.includes(snippet)) {
      findings.push(`ready production deployment plan markdown must include '${snippet}'.`);
    }
  }
}

function checkMissingInputsPlan(findings) {
  const plan = collectProductionDeploymentPlan({
    release: "v0.2.0",
    requireInputs: true,
  });
  if (plan.ready) {
    findings.push("required production deployment plans must block placeholder inputs.");
  }
  for (const snippet of [
    "production bot origin",
    "operator-owned image repository",
    "private operator workspace",
  ]) {
    if (!plan.errors.some((error) => error.includes(snippet))) {
      findings.push(`missing input errors must include '${snippet}'.`);
    }
  }
}

function checkOriginValidation(findings) {
  try {
    normalizeOrigin("http://reviewbot.example.com");
    findings.push("production deployment plan must reject non-https origins.");
  } catch (error) {
    if (!String(error.message).includes("must use https")) {
      findings.push("non-https origin rejection should be explicit.");
    }
  }
  try {
    normalizeOrigin("https://reviewbot.example.com/path");
    findings.push("production deployment plan must reject origins with paths.");
  } catch (error) {
    if (!String(error.message).includes("must not include a path")) {
      findings.push("path origin rejection should be explicit.");
    }
  }
}

function checkImageValidation(findings) {
  try {
    normalizeImageRef("https://registry.example.com/6529reviewbot");
    findings.push("production deployment plan must reject image refs that include URL schemes.");
  } catch (error) {
    if (!String(error.message).includes("URL scheme")) {
      findings.push("production deployment image URL scheme rejection should be explicit.");
    }
  }
  try {
    normalizeImageRef("registry.example.com//6529reviewbot");
    findings.push("production deployment plan must reject image refs with empty path segments.");
  } catch (error) {
    if (!String(error.message).includes("empty path segments")) {
      findings.push("production deployment image empty-segment rejection should be explicit.");
    }
  }
}

function checkWorkspaceValidation(findings) {
  try {
    normalizeWorkspace("operator workspace");
    findings.push("production deployment plan must reject workspaces with shell-breaking whitespace.");
  } catch (error) {
    if (!String(error.message).includes("unsupported shell characters")) {
      findings.push("workspace whitespace rejection should be explicit.");
    }
  }
}

function checkCli(findings) {
  try {
    productionDeploymentPlanCli.parseArgs(["--nope"]);
    findings.push("production deployment plan CLI must reject unknown arguments.");
  } catch (error) {
    if (!String(error.message).includes("Unknown argument")) {
      findings.push("production deployment plan CLI unknown-argument error should be explicit.");
    }
  }

  const plan = productionDeploymentPlanCli.main([
    "--host",
    "https://reviewbot.example.com",
    "--image",
    "registry.example.com/6529reviewbot",
    "--operator-workspace",
    "operator-workspace",
    "--release",
    "v0.2.0",
    "--require-ready",
    "--quiet",
  ], {
    noExitCode: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  if (!plan.ready) {
    findings.push("production deployment plan CLI must return ready for complete required inputs.");
  }
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["production:deployment-plan", "check:production-deployment-plan"],
    "src/production-deployment-plan.cjs": [
      "collectProductionDeploymentPlan",
      "container:publish-plan",
      "URL scheme",
      "empty path segments",
      "This command does not create GitHub Apps",
    ],
    "bin/production-deployment-plan.cjs": [
      "npm run production:deployment-plan",
      "--require-ready",
      "This command does not create GitHub Apps",
    ],
    "scripts/release-check.cjs": ["scripts/check-production-deployment-plan-contract.cjs"],
    "scripts/smoke-test.cjs": [
      "productionDeploymentPlanContractCheck",
      "productionDeploymentPlanContractCheck.checkProductionDeploymentPlanContract",
    ],
    "config/release-operations-map.json": [
      "production-deployment-plan-contract",
      "production-deployment-plan",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run production:deployment-plan",
      "npm run check:production-deployment-plan",
      "[Production Deployment Plan](docs/production-deployment-plan.md)",
    ],
    "docs/production-deployment-plan.md": [
      "npm run production:deployment-plan",
      "--require-ready",
      "without a URL scheme",
      "empty path segments",
      "does not create GitHub Apps",
      "npm run check:production-deployment-plan",
    ],
    "docs/deployment.md": [
      "npm run production:deployment-plan",
      "production deployment plan",
    ],
    "docs/release-readiness.md": [
      "production deployment plan",
      "npm run check:production-deployment-plan",
    ],
    "docs/roadmap.md": [
      "production deployment plan",
      "operator handoff",
    ],
    "docs/release-operations-map.md": [
      "npm run check:production-deployment-plan",
      "production:deployment-plan",
    ],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function checkSnippets(text, snippets, label, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of snippets) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`${label} must include '${snippet}'.`);
    }
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
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
  checkProductionDeploymentPlanContract,
};
