"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_GITHUB_APP_MANIFEST_TEMPLATE_PATH = path.resolve(
  __dirname,
  "..",
  "templates",
  "github-app-manifest.example.json"
);

const REQUIRED_DEFAULT_PERMISSIONS = {
  contents: "read",
  issues: "write",
  members: "read",
  metadata: "read",
  pull_requests: "read",
};

const REQUIRED_DEFAULT_EVENTS = ["issue_comment", "pull_request"];

function loadGitHubAppManifestTemplate(options = {}) {
  const manifestPath =
    options.path || DEFAULT_GITHUB_APP_MANIFEST_TEMPLATE_PATH;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  validateGitHubAppManifestTemplate(manifest, manifestPath);
  return manifest;
}

function renderGitHubAppManifest(options = {}) {
  const template =
    options.template ||
    loadGitHubAppManifestTemplate({ path: options.templatePath });
  const host = normalizeManifestHost(options.host);
  const manifest = replaceStringValues(
    replaceStringValues(template, "https://<bot-host>", host),
    "<bot-host>",
    host
  );
  if (options.name) {
    manifest.name = normalizeAppName(options.name);
  }
  validateGitHubAppManifest(manifest, "rendered GitHub App manifest");
  return manifest;
}

function validateGitHubAppManifestTemplate(manifest, name = "GitHub App manifest template") {
  validateGitHubAppManifestShape(manifest, name);
  if (!manifestContainsPlaceholder(manifest, "<bot-host>")) {
    throw new Error(`${name} must contain <bot-host> placeholders.`);
  }
}

function validateGitHubAppManifest(manifest, name = "GitHub App manifest") {
  validateGitHubAppManifestShape(manifest, name);
  if (manifestContainsPlaceholder(manifest, "<bot-host>")) {
    throw new Error(`${name} still contains <bot-host> placeholders.`);
  }
  requireHttpsUrl(manifest.hook_attributes.url, `${name} hook_attributes.url`);
  requireHttpsUrl(manifest.redirect_url, `${name} redirect_url`);
  if (manifest.setup_url) {
    requireHttpsUrl(manifest.setup_url, `${name} setup_url`);
  }
  for (const [index, callbackUrl] of manifest.callback_urls.entries()) {
    requireHttpsUrl(callbackUrl, `${name} callback_urls[${index}]`);
  }
  return manifest;
}

function renderGitHubAppRegistrationForm(options = {}) {
  const manifest = options.manifest;
  validateGitHubAppManifest(manifest);
  const state = options.state || randomState();
  const action = registrationFormActionUrl({
    owner: options.owner || "",
    state,
  });
  const manifestJson = JSON.stringify(manifest);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Register ${escapeHtml(manifest.name)} GitHub App</title>
</head>
<body>
  <form action="${escapeHtml(action)}" method="post">
    <input type="hidden" name="manifest" value="${escapeHtml(manifestJson)}">
    <button type="submit">Register ${escapeHtml(manifest.name)}</button>
  </form>
  <p>State: <code>${escapeHtml(state)}</code></p>
</body>
</html>
`;
}

function registrationFormActionUrl(options = {}) {
  const state = options.state ? String(options.state) : "";
  const suffix = state ? `?state=${encodeURIComponent(state)}` : "";
  const owner = String(options.owner || "").trim();
  if (!owner) {
    return `https://github.com/settings/apps/new${suffix}`;
  }
  if (!/^[A-Za-z0-9-]+$/.test(owner)) {
    throw new Error("--owner must be a GitHub organization slug.");
  }
  return `https://github.com/organizations/${owner}/settings/apps/new${suffix}`;
}

function normalizeManifestHost(host) {
  const raw = String(host || "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new Error("--host is required.");
  }
  let url;
  try {
    url = new URL(raw);
  } catch (error) {
    throw new Error("--host must be an absolute HTTPS URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("--host must use https.");
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("--host must not include a path, query, or fragment.");
  }
  return url.toString().replace(/\/$/, "");
}

function validateGitHubAppManifestShape(manifest, name) {
  assertPlainObject(manifest, name);
  normalizeAppName(manifest.name);
  requireString(manifest.url, `${name} url`);
  assertPlainObject(manifest.hook_attributes, `${name} hook_attributes`);
  requireString(manifest.hook_attributes.url, `${name} hook_attributes.url`);
  if (
    Object.prototype.hasOwnProperty.call(manifest.hook_attributes, "active") &&
    typeof manifest.hook_attributes.active !== "boolean"
  ) {
    throw new Error(`${name} hook_attributes.active must be a boolean.`);
  }
  requireString(manifest.redirect_url, `${name} redirect_url`);
  if (!Array.isArray(manifest.callback_urls) || manifest.callback_urls.length === 0) {
    throw new Error(`${name} callback_urls must be a non-empty array.`);
  }
  manifest.callback_urls.forEach((callbackUrl, index) => {
    requireString(callbackUrl, `${name} callback_urls[${index}]`);
  });
  if (manifest.setup_url) {
    requireString(manifest.setup_url, `${name} setup_url`);
  }
  if (typeof manifest.public !== "boolean") {
    throw new Error(`${name} public must be a boolean.`);
  }
  assertPlainObject(manifest.default_permissions, `${name} default_permissions`);
  for (const [permission, access] of Object.entries(REQUIRED_DEFAULT_PERMISSIONS)) {
    if (manifest.default_permissions[permission] !== access) {
      throw new Error(
        `${name} default_permissions.${permission} must be '${access}'.`
      );
    }
  }
  if (!Array.isArray(manifest.default_events)) {
    throw new Error(`${name} default_events must be an array.`);
  }
  for (const eventName of REQUIRED_DEFAULT_EVENTS) {
    if (!manifest.default_events.includes(eventName)) {
      throw new Error(`${name} default_events must include '${eventName}'.`);
    }
  }
}

function replaceStringValues(value, needle, replacement) {
  if (typeof value === "string") {
    return value.split(needle).join(replacement);
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceStringValues(item, needle, replacement));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceStringValues(item, needle, replacement),
      ])
    );
  }
  return value;
}

function manifestContainsPlaceholder(value, placeholder) {
  if (typeof value === "string") {
    return value.includes(placeholder);
  }
  if (Array.isArray(value)) {
    return value.some((item) => manifestContainsPlaceholder(item, placeholder));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) =>
      manifestContainsPlaceholder(item, placeholder)
    );
  }
  return false;
}

function requireHttpsUrl(value, name) {
  requireString(value, name);
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https.`);
  }
}

function normalizeAppName(name) {
  const value = String(name || "").trim();
  if (!value) {
    throw new Error("GitHub App manifest name is required.");
  }
  if (value.length > 34) {
    throw new Error("GitHub App manifest name must be <= 34 characters.");
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function randomState() {
  return crypto.randomBytes(16).toString("hex");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

module.exports = {
  DEFAULT_GITHUB_APP_MANIFEST_TEMPLATE_PATH,
  REQUIRED_DEFAULT_EVENTS,
  REQUIRED_DEFAULT_PERMISSIONS,
  loadGitHubAppManifestTemplate,
  normalizeManifestHost,
  registrationFormActionUrl,
  renderGitHubAppManifest,
  renderGitHubAppRegistrationForm,
  validateGitHubAppManifest,
  validateGitHubAppManifestTemplate,
};
