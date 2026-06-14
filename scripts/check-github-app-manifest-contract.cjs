#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const githubAppManifest = require("../src/github-app-manifest.cjs");
const githubAppManifestConversion = require("../src/github-app-manifest-conversion.cjs");
const githubAppManifestCli = require("../bin/render-github-app-manifest.cjs");
const githubAppManifestConversionCli = require("../bin/convert-github-app-manifest.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/github-app-registration.md",
  "docs/github-app.md",
  "docs/deployment.md",
  "docs/install.md",
  "docs/release-operations-map.md",
  "docs/release.md",
];

function main() {
  checkGitHubAppManifestContract()
    .then((result) => {
      console.log(
        `GitHub App manifest contract ok (${result.manifestCases} manifest cases, ${result.conversionCases} conversion cases, ${result.docs} docs checked)`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

async function checkGitHubAppManifestContract(options = {}) {
  const findings = [];
  checkManifestCliContract(findings);
  checkManifestContract(findings);
  checkConversionCliContract(findings);
  await checkConversionContract(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`GitHub App manifest contract check found ${findings.length} issue(s).`);
  }

  return {
    manifestCases: 7,
    conversionCases: 6,
    docs: targetDocs.length,
  };
}

function checkManifestCliContract(findings) {
  const parsed = githubAppManifestCli.parseArgs([
    "--host",
    "https://reviewbot.6529.io",
    "--template",
    "templates/github-app-manifest.example.json",
    "--name",
    "6529bot-review",
    "--form",
    "--owner",
    "6529-Collections",
    "--state",
    "test-state",
    "--quiet",
  ]);
  if (
    !objectsEqual(parsed, {
      form: true,
      host: "https://reviewbot.6529.io",
      name: "6529bot-review",
      owner: "6529-Collections",
      quiet: true,
      state: "test-state",
      template: "templates/github-app-manifest.example.json",
    })
  ) {
    findings.push(`GitHub App manifest CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => githubAppManifestCli.parseArgs(["--host"]),
    "--host requires a value.",
    findings
  );
  expectError(
    () => githubAppManifestCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
}

function checkManifestContract(findings) {
  const template = githubAppManifest.loadGitHubAppManifestTemplate();
  if (template.name !== "6529bot" || template.public !== false) {
    findings.push("GitHub App manifest template must stay private and named 6529bot.");
  }
  if (template.request_oauth_on_install !== false || template.setup_on_update !== false) {
    findings.push("GitHub App manifest template must not request OAuth on install or setup on update.");
  }
  if (template.hook_attributes.active !== true) {
    findings.push("GitHub App manifest webhook must stay active in the template.");
  }
  if (Object.prototype.hasOwnProperty.call(template.default_permissions, "actions")) {
    findings.push("target-repository GitHub App manifest must not request Actions permission.");
  }
  for (const [permission, access] of Object.entries(githubAppManifest.REQUIRED_DEFAULT_PERMISSIONS)) {
    if (template.default_permissions[permission] !== access) {
      findings.push(`GitHub App manifest permission ${permission} must be ${access}.`);
    }
  }
  for (const eventName of githubAppManifest.REQUIRED_DEFAULT_EVENTS) {
    if (!template.default_events.includes(eventName)) {
      findings.push(`GitHub App manifest event ${eventName} must stay enabled.`);
    }
  }

  const rendered = githubAppManifest.renderGitHubAppManifest({
    host: "https://reviewbot.6529.io/",
  });
  if (rendered.hook_attributes.url !== "https://reviewbot.6529.io/webhooks/github") {
    findings.push("GitHub App manifest hook URL did not render from the host.");
  }
  if (rendered.redirect_url !== "https://reviewbot.6529.io/github-app/manifest-complete") {
    findings.push("GitHub App manifest redirect URL did not render from the host.");
  }
  if (!rendered.callback_urls.includes("https://reviewbot.6529.io/github-app/callback")) {
    findings.push("GitHub App manifest callback URL did not render from the host.");
  }
  if (rendered.setup_url !== "https://reviewbot.6529.io/github-app/setup") {
    findings.push("GitHub App manifest setup URL did not render from the host.");
  }
  if (JSON.stringify(rendered).includes("<bot-host>")) {
    findings.push("rendered GitHub App manifest must not include placeholders.");
  }

  expectError(
    () => githubAppManifest.renderGitHubAppManifest({ host: "http://reviewbot.example.com" }),
    "--host must use https.",
    findings
  );
  expectError(
    () => githubAppManifest.renderGitHubAppManifest({ host: "https://reviewbot.example.com/path" }),
    "--host must not include a path, query, or fragment.",
    findings
  );
  expectError(
    () => githubAppManifest.renderGitHubAppManifest({ host: "https://reviewbot.example.com" }),
    "--host must not use documentation, example, local, or reserved hosts.",
    findings
  );
  expectError(
    () => githubAppManifest.renderGitHubAppManifest({ host: "https://localhost" }),
    "--host must not use documentation, example, local, or reserved hosts.",
    findings
  );

  const withActions = clone(template);
  withActions.default_permissions.actions = "write";
  expectError(
    () => githubAppManifest.validateGitHubAppManifestTemplate(withActions),
    "GitHub App manifest template default_permissions.actions must be omitted; use a dispatch-only App for Actions write.",
    findings
  );

  const formManifest = {
    ...rendered,
    name: "<6529bot>",
  };
  const form = githubAppManifest.renderGitHubAppRegistrationForm({
    manifest: formManifest,
    owner: "6529-Collections",
    state: "state-123",
  });
  for (const expected of [
    "organizations/6529-Collections/settings/apps/new",
    "state=state-123",
    "&lt;6529bot&gt;",
    "&quot;name&quot;:&quot;&lt;6529bot&gt;&quot;",
  ]) {
    if (!form.includes(expected)) {
      findings.push(`GitHub App registration form must include '${expected}'.`);
    }
  }
  if (form.includes("<6529bot>")) {
    findings.push("GitHub App registration form must escape manifest names.");
  }
  expectError(
    () => githubAppManifest.registrationFormActionUrl({ owner: "bad/owner" }),
    "--owner must be a GitHub organization slug.",
    findings
  );
}

function checkConversionCliContract(findings) {
  const parsed = githubAppManifestConversionCli.parseArgs([
    "--code",
    "https://reviewbot.example.com/github-app/manifest-complete?code=abc_123-XYZ",
    "--output",
    "C:\\private\\6529bot-app.json",
    "--api-url",
    "https://github.example/api/v3",
    "--token-env",
    "REVIEWBOT_GITHUB_MANIFEST_TOKEN",
    "--timeout-ms",
    "1234",
    "--json",
    "--overwrite",
    "--allow-repo-output",
    "--no-auth",
  ]);
  if (
    !objectsEqual(parsed, {
      allowRepoOutput: true,
      apiUrl: "https://github.example/api/v3",
      code: "https://reviewbot.example.com/github-app/manifest-complete?code=abc_123-XYZ",
      json: true,
      noAuth: true,
      outputPath: "C:\\private\\6529bot-app.json",
      overwrite: true,
      timeoutMs: 1234,
      tokenEnv: "REVIEWBOT_GITHUB_MANIFEST_TOKEN",
    })
  ) {
    findings.push(`GitHub App manifest conversion CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => githubAppManifestConversionCli.parseArgs(["--output"]),
    "--output requires a value.",
    findings
  );
  expectError(
    () => githubAppManifestConversionCli.parseArgs(["--timeout-ms", "bad"]),
    "--timeout-ms must be a positive integer.",
    findings
  );
  expectError(
    () => githubAppManifestConversionCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );

  const help = githubAppManifestConversionCli.helpText();
  for (const snippet of [
    "npm run github-app:convert -- -- --code <code> --output C:\\private\\6529bot-app.json",
    "npm run github-app:convert -- -- --code <production-bot-origin>/github-app/manifest-complete?code=<code> --output /private/6529bot-app.json",
    "--code <code|url>",
  ]) {
    if (!help.includes(snippet)) {
      findings.push(`GitHub App manifest conversion CLI help must include '${snippet}'.`);
    }
  }
  if (help.includes("reviewbot.example.com/github-app/manifest-complete?code=<code>")) {
    findings.push("GitHub App manifest conversion CLI help must not use documentation/example callback hosts.");
  }
}

async function checkConversionContract(findings) {
  if (
    githubAppManifestConversion.normalizeManifestCode(
      "https://reviewbot.example.com/github-app/manifest-complete?state=test&code=abc_123-XYZ"
    ) !== "abc_123-XYZ"
  ) {
    findings.push("manifest conversion code must be extracted from callback URLs.");
  }
  expectError(
    () => githubAppManifestConversion.normalizeManifestCode("https://reviewbot.example.com/github-app/manifest-complete"),
    "--code must be a GitHub manifest conversion code or callback URL with a code query parameter.",
    findings
  );
  expectError(
    () =>
      githubAppManifestConversion.resolvePrivateOutputPath("private-app.json", {
        cwd: root,
        repoRoot: root,
      }),
    "Refusing to write GitHub App credentials inside this public repository. Pass --allow-repo-output only for isolated tests.",
    findings
  );
  expectError(
    () =>
      githubAppManifestConversion.githubAppManifestConversionSettingsFromEnv({
        REVIEWBOT_GITHUB_MANIFEST_TIMEOUT_MS: "0",
      }),
    "REVIEWBOT_GITHUB_MANIFEST_TIMEOUT_MS must be a positive integer.",
    findings
  );
  expectError(
    () =>
      githubAppManifestConversion.validateManifestConversionResponse({
        id: 1,
        name: "6529bot",
        client_id: "client-id",
        client_secret: "client-secret",
        webhook_secret: "webhook-secret",
        pem: "not-a-private-key",
      }),
    "GitHub App pem did not look like a private key.",
    findings
  );

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-github-app-contract-"));
  const unsafeOutputPath = path.join(
    tempDir,
    "123456789012-github_pat_abcdefghijklmnopqrstuvwxyz1234567890.json"
  );
  let capturedRequest = null;
  const summary = await githubAppManifestConversion.convertGitHubAppManifest({
    code: "abc123",
    outputPath: unsafeOutputPath,
    repoRoot: root,
    token: "operator-token",
    fetchImpl: async (url, options = {}) => {
      capturedRequest = { url: String(url), options };
      return {
        ok: true,
        status: 201,
        json: async () => ({
          id: 123,
          slug: "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
          name: "6529bot",
          owner: { login: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890" },
          html_url: "https://github.com/apps/sk-ant-api03-secretvalue1234567890",
          external_url:
            "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot\nhttps://github.com/6529-Collections/6529reviewbot",
          client_id: "client-id",
          client_secret: "client-secret",
          webhook_secret: "webhook-secret",
          pem: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----\n",
          permissions: { contents: "read", issues: "write" },
          events: ["issue_comment", "pull_request"],
        }),
      };
    },
  });
  if (capturedRequest.url !== "https://api.github.com/app-manifests/abc123/conversions") {
    findings.push(`manifest conversion request URL changed: ${capturedRequest.url}.`);
  }
  if (capturedRequest.options.method !== "POST") {
    findings.push("manifest conversion request must use POST.");
  }
  if (capturedRequest.options.headers.authorization !== "Bearer operator-token") {
    findings.push("manifest conversion request must send the selected bearer token.");
  }
  const written = JSON.parse(fs.readFileSync(unsafeOutputPath, "utf8"));
  if (written.client_secret !== "client-secret" || !String(written.pem).includes("PRIVATE KEY")) {
    findings.push("manifest conversion output file must contain the private GitHub response.");
  }
  const formatted = githubAppManifestConversion.formatManifestConversionSummary(summary);
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "sk-ant-api03-secretvalue",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "123456789012",
    "arn:aws:rds:us-east-1",
    "client-secret",
    "webhook-secret",
    "PRIVATE KEY",
    "reviewbot\nhttps://github.com",
  ]) {
    if (JSON.stringify(summary).includes(unsafe) || formatted.includes(unsafe)) {
      findings.push(`manifest conversion summary must redact or normalize '${unsafe}'.`);
    }
  }
  for (const expected of [
    "sk-[redacted]",
    "github_pat_[redacted]",
    "[redacted-aws-account-id]",
    "arn:aws:[redacted]",
    "client_secret=set",
    "webhook_secret=set",
    "pem=set",
  ]) {
    if (!JSON.stringify(summary).includes(expected) && !formatted.includes(expected)) {
      findings.push(`manifest conversion summary must include '${expected}'.`);
    }
  }
  await expectRejects(
    () =>
      githubAppManifestConversion.createGitHubAppFromManifest({
        allowNoAuth: true,
        code: "abc123",
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          text: async () =>
            "bad github_pat_abcdefghijklmnopqrstuvwxyz1234567890 123456789012 arn:aws:rds:us-east-1:123456789012:cluster:reviewbot\nnext line",
        }),
      }),
    /github_pat_\[redacted\].*\[redacted-aws-account-id\].*arn:aws:\[redacted\].*next line/,
    findings
  );
}

function checkSourceInvariants(sourceTexts, findings) {
  const manifestPath = "src/github-app-manifest.cjs";
  const manifestText = sourceTexts[manifestPath] || readText(manifestPath);
  for (const snippet of [
    "REQUIRED_DEFAULT_PERMISSIONS",
    "REQUIRED_DEFAULT_EVENTS",
    "isPlaceholderOrigin",
    "default_permissions.actions must be omitted",
    "dispatch-only App for Actions write",
    "manifestContainsPlaceholder(manifest, \"<bot-host>\")",
    "isPlaceholderOrigin",
  ]) {
    if (!manifestText.includes(snippet)) {
      findings.push(`${manifestPath} must include '${snippet}'.`);
    }
  }

  const conversionPath = "src/github-app-manifest-conversion.cjs";
  const conversionText = sourceTexts[conversionPath] || readText(conversionPath);
  for (const snippet of [
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "safeSummaryText(text).slice(0, 200)",
    "replace(/\\r?\\n/g, \" \")",
    "Refusing to write GitHub App credentials inside this public repository",
  ]) {
    if (!conversionText.includes(snippet)) {
      findings.push(`${conversionPath} must include '${snippet}'.`);
    }
  }

  const manifestBinPath = "bin/render-github-app-manifest.cjs";
  const manifestBinText = sourceTexts[manifestBinPath] || readText(manifestBinPath);
  for (const snippet of ["--host", "--form", "--owner", "--quiet"]) {
    if (!manifestBinText.includes(snippet)) {
      findings.push(`${manifestBinPath} must include '${snippet}'.`);
    }
  }

  const conversionBinPath = "bin/convert-github-app-manifest.cjs";
  const conversionBinText = sourceTexts[conversionBinPath] || readText(conversionBinPath);
  for (const snippet of [
    "--code",
    "--output",
    "--token-env",
    "--allow-repo-output",
    "--no-auth",
    "<production-bot-origin>/github-app/manifest-complete?code=<code>",
  ]) {
    if (!conversionBinText.includes(snippet)) {
      findings.push(`${conversionBinPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:github-app-manifest"],
    "docs/github-app-registration.md": [
      "npm run check:github-app-manifest",
      "GitHub App manifest contract check",
      "documentation, example, local, or reserved hosts",
      "Actions: write",
    ],
    "docs/github-app.md": [
      "npm run check:github-app-manifest",
      "documentation, example, local, or reserved hosts",
      "dispatch-only App",
      "Actions: write",
    ],
    "docs/deployment.md": ["npm run check:github-app-manifest"],
    "docs/install.md": [
      "npm run check:github-app-manifest",
      "documentation, example, local, or reserved hosts",
    ],
    "docs/release-operations-map.md": ["npm run check:github-app-manifest"],
    "docs/release.md": [
      "npm run check:github-app-manifest",
      "GitHub App manifest contract",
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
    await assert.rejects(fn, expected);
  } catch (error) {
    findings.push(`expected rejection matching '${expected}', got '${error.message}'.`);
  }
}

function objectsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
  checkGitHubAppManifestContract,
  targetDocs,
};
