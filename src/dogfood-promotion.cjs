"use strict";

const path = require("path");
const { spawnSync } = require("child_process");
const { redactSensitiveText, safeErrorLine } = require("./diagnostics.cjs");
const {
  DEFAULT_COMMAND_ONLY_CONFIG,
  DEFAULT_LIMITED_INITIAL_CONFIG,
  collectDogfoodTargetPacket,
} = require("./dogfood-target.cjs");
const { collectDogfoodReadiness } = require("./dogfood-readiness.cjs");

const DOGFOOD_PROMOTION_TEXT_MAX_CHARS = 1000;
const PUBLIC_REDACTION_PATTERNS = [
  [/\barn:aws[a-z-]*:[^\s"'`,)]+/gi, "arn:aws:[redacted]"],
  [/\b\d{12}\b/g, "[redacted-aws-account-id]"],
];

function collectDogfoodPromotionPacket(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const now = options.now || new Date();
  const mode = options.mode || "command-only";
  const targetConfigFile =
    options.repositoryConfigFile || defaultConfigForMode(mode);
  const target = collectDogfoodTargetPacket({
    root,
    mode,
    repositoryConfigFile: targetConfigFile,
    targetRepository: options.targetRepository || "",
  });
  const readiness = collectDogfoodReadiness({
    root,
    now,
    repositoryConfigFiles:
      options.readinessRepositoryConfigFiles &&
      options.readinessRepositoryConfigFiles.length
        ? options.readinessRepositoryConfigFiles
        : [targetConfigFile],
    budgetPolicyFile: options.budgetPolicyFile,
    modelCatalogFile: options.modelCatalogFile,
    modelPriceFile: options.modelPriceFile,
    allowStaleModelPriceSource: Boolean(options.allowStaleModelPriceSource),
    allowZeroModelPrice: Boolean(options.allowZeroModelPrice),
    maxModelPriceSourceAgeDays: options.maxModelPriceSourceAgeDays,
    includePreflight: Boolean(options.includePreflight),
    strictPreflight: Boolean(options.strictPreflight),
    preflightProfile: options.preflightProfile || "server",
    operatorWorkspaceDir: options.operatorWorkspaceDir || "",
    requireOperatorWorkspaceReady: Boolean(
      options.requireOperatorWorkspaceReady
    ),
    env: options.env || process.env,
  });
  const selfDogfoodReplay = options.skipSelfDogfoodReplay
    ? {
        status: "warning",
        ready: false,
        detail: "Self-dogfood replay was skipped.",
      }
    : runSelfDogfoodReplay({
        root,
        runner: options.selfDogfoodReplayRunner,
        nodeBin: options.nodeBin,
      });

  const gates = promotionGates({
    target,
    readiness,
    selfDogfoodReplay,
    includePreflight: Boolean(options.includePreflight),
    operatorWorkspaceIncluded: Boolean(options.operatorWorkspaceDir),
  });
  const summary = summarizeGates(gates);
  const ready = gates.every((gate) => gate.status === "ok");

  return {
    version: 1,
    generatedAt: now.toISOString(),
    ready,
    mode: target.mode,
    targetRepository: publicText(options.targetRepository || ""),
    inputs: {
      targetConfigFile: publicInputPath(targetConfigFile, root),
      budgetPolicyFile: readiness.inputs.budgetPolicyFile,
      modelCatalogFile: readiness.inputs.modelCatalogFile,
      modelPriceFile: readiness.inputs.modelPriceFile,
      preflight: options.includePreflight
        ? {
            profile: publicText(options.preflightProfile || "server"),
            strict: Boolean(options.strictPreflight),
          }
        : null,
      operatorWorkspace: options.operatorWorkspaceDir
        ? {
            directory: "[operator-workspace]",
            requireReady: Boolean(options.requireOperatorWorkspaceReady),
          }
        : null,
      selfDogfoodReplay: options.skipSelfDogfoodReplay ? "skipped" : "included",
    },
    gates,
    summary,
    checks: {
      target,
      readiness,
      selfDogfoodReplay,
    },
    nextActions: nextActions(gates),
  };
}

function formatDogfoodPromotionMarkdown(packet) {
  const lines = [
    "# 6529bot Dogfood Promotion Packet",
    "",
    [
      "This packet is public-safe. It composes the target config packet,",
      "central dogfood readiness checks, synthetic self-dogfood replay,",
      "private operator workspace parsing, and no-network preflight posture",
      "without printing secrets, live AWS identifiers, raw payloads, prompts,",
      "provider responses, or private workspace paths.",
    ].join(" "),
    "",
    `Promotion ready: ${packet.ready ? "yes" : "no"}`,
    `Generated: ${publicText(packet.generatedAt)}`,
    `Target repository: ${
      packet.targetRepository ? publicText(packet.targetRepository) : "not specified"
    }`,
    `Mode: ${publicText(packet.mode)}`,
    "",
    "## Inputs",
    "",
    `- target config: ${publicText(packet.inputs.targetConfigFile)}`,
    `- budget policy: ${publicText(packet.inputs.budgetPolicyFile)}`,
    `- model catalog: ${publicText(packet.inputs.modelCatalogFile)}`,
    `- model price file: ${
      packet.inputs.modelPriceFile
        ? `${publicText(packet.inputs.modelPriceFile.file)}${
            packet.inputs.modelPriceFile.allowStaleSource ? " allow-stale-source" : ""
          }${packet.inputs.modelPriceFile.allowZeroPrice ? " allow-zero-price" : ""}`
        : "not included"
    }`,
    `- self-dogfood replay: ${publicText(packet.inputs.selfDogfoodReplay)}`,
    `- preflight: ${
      packet.inputs.preflight
        ? `${publicText(packet.inputs.preflight.profile)}${
            packet.inputs.preflight.strict ? " strict" : ""
          }`
        : "not included"
    }`,
    `- operator workspace: ${
      packet.inputs.operatorWorkspace
        ? `${packet.inputs.operatorWorkspace.directory}${
            packet.inputs.operatorWorkspace.requireReady ? " require-ready" : ""
          }`
        : "not included"
    }`,
    "",
    "## Promotion Gates",
    "",
    "| Gate | Status | Detail |",
    "| --- | --- | --- |",
  ];

  for (const gate of packet.gates) {
    lines.push(
      `| ${markdownCell(gate.title)} | ${markdownCell(gate.status)} | ${markdownCell(gate.detail)} |`
    );
  }

  lines.push(
    "",
    "## Target Summary",
    "",
    `- target config ready: ${packet.checks.target.ready ? "yes" : "no"}`,
    `- target config errors: ${packet.checks.target.summary.errors}`,
    `- target config warnings: ${packet.checks.target.summary.warnings}`,
    "",
    "## Central Input Summary",
    "",
    `- repository configs: ${packet.checks.readiness.checks.repositoryConfigs.status}`,
    `- budget policies: ${packet.checks.readiness.checks.budgetPolicies.status}`,
    `- model catalog: ${packet.checks.readiness.checks.modelCatalog.status}`,
    `- model price coverage: ${modelPriceCoverageStatus(packet.checks.readiness.checks.modelPriceCoverage)}`,
    `- self-dogfood replay: ${packet.checks.selfDogfoodReplay.status}`,
    "",
    "## Next Actions",
    ""
  );
  for (const action of packet.nextActions) {
    lines.push(`- ${publicText(action)}`);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function assertDogfoodPromotionReady(packet) {
  if (!packet.inputs?.modelPriceFile) {
    throw new Error(
      "dogfood promotion packet requires reviewed model price coverage before it can be marked ready."
    );
  }
  if (!packet.ready) {
    const failing = packet.gates
      .filter((gate) => gate.status !== "ok")
      .map((gate) => gate.id)
      .join(", ");
    throw new Error(`dogfood promotion packet is not ready: ${failing}.`);
  }
  return packet;
}

function promotionGates(input) {
  const centralInputsOk =
    input.readiness.checks.repositoryConfigs.status === "ok" &&
    input.readiness.checks.budgetPolicies.status === "ok" &&
    input.readiness.checks.modelCatalog.status === "ok" &&
    modelPriceCoverageReady(input.readiness.checks.modelPriceCoverage);
  const gates = [
    gate(
      "target-config",
      "Target config packet",
      input.target.ready ? "ok" : "error",
      input.target.ready
        ? `${input.target.mode} config is conservative and ready.`
        : `${input.target.summary.errors} target config error(s).`
    ),
    gate(
      "central-inputs",
      "Central dogfood inputs",
      centralInputsOk ? "ok" : "error",
      centralInputsOk
        ? "Repository config, budget policy, model catalog, and model price coverage inputs parse."
        : "Repository config, budget policy, model catalog, or model price coverage validation failed."
    ),
    gate(
      "self-dogfood-replay",
      "Synthetic self-dogfood replay",
      input.selfDogfoodReplay.status,
      input.selfDogfoodReplay.detail
    ),
  ];

  if (input.operatorWorkspaceIncluded) {
    const operatorWorkspace = input.readiness.checks.operatorWorkspace;
    gates.push(
      gate(
        "operator-workspace",
        "Private operator workspace",
        operatorWorkspace.status === "ok" ? "ok" : "error",
        operatorWorkspace.status === "ok"
          ? "Private workspace files parse and paths are redacted."
          : "Private workspace is missing or does not parse."
      )
    );
  } else {
    gates.push(
      gate(
        "operator-workspace",
        "Private operator workspace",
        "warning",
        "Not included. Promotion to live traffic should include an operator workspace parse check."
      )
    );
  }

  if (input.includePreflight) {
    const preflight = input.readiness.checks.preflight;
    gates.push(
      gate(
        "preflight",
        "No-network runtime preflight",
        preflight && preflight.ok ? "ok" : "error",
        preflight && preflight.ok
          ? `${preflight.checks} preflight checks passed.`
          : "Preflight is not ready."
      )
    );
  } else {
    gates.push(
      gate(
        "preflight",
        "No-network runtime preflight",
        "warning",
        "Not included. Promotion to live traffic should include preflight from the private operator environment."
      )
    );
  }

  return gates;
}

function runSelfDogfoodReplay(options) {
  const root = path.resolve(options.root || process.cwd());
  const runner = options.runner || spawnSync;
  const result = runner(
    options.nodeBin || process.execPath,
    [path.join(root, "scripts/check-self-dogfood-replay.cjs")],
    {
      cwd: root,
      encoding: "utf8",
    }
  );
  if (result.error) {
    return {
      status: "error",
      ready: false,
      detail: publicText(safeErrorLine(result.error)),
    };
  }
  const output = String(`${result.stdout || ""}\n${result.stderr || ""}`).trim();
  if (result.status !== 0) {
    return {
      status: "error",
      ready: false,
      detail: publicText(output || `replay exited with status ${result.status}`),
    };
  }
  return {
    status: "ok",
    ready: true,
    detail: publicText(lastLine(output) || "Self-dogfood replay passed."),
  };
}

function nextActions(gates) {
  const actions = [];
  for (const item of gates) {
    if (item.status === "ok") {
      continue;
    }
    if (item.id === "operator-workspace") {
      actions.push(
        [
          "Run dogfood promotion again with --operator-workspace <private-workspace-dir>",
          "after the private workspace includes dogfood status baseline items",
          "provider-console-readiness-reviewed and iam-secret-custody-reviewed backed by",
          "provider-console-readiness and iam-and-secrets operator evidence.",
        ].join(" ")
      );
    } else if (item.id === "preflight") {
      actions.push(
        "Run dogfood promotion again with --strict-preflight from the private operator environment."
      );
    } else if (item.id === "self-dogfood-replay") {
      actions.push("Fix npm run check:self-dogfood-replay before live traffic.");
    } else if (item.id === "target-config") {
      actions.push("Fix the target repository .github/6529bot.yml posture.");
    } else if (item.id === "central-inputs") {
      actions.push(
        "Fix the dogfood budget policy, repository config, model catalog, or model price coverage input."
      );
    }
  }
  if (!actions.length) {
    actions.push(
      "Record the promotion packet in private dogfood evidence, then start command-only live traffic with conservative budgets."
    );
  }
  return actions;
}

function summarizeGates(gates) {
  const counts = { ok: 0, warning: 0, error: 0 };
  for (const item of gates) {
    counts[item.status] += 1;
  }
  return {
    ok: counts.ok,
    warnings: counts.warning,
    errors: counts.error,
  };
}

function modelPriceCoverageReady(summary) {
  return Boolean(summary) && summary.status === "ok" && summary.ready;
}

function modelPriceCoverageStatus(summary) {
  if (!summary) {
    return "not included";
  }
  if (summary.status !== "ok") {
    return "error";
  }
  return summary.ready ? "ready" : "not ready";
}

function gate(id, title, status, detail) {
  return {
    id,
    title,
    status,
    detail: publicText(detail),
  };
}

function defaultConfigForMode(mode) {
  if (mode === "limited-initial") {
    return DEFAULT_LIMITED_INITIAL_CONFIG;
  }
  return DEFAULT_COMMAND_ONLY_CONFIG;
}

function publicInputPath(filePath, root) {
  const resolved = path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return publicText(relative.split(path.sep).join("/"));
  }
  return `[external-config]/${publicText(path.basename(filePath) || "config.yml")}`;
}

function publicText(value, maxChars = DOGFOOD_PROMOTION_TEXT_MAX_CHARS) {
  let text = redactSensitiveText(String(value || ""));
  for (const [pattern, replacement] of PUBLIC_REDACTION_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.slice(0, maxChars);
}

function lastLine(output) {
  return String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .pop();
}

function markdownCell(value) {
  return publicText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

module.exports = {
  assertDogfoodPromotionReady,
  collectDogfoodPromotionPacket,
  formatDogfoodPromotionMarkdown,
  runSelfDogfoodReplay,
};
