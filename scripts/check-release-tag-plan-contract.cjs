#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  collectReleaseTagPlan,
  formatReleaseTagPlanMarkdown,
  parseAheadBehind,
  releaseTagNameError,
} = require("../src/release-tag-plan.cjs");
const tagPlanCli = require("../bin/release-tag-plan.cjs");
const {
  completeReleaseNotesFixture,
} = require("./check-release-notes-publication-contract.cjs");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/release-tag-plan.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/v0-release-plan.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkReleaseTagPlanContract();
  console.log(
    `release tag plan contract ok (${result.planCases} plan cases, ${result.docs} docs checked)`
  );
}

function checkReleaseTagPlanContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkReadyPlan(findings);
  checkGitRefSafeTagName(findings);
  checkDirtyPlan(findings);
  checkExistingTagPlan(findings);
  checkReleaseNotesFailure(findings);
  checkReleaseNotesWarningGate(findings);
  checkReleaseNotesVersionMismatch(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`release tag plan contract check found ${findings.length} issue(s).`);
  }

  return {
    planCases: 8,
    docs: targetDocs.length,
  };
}

function checkReadyPlan(findings) {
  const plan = collectReleaseTagPlan({
    release: "0.1.0",
    releaseNotesMarkdown: completeReleaseNotesFixture(),
    requireReleaseNotes: true,
    now: new Date("2026-06-13T00:00:00.000Z"),
    git: cleanMainGit(),
  });
  if (!plan.ready) {
    findings.push(`clean main plan with complete notes must be ready: ${plan.errors.join("; ")}`);
  }
  if (plan.release !== "v0.1.0") {
    findings.push("release tag plan must normalize versions with a v prefix.");
  }
  const markdown = formatReleaseTagPlanMarkdown(plan);
  for (const snippet of [
    "Ready to tag: yes",
    "- release: v0.1.0",
    "- local tag exists: no",
    "git fetch origin --tags",
    "git tag -a v0.1.0",
    "Create the GitHub Release",
  ]) {
    if (!markdown.includes(snippet)) {
      findings.push(`ready tag plan markdown must include '${snippet}'.`);
    }
  }
  const [ahead, behind] = parseAheadBehind("2 3");
  if (ahead !== 2 || behind !== 3) {
    findings.push("release tag plan must parse ahead/behind counts.");
  }
}

function checkGitRefSafeTagName(findings) {
  for (const [tag, expected] of [
    ["v0..1", "consecutive dots"],
    ["v0.1.", "end with a dot"],
    ["v0.1.lock", "end with .lock"],
  ]) {
    const error = releaseTagNameError(tag);
    if (!error.includes(expected)) {
      findings.push(`release tag name guard must reject ${tag} with '${expected}'.`);
    }
  }
  if (releaseTagNameError("v0.1.0")) {
    findings.push("release tag name guard must allow ordinary v-prefixed versions.");
  }

  const plan = collectReleaseTagPlan({
    release: "v0..1",
    releaseNotesMarkdown: completeReleaseNotesFixture().replace(
      "# 6529reviewbot v0.1.0",
      "# 6529reviewbot v0..1"
    ),
    requireReleaseNotes: true,
    git: cleanMainGit(),
  });
  if (plan.ready) {
    findings.push("Git-ref-unsafe release tags must block release tag readiness.");
  }
  if (!plan.errors.some((error) => error.includes("Git ref-safe"))) {
    findings.push("Git-ref-unsafe release tag errors must explain the ref-safety issue.");
  }
}

function checkDirtyPlan(findings) {
  const plan = collectReleaseTagPlan({
    release: "v0.2.0",
    releaseNotesMarkdown: completeReleaseNotesFixture(),
    requireReleaseNotes: true,
    git: {
      ...cleanMainGit(),
      dirty: true,
    },
  });
  if (plan.ready) {
    findings.push("dirty working tree must block release tag readiness.");
  }
  if (!plan.errors.some((error) => error.includes("working tree must be clean"))) {
    findings.push("dirty working tree error must explain the cleanup requirement.");
  }
}

function checkExistingTagPlan(findings) {
  const plan = collectReleaseTagPlan({
    release: "v0.1.0",
    releaseNotesMarkdown: completeReleaseNotesFixture(),
    requireReleaseNotes: true,
    git: {
      ...cleanMainGit(),
      tagExists: true,
    },
  });
  if (plan.ready) {
    findings.push("existing local release tag must block release tag readiness.");
  }
  if (!plan.errors.some((error) => error.includes("already exists locally"))) {
    findings.push("existing tag error must explain that the release tag already exists locally.");
  }
}

function checkReleaseNotesFailure(findings) {
  const plan = collectReleaseTagPlan({
    release: "v0.2.0",
    releaseNotesMarkdown: completeReleaseNotesFixture().replace("No accepted deferrals.", "TODO(operator)"),
    requireReleaseNotes: true,
    git: cleanMainGit(),
  });
  if (plan.ready) {
    findings.push("unfinished release notes must block release tag readiness.");
  }
  if (!plan.errors.some((error) => error.includes("release notes:"))) {
    findings.push("release-notes failures must be surfaced in the tag plan.");
  }
}

function checkReleaseNotesWarningGate(findings) {
  const warningNotes = completeReleaseNotesFixture().replace(
    "run-control mode is `enforce`, ",
    ""
  );
  const advisoryPlan = collectReleaseTagPlan({
    release: "v0.1.0",
    releaseNotesMarkdown: warningNotes,
    requireReleaseNotes: true,
    git: cleanMainGit(),
  });
  if (!advisoryPlan.ready) {
    findings.push(
      `release-note recommendation warnings should stay advisory without requireNoWarnings: ${advisoryPlan.errors.join("; ")}`
    );
  }
  const hasRunControlWarning = advisoryPlan.warnings.some((warning) =>
    warning.includes("run-control mode is `enforce`")
  );
  if (!hasRunControlWarning) {
    findings.push("release tag plan must surface release-note recommendation warnings.");
  }

  const strictPlan = collectReleaseTagPlan({
    release: "v0.1.0",
    releaseNotesMarkdown: warningNotes,
    requireReleaseNotes: true,
    requireNoWarnings: true,
    git: cleanMainGit(),
  });
  if (strictPlan.ready) {
    findings.push("release tag plan must block readiness when release-note warnings are promoted.");
  }
  if (!strictPlan.errors.some((error) => error.includes("warning promoted to error"))) {
    findings.push("release tag plan must surface promoted release-note warnings as errors.");
  }

  const readyArgs = tagPlanCli.parseArgs(["--require-ready"]);
  if (!readyArgs.requireNoWarnings) {
    findings.push("release tag plan --require-ready must imply --require-no-warnings.");
  }
}

function checkReleaseNotesVersionMismatch(findings) {
  const plan = collectReleaseTagPlan({
    release: "v0.2.0",
    releaseNotesMarkdown: completeReleaseNotesFixture(),
    requireReleaseNotes: true,
    git: cleanMainGit(),
  });
  if (plan.ready) {
    findings.push("release notes title version mismatch must block release tag readiness.");
  }
  if (!plan.errors.some((error) => error.includes("must match planned release"))) {
    findings.push("release notes version mismatch error must explain the planned release mismatch.");
  }
}

function checkCli(findings) {
  try {
    tagPlanCli.parseArgs(["--nope"]);
    findings.push("release tag plan CLI must reject unknown arguments.");
  } catch (error) {
    if (!String(error.message).includes("Unknown argument")) {
      findings.push("release tag plan CLI unknown-argument error should be explicit.");
    }
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "6529-release-tag-plan-"));
  const file = path.join(directory, "release-notes.md");
  try {
    fs.writeFileSync(file, completeReleaseNotesFixture(), "utf8");
    const plan = tagPlanCli.main([
      "--release",
      "v0.1.0",
      "--release-notes",
      file,
      "--require-ready",
      "--quiet",
    ], {
      git: cleanMainGit(),
      noExitCode: true,
      now: new Date("2026-06-13T00:00:00.000Z"),
    });
    if (!plan.ready) {
      findings.push("release tag plan CLI must return ready for clean main and complete notes.");
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function cleanMainGit() {
  return {
    branch: "main",
    commit: "abcdef1234567890abcdef1234567890abcdef12",
    dirty: false,
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
  };
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["release:tag-plan", "check:release-tag-plan"],
    "src/release-tag-plan.cjs": [
      "collectReleaseTagPlan",
      "validateReleaseNotesPublication",
      "releaseFromReleaseNotes",
      "releaseTagNameError",
      "already exists locally",
      "This command does not create tags",
    ],
    "src/release-version.cjs": [
      "normalizeReleaseVersion",
      "releaseTagNameError",
      "Git ref-safe",
    ],
    "bin/release-tag-plan.cjs": [
      "npm run release:tag-plan",
      "--require-ready",
      "result.requireNoWarnings = true",
      "This command does not create tags or GitHub Releases.",
    ],
    "scripts/release-check.cjs": ["scripts/check-release-tag-plan-contract.cjs"],
    "scripts/smoke-test.cjs": [
      "releaseTagPlanContractCheck",
      "releaseTagPlanContractCheck.checkReleaseTagPlanContract",
    ],
    "config/release-operations-map.json": [
      "release-tag-plan-contract",
      "release-tag-plan",
      "release notes title match",
      "local tag availability",
      "release-note warnings",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run release:tag-plan",
      "npm run check:release-tag-plan",
      "[Release Tag Plan](docs/release-tag-plan.md)",
    ],
    "docs/release-tag-plan.md": [
      "npm run release:tag-plan",
      "--require-ready",
      "Git ref-safe",
      "local tag",
      "release notes title",
      "release-note warnings",
      "does not create tags",
      "npm run check:release-tag-plan",
    ],
    "docs/release.md": [
      "npm run release:tag-plan",
      "npm run check:release-tag-plan",
    ],
    "docs/release-readiness.md": [
      "release tag plan",
      "npm run check:release-tag-plan",
    ],
    "docs/v0-release-plan.md": [
      "npm run release:tag-plan",
      "dry-run tag plan",
    ],
    "docs/roadmap.md": [
      "release tag plan",
      "completed release notes",
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
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkReleaseTagPlanContract,
};
