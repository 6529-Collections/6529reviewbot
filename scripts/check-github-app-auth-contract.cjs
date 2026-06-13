#!/usr/bin/env node

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const githubAppAuth = require("../src/github-app-auth.cjs");
const githubAppInstallationTokenCli = require("../bin/github-app-installation-token.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/github-app.md",
  "docs/github-app-registration.md",
  "docs/configuration.md",
  "docs/worker-adapters.md",
  "docs/release-operations-map.md",
  "docs/release.md",
];

function main() {
  checkGitHubAppAuthContract()
    .then((result) => {
      console.log(
        `GitHub App auth contract ok (${result.authCases} auth cases, ${result.cliCases} CLI cases, ${result.docs} docs checked)`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

async function checkGitHubAppAuthContract(options = {}) {
  const findings = [];
  checkSettingsContract(findings);
  checkJwtContract(findings);
  await checkInstallationTokenContract(findings);
  checkCliContract(findings);
  checkGitHubActionsOutput(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`GitHub App auth contract check found ${findings.length} issue(s).`);
  }

  return {
    authCases: 7,
    cliCases: 5,
    docs: targetDocs.length,
  };
}

function checkSettingsContract(findings) {
  const pem = testPrivateKeyPem();
  const base64Pem = Buffer.from(pem, "utf8").toString("base64");
  const settings = githubAppAuth.githubAppAuthSettingsFromEnv({
    REVIEWBOT_GITHUB_APP_ID: "12345",
    REVIEWBOT_GITHUB_APP_PRIVATE_KEY_BASE64: base64Pem,
    REVIEWBOT_GITHUB_APP_API_URL: "https://github.example/api/v3/",
    REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS: "1234",
    REVIEWBOT_GITHUB_APP_JWT_TTL_SECONDS: "300",
    REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS: "30",
  });
  if (settings.appId !== "12345") {
    findings.push("GitHub App auth settings must read REVIEWBOT_GITHUB_APP_ID.");
  }
  if (settings.apiUrl !== "https://github.example/api/v3") {
    findings.push("GitHub App auth settings must trim API URL trailing slashes.");
  }
  if (!settings.privateKey.includes("PRIVATE KEY")) {
    findings.push("GitHub App auth settings must decode base64 private keys.");
  }
  if (
    settings.fetchTimeoutMs !== 1234 ||
    settings.jwtTtlSeconds !== 300 ||
    settings.tokenRefreshBufferSeconds !== 30
  ) {
    findings.push("GitHub App auth settings must parse timeout, JWT TTL, and refresh buffer.");
  }
  expectError(
    () =>
      githubAppAuth.githubAppAuthSettingsFromEnv({
        REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS: "bad",
      }),
    "REVIEWBOT_GITHUB_APP_FETCH_TIMEOUT_MS must be a positive integer.",
    findings
  );

  const workerSettings = githubAppAuth.githubAppAuthSettingsFromWorkerDispatchEnv({
    REVIEWBOT_GITHUB_APP_ID: "main-app",
    REVIEWBOT_GITHUB_APP_PRIVATE_KEY: pem,
    REVIEWBOT_WORKER_GITHUB_APP_ID: "worker-app",
    REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY: pem,
    REVIEWBOT_WORKER_GITHUB_APP_API_URL: "https://worker.github.example/api/v3/",
  });
  if (workerSettings.appId !== "worker-app") {
    findings.push("worker-dispatch auth settings must prefer worker App id when worker credentials are set.");
  }
  if (workerSettings.apiUrl !== "https://worker.github.example/api/v3") {
    findings.push("worker-dispatch auth settings must prefer worker API URL.");
  }
  if (!githubAppAuth.hasWorkerDispatchGitHubAppCredentialOverride({
    REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY: pem,
  })) {
    findings.push("worker dispatch credential override detection must include private-key overrides.");
  }
}

function checkJwtContract(findings) {
  const settings = {
    appId: "12345",
    privateKey: testPrivateKeyPem(),
    jwtTtlSeconds: 300,
  };
  const now = new Date("2026-06-13T12:00:00.000Z");
  const jwt = githubAppAuth.createGitHubAppJwt(settings, now);
  const [encodedHeader, encodedPayload, signature] = jwt.split(".");
  if (!encodedHeader || !encodedPayload || !signature) {
    findings.push("GitHub App JWT must have header, payload, and signature.");
    return;
  }
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (header.alg !== "RS256" || header.typ !== "JWT") {
    findings.push("GitHub App JWT header must use RS256 JWT.");
  }
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  if (payload.iss !== "12345" || payload.iat !== issuedAt || payload.exp !== issuedAt + 300) {
    findings.push("GitHub App JWT payload must include app id, backdated iat, and configured exp.");
  }
  expectError(
    () => githubAppAuth.createGitHubAppJwt({ appId: "", privateKey: settings.privateKey }),
    "GitHub App id and private key are required.",
    findings
  );
}

async function checkInstallationTokenContract(findings) {
  const settings = {
    appId: "12345",
    apiUrl: "https://api.github.test",
    fetchTimeoutMs: 1000,
    jwtTtlSeconds: 300,
    privateKey: testPrivateKeyPem(),
    tokenRefreshBufferSeconds: 60,
  };
  const requests = [];
  const integration = githubAppAuth.createGitHubAppIntegration({
    settings,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      return {
        ok: true,
        status: 201,
        json: async () => ({
          token: "installation-token",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      };
    },
  });
  const firstToken = await integration.getInstallationToken("98765");
  const secondToken = await integration.getInstallationToken("98765");
  if (firstToken !== "installation-token" || secondToken !== "installation-token") {
    findings.push("GitHub App integration must return installation tokens.");
  }
  if (requests.length !== 1) {
    findings.push("GitHub App integration must cache unexpired installation tokens.");
  }
  const request = requests[0];
  if (request.url !== "https://api.github.test/app/installations/98765/access_tokens") {
    findings.push(`GitHub App installation-token URL changed: ${request.url}.`);
  }
  if (request.options.method !== "POST") {
    findings.push("GitHub App installation-token request must use POST.");
  }
  if (!/^Bearer [^.]+\.[^.]+\.[^.]+$/.test(request.options.headers.authorization || "")) {
    findings.push("GitHub App installation-token request must use a bearer JWT.");
  }
  if (request.options.headers["x-github-api-version"] !== "2022-11-28") {
    findings.push("GitHub App installation-token request must send the pinned GitHub API version.");
  }

  const missingTokenIntegration = githubAppAuth.createGitHubAppIntegration({
    settings,
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      json: async () => ({}),
    }),
  });
  await expectRejects(
    () => missingTokenIntegration.getInstallationToken("98765"),
    /GitHub installation token response did not include a token/,
    findings
  );
  const unconfiguredIntegration = githubAppAuth.createGitHubAppIntegration({
    settings: { ...settings, privateKey: "" },
    fetchImpl: async () => {
      throw new Error("should not fetch");
    },
  });
  await expectRejects(
    () => unconfiguredIntegration.getInstallationToken("98765"),
    /GitHub App auth is not configured/,
    findings
  );
}

function checkCliContract(findings) {
  const parsed = githubAppInstallationTokenCli.parseArgs([
    "--profile",
    "worker-dispatch",
    "--installation-id",
    "98765",
    "--github-actions-output",
  ]);
  if (
    !objectsEqual(parsed, {
      githubActionsOutput: true,
      installationId: "98765",
      profile: "worker-dispatch",
    })
  ) {
    findings.push(`GitHub App installation-token CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => githubAppInstallationTokenCli.parseArgs(["--installation-id"]),
    "--installation-id requires a value.",
    findings
  );
  expectError(
    () => githubAppInstallationTokenCli.parseArgs(["--profile", "bad"]),
    "--profile must be one of: main, worker-dispatch.",
    findings
  );
  expectError(
    () => githubAppInstallationTokenCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
  if (
    githubAppInstallationTokenCli.installationIdFromEnv("worker-dispatch", {
      REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID: "worker-installation",
      REVIEWBOT_GITHUB_INSTALLATION_ID: "main-installation",
    }) !== "worker-installation"
  ) {
    findings.push("worker-dispatch profile must prefer REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID.");
  }
}

function checkGitHubActionsOutput(findings) {
  expectError(
    () =>
      withEnv({ GITHUB_OUTPUT: "" }, () =>
        githubAppInstallationTokenCli.writeGitHubActionsOutput("token")
      ),
    "--github-actions-output requires GITHUB_OUTPUT.",
    findings
  );
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-github-output-"));
  const outputFile = path.join(tempDir, "output.txt");
  const stdout = captureStdout(() =>
    withEnv({ GITHUB_OUTPUT: outputFile }, () =>
      githubAppInstallationTokenCli.writeGitHubActionsOutput("installation-token")
    )
  );
  if (!stdout.includes("::add-mask::installation-token")) {
    findings.push("GitHub Actions output mode must mask the installation token.");
  }
  if (fs.readFileSync(outputFile, "utf8") !== "token=installation-token\n") {
    findings.push("GitHub Actions output mode must append token=<token> to GITHUB_OUTPUT.");
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/github-app-auth.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "DEFAULT_JWT_TTL_SECONDS",
    "DEFAULT_TOKEN_REFRESH_BUFFER_SECONDS",
    "createGitHubAppJwt",
    "tokenCache",
    "x-github-api-version",
    "readCollaboratorPermission",
    "readOrgMembership",
    "GitHub App auth is not configured",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/github-app-installation-token.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "PROFILES = [\"main\", \"worker-dispatch\"]",
    "--github-actions-output",
    "REVIEWBOT_WORKER_GITHUB_INSTALLATION_ID",
    "::add-mask::",
    "GITHUB_OUTPUT",
    "writeGitHubActionsOutput",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:github-app-auth"],
    "docs/github-app.md": [
      "npm run check:github-app-auth",
      "installation token contract",
    ],
    "docs/github-app-registration.md": [
      "npm run check:github-app-auth",
      "installation token contract",
    ],
    "docs/configuration.md": [
      "npm run check:github-app-auth",
      "REVIEWBOT_GITHUB_APP_TOKEN_REFRESH_BUFFER_SECONDS",
    ],
    "docs/worker-adapters.md": [
      "npm run check:github-app-auth",
      "worker-dispatch",
    ],
    "docs/release-operations-map.md": ["npm run check:github-app-auth"],
    "docs/release.md": [
      "npm run check:github-app-auth",
      "GitHub App auth contract",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(docTexts[doc] || readText(doc));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function testPrivateKeyPem() {
  if (!testPrivateKeyPem.cached) {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    testPrivateKeyPem.cached = privateKey.export({
      format: "pem",
      type: "pkcs1",
    });
  }
  return testPrivateKeyPem.cached;
}

function expectError(fn, expected, findings) {
  try {
    fn();
    findings.push(`expected error '${expected}'.`);
  } catch (error) {
    const message = error.message;
    if (expected instanceof RegExp) {
      if (!expected.test(message)) {
        findings.push(`expected error matching '${expected}', got '${message}'.`);
      }
    } else if (message !== expected) {
      findings.push(`expected error '${expected}', got '${message}'.`);
    }
  }
}

async function expectRejects(fn, expected, findings) {
  try {
    await fn();
    findings.push(`expected rejection '${expected}'.`);
  } catch (error) {
    const message = error.message;
    if (expected instanceof RegExp) {
      if (!expected.test(message)) {
        findings.push(`expected rejection matching '${expected}', got '${message}'.`);
      }
    } else if (message !== expected) {
      findings.push(`expected rejection '${expected}', got '${message}'.`);
    }
  }
}

function withEnv(nextEnv, fn) {
  const oldEnv = process.env;
  process.env = { ...oldEnv };
  for (const [key, value] of Object.entries(nextEnv)) {
    process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    process.env = oldEnv;
  }
}

function captureStdout(fn) {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = (chunk) => {
    output += String(chunk);
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}

function objectsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkGitHubAppAuthContract,
  targetDocs,
};
