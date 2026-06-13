#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const usageApi = require("../src/usage-api.cjs");
const usageApiClient = require("../src/usage-api-client.cjs");
const openApiValidator = require("../bin/validate-usage-api-openapi.cjs");

const root = path.resolve(__dirname, "..");

const routeContracts = [
  {
    key: "publicSummaryPath",
    envKey: "REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH",
    defaultExport: "DEFAULT_PUBLIC_SUMMARY_PATH",
    path: "/api/public/usage/summary",
    clientMethod: "publicUsageSummary",
    visibility: "public",
    kind: "usage_summary",
    openapiSecurity: false,
  },
  {
    key: "adminSummaryPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH",
    defaultExport: "DEFAULT_ADMIN_SUMMARY_PATH",
    path: "/api/admin/usage/summary",
    clientMethod: "adminUsageSummary",
    visibility: "admin",
    kind: "usage_summary",
    openapiSecurity: true,
  },
  {
    key: "adminUsageEventsPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_USAGE_EVENTS_PATH",
    defaultExport: "DEFAULT_ADMIN_USAGE_EVENTS_PATH",
    path: "/api/admin/usage/events/recent",
    clientMethod: "recentUsageEvents",
    visibility: "admin",
    kind: "usage_events",
    openapiSecurity: true,
  },
  {
    key: "adminBudgetPoliciesPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_BUDGET_POLICIES_PATH",
    defaultExport: "DEFAULT_ADMIN_BUDGET_POLICIES_PATH",
    path: "/api/admin/budget/policies",
    clientMethod: "budgetPolicies",
    visibility: "admin",
    kind: "budget_policies",
    openapiSecurity: true,
  },
  {
    key: "adminBudgetStatusPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH",
    defaultExport: "DEFAULT_ADMIN_BUDGET_STATUS_PATH",
    path: "/api/admin/budget/status",
    clientMethod: "budgetStatus",
    visibility: "admin",
    kind: "budget_status",
    openapiSecurity: true,
  },
  {
    key: "adminModelPriceStatusPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_MODEL_PRICE_STATUS_PATH",
    defaultExport: "DEFAULT_ADMIN_MODEL_PRICE_STATUS_PATH",
    path: "/api/admin/model-prices/status",
    clientMethod: "modelPriceStatus",
    visibility: "admin",
    kind: "model_price_status",
    openapiSecurity: true,
  },
  {
    key: "adminAlertStatusPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH",
    defaultExport: "DEFAULT_ADMIN_ALERT_STATUS_PATH",
    path: "/api/admin/alerts/status",
    clientMethod: "alertStatus",
    visibility: "admin",
    kind: "alert_status",
    openapiSecurity: true,
  },
  {
    key: "adminJobEventsPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH",
    defaultExport: "DEFAULT_ADMIN_JOB_EVENTS_PATH",
    path: "/api/admin/jobs/recent",
    clientMethod: "jobEvents",
    visibility: "admin",
    kind: "job_events",
    openapiSecurity: true,
  },
  {
    key: "adminRunClaimsPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH",
    defaultExport: "DEFAULT_ADMIN_RUN_CLAIMS_PATH",
    path: "/api/admin/run-claims/recent",
    clientMethod: "runClaims",
    visibility: "admin",
    kind: "run_claims",
    openapiSecurity: true,
  },
  {
    key: "adminStatusPath",
    envKey: "REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH",
    defaultExport: "DEFAULT_ADMIN_STATUS_PATH",
    path: "/api/admin/status",
    clientMethod: "runtimeStatus",
    visibility: "admin",
    kind: "runtime_status",
    openapiSecurity: true,
  },
];

const routeDocs = [
  "docs/usage-api.md",
  "docs/6529-io-admin-integration.md",
  "docs/configuration.md",
  "docs/deployment.md",
  "docs/install.md",
  "docs/github-app.md",
];

function main() {
  checkUsageApiRoutes()
    .then((result) => {
      console.log(
        `usage api routes ok (${result.routes} routes, ${result.clientMethods} client methods, ${result.docs} docs/templates checked)`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

async function checkUsageApiRoutes(options = {}) {
  const findings = [];
  const contracts = options.routeContracts || routeContracts;
  const openapi = options.openapi || readJson("docs/usage-api.openapi.json");
  const envTexts = options.envTexts || {};
  const docTexts = options.docTexts || {};

  checkRouteDefaults(contracts, findings);
  await checkRouteHandling(contracts, findings);
  await checkClientMethods(contracts, findings);
  checkOpenApi(contracts, openapi, findings);
  checkEnvTemplates(contracts, envTexts, findings);
  checkDocs(contracts, docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`usage api route contract check found ${findings.length} issue(s).`);
  }

  return {
    routes: contracts.length,
    clientMethods: contracts.length,
    docs: routeDocs.length + 2,
  };
}

function checkRouteDefaults(contracts, findings) {
  const settings = usageApi.usageApiSettingsFromEnv({});
  const requiredPaths = openApiValidator.REQUIRED_PATHS || [];
  const expectedPaths = contracts.map((contract) => contract.path);
  if (!arraysEqual(requiredPaths, expectedPaths)) {
    findings.push(
      `OpenAPI REQUIRED_PATHS must be ${JSON.stringify(expectedPaths)}, got ${JSON.stringify(requiredPaths)}.`
    );
  }

  for (const contract of contracts) {
    if (usageApi[contract.defaultExport] !== contract.path) {
      findings.push(`${contract.defaultExport} must be ${contract.path}.`);
    }
    if (settings[contract.key] !== contract.path) {
      findings.push(`usageApiSettingsFromEnv({}).${contract.key} must be ${contract.path}.`);
    }
    if (!usageApi.isUsageApiPath(contract.path, settings)) {
      findings.push(`isUsageApiPath must recognize ${contract.path}.`);
    }
  }
}

async function checkRouteHandling(contracts, findings) {
  const settings = usageApi.usageApiSettingsFromEnv({});
  for (const contract of contracts) {
    const result = await usageApi.handleUsageApiRequest({
      method: "GET",
      url: new URL(`https://reviewbot.example.com${contract.path}${queryFor(contract.kind)}`),
    }, {
      settings,
      authorizeAdmin: async () => ({ allowed: true }),
      loadUsageEvents: async () => ({ events: [] }),
      loadBudgetPolicies: async () => ({ policies: [] }),
      loadBudgetStatus: async () => ({ policies: [] }),
      loadModelPriceStatus: async () => ({ status: modelPriceStatusFixture() }),
      loadAlertStatus: async () => ({ status: alertStatusFixture() }),
      loadJobEvents: async () => ({ events: [] }),
      loadRunClaims: async () => ({ claims: [] }),
      loadAdminStatus: async () => ({ preflight: { ok: true, checks: [] } }),
      now: new Date("2026-06-13T12:00:00.000Z"),
    });
    if (result.statusCode !== 200) {
      findings.push(`${contract.path} must return 200 in the route contract fixture, got ${result.statusCode}.`);
      continue;
    }
    if (result.body.visibility !== contract.visibility) {
      findings.push(`${contract.path} visibility must be ${contract.visibility}, got ${result.body.visibility}.`);
    }
    if (result.body.kind !== contract.kind) {
      findings.push(`${contract.path} kind must be ${contract.kind}, got ${result.body.kind}.`);
    }
  }
}

async function checkClientMethods(contracts, findings) {
  const seen = [];
  const client = usageApiClient.createUsageApiClient({
    settings: {
      baseUrl: "https://reviewbot.example.com/base/",
      actor: "operator",
      roles: ["reviewbot-admin"],
      timeoutMs: 1000,
      adminAuth: {
        mode: "hmac",
        hmacSecret: "hmac-secret",
        sharedSecret: "",
        requiredRoles: ["reviewbot-admin"],
        maxTtlSeconds: 300,
      },
    },
    fetchImpl: async (url, request) => {
      seen.push({
        path: url.pathname,
        method: request.method,
        headers: request.headers,
      });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      };
    },
  });

  for (const contract of contracts) {
    const before = seen.length;
    const method = client[contract.clientMethod];
    if (typeof method !== "function") {
      findings.push(`usage API client must expose ${contract.clientMethod}().`);
      continue;
    }
    await callClientMethod(method, contract.kind);
    const request = seen[before];
    if (!request) {
      findings.push(`usage API client method ${contract.clientMethod}() did not issue a request.`);
      continue;
    }
    if (request.method !== "GET") {
      findings.push(`usage API client method ${contract.clientMethod}() must use GET.`);
    }
    if (request.path !== contract.path) {
      findings.push(
        `usage API client method ${contract.clientMethod}() must call ${contract.path}, got ${request.path}.`
      );
    }
    const hasAdminSignature = Object.prototype.hasOwnProperty.call(
      lowerCaseKeys(request.headers),
      "x-6529-admin-signature"
    );
    if (contract.visibility === "admin" && !hasAdminSignature) {
      findings.push(`usage API client method ${contract.clientMethod}() must sign admin requests.`);
    }
    if (contract.visibility === "public" && hasAdminSignature) {
      findings.push(`usage API client method ${contract.clientMethod}() must not sign public requests.`);
    }
  }
}

function checkOpenApi(contracts, openapi, findings) {
  const openapiPaths = Object.keys(openapi.paths || {});
  const expectedPaths = contracts.map((contract) => contract.path);
  if (!arraysEqual(openapiPaths, expectedPaths)) {
    findings.push(
      `docs/usage-api.openapi.json paths must be ${JSON.stringify(expectedPaths)}, got ${JSON.stringify(openapiPaths)}.`
    );
  }
  for (const contract of contracts) {
    const pathItem = openapi.paths?.[contract.path];
    if (!pathItem?.get) {
      findings.push(`docs/usage-api.openapi.json must define GET ${contract.path}.`);
      continue;
    }
    if (!pathItem.get.responses?.["200"]) {
      findings.push(`docs/usage-api.openapi.json GET ${contract.path} must define a 200 response.`);
    }
    const hasAdminHmac = (pathItem.get.security || []).some((entry) =>
      Object.prototype.hasOwnProperty.call(entry, "adminHmac")
    );
    if (contract.openapiSecurity && !hasAdminHmac) {
      findings.push(`docs/usage-api.openapi.json GET ${contract.path} must require adminHmac.`);
    }
    if (!contract.openapiSecurity && hasAdminHmac) {
      findings.push(`docs/usage-api.openapi.json GET ${contract.path} must remain public.`);
    }
  }
}

function checkEnvTemplates(contracts, envTexts, findings) {
  const envExample = envTexts[".env.example"] || readText(".env.example");
  const ioEnv = envTexts["templates/6529-io-reviewbot-env.example"] ||
    readText("templates/6529-io-reviewbot-env.example");
  const ioValues = parseEnv(ioEnv);

  for (const contract of contracts) {
    if (!envExample.includes(`${contract.envKey}=${contract.path}`)) {
      findings.push(`.env.example must include ${contract.envKey}=${contract.path}.`);
    }
  }

  const ioExpected = [
    "REVIEWBOT_USAGE_API_PUBLIC_SUMMARY_PATH",
    "REVIEWBOT_USAGE_API_ADMIN_SUMMARY_PATH",
    "REVIEWBOT_USAGE_API_ADMIN_BUDGET_STATUS_PATH",
    "REVIEWBOT_USAGE_API_ADMIN_MODEL_PRICE_STATUS_PATH",
    "REVIEWBOT_USAGE_API_ADMIN_ALERT_STATUS_PATH",
    "REVIEWBOT_USAGE_API_ADMIN_STATUS_PATH",
    "REVIEWBOT_USAGE_API_ADMIN_JOB_EVENTS_PATH",
    "REVIEWBOT_USAGE_API_ADMIN_RUN_CLAIMS_PATH",
  ];
  for (const key of ioExpected) {
    const contract = contracts.find((item) => item.envKey === key);
    if (!contract) {
      findings.push(`route contract list must include ${key}.`);
      continue;
    }
    const value = ioValues[key];
    if (!value) {
      findings.push(`templates/6529-io-reviewbot-env.example must include ${key}.`);
      continue;
    }
    if (pathWithoutQuery(value) !== contract.path) {
      findings.push(`templates/6529-io-reviewbot-env.example ${key} must target ${contract.path}.`);
    }
  }
}

function checkDocs(contracts, docTexts, findings) {
  for (const doc of routeDocs) {
    const text = docTexts[doc] || readText(doc);
    for (const contract of contracts) {
      const shouldRequire =
        doc === "docs/usage-api.md" ||
        doc === "docs/configuration.md" ||
        doc === "docs/github-app.md" ||
        contract.path !== "/api/admin/budget/policies";
      if (shouldRequire && !text.includes(contract.path)) {
        findings.push(`${doc} must mention ${contract.path}.`);
      }
    }
  }

  const adminIntegration = docTexts["docs/6529-io-admin-integration.md"] ||
    readText("docs/6529-io-admin-integration.md");
  const requiredClientSnippets = [
    "client.adminUsageSummary({ days: 30 })",
    "client.budgetStatus()",
    "client.modelPriceStatus()",
    "client.alertStatus()",
    "client.runtimeStatus({ profile: \"server\" })",
    "client.jobEvents({ status: \"dispatch_failed\", limit: 10 })",
    "client.runClaims({ active: true, staleMinutes: 120, limit: 10 })",
  ];
  for (const snippet of requiredClientSnippets) {
    if (!adminIntegration.includes(snippet)) {
      findings.push(`docs/6529-io-admin-integration.md must include '${snippet}'.`);
    }
  }
}

function callClientMethod(method, kind) {
  if (kind === "usage_summary") {
    return method({ days: 30 });
  }
  if (kind === "usage_events") {
    return method({ days: 7, limit: 10 });
  }
  if (kind === "job_events") {
    return method({ status: "dispatch_failed", limit: 10 });
  }
  if (kind === "run_claims") {
    return method({ active: true, staleMinutes: 120, limit: 10 });
  }
  if (kind === "runtime_status") {
    return method({ profile: "server", strict: false });
  }
  return method();
}

function queryFor(kind) {
  if (kind === "usage_summary") {
    return "?days=30";
  }
  if (kind === "usage_events") {
    return "?days=7&limit=10";
  }
  if (kind === "job_events") {
    return "?status=dispatch_failed&limit=10";
  }
  if (kind === "run_claims") {
    return "?active=1&staleMinutes=120&limit=10";
  }
  if (kind === "runtime_status") {
    return "?profile=server&strict=false";
  }
  return "";
}

function modelPriceStatusFixture() {
  return {
    policy: { maxSourceAgeDays: 30 },
    summary: {
      activeRows: 0,
      providerCount: 0,
      providerModelCount: 0,
      staleRows: 0,
      futureRows: 0,
      missingSourceRows: 0,
      invalidSourceRows: 0,
      incompleteRows: 0,
    },
    prices: [],
  };
}

function alertStatusFixture() {
  return {
    enabled: false,
    spend: {},
    jobHealth: {},
    schedule: {},
    notifier: {},
  };
}

function parseEnv(text) {
  const values = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    if (index > 0) {
      values[trimmed.slice(0, index)] = trimmed.slice(index + 1);
    }
  }
  return values;
}

function pathWithoutQuery(value) {
  return String(value || "").split("?", 1)[0];
}

function lowerCaseKeys(value) {
  const result = {};
  for (const [key, item] of Object.entries(value || {})) {
    result[key.toLowerCase()] = item;
  }
  return result;
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkUsageApiRoutes,
  routeContracts,
};
