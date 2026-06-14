#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  collectReleaseNotesDraft,
  formatReleaseNotesMarkdown,
  normalizeReleaseVersion,
} = require("../src/release-notes-draft.cjs");
const releaseNotesCli = require("../bin/release-notes-draft.cjs");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/release-notes-draft.md",
  "docs/release-notes-template.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkReleaseNotesDraftContract();
  console.log(
    `release notes draft contract ok (${result.draftCases} draft cases, ${result.docs} docs checked)`
  );
}

function checkReleaseNotesDraftContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkDefaultDraft(findings);
  checkCandidateFileDraft(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`release notes draft contract check found ${findings.length} issue(s).`);
  }

  return {
    draftCases: 3,
    docs: targetDocs.length,
  };
}

function checkDefaultDraft(findings) {
  const draft = collectReleaseNotesDraft({
    env: {},
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
  });
  if (draft.release !== "v0.1.0") {
    findings.push("default release notes draft must use the package version with v prefix.");
  }
  if (draft.modelCatalog.providers.anthropic.defaultModel !== "claude-opus-4-8") {
    findings.push("release notes draft must include the default Anthropic model.");
  }
  if (!draft.modelCatalog.providers.openrouter.requireExplicitModel) {
    findings.push("release notes draft must preserve explicit OpenRouter routing.");
  }
  const markdown = formatReleaseNotesMarkdown(draft);
  for (const snippet of [
    "# 6529reviewbot v0.1.0",
    "Status: pre-v1 dogfood/community-review release.",
    "Providers/models: anthropic:claude-opus-4-8",
    "openrouter:explicit required",
    "Release candidate bundle:",
    "Production deployment plan:",
    "Dashboard deployment plan:",
    "Alert delivery plan:",
    "TODO(operator)",
    "`npm run release:check`",
    "`npm run production:deployment-plan",
    "`npm run dashboard:deployment-plan",
    "`npm run alerts:delivery-plan",
    "reviewed alert delivery plan evidence",
    "`npm --silent run dogfood:go-live",
  ]) {
    if (!markdown.includes(snippet)) {
      findings.push(`default release notes draft must include '${snippet}'.`);
    }
  }
}

function checkCandidateFileDraft(findings) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "6529reviewbot-release-notes-"));
  const file = path.join(directory, "candidate.json");
  try {
    fs.writeFileSync(
      file,
      `${JSON.stringify({
        version: 1,
        release: "arn:aws:iam::123456789012:role/private",
        ready: true,
        package: { name: "@6529/6529reviewbot", version: "0.1.0" },
        git: { branch: "main", commit: "abcdef123456" },
        readiness: {
          releaseGates: { ready: true, total: 2, complete: 2, deferred: 0, pending: 0, blocked: 0, missingStatusIds: [] },
          operatorEvidence: { ready: true, total: 1, complete: 1, deferred: 0, pending: 0, blocked: 0 },
          preflight: { ok: true, profile: "server", strict: true, errors: [], warnings: [] },
        },
      })}\n`,
      "utf8"
    );
    const draft = collectReleaseNotesDraft({
      candidateFile: file,
      env: {},
      now: new Date("2026-06-13T00:00:00.000Z"),
      release: "v0.2.0",
    });
    const markdown = formatReleaseNotesMarkdown(draft);
    if (!markdown.includes("v0.2.0")) {
      findings.push("release notes draft must allow explicit release versions.");
    }
    if (markdown.includes("123456789012") || markdown.includes("arn:aws:iam")) {
      findings.push("release notes draft must redact AWS identifiers from candidate files.");
    }
    if (!markdown.includes("ready; candidate arn:aws:[redacted]; release gates 2/2 complete")) {
      findings.push("release notes draft must summarize candidate-file readiness.");
    }
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

function checkCli(findings) {
  if (normalizeReleaseVersion("0.2.0") !== "v0.2.0") {
    findings.push("release version normalization must add a v prefix.");
  }
  try {
    releaseNotesCli.parseArgs(["--nope"]);
    findings.push("release notes draft CLI must reject unknown arguments.");
  } catch (error) {
    if (!String(error.message).includes("Unknown argument")) {
      findings.push("release notes draft CLI unknown-argument error should be explicit.");
    }
  }
  const draft = releaseNotesCli.main(["--json", "--quiet"], {
    env: {},
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
  });
  if (draft.release !== "v0.1.0") {
    findings.push("release notes draft CLI must return the generated draft.");
  }
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["release:notes", "check:release-notes-draft"],
    "src/release-notes-draft.cjs": [
      "collectReleaseCandidateBundle",
      "loadModelCatalog",
      "TODO(operator)",
      "dashboard:deployment-plan",
      "alerts:delivery-plan",
      "publicText",
    ],
    "bin/release-notes-draft.cjs": [
      "npm run release:notes",
      "--candidate-file",
      "Use npm --silent run when command arguments include private operator paths.",
    ],
    "scripts/release-check.cjs": [
      "scripts/check-release-notes-draft-contract.cjs",
      "bin/release-notes-draft.cjs",
    ],
    "scripts/smoke-test.cjs": [
      "releaseNotesDraftContractCheck",
      "releaseNotesDraftContractCheck.checkReleaseNotesDraftContract",
    ],
    "config/release-operations-map.json": [
      "release-notes-draft-contract",
      "release-notes-draft",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run release:notes",
      "npm run check:release-notes-draft",
      "[Release Notes Draft](docs/release-notes-draft.md)",
    ],
    "docs/release-notes-draft.md": [
      "npm run release:notes",
      "public-safe pre-v1 release notes draft",
      "npm --silent run release:notes -- -- --candidate-file <release-candidate.json>",
      "TODO(operator)",
      "npm run check:release-notes-draft",
    ],
    "docs/release-notes-template.md": [
      "Release Notes Draft",
      "npm run release:notes",
    ],
    "docs/release.md": [
      "npm run release:notes",
      "npm run check:release-notes-draft",
    ],
    "docs/release-readiness.md": [
      "release notes draft",
      "npm run check:release-notes-draft",
    ],
    "docs/roadmap.md": [
      "release notes draft",
      "release-candidate bundle",
    ],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function checkSnippets(text, snippets, label, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of snippets) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`${label} must include '${snippet}'.`);
    }
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  main();
}

module.exports = {
  checkReleaseNotesDraftContract,
};
