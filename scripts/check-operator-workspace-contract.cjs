#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const operatorWorkspace = require("../src/operator-workspace.cjs");
const operatorWorkspaceCli = require("../bin/operator-workspace.cjs");

const root = path.resolve(__dirname, "..");

const targetDocs = [
  "README.md",
  "docs/operator-workspace.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/operations.md",
];

function main() {
  const result = checkOperatorWorkspaceContract();
  console.log(
    `operator workspace contract ok (${result.cliCases} CLI cases, ${result.workspaceCases} workspace cases, ${result.docs} docs checked)`
  );
}

function checkOperatorWorkspaceContract(options = {}) {
  const findings = [];
  checkCliContract(findings);
  checkWorkspaceLifecycle(findings);
  checkPublicRedaction(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`operator workspace contract check found ${findings.length} issue(s).`);
  }

  return {
    cliCases: 4,
    workspaceCases: 4,
    docs: targetDocs.length,
  };
}

function checkCliContract(findings) {
  const parsed = operatorWorkspaceCli.parseArgs([
    "--",
    "--dir",
    "private-workspace",
    "--check",
    "--require-ready",
    "--json",
    "--quiet",
    "--show-paths",
    "--force",
    "--allow-repo-dir",
    "--release",
    "v0.1.0",
    "--date",
    "2026-06-13",
    "--operator",
    "ops",
    "--commit",
    "abc123",
    "--environment",
    "dogfood",
    "--private-evidence-location",
    "private runbook",
    "--public-summary-location",
    "release notes",
  ]);
  if (
    !objectsEqual(parsed, {
      allowRepoDir: true,
      check: true,
      commit: "abc123",
      date: "2026-06-13",
      directory: "private-workspace",
      environment: "dogfood",
      force: true,
      json: true,
      operator: "ops",
      privateEvidenceLocation: "private runbook",
      publicSummaryLocation: "release notes",
      quiet: true,
      release: "v0.1.0",
      requireReady: true,
      showPaths: true,
    })
  ) {
    findings.push(`operator workspace CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }
  expectError(
    () => operatorWorkspaceCli.parseArgs(["--dir"]),
    "--dir requires a value.",
    findings
  );
  expectError(
    () => operatorWorkspaceCli.parseArgs(["--unknown"]),
    "Unknown argument '--unknown'.",
    findings
  );
  expectError(
    () => operatorWorkspaceCli.main(["--dir", "private-workspace", "--require-ready"], {
      repoRoot: root,
    }),
    "--require-ready requires --check.",
    findings
  );
}

function checkWorkspaceLifecycle(findings) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "6529-operator-contract-"));
  const workspace = operatorWorkspace.createOperatorWorkspace({
    directory: tempDir,
    repoRoot: root,
    release: "v0.1.0",
    quiet: true,
  });
  if (workspace.files.length !== Object.keys(operatorWorkspace.DEFAULT_OPERATOR_WORKSPACE_FILES).length) {
    findings.push(`operator workspace must create ${Object.keys(operatorWorkspace.DEFAULT_OPERATOR_WORKSPACE_FILES).length} files, got ${workspace.files.length}.`);
  }
  for (const fileName of Object.values(operatorWorkspace.DEFAULT_OPERATOR_WORKSPACE_FILES)) {
    if (!fs.existsSync(path.join(tempDir, fileName))) {
      findings.push(`operator workspace must create ${fileName}.`);
    }
  }

  const summary = operatorWorkspace.publicOperatorWorkspaceSummary(workspace);
  if (summary.directory !== "[operator-workspace]") {
    findings.push(`operator workspace public summary must redact directory, got ${summary.directory}.`);
  }
  if (JSON.stringify(summary).includes(tempDir)) {
    findings.push("operator workspace public summary must not include the private workspace path.");
  }
  if (summary.files.some((file) => path.isAbsolute(file.file))) {
    findings.push("operator workspace public summary must use basenames by default.");
  }

  const checked = operatorWorkspace.checkOperatorWorkspace({
    directory: tempDir,
    repoRoot: root,
  });
  if (checked.files.length !== workspace.files.length) {
    findings.push("operator workspace check mode must return the standard file list.");
  }
  if (checked.ready) {
    findings.push("fresh operator workspace should not be ready before operator evidence is filled.");
  }

  expectError(
    () =>
      operatorWorkspace.checkOperatorWorkspace({
        directory: tempDir,
        requireReady: true,
        repoRoot: root,
      }),
    /operator workspace is not ready|release gates are not ready|dogfood status is not ready|security review status is not ready|production cutover status is not ready|operator evidence is not ready/,
    findings
  );

  const repoDir = path.join(root, "tmp", "operator-workspace-contract");
  expectError(
    () =>
      operatorWorkspace.createOperatorWorkspace({
        directory: repoDir,
        repoRoot: root,
      }),
    "operator workspace directory must be outside the public repository unless --allow-repo-dir is set.",
    findings
  );

  const readme = fs.readFileSync(path.join(tempDir, "README.md"), "utf8");
  for (const snippet of [
    "npm run production:deployment-plan",
    "npm run dashboard:deployment-plan",
    "npm run alerts:delivery-plan",
    "npm run model-prices",
    "--require-catalog-coverage",
    "--frontend-origin <6529-io-origin>",
    "--auth-check-url <6529-auth-check-url>",
    "--notify-mode <webhook|sns|ses>",
    "--alert-channel <operator-alert-channel>",
    "--operator-workspace .",
    "--release v0.1.0",
    "--require-ready",
  ]) {
    if (!readme.includes(snippet)) {
      findings.push(`operator workspace README must include '${snippet}'.`);
    }
  }
}

function checkPublicRedaction(findings) {
  const privateDir = path.join(
    os.tmpdir(),
    "6529-operator-contract-sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"
  );
  const markdown = operatorWorkspace.renderOperatorWorkspaceSummaryMarkdown({
    release: "v0.1.0\nsk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
    ready: false,
    directory: privateDir,
    files: [
      {
        id: "operator-evidence",
        path: path.join(privateDir, "operator-ghp_abcdefghijklmnopqrstuvwxyz1234567890.json"),
        description:
          "Bearer abcdefghijklmnopqrstuvwxyz1234567890 | account 123456789012 | arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
      },
    ],
    summaries: {},
  });
  for (const unsafe of [
    privateDir,
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "123456789012",
    "arn:aws:rds:us-east-1",
  ]) {
    if (markdown.includes(unsafe)) {
      findings.push(`operator workspace Markdown must redact '${unsafe}'.`);
    }
  }
  for (const expected of [
    "[operator-workspace]",
    "sk-[redacted]",
    "[redacted-github-token]",
    "Bearer [redacted]",
    "[redacted-aws-account-id]",
    "arn:aws:[redacted]",
    "v0.1.0 sk-[redacted]",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`operator workspace Markdown must include '${expected}'.`);
    }
  }
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/operator-workspace.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "DEFAULT_OPERATOR_WORKSPACE_FILES",
    "PUBLIC_REDACTION_PATTERNS",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "[operator-workspace]",
    "assertWorkspaceDirectory",
    "privateWorkspaceReadme",
    "publicLine",
    "production:deployment-plan",
    "dashboard:deployment-plan",
    "alerts:delivery-plan",
    "model-prices",
    "--require-catalog-coverage",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/operator-workspace.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "--require-ready requires --check.",
    "By default this command refuses to write inside the public repository.",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:operator-workspace"],
    "docs/operator-workspace.md": [
      "npm run check:operator-workspace",
      "npm run production:deployment-plan",
      "npm run dashboard:deployment-plan",
      "npm run alerts:delivery-plan",
      "npm run model-prices -- -- --file <reviewed-model-price-file.json> --require-catalog-coverage",
      "operator workspace contract check",
      "[operator-workspace]",
    ],
    "docs/release-readiness.md": ["operator workspace contract"],
    "docs/release-operations-map.md": ["npm run check:operator-workspace"],
    "docs/release.md": [
      "npm run check:operator-workspace",
      "operator workspace contract",
    ],
    "docs/operations.md": ["operator workspace checker"],
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
  checkOperatorWorkspaceContract,
  targetDocs,
};
