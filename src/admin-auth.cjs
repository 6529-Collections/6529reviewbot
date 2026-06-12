"use strict";

const crypto = require("crypto");

const AUTH_MODES = ["disabled", "shared_secret", "hmac"];
const DEFAULT_REQUIRED_ROLES = ["reviewbot-admin", "admin"];
const DEFAULT_MAX_TTL_SECONDS = 300;
const MAX_ADMIN_ACTOR_LENGTH = 200;
const MAX_ADMIN_ROLE_LENGTH = 80;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const ROLE_PATTERN = /^[A-Za-z0-9_.:-]+$/;

function adminAuthSettingsFromEnv(env = process.env) {
  return {
    mode: enumValue(
      env.REVIEWBOT_ADMIN_AUTH_MODE || "disabled",
      AUTH_MODES,
      "REVIEWBOT_ADMIN_AUTH_MODE"
    ),
    sharedSecret: env.REVIEWBOT_ADMIN_AUTH_SHARED_SECRET || "",
    hmacSecret:
      env.REVIEWBOT_ADMIN_AUTH_HMAC_SECRET ||
      env.REVIEWBOT_ADMIN_AUTH_SHARED_SECRET ||
      "",
    requiredRoles: requiredRolesFromEnv(env.REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES),
    maxTtlSeconds: positiveInt(
      env.REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS,
      DEFAULT_MAX_TTL_SECONDS,
      "REVIEWBOT_ADMIN_AUTH_MAX_TTL_SECONDS"
    ),
  };
}

function createUsageApiAdminAuthorizer(settings = adminAuthSettingsFromEnv()) {
  return async (request) => authorizeAdminRequest(request, settings);
}

function authorizeAdminRequest(request, settings = adminAuthSettingsFromEnv()) {
  if (settings.mode === "disabled") {
    return denied("admin_auth_disabled", "Admin auth bridge is not configured.");
  }
  if (settings.mode === "shared_secret") {
    return authorizeSharedSecret(request, settings);
  }
  return authorizeHmac(request, settings);
}

function authorizeSharedSecret(request, settings) {
  if (!settings.sharedSecret) {
    return denied("admin_auth_not_configured", "Admin shared secret is not configured.");
  }
  const supplied = headerValue(request.headers, "x-6529-reviewbot-admin-secret");
  if (!timingSafeEqualRawString(supplied, settings.sharedSecret)) {
    return denied("admin_auth_invalid_secret", "Admin authorization failed.");
  }
  return allowed({ actor: "shared-secret", roles: ["service"] });
}

function authorizeHmac(request, settings, now = new Date()) {
  if (!settings.hmacSecret) {
    return denied("admin_auth_not_configured", "Admin HMAC secret is not configured.");
  }

  const actor = headerValue(request.headers, "x-6529-admin-user").trim();
  const roles = csv(headerValue(request.headers, "x-6529-admin-roles"));
  const expiresAt = headerValue(request.headers, "x-6529-admin-expires-at");
  const signature = headerValue(request.headers, "x-6529-admin-signature");

  if (!actor || roles.length === 0 || !expiresAt || !signature) {
    return denied("admin_auth_missing_headers", "Admin authorization headers are incomplete.");
  }

  if (!isSafeAdminActor(actor)) {
    return denied("admin_auth_invalid_actor", "Admin actor is invalid.");
  }
  if (!roles.every(isSafeAdminRole)) {
    return denied("admin_auth_invalid_roles", "Admin roles are invalid.");
  }

  const expiry = Number.parseInt(expiresAt, 10);
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (!Number.isSafeInteger(expiry) || expiry < nowSeconds) {
    return denied("admin_auth_expired", "Admin authorization has expired.");
  }
  if (expiry > nowSeconds + settings.maxTtlSeconds) {
    return denied("admin_auth_ttl_too_long", "Admin authorization expiry is too far in the future.");
  }

  if (!hasRequiredRole(roles, settings.requiredRoles)) {
    return denied("admin_auth_missing_role", "Admin role is required.");
  }

  const expected = signAdminAuthRequest(
    {
      method: request.method,
      url: request.url,
      actor,
      roles,
      expiresAt,
    },
    settings
  );
  if (!timingSafeEqualSignature(signature, expected)) {
    return denied("admin_auth_invalid_signature", "Admin authorization failed.");
  }

  return allowed({ actor, roles });
}

function signAdminAuthRequest(input, settings = adminAuthSettingsFromEnv()) {
  const secret = settings.hmacSecret || settings.sharedSecret;
  if (!secret) {
    throw new Error("Admin auth HMAC secret is required.");
  }
  const actor = String(input.actor || "").trim();
  const roles = csv(input.roles || []);
  if (!isSafeAdminActor(actor)) {
    throw new Error("Admin auth actor is invalid.");
  }
  if (!roles.every(isSafeAdminRole)) {
    throw new Error("Admin auth roles are invalid.");
  }
  return crypto
    .createHmac("sha256", secret)
    .update(canonicalAdminAuthPayload({ ...input, actor, roles }))
    .digest("hex");
}

function canonicalAdminAuthPayload(input) {
  const url = input.url instanceof URL ? input.url : new URL(String(input.url), "http://localhost");
  return [
    String(input.method || "GET").toUpperCase(),
    `${url.pathname}${url.search}`,
    String(input.actor || ""),
    csv(input.roles || []).join(","),
    String(input.expiresAt || ""),
  ].join("\n");
}

function hasRequiredRole(actualRoles, requiredRoles) {
  const actual = new Set(actualRoles.map((role) => role.toLowerCase()));
  return requiredRoles.some((role) => actual.has(String(role).toLowerCase()));
}

function requiredRolesFromEnv(value) {
  const roles = csv(value || "");
  return normalizeRequiredRoles(
    roles.length ? roles : DEFAULT_REQUIRED_ROLES,
    "REVIEWBOT_ADMIN_AUTH_REQUIRED_ROLES"
  );
}

function normalizeRequiredRoles(roles, source) {
  const result = [];
  const seen = new Set();
  for (const role of roles) {
    if (!isSafeAdminRole(role)) {
      throw new Error(
        `${source} must contain roles using only letters, digits, underscore, dot, colon, or hyphen, each at most ${MAX_ADMIN_ROLE_LENGTH} characters.`
      );
    }
    const key = String(role).toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(role);
  }
  if (!result.length) {
    throw new Error(`${source} must contain at least one role.`);
  }
  return result;
}

function isSafeAdminActor(value) {
  const text = String(value || "");
  return (
    text.length > 0 &&
    text.length <= MAX_ADMIN_ACTOR_LENGTH &&
    !CONTROL_CHAR_PATTERN.test(text)
  );
}

function isSafeAdminRole(value) {
  const text = String(value || "");
  return (
    text.length > 0 &&
    text.length <= MAX_ADMIN_ROLE_LENGTH &&
    ROLE_PATTERN.test(text)
  );
}

function headerValue(headers, name) {
  const lowerName = name.toLowerCase();
  if (headers && typeof headers.get === "function") {
    const value = headers.get(name);
    return value === null || value === undefined ? "" : String(value);
  }
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === lowerName) {
      return Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
  }
  return "";
}

function allowed(extra) {
  return {
    allowed: true,
    ...extra,
  };
}

function denied(code, reason) {
  return {
    allowed: false,
    statusCode: 403,
    code,
    reason,
  };
}

function normalizeSignature(value) {
  return String(value || "").trim().replace(/^sha256=/i, "");
}

function timingSafeEqualRawString(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function timingSafeEqualSignature(left, right) {
  return timingSafeEqualRawString(normalizeSignature(left), normalizeSignature(right));
}

function csv(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

module.exports = {
  AUTH_MODES,
  DEFAULT_MAX_TTL_SECONDS,
  DEFAULT_REQUIRED_ROLES,
  adminAuthSettingsFromEnv,
  authorizeAdminRequest,
  canonicalAdminAuthPayload,
  createUsageApiAdminAuthorizer,
  isSafeAdminActor,
  isSafeAdminRole,
  signAdminAuthRequest,
};
