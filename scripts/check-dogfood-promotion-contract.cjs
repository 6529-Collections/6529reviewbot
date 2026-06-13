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
    cliCases: 4,
    packetCases: 4,
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
    () => dogfoodPromotionCli.parseArgs(["--require-operator-workspace-ready"]),
    "--require-operator-workspace-ready requires --operator-workspace.",
    findings
  );
}

function checkReadyContract(findings) {
  expectError(
    () =>
      dogfoodPromotion.assertDogfoodPromotionReady({
        ready: false,
        gates: [
          { id: "operator-workspace", status: "warning" },
          { id: "preflight", status: "error" },
        ],
      }),
    "dogfood promotion packet is not ready: operator-workspace, preflight.",
    findings
  );
  const readyPacket = {
    ready: true,
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
  const packet = dogfoodPromotion.collectDogfoodPromotionPacket({
    env: contractEnv(),
    includePreflight: true,
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
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "operatorWorkspaceDir",
    "directory: \"[operator-workspace]\"",
    "return publicText(value).replace",
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
    "docs/dogfood-promotion.md": [
      "npm run check:dogfood-promotion",
      "dogfood promotion contract check",
      "`--require-ready` requires `--strict-preflight`",
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
