"use strict";

const path = require("path");
const {
  collectDogfoodPromotionPacket,
} = require("./dogfood-promotion.cjs");
const {
  DEFAULT_OPERATOR_WORKSPACE_FILES,
  checkOperatorWorkspace,
  publicOperatorWorkspaceSummary,
} = require("./operator-workspace.cjs");
const {
  collectReleaseCandidateBundle,
  publicText,
} = require("./release-candidate.cjs");

function collectDogfoodGoLivePacket(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const now = options.now || new Date();
  const operatorWorkspaceDir = options.operatorWorkspaceDir
    ? path.resolve(options.operatorWorkspaceDir)
    : "";
  const workspacePaths = operatorWorkspaceDir
    ? operatorWorkspaceFilePaths(operatorWorkspaceDir)
    : {};
  const privatePathRoots = [
    ...(options.privatePathRoots || []),
    ...(operatorWorkspaceDir ? [operatorWorkspaceDir] : []),
  ];

  const operatorWorkspace = operatorWorkspaceDir
    ? publicOperatorWorkspaceSummary(
        checkOperatorWorkspace({
          directory: operatorWorkspaceDir,
          requireReady: false,
          repoRoot: root,
        })
      )
    : null;

  const releaseCandidate = collectReleaseCandidateBundle({
    env: options.env || process.env,
    gateStatusFile:
      options.gateStatusFile || workspacePaths.releaseGateStatus || "",
    gatesFile: options.gatesFile || "config/v0-release-gates.json",
    cutoverChecklistFile:
      options.cutoverChecklistFile || "config/production-cutover-checklist.json",
    cutoverStatusFile:
      options.cutoverStatusFile || workspacePaths.productionCutoverStatus || "",
    dogfoodChecklistFile:
      options.dogfoodChecklistFile || "config/dogfood-checklist.json",
    dogfoodStatusFile:
      options.dogfoodStatusFile || workspacePaths.dogfoodStatus || "",
    securityReviewChecklistFile:
      options.securityReviewChecklistFile ||
      "config/security-review-checklist.json",
    securityReviewStatusFile:
      options.securityReviewStatusFile ||
      workspacePaths.securityReviewStatus ||
      "",
    includeGitStatus: Boolean(options.includeGitStatus),
    now,
    operatorEvidenceFile:
      options.operatorEvidenceFile ||
      workspacePaths.operatorEvidence ||
      "config/production-evidence.example.json",
    preflightProfile: options.preflightProfile || "server",
    privatePathRoots,
    root,
    strictPreflight: Boolean(options.strictPreflight),
  });

  const promotion = collectDogfoodPromotionPacket({
    budgetPolicyFile: options.budgetPolicyFile,
    env: options.env || process.env,
    includePreflight: options.includePreflight !== false,
    mode: options.mode || "command-only",
    modelCatalogFile: options.modelCatalogFile,
    nodeBin: options.nodeBin,
    now,
    operatorWorkspaceDir,
    preflightProfile: options.preflightProfile || "server",
    readinessRepositoryConfigFiles: options.readinessRepositoryConfigFiles,
    repositoryConfigFile: options.repositoryConfigFile,
    requireOperatorWorkspaceReady: Boolean(
      options.requireOperatorWorkspaceReady
    ),
    root,
    selfDogfoodReplayRunner: options.selfDogfoodReplayRunner,
    skipSelfDogfoodReplay: Boolean(options.skipSelfDogfoodReplay),
    strictPreflight: Boolean(options.strictPreflight),
    targetRepository: options.targetRepository || "",
  });

  const gates = goLiveGates({
    operatorWorkspace,
    operatorWorkspaceIncluded: Boolean(operatorWorkspaceDir),
    promotion,
    releaseCandidate,
  });
  const ready = gates.every((gate) => gate.status === "ok");
  return {
    version: 1,
    generatedAt: now.toISOString(),
    ready,
    inputs: {
      operatorWorkspace: operatorWorkspaceDir ? "[operator-workspace]" : "",
      releaseCandidate: releaseCandidate.inputs,
      dogfoodPromotion: promotion.inputs,
      preflightProfile: publicText(options.preflightProfile || "server"),
      strictPreflight: Boolean(options.strictPreflight),
    },
    gates,
    summaries: {
      releaseCandidate: releaseCandidate.readiness,
      dogfoodPromotion: promotion.summary,
      operatorWorkspace: operatorWorkspace ? operatorWorkspace.summaries : null,
    },
    checks: {
      releaseCandidate,
      dogfoodPromotion: promotion,
      operatorWorkspace,
    },
    nextActions: nextActions(gates),
  };
}

function assertDogfoodGoLiveReady(packet) {
  if (!packet.inputs.strictPreflight || !packet.inputs.dogfoodPromotion.preflight) {
    throw new Error(
      "dogfood go-live packet requires strict preflight before it can be marked ready."
    );
  }
  if (!packet.ready) {
    const failing = packet.gates
      .filter((gate) => gate.status !== "ok")
      .map((gate) => gate.id)
      .join(", ");
    throw new Error(`dogfood go-live packet is not ready: ${failing}.`);
  }
  return packet;
}

function formatDogfoodGoLiveMarkdown(packet) {
  const lines = [
    "# 6529bot Dogfood Go-Live Packet",
    "",
    [
      "This packet is public-safe. It composes the release-candidate bundle,",
      "dogfood promotion packet, private operator workspace summaries, and",
      "production cutover readiness without printing secrets, live AWS",
      "identifiers, raw payloads, prompts, provider responses, or private",
      "workspace paths.",
    ].join(" "),
    "",
    `Go-live ready: ${packet.ready ? "yes" : "no"}`,
    `Generated: ${publicText(packet.generatedAt)}`,
    `Operator workspace: ${
      packet.inputs.operatorWorkspace || "not provided"
    }`,
    `Preflight: ${publicText(packet.inputs.preflightProfile)}${
      packet.inputs.strictPreflight ? " strict" : ""
    }`,
    "",
    "## Go-Live Gates",
    "",
    "| Gate | Status | Detail |",
    "| --- | --- | --- |",
  ];

  for (const gate of packet.gates) {
    lines.push(
      `| ${markdownCell(gate.title)} | ${markdownCell(gate.status)} | ${markdownCell(
        gate.detail
      )} |`
    );
  }

  lines.push(
    "",
    "## Release Candidate",
    "",
    readinessLine("release gates", packet.summaries.releaseCandidate.releaseGates),
    readinessLine(
      "operator evidence",
      packet.summaries.releaseCandidate.operatorEvidence
    )
  );
  if (packet.summaries.releaseCandidate.dogfood) {
    lines.push(
      readinessLine("dogfood", packet.summaries.releaseCandidate.dogfood)
    );
  }
  if (packet.summaries.releaseCandidate.securityReview) {
    lines.push(
      readinessLine(
        "security review",
        packet.summaries.releaseCandidate.securityReview
      )
    );
  }
  if (packet.summaries.releaseCandidate.productionCutover) {
    lines.push(
      readinessLine(
        "production cutover",
        packet.summaries.releaseCandidate.productionCutover
      )
    );
  }
  lines.push(
    [
      `- preflight: ${
        packet.summaries.releaseCandidate.preflight.ok ? "ready" : "not ready"
      }`,
      `(${packet.summaries.releaseCandidate.preflight.errors.length} errors,`,
      `${packet.summaries.releaseCandidate.preflight.warnings.length} warnings)`,
    ].join(" "),
    "",
    "## Dogfood Promotion",
    "",
    `- promotion ready: ${
      packet.checks.dogfoodPromotion.ready ? "yes" : "no"
    }`,
    `- promotion gates: ${packet.summaries.dogfoodPromotion.ok} ok, ${packet.summaries.dogfoodPromotion.warnings} warnings, ${packet.summaries.dogfoodPromotion.errors} errors`
  );

  if (packet.summaries.operatorWorkspace) {
    lines.push("", "## Operator Workspace", "");
    for (const [id, summary] of Object.entries(packet.summaries.operatorWorkspace)) {
      lines.push(readinessLine(id, summary));
    }
  }

  lines.push("", "## Next Actions", "");
  for (const action of packet.nextActions) {
    lines.push(`- ${publicText(action)}`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function goLiveGates(input) {
  return [
    gate(
      "operator-workspace",
      "Private operator workspace",
      workspaceStatus(input),
      workspaceDetail(input)
    ),
    gate(
      "release-candidate",
      "Release candidate bundle",
      input.releaseCandidate.ready ? "ok" : "error",
      input.releaseCandidate.ready
        ? "Release gates, operator evidence, selected overlays, and preflight are ready."
        : "Release-candidate bundle is not ready."
    ),
    gate(
      "dogfood-promotion",
      "Dogfood promotion packet",
      input.promotion.ready ? "ok" : "error",
      input.promotion.ready
        ? "Promotion packet is ready for command-only live traffic."
        : "Promotion packet is not ready."
    ),
    cutoverGate(input.releaseCandidate),
  ];
}

function cutoverGate(releaseCandidate) {
  const cutover = releaseCandidate.readiness.productionCutover;
  if (!cutover) {
    return gate(
      "production-cutover",
      "Production cutover overlay",
      "warning",
      "No production cutover status file was included."
    );
  }
  const missing = cutover.missingStatusIds || [];
  return gate(
    "production-cutover",
    "Production cutover overlay",
    cutover.ready && missing.length === 0 ? "ok" : "error",
    cutover.ready && missing.length === 0
      ? "Production cutover overlay is ready."
      : `${cutover.pending} pending, ${cutover.blocked} blocked, ${missing.length} missing status ids.`
  );
}

function workspaceStatus(input) {
  if (!input.operatorWorkspaceIncluded) {
    return "warning";
  }
  return input.operatorWorkspace && input.operatorWorkspace.ready ? "ok" : "error";
}

function workspaceDetail(input) {
  if (!input.operatorWorkspaceIncluded) {
    return "Run with --operator-workspace <private-workspace-dir> for live dogfood traffic.";
  }
  return input.operatorWorkspace.ready
    ? "All private workspace overlays are ready."
    : "Private workspace overlays are not ready.";
}

function nextActions(gates) {
  const actions = [];
  for (const item of gates) {
    if (item.status === "ok") {
      continue;
    }
    if (item.id === "operator-workspace") {
      actions.push(
        "Create or complete the private operator workspace, then rerun dogfood:go-live with --operator-workspace <private-workspace-dir>."
      );
    } else if (item.id === "release-candidate") {
      actions.push(
        "Run release:candidate from the same operator workspace and resolve pending, blocked, or missing release evidence."
      );
    } else if (item.id === "dogfood-promotion") {
      actions.push(
        "Run dogfood:promotion with the same operator workspace and strict preflight, then resolve any promotion gate failures."
      );
    } else if (item.id === "production-cutover") {
      actions.push(
        "Run production:cutover with the private cutover status file and complete, defer, or document every required item."
      );
    }
  }
  if (!actions.length) {
    actions.push(
      "Record the go-live packet in private dogfood evidence, then enable command-only live traffic with conservative budgets."
    );
  }
  return actions;
}

function readinessLine(label, summary) {
  const missing = summary.missingStatusIds || [];
  const ready = summary.ready && missing.length === 0;
  return [
    `- ${publicText(label)}: ${ready ? "ready" : "not ready"}`,
    `(${summary.complete}/${summary.total} complete,`,
    `${summary.deferred} deferred,`,
    `${summary.pending} pending,`,
    `${summary.blocked} blocked,`,
    `${missing.length} missing)`,
  ].join(" ");
}

function operatorWorkspaceFilePaths(directory) {
  return Object.fromEntries(
    Object.entries(DEFAULT_OPERATOR_WORKSPACE_FILES).map(([id, fileName]) => [
      id,
      path.join(directory, fileName),
    ])
  );
}

function gate(id, title, status, detail) {
  return {
    id,
    title,
    status,
    detail: publicText(detail),
  };
}

function markdownCell(value) {
  return publicText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

module.exports = {
  assertDogfoodGoLiveReady,
  collectDogfoodGoLivePacket,
  formatDogfoodGoLiveMarkdown,
  operatorWorkspaceFilePaths,
};
