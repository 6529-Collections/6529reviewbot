"use strict";

const fs = require("fs");
const path = require("path");
const {
  redactSensitiveText,
  safeErrorLine,
} = require("./diagnostics.cjs");

const DEFAULT_GITHUB_API_URL = "https://api.github.com";
const DEFAULT_GITHUB_MANIFEST_CONVERSION_TIMEOUT_MS = 10000;
const DEFAULT_REPO_ROOT = path.resolve(__dirname, "..");

function githubAppManifestConversionSettingsFromEnv(env = process.env) {
  return {
    apiUrl: trimTrailingSlash(
      env.REVIEWBOT_GITHUB_MANIFEST_API_URL ||
        env.REVIEWBOT_GITHUB_APP_API_URL ||
        env.GITHUB_API_URL ||
        DEFAULT_GITHUB_API_URL
    ),
    outputPath: env.REVIEWBOT_GITHUB_MANIFEST_OUTPUT || "",
    timeoutMs: positiveInt(
      env.REVIEWBOT_GITHUB_MANIFEST_TIMEOUT_MS,
      DEFAULT_GITHUB_MANIFEST_CONVERSION_TIMEOUT_MS,
      "REVIEWBOT_GITHUB_MANIFEST_TIMEOUT_MS"
    ),
    token:
      env.REVIEWBOT_GITHUB_MANIFEST_TOKEN ||
      env.GH_TOKEN ||
      env.GITHUB_TOKEN ||
      "",
  };
}

async function convertGitHubAppManifest(options = {}) {
  const settings =
    options.settings || githubAppManifestConversionSettingsFromEnv(options.env);
  const outputPath = resolvePrivateOutputPath(
    options.outputPath || settings.outputPath,
    {
      allowRepoOutput: Boolean(options.allowRepoOutput),
      cwd: options.cwd || process.cwd(),
      overwrite: Boolean(options.overwrite),
      repoRoot: options.repoRoot === undefined ? DEFAULT_REPO_ROOT : options.repoRoot,
    }
  );
  const result = await createGitHubAppFromManifest({
    allowNoAuth: Boolean(options.allowNoAuth),
    apiUrl: options.apiUrl || settings.apiUrl,
    code: options.code,
    fetchImpl: options.fetchImpl || fetch,
    timeoutMs: options.timeoutMs || settings.timeoutMs,
    token: options.token === undefined ? settings.token : options.token,
  });
  writeManifestConversionOutput(outputPath, result, {
    overwrite: Boolean(options.overwrite),
  });
  return manifestConversionSummary(result, { outputPath });
}

async function createGitHubAppFromManifest(options = {}) {
  const code = normalizeManifestCode(options.code);
  const apiUrl = trimTrailingSlash(options.apiUrl || DEFAULT_GITHUB_API_URL);
  const token = String(options.token || "").trim();
  if (!token && !options.allowNoAuth) {
    throw new Error(
      "GitHub App manifest conversion requires a GitHub token. Set REVIEWBOT_GITHUB_MANIFEST_TOKEN or GH_TOKEN, or pass --no-auth only after confirming the endpoint accepts unauthenticated conversion."
    );
  }
  const response = await fetchWithTimeout(
    options.fetchImpl || fetch,
    `${apiUrl}/app-manifests/${encodeURIComponent(code)}/conversions`,
    {
      method: "POST",
      headers: githubManifestConversionHeaders(token),
    },
    options.timeoutMs || DEFAULT_GITHUB_MANIFEST_CONVERSION_TIMEOUT_MS
  );
  if (!response.ok) {
    throw new Error(
      `GitHub App manifest conversion returned HTTP ${response.status}${await responseErrorSuffix(response)}.`
    );
  }
  return validateManifestConversionResponse(await response.json());
}

function validateManifestConversionResponse(result) {
  assertPlainObject(result, "GitHub App manifest conversion response");
  requireValue(result.id, "GitHub App id");
  requireString(result.name, "GitHub App name");
  requireString(result.client_id, "GitHub App client_id");
  requireString(result.client_secret, "GitHub App client_secret");
  requireString(result.webhook_secret, "GitHub App webhook_secret");
  requireString(result.pem, "GitHub App pem");
  if (!String(result.pem).includes("PRIVATE KEY")) {
    throw new Error("GitHub App pem did not look like a private key.");
  }
  if (result.permissions !== undefined) {
    assertPlainObject(result.permissions, "GitHub App permissions");
  }
  if (result.events !== undefined && !Array.isArray(result.events)) {
    throw new Error("GitHub App events must be an array when present.");
  }
  return result;
}

function writeManifestConversionOutput(outputPath, result, options = {}) {
  const resolved = resolvePrivateOutputPath(outputPath, {
    allowRepoOutput: true,
    cwd: options.cwd || process.cwd(),
    overwrite: Boolean(options.overwrite),
    repoRoot: null,
  });
  fs.writeFileSync(resolved, `${JSON.stringify(result, null, 2)}\n`, {
    flag: options.overwrite ? "w" : "wx",
    mode: 0o600,
  });
  return resolved;
}

function manifestConversionSummary(result, options = {}) {
  return {
    id: result.id,
    slug: safeSummaryText(result.slug || ""),
    name: safeSummaryText(result.name),
    owner: safeSummaryText(result.owner?.login || ""),
    htmlUrl: safeSummaryText(result.html_url || ""),
    externalUrl: safeSummaryText(result.external_url || ""),
    outputPath: safeSummaryText(options.outputPath || ""),
    permissions: result.permissions || {},
    events: result.events || [],
    credentials: {
      clientId: result.client_id ? "set" : "missing",
      clientSecret: result.client_secret ? "set" : "missing",
      webhookSecret: result.webhook_secret ? "set" : "missing",
      pem: result.pem ? "set" : "missing",
    },
  };
}

function formatManifestConversionSummary(summary) {
  const lines = [
    "GitHub App manifest conversion complete.",
    `App: ${summary.name} (${summary.id})`,
  ];
  if (summary.slug) {
    lines.push(`Slug: ${summary.slug}`);
  }
  if (summary.owner) {
    lines.push(`Owner: ${summary.owner}`);
  }
  if (summary.htmlUrl) {
    lines.push(`GitHub URL: ${summary.htmlUrl}`);
  }
  lines.push(`Output: ${summary.outputPath}`);
  lines.push(
    `Credentials: client_id=${summary.credentials.clientId}, client_secret=${summary.credentials.clientSecret}, webhook_secret=${summary.credentials.webhookSecret}, pem=${summary.credentials.pem}`
  );
  lines.push(
    "Keep the output file in the private operator secret path. Do not commit it."
  );
  return `${lines.join("\n")}\n`;
}

function resolvePrivateOutputPath(outputPath, options = {}) {
  const raw = String(outputPath || "").trim();
  if (!raw) {
    throw new Error(
      "Manifest conversion returns one-time credentials; pass --output <private-json-path>."
    );
  }
  const cwd = options.cwd || process.cwd();
  const resolved = path.resolve(cwd, raw);
  const parent = path.dirname(resolved);
  if (!fs.existsSync(parent)) {
    throw new Error(`Output directory does not exist: ${parent}`);
  }
  if (fs.existsSync(resolved) && !options.overwrite) {
    throw new Error(`Output file already exists: ${resolved}`);
  }
  if (options.repoRoot && !options.allowRepoOutput) {
    const repoRoot = path.resolve(options.repoRoot);
    if (isPathInside(resolved, repoRoot)) {
      throw new Error(
        "Refusing to write GitHub App credentials inside this public repository. Pass --allow-repo-output only for isolated tests."
      );
    }
  }
  return resolved;
}

function normalizeManifestCode(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("--code is required.");
  }
  let code = raw;
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    code = url.searchParams.get("code") || "";
  }
  if (!/^[A-Za-z0-9_-]+$/.test(code)) {
    throw new Error("--code must be a GitHub manifest conversion code or callback URL with a code query parameter.");
  }
  return code;
}

function githubManifestConversionHeaders(token) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "6529reviewbot",
    "x-github-api-version": "2022-11-28",
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timeout.unref === "function") {
    timeout.unref();
  }
  try {
    return await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new Error(`GitHub App manifest conversion timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function responseErrorSuffix(response) {
  if (typeof response.text !== "function") {
    return "";
  }
  let text = "";
  try {
    text = await response.text();
  } catch (error) {
    return `: ${safeErrorLine(error, 200)}`;
  }
  if (!text) {
    return "";
  }
  return `: ${safeSummaryText(text).slice(0, 200)}`;
}

function safeSummaryText(value) {
  return redactSensitiveText(value)
    .slice(0, 1000)
    .replace(/\r?\n/g, " ");
}

function isPathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
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

function requireValue(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is required.`);
  }
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

module.exports = {
  DEFAULT_GITHUB_API_URL,
  DEFAULT_GITHUB_MANIFEST_CONVERSION_TIMEOUT_MS,
  convertGitHubAppManifest,
  createGitHubAppFromManifest,
  formatManifestConversionSummary,
  githubAppManifestConversionSettingsFromEnv,
  githubManifestConversionHeaders,
  manifestConversionSummary,
  normalizeManifestCode,
  resolvePrivateOutputPath,
  safeSummaryText,
  validateManifestConversionResponse,
  writeManifestConversionOutput,
};
