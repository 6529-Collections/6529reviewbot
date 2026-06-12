"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { redactSensitiveText } = require("./diagnostics.cjs");
const {
  assertReleaseGatesReady,
  loadReleaseGateStatus,
  loadReleaseGates,
  mergeReleaseGateStatus,
  missingReleaseGateStatusIds,
  summarizeReleaseGates,
} = require("./release-gates.cjs");
const {
  assertOperatorEvidenceReady,
  loadOperatorEvidence,
  publicOperatorEvidenceDocument,
  summarizeOperatorEvidence,
} = require("./operator-evidence.cjs");
const { runPreflight } = require("./preflight.cjs");
const packageJson = require("../package.json");

const RELEASE_CANDIDATE_TEXT_MAX_CHARS = 1000;
const RELEASE_CANDIDATE_GIT_MAX_CHARS = 4000;
const PUBLIC_REDACTION_PATTERNS = [
  [/\barn:aws[a-z-]*:[^\s"'`,)]+/gi, "arn:aws:[redacted]"],
  [/\b\d{12}\b/g, "[redacted-aws-account-id]"],
];

function collectReleaseCandidateBundle(options = {}) {
  const now = options.now || new Date();
  const root = options.root || process.cwd();
  const gatesFile = options.gatesFile || "config/v0-release-gates.json";
  const operatorEvidenceFile =
    options.operatorEvidenceFile || "config/production-evidence.example.json";
  const gateStatusFile = options.gateStatusFile || "";

  const gates = loadReleaseGates(gatesFile);
  const gateStatus = gateStatusFile ? loadReleaseGateStatus(gateStatusFile) : null;
  const missingGateStatusIds = gateStatus
    ? missingReleaseGateStatusIds(gates, gateStatus)
    : gates.gates.map((gate) => gate.id);
  const mergedGates = gateStatus ? mergeReleaseGateStatus(gates, gateStatus) : gates;
  const releaseGateSummary = summarizeReleaseGates(mergedGates);

  const operatorEvidence = loadOperatorEvidence(operatorEvidenceFile);
  const operatorEvidenceSummary = summarizeOperatorEvidence(operatorEvidence);
  const preflight = preflightSummary(
    runPreflight({
      env: options.env || process.env,
      now,
      profile: options.preflightProfile || "server",
      strict: Boolean(options.strictPreflight),
    }),
    Boolean(options.strictPreflight)
  );
  const ready =
    releaseGateSummary.ready &&
    missingGateStatusIds.length === 0 &&
    operatorEvidenceSummary.ready &&
    preflight.ok;

  const bundle = {
    version: 1,
    generatedAt: now.toISOString(),
    release: publicText(releaseGateSummary.release || operatorEvidenceSummary.release),
    package: {
      name: publicText(packageJson.name),
      version: publicText(packageJson.version),
    },
    git: gitInfo(options),
    inputs: {
      releaseGatesFile: publicPath(gatesFile, root),
      releaseGateStatusFile: gateStatusFile ? publicPath(gateStatusFile, root) : "",
      operatorEvidenceFile: publicPath(operatorEvidenceFile, root),
      preflightProfile: preflight.profile,
      strictPreflight: preflight.strict,
    },
    ready,
    readiness: {
      releaseGates: {
        ...releaseGateSummary,
        missingStatusIds: missingGateStatusIds.map((id) => publicText(id)),
      },
      operatorEvidence: operatorEvidenceSummary,
      preflight,
    },
    publicEvidence: {
      operatorEvidence: publicOperatorEvidenceDocument(operatorEvidence),
    },
    commands: releaseCandidateCommands(),
  };

  if (options.requireReady) {
    if (missingGateStatusIds.length) {
      throw new Error(
        [
          "release candidate gate status is missing",
          `${missingGateStatusIds.length} current gate(s):`,
          `${missingGateStatusIds.join(", ")}.`,
        ].join(" ")
      );
    }
    assertReleaseGatesReady(mergedGates);
    assertOperatorEvidenceReady(operatorEvidence);
    if (!preflight.ok) {
      throw new Error(
        [
          "release candidate preflight is not ready:",
          `${preflight.errors.length} error(s),`,
          `${preflight.warnings.length} warning(s).`,
        ].join(" ")
      );
    }
  }

  return bundle;
}

function preflightSummary(result, strict) {
  return {
    ok: Boolean(result.ok),
    profile: publicText(result.profile || "server"),
    strict: Boolean(strict),
    checks: Array.isArray(result.checks) ? result.checks.length : 0,
    errors: safeMessages(result.errors),
    warnings: safeMessages(result.warnings),
  };
}

function formatReleaseCandidateBundleMarkdown(bundle) {
  const lines = [
    "# 6529reviewbot Release Candidate Bundle",
    "",
    [
      "This bundle is public-safe. It summarizes release readiness without raw secrets,",
      "live AWS identifiers, provider responses, or private evidence payloads.",
    ].join(" "),
    "",
    "## Candidate",
    "",
    `- release: ${publicText(bundle.release)}`,
    `- ready: ${bundle.ready ? "yes" : "no"}`,
    `- generatedAt: ${publicText(bundle.generatedAt)}`,
    `- package: ${publicText(bundle.package.name)}@${publicText(bundle.package.version)}`,
    `- git: ${publicText(bundle.git.branch || "unknown")} ${publicText(
      bundle.git.commit || "unknown"
    )}`,
    "",
    "## Inputs",
    "",
    `- release gates: ${publicText(bundle.inputs.releaseGatesFile)}`,
    `- release gate status: ${publicText(bundle.inputs.releaseGateStatusFile || "not provided")}`,
    `- operator evidence: ${publicText(bundle.inputs.operatorEvidenceFile)}`,
    `- preflight: ${publicText(bundle.inputs.preflightProfile)}${
      bundle.inputs.strictPreflight ? " strict" : ""
    }`,
    "",
    "## Readiness",
    "",
    readinessLine("release gates", bundle.readiness.releaseGates),
    readinessLine("operator evidence", bundle.readiness.operatorEvidence),
    [
      `- preflight: ${bundle.readiness.preflight.ok ? "ready" : "not ready"}`,
      `(${bundle.readiness.preflight.errors.length} errors,`,
      `${bundle.readiness.preflight.warnings.length} warnings)`,
    ].join(" "),
    `- missing gate status ids: ${idList(bundle.readiness.releaseGates.missingStatusIds)}`,
    "",
    "## Preflight Errors",
    "",
    ...markdownMessages(bundle.readiness.preflight.errors),
    "",
    "## Preflight Warnings",
    "",
    ...markdownMessages(bundle.readiness.preflight.warnings),
    "",
    "## Operator Evidence Sections",
    "",
  ];

  for (const section of bundle.publicEvidence.operatorEvidence.sections) {
    const checkbox = section.status === "complete" ? "x" : " ";
    lines.push(
      `- [${checkbox}] **${publicText(section.id)}** _(${publicText(section.status)})_: ${publicText(section.title)}`
    );
    if (section.notes) {
      lines.push(`  Notes: ${publicText(section.notes)}`);
    }
    for (const item of section.evidence || []) {
      lines.push(`  Evidence: ${publicText(item)}`);
    }
  }

  lines.push("", "## Commands", "");
  for (const command of bundle.commands) {
    lines.push(`- ${publicText(command.label)}: \`${publicText(command.command)}\``);
  }
  return `${lines.join("\n")}\n`;
}

function readinessLine(label, summary) {
  const ready = summary.ready && (!summary.missingStatusIds || summary.missingStatusIds.length === 0);
  return [
    `- ${label}: ${ready ? "ready" : "not ready"}`,
    `(${summary.complete}/${summary.total} complete,`,
    `${summary.deferred} deferred,`,
    `${summary.pending} pending,`,
    `${summary.blocked} blocked)`,
  ].join(" ");
}

function releaseCandidateCommands() {
  return [
    {
      label: "release candidate bundle",
      command: [
        "npm run release:candidate -- --",
        "--status-file <operator-status-file>",
        "--operator-evidence-file <private-evidence-file>",
      ].join(" "),
    },
    { label: "release check", command: "npm run release:check" },
    {
      label: "release gate summary",
      command: "npm run v0:gates -- -- --status-file <operator-status-file> --summary",
    },
    {
      label: "release gate readiness",
      command: "npm run v0:gates -- -- --status-file <operator-status-file> --require-ready",
    },
    {
      label: "operator evidence summary",
      command: "npm run operator:evidence -- -- --file <private-evidence-file> --summary",
    },
    {
      label: "operator evidence readiness",
      command: "npm run operator:evidence -- -- --file <private-evidence-file> --require-ready",
    },
    { label: "production preflight", command: "npm run preflight -- -- --strict" },
  ];
}

function safeMessages(messages) {
  return (messages || []).map((item) => ({
    name: publicText(item.name),
    message: publicText(item.message),
  }));
}

function markdownMessages(messages) {
  if (!messages || messages.length === 0) {
    return ["- none"];
  }
  return messages.map((item) => `- ${publicText(item.name)}: ${publicText(item.message)}`);
}

function idList(ids) {
  if (!ids || ids.length === 0) {
    return "none";
  }
  return ids.map((id) => publicText(id)).join(", ");
}

function gitInfo(options = {}) {
  const run = options.execFileSync || execFileSync;
  const command = options.gitBin || gitBin();
  const info = {
    commit: safeGit(run, command, ["rev-parse", "--short=12", "HEAD"]),
    branch: safeGit(run, command, ["branch", "--show-current"]),
  };
  if (options.includeGitStatus) {
    info.status = safeGit(run, command, ["status", "--short"], RELEASE_CANDIDATE_GIT_MAX_CHARS);
  }
  return info;
}

function safeGit(run, command, args, maxChars = RELEASE_CANDIDATE_TEXT_MAX_CHARS) {
  try {
    const output = String(
      run(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    ).trim();
    return publicText(output, maxChars);
  } catch {
    return "";
  }
}

function gitBin() {
  if (process.env.GIT_BIN) {
    return process.env.GIT_BIN;
  }
  const windowsGit = "C:\\Program Files\\Git\\cmd\\git.exe";
  if (process.platform === "win32" && fs.existsSync(windowsGit)) {
    return windowsGit;
  }
  return "git";
}

function publicPath(filePath, root) {
  const resolved = path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "[external-path-set]";
  }
  return publicText(relative.split(path.sep).join("/"));
}

function publicText(value, maxChars = RELEASE_CANDIDATE_TEXT_MAX_CHARS) {
  let text = redactSensitiveText(value);
  for (const [pattern, replacement] of PUBLIC_REDACTION_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.slice(0, maxChars);
}

module.exports = {
  collectReleaseCandidateBundle,
  formatReleaseCandidateBundleMarkdown,
  preflightSummary,
  publicText,
};
