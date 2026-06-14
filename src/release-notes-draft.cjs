"use strict";

const fs = require("fs");
const {
  collectReleaseCandidateBundle,
  publicText,
} = require("./release-candidate.cjs");
const {
  PROVIDERS,
  loadModelCatalog,
} = require("./model-catalog.cjs");
const { normalizeReleaseVersion } = require("./release-version.cjs");
const packageJson = require("../package.json");

const DEFAULT_RELEASE_STATUS = "pre-v1 dogfood/community-review release.";
const TODO = "TODO(operator)";

function collectReleaseNotesDraft(options = {}) {
  const now = options.now || new Date();
  const candidate = loadCandidateBundle(options, now);
  const catalog = options.modelCatalog ||
    loadModelCatalog({
      env: options.env || {},
      path: options.modelCatalogPath,
    });
  return {
    version: 1,
    generatedAt: now.toISOString(),
    release: normalizeReleaseVersion(options.release || options.version || `v${packageJson.version}`),
    status: publicText(options.status || DEFAULT_RELEASE_STATUS),
    package: {
      name: publicText(packageJson.name),
      version: publicText(packageJson.version),
    },
    modelCatalog: summarizeModelCatalog(catalog),
    candidate: summarizeCandidateBundle(candidate),
    notes: {
      todo: TODO,
      source: options.candidateFile ? "candidate-file" : "generated-candidate",
    },
  };
}

function loadCandidateBundle(options, now) {
  if (options.candidateBundle) {
    return options.candidateBundle;
  }
  if (options.candidateFile) {
    return JSON.parse(fs.readFileSync(options.candidateFile, "utf8"));
  }
  return collectReleaseCandidateBundle({
    env: options.env || {},
    includeGitStatus: Boolean(options.includeGitStatus),
    now,
    root: options.root || process.cwd(),
    strictPreflight: Boolean(options.strictPreflight),
  });
}

function summarizeModelCatalog(catalog) {
  return {
    defaultProvider: publicText(catalog.defaultProvider),
    providers: Object.fromEntries(
      PROVIDERS.map((provider) => {
        const config = catalog.providers[provider] || {};
        return [
          provider,
          {
            defaultModel: publicText(config.defaultModel || ""),
            requireExplicitModel: Boolean(config.requireExplicitModel),
          },
        ];
      })
    ),
  };
}

function summarizeCandidateBundle(candidate) {
  const readiness = candidate.readiness || {};
  return {
    release: publicText(candidate.release || ""),
    ready: Boolean(candidate.ready),
    package: {
      name: publicText(candidate.package && candidate.package.name),
      version: publicText(candidate.package && candidate.package.version),
    },
    git: {
      branch: publicText(candidate.git && candidate.git.branch),
      commit: publicText(candidate.git && candidate.git.commit),
    },
    releaseGates: readinessSummary(readiness.releaseGates),
    communityRelease: optionalReadinessSummary(readiness.communityRelease),
    operatorEvidence: readinessSummary(readiness.operatorEvidence),
    dogfood: optionalReadinessSummary(readiness.dogfood),
    securityReview: optionalReadinessSummary(readiness.securityReview),
    productionCutover: optionalReadinessSummary(readiness.productionCutover),
    preflight: {
      ok: Boolean(readiness.preflight && readiness.preflight.ok),
      profile: publicText(readiness.preflight && readiness.preflight.profile),
      strict: Boolean(readiness.preflight && readiness.preflight.strict),
      errors: messageCount(readiness.preflight && readiness.preflight.errors),
      warnings: messageCount(readiness.preflight && readiness.preflight.warnings),
    },
  };
}

function formatReleaseNotesMarkdown(draft) {
  const lines = [
    `# 6529reviewbot ${publicText(draft.release)}`,
    "",
    `Status: ${publicText(draft.status)}`,
    "",
    `Generated: ${publicText(draft.generatedAt)}`,
    `Draft source: ${publicText(draft.notes.source)}`,
    "",
    "## Who Should Use This",
    "",
    [
      "This release is intended for 6529 maintainers and contributors auditing",
      "or dogfooding `6529bot`. It is not yet a broad production service for",
      "arbitrary repositories.",
    ].join(" "),
    "",
    "## Highlights",
    "",
    "- Central GitHub App and worker framework for PR review.",
    "- Review modes: general, follow-up, WCAG 2.2 AA, i18n, crypto/security.",
    "- Provider lanes: Anthropic, OpenAI, and OpenRouter through explicit config.",
    "- Public-repo trusted-actor admission before model calls.",
    "- Budget admission and usage telemetry through the isolated reviewbot ledger.",
    "- Run-control claims for duplicate delivery and concurrency protection.",
    "- Empty provider output fails closed before comment posting.",
    "- Worker diagnostics redact common token, alert-webhook, AWS access-key id, and private-key shapes.",
    "- Dry-run-by-default Aurora ledger schema tooling.",
    "- Dry-run-by-default model pricing update tooling.",
    "- No-network production preflight command.",
    "- Public/admin usage API contracts for 6529.io surfaces.",
    "",
    "## Tested Configuration",
    "",
    `- Worker path: ${TODO}`,
    `- GitHub Actions dispatch mode: ${TODO}`,
    `- GitHub Actions dispatch token source: ${TODO}`,
    `- Worker dispatch credential evidence: ${TODO}`,
    `- App server runtime: ${TODO}`,
    `- Container image contract check: ${TODO}`,
    `- Container image digest, if used: ${TODO}`,
    `- Container publish plan evidence: ${TODO}`,
    `- GitHub App permissions/events: ${TODO}`,
    `- Providers/models: ${modelCatalogLine(draft.modelCatalog)}`,
    `- Default Anthropic model: ${providerModel(draft.modelCatalog, "anthropic")}`,
    `- Repository config template: ${TODO}`,
    `- Budget mode and caps: ${TODO}`,
    `- Run-control mode and caps: ${TODO}`,
    `- Ledger schema status: ${TODO}`,
    `- Model pricing status: ${TODO}`,
    `- Model price source freshness policy: ${TODO}`,
    `- Alert delivery: ${TODO}`,
    `- Alert delivery plan: ${TODO}`,
    `- Empty provider output fail-closed evidence: ${TODO}`,
    `- Worker diagnostic redaction evidence: ${TODO}`,
    `- 6529.io dashboard/admin status: ${TODO}`,
    `- Public dashboard disclosure allowlists: ${TODO}`,
    `- Private admin auth-check/wallet allowlist evidence: ${TODO}`,
    `- Release candidate bundle: ${candidateLine(draft.candidate)}`,
    `- Production deployment plan: ${TODO}`,
    `- Dashboard deployment plan: ${TODO}`,
    `- Dogfood promotion packet: ${TODO}`,
    `- Dogfood go-live packet: ${TODO}`,
    `- Community release status: ${readinessLine(draft.candidate.communityRelease)}`,
    `- Production cutover status: ${readinessLine(draft.candidate.productionCutover)}`,
    `- Preflight result: ${preflightLine(draft.candidate.preflight)}`,
    `- v0 gate checklist: ${readinessLine(draft.candidate.releaseGates)}`,
    `- v0 gate status file/evidence: ${missingLine(draft.candidate.releaseGates)}`,
    `- v0 gate summary: ${readinessLine(draft.candidate.releaseGates)}`,
    "",
    "## Safety Requirements",
    "",
    "Public repositories should not enable automatic model calls unless all of these are true:",
    "",
    "- trusted-actor admission is enabled;",
    "- budget mode is `enforce`;",
    "- run-control mode is `enforce`, or the release notes explain why it is deferred;",
    "- non-noop worker traffic has reviewed dispatch credential evidence;",
    "- container image evidence has reviewed container publish-plan evidence;",
    "- provider keys and AWS credentials live only in bot-owned infrastructure;",
    "- target repo configuration is loaded from the base ref;",
    "- public dashboard repo/org disclosure uses reviewed allowlists before repo names are exposed;",
    "- private admin exposure has reviewed auth-check URL and wallet allowlist evidence;",
    "- broad community-release gates are complete or explicitly deferred before broad community use is announced;",
    "- scheduled operator alerts have reviewed alert delivery plan evidence and route to an operator-owned channel.",
    "",
    "## Known Gaps",
    "",
    `- Production GitHub App deployment: ${TODO}`,
    `- 6529.io public dashboard: ${TODO}`,
    `- 6529.io private admin UI: ${TODO}`,
    `- Dogfood repositories: ${TODO}`,
    `- Provider pricing/model update process: ${TODO}`,
    `- Accepted model-price overrides: ${TODO}`,
    `- Incident response readiness: ${TODO}`,
    `- Compatibility guarantees: pre-v1; pin target repositories to an exact tag or commit SHA.`,
    "",
    "## Deferrals And Accepted Risks",
    "",
    ...deferralLines(draft.candidate),
    "",
    "## Upgrade Notes",
    "",
    [
      "Pre-v1 releases may change worker payloads, hidden metadata, configuration",
      "fields, usage API shapes, comment format, and default fanout behavior. Pin",
      "target repositories to an exact tag or commit SHA and review release notes",
      "before updating.",
    ].join(" "),
    "",
    "## Rollback",
    "",
    "- Disable the GitHub App installation or repository config.",
    "- Set `REVIEWBOT_WORKER_ADAPTER=noop` or disable central dispatch.",
    "- Set `REVIEWBOT_ENABLED=false` for emergency pause.",
    "- Revert target repository `.github/6529bot.yml` changes if needed.",
    "",
    "## Validation",
    "",
    `- \`npm run release:check\`: ${TODO}`,
    `- \`npm run check:container-image\`: ${TODO}`,
    `- \`npm run v0:gates\`: ${TODO}`,
    `- \`npm run preflight -- -- --strict\`: ${TODO}`,
    `- \`npm run community:gates -- -- --status-file <operator-community-status-file> --require-ready\`: ${TODO}`,
    `- \`npm run release:candidate -- -- --status-file <operator-status-file> --operator-evidence-file <private-evidence-file> --strict-preflight --require-ready\`: ${TODO}`,
    `- \`npm run production:deployment-plan -- -- --host <production-bot-origin> --image <operator-registry>/6529reviewbot --operator-workspace <private-workspace-dir> --release v0.1.0 --require-ready\`: ${TODO}`,
    `- \`npm run dashboard:deployment-plan -- -- --frontend-origin <6529-io-origin> --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --auth-check-url <6529-auth-check-url> --require-ready\`: ${TODO}`,
    `- \`npm run alerts:delivery-plan -- -- --bot-origin <production-bot-origin> --operator-workspace <private-workspace-dir> --notify-mode <webhook|sns|ses> --alert-channel <operator-alert-channel> --require-ready\`: ${TODO}`,
    `- \`npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready\`: ${TODO}`,
    `- \`npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --model-price-file <reviewed-model-price-file.json> --strict-preflight --require-ready\`: ${TODO}`,
    `- \`npm run production:cutover -- -- --status-file <operator-cutover-status-file> --require-ready\`: ${TODO}`,
    `- CI: ${TODO}`,
    `- Dependency Review: ${TODO}`,
    `- OpenSSF Scorecard: ${TODO}`,
    `- Manual security checklist: ${TODO}`,
  ];
  return `${lines.join("\n")}\n`;
}

function readinessSummary(summary = {}) {
  return {
    ready: Boolean(summary.ready),
    total: wholeNumber(summary.total),
    complete: wholeNumber(summary.complete),
    deferred: wholeNumber(summary.deferred),
    pending: wholeNumber(summary.pending),
    blocked: wholeNumber(summary.blocked),
    missingStatusIds: Array.isArray(summary.missingStatusIds)
      ? summary.missingStatusIds.map((id) => publicText(id))
      : [],
  };
}

function optionalReadinessSummary(summary) {
  return summary ? readinessSummary(summary) : null;
}

function modelCatalogLine(catalog) {
  return PROVIDERS.map((provider) => `${provider}:${providerModel(catalog, provider)}`).join(", ");
}

function providerModel(catalog, provider) {
  const config = catalog.providers[provider] || {};
  if (config.requireExplicitModel && !config.defaultModel) {
    return "explicit required";
  }
  return publicText(config.defaultModel || "not configured");
}

function candidateLine(candidate) {
  const parts = [
    candidate.ready ? "ready" : "not ready",
    `candidate ${candidate.release || "unknown"}`,
    `release gates ${summaryCounts(candidate.releaseGates)}`,
    `operator evidence ${summaryCounts(candidate.operatorEvidence)}`,
  ];
  if (candidate.communityRelease) {
    parts.push(`community release ${summaryCounts(candidate.communityRelease)}`);
  }
  return parts.join("; ");
}

function readinessLine(summary) {
  if (!summary) {
    return TODO;
  }
  return `${summary.ready ? "ready" : "not ready"} (${summaryCounts(summary)})`;
}

function summaryCounts(summary) {
  return `${summary.complete}/${summary.total} complete, ${summary.deferred} deferred, ${summary.pending} pending, ${summary.blocked} blocked`;
}

function missingLine(summary) {
  if (!summary || summary.missingStatusIds.length === 0) {
    return "none missing in supplied bundle";
  }
  return `${summary.missingStatusIds.length} missing: ${summary.missingStatusIds.join(", ")}`;
}

function preflightLine(preflight) {
  return [
    preflight.ok ? "ready" : "not ready",
    `${preflight.errors} errors`,
    `${preflight.warnings} warnings`,
    preflight.strict ? "strict" : "non-strict",
  ].join(", ");
}

function deferralLines(candidate) {
  const deferrals = [
    ["release gates", candidate.releaseGates],
    ["community release", candidate.communityRelease],
    ["operator evidence", candidate.operatorEvidence],
    ["dogfood", candidate.dogfood],
    ["security review", candidate.securityReview],
    ["production cutover", candidate.productionCutover],
  ].filter(([, summary]) => summary && summary.deferred > 0);
  if (deferrals.length === 0) {
    return [
      `- Gate: ${TODO} confirm no accepted deferrals remain, or name each deferred gate.`,
      `- Risk accepted: ${TODO}`,
      `- Follow-up owner: ${TODO}`,
      `- Follow-up trigger/date: ${TODO}`,
      `- Public-safe evidence: ${TODO}`,
    ];
  }
  return deferrals.flatMap(([label, summary]) => [
    `- Gate: ${publicText(label)} (${summary.deferred} deferred)`,
    `- Risk accepted: ${TODO}`,
    `- Follow-up owner: ${TODO}`,
    `- Follow-up trigger/date: ${TODO}`,
    `- Public-safe evidence: ${TODO}`,
  ]);
}

function messageCount(messages) {
  return Array.isArray(messages) ? messages.length : 0;
}

function wholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

module.exports = {
  collectReleaseNotesDraft,
  formatReleaseNotesMarkdown,
  normalizeReleaseVersion,
  summarizeCandidateBundle,
  summarizeModelCatalog,
};
