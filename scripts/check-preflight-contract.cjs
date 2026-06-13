#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const preflightCli = require("../bin/preflight.cjs");
const {
  formatPreflightResult,
  runPreflight,
} = require("../src/preflight.cjs");

const root = path.resolve(__dirname, "..");

const expectedChecks = [
  "webhook",
  "github_app_auth",
  "model_catalog",
  "review_jobs",
  "admission_policy",
  "budget_policy",
  "runtime_control",
  "run_control",
  "repository_config",
  "worker_adapter",
  "provider_keys",
  "usage_ledger",
  "job_ledger",
  "ledger_schema",
  "model_price_sources",
  "usage_api",
  "admin_auth",
  "alerts",
];

const preflightDocs = [
  "README.md",
  "docs/configuration.md",
  "docs/deployment.md",
  "docs/release.md",
  "docs/release-operations-map.md",
  "docs/release-readiness.md",
];

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529reviewbot-preflight-contract-"));
const freshPriceFile = path.join(tempDir, "model-prices.json");

process.on("exit", () => {
  fs.rmSync(tempDir, { force: true, recursive: true });
});

fs.writeFileSync(
  freshPriceFile,
  JSON.stringify(
    {
      version: 1,
      currency: "USD",
      prices: [
        {
          provider: "anthropic",
          model: "claude-opus-4-8",
          inputUsdPerMillion: 1,
          outputUsdPerMillion: 2,
          effectiveFrom: "2026-06-12T00:00:00.000Z",
          sourceUrl: "https://example.com/provider-pricing",
          sourceCheckedAt: "2026-06-12T12:00:00.000Z",
        },
      ],
    },
    null,
    2
  )
);

function main() {
  const result = checkPreflightContract();
  console.log(
    `preflight contract ok (${result.checks} checks, ${result.docs} docs checked)`
  );
}

function checkPreflightContract(options = {}) {
  const findings = [];
  checkPreflightShape(findings);
  checkStrictAndProfileBehavior(findings);
  checkRedactedDiagnostics(findings);
  checkCliContract(findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`preflight contract check found ${findings.length} issue(s).`);
  }

  return {
    checks: expectedChecks.length,
    docs: preflightDocs.length,
  };
}

function checkPreflightShape(findings) {
  const result = runPreflight({
    env: contractEnv({ REVIEWBOT_MODEL_PRICE_FILE: freshPriceFile }),
    now: "2026-06-20T12:00:00.000Z",
  });
  const checkNames = result.checks.map((check) => check.name);
  if (!objectsEqual(checkNames, expectedChecks)) {
    findings.push(
      `preflight checks must stay in documented order: expected ${expectedChecks.join(", ")}, got ${checkNames.join(", ")}.`
    );
  }
  if (result.errors.length) {
    findings.push(`baseline preflight contract env must have no errors: ${JSON.stringify(result.errors)}.`);
  }
  if (!result.warnings.some((warning) => warning.name === "webhook")) {
    findings.push("baseline preflight contract env must surface weak webhook warnings.");
  }
  const priceCheck = result.checks.find((check) => check.name === "model_price_sources");
  if (!priceCheck || priceCheck.configured !== true || priceCheck.file !== undefined) {
    findings.push("model_price_sources check must report freshness without exposing local file paths.");
  }

  const formatted = formatPreflightResult(result);
  for (const snippet of [
    "6529reviewbot preflight: ok",
    "profile: server",
    "Checks:",
    "- ok: webhook",
    "Warnings:",
    "- webhook:",
  ]) {
    if (!formatted.includes(snippet)) {
      findings.push(`formatted preflight output must include '${snippet}'.`);
    }
  }
  if (formatted.includes(freshPriceFile)) {
    findings.push("formatted preflight output must not expose model price file paths.");
  }
}

function checkStrictAndProfileBehavior(findings) {
  const env = contractEnv();
  const normal = runPreflight({ env });
  const strict = runPreflight({ env, strict: true });
  if (normal.ok !== true || normal.warnings.length === 0) {
    findings.push("non-strict preflight must pass when warnings exist but errors do not.");
  }
  if (strict.ok !== false) {
    findings.push("strict preflight must fail when warnings exist.");
  }

  const worker = runPreflight({
    profile: "worker",
    env: contractEnv({
      REVIEWBOT_WORKER_ADAPTER: "local",
      ANTHROPIC_API_KEY: "configured-for-preflight",
    }),
  });
  if (worker.profile !== "worker") {
    findings.push(`worker profile must be preserved in result.profile, got '${worker.profile}'.`);
  }
  if (worker.errors.some((error) => error.name === "provider_keys")) {
    findings.push("worker profile with local worker and provider key must not fail provider_keys.");
  }
}

function checkRedactedDiagnostics(findings) {
  const secretPath = `missing-sk-proj-abcdefghijklmnopqrstuvwx123456.json`;
  const result = runPreflight({
    env: contractEnv({
      REVIEWBOT_MODEL_CATALOG_PATH: secretPath,
    }),
  });
  const output = `${JSON.stringify(result)}\n${formatPreflightResult(result)}`;
  if (!result.errors.some((error) => error.name === "model_catalog")) {
    findings.push("model_catalog read failures must be captured as preflight errors.");
  }
  if (output.includes("sk-proj-abcdefghijkl")) {
    findings.push("preflight error output must redact provider-key-shaped diagnostics.");
  }
  if (!output.includes("sk-[redacted]")) {
    findings.push("preflight error output should preserve a redacted provider-key placeholder.");
  }
}

function checkCliContract(findings) {
  const parsed = preflightCli.parseArgs(["--json", "--strict", "--profile", "worker"]);
  if (!objectsEqual(parsed, { json: true, profile: "worker", strict: true })) {
    findings.push(`preflight CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  const help = preflightCli.parseArgs(["--help"]);
  if (help.help !== true || help.profile !== "server") {
    findings.push(`preflight CLI help parse contract changed: ${JSON.stringify(help)}.`);
  }
  expectError(
    () => preflightCli.parseArgs(["--profile"]),
    "--profile requires a value.",
    findings
  );
  expectError(
    () => preflightCli.parseArgs(["--profile", "operator"]),
    "--profile must be one of: server, worker.",
    findings
  );
  expectError(
    () => preflightCli.parseArgs(["--verbose"]),
    "Unknown argument '--verbose'.",
    findings
  );
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run preflight",
      "npm run check:preflight",
      "npm run check:preflight-contract",
    ],
    "docs/configuration.md": [
      "npm run preflight -- -- --json",
      "`npm run check:preflight` runs deterministic no-network fixtures",
      "`npm run check:preflight-contract` keeps the preflight check order",
    ],
    "docs/deployment.md": [
      "Run a no-network configuration preflight before starting the server:",
      "npm run preflight",
      "npm run check:preflight-contract",
    ],
    "docs/release.md": [
      "`npm run check:preflight` passes against the synthetic central App server",
      "`npm run check:preflight-contract` confirms the preflight check order",
      "`npm run preflight -- -- --strict` in the release candidate environment",
    ],
    "docs/release-operations-map.md": [
      "npm run check:preflight",
      "npm run check:preflight-contract",
    ],
    "docs/release-readiness.md": [
      "release-time preflight fixtures",
      "preflight contract checker that keeps check order",
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

function contractEnv(overrides = {}) {
  return {
    GITHUB_WEBHOOK_SECRET: "weak-secret",
    REVIEWBOT_REVIEW_LANES: "anthropic:claude-opus-4-8",
    REVIEWBOT_WORKER_ADAPTER: "noop",
    REVIEWBOT_WORKER_GITHUB_REPO: "6529-Collections/6529reviewbot",
    REVIEW_USAGE_ENABLED: "false",
    REVIEWBOT_JOB_LEDGER_ENABLED: "false",
    REVIEWBOT_ALERTS_ENABLED: "false",
    REVIEWBOT_ADMIN_AUTH_MODE: "disabled",
    ...overrides,
  };
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
  checkPreflightContract,
  expectedChecks,
};
