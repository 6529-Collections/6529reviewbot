#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  collectProductionDeploymentPlan,
  formatProductionDeploymentPlanMarkdown,
  isPlaceholderImageRepository,
  isPlaceholderOrigin,
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
  checkPlaceholderOriginPlan(findings);
  checkPlaceholderImagePlan(findings);
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
    planCases: 7,
    docs: targetDocs.length,
  };
}

function checkReadyPlan(findings) {
  const plan = collectProductionDeploymentPlan({
    release: "0.2.0",
    host: "https://reviewbot.6529.io",
    image: "ghcr.io/6529-collections/6529reviewbot",
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
    "npm --silent run dogfood:promotion -- -- --operator-workspace operator-workspace --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready",
    "npm --silent run dogfood:go-live -- -- --operator-workspace operator-workspace --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready",
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

function checkPlaceholderOriginPlan(findings) {
  const plan = collectProductionDeploymentPlan({
    release: "v0.2.0",
    host: "https://reviewbot.example.com",
    image: "ghcr.io/6529-collections/6529reviewbot",
    operatorWorkspace: "operator-workspace",
    requireInputs: true,
  });
  if (plan.ready) {
    findings.push("required production deployment plans must block documentation/example origins.");
  }
  if (!plan.errors.some((error) => error.includes("documentation, example, local, or reserved hosts"))) {
    findings.push("placeholder origin errors must explain the reserved-host requirement.");
  }
  if (!isPlaceholderOrigin("https://reviewbot.example.com")) {
    findings.push("production deployment plan must classify example origins as placeholders.");
  }
  if (!isPlaceholderOrigin("https://localhost")) {
    findings.push("production deployment plan must classify local origins as placeholders.");
  }
}

function checkPlaceholderImagePlan(findings) {
  const plan = collectProductionDeploymentPlan({
    release: "v0.2.0",
    host: "https://reviewbot.6529.io",
    image: "registry.example.com/6529reviewbot",
    operatorWorkspace: "operator-workspace",
    requireInputs: true,
  });
  if (plan.ready) {
    findings.push("required production deployment plans must block documentation/example image registries.");
  }
  if (!plan.errors.some((error) => error.includes("documentation, example, local, or reserved registries"))) {
    findings.push("production deployment placeholder registry errors must explain the reserved-registry requirement.");
  }
  if (!isPlaceholderImageRepository("registry.example.com/6529reviewbot")) {
    findings.push("production deployment plan must classify example image registries as placeholders.");
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
    normalizeImageRef("registry.example.com/team:latest/6529reviewbot");
    findings.push("production deployment plan must reject image refs with tag-like path segments.");
  } catch (error) {
    if (!String(error.message).includes("must not include a tag")) {
      findings.push("production deployment image path-segment tag rejection should be explicit.");
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
  try {
    normalizeImageRef("registry.example.com/6529ReviewBot");
    findings.push("production deployment plan must reject image refs with uppercase repository characters.");
  } catch (error) {
    if (!String(error.message).includes("lowercase")) {
      findings.push("production deployment image uppercase rejection should be explicit.");
    }
  }
  if (normalizeImageRef("registry.example.com:5000/6529reviewbot") !== "registry.example.com:5000/6529reviewbot") {
    findings.push("production deployment plan must allow numeric registry ports.");
  }
  try {
    normalizeImageRef("registry.example.com:port/6529reviewbot");
    findings.push("production deployment plan must reject image refs with non-numeric registry ports.");
  } catch (error) {
    if (!String(error.message).includes("registry port")) {
      findings.push("production deployment image non-numeric port rejection should be explicit.");
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
    "https://reviewbot.6529.io",
    "--image",
    "ghcr.io/6529-collections/6529reviewbot",
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

  const helpText = captureStdout(() => productionDeploymentPlanCli.main(["--help"]));
  checkSnippets(helpText, [
    "--host <production-bot-origin>",
    "--image <operator-registry>/6529reviewbot",
    "--operator-workspace <private-workspace-dir>",
    "--require-ready",
  ], "production deployment plan CLI help", findings);
  checkRequireReadyHelpDoesNotUseExampleOrigin(helpText, "production deployment plan CLI help", findings);
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["production:deployment-plan", "check:production-deployment-plan"],
    "src/production-deployment-plan.cjs": [
      "collectProductionDeploymentPlan",
      "container:publish-plan",
      "isPlaceholderImageRepository",
      "isPlaceholderOrigin",
      "normalizeImageRepositoryRef",
      "<reviewed-model-price-file.json>",
      "This command does not create GitHub Apps",
    ],
    "src/image-repository-ref.cjs": [
      "normalizeImageRepositoryRef",
      "URL scheme",
      "empty path segments",
      "registry port",
      "lowercase",
    ],
    "bin/production-deployment-plan.cjs": [
      "npm run production:deployment-plan",
      "--host <production-bot-origin>",
      "--image <operator-registry>/6529reviewbot",
      "--require-ready",
      "This command does not create GitHub Apps",
    ],
    "scripts/release-check.cjs": [
      "scripts/check-production-deployment-plan-contract.cjs",
      "bin/production-deployment-plan.cjs",
      "--require-ready",
    ],
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
      "npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --release v0.1.0",
      "--require-ready",
      "without a URL scheme",
      "empty path segments",
      "registry port",
      "lowercase",
      "documentation, example, local, or reserved origin hosts",
      "documentation, example, local, or reserved registries",
      "does not create GitHub Apps",
      "--model-price-file <reviewed-model-price-file.json>",
      "npm run check:production-deployment-plan",
    ],
    "docs/deployment.md": [
      "npm run production:deployment-plan",
      "production deployment plan",
      "npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready",
      "npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready",
    ],
    "docs/release-readiness.md": [
      "production deployment plan",
      "npm run check:production-deployment-plan",
      "npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready",
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

function checkRequireReadyHelpDoesNotUseExampleOrigin(helpText, label, findings) {
  const readyLines = String(helpText)
    .split(/\r?\n/)
    .filter((line) => line.includes("--require-ready"));
  if (!readyLines.length) {
    findings.push(`${label} must include a --require-ready example.`);
    return;
  }
  for (const line of readyLines) {
    if (line.includes("reviewbot.example.com")) {
      findings.push(`${label} --require-ready examples must not use documentation/example origins.`);
    }
  }
}

function captureStdout(callback) {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = (chunk) => {
    output += String(chunk);
    return true;
  };
  try {
    callback();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
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
