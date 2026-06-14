#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const dogfoodPromotion = require("../src/dogfood-promotion.cjs");
const dogfoodPromotionCli = require("../bin/dogfood-promotion.cjs");
const operatorWorkspace = require("../src/operator-workspace.cjs");

const root = path.resolve(__dirname, "..");

const promotionDocs = [
  "README.md",
  "config/release-operations-map.json",
  "docs/dogfood-promotion.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/dogfood.md",
];

function main() {
  const result = checkDogfoodPromotionContract();
  console.log(
    `dogfood promotion contract ok (${result.cliCases} CLI cases, ${result.packetCases} packet cases, ${result.docs} docs checked)`
  );
}

function checkDogfoodPromotionContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkReadyContract(findings);
  checkWorkspacePacket(findings);
  checkModelPriceGate(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`dogfood promotion contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 5,
    packetCases: 5,
    docs: promotionDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = dogfoodPromotionCli.parseArgs([
    "--",
    "--operator-workspace",
    "workspace",
    "--repository",
    "6529-Collections/example",
    "--repository-config",
    "target.yml",
    "--mode",
    "command-only",
    "--model-price-file",
    "prices.json",
    "--allow-stale-model-price-source",
    "--allow-zero-model-price",
    "--max-model-price-source-age-days",
    "45",
    "--strict-preflight",
    "--require-ready",
    "--require-operator-workspace-ready",
    "--skip-self-dogfood-replay",
    "--json",
    "--quiet",
  ]);
  if (
    !objectsEqual(parsed, {
      budgetPolicyFile: undefined,
      includePreflight: true,
      json: true,
      mode: "command-only",
      modelCatalogFile: undefined,
      modelPriceFile: "prices.json",
      allowStaleModelPriceSource: true,
      allowZeroModelPrice: true,
      maxModelPriceSourceAgeDays: 45,
      operatorWorkspaceDir: "workspace",
      preflightProfile: "server",
      quiet: true,
      repositoryConfigFile: "target.yml",
      requireOperatorWorkspaceReady: true,
      requireReady: true,
      skipSelfDogfoodReplay: true,
      strictPreflight: true,
      targetRepository: "6529-Collections/example",
    })
  ) {
    findings.push(`dogfood promotion CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }

  expectError(
    () => dogfoodPromotionCli.parseArgs(["--require-ready"]),
    "--require-ready requires --strict-preflight.",
    findings
  );
  expectError(
    () => dogfoodPromotionCli.parseArgs(["--preflight", "--require-ready"]),
    "--require-ready requires --strict-preflight.",
    findings
  );
  expectError(
    () =>
      dogfoodPromotionCli.parseArgs([
        "--strict-preflight",
        "--model-price-file",
        "prices.json",
        "--require-ready",
      ]),
    "--require-ready requires --operator-workspace.",
    findings
  );
  expectError(
    () =>
      dogfoodPromotionCli.parseArgs([
        "--strict-preflight",
        "--operator-workspace",
        "workspace",
        "--require-ready",
      ]),
    "--require-ready requires --model-price-file for reviewed model price coverage.",
    findings
  );
  expectError(
    () => dogfoodPromotionCli.parseArgs(["--require-operator-workspace-ready"]),
    "--require-operator-workspace-ready requires --operator-workspace.",
    findings
  );
  expectError(
    () => dogfoodPromotionCli.parseArgs(["--max-model-price-source-age-days", "-1"]),
    "--max-model-price-source-age-days must be a non-negative number.",
    findings
  );
}

function checkReadyContract(findings) {
  expectError(
    () =>
      dogfoodPromotion.assertDogfoodPromotionReady({
        ready: false,
        inputs: {
          modelPriceFile: { file: "[external-path-set]" },
        },
        gates: [
          { id: "operator-workspace", status: "warning" },
          { id: "preflight", status: "error" },
        ],
      }),
    "dogfood promotion packet is not ready: operator-workspace, preflight.",
    findings
  );
  expectError(
    () =>
      dogfoodPromotion.assertDogfoodPromotionReady({
        ready: true,
        inputs: {
          modelPriceFile: null,
        },
        gates: [],
      }),
    "dogfood promotion packet requires reviewed model price coverage before it can be marked ready.",
    findings
  );
  const readyPacket = {
    ready: true,
    inputs: {
      modelPriceFile: { file: "[external-path-set]" },
    },
    gates: [],
  };
  if (dogfoodPromotion.assertDogfoodPromotionReady(readyPacket) !== readyPacket) {
    findings.push("assertDogfoodPromotionReady must return the packet when ready.");
  }
}

function checkWorkspacePacket(findings) {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-promotion-contract-"));
  operatorWorkspace.createOperatorWorkspace({
    directory: workspaceDir,
    force: true,
    repoRoot: root,
  });
  const priceFile = writePriceFile(freshPriceDocument());
  const packet = dogfoodPromotion.collectDogfoodPromotionPacket({
    env: contractEnv(),
    includePreflight: true,
    modelPriceFile: priceFile,
    now: new Date("2026-06-13T00:00:00.000Z"),
    operatorWorkspaceDir: workspaceDir,
    root,
    selfDogfoodReplayRunner: fakeReplay,
    strictPreflight: true,
  });
  const markdown = dogfoodPromotion.formatDogfoodPromotionMarkdown(packet);
  if (packet.inputs.operatorWorkspace?.directory !== "[operator-workspace]") {
    findings.push("promotion packet must summarize operator workspace as [operator-workspace].");
  }
  if (JSON.stringify(packet).includes(workspaceDir) || markdown.includes(workspaceDir)) {
    findings.push("promotion packet output must not include the private operator workspace path.");
  }
  if (packet.inputs.modelPriceFile?.file !== "[external-path-set]") {
    findings.push("promotion packet must summarize external model price files as [external-path-set].");
  }
  if (JSON.stringify(packet).includes(path.dirname(priceFile)) || markdown.includes(path.dirname(priceFile))) {
    findings.push("promotion packet output must not include the private model price file path.");
  }
  const gateIds = packet.gates.map((gate) => gate.id);
  for (const expected of [
    "target-config",
    "central-inputs",
    "self-dogfood-replay",
    "operator-workspace",
    "preflight",
  ]) {
    if (!gateIds.includes(expected)) {
      findings.push(`promotion packet gates must include ${expected}.`);
    }
  }
  if (packet.inputs.preflight?.strict !== true) {
    findings.push("promotion packet must carry strict preflight input state.");
  }
  if (packet.checks.readiness.checks.modelPriceCoverage?.ready !== true) {
    findings.push("promotion packet must forward ready model price coverage into readiness.");
  }

  const missingWorkspacePacket = dogfoodPromotion.collectDogfoodPromotionPacket({
    env: contractEnv(),
    includePreflight: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
    selfDogfoodReplayRunner: fakeReplay,
    strictPreflight: true,
  });
  if (
    !missingWorkspacePacket.nextActions.some(
      (action) =>
        action.includes("provider-console-readiness-reviewed") &&
        action.includes("iam-secret-custody-reviewed") &&
        action.includes("provider-console-readiness") &&
        action.includes("iam-and-secrets")
    )
  ) {
    findings.push("promotion operator-workspace next action must name baseline provider/IAM dogfood evidence.");
  }
}

function checkModelPriceGate(findings) {
  const missing = freshPriceDocument();
  missing.prices = missing.prices.slice(0, 1);
  const packet = dogfoodPromotion.collectDogfoodPromotionPacket({
    modelPriceFile: writePriceFile(missing),
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
    selfDogfoodReplayRunner: fakeReplay,
  });
  const centralGate = packet.gates.find((gate) => gate.id === "central-inputs");
  if (centralGate?.status !== "error") {
    findings.push("missing model price coverage must fail the central-inputs promotion gate.");
  }
  if (!packet.checks.readiness.checks.modelPriceCoverage?.missing.includes("openai:gpt-5.5")) {
    findings.push("promotion packet must preserve model price coverage missing-lane details.");
  }
  if (!packet.nextActions.some((action) => action.includes("model price coverage"))) {
    findings.push("promotion next actions must mention model price coverage when central inputs fail.");
  }
}

function checkMarkdownRedaction(findings) {
  const markdown = dogfoodPromotion.formatDogfoodPromotionMarkdown({
    ready: false,
    generatedAt: "2026-06-13T00:00:00.000Z",
    targetRepository: "6529-Collections/example",
    mode: "command-only",
    inputs: {
      targetConfigFile: "target-sk-proj-abcdefghijklmnopqrstuvwxyz1234567890.yml",
      budgetPolicyFile: "policy.json",
      modelCatalogFile: "model.json",
      modelPriceFile: {
        file: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
        allowStaleSource: true,
        allowZeroPrice: false,
      },
      selfDogfoodReplay: "included",
      preflight: {
        profile: "server github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
        strict: true,
      },
      operatorWorkspace: {
        directory: "[operator-workspace]",
        requireReady: true,
      },
    },
    gates: [
      {
        id: "preflight",
        title: "Preflight ghp_abcdefghijklmnopqrstuvwxyz1234567890",
        status: "error",
        detail:
          "Bearer abcdefghijklmnopqrstuvwxyz1234567890 | arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
      },
    ],
    checks: {
      target: {
        ready: false,
        summary: {
          errors: 1,
          warnings: 0,
        },
      },
      readiness: {
        checks: {
          repositoryConfigs: { status: "ok" },
          budgetPolicies: { status: "ok" },
          modelCatalog: { status: "ok" },
          modelPriceCoverage: {
            status: "error",
            ready: false,
          },
        },
      },
      selfDogfoodReplay: {
        status: "ok",
      },
    },
    nextActions: [
      "Rotate sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 for account 123456789012.",
    ],
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
      findings.push(`dogfood promotion markdown must redact '${unsafe}'.`);
    }
  }
  for (const expected of [
    "This packet is public-safe.",
    "sk-[redacted]",
    "github_pat_[redacted]",
    "Bearer [redacted]",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "[redacted-github-token]",
    "\\|",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`dogfood promotion markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/dogfood-promotion.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "redactSensitiveText(String(value || \"\"))",
    "operatorWorkspaceDir",
    "modelPriceFile",
    "modelPriceCoverageReady",
    "Boolean(summary) && summary.status === \"ok\" && summary.ready",
    "directory: \"[operator-workspace]\"",
    "return publicText(value).replace",
    "provider-console-readiness-reviewed",
    "iam-secret-custody-reviewed",
    "provider-console-readiness",
    "iam-and-secrets",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/dogfood-promotion.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "options.requireReady && !options.strictPreflight",
    "--require-ready requires --strict-preflight.",
    "--require-ready requires --operator-workspace.",
    "--require-ready requires --model-price-file for reviewed model price coverage.",
    "--model-price-file",
    "--allow-stale-model-price-source",
    "Use npm --silent run when copying output from commands that include private paths.",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:dogfood-promotion"],
    "config/release-operations-map.json": [
      "\"script\": \"dogfood:promotion\"",
      "--operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready",
      "required ready-mode private workspace parsing, model price coverage, and preflight",
    ],
    "docs/dogfood-promotion.md": [
      "npm run check:dogfood-promotion",
      "dogfood promotion contract check",
      "`--require-ready` requires `--operator-workspace`",
      "--operator-workspace",
      "--model-price-file",
      "model price coverage",
      "requires reviewed model price coverage",
      "provider-console-readiness-reviewed",
      "iam-secret-custody-reviewed",
      "provider-console-readiness",
      "iam-and-secrets",
    ],
    "docs/release-readiness.md": ["dogfood promotion checker"],
    "docs/release-operations-map.md": ["npm run check:dogfood-promotion"],
    "docs/release.md": [
      "npm run check:dogfood-promotion",
      "dogfood promotion packet contract",
    ],
    "docs/dogfood.md": ["dogfood promotion checker"],
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

function writePriceFile(document) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-promotion-prices-"));
  const priceFile = path.join(tempDir, "model-prices.json");
  fs.writeFileSync(priceFile, JSON.stringify(document, null, 2), "utf8");
  return priceFile;
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

function fakeReplay() {
  return {
    status: 0,
    stdout: "self dogfood replay ok\n",
    stderr: "",
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
  checkDogfoodPromotionContract,
  promotionDocs,
};
