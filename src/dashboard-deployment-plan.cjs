"use strict";

const { normalizeOrigin, normalizeWorkspace } = require("./production-deployment-plan.cjs");
const { normalizeReleaseVersion } = require("./release-notes-draft.cjs");

const DEFAULT_FRONTEND_ORIGIN = "<6529-io-origin>";
const DEFAULT_BOT_ORIGIN = "<production-bot-origin>";
const DEFAULT_OPERATOR_WORKSPACE = "<private-workspace-dir>";
const DEFAULT_AUTH_CHECK_URL = "<6529-auth-check-url>";
const DEFAULT_PUBLIC_ORG = "6529-Collections";
const DEFAULT_PUBLIC_ROUTE = "/open-data/6529bot";
const DEFAULT_ADMIN_ROUTE = "/tools/6529bot/admin";
const DRY_RUN_NOTICE =
  "This command does not deploy 6529.io, create secrets, call auth endpoints, run checks, or expose dashboards.";

function collectDashboardDeploymentPlan(options = {}) {
  const release = normalizeReleaseVersion(options.release || options.version || "v0.1.0");
  const frontendOrigin = normalizeDashboardOrigin(
    options.frontendOrigin || options.frontend || DEFAULT_FRONTEND_ORIGIN,
    "6529.io frontend origin",
    DEFAULT_FRONTEND_ORIGIN
  );
  const botOrigin = normalizeDashboardOrigin(
    options.botOrigin || options.host || options.origin || DEFAULT_BOT_ORIGIN,
    "production bot origin",
    DEFAULT_BOT_ORIGIN
  );
  const operatorWorkspace = normalizeWorkspace(
    options.operatorWorkspace || options.workspace || DEFAULT_OPERATOR_WORKSPACE
  );
  const authCheckUrl = normalizeHttpsUrl(
    options.authCheckUrl || DEFAULT_AUTH_CHECK_URL,
    "6529.io auth-check URL",
    DEFAULT_AUTH_CHECK_URL
  );
  const publicOrg = normalizePublicOrg(options.publicOrg || DEFAULT_PUBLIC_ORG);
  const publicRoute = normalizeRoute(options.publicRoute || DEFAULT_PUBLIC_ROUTE, "public dashboard route");
  const adminRoute = normalizeRoute(options.adminRoute || DEFAULT_ADMIN_ROUTE, "private admin dashboard route");
  const errors = [];
  const warnings = [];

  if (options.requireInputs) {
    if (frontendOrigin === DEFAULT_FRONTEND_ORIGIN) {
      errors.push("6529.io frontend origin was not supplied.");
    }
    if (botOrigin === DEFAULT_BOT_ORIGIN) {
      errors.push("production bot origin was not supplied.");
    }
    if (operatorWorkspace === DEFAULT_OPERATOR_WORKSPACE) {
      errors.push("private operator workspace was not supplied.");
    }
    if (authCheckUrl === DEFAULT_AUTH_CHECK_URL) {
      errors.push("6529.io auth-check URL was not supplied.");
    }
  } else {
    if (frontendOrigin === DEFAULT_FRONTEND_ORIGIN) {
      warnings.push("6529.io frontend origin was not supplied; using placeholder commands.");
    }
    if (botOrigin === DEFAULT_BOT_ORIGIN) {
      warnings.push("production bot origin was not supplied; using placeholder commands.");
    }
    if (operatorWorkspace === DEFAULT_OPERATOR_WORKSPACE) {
      warnings.push("private operator workspace was not supplied; using placeholder commands.");
    }
    if (authCheckUrl === DEFAULT_AUTH_CHECK_URL) {
      warnings.push("6529.io auth-check URL was not supplied; using placeholder commands.");
    }
  }

  if (
    frontendOrigin !== DEFAULT_FRONTEND_ORIGIN ||
    botOrigin !== DEFAULT_BOT_ORIGIN ||
    operatorWorkspace !== DEFAULT_OPERATOR_WORKSPACE ||
    authCheckUrl !== DEFAULT_AUTH_CHECK_URL
  ) {
    warnings.push("dashboard deployment plan output can include private origins, paths, and auth endpoint names.");
  }

  const ready = errors.length === 0;
  return {
    version: 1,
    release,
    ready,
    generatedAt: (options.now || new Date()).toISOString(),
    inputs: {
      frontendOrigin,
      botOrigin,
      operatorWorkspace,
      authCheckUrl,
      publicOrg,
      publicRoute,
      adminRoute,
    },
    errors,
    warnings,
    phases: dashboardDeploymentPhases({
      release,
      frontendOrigin,
      botOrigin,
      operatorWorkspace,
      authCheckUrl,
      publicOrg,
      publicRoute,
      adminRoute,
    }),
  };
}

function dashboardDeploymentPhases({
  release,
  frontendOrigin,
  botOrigin,
  operatorWorkspace,
  authCheckUrl,
  publicOrg,
  publicRoute,
  adminRoute,
}) {
  const envFile = `${operatorWorkspace}/6529-io-reviewbot-env`;
  const cutoverStatus = `${operatorWorkspace}/production-cutover-status.json`;
  return [
    {
      id: "frontend-env",
      title: "6529.io Environment",
      commands: [
        `cp templates/6529-io-reviewbot-env.example ${envFile}`,
        `configure REVIEWBOT_USAGE_API_BASE_URL=${botOrigin}`,
        `configure REVIEWBOT_USAGE_ADMIN_AUTH_CHECK_URL=${authCheckUrl}`,
        "configure REVIEWBOT_USAGE_ADMIN_ALLOWED_WALLETS=<operator-wallet-allowlist>",
        "configure REVIEWBOT_USAGE_API_ADMIN_HMAC_SECRET=<shared-hmac-secret>",
        "npm run check:6529-io-env",
      ],
      evidence:
        "Record that the 6529.io private config copied the reviewed template, replaced placeholders only in the private secret/config system, and kept live wallets, auth URLs, and HMAC secrets out of this public repo.",
    },
    {
      id: "bot-admin-auth",
      title: "Bot Admin Auth",
      commands: [
        "configure REVIEWBOT_USAGE_API_PUBLIC_ENABLED=true",
        `configure REVIEWBOT_USAGE_API_PUBLIC_ORGS=${publicOrg}`,
        "configure REVIEWBOT_ADMIN_AUTH_MODE=hmac",
        "configure REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES=reviewbot-admin",
        "configure REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS=300",
        "configure REVIEWBOT_ADMIN_AUTH_HMAC_SECRET=<shared-hmac-secret>",
        "npm run check:admin-auth",
        "npm run check:usage-api-routes",
      ],
      evidence:
        "Record that the production bot and 6529.io server-side bridge use the same private HMAC secret, expected role, and TTL before any private admin route is exposed.",
    },
    {
      id: "dashboard-verification",
      title: "Dashboard Verification",
      commands: [
        `verify public dashboard route ${frontendOrigin}${publicRoute}`,
        `verify private admin auth gate ${frontendOrigin}${adminRoute}`,
        `npm run admin:snapshot -- -- --base-url ${botOrigin} --require-ok`,
      ],
      evidence:
        "Record screenshots or private operator notes proving the public Open Data route renders allowed summaries and the private admin route requires 6529.io auth before fetching admin data.",
    },
    {
      id: "cutover-evidence",
      title: "Cutover Evidence",
      commands: [
        `npm run production:cutover -- -- --status-file ${cutoverStatus} --summary`,
        `npm run production:cutover -- -- --status-file ${cutoverStatus} --require-ready`,
        `npm run release:candidate -- -- --operator-workspace ${operatorWorkspace} --strict-preflight`,
      ],
      evidence:
        "Record release-candidate and cutover summaries that mark dashboard production configuration, deployment, HMAC bridge wiring, and operator verification complete or explicitly deferred.",
    },
    {
      id: "release-notes",
      title: "Release Notes",
      commands: [
        "npm run release:notes",
        `npm run release:tag-plan -- -- --release ${release} --release-notes <release-notes.md> --require-ready`,
      ],
      evidence:
        "Summarize dashboard status in public release notes without publishing wallet allowlists, internal auth endpoints, HMAC secrets, raw admin rows, or private operator paths.",
    },
  ];
}

function formatDashboardDeploymentPlanMarkdown(plan) {
  const lines = [
    `# 6529.io Dashboard Deployment Plan ${plan.release}`,
    "",
    `Ready to execute: ${plan.ready ? "yes" : "no"}`,
    `Generated: ${plan.generatedAt}`,
    DRY_RUN_NOTICE,
    "",
    "## Inputs",
    "",
    `- 6529.io origin: ${plan.inputs.frontendOrigin}`,
    `- bot origin: ${plan.inputs.botOrigin}`,
    `- operator workspace: ${plan.inputs.operatorWorkspace}`,
    `- auth-check URL: ${plan.inputs.authCheckUrl}`,
    `- public org allowlist: ${plan.inputs.publicOrg}`,
    `- public route: ${plan.inputs.publicRoute}`,
    `- admin route: ${plan.inputs.adminRoute}`,
  ];

  for (const phase of plan.phases) {
    lines.push("", `## ${phase.title}`, "");
    for (const command of phase.commands) {
      lines.push(`- \`${command}\``);
    }
    lines.push(`- Evidence: ${phase.evidence}`);
  }
  if (plan.errors.length) {
    lines.push("", "## Errors", "", ...plan.errors.map((error) => `- ${error}`));
  }
  if (plan.warnings.length) {
    lines.push("", "## Warnings", "", ...plan.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

function normalizeDashboardOrigin(value, label, placeholder) {
  if (String(value || "").trim() === placeholder) {
    return placeholder;
  }
  try {
    return normalizeOrigin(value);
  } catch (error) {
    throw new Error(`${label} ${String(error.message).replace(/^production bot origin /, "")}`);
  }
}

function normalizeHttpsUrl(value, label, placeholder) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  if (text === placeholder) {
    return text;
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch (error) {
    throw new Error(`${label} must be an https URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use https.`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${label} must not include credentials, a query, or a hash.`);
  }
  if (parsed.pathname === "/" && !parsed.search) {
    throw new Error(`${label} must include the server-side auth-check path.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function normalizePublicOrg(value) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error("public org allowlist is required.");
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(text)) {
    throw new Error("public org allowlist contains unsupported characters.");
  }
  return text;
}

function normalizeRoute(value, label) {
  const text = String(value || "").trim().replace(/\/+$/, "");
  if (!text || !text.startsWith("/") || text.startsWith("//")) {
    throw new Error(`${label} must be an absolute app path.`);
  }
  if (/[`"';&|<>]/.test(text)) {
    throw new Error(`${label} contains unsupported shell characters.`);
  }
  return text || "/";
}

module.exports = {
  DEFAULT_ADMIN_ROUTE,
  DEFAULT_AUTH_CHECK_URL,
  DEFAULT_BOT_ORIGIN,
  DEFAULT_FRONTEND_ORIGIN,
  DEFAULT_OPERATOR_WORKSPACE,
  DEFAULT_PUBLIC_ORG,
  DEFAULT_PUBLIC_ROUTE,
  DRY_RUN_NOTICE,
  collectDashboardDeploymentPlan,
  dashboardDeploymentPhases,
  formatDashboardDeploymentPlanMarkdown,
  normalizeDashboardOrigin,
  normalizeHttpsUrl,
  normalizePublicOrg,
  normalizeRoute,
};
