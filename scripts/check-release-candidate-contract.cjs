#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const releaseCandidate = require("../src/release-candidate.cjs");
const releaseCandidateCli = require("../bin/release-candidate.cjs");

const root = path.resolve(__dirname, "..");

const releaseCandidateDocs = [
  "README.md",
  "docs/release-candidate.md",
  "docs/release-readiness.md",
  "docs/release-operations-map.md",
  "docs/release.md",
];

function main() {
  const result = checkReleaseCandidateContract();
  console.log(
    `release candidate contract ok (${result.redactionCases} redaction cases, ${result.pathCases} path cases, ${result.docs} docs checked)`
  );
}

function checkReleaseCandidateContract(options = {}) {
  const findings = [];
  checkPublicTextRedaction(findings);
  checkPublicPathBoundaries(findings);
  checkPreflightSummary(findings);
  checkMarkdownOutput(findings);
  checkCliContract(findings);
  checkSourceInvariants(options.sourceTexts || {}, findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`release candidate contract check found ${findings.length} issue(s).`);
  }

  return {
    redactionCases: 7,
    pathCases: 3,
    docs: releaseCandidateDocs.length,
  };
}

function checkPublicTextRedaction(findings) {
  const cases = [
    {
      input: "Bearer abcdefghijklmnopqrstuvwxyz1234567890",
      expected: "Bearer [redacted]",
      unsafe: "abcdefghijklmnopqrstuvwxyz1234567890",
    },
    {
      input: "github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
      expected: "github_pat_[redacted]",
      unsafe: "github_pat_abcdefghijklmnopqrstuvwxyz",
    },
    {
      input: "ghp_abcdefghijklmnopqrstuvwxyz1234567890",
      expected: "[redacted-github-token]",
      unsafe: "ghp_abcdefghijklmnopqrstuvwxyz",
    },
    {
      input: "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
      expected: "sk-[redacted]",
      unsafe: "sk-proj-abcdefghijklmnopqrstuvwxyz",
    },
    {
      input: "https://hooks.slack.com/services/T00000000/B00000000/abcdefghijklmnopqrstuvwxyz",
      expected: "[redacted-alert-webhook-url]",
      unsafe: "hooks.slack.com/services/T00000000",
    },
    {
      input: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
      expected: "arn:aws:[redacted]",
      unsafe: "arn:aws:rds:us-east-1",
    },
    {
      input: "account 123456789012",
      expected: "[redacted-aws-account-id]",
      unsafe: "123456789012",
    },
  ];
  for (const item of cases) {
    const output = releaseCandidate.publicText(item.input);
    if (!output.includes(item.expected)) {
      findings.push(`publicText must include '${item.expected}' for '${item.input}'.`);
    }
    if (output.includes(item.unsafe)) {
      findings.push(`publicText must redact unsafe substring '${item.unsafe}'.`);
    }
  }

  const long = `${"x".repeat(1100)}sk-proj-abcdefghijklmnopqrstuvwxyz1234567890`;
  const truncated = releaseCandidate.publicText(long);
  if (truncated.length !== 1000) {
    findings.push(`publicText must keep the release-candidate max length at 1000, got ${truncated.length}.`);
  }
}

function checkPublicPathBoundaries(findings) {
  const privateRoot = path.join(os.tmpdir(), "6529-reviewbot-private-release");
  const privateFile = path.join(privateRoot, "v0-release-status.json");
  const workspacePath = releaseCandidate.publicPath(privateFile, root, {
    privatePathRoots: [privateRoot],
  });
  if (workspacePath !== "[operator-workspace]/v0-release-status.json") {
    findings.push(`private workspace paths must redact to [operator-workspace], got ${workspacePath}.`);
  }

  const repoPath = releaseCandidate.publicPath("config/v0-release-gates.json", root);
  if (repoPath !== "config/v0-release-gates.json") {
    findings.push(`repo-relative paths must remain public repo paths, got ${repoPath}.`);
  }

  const externalPath = releaseCandidate.publicPath(
    path.join(os.tmpdir(), "outside-release-private.json"),
    root
  );
  if (externalPath !== "[external-path-set]") {
    findings.push(`external paths must redact to [external-path-set], got ${externalPath}.`);
  }
}

function checkPreflightSummary(findings) {
  const summary = releaseCandidate.preflightSummary(
    {
      ok: false,
      profile: "worker",
      errors: [
        {
          name: "provider github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
          message: "Bearer abcdefghijklmnopqrstuvwxyz1234567890 arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
        },
      ],
      warnings: [
        {
          name: "aws",
          message: "account 123456789012 sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
        },
      ],
    },
    true
  );
  const text = JSON.stringify(summary);
  for (const unsafe of [
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "abcdefghijklmnopqrstuvwxyz1234567890 arn:aws",
    "arn:aws:rds:us-east-1",
    "123456789012",
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
  ]) {
    if (text.includes(unsafe)) {
      findings.push(`preflight summary must redact '${unsafe}'.`);
    }
  }
  if (summary.profile !== "worker" || summary.strict !== true || summary.checks !== 0) {
    findings.push(`preflight summary shape changed: ${text}.`);
  }
}

function checkMarkdownOutput(findings) {
  const bundle = {
    release: "v0.1.0 sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
    ready: false,
    generatedAt: "2026-06-13T00:00:00.000Z",
    package: {
      name: "@6529/6529reviewbot",
      version: "0.1.0",
    },
    git: {
      branch: "codex/github_pat_abcdefghijklmnopqrstuvwxyz1234567890",
      commit: "abc123def456",
    },
    inputs: {
      releaseGatesFile: "config/v0-release-gates.json",
      releaseGateStatusFile: "[operator-workspace]/v0-release-status.json",
      operatorEvidenceFile: "[operator-workspace]/operator-evidence.json",
      dogfoodChecklistFile: "",
      dogfoodStatusFile: "",
      securityReviewChecklistFile: "",
      securityReviewStatusFile: "",
      productionCutoverChecklistFile: "",
      productionCutoverStatusFile: "",
      preflightProfile: "server",
      strictPreflight: true,
    },
    readiness: {
      releaseGates: summary({ missingStatusIds: ["gate-sk-proj-abcdefghijklmnopqrstuvwxyz1234567890"] }),
      operatorEvidence: summary(),
      preflight: {
        ok: false,
        errors: [
          {
            name: "provider",
            message: "Bearer abcdefghijklmnopqrstuvwxyz1234567890",
          },
        ],
        warnings: [
          {
            name: "aws",
            message: "arn:aws:rds:us-east-1:123456789012:cluster:reviewbot",
          },
        ],
      },
    },
    publicEvidence: {
      operatorEvidence: {
        sections: [
          {
            id: "deployment",
            status: "pending",
            title: "AWS account 123456789012 reviewed",
            notes: "token ghp_abcdefghijklmnopqrstuvwxyz1234567890",
            evidence: ["arn:aws:rds:us-east-1:123456789012:cluster:reviewbot"],
          },
          {
            id: "container-publish-plan",
            status: "complete",
            title: "Container Publish Plan",
            notes: "reviewed container publish plan evidence",
            evidence: ["operator-owned registry, source commit, digest, and vulnerability scan recorded"],
          },
          {
            id: "worker-dispatch-credentials",
            status: "complete",
            title: "Worker Dispatch Credentials",
            notes: "dispatch credential posture reviewed before non-noop worker traffic",
            evidence: ["dispatch-only GitHub App preferred; fallback risk accepted if used"],
          },
          {
            id: "6529-io-public-disclosure",
            status: "complete",
            title: "6529.io Public Dashboard Disclosure",
            notes: "reviewed public repo/org disclosure allowlists",
            evidence: ["public summaries limited to reviewed allowlists"],
          },
          {
            id: "6529-io-private-admin-auth",
            status: "complete",
            title: "6529.io Private Admin Auth",
            notes: "auth-check URL and wallet allowlist evidence reviewed",
            evidence: ["private admin route blocked without 6529.io auth"],
          },
        ],
      },
    },
    commands: [
      {
        label: "release candidate bundle",
        command: "npm run release:candidate -- -- --operator-workspace <private-workspace-dir>",
      },
    ],
  };
  const markdown = releaseCandidate.formatReleaseCandidateBundleMarkdown(bundle);
  for (const unsafe of [
    "sk-proj-abcdefghijklmnopqrstuvwxyz",
    "github_pat_abcdefghijklmnopqrstuvwxyz",
    "ghp_abcdefghijklmnopqrstuvwxyz",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "arn:aws:rds:us-east-1",
    "123456789012",
  ]) {
    if (markdown.includes(unsafe)) {
      findings.push(`release candidate markdown must redact '${unsafe}'.`);
    }
  }
  for (const expected of [
    "This bundle is public-safe.",
    "github_pat_[redacted]",
    "sk-[redacted]",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "[redacted-github-token]",
    "container-publish-plan",
    "reviewed container publish plan evidence",
    "worker-dispatch-credentials",
    "dispatch credential posture reviewed before non-noop worker traffic",
    "6529-io-public-disclosure",
    "reviewed public repo/org disclosure allowlists",
    "6529-io-private-admin-auth",
    "auth-check URL and wallet allowlist evidence reviewed",
  ]) {
    if (!markdown.includes(expected)) {
      findings.push(`release candidate markdown must include '${expected}'.`);
    }
  }
}

function checkCliContract(findings) {
  const parsed = releaseCandidateCli.parseArgs([
    "--",
    "--json",
    "--quiet",
    "--operator-workspace",
    "workspace",
    "--strict-preflight",
    "--require-ready",
    "--profile",
    "worker",
    "--out",
    "bundle.md",
    "--include-git-status",
  ]);
  if (
    !objectsEqual(parsed, {
      gateStatusFile: "",
      gatesFile: "config/v0-release-gates.json",
      cutoverChecklistFile: "config/production-cutover-checklist.json",
      cutoverStatusFile: "",
      dogfoodChecklistFile: "config/dogfood-checklist.json",
      dogfoodStatusFile: "",
      securityReviewChecklistFile: "config/security-review-checklist.json",
      securityReviewStatusFile: "",
      includeGitStatus: true,
      json: true,
      operatorWorkspaceDir: "workspace",
      operatorEvidenceFile: "config/production-evidence.example.json",
      out: "bundle.md",
      preflightProfile: "worker",
      quiet: true,
      requireReady: true,
      strictPreflight: true,
    })
  ) {
    findings.push(`release candidate CLI parse contract changed: ${JSON.stringify(parsed)}.`);
  }

  const defaults = releaseCandidateCli.applyOperatorWorkspaceDefaults(parsed);
  const expectedWorkspaceFiles = {
    gateStatusFile: "v0-release-status.json",
    operatorEvidenceFile: "operator-evidence.json",
    dogfoodStatusFile: "dogfood-status.json",
    securityReviewStatusFile: "security-review-status.json",
    cutoverStatusFile: "production-cutover-status.json",
  };
  for (const [key, file] of Object.entries(expectedWorkspaceFiles)) {
    const expected = path.join("workspace", file);
    if (defaults[key] !== expected) {
      findings.push(`operator workspace default ${key} must be ${expected}, got ${defaults[key]}.`);
    }
  }

  expectError(
    () => releaseCandidateCli.parseArgs(["--profile", "browser"]),
    "--profile must be one of: server, worker.",
    findings
  );
  expectError(
    () => releaseCandidateCli.parseArgs(["--out"]),
    "--out requires a value.",
    findings
  );
}

function checkSourceInvariants(sourceTexts, findings) {
  const sourcePath = "src/release-candidate.cjs";
  const sourceText = sourceTexts[sourcePath] || readText(sourcePath);
  for (const snippet of [
    "PUBLIC_REDACTION_PATTERNS",
    "redactSensitiveText(value)",
    "arn:aws:[redacted]",
    "[redacted-aws-account-id]",
    "[operator-workspace]",
    "[external-path-set]",
    "This bundle is public-safe.",
  ]) {
    if (!sourceText.includes(snippet)) {
      findings.push(`${sourcePath} must include '${snippet}'.`);
    }
  }

  const binPath = "bin/release-candidate.cjs";
  const binText = sourceTexts[binPath] || readText(binPath);
  for (const snippet of [
    "DEFAULT_OPERATOR_WORKSPACE_FILES",
    "privatePathRoots",
    "args.operatorWorkspaceDir ? [args.operatorWorkspaceDir] : []",
    "npm --silent run release:candidate",
    "--operator-workspace <path>",
  ]) {
    if (!binText.includes(snippet)) {
      findings.push(`${binPath} must include '${snippet}'.`);
    }
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": ["npm run check:release-candidate"],
    "docs/release-candidate.md": [
      "npm run check:release-candidate",
      "release-candidate contract check",
      "[operator-workspace]",
      "[external-path-set]",
    ],
    "docs/release-readiness.md": ["release-candidate checker"],
    "docs/release-operations-map.md": ["npm run check:release-candidate"],
    "docs/release.md": [
      "npm run check:release-candidate",
      "public-safe release-candidate bundle contract",
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
  checkReleaseCandidateContract,
  releaseCandidateDocs,
};
