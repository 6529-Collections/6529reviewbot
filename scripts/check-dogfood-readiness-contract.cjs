#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const dogfoodReadiness = require("../src/dogfood-readiness.cjs");
const dogfoodReadinessCli = require("../bin/dogfood-readiness.cjs");
const operatorWorkspace = require("../src/operator-workspace.cjs");

const root = path.resolve(__dirname, "..");

const readinessDocs = [
  "README.md",
  "docs/dogfood-readiness.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/dogfood.md",
];

function main() {
  const result = checkDogfoodReadinessContract();
  console.log(
    `dogfood readiness contract ok (${result.cliCases} CLI cases, ${result.reportCases} report cases, ${result.docs} docs checked)`
  );
}

function checkDogfoodReadinessContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkStaticReport(findings);
  checkModelPriceReport(findings);
  checkWorkspaceReport(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`dogfood readiness contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 4,
    reportCases: 4,
    docs: readinessDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = dogfoodReadinessCli.parseArgs([
    "--",
    "--repository-config",
    "one.yml",
    "--repository-config",
    "two.yml",
    "--budget-policy-file",
    "budget.json",
    "--model-catalog-file",
    "models.json",
    "--model-price-file",
    "prices.json",
    "--allow-stale-model-price-source",
    "--allow-zero-model-price",
    "--max-model-price-source-age-days",
    "45",
    "--operator-workspace",
    "workspace",
    "--require-operator-workspace-ready",
    "--strict-preflight",
    "--json",
    "--quiet",
    "--require-ready",
  ]);
  if (
    !objectsEqual(parsed, {
      budgetPolicyFile: "budget.json",
      includePreflight: true,
      json: true,
      modelCatalogFile: "models.json",
      modelPriceFile: "prices.json",
      allowStaleModelPriceSource: true,
      allowZeroModelPrice: true,
      maxModelPriceSourceAgeDays: 45,
      operatorWorkspaceDir: "workspace",
      preflightProfile: "server",
      quiet: true,
      requireOperatorWorkspaceReady: true,
      repositoryConfigFiles: ["one.yml", "two.yml"],
      requireReady: true,
      strictPreflight: true,
    })
  ) {
    findings.push(`dogfood readiness CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }

  const defaults = dogfoodReadinessCli.parseArgs([]);
  if (Object.prototype.hasOwnProperty.call(defaults, "repositoryConfigFiles")) {
    findings.push("dogfood readiness CLI must omit repositoryConfigFiles when defaults should apply.");
  }
  expectError(
    () => dogfoodReadinessCli.parseArgs(["--require-operator-workspace-ready"]),
    "--require-operator-workspace-ready requires --operator-workspace.",
    findings
  );
  expectError(
    () => dogfoodReadinessCli.parseArgs(["--max-model-price-source-age-days", "-1"]),
    "--max-model-price-source-age-days must be a non-negative number.",
    findings
  );
}

function checkStaticReport(findings) {
  const report = dogfoodReadiness.collectDogfoodReadiness({
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
  });
  if (report.ready !== true) {
    findings.push("default dogfood readiness report should be ready for public static inputs.");
  }
  if (report.checks.repositoryConfigs.count !== 2) {
    findings.push(`default readiness should check 2 repository configs, got ${report.checks.repositoryConfigs.count}.`);
  }
  if (report.inputs.operatorWorkspace !== null) {
    findings.push("default readiness report must not include operator workspace input.");
  }
  if (report.inputs.modelPriceFile !== null || report.checks.modelPriceCoverage !== null) {
    findings.push("default readiness report must not include model price coverage input.");
  }
  const markdown = dogfoodReadiness.formatDogfoodReadinessMarkdown(report);
  if (!markdown.includes("# 6529bot Dogfood Readiness")) {
    findings.push("dogfood readiness Markdown must keep its heading.");
  }
}

function checkModelPriceReport(findings) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-readiness-prices-"));
  const priceFile = path.join(tempDir, "model-prices.json");
  fs.writeFileSync(priceFile, JSON.stringify(freshPriceDocument(), null, 2), "utf8");
  const report = dogfoodReadiness.collectDogfoodReadiness({
    modelPriceFile: priceFile,
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
  });
  const output = JSON.stringify(report);
  const markdown = dogfoodReadiness.formatDogfoodReadinessMarkdown(report);
  if (!report.ready || report.checks.modelPriceCoverage?.ready !== true) {
    findings.push("fresh model price file should keep dogfood readiness ready.");
  }
  if (report.inputs.modelPriceFile?.file !== "[external-path-set]") {
    findings.push("dogfood readiness must redact external model price file paths.");
  }
  if (output.includes(tempDir) || markdown.includes(tempDir)) {
    findings.push("dogfood readiness output must not include private model price file paths.");
  }
  if (!markdown.includes("## Model Price Coverage")) {
    findings.push("dogfood readiness Markdown must include model price coverage when supplied.");
  }

  const missing = freshPriceDocument();
  missing.prices = missing.prices.slice(0, 1);
  fs.writeFileSync(priceFile, JSON.stringify(missing, null, 2), "utf8");
  const missingReport = dogfoodReadiness.collectDogfoodReadiness({
    modelPriceFile: priceFile,
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
  });
  if (missingReport.ready) {
    findings.push("missing model price coverage must make dogfood readiness not ready.");
  }
  if (!missingReport.checks.modelPriceCoverage?.missing.includes("openai:gpt-5.5")) {
    findings.push("missing model price coverage must name the missing catalog default lane.");
  }
}

function checkWorkspaceReport(findings) {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-readiness-contract-"));
  operatorWorkspace.createOperatorWorkspace({
    directory: workspaceDir,
    force: true,
    repoRoot: root,
  });
  const report = dogfoodReadiness.collectDogfoodReadiness({
    env: contractEnv(),
    includePreflight: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
    operatorWorkspaceDir: workspaceDir,
    root,
    strictPreflight: true,
  });
  const output = JSON.stringify(report);
  const markdown = dogfoodReadiness.formatDogfoodReadinessMarkdown(report);
  if (report.inputs.operatorWorkspace?.directory !== "[operator-workspace]") {
    findings.push("dogfood readiness input must summarize operator workspace as [operator-workspace].");
  }
  if (report.checks.operatorWorkspace?.directory !== "[operator-workspace]") {
    findings.push("dogfood readiness check must keep operator workspace directory redacted.");
  }
  if (output.includes(workspaceDir) || markdown.includes(workspaceDir)) {
    findings.push("dogfood readiness output must not include the private operator workspace path.");
  }
  if (report.inputs.preflight?.strict !== true || report.checks.preflight?.strict !== true) {
    findings.push("dogfood readiness must carry strict preflight input and check state.");
  }
}

function checkMarkdownRedaction(findings) {
  const markdown = dogfoodReadiness.formatDogfoodReadinessMarkdown({
    ready: false,
    generatedAt: "2026-06-13T00:00:00.000Z",
    inputs: {
      repositoryConfigFiles: ["target-sk-proj-abcdefghijklmnopqrstuvwxyz1234567890.yml"],
      budgetPolicyFile: "budget.json",
      modelCatalogFile: "models.json",
      preflight: {
        profile: "server github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
        strict: true,
      },
      operatorWorkspace: {
        directory: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
        requireReady: true,
      },
    },
    checks: {
      repositoryConfigs: {
        errors: [
          {
            file: "target.yml",
            message:
              "Bearer abcdefghijklmnopqrstuvwxyz1234567890 arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
          },
        ],
        configs: [],
      },
      budgetPolicies: {
        status: "error",
        errors: ["account 123456789012"],
      },
      modelCatalog: {
        status: "error",
        errors: ["sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"],
      },
      modelPriceCoverage: {
        status: "error",
        ready: false,
        file: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
        covered: 0,
        required: [],
        missing: [],
        incompleteRates: [],
        zeroRates: [],
        staleSources: [],
        placeholderSources: [],
        errors: ["arn:aws:rds:us-east-1:123456789012:cluster:reviewbot"],
      },
      preflight: {
        ok: false,
        checks: 0,
        errors: [
          {
            name: "provider",
            message: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
          },
        ],
        warnings: [
          {
            name: "aws",
            message: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
          },
        ],
      },
      operatorWorkspace: {
        status: "error",
        ready: false,
        files: [],
        summaries: {},
        errors: ["ghp_abcdefghijklmnopqrstuvwxyz1234567890"],
      },
    },
  });
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "arn:aws:rds:us-east-1",
    "123456789012",
    "ghp_abcdefghijklmnopqrstuvwxyz",
  ]) {
    if (markdown.includes(unsafe)) {
      findings.push(`dogfood readiness markdown must redact '${unsafe}'.`);
    }
  }
  for (const expected of [
    "sk-[redacted]",
    "github_pat_[redacted]",
    "Bearer [redacted]",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "[redacted-github-token]",
    "Model Price Coverage",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`dogfood readiness markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/dogfood-readiness.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "directory: \"[operator-workspace]\"",
    "return \"[external-path-set]\"",
    "modelPriceCoverage",
    "modelPriceCatalogCoverage",
    "publicText(report.inputs.operatorWorkspace.directory)",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/dogfood-readiness.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "options.requireOperatorWorkspaceReady && !options.operatorWorkspaceDir",
    "--model-price-file",
    "--allow-stale-model-price-source",
    "Use npm --silent run when copying output from commands that include private paths.",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }

  const releaseCheckPath = "scripts/release-check.cjs";
  const releaseCheckText = sourceTexts[releaseCheckPath] || readText(releaseCheckPath);
  for (const snippet of [
    'runNode("bin/dogfood-readiness.cjs", ["--json", "--quiet", "--require-ready"])',
  ]) {
    if (!releaseCheckText.includes(snippet)) {
      findings.push(`${releaseCheckPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:dogfood-readiness"],
    "docs/dogfood-readiness.md": [
      "npm run check:dogfood-readiness",
      "dogfood readiness contract check",
      "[operator-workspace]",
      "[external-path-set]",
      "--model-price-file",
      "model price coverage",
    ],
    "docs/release-readiness.md": ["dogfood readiness checker"],
    "docs/release-operations-map.md": ["npm run check:dogfood-readiness"],
    "docs/release.md": [
      "npm run check:dogfood-readiness",
      "dogfood readiness report contract",
    ],
    "docs/dogfood.md": ["dogfood readiness checker"],
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

function freshPriceDocument() {
  return {
    version: 1,
    currency: "USD",
    prices: [
      {
        provider: "anthropic",
        model: "claude-opus-4-8",
        inputUsdPerMillion: 1,
        cachedInputUsdPerMillion: 0.5,
        outputUsdPerMillion: 5,
        reasoningUsdPerMillion: null,
        effectiveFrom: "2026-06-12T00:00:00.000Z",
        sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing",
        sourceCheckedAt: "2026-06-12T12:00:00.000Z",
      },
      {
        provider: "openai",
        model: "gpt-5.5",
        inputUsdPerMillion: 1,
        cachedInputUsdPerMillion: null,
        outputUsdPerMillion: 5,
        reasoningUsdPerMillion: 5,
        effectiveFrom: "2026-06-12T00:00:00.000Z",
        sourceUrl: "https://platform.openai.com/docs/pricing",
        sourceCheckedAt: "2026-06-12T12:00:00.000Z",
      },
    ],
  };
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
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkDogfoodReadinessContract,
  readinessDocs,
};
