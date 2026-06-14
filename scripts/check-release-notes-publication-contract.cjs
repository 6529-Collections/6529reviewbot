#!/usr/bin/env node

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  formatPublicationReport,
  validateReleaseNotesPublication,
} = require("../src/release-notes-publication.cjs");
const {
  collectReleaseNotesDraft,
  formatReleaseNotesMarkdown,
} = require("../src/release-notes-draft.cjs");
const publicationCli = require("../bin/release-notes-publication.cjs");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/release-notes-publication.md",
  "docs/release-notes-draft.md",
  "docs/release-notes-template.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkReleaseNotesPublicationContract();
  console.log(
    `release notes publication contract ok (${result.publicationCases} publication cases, ${result.docs} docs checked)`
  );
}

function checkReleaseNotesPublicationContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkCompleteNotes(findings);
  checkDraftRejected(findings);
  checkSensitiveTextRejected(findings);
  checkFailedValidationRejected(findings);
  checkNegatedReadyValidationRejected(findings);
  checkVagueValidationRejected(findings);
  checkModelPriceOverrideDisclosure(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`release notes publication contract check found ${findings.length} issue(s).`);
  }

  return {
    publicationCases: 8,
    docs: targetDocs.length,
  };
}

function checkCompleteNotes(findings) {
  const notes = completeReleaseNotesFixture();
  const report = validateReleaseNotesPublication(notes);
  if (!report.ready) {
    findings.push(`completed release notes fixture must be ready: ${report.errors.join("; ")}`);
  }
  if (!formatPublicationReport(report).includes("Release notes publication ready: yes")) {
    findings.push("publication report must include ready status.");
  }
}

function checkDraftRejected(findings) {
  const draft = collectReleaseNotesDraft({
    env: {},
    now: new Date("2026-06-13T00:00:00.000Z"),
    root,
  });
  const report = validateReleaseNotesPublication(formatReleaseNotesMarkdown(draft));
  if (report.ready) {
    findings.push("release notes publication check must reject unfinished drafts.");
  }
  if (!report.errors.some((error) => error.includes("TODO(operator)"))) {
    findings.push("unfinished draft rejection must mention TODO(operator).");
  }
}

function checkSensitiveTextRejected(findings) {
  const report = validateReleaseNotesPublication(
    completeReleaseNotesFixture().replace(
      "Release candidate bundle: ready",
      "Release candidate bundle: arn:aws:iam::123456789012:role/private github_pat_abcdefghijklmnopqrstuvwxyz123456"
    )
  );
  if (report.ready) {
    findings.push("release notes publication check must reject sensitive text.");
  }
  if (!report.errors.some((error) => error.includes("sensitive") || error.includes("AWS"))) {
    findings.push("sensitive text rejection must explain the public-safety issue.");
  }
}

function checkFailedValidationRejected(findings) {
  const report = validateReleaseNotesPublication(
    completeReleaseNotesFixture().replace("CI: passed", "CI: failed")
  );
  if (report.ready) {
    findings.push("release notes publication check must reject failed validation evidence.");
  }
  if (!report.errors.some((error) => error.includes("CI:") && error.includes("failed"))) {
    findings.push("failed validation rejection must identify the failing validation field.");
  }
}

function checkNegatedReadyValidationRejected(findings) {
  const report = validateReleaseNotesPublication(
    completeReleaseNotesFixture().replace("CI: passed", "CI: not ok")
  );
  if (report.ready) {
    findings.push("release notes publication check must reject negated ready validation evidence.");
  }
  if (!report.errors.some((error) => error.includes("CI:") && error.includes("negated"))) {
    findings.push("negated ready validation rejection must identify the validation field.");
  }
}

function checkVagueValidationRejected(findings) {
  const report = validateReleaseNotesPublication(
    completeReleaseNotesFixture().replace("CI: passed", "CI: ran")
  );
  if (report.ready) {
    findings.push("release notes publication check must reject vague validation evidence.");
  }
  if (!report.errors.some((error) => error.includes("CI:") && error.includes("passed"))) {
    findings.push("vague validation rejection must identify the validation field and ready-evidence requirement.");
  }
}

function checkModelPriceOverrideDisclosure(findings) {
  const vagueOverride = validateReleaseNotesPublication(
    completeReleaseNotesFixture().replace(
      "Accepted model-price overrides: none",
      "Accepted model-price overrides: stale pricing allowed"
    )
  );
  if (vagueOverride.ready) {
    findings.push("release notes publication check must reject vague model-price override disclosure.");
  }
  if (
    !vagueOverride.errors.some((error) =>
      error.includes("--allow-stale-source/--allow-zero-price")
    )
  ) {
    findings.push("vague model-price override rejection must name the exact override flags.");
  }

  const missingEvidence = validateReleaseNotesPublication(
    completeReleaseNotesFixture().replace(
      "Accepted model-price overrides: none",
      "Accepted model-price overrides: --allow-stale-source for anthropic:claude-opus-4-8"
    )
  );
  if (missingEvidence.ready) {
    findings.push("release notes publication check must reject model-price overrides without evidence.");
  }
  if (!missingEvidence.errors.some((error) => error.includes("accepted risk and operator evidence"))) {
    findings.push("model-price override evidence rejection must mention accepted risk and operator evidence.");
  }

  const acceptedOverride = validateReleaseNotesPublication(
    completeReleaseNotesFixture().replace(
      "Accepted model-price overrides: none",
      "Accepted model-price overrides: --allow-stale-source accepted for anthropic:claude-opus-4-8 with private operator evidence in the release runbook"
    )
  );
  if (!acceptedOverride.ready) {
    findings.push(`accepted model-price override disclosure should pass: ${acceptedOverride.errors.join("; ")}`);
  }
}

function checkCli(findings) {
  try {
    publicationCli.parseArgs(["--nope"]);
    findings.push("release notes publication CLI must reject unknown arguments.");
  } catch (error) {
    if (!String(error.message).includes("Unknown argument")) {
      findings.push("release notes publication CLI unknown-argument error should be explicit.");
    }
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "6529-release-notes-publication-"));
  const file = path.join(directory, "release-notes.md");
  try {
    fs.writeFileSync(file, completeReleaseNotesFixture(), "utf8");
    const report = publicationCli.main(["--file", file, "--quiet"], {
      noExitCode: true,
    });
    if (!report.ready) {
      findings.push("release notes publication CLI must return a ready report for complete notes.");
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["release:notes:check", "check:release-notes-publication"],
    "src/release-notes-publication.cjs": [
      "validateReleaseNotesPublication",
      "TODO(operator)",
      "redactSensitiveText",
      "checkValidationResults",
      "checkModelPriceOverrideDisclosure",
      "FAILED_VALIDATION_PATTERN",
      "READY_VALIDATION_PATTERN",
      "No accepted deferrals",
      "Dashboard deployment plan:",
      "Alert delivery plan:",
      "reviewed alert delivery plan evidence",
      "`npm run dashboard:deployment-plan",
      "`npm run alerts:delivery-plan",
    ],
    "bin/release-notes-publication.cjs": [
      "npm run release:notes:check",
      "--file <release-notes.md>",
      "--require-no-warnings",
    ],
    "scripts/release-check.cjs": [
      "scripts/check-release-notes-publication-contract.cjs",
    ],
    "scripts/smoke-test.cjs": [
      "releaseNotesPublicationContractCheck",
      "releaseNotesPublicationContractCheck.checkReleaseNotesPublicationContract",
    ],
    "config/release-operations-map.json": [
      "release-notes-publication-contract",
      "release-notes-publication",
      "vague or failed validation results",
      "explicit validation evidence",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run release:notes:check",
      "npm run check:release-notes-publication",
      "[Release Notes Publication](docs/release-notes-publication.md)",
    ],
    "docs/release-notes-publication.md": [
      "npm run release:notes:check",
      "TODO(operator)",
      "No accepted deferrals",
      "passed, ready, reviewed, or accepted evidence",
      "npm run check:release-notes-publication",
    ],
    "docs/release-notes-draft.md": [
      "release:notes:check",
      "Release Notes Publication",
    ],
    "docs/release-notes-template.md": [
      "Release Notes Publication",
      "Dashboard deployment plan:",
      "Alert delivery plan:",
      "No accepted deferrals",
    ],
    "docs/release.md": [
      "npm run release:notes:check",
      "npm run check:release-notes-publication",
    ],
    "docs/release-readiness.md": [
      "release notes publication",
      "npm run check:release-notes-publication",
    ],
    "docs/roadmap.md": [
      "release notes publication",
      "completed release notes",
    ],
  };

  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function completeReleaseNotesFixture() {
  return `# 6529reviewbot v0.1.0

Status: pre-v1 dogfood/community-review release.

## Who Should Use This

This release is intended for 6529 maintainers dogfooding \`6529bot\`.

## Highlights

- trusted-actor admission, budget admission, and run-control are included.

## Tested Configuration

- Worker path: central GitHub Actions dispatch in reviewed bot repo
- GitHub Actions dispatch mode: GitHub App installation token
- GitHub Actions dispatch token source: bot-owned dispatch App
- App server runtime: reviewed container or local dogfood runtime
- Container image contract check: passed
- Container image digest, if used: not used for this dogfood release
- GitHub App permissions/events: reviewed manifest packet
- Providers/models: anthropic:claude-opus-4-8
- Default Anthropic model: claude-opus-4-8
- Repository config template: templates/dogfood-command-only-config.yml
- Budget mode and caps: enforce with conservative dogfood caps
- Run-control mode and caps: enforce with conservative caps
- Ledger schema status: applied or explicitly manual for dogfood
- Model pricing status: conservative defaults reviewed
- Model price source freshness policy: reviewed during release candidate
- Alert delivery: operator-owned channel verified after reviewed alert delivery plan evidence
- Alert delivery plan: ready
- Empty provider output fail-closed evidence: smoke and release checks passed
- Worker diagnostic redaction evidence: diagnostics redaction checks passed
- 6529.io dashboard/admin status: public dashboard deployed or deferred
- Release candidate bundle: ready
- Production deployment plan: ready
- Dashboard deployment plan: ready
- Dogfood promotion packet: ready
- Dogfood go-live packet: ready
- Production cutover status: dogfood-only release
- Preflight result: strict preflight passed
- v0 gate checklist: reviewed
- v0 gate status file/evidence: complete
- v0 gate summary: ready

## Safety Requirements

Public repositories should not enable automatic model calls unless trusted-actor admission is enabled, budget mode is \`enforce\`, provider keys and AWS credentials live only in bot-owned infrastructure, target repo configuration is loaded from the base ref, and scheduled operator alerts have reviewed alert delivery plan evidence and route to an operator-owned channel.

## Known Gaps

- Production GitHub App deployment: dogfood-only
- 6529.io public dashboard: deployed or explicitly deferred
- 6529.io private admin UI: deployed or explicitly deferred
- Dogfood repositories: selected trusted repos only
- Provider pricing/model update process: reviewed for dogfood
- Accepted model-price overrides: none
- Incident response readiness: incident runbook reviewed
- Compatibility guarantees: pre-v1; pin target repositories to an exact tag or commit SHA

## Deferrals And Accepted Risks

No accepted deferrals.

## Upgrade Notes

Pre-v1 releases may change worker payloads. Pin target repositories to an exact tag or commit SHA before updating.

## Rollback

- Set \`REVIEWBOT_ENABLED=false\`.
- Set \`REVIEWBOT_WORKER_ADAPTER=noop\`.

## Validation

- \`npm run release:check\`: passed
- \`npm run check:container-image\`: passed
- \`npm run v0:gates\`: passed
- \`npm run preflight -- -- --strict\`: passed
- \`npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready\`: passed
- \`npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --release v0.1.0 --require-ready\`: passed
- \`npm run dashboard:deployment-plan -- -- --frontend-origin <6529-io-origin> --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --auth-check-url <6529-auth-check-url> --require-ready\`: passed
- \`npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --require-ready\`: passed
- \`npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready\`: passed
- \`npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready\`: passed
- \`npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready\`: passed or explicitly dogfood-only
- CI: passed
- Dependency Review: passed
- OpenSSF Scorecard: passed
- Manual security checklist: passed
`;
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
  checkReleaseNotesPublicationContract,
  completeReleaseNotesFixture,
};
