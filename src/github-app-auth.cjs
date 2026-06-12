"use strict";

const crypto = require("crypto");
const { requestorForEvent } = require("./admission-policy.cjs");
const {
  loadRepositoryConfigForEvent,
  repositoryConfigPolicyFromEnv,
} = require("./repository-config.cjs");

const DEFAULT_GITHUB_API_URL = "https://api.github.com";
const DEFAULT_GITHUB_APP_FETCH_TIMEOUT_MS = 10000;
const DEFAULT_JWT_TTL_SECONDS = 540;
const DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS = 60;

function githubAppAuthSettingsFromEnv(env = process.env) {
  return {
    appId: env.REVIEWBOT_GITHUB_APP_ID || env.GITHUB_APP_ID || "",
    privateKey: normalizePrivateKey(
      env.REVIEWBOT_GITHUB_APP_PRIVATE_KEY ||
        env.GITHUB_APP_PRIVATE_KEY ||
        fromBase64(env.REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64 || env.GITHUB_APP_PRIVATE_KEY_BASE64)
    ),
    apiUrl: trimTrailingSlash(
      env.REVIEWBOT_GITHUB_APP_API_URL ||
        env.REVIEWBOT_GITHUB_API_URL ||
        env.GITHUB_API_URL ||
        DEFAULT_GITHUB_API_URL
    ),
    jwtTtlSeconds: positiveInt(
      env.REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS,
      DEFAULT_JWT_TTL_SECONDS,
      "REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS"
    ),
    fetchTimeoutMs: positiveInt(
      env.REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS,
      DEFAULT_GITHUB_APP_FETCH_TIMEOUT_MS,
      "REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS"
    ),
    tokenRefreshBufferSeconds: positiveInt(
      env.REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS,
      DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS,
      "REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS"
    ),
  };
}

function isGitHubAppAuthConfigured(settings = githubAppAuthSettingsFromEnv()) {
  return Boolean(settings.appId && settings.privateKey);
}

function createGitHubAppIntegration(options = {}) {
  const settings = options.settings || githubAppAuthSettingsFromEnv(options.env);
  const fetchImpl = options.fetchImpl || fetch;
  const tokenCache = new Map();
  const fetchWithGitHubAppTimeout = (url, requestOptions) =>
    fetchWithTimeout(fetchImpl, url, requestOptions, settings.fetchTimeoutMs);

  async function getInstallationToken(installationId) {
    if (!isGitHubAppAuthConfigured(settings)) {
      throw new Error("GitHub App auth is not configured.");
    }
    if (!installationId) {
      throw new Error("GitHub App installation id is required.");
    }

    const cacheKey = String(installationId);
    const cached = tokenCache.get(cacheKey);
    const nowMs = Date.now();
    if (cached && cached.expiresAtMs - settings.tokenRefreshBufferSeconds * 1000 > nowMs) {
      return cached.token;
    }

    const response = await githubFetchJson(
      fetchImpl,
      `${settings.apiUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: githubHeaders(createGitHubAppJwt(settings)),
      },
      settings.fetchTimeoutMs
    );
    if (!response.token) {
      throw new Error("GitHub installation token response did not include a token.");
    }
    const expiresAtMs = Date.parse(response.expires_at || "") || nowMs + 60 * 60 * 1000;
    tokenCache.set(cacheKey, { token: response.token, expiresAtMs });
    return response.token;
  }

  async function resolveActorContext(event) {
    const login = requestorForEvent(event);
    const base = {
      login,
      permission: "none",
      isOrgMember: false,
      organizations: [],
      teams: [],
    };
    if (!login || !event?.repository?.fullName || !event.installationId) {
      return base;
    }

    try {
      const token = await getInstallationToken(event.installationId);
      const permission = await readCollaboratorPermission(fetchImpl, settings, token, event.repository.fullName, login);
      const org = ownerFromRepo(event.repository.fullName);
      let isOrgMember = false;
      try {
        isOrgMember = await readOrgMembership(fetchImpl, settings, token, org, login);
      } catch {
        isOrgMember = false;
      }
      return {
        ...base,
        permission,
        isOrgMember,
        organizations: isOrgMember ? [org] : [],
      };
    } catch {
      return base;
    }
  }

  async function loadRepositoryConfig(event, options = {}) {
    const policy = options.policy || repositoryConfigPolicyFromEnv(options.env);
    if (policy.source === "none") {
      return await loadRepositoryConfigForEvent(event, {
        ...options,
        policy,
        fetchImpl: fetchWithGitHubAppTimeout,
      });
    }

    const token = await getInstallationToken(event.installationId);
    return await loadRepositoryConfigForEvent(event, {
      ...options,
      policy,
      fetchImpl: fetchWithGitHubAppTimeout,
      githubToken: token,
    });
  }

  return {
    getInstallationToken,
    loadRepositoryConfig,
    resolveActorContext,
  };
}

function createGitHubAppJwt(settings = githubAppAuthSettingsFromEnv(), now = new Date()) {
  if (!settings.appId || !settings.privateKey) {
    throw new Error("GitHub App id and private key are required.");
  }
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  const expiresAt = issuedAt + settings.jwtTtlSeconds;
  const encodedHeader = base64urlJson({ alg: "RS256", typ: "JWT" });
  const encodedPayload = base64urlJson({
    iat: issuedAt,
    exp: expiresAt,
    iss: String(settings.appId),
  });
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput), settings.privateKey)
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

async function readCollaboratorPermission(fetchImpl, settings, token, repoFullName, login) {
  const [owner, repo] = splitRepo(repoFullName);
  const url = `${settings.apiUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(login)}/permission`;
  const response = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      headers: githubHeaders(token),
    },
    settings.fetchTimeoutMs
  );
  if (response.status === 404) {
    return "none";
  }
  if (!response.ok) {
    throw new Error(`GitHub collaborator permission API returned HTTP ${response.status}.`);
  }
  const body = await response.json();
  return body.permission || "none";
}

async function readOrgMembership(fetchImpl, settings, token, org, login) {
  if (!org || !login) {
    return false;
  }
  const url = `${settings.apiUrl}/orgs/${encodeURIComponent(org)}/members/${encodeURIComponent(login)}`;
  const response = await fetchWithTimeout(
    fetchImpl,
    url,
    {
      headers: githubHeaders(token),
    },
    settings.fetchTimeoutMs
  );
  if (response.status === 204) {
    return true;
  }
  if ([302, 403, 404].includes(response.status)) {
    return false;
  }
  if (!response.ok) {
    throw new Error(`GitHub org membership API returned HTTP ${response.status}.`);
  }
  return false;
}

async function githubFetchJson(fetchImpl, url, options, timeoutMs) {
  const response = await fetchWithTimeout(fetchImpl, url, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}.`);
  }
  return await response.json();
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = DEFAULT_GITHUB_APP_FETCH_TIMEOUT_MS) {
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
      throw new Error(`GitHub API request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function githubHeaders(token) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "6529reviewbot",
    "x-github-api-version": "2022-11-28",
  };
}

function normalizePrivateKey(value) {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function fromBase64(value) {
  if (!value) {
    return "";
  }
  return Buffer.from(String(value), "base64").toString("utf8");
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function splitRepo(repoFullName) {
  const [owner, repo] = String(repoFullName || "").split("/", 2);
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository '${repoFullName}'.`);
  }
  return [owner, repo];
}

function ownerFromRepo(repoFullName) {
  return splitRepo(repoFullName)[0];
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
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
  DEFAULT_GITHUB_APP_FETCH_TIMEOUT_MS,
  DEFAULT_GITHUB_API_URL,
  createGitHubAppIntegration,
  createGitHubAppJwt,
  githubAppAuthSettingsFromEnv,
  isGitHubAppAuthConfigured,
  normalizePrivateKey,
  readCollaboratorPermission,
  readOrgMembership,
};
