"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  DEFAULT_OPERATOR_WORKSPACE_FILES,
  checkOperatorWorkspace,
  createOperatorWorkspace,
  publicOperatorWorkspaceSummary,
} = require("./operator-workspace.cjs");
const {
  collectDogfoodGoLivePacket,
} = require("./dogfood-go-live.cjs");
const {
  collectDogfoodPromotionPacket,
} = require("./dogfood-promotion.cjs");
const {
  collectDogfoodReadiness,
} = require("./dogfood-readiness.cjs");
const {
  collectReleaseCandidateBundle,
  publicText,
} = require("./release-candidate.cjs");

function runOperatorDrill(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const temporary = !options.directory;
  const directory = temporary
    ? fs.mkdtempSync(path.join(os.tmpdir(), "6529reviewbot-operator-drill-"))
    : path.resolve(options.directory);
  const now = options.now || new Date();

  try {
    createOperatorWorkspace({
      allowRepoDir: Boolean(options.allowRepoDir),
      commit: options.commit,
      date: options.date,
      directory,
      environment: options.environment,
      force: temporary || Boolean(options.force),
      operator: options.operator,
      privateEvidenceLocation: options.privateEvidenceLocation,
      publicSummaryLocation: options.publicSummaryLocation,
      release: options.release,
      repoRoot: root,
    });
    const workspace = publicOperatorWorkspaceSummary(
      checkOperatorWorkspace({ directory, repoRoot: root })
    );
    const workspacePaths = operatorWorkspaceFilePaths(directory);
    const releaseCandidate = collectReleaseCandidateBundle({
      env: options.env || process.env,
      gateStatusFile: workspacePaths.releaseGateStatus,
      dogfoodStatusFile: workspacePaths.dogfoodStatus,
      securityReviewStatusFile: workspacePaths.securityReviewStatus,
      cutoverStatusFile: workspacePaths.productionCutoverStatus,
      includeGitStatus: Boolean(options.includeGitStatus),
      now,
      operatorEvidenceFile: workspacePaths.operatorEvidence,
      privatePathRoots: [directory],
      root,
      strictPreflight: false,
    });
    const dogfoodReadiness = collectDogfoodReadiness({
      env: options.env || process.env,
      includePreflight: false,
      now,
      operatorWorkspaceDir: directory,
      root,
    });
    const dogfoodPromotion = collectDogfoodPromotionPacket({
      env: options.env || process.env,
      includePreflight: false,
      now,
      operatorWorkspaceDir: directory,
      root,
      skipSelfDogfoodReplay: Boolean(options.skipSelfDogfoodReplay),
    });
    const dogfoodGoLive = collectDogfoodGoLivePacket({
      env: options.env || process.env,
      includeGitStatus: Boolean(options.includeGitStatus),
      includePreflight: false,
      now,
      operatorWorkspaceDir: directory,
      privatePathRoots: [directory],
      root,
      skipSelfDogfoodReplay: Boolean(options.skipSelfDogfoodReplay),
      strictPreflight: false,
    });

    return publicOperatorDrillReport({
      directory,
      dogfoodGoLive,
      dogfoodPromotion,
      dogfoodReadiness,
      releaseCandidate,
      temporary,
      workspace,
    });
  } finally {
    if (temporary) {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  }
}

function publicOperatorDrillReport(input) {
  const ready =
    input.workspace.ready &&
    input.releaseCandidate.ready &&
    input.dogfoodReadiness.ready &&
    input.dogfoodPromotion.ready &&
    input.dogfoodGoLive.ready;
  return {
    version: 1,
    generatedAt: publicText(input.releaseCandidate.generatedAt || new Date().toISOString()),
    ready,
    inputs: {
      operatorWorkspace: "[operator-workspace]",
      workspaceMode: input.temporary ? "temporary" : "operator-provided",
      temporaryWorkspaceCleanedUp: Boolean(input.temporary),
      preflight: "not included in promotion/go-live drill; run strict preflight from the private operator environment",
    },
    summaries: {
      operatorWorkspace: input.workspace.summaries,
      releaseCandidate: {
        ready: input.releaseCandidate.ready,
        releaseGates: input.releaseCandidate.readiness.releaseGates,
        operatorEvidence: input.releaseCandidate.readiness.operatorEvidence,
        dogfood: input.releaseCandidate.readiness.dogfood,
        securityReview: input.releaseCandidate.readiness.securityReview,
        productionCutover: input.releaseCandidate.readiness.productionCutover,
        preflight: input.releaseCandidate.readiness.preflight,
      },
      dogfoodReadiness: {
        ready: input.dogfoodReadiness.ready,
        repositoryConfigs: input.dogfoodReadiness.checks.repositoryConfigs.status,
        budgetPolicies: input.dogfoodReadiness.checks.budgetPolicies.status,
        modelCatalog: input.dogfoodReadiness.checks.modelCatalog.status,
        operatorWorkspace: input.dogfoodReadiness.checks.operatorWorkspace.status,
      },
      dogfoodPromotion: {
        ready: input.dogfoodPromotion.ready,
        summary: input.dogfoodPromotion.summary,
        nextActions: input.dogfoodPromotion.nextActions.map((action) => publicText(action)),
      },
      dogfoodGoLive: {
        ready: input.dogfoodGoLive.ready,
        gates: input.dogfoodGoLive.gates.map((gate) => ({
          id: publicText(gate.id),
          status: publicText(gate.status),
          detail: publicText(gate.detail),
        })),
        nextActions: input.dogfoodGoLive.nextActions.map((action) => publicText(action)),
      },
    },
    nextCommands: operatorDrillNextCommands(),
  };
}

function formatOperatorDrillMarkdown(report) {
  const lines = [
    "# 6529bot Operator Drill",
    "",
    [
      "This report is public-safe. It creates or checks an operator workspace",
      "skeleton and rehearses the release-candidate, dogfood readiness,",
      "promotion, and go-live summaries without calling GitHub, AWS, or model",
      "providers.",
    ].join(" "),
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Generated: ${publicText(report.generatedAt)}`,
    `Workspace: ${report.inputs.operatorWorkspace} (${report.inputs.workspaceMode})`,
    `Temporary workspace cleanup: ${report.inputs.temporaryWorkspaceCleanedUp ? "yes" : "no"}`,
    "",
    "## Workspace",
    "",
    readinessLine("release gates", report.summaries.operatorWorkspace.releaseGates),
    readinessLine("operator evidence", report.summaries.operatorWorkspace.operatorEvidence),
    readinessLine("dogfood", report.summaries.operatorWorkspace.dogfood),
    readinessLine("security review", report.summaries.operatorWorkspace.securityReview),
    readinessLine("production cutover", report.summaries.operatorWorkspace.productionCutover),
    "",
    "## Rehearsed Checks",
    "",
    `- release candidate: ${report.summaries.releaseCandidate.ready ? "ready" : "not ready"}`,
    [
      "- dogfood readiness:",
      report.summaries.dogfoodReadiness.ready ? "ready" : "not ready",
      `(repository configs ${report.summaries.dogfoodReadiness.repositoryConfigs},`,
      `budget policies ${report.summaries.dogfoodReadiness.budgetPolicies},`,
      `model catalog ${report.summaries.dogfoodReadiness.modelCatalog},`,
      `workspace ${report.summaries.dogfoodReadiness.operatorWorkspace})`,
    ].join(" "),
    [
      "- dogfood promotion:",
      report.summaries.dogfoodPromotion.ready ? "ready" : "not ready",
      `(${report.summaries.dogfoodPromotion.summary.ok} ok,`,
      `${report.summaries.dogfoodPromotion.summary.warnings} warnings,`,
      `${report.summaries.dogfoodPromotion.summary.errors} errors)`,
    ].join(" "),
    `- dogfood go-live: ${report.summaries.dogfoodGoLive.ready ? "ready" : "not ready"}`,
    "",
    "## Go-Live Gates",
    "",
  ];
  for (const gate of report.summaries.dogfoodGoLive.gates) {
    lines.push(`- ${publicText(gate.id)}: ${publicText(gate.status)} - ${publicText(gate.detail)}`);
  }
  lines.push("", "## Next Commands", "");
  for (const command of report.nextCommands) {
    lines.push(`- ${publicText(command.label)}: \`${publicText(command.command)}\``);
  }
  return `${lines.join("\n")}\n`;
}

function operatorDrillNextCommands() {
  return [
    {
      label: "create private workspace",
      command: "npm run operator:workspace -- -- --dir <private-workspace-dir>",
    },
    {
      label: "run drill with private workspace",
      command: "npm --silent run operator:drill -- -- --dir <private-workspace-dir>",
    },
    {
      label: "release candidate",
      command: "npm --silent run release:candidate -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready --out <public-bundle-file.md> --quiet",
    },
    {
      label: "dogfood promotion",
      command: "npm --silent run dogfood:promotion -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready",
    },
    {
      label: "dogfood go-live",
      command: "npm --silent run dogfood:go-live -- -- --operator-workspace <private-workspace-dir> --strict-preflight --require-ready",
    },
  ];
}

function readinessLine(label, summary = {}) {
  return [
    `- ${publicText(label)}: ${summary.ready ? "ready" : "not ready"}`,
    `(${count(summary.complete)}/${count(summary.total)} complete,`,
    `${count(summary.deferred)} deferred,`,
    `${count(summary.pending)} pending,`,
    `${count(summary.blocked)} blocked)`,
  ].join(" ");
}

function count(value) {
  return Number.isFinite(value) ? value : 0;
}

function operatorWorkspaceFilePaths(directory) {
  return Object.fromEntries(
    Object.entries(DEFAULT_OPERATOR_WORKSPACE_FILES).map(([id, fileName]) => [
      id,
      path.join(directory, fileName),
    ])
  );
}

module.exports = {
  formatOperatorDrillMarkdown,
  operatorDrillNextCommands,
  operatorWorkspaceFilePaths,
  publicOperatorDrillReport,
  runOperatorDrill,
};
