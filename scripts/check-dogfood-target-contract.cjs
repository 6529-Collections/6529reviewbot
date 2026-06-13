#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const dogfoodTarget = require("../src/dogfood-target.cjs");
const dogfoodTargetCli = require("../bin/dogfood-target.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/dogfood-target.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/dogfood.md",
];

function main() {
  const result = checkDogfoodTargetContract();
  console.log(
    `dogfood target contract ok (${result.cliCases} CLI cases, ${result.packetCases} packet cases, ${result.docs} docs checked)`
  );
}

function checkDogfoodTargetContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkPacketModes(findings);
  checkExternalConfigRedaction(findings);
  checkMarkdownRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`dogfood target contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 3,
    packetCases: 4,
    docs: targetDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = dogfoodTargetCli.parseArgs([
    "--",
    "--repository-config",
    "target.yml",
    "--repository",
    "6529-Collections/example",
    "--mode",
    "auto",
    "--json",
    "--quiet",
    "--require-ready",
  ]);
  if (
    !objectsEqual(parsed, {
      json: true,
      mode: "auto",
      quiet: true,
      repositoryConfigFile: "target.yml",
      requireReady: true,
      targetRepository: "6529-Collections/example",
    })
  ) {
    findings.push(`dogfood target CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => dogfoodTargetCli.parseArgs(["--repository-config"]),
    "--repository-config requires a value.",
    findings
  );
  expectError(
    () => dogfoodTargetCli.parseArgs(["--unknown"]),
    "Unknown argument: --unknown",
    findings
  );
}

function checkPacketModes(findings) {
  const commandOnly = dogfoodTarget.collectDogfoodTargetPacket({
    root,
    mode: "command-only",
  });
  if (!commandOnly.ready || commandOnly.mode !== "command-only") {
    findings.push("command-only dogfood target packet must be ready in the public template.");
  }
  const limited = dogfoodTarget.collectDogfoodTargetPacket({
    root,
    mode: "limited-initial",
  });
  if (!limited.ready || limited.mode !== "limited-initial") {
    findings.push("limited-initial dogfood target packet must be ready in the public template.");
  }
  const mismatch = dogfoodTarget.collectDogfoodTargetPacket({
    root,
    mode: "command-only",
    repositoryConfigFile: "templates/dogfood-repository-config.yml",
  });
  if (mismatch.ready || mismatch.summary.errors === 0) {
    findings.push("target packet must fail when requested mode does not match config posture.");
  }
  expectError(
    () =>
      dogfoodTarget.collectDogfoodTargetPacket({
        root,
        mode: "browser",
      }),
    "mode must be one of auto, command-only, limited-initial.",
    findings
  );
}

function checkExternalConfigRedaction(findings) {
  const externalDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-target-contract-"));
  const externalFile = path.join(externalDir, "target-ghp_abcdefghijklmnopqrstuvwxyz1234567890.yml");
  fs.writeFileSync(
    externalFile,
    fs.readFileSync(path.join(root, "templates/dogfood-command-only-config.yml"), "utf8"),
    "utf8"
  );
  const packet = dogfoodTarget.collectDogfoodTargetPacket({
    root,
    mode: "command-only",
    repositoryConfigFile: externalFile,
    targetRepository: "6529-Collections/example",
  });
  const markdown = dogfoodTarget.formatDogfoodTargetMarkdown(packet);
  if (!packet.configFile.startsWith("[external-config]/")) {
    findings.push(`external target config must use [external-config], got ${packet.configFile}.`);
  }
  if (JSON.stringify(packet).includes(externalDir) || markdown.includes(externalDir)) {
    findings.push("target packet output must not include external local config directories.");
  }
  if (JSON.stringify(packet).includes("ghp_abcdefghijklmnopqrstuvwxyz")) {
    findings.push("target packet config basename must redact token-shaped strings.");
  }
}

function checkMarkdownRedaction(findings) {
  const markdown = dogfoodTarget.formatDogfoodTargetMarkdown({
    ready: false,
    mode: "command-only",
    targetRepository: "6529-Collections/example\nInjected header",
    configFile: "[external-config]/target-sk-proj-abcdefghijklmnopqrstuvwxyz1234567890.yml",
    checks: [
      {
        title: "Lane github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
        status: "error",
        detail:
          "Bearer abcdefghijklmnopqrstuvwxyz1234567890 | account 123456789012 | arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
      },
    ],
    prChecklist: [
      "Do not copy ghp_abcdefghijklmnopqrstuvwxyz1234567890 into target repo.",
      "Keep checklist items\nsingle line.",
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
      findings.push(`dogfood target markdown must redact '${unsafe}'.`);
    }
  }
  for (const expected of [
    "sk-[redacted]",
    "github_pat_[redacted]",
    "Bearer [redacted]",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "[redacted-github-token]",
    "\\|",
    "6529-Collections/example Injected header",
    "Keep checklist items single line.",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`dogfood target markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/dogfood-target.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "DOGFOOD_TARGET_MODES",
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "[external-config]",
    "return publicText(value).replace",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/dogfood-target.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "--require-ready",
    "Use npm --silent run when copying output from commands that include private paths.",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:dogfood-target"],
    "docs/dogfood-target.md": [
      "npm run check:dogfood-target",
      "dogfood target contract check",
      "[external-config]",
    ],
    "docs/release-readiness.md": ["dogfood target checker"],
    "docs/release-operations-map.md": ["npm run check:dogfood-target"],
    "docs/release.md": [
      "npm run check:dogfood-target",
      "dogfood target packet contract",
    ],
    "docs/dogfood.md": ["dogfood target checker"],
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
  checkDogfoodTargetContract,
  targetDocs,
};
