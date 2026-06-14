"use strict";

const fs = require("fs");
const path = require("path");
const { redactSensitiveText } = require("./diagnostics.cjs");
const { parseRepositoryConfigText } = require("./repository-config.cjs");

const DEFAULT_COMMAND_ONLY_CONFIG = "templates/dogfood-command-only-config.yml";
const DEFAULT_LIMITED_INITIAL_CONFIG = "templates/dogfood-repository-config.yml";
const DOGFOOD_TARGET_MODES = ["auto", "command-only", "limited-initial"];
const ALL_REVIEW_KINDS = ["general", "followup", "wcag", "i18n", "security"];
const DOGFOOD_TARGET_TEXT_MAX_CHARS = 1000;

function collectDogfoodTargetPacket(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const requestedMode = modeField(options.mode || "command-only");
  const configFile = options.repositoryConfigFile || defaultConfigForMode(requestedMode);
  const absoluteConfigFile = path.resolve(root, configFile);
  const text = readConfigText(absoluteConfigFile, root);
  const config = parseRepositoryConfigText(text, configFile);
  const inferredMode = inferDogfoodMode(config);
  const mode = requestedMode === "auto" ? inferredMode : requestedMode;
  const checks = [
    check("config-parses", "Repository config parses", "ok", "Config loaded and normalized."),
    modeCheck(requestedMode, inferredMode),
    enabledCheck(config),
    commandsCheck(config),
    reviewKindsCheck(config, mode),
    lanesCheck(config),
    limitsCheck(config, mode),
    admissionCheck(config),
    budgetCheck(config),
  ];
  const summary = summarizeChecks(checks);

  return {
    version: 1,
    ready: summary.errors === 0,
    mode,
    requestedMode,
    inferredMode,
    targetRepository: safeTargetRepository(options.targetRepository || ""),
    configFile: publicConfigPath(absoluteConfigFile, root),
    checks,
    summary,
    prChecklist: prChecklist(mode),
  };
}

function formatDogfoodTargetMarkdown(packet) {
  const lines = [
    "# Dogfood Target Packet",
    "",
    "Use this packet before opening or updating a target repository PR that adds",
    "`.github/6529bot.yml`.",
    "",
    `Target repository: ${packet.targetRepository ? `\`${publicLine(packet.targetRepository)}\`` : "not specified"}`,
    `Mode: \`${publicLine(packet.mode)}\``,
    `Config: \`${publicLine(packet.configFile)}\``,
    `Ready for target config PR: ${packet.ready ? "yes" : "no"}`,
    "",
    "## Checks",
    "",
    "| Check | Status | Detail |",
    "| --- | --- | --- |",
  ];
  for (const checkResult of packet.checks) {
    lines.push(
      `| ${markdownCell(checkResult.title)} | ${checkResult.status} | ${markdownCell(checkResult.detail)} |`
    );
  }
  lines.push("", "## Target PR Checklist", "");
  for (const item of packet.prChecklist) {
    lines.push(`- ${publicLine(item)}`);
  }
  lines.push(
    "",
    "## First Trigger Plan",
    "",
    "- Merge the target config to the target repository base branch before trusting it for spend decisions.",
    "- Keep the central worker in `noop` or command-only posture until webhook delivery, budget admission, run-control, usage rows, and alerts are observed.",
    "- Start with trusted maintainer comment commands, then move to limited initial reviews only after the private dogfood status file records evidence.",
    "",
    "This packet is public-safe when the repository name is intentionally public. It does not read target repository code, credentials, provider responses, webhook payloads, or private operator status files."
  );
  return `${lines.join("\n").trimEnd()}\n`;
}

function assertDogfoodTargetReady(packet) {
  if (!packet.ready) {
    throw new Error(`dogfood target packet is not ready: ${packet.summary.errors} errors.`);
  }
  return packet;
}

function readConfigText(filePath, root) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read repository config ${publicConfigPath(filePath, root)}.`);
  }
}

function defaultConfigForMode(mode) {
  if (mode === "limited-initial") {
    return DEFAULT_LIMITED_INITIAL_CONFIG;
  }
  return DEFAULT_COMMAND_ONLY_CONFIG;
}

function inferDogfoodMode(config) {
  const initialCount = config.reviewKinds.initial.length;
  const followupCount = config.reviewKinds.followup.length;
  if (initialCount === 0 && followupCount === 0) {
    return "command-only";
  }
  return "limited-initial";
}

function modeCheck(requestedMode, inferredMode) {
  if (requestedMode === "auto" || requestedMode === inferredMode) {
    return check(
      "mode",
      "Requested mode matches config",
      "ok",
      requestedMode === "auto"
        ? `Auto-detected ${inferredMode}.`
        : `Config matches ${requestedMode}.`
    );
  }
  return check(
    "mode",
    "Requested mode matches config",
    "error",
    `Requested ${requestedMode}, but config looks like ${inferredMode}.`
  );
}

function enabledCheck(config) {
  return config.enabled === true
    ? check("enabled", "Bot enabled", "ok", "Target config enables 6529bot.")
    : check("enabled", "Bot enabled", "error", "Target config disables 6529bot.");
}

function commandsCheck(config) {
  return config.commands.enabled === true
    ? check("commands", "Maintainer commands enabled", "ok", "Trusted maintainers can trigger reviews by comment.")
    : check("commands", "Maintainer commands enabled", "error", "Comment commands are disabled.");
}

function reviewKindsCheck(config, mode) {
  const allowed = config.reviewKinds.allowed || [];
  const missingAllowed = ALL_REVIEW_KINDS.filter((kind) => !allowed.includes(kind));
  if (missingAllowed.length) {
    return check(
      "review-kinds",
      "Review kinds",
      "warning",
      `Allowed review kinds omit ${missingAllowed.join(", ")}.`
    );
  }
  if (mode === "command-only") {
    const initialEmpty = config.reviewKinds.initial.length === 0;
    const followupEmpty = config.reviewKinds.followup.length === 0;
    return initialEmpty && followupEmpty
      ? check("review-kinds", "Review kinds", "ok", "Initial and follow-up auto reviews are disabled.")
      : check("review-kinds", "Review kinds", "error", "Command-only mode must disable initial and follow-up auto reviews.");
  }
  const initial = config.reviewKinds.initial || [];
  const followup = config.reviewKinds.followup || [];
  const hasInitialCore = initial.includes("general") && initial.includes("security");
  const hasFollowup = followup.includes("followup");
  if (!hasInitialCore || !hasFollowup) {
    return check(
      "review-kinds",
      "Review kinds",
      "error",
      "Limited initial mode should include general + security initial reviews and follow-up review."
    );
  }
  return check(
    "review-kinds",
    "Review kinds",
    "ok",
    `Initial: ${initial.join(", ")}; follow-up: ${followup.join(", ")}.`
  );
}

function lanesCheck(config) {
  const lanes = config.lanes || [];
  if (lanes.length === 0) {
    return check("lanes", "Provider/model lanes", "error", "No explicit provider/model lane is configured.");
  }
  if (lanes.length > 1) {
    return check(
      "lanes",
      "Provider/model lanes",
      "warning",
      `Multiple lanes configured (${lanes.length}); keep first dogfood traffic to one lane unless explicitly reviewed.`
    );
  }
  return check("lanes", "Provider/model lanes", "ok", lanes.map(laneSummary).join(", "));
}

function limitsCheck(config, mode) {
  const maxJobs = config.limits.maxJobsPerDelivery;
  const recommendedMax = mode === "command-only" ? 2 : 4;
  if (!maxJobs) {
    return check("limits", "Max jobs per delivery", "error", "No maxJobsPerDelivery cap is configured.");
  }
  if (maxJobs > recommendedMax) {
    return check(
      "limits",
      "Max jobs per delivery",
      "error",
      `${maxJobs} exceeds the recommended ${recommendedMax} cap for ${mode} dogfood.`
    );
  }
  return check("limits", "Max jobs per delivery", "ok", `${maxJobs} jobs per delivery.`);
}

function admissionCheck(config) {
  const admission = config.admission || {};
  const errors = [];
  if (admission.publicRepoMode !== "trusted") {
    errors.push("publicRepoMode should be trusted");
  }
  if (admission.draftPrMode !== "skip") {
    errors.push("draftPrMode should be skip");
  }
  if (!["write", "maintain", "admin"].includes(admission.trustedPermission || "")) {
    errors.push("trustedPermission should be write, maintain, or admin");
  }
  return errors.length
    ? check("admission", "Admission policy", "error", errors.join("; "))
    : check("admission", "Admission policy", "ok", "Public repos require trusted actors and draft PRs are skipped.");
}

function budgetCheck(config) {
  const budget = config.budget || {};
  const missing = [];
  if (budget.mode !== "enforce") {
    missing.push("budget.mode must be enforce");
  }
  if (!(budget.defaultEstimatedCostUsd > 0)) {
    missing.push("defaultEstimatedCostUsd must be positive");
  }
  for (const scope of ["repo", "requestor", "pr", "review_kind"]) {
    if (!(budget.caps?.[scope]?.dailyBudgetUsd > 0)) {
      missing.push(`${scope}.dailyUsd cap`);
    }
  }
  return missing.length
    ? check("budget", "Budget controls", "error", `Missing or unsafe: ${missing.join(", ")}.`)
    : check("budget", "Budget controls", "ok", "Enforced daily repo, requestor, PR, and review-kind caps are present.");
}

function prChecklist(mode) {
  const items = [
    "Add `.github/6529bot.yml` from the reviewed config file.",
    "Confirm the config PR does not add provider keys, AWS credentials, GitHub App secrets, or bot implementation code to the target repo.",
    "Confirm the GitHub App is installed on the target repo and central runtime pauses are in the intended dogfood posture.",
    "Confirm central budget policies, run-control mode, usage ledger writes, and operator alerts are ready before any model call.",
  ];
  if (mode === "command-only") {
    items.push("Use trusted maintainer comment commands for the first trigger; do not enable initial PR automation yet.");
  } else {
    items.push("Limit initial automation to the configured review kinds and keep the command-only dogfood evidence linked in the private status file.");
  }
  items.push("Record command-only or limited-initial evidence in the private dogfood status overlay after the first trigger.");
  return items;
}

function check(id, title, status, detail) {
  return {
    id,
    title,
    status,
    detail: publicText(detail, 500),
  };
}

function summarizeChecks(checks) {
  const counts = { ok: 0, warning: 0, error: 0 };
  for (const item of checks) {
    counts[item.status] += 1;
  }
  return {
    ok: counts.ok,
    warnings: counts.warning,
    errors: counts.error,
  };
}

function laneSummary(lane) {
  return `${lane.provider}:${lane.model || "default"}`;
}

function safeTargetRepository(value) {
  const text = publicText(String(value || "").trim(), 200);
  if (!text) {
    return "";
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text)) {
    throw new Error("--repository must use owner/name form.");
  }
  return text;
}

function publicConfigPath(filePath, root) {
  const relative = path.relative(root, filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return normalizeSlashes(relative);
  }
  const baseName = path.basename(filePath) || "repository-config.yml";
  return `[external-config]/${publicText(baseName, 120)}`;
}

function modeField(value) {
  if (!DOGFOOD_TARGET_MODES.includes(value)) {
    throw new Error(`mode must be one of ${DOGFOOD_TARGET_MODES.join(", ")}.`);
  }
  return value;
}

function markdownCell(value) {
  return publicText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, "/");
}

function publicText(value, maxChars = DOGFOOD_TARGET_TEXT_MAX_CHARS) {
  return redactSensitiveText(String(value || "")).slice(0, maxChars);
}

function publicLine(value, maxChars = DOGFOOD_TARGET_TEXT_MAX_CHARS) {
  return publicText(value, maxChars).replace(/\r?\n/g, " ");
}

module.exports = {
  DEFAULT_COMMAND_ONLY_CONFIG,
  DEFAULT_LIMITED_INITIAL_CONFIG,
  DOGFOOD_TARGET_MODES,
  assertDogfoodTargetReady,
  collectDogfoodTargetPacket,
  formatDogfoodTargetMarkdown,
  inferDogfoodMode,
  publicLine,
  publicText,
};
