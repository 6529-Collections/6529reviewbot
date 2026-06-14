#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const supportBundle = require("../src/support-bundle.cjs");
const supportBundleCli = require("../bin/support-bundle.cjs");

const root = path.resolve(__dirname, "..");

const requiredSafeEnvKeys = [
  "REVIEW_PROVIDER",
  "REVIEW_MODEL",
  "REVIEWBOT_MODEL_CATALOG_PATH",
  "REVIEWBOT_WORKER_ADAPTER",
  "REVIEWBOT_WORKER_GITHUB_WORKFLOW",
  "REVIEWBOT_WORKER_GITHUB_REF",
  "REVIEWBOT_WORKER_GITHUB_DISPATCH_MODE",
  "REVIEWBOT_BUDGET_MODE",
  "REVIEWBOT_PUBLIC_REPO_MODE",
  "REVIEWBOT_PRIVATE_REPO_MODE",
  "REVIEWBOT_ALLOWED_PR_AUTHORS",
  "REVIEWBOT_RUN_CONTROL_MODE",
  "REVIEW_USAGE_ENABLED",
  "REVIEWBOT_JOB_LEDGER_ENABLED",
  "REVIEWBOT_USAGE_API_PUBLIC_ENABLED",
  "REVIEWBOT_USAGE_API_ADMIN_ENABLED",
  "REVIEWBOT_ALERTS_ENABLED",
  "REVIEWBOT_ALERTS_NOTIFY_MODE",
  "REVIEWBOT_ADMIN_AUTH_MODE",
];

const requiredPresenceEnvKeys = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "REVIEWBOT_WORKER_GITHUB_TOKEN",
  "REVIEWBOT_WORKER_GITHUB_REPO",
  "REVIEWBOT_WORKER_GITHUB_APP_ID",
  "REVIEWBOT_WORKER_GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "REVIEWBOT_GITHUB_APP_ID",
  "REVIEWBOT_GITHUB_APP_PRIVATE_KEY",
  "REVIEW_USAGE_DB_RESOURCE_ARN",
  "REVIEW_USAGE_DB_SECRET_ARN",
  "REVIEWBOT_RUN_CONTROL_LEDGER_DB_RESOURCE_ARN",
  "REVIEWBOT_RUN_CONTROL_LEDGER_DB_SECRET_ARN",
  "REVIEWBOT_ALERTS_WEBHOOK_URL",
  "REVIEWBOT_ALERTS_SNS_TOPIC_ARN",
  "REVIEWBOT_ALERTS_SES_FROM",
  "REVIEWBOT_ALERTS_SES_TO",
  "REVIEWBOT_ADMIN_AUTH_HMAC_SECRET",
];

const supportDocs = [
  "README.md",
  "docs/support.md",
  "docs/release-readiness.md",
  "docs/security-review-checklist.md",
  "docs/release-operations-map.md",
];

function main() {
  const result = checkSupportBundleContract();
  console.log(
    `support bundle contract ok (${result.safeKeys} safe keys, ${result.presenceKeys} presence keys, ${result.docs} docs checked)`
  );
}

function checkSupportBundleContract(options = {}) {
  const findings = [];
  checkEnvKeyContracts(findings);
  checkSanitizedBundle(findings);
  checkCliContract(findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`support bundle contract check found ${findings.length} issue(s).`);
  }

  return {
    safeKeys: requiredSafeEnvKeys.length,
    presenceKeys: requiredPresenceEnvKeys.length,
    docs: supportDocs.length,
  };
}

function checkEnvKeyContracts(findings) {
  for (const key of requiredSafeEnvKeys) {
    if (!supportBundle.SAFE_ENV_KEYS.includes(key)) {
      findings.push(`SAFE_ENV_KEYS must include ${key}.`);
    }
  }
  for (const key of requiredPresenceEnvKeys) {
    if (!supportBundle.PRESENCE_ONLY_ENV_KEYS.includes(key)) {
      findings.push(`PRESENCE_ONLY_ENV_KEYS must include ${key}.`);
    }
    if (supportBundle.SAFE_ENV_KEYS.includes(key)) {
      findings.push(`${key} must remain presence-only, not a safe value.`);
    }
  }
}

function checkSanitizedBundle(findings) {
  const env = {
    REVIEW_PROVIDER: "anthropic",
    REVIEW_MODEL: "sk-proj-abcdefghijklmnopqrstuvwx123456",
    REVIEWBOT_MODEL_CATALOG_PATH: "C:\\private\\model-catalog.json",
    REVIEWBOT_WORKER_ADAPTER: "github_actions",
    REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/private-worker",
    GH_TOKEN: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
    OPENAI_API_KEY: "sk-proj-abcdefghijklmnopqrstuvwx123456",
    REVIEWBOT_ALERTS_WEBHOOK_URL: "https://hooks.slack.com/services/T00000000/B00000000/abcdefghijklmnopqrstuvwxyz",
    REVIEWBOT_ADMIN_AUTH_HMAC_SECRET: "admin-secret",
  };
  const bundle = supportBundle.collectSupportBundle({
    env,
    now: new Date("2026-06-13T12:00:00.000Z"),
    includeGitStatus: true,
    execFileSync: fakeGit,
  });
  const output = JSON.stringify(bundle);
  const markdown = supportBundle.formatSupportBundleMarkdown(bundle);

  if (bundle.generatedAt !== "2026-06-13T12:00:00.000Z") {
    findings.push(`support bundle generatedAt must use supplied clock, got ${bundle.generatedAt}.`);
  }
  if (bundle.environment.safe.REVIEW_PROVIDER !== "anthropic") {
    findings.push("support bundle must include safe REVIEW_PROVIDER values.");
  }
  if (bundle.environment.safe.REVIEW_MODEL !== "sk-[redacted]") {
    findings.push("support bundle must redact secret-shaped safe env values.");
  }
  if (bundle.environment.safe.REVIEWBOT_MODEL_CATALOG_PATH !== "[absolute-path-set]") {
    findings.push("support bundle must replace absolute safe path values with [absolute-path-set].");
  }
  for (const key of [
    "GH_TOKEN",
    "OPENAI_API_KEY",
    "REVIEWBOT_WORKER_GITHUB_REPO",
    "REVIEWBOT_ALERTS_WEBHOOK_URL",
    "REVIEWBOT_ADMIN_AUTH_HMAC_SECRET",
  ]) {
    if (bundle.environment.presence[key] !== "set") {
      findings.push(`support bundle must report ${key} as set.`);
    }
  }
  if (bundle.environment.presence.ANTHROPIC_API_KEY !== "unset") {
    findings.push("support bundle must report absent presence-only keys as unset.");
  }
  if (!bundle.git.status.includes("[redacted-github-token]") || !bundle.git.status.includes("sk-[redacted]")) {
    findings.push("support bundle git status must redact common secret-shaped values.");
  }
  for (const unsafe of [
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "sk-proj-abcdefghijkl",
    "6529-Collections/private-worker",
    "hooks.slack.com/services",
    "C:\\private\\model-catalog.json",
  ]) {
    if (output.includes(unsafe) || markdown.includes(unsafe)) {
      findings.push(`support bundle output must not include unsafe value '${unsafe}'.`);
    }
  }
  if (!markdown.includes("# 6529reviewbot Support Bundle")) {
    findings.push("support bundle markdown must keep its heading.");
  }
  if (!markdown.includes("This bundle is sanitized. It reports secret presence, not secret values.")) {
    findings.push("support bundle markdown must keep its sanitization warning.");
  }
}

function checkCliContract(findings) {
  const parsed = supportBundleCli.parseArgs(["--json", "--include-git-status", "--quiet"]);
  if (!objectsEqual(parsed, { includeGitStatus: true, json: true, quiet: true })) {
    findings.push(`support bundle CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => supportBundleCli.parseArgs(["--format", "xml"]),
    "Unknown argument '--format'.",
    findings
  );
  const quietBundle = supportBundleCli.main(["--quiet"], {
    env: { REVIEW_PROVIDER: "anthropic" },
    now: new Date("2026-06-13T12:00:00.000Z"),
    execFileSync: fakeGit,
  });
  if (!quietBundle.package?.name || !quietBundle.environment) {
    findings.push("support bundle CLI quiet mode must return the bundle.");
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "Generate a sanitized support bundle:",
      "npm run support:bundle",
    ],
    "docs/support.md": [
      "## Support Bundle",
      "It does not include secret values.",
      "Use `--include-git-status` only when file names in your local checkout are safe",
      "run:",
      "npm run check:public-artifacts",
    ],
    "docs/release-readiness.md": [
      "sanitized support bundle and support playbook",
    ],
    "docs/security-review-checklist.md": [
      "support bundles report secret presence",
    ],
    "docs/release-operations-map.md": [
      "support evidence",
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

function fakeGit(command, args) {
  const key = `${command} ${args.join(" ")}`;
  if (key === "git rev-parse --short=12 HEAD") {
    return "abcdef123456\n";
  }
  if (key === "git branch --show-current") {
    return "main\n";
  }
  if (key === "git status --short") {
    return "?? ghp_abcdefghijklmnopqrstuvwxyz1234567890.txt\n M sk-proj-abcdefghijklmnopqrstuvwx123456.js\n";
  }
  throw new Error(`unexpected git command ${key}`);
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

function objectsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
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
  checkSupportBundleContract,
  requiredPresenceEnvKeys,
  requiredSafeEnvKeys,
};
