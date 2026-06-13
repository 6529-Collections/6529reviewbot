#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const adminAuth = require("../src/admin-auth.cjs");

const root = path.resolve(__dirname, "..");
const adminAuthDocs = [
  "docs/admin-auth-bridge.md",
  "docs/6529-io-admin-integration.md",
  "docs/configuration.md",
];
const expectedAuthModes = ["disabled", "shared_secret", "hmac"];
const expectedRequiredRoles = ["reviewbot-admin", "admin"];
const expectedTtlSeconds = 300;
const expectedHmacHeaders = [
  "x-6529-admin-user",
  "x-6529-admin-roles",
  "x-6529-admin-expires-at",
  "x-6529-admin-signature",
];

function main() {
  const result = checkAdminAuthContract();
  console.log(
    `admin auth contract ok (${result.modes} modes, ${result.headers} hmac headers, ${result.docs} docs/templates checked)`
  );
}

function checkAdminAuthContract(options = {}) {
  const findings = [];

  checkConstants(findings);
  checkSettings(findings);
  checkSharedSecretAuth(findings);
  checkHmacAuth(findings);
  checkDocs(options.docTexts || {}, findings);
  checkEnvTemplates(options.envTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`admin auth contract check found ${findings.length} issue(s).`);
  }

  return {
    modes: expectedAuthModes.length,
    headers: expectedHmacHeaders.length,
    docs: adminAuthDocs.length + 2,
  };
}

function checkConstants(findings) {
  if (!arraysEqual(adminAuth.AUTH_MODES, expectedAuthModes)) {
    findings.push(`AUTH_MODES must be ${JSON.stringify(expectedAuthModes)}, got ${JSON.stringify(adminAuth.AUTH_MODES)}.`);
  }
  if (!arraysEqual(adminAuth.DEFAULT_REQUIRED_ROLES, expectedRequiredRoles)) {
    findings.push(
      `DEFAULT_REQUIRED_ROLES must be ${JSON.stringify(expectedRequiredRoles)}, got ${JSON.stringify(adminAuth.DEFAULT_REQUIRED_ROLES)}.`
    );
  }
  if (adminAuth.DEFAULT_MAX_TTL_SECONDS !== expectedTtlSeconds) {
    findings.push(`DEFAULT_MAX_TTL_SECONDS must be ${expectedTtlSeconds}, got ${adminAuth.DEFAULT_MAX_TTL_SECONDS}.`);
  }
}

function checkSettings(findings) {
  const defaults = adminAuth.adminAuthSettingsFromEnv({});
  if (defaults.mode !== "disabled") {
    findings.push(`admin auth mode must default to disabled, got ${defaults.mode}.`);
  }
  if (!arraysEqual(defaults.requiredRoles, expectedRequiredRoles)) {
    findings.push(`admin auth required roles must default to ${JSON.stringify(expectedRequiredRoles)}.`);
  }
  if (defaults.maxTtlSeconds !== expectedTtlSeconds) {
    findings.push(`admin auth max TTL must default to ${expectedTtlSeconds}, got ${defaults.maxTtlSeconds}.`);
  }
  for (const mode of expectedAuthModes) {
    const settings = adminAuth.adminAuthSettingsFromEnv({ REVIEWBOT_ADMIN_AUTH_MODE: mode });
    if (settings.mode !== mode) {
      findings.push(`REVIEWBOT_ADMIN_AUTH_MODE=${mode} must parse.`);
    }
  }
  const sharedSecretFallback = adminAuth.adminAuthSettingsFromEnv({
    REVIEWBOT_ADMIN_AUTH_MODE: "hmac",
    REVIEWBOT_ADMIN_AUTH_SHARED_SECRET: "shared",
  });
  if (sharedSecretFallback.hmacSecret !== "shared") {
    findings.push("admin auth HMAC secret must fall back to shared secret for compatibility.");
  }
  const dedupedRoles = adminAuth.adminAuthSettingsFromEnv({
    REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "reviewbot-admin,ReviewBot-Admin,ops:admin",
  }).requiredRoles;
  if (!arraysEqual(dedupedRoles, ["reviewbot-admin", "ops:admin"])) {
    findings.push(`admin auth required roles must dedupe case-insensitively, got ${JSON.stringify(dedupedRoles)}.`);
  }
  expectError(
    () => adminAuth.adminAuthSettingsFromEnv({ REVIEWBOT_ADMIN_AUTH_MODE: "oauth" }),
    "REVIEWBOT_ADMIN_AUTH_MODE must be one of: disabled, shared_secret, hmac.",
    findings
  );
  expectError(
    () => adminAuth.adminAuthSettingsFromEnv({ REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "bad role" }),
    "REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES must contain roles using only letters, digits, underscore, dot, colon, or hyphen, each at most 80 characters.",
    findings
  );
}

function checkSharedSecretAuth(findings) {
  const settings = adminAuth.adminAuthSettingsFromEnv({
    REVIEWBOT_ADMIN_AUTH_MODE: "shared_secret",
    REVIEWBOT_ADMIN_AUTH_SHARED_SECRET: "shared-secret",
  });
  const allowed = adminAuth.authorizeAdminRequest({
    method: "GET",
    url: new URL("https://reviewbot.example.com/api/admin/usage/summary"),
    headers: { "x-6529-reviewbot-admin-secret": "shared-secret" },
  }, settings);
  if (!allowed.allowed || allowed.actor !== "shared-secret" || !arraysEqual(allowed.roles, ["service"])) {
    findings.push("shared_secret auth must allow the matching x-6529-reviewbot-admin-secret header.");
  }
  const denied = adminAuth.authorizeAdminRequest({
    method: "GET",
    url: new URL("https://reviewbot.example.com/api/admin/usage/summary"),
    headers: { "x-6529-reviewbot-admin-secret": "wrong" },
  }, settings);
  if (denied.allowed || denied.code !== "admin_auth_invalid_secret") {
    findings.push("shared_secret auth must deny mismatched secrets.");
  }
}

function checkHmacAuth(findings) {
  const settings = adminAuth.adminAuthSettingsFromEnv({
    REVIEWBOT_ADMIN_AUTH_MODE: "hmac",
    REVIEWBOT_ADMIN_AUTH_HMAC_SECRET: "hmac-secret",
    REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES: "reviewbot-admin",
    REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS: "300",
  });
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = String(nowSeconds + 120);
  const request = {
    method: "GET",
    url: new URL("https://reviewbot.example.com/api/admin/usage/summary?days=7"),
  };
  const signature = adminAuth.signAdminAuthRequest({
    ...request,
    actor: "operator",
    roles: ["reviewbot-admin", "admin"],
    expiresAt,
  }, settings);
  const headers = {
    "x-6529-admin-user": "operator",
    "x-6529-admin-roles": "reviewbot-admin,admin",
    "x-6529-admin-expires-at": expiresAt,
    "x-6529-admin-signature": `sha256=${signature}`,
  };
  const allowed = adminAuth.authorizeAdminRequest({ ...request, headers }, settings);
  if (!allowed.allowed || allowed.actor !== "operator" || !arraysEqual(allowed.roles, ["reviewbot-admin", "admin"])) {
    findings.push("hmac auth must allow a valid signed admin assertion.");
  }
  const canonical = adminAuth.canonicalAdminAuthPayload({
    ...request,
    actor: "operator",
    roles: ["reviewbot-admin", "admin"],
    expiresAt,
  });
  const expectedCanonical = [
    "GET",
    "/api/admin/usage/summary?days=7",
    "operator",
    "reviewbot-admin,admin",
    expiresAt,
  ].join("\n");
  if (canonical !== expectedCanonical) {
    findings.push(`canonical admin auth payload changed: ${JSON.stringify(canonical)}.`);
  }

  const changedPath = adminAuth.authorizeAdminRequest({
    ...request,
    url: new URL("https://reviewbot.example.com/api/admin/usage/summary?days=30"),
    headers,
  }, settings);
  if (changedPath.allowed || changedPath.code !== "admin_auth_invalid_signature") {
    findings.push("hmac auth must reject signatures for a different path or query.");
  }
  const missingRole = adminAuth.authorizeAdminRequest({
    ...request,
    headers: {
      ...headers,
      "x-6529-admin-roles": "viewer",
      "x-6529-admin-signature": adminAuth.signAdminAuthRequest({
        ...request,
        actor: "operator",
        roles: ["viewer"],
        expiresAt,
      }, settings),
    },
  }, settings);
  if (missingRole.allowed || missingRole.code !== "admin_auth_missing_role") {
    findings.push("hmac auth must reject assertions without a required role.");
  }
  const expired = adminAuth.authorizeAdminRequest({
    ...request,
    headers: { ...headers, "x-6529-admin-expires-at": String(nowSeconds - 1) },
  }, settings);
  if (expired.allowed || expired.code !== "admin_auth_expired") {
    findings.push("hmac auth must reject expired assertions.");
  }
  const tooLong = adminAuth.authorizeAdminRequest({
    ...request,
    headers: { ...headers, "x-6529-admin-expires-at": String(nowSeconds + 301) },
  }, settings);
  if (tooLong.allowed || tooLong.code !== "admin_auth_ttl_too_long") {
    findings.push("hmac auth must reject assertions beyond the configured TTL.");
  }
  const invalidActor = adminAuth.authorizeAdminRequest({
    ...request,
    headers: { ...headers, "x-6529-admin-user": "operator\nnext" },
  }, settings);
  if (invalidActor.allowed || invalidActor.code !== "admin_auth_invalid_actor") {
    findings.push("hmac auth must reject control characters in actor headers.");
  }
}

function checkDocs(docTexts, findings) {
  const adminDoc = docTexts["docs/admin-auth-bridge.md"] || readText("docs/admin-auth-bridge.md");
  const normalizedAdminDoc = normalizeWhitespace(adminDoc);
  const requiredAdminSnippets = [
    "REVIEWBOT_ADMIN_AUTH_MODE=disabled|shared_secret|hmac",
    "`disabled` is the default and fails closed",
    "x-6529-reviewbot-admin-secret: <secret>",
    "x-6529-admin-user: <6529 user id or handle>",
    "x-6529-admin-roles: reviewbot-admin,admin",
    "x-6529-admin-expires-at: <unix seconds>",
    "x-6529-admin-signature: sha256=<hex hmac>",
    "The browser never receives the bot admin signing secret",
    "METHOD PATH?QUERY USER ROLES EXPIRES_AT",
    "assertions whose expiry is too far in the future",
  ];
  for (const snippet of requiredAdminSnippets) {
    if (!normalizedAdminDoc.includes(normalizeWhitespace(snippet))) {
      findings.push(`docs/admin-auth-bridge.md must include '${snippet}'.`);
    }
  }

  const integrationDoc = normalizeWhitespace(docTexts["docs/6529-io-admin-integration.md"] || readText("docs/6529-io-admin-integration.md"));
  const requiredIntegrationSnippets = [
    "server should verify the operator, sign a short-lived admin assertion",
    "Do not expose the bot HMAC secret, AWS credentials, GitHub App credentials, or provider keys to frontend JavaScript",
    "REVIEWBOT_USAGE_API_ADMIN_ROLES=reviewbot-admin",
    "REVIEWBOT_ADMIN_AUTH_MODE=hmac",
    "REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS=300",
    "Warnings should link to the relevant runbook",
  ];
  for (const snippet of requiredIntegrationSnippets) {
    if (!integrationDoc.includes(normalizeWhitespace(snippet))) {
      findings.push(`docs/6529-io-admin-integration.md must include '${snippet}'.`);
    }
  }

  const configDoc = normalizeWhitespace(docTexts["docs/configuration.md"] || readText("docs/configuration.md"));
  const requiredConfigSnippets = [
    "REVIEWBOT_ADMIN_AUTH_MODE=disabled|shared_secret|hmac",
    "REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES=reviewbot-admin,admin",
    "REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS=300",
    "`disabled` is the fail-closed default",
    "existing `6529.io` auth system",
  ];
  for (const snippet of requiredConfigSnippets) {
    if (!configDoc.includes(normalizeWhitespace(snippet))) {
      findings.push(`docs/configuration.md must include '${snippet}'.`);
    }
  }
}

function checkEnvTemplates(envTexts, findings) {
  const envExample = envTexts[".env.example"] || readText(".env.example");
  const expectedBotEnvLines = [
    "REVIEWBOT_ADMIN_AUTH_MODE=disabled",
    "REVIEWBOT_ADMIN_AUTH_SHARED_SECRET=",
    "REVIEWBOT_ADMIN_AUTH_HMAC_SECRET=",
    "REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES=reviewbot-admin,admin",
    "REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS=300",
  ];
  for (const line of expectedBotEnvLines) {
    if (!envExample.includes(line)) {
      findings.push(`.env.example must include ${line}.`);
    }
  }

  const ioEnv = envTexts["templates/6529-io-reviewbot-env.example"] || readText("templates/6529-io-reviewbot-env.example");
  const expectedIoLines = [
    "REVIEWBOT_USAGE_ADMIN_ALLOWED_WALLETS=",
    "REVIEWBOT_USAGE_ADMIN_AUTH_CHECK_URL=",
    "REVIEWBOT_USAGE_API_ADMIN_HMAC_SECRET=",
    "REVIEWBOT_USAGE_API_ADMIN_ROLES=reviewbot-admin",
    "REVIEWBOT_USAGE_API_ADMIN_TTL_SECONDS=300",
  ];
  for (const line of expectedIoLines) {
    if (!ioEnv.includes(line)) {
      findings.push(`templates/6529-io-reviewbot-env.example must include ${line}.`);
    }
  }
}

function expectError(fn, expectedMessage, findings) {
  try {
    fn();
    findings.push(`expected error '${expectedMessage}'.`);
  } catch (error) {
    if (error.message !== expectedMessage) {
      findings.push(`expected error '${expectedMessage}', got '${error.message}'.`);
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
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
  checkAdminAuthContract,
  expectedAuthModes,
  expectedHmacHeaders,
};
