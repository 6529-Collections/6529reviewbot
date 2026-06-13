#!/usr/bin/env node

"use strict";

const path = require("path");
const appServer = require("../src/app-server.cjs");

const root = path.resolve(__dirname, "..");
const fs = require("fs");

const targetDocs = [
  "README.md",
  "docs/github-app.md",
  "docs/deployment.md",
  "docs/release-readiness.md",
  "docs/security-review-checklist.md",
  "docs/release-operations-map.md",
  "docs/release.md",
];

const unsafeQueryValues = [
  "temporary-code",
  "test-state",
  "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
  "sk-proj-abcdefghijklmnopqrstuvwx123456",
  "123456789012",
  "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
  "private-repo-name",
];

function main() {
  checkGitHubAppRoutesContract()
    .then((result) => {
      console.log(
        `GitHub App route contract ok (${result.routeCases} route cases, ${result.docs} docs checked)`
      );
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

async function checkGitHubAppRoutesContract(options = {}) {
  const findings = [];
  checkOperatorPathAllowlist(findings);
  checkDirectOperatorResponses(findings);
  await checkHttpRouteResponses(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`GitHub App route contract check found ${findings.length} issue(s).`);
  }

  return {
    routeCases: 6,
    docs: targetDocs.length,
  };
}

function checkOperatorPathAllowlist(findings) {
  for (const pathname of [
    "/github-app/manifest-complete",
    "/github-app/setup",
    "/github-app/callback",
  ]) {
    if (!appServer.isGitHubAppOperatorPath(pathname)) {
      findings.push(`GitHub App operator path '${pathname}' must stay enabled.`);
    }
  }

  for (const pathname of [
    "/github-app/manifest-complete/extra",
    "/github-app",
    "/webhooks/github",
    "/api/admin/status",
  ]) {
    if (appServer.isGitHubAppOperatorPath(pathname)) {
      findings.push(`GitHub App operator path allowlist is too broad: '${pathname}'.`);
    }
  }
}

function checkDirectOperatorResponses(findings) {
  const manifestComplete = appServer.githubAppOperatorResponse(
    unsafeUrl("/github-app/manifest-complete")
  );
  if (
    manifestComplete.kind !== "github_app_manifest_complete" ||
    manifestComplete.codeReceived !== true ||
    manifestComplete.stateReceived !== true
  ) {
    findings.push("manifest-complete route must report only code/state presence.");
  }
  assertPublicSafeResponse("manifest-complete route", manifestComplete, findings);
  assertDoesNotTriggerWork("manifest-complete route", manifestComplete, findings);
  if (!String(manifestComplete.nextStep || "").includes("npm run github-app:convert")) {
    findings.push("manifest-complete route must point operators at the private conversion CLI.");
  }

  const setup = appServer.githubAppOperatorResponse(unsafeUrl("/github-app/setup"));
  if (setup.kind !== "github_app_setup") {
    findings.push("setup route kind changed.");
  }
  assertPublicSafeResponse("setup route", setup, findings);
  assertDoesNotTriggerWork("setup route", setup, findings);
  if (!String(setup.nextStep || "").includes("docs/github-app-registration.md")) {
    findings.push("setup route must point operators at the registration packet.");
  }

  const callback = appServer.githubAppOperatorResponse(unsafeUrl("/github-app/callback"));
  if (callback.kind !== "github_app_callback") {
    findings.push("callback route kind changed.");
  }
  assertPublicSafeResponse("callback route", callback, findings);
  assertDoesNotTriggerWork("callback route", callback, findings);
  if (!String(callback.nextStep || "").includes("does not use a browser OAuth callback")) {
    findings.push("callback route must explain that browser OAuth is not used.");
  }
}

async function checkHttpRouteResponses(findings) {
  const settings = {
    webhookPath: "/webhooks/github",
    maxBodyBytes: 1024,
    webhookSecret: "test-webhook-secret-with-enough-entropy",
  };
  for (const pathname of [
    "/github-app/manifest-complete",
    "/github-app/setup",
    "/github-app/callback",
  ]) {
    const result = await appServer.handleHttpRequest(
      {
        method: "GET",
        url: `${pathname}?${unsafeQueryString()}`,
        headers: {},
      },
      { settings }
    );
    if (result.statusCode !== 200 || result.body?.ok !== true) {
      findings.push(`${pathname} must return a public-safe 200 guidance response.`);
    }
    assertPublicSafeResponse(`${pathname} HTTP response`, result.body, findings);
    assertDoesNotTriggerWork(`${pathname} HTTP response`, result.body, findings);
  }

  const postResult = await appServer.handleHttpRequest(
    {
      method: "POST",
      url: `/github-app/manifest-complete?${unsafeQueryString()}`,
      headers: {},
      on: () => {},
    },
    { settings }
  );
  if (postResult.statusCode !== 404) {
    findings.push("GitHub App operator routes must be GET-only handoff routes.");
  }
  assertPublicSafeResponse("manifest-complete POST response", postResult.body, findings);
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/app-server.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "request.method === \"GET\" && isGitHubAppOperatorPath(url.pathname)",
    "\"/github-app/manifest-complete\"",
    "\"/github-app/setup\"",
    "\"/github-app/callback\"",
    "codeReceived: Boolean(url.searchParams.get(\"code\"))",
    "stateReceived: Boolean(url.searchParams.get(\"state\"))",
    "<code-from-url>",
    "Do not paste the manifest code",
    "does not use a browser OAuth callback",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:github-app-routes"],
    "docs/github-app.md": [
      "npm run check:github-app-routes",
      "browser handoff route contract",
      "do not echo",
    ],
    "docs/deployment.md": [
      "npm run check:github-app-routes",
      "browser handoff route contract",
    ],
    "docs/release-readiness.md": [
      "GitHub App browser handoff routes",
      "npm run check:github-app-routes",
    ],
    "docs/security-review-checklist.md": [
      "GitHub App browser handoff routes",
      "npm run check:github-app-routes",
    ],
    "docs/release-operations-map.md": ["npm run check:github-app-routes"],
    "docs/release.md": [
      "npm run check:github-app-routes",
      "GitHub App route contract",
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

function assertPublicSafeResponse(name, response, findings) {
  const serialized = JSON.stringify(response);
  for (const unsafe of unsafeQueryValues) {
    if (serialized.includes(unsafe)) {
      findings.push(`${name} must not echo unsafe query value '${unsafe}'.`);
    }
  }
  for (const pattern of [/github_pat_/, /sk-proj-/, /arn:aws:/, /123456789012/]) {
    if (pattern.test(serialized)) {
      findings.push(`${name} must not include live-looking secret or cloud identifiers.`);
    }
  }
}

function assertDoesNotTriggerWork(name, response, findings) {
  const forbiddenFields = ["enqueued", "event", "jobs", "runControl", "configuration"];
  for (const field of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(response || {}, field)) {
      findings.push(`${name} must not include review-work field '${field}'.`);
    }
  }
}

function unsafeUrl(pathname) {
  return new URL(`https://reviewbot.example.com${pathname}?${unsafeQueryString()}`);
}

function unsafeQueryString() {
  return [
    "code=temporary-code",
    "state=test-state",
    "token=github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
    "provider=sk-proj-abcdefghijklmnopqrstuvwx123456",
    "account=123456789012",
    "aws=arn%3Aaws%3Ards%3Aus-east-1%3A123456789012%3Acluster%3Areviewbot",
    "repository=private-repo-name",
  ].join("&");
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
  checkGitHubAppRoutesContract,
  targetDocs,
};
