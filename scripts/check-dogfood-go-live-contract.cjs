#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const dogfoodGoLive = require("../src/dogfood-go-live.cjs");
const dogfoodGoLiveCli = require("../bin/dogfood-go-live.cjs");
const operatorWorkspace = require("../src/operator-workspace.cjs");

const root = path.resolve(__dirname, "..");

const goLiveDocs = [
  "README.md",
  "docs/dogfood-go-live.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/dogfood.md",
];

function main() {
  const result = checkDogfoodGoLiveContract();
  console.log(
    `dogfood go-live contract ok (${result.cliCases} CLI cases, ${result.packetCases} packet cases, ${result.docs} docs checked)`
  );
}

function checkDogfoodGoLiveContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkReadyContract(findings);
  checkWorkspacePacket(findings);
  checkModelPricePromotionGate(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`dogfood go-live contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 5,
    packetCases: 5,
    docs: goLiveDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = dogfoodGoLiveCli.parseArgs([
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
    "--out",
    "packet.md",
  ]);
  if (
    !objectsEqual(parsed, {
      budgetPolicyFile: "",
      cutoverStatusFile: "",
      dogfoodStatusFile: "",
      gateStatusFile: "",
      help: false,
      includeGitStatus: false,
      json: true,
      mode: "command-only",
      modelCatalogFile: "",
      modelPriceFile: "prices.json",
      allowStaleModelPriceSource: true,
      allowZeroModelPrice: true,
      maxModelPriceSourceAgeDays: 45,
      operatorEvidenceFile: "",
      operatorWorkspaceDir: "workspace",
      out: "packet.md",
      preflightProfile: "server",
      quiet: true,
      repositoryConfigFile: "target.yml",
      requireOperatorWorkspaceReady: true,
      requireReady: true,
      securityReviewStatusFile: "",
      skipPreflight: false,
      skipSelfDogfoodReplay: true,
      strictPreflight: true,
      targetRepository: "6529-Collections/example",
    })
  ) {
    findings.push(`dogfood go-live CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }

  expectError(
    () => dogfoodGoLiveCli.parseArgs(["--require-ready"]),
    "--require-ready requires --strict-preflight and cannot be used with --skip-preflight.",
    findings
  );
  expectError(
    () => dogfoodGoLiveCli.parseArgs(["--strict-preflight", "--skip-preflight", "--require-ready"]),
    "--require-ready requires --strict-preflight and cannot be used with --skip-preflight.",
    findings
  );
  expectError(
    () => dogfoodGoLiveCli.parseArgs(["--require-operator-workspace-ready"]),
    "--require-operator-workspace-ready requires --operator-workspace.",
    findings
  );
  expectError(
    () => dogfoodGoLiveCli.parseArgs(["--max-model-price-source-age-days", "-1"]),
    "--max-model-price-source-age-days must be a non-negative number.",
    findings
  );
}

function checkReadyContract(findings) {
  expectError(
    () =>
      dogfoodGoLive.assertDogfoodGoLiveReady({
        ready: true,
        inputs: {
          strictPreflight: false,
          dogfoodPromotion: {
            preflight: { strict: false },
          },
        },
        gates: [],
      }),
    "dogfood go-live packet requires strict preflight before it can be marked ready.",
    findings
  );
  expectError(
    () =>
      dogfoodGoLive.assertDogfoodGoLiveReady({
        ready: false,
        inputs: {
          strictPreflight: true,
          dogfoodPromotion: {
            preflight: { strict: true },
          },
        },
        gates: [
          { id: "release-candidate", status: "error" },
          { id: "production-cutover", status: "warning" },
        ],
      }),
    "dogfood go-live packet is not ready: release-candidate, production-cutover.",
    findings
  );
  const readyPacket = {
    ready: true,
    inputs: {
      strictPreflight: true,
      dogfoodPromotion: {
        preflight: { strict: true },
      },
    },
    gates: [],
  };
  if (dogfoodGoLive.assertDogfoodGoLiveReady(readyPacket) !== readyPacket) {
    findings.push("assertDogfoodGoLiveReady must return the packet when ready.");
  }
}

function checkWorkspacePacket(findings) {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-go-live-contract-"));
  operatorWorkspace.createOperatorWorkspace({
    directory: workspaceDir,
    force: true,
    repoRoot: root,
  });
  const priceFile = writePriceFile(freshPriceDocument());
  const packet = dogfoodGoLive.collectDogfoodGoLivePacket({
    env: contractEnv(),
    modelPriceFile: priceFile,
    now: new Date("2026-06-13T00:00:00.000Z"),
    operatorWorkspaceDir: workspaceDir,
    root,
    selfDogfoodReplayRunner: fakeReplay,
    strictPreflight: true,
  });
  const markdown = dogfoodGoLive.formatDogfoodGoLiveMarkdown(packet);
  if (packet.inputs.operatorWorkspace !== "[operator-workspace]") {
    findings.push(`go-live packet must summarize operator workspace as [operator-workspace], got ${packet.inputs.operatorWorkspace}.`);
  }
  if (JSON.stringify(packet).includes(workspaceDir) || markdown.includes(workspaceDir)) {
    findings.push("go-live packet output must not include the private operator workspace path.");
  }
  if (packet.inputs.dogfoodPromotion.operatorWorkspace?.directory !== "[operator-workspace]") {
    findings.push("promotion input nested inside go-live packet must keep the workspace path redacted.");
  }
  if (packet.inputs.dogfoodPromotion.modelPriceFile?.file !== "[external-path-set]") {
    findings.push("promotion input nested inside go-live packet must keep the model price file path redacted.");
  }
  if (JSON.stringify(packet).includes(path.dirname(priceFile)) || markdown.includes(path.dirname(priceFile))) {
    findings.push("go-live packet output must not include the private model price file path.");
  }
  if (packet.checks.dogfoodPromotion.checks.readiness.checks.modelPriceCoverage?.ready !== true) {
    findings.push("go-live packet must forward ready model price coverage through promotion.");
  }
  if (
    !packet.nextActions.some(
      (action) =>
        action.includes("provider-console-readiness-reviewed") &&
        action.includes("iam-secret-custody-reviewed") &&
        action.includes("provider-console-readiness") &&
        action.includes("iam-and-secrets")
    )
  ) {
    findings.push("go-live operator-workspace next action must name baseline provider/IAM dogfood evidence.");
  }
  const gateIds = packet.gates.map((gate) => gate.id);
  for (const expected of [
    "operator-workspace",
    "release-candidate",
    "dogfood-promotion",
    "production-cutover",
  ]) {
    if (!gateIds.includes(expected)) {
      findings.push(`go-live packet gates must include ${expected}.`);
    }
  }
}

function checkModelPricePromotionGate(findings) {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-go-live-prices-"));
  operatorWorkspace.createOperatorWorkspace({
    directory: workspaceDir,
    force: true,
    repoRoot: root,
  });
  const missing = freshPriceDocument();
  missing.prices = missing.prices.slice(0, 1);
  const packet = dogfoodGoLive.collectDogfoodGoLivePacket({
    env: contractEnv(),
    modelPriceFile: writePriceFile(missing),
    now: new Date("2026-06-13T00:00:00.000Z"),
    operatorWorkspaceDir: workspaceDir,
    root,
    selfDogfoodReplayRunner: fakeReplay,
    strictPreflight: true,
  });
  const promotionGate = packet.gates.find((gate) => gate.id === "dogfood-promotion");
  if (promotionGate?.status !== "error") {
    findings.push("missing model price coverage must fail the go-live dogfood-promotion gate.");
  }
  const coverage =
    packet.checks.dogfoodPromotion.checks.readiness.checks.modelPriceCoverage;
  if (!coverage?.missing.includes("openai:gpt-5.5")) {
    findings.push("go-live packet must preserve model price coverage missing-lane details.");
  }
  if (!packet.nextActions.some((action) => action.includes("reviewed model price file"))) {
    findings.push("go-live next actions must mention the reviewed model price file when promotion fails.");
  }
}

function checkMarkdownRedaction(findings) {
  const markdown = dogfoodGoLive.formatDogfoodGoLiveMarkdown({
    ready: false,
    generatedAt: "2026-06-13T00:00:00.000Z",
    inputs: {
      operatorWorkspace: "[operator-workspace]",
      preflightProfile: "server sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
      strictPreflight: true,
    },
    gates: [
      {
        id: "release-candidate",
        title: "Release github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
        status: "error",
        detail:
          "Bearer abcdefghijklmnopqrstuvwxyz1234567890 | arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
      },
    ],
    summaries: {
      releaseCandidate: {
        releaseGates: summary(),
        operatorEvidence: summary(),
        preflight: {
          ok: false,
          errors: [],
          warnings: [],
        },
      },
      dogfoodPromotion: {
        ok: 0,
        warnings: 0,
        errors: 1,
      },
      operatorWorkspace: {
        releaseGates: summary(),
      },
    },
    checks: {
      dogfoodPromotion: {
        ready: false,
      },
    },
    nextActions: [
      "Rotate ghp_abcdefghijklmnopqrstuvwxyz1234567890 for account 123456789012.",
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
      findings.push(`dogfood go-live markdown must redact '${unsafe}'.`);
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
      findings.push(`dogfood go-live markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/dogfood-go-live.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "assertDogfoodGoLiveReady",
    "packet.inputs.strictPreflight",
    "packet.inputs.dogfoodPromotion.preflight",
    "modelPriceFile",
    "modelPriceCoverageStatus",
    "This packet is public-safe.",
    "operatorWorkspace: operatorWorkspaceDir ? \"[operator-workspace]\" : \"\"",
    "privatePathRoots",
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

  const binPath = "bin/dogfood-go-live.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "result.requireReady && (!result.strictPreflight || result.skipPreflight)",
    "--require-ready requires --strict-preflight",
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
    "README.md": ["npm run check:dogfood-go-live"],
    "docs/dogfood-go-live.md": [
      "npm run check:dogfood-go-live",
      "dogfood go-live contract check",
      "`--require-ready` requires `--strict-preflight`",
      "--model-price-file",
      "model price coverage",
      "provider-console-readiness-reviewed",
      "iam-secret-custody-reviewed",
      "provider-console-readiness",
      "iam-and-secrets",
    ],
    "docs/release-readiness.md": ["dogfood go-live checker"],
    "docs/release-operations-map.md": ["npm run check:dogfood-go-live"],
    "docs/release.md": [
      "npm run check:dogfood-go-live",
      "dogfood go-live packet contract",
    ],
    "docs/dogfood.md": ["dogfood go-live checker"],
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-go-live-prices-"));
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

function summary(overrides = {}) {
  return {
    ready: false,
    complete: 0,
    total: 1,
    deferred: 0,
    pending: 1,
    blocked: 0,
    missingStatusIds: [],
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
  checkDogfoodGoLiveContract,
  goLiveDocs,
};
