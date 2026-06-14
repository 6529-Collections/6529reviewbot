#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
  collectDashboardDeploymentPlan,
  formatDashboardDeploymentPlanMarkdown,
  normalizeDashboardOrigin,
  normalizeHttpsUrl,
  normalizePublicOrg,
  normalizeRoute,
} = require("../src/dashboard-deployment-plan.cjs");
const dashboardDeploymentPlanCli = require("../bin/dashboard-deployment-plan.cjs");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/dashboard-deployment-plan.md",
  "docs/deployment.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
  "docs/release-operations-map.md",
  "docs/6529-io-admin-integration.md",
];

function main() {
  const result = checkDashboardDeploymentPlanContract();
  console.log(
    `dashboard deployment plan contract ok (${result.planCases} plan cases, ${result.docs} docs checked)`
  );
}

function checkDashboardDeploymentPlanContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkReadyPlan(findings);
  checkMissingInputsPlan(findings);
  checkPlaceholderOriginPlan(findings);
  checkOriginValidation(findings);
  checkAuthCheckUrlValidation(findings);
  checkRouteAndOrgValidation(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`dashboard deployment plan contract check found ${findings.length} issue(s).`);
  }

  return {
    planCases: 7,
    docs: targetDocs.length,
  };
}

function checkReadyPlan(findings) {
  const plan = collectDashboardDeploymentPlan({
    release: "0.2.0",
    frontendOrigin: "https://6529.io",
    botOrigin: "https://reviewbot.6529.io",
    operatorWorkspace: "operator-workspace",
    authCheckUrl: "https://6529.io/api/auth/reviewbot",
    publicOrg: "6529-Collections",
    requireInputs: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  if (!plan.ready) {
    findings.push(`complete dashboard deployment plan inputs must be ready: ${plan.errors.join("; ")}`);
  }
  if (plan.release !== "v0.2.0") {
    findings.push("dashboard deployment plan must normalize versions with a v prefix.");
  }
  const markdown = formatDashboardDeploymentPlanMarkdown(plan);
  for (const snippet of [
    "Ready to execute: yes",
    "This command does not deploy 6529.io",
    "templates/6529-io-reviewbot-env.example",
    "REVIEWBOT_USAGE_API_PUBLIC_ORGS=6529-Collections",
    "REVIEWBOT_ADMIN_AUTH_MODE=hmac",
    "npm run admin:snapshot",
    "npm run release:tag-plan",
  ]) {
    if (!markdown.includes(snippet)) {
      findings.push(`ready dashboard deployment plan markdown must include '${snippet}'.`);
    }
  }
}

function checkMissingInputsPlan(findings) {
  const plan = collectDashboardDeploymentPlan({
    release: "v0.2.0",
    requireInputs: true,
  });
  if (plan.ready) {
    findings.push("required dashboard deployment plans must block placeholder inputs.");
  }
  for (const snippet of [
    "6529.io frontend origin",
    "production bot origin",
    "private operator workspace",
    "6529.io auth-check URL",
  ]) {
    if (!plan.errors.some((error) => error.includes(snippet))) {
      findings.push(`missing input errors must include '${snippet}'.`);
    }
  }
}

function checkPlaceholderOriginPlan(findings) {
  const plan = collectDashboardDeploymentPlan({
    release: "v0.2.0",
    frontendOrigin: "https://6529.io",
    botOrigin: "https://reviewbot.example.com",
    operatorWorkspace: "operator-workspace",
    authCheckUrl: "https://6529.io/api/auth/reviewbot",
    requireInputs: true,
  });
  if (plan.ready) {
    findings.push("required dashboard deployment plans must block documentation/example bot origins.");
  }
  if (!plan.errors.some((error) => error.includes("documentation, example, local, or reserved hosts"))) {
    findings.push("dashboard placeholder origin errors must explain the reserved-host requirement.");
  }

  const authPlan = collectDashboardDeploymentPlan({
    release: "v0.2.0",
    frontendOrigin: "https://6529.io",
    botOrigin: "https://reviewbot.6529.io",
    operatorWorkspace: "operator-workspace",
    authCheckUrl: "https://auth.example.com/api/auth/reviewbot",
    requireInputs: true,
  });
  if (authPlan.ready) {
    findings.push("required dashboard deployment plans must block documentation/example auth-check URLs.");
  }
}

function checkOriginValidation(findings) {
  try {
    normalizeDashboardOrigin("http://6529.io", "6529.io frontend origin", "<6529-io-origin>");
    findings.push("dashboard deployment plan must reject non-https frontend origins.");
  } catch (error) {
    if (!String(error.message).includes("must use https")) {
      findings.push("non-https frontend origin rejection should be explicit.");
    }
  }
  try {
    normalizeDashboardOrigin("https://6529.io/path", "6529.io frontend origin", "<6529-io-origin>");
    findings.push("dashboard deployment plan must reject frontend origins with paths.");
  } catch (error) {
    if (!String(error.message).includes("must not include a path")) {
      findings.push("path frontend origin rejection should be explicit.");
    }
  }
}

function checkAuthCheckUrlValidation(findings) {
  try {
    normalizeHttpsUrl("http://6529.io/api/auth/reviewbot", "6529.io auth-check URL", "<6529-auth-check-url>");
    findings.push("dashboard deployment plan must reject non-https auth-check URLs.");
  } catch (error) {
    if (!String(error.message).includes("must use https")) {
      findings.push("non-https auth-check URL rejection should be explicit.");
    }
  }
  try {
    normalizeHttpsUrl("https://6529.io", "6529.io auth-check URL", "<6529-auth-check-url>");
    findings.push("dashboard deployment plan must require an auth-check path.");
  } catch (error) {
    if (!String(error.message).includes("must include the server-side auth-check path")) {
      findings.push("missing auth-check path rejection should be explicit.");
    }
  }
  try {
    normalizeHttpsUrl(
      "https://6529.io/api/auth/reviewbot?token=secret",
      "6529.io auth-check URL",
      "<6529-auth-check-url>"
    );
    findings.push("dashboard deployment plan must reject auth-check URL queries.");
  } catch (error) {
    if (!String(error.message).includes("must not include credentials, a query, or a hash")) {
      findings.push("auth-check query rejection should be explicit.");
    }
  }
}

function checkRouteAndOrgValidation(findings) {
  try {
    normalizeRoute("https://6529.io/open-data/6529bot", "public dashboard route");
    findings.push("dashboard deployment plan must reject URL-shaped dashboard routes.");
  } catch (error) {
    if (!String(error.message).includes("absolute app path")) {
      findings.push("dashboard route rejection should be explicit.");
    }
  }
  try {
    normalizePublicOrg("6529 Collections");
    findings.push("dashboard deployment plan must reject public orgs with whitespace.");
  } catch (error) {
    if (!String(error.message).includes("unsupported characters")) {
      findings.push("public org rejection should be explicit.");
    }
  }
}

function checkCli(findings) {
  try {
    dashboardDeploymentPlanCli.parseArgs(["--nope"]);
    findings.push("dashboard deployment plan CLI must reject unknown arguments.");
  } catch (error) {
    if (!String(error.message).includes("Unknown argument")) {
      findings.push("dashboard deployment plan CLI unknown-argument error should be explicit.");
    }
  }

  const plan = dashboardDeploymentPlanCli.main([
    "--frontend-origin",
    "https://6529.io",
    "--bot-origin",
    "https://reviewbot.6529.io",
    "--operator-workspace",
    "operator-workspace",
    "--auth-check-url",
    "https://6529.io/api/auth/reviewbot",
    "--release",
    "v0.2.0",
    "--require-ready",
    "--quiet",
  ], {
    noExitCode: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
  });
  if (!plan.ready) {
    findings.push("dashboard deployment plan CLI must return ready for complete required inputs.");
  }
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["dashboard:deployment-plan", "check:dashboard-deployment-plan"],
    "src/dashboard-deployment-plan.cjs": [
      "collectDashboardDeploymentPlan",
      "isPlaceholderOrigin",
      "REVIEWBOT_USAGE_API_PUBLIC_ORGS",
      "This command does not deploy 6529.io",
    ],
    "bin/dashboard-deployment-plan.cjs": [
      "npm run dashboard:deployment-plan",
      "--auth-check-url",
      "This command does not deploy 6529.io",
    ],
    "scripts/release-check.cjs": [
      "scripts/check-dashboard-deployment-plan-contract.cjs",
      "bin/dashboard-deployment-plan.cjs",
      "--require-ready",
    ],
    "scripts/smoke-test.cjs": [
      "dashboardDeploymentPlanContractCheck",
      "dashboardDeploymentPlanContractCheck.checkDashboardDeploymentPlanContract",
    ],
    "config/release-operations-map.json": [
      "dashboard-deployment-plan-contract",
      "dashboard-deployment-plan",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run dashboard:deployment-plan",
      "npm run check:dashboard-deployment-plan",
      "[Dashboard Deployment Plan](docs/dashboard-deployment-plan.md)",
    ],
    "docs/dashboard-deployment-plan.md": [
      "npm run dashboard:deployment-plan",
      "--auth-check-url",
      "documentation, example, local, or reserved origin hosts",
      "does not deploy 6529.io",
      "npm run check:dashboard-deployment-plan",
    ],
    "docs/deployment.md": [
      "npm run dashboard:deployment-plan",
      "dashboard deployment plan",
    ],
    "docs/release-readiness.md": [
      "dashboard deployment plan",
      "npm run check:dashboard-deployment-plan",
    ],
    "docs/roadmap.md": [
      "dashboard deployment plan",
      "6529.io dashboard",
    ],
    "docs/release-operations-map.md": [
      "npm run check:dashboard-deployment-plan",
      "dashboard:deployment-plan",
    ],
    "docs/6529-io-admin-integration.md": [
      "npm run dashboard:deployment-plan",
      "REVIEWBOT_USAGE_API_PUBLIC_ORGS",
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
  checkDashboardDeploymentPlanContract,
};
