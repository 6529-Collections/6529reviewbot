"use strict";

const fs = require("fs");
const path = require("path");
const { safeErrorLine } = require("./diagnostics.cjs");
const {
  REVIEW_KIND_CONFIGS,
  buildComment,
  commentMarker,
  postComment,
  stripReviewBotMetadata,
  truncate,
} = require("./review-bot.cjs");
const {
  GITHUB_ACTIONS_REVIEW_LANE,
  RESPONSIVENESS_REVIEW_KIND,
} = require("./review-job.cjs");
const {
  runControlLedgerSettingsFromEnv,
  updateRunClaimStatus,
} = require("./run-control-ledger.cjs");
const {
  usageLedgerSettingsFromEnv,
  writeUsageEvent,
} = require("./usage-ledger.cjs");

const DEFAULT_ESTIMATED_COST_USD = 1;
const MAX_SUMMARY_CHARS = 25000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const settings = readSettings(args);
  const job = jobFromSettings(settings);
  updateRunStatus(settings, job, "running", {
    worker: "responsiveness-review",
    workflowRunId: settings.workflowRunId,
  });

  try {
    const artifacts = readArtifacts(settings);
    const pr = readPr(settings, artifacts);
    const headSha = settings.headSha || artifacts.plan.headRef || "";
    const shortSha = shortHeadSha(headSha);
    const changedFiles = artifacts.plan.changedFiles || [];
    const modelBody = buildVisibleBody(settings, artifacts);
    const commentBody = buildComment({
      kind: RESPONSIVENESS_REVIEW_KIND,
      config: REVIEW_KIND_CONFIGS[RESPONSIVENESS_REVIEW_KIND],
      settings,
      pr,
      headSha,
      shortSha,
      changedFiles,
      changedLineCount: 0,
      modelBody,
    });

    if (settings.dryRun || settings.printComment) {
      process.stdout.write(`${commentBody}\n`);
    } else {
      postComment(settings, commentBody);
    }

    recordUsage(settings, {
      pr,
      headSha,
      changedFiles,
      artifacts,
      marker: commentMarker(RESPONSIVENESS_REVIEW_KIND, settings, shortSha),
    });
    updateRunStatus(settings, job, "completed", {
      worker: "responsiveness-review",
      verdict: artifacts.verdict,
      exitCode: artifacts.exitCode,
      checksCompleted: artifacts.metrics.checksCompleted,
      failures: artifacts.metrics.failures,
      warnings: artifacts.metrics.warnings,
      marker: commentMarker(RESPONSIVENESS_REVIEW_KIND, settings, shortSha),
    });
  } catch (error) {
    updateRunStatus(settings, job, "failed", {
      worker: "responsiveness-review",
      error: safeErrorLine(error),
    });
    throw error;
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (inlineValue !== undefined) {
      result[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      result[key] = argv[index + 1];
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

function readSettings(args, env = process.env) {
  const workspace = path.resolve(
    args.workspace ||
      env.REVIEWBOT_RESPONSIVENESS_WORKSPACE ||
      env.REVIEW_WORKSPACE ||
      ".reviewbot-responsiveness"
  );
  return {
    repo: args.repo || env.GH_REPO || env.TARGET_REPO || env.GITHUB_REPOSITORY || "",
    prNumber: String(args.prNumber || env.PR_NUMBER || env.GITHUB_PR_NUMBER || ""),
    headSha: args.headSha || env.PR_HEAD_SHA || "",
    provider: GITHUB_ACTIONS_REVIEW_LANE.provider,
    model: GITHUB_ACTIONS_REVIEW_LANE.model,
    lane: GITHUB_ACTIONS_REVIEW_LANE.lane,
    requestor: args.requestor || env.REVIEWBOT_REQUESTOR || "",
    workflowRunId: args.workflowRunId || env.GITHUB_RUN_ID || "",
    workflowJob: args.workflowJob || env.REVIEWBOT_WORKFLOW_JOB || "responsiveness-review",
    workflowRunUrl:
      args.workflowRunUrl ||
      workflowRunUrl(env.GITHUB_SERVER_URL, env.GITHUB_REPOSITORY, env.GITHUB_RUN_ID),
    artifactUrl: safeGitHubArtifactUrl(
      args.artifactUrl || env.REVIEWBOT_RESPONSIVENESS_ARTIFACT_URL || ""
    ),
    jobId: args.jobId || env.REVIEWBOT_JOB_ID || "",
    runKey: args.runKey || env.REVIEWBOT_RUN_KEY || "",
    workspace,
    summaryPath: path.resolve(args.summary || path.join(workspace, "summary.md")),
    planPath: path.resolve(args.plan || path.join(workspace, "plan.json")),
    prJsonPath: path.resolve(args.prJson || path.join(workspace, "pr.json")),
    exitCodePath: path.resolve(args.exitCode || path.join(workspace, "exit-code.txt")),
    usageLedger: usageLedgerSettingsFromEnv(env),
    runControlLedger: runControlLedgerSettingsFromEnv(env),
    estimatedCostUsd: nonNegativeNumber(
      args.estimatedCostUsd ||
        env.REVIEWBOT_RESPONSIVENESS_ESTIMATED_COST_USD ||
        env.REVIEWBOT_GITHUB_ACTIONS_ESTIMATED_COST_USD ||
        env.REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD ||
        DEFAULT_ESTIMATED_COST_USD,
      "estimated responsiveness cost"
    ),
    dryRun: Boolean(args.dryRun),
    printComment: Boolean(args.printComment),
  };
}

function workflowRunUrl(serverUrl, repository, runId) {
  if (!serverUrl || !repository || !runId) {
    return "";
  }
  return `${String(serverUrl).replace(/\/+$/, "")}/${repository}/actions/runs/${runId}`;
}

function jobFromSettings(settings) {
  return {
    id: settings.jobId,
    runKey: settings.runKey,
    reviewKind: RESPONSIVENESS_REVIEW_KIND,
    provider: settings.provider,
    model: settings.model,
    lane: settings.lane,
  };
}

function updateRunStatus(settings, job, status, metadata) {
  if (!settings.runControlLedger.enabled || !job.id || !job.runKey) {
    return;
  }
  const result = updateRunClaimStatus(settings.runControlLedger, job, status, {
    metadata,
  });
  if (result.error) {
    console.warn(`run-control update failed: ${safeErrorLine(result.error)}`);
  }
}

function readArtifacts(settings) {
  const summary = readText(settings.summaryPath);
  const plan = readJson(settings.planPath) || emptyPlan();
  const exitCode = readExitCode(settings.exitCodePath);
  const metrics = metricsFromSummary(summary, plan);
  const verdict = verdictFromArtifacts(summary, exitCode);
  return {
    summary,
    plan,
    exitCode,
    metrics,
    verdict,
  };
}

function readPr(settings, artifacts) {
  const prJson = readJson(settings.prJsonPath);
  return {
    number: Number(prJson?.number || settings.prNumber || 0),
    title: prJson?.title || "",
    author: prJson?.user?.login ? { login: prJson.user.login } : null,
    baseRefName: prJson?.base?.ref || "",
    headRefName: prJson?.head?.ref || artifacts.plan.headRef || "",
  };
}

function buildVisibleBody(settings, artifacts) {
  const workflowLine = settings.workflowRunUrl
    ? `- Workflow: [${settings.workflowJob} #${settings.workflowRunId}](${settings.workflowRunUrl})`
    : `- Workflow: ${settings.workflowJob}`;
  const lines = [
    `**Verdict**: ${artifacts.verdict}`,
    "",
    workflowLine,
    `- Contexts: ${inlineList(contextNames(artifacts.plan)) || "none"}`,
    `- Routes: ${inlineList(artifacts.plan.routes || []) || "none"}`,
    `- Checks completed: ${artifacts.metrics.checksCompleted}`,
    `- Failures: ${artifacts.metrics.failures}`,
    `- Warnings: ${artifacts.metrics.warnings}`,
  ];
  if (settings.artifactUrl) {
    lines.splice(3, 0, `- Screenshots: [responsiveness artifact](${settings.artifactUrl})`);
  }

  if (!artifacts.summary) {
    lines.push(
      "",
      "The responsiveness workflow did not produce a runner summary. Check the linked workflow run for checkout, dependency install, or Playwright setup failures."
    );
    return lines.join("\n");
  }

  const summary = sanitizeSummary(artifacts.summary, {
    artifactUrl: settings.artifactUrl,
  });
  lines.push(
    "",
    "<details>",
    "<summary>Responsiveness runner summary</summary>",
    "",
    summary,
    "",
    "</details>"
  );
  return lines.join("\n");
}

function recordUsage(settings, input) {
  writeUsageEvent(
    settings.usageLedger,
    {
      repoFullName: settings.repo,
      prNumber: Number(input.pr.number || settings.prNumber),
      prAuthor: input.pr.author?.login || "",
      prHeadSha: input.headSha,
      workflowRunId: settings.workflowRunId,
      workflowJob: settings.workflowJob,
      reviewKind: RESPONSIVENESS_REVIEW_KIND,
      provider: settings.provider,
      model: settings.model,
      lane: settings.lane,
      requestId: settings.jobId,
      providerResponseId: settings.runKey,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: settings.estimatedCostUsd,
      currency: "USD",
      budgetSkipped: false,
      metadata: {
        requestor: settings.requestor,
        changedFiles: input.changedFiles.length,
        checksCompleted: input.artifacts.metrics.checksCompleted,
        failures: input.artifacts.metrics.failures,
        warnings: input.artifacts.metrics.warnings,
        exitCode: input.artifacts.exitCode,
        marker: input.marker,
        workflowRunUrl: settings.workflowRunUrl,
      },
    },
    console.warn
  );
}

function verdictFromArtifacts(summary, exitCode) {
  if (!summary) {
    return "Review did not run";
  }
  if (/^Status:\s*pass\s*$/im.test(summary) && exitCode === 0) {
    return REVIEW_KIND_CONFIGS[RESPONSIVENESS_REVIEW_KIND].cleanVerdict;
  }
  return "Needs changes";
}

function metricsFromSummary(summary, plan) {
  const expected = (plan.routes || []).length * (plan.contexts || []).length;
  return {
    checksCompleted: summaryValue(summary, "Checks completed") || `0/${expected}`,
    failures: Number(summaryValue(summary, "Failures") || 0),
    warnings: Number(summaryValue(summary, "Warnings") || 0),
  };
}

function summaryValue(summary, label) {
  if (!summary) {
    return "";
  }
  const match = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, "im").exec(summary);
  return match ? match[1].trim() : "";
}

function emptyPlan() {
  return {
    target: "",
    baseRef: "",
    headRef: "",
    contexts: [],
    routes: [],
    changedFiles: [],
  };
}

function contextNames(plan) {
  return (plan.contexts || []).map((context) =>
    typeof context === "string" ? context : context.name
  );
}

function inlineList(items) {
  return (items || []).filter(Boolean).map((item) => `\`${item}\``).join(", ");
}

function sanitizeSummary(summary, options = {}) {
  const clean = truncate(
    stripReviewBotMetadata(String(summary || "")).trim(),
    MAX_SUMMARY_CHARS
  );
  return linkScreenshotPaths(clean, options.artifactUrl);
}

function linkScreenshotPaths(summary, artifactUrl) {
  const url = safeGitHubArtifactUrl(artifactUrl);
  if (!url) {
    return summary;
  }
  return String(summary || "").replace(
    /screenshot `((?:screenshots\/)[^`\r\n]+\.png)`/g,
    (_match, screenshotPath) => `screenshot [\`${screenshotPath}\`](${url})`
  );
}

function safeGitHubArtifactUrl(value) {
  const url = String(value || "").trim();
  if (!url) {
    return "";
  }
  if (
    !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+\/artifacts\/\d+(?:[?#][^\s]*)?$/.test(
      url
    )
  ) {
    return "";
  }
  return url;
}

function readText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readJson(file) {
  const text = readText(file);
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readExitCode(file) {
  const text = readText(file).trim();
  if (!/^-?\d+$/.test(text)) {
    return 1;
  }
  return Number.parseInt(text, 10);
}

function shortHeadSha(headSha) {
  return String(headSha || "unknown").slice(0, 12);
}

function nonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(safeErrorLine(error));
    process.exit(1);
  });
}

module.exports = {
  buildVisibleBody,
  linkScreenshotPaths,
  main,
  metricsFromSummary,
  readArtifacts,
  readSettings,
  safeGitHubArtifactUrl,
  sanitizeSummary,
  verdictFromArtifacts,
};
