"use strict";

const path = require("path");
const { loadBudgetPolicyFile } = require("./budget-policies.cjs");
const { redactSensitiveText, safeErrorLine } = require("./diagnostics.cjs");
const { loadModelCatalog } = require("./model-catalog.cjs");
const {
  checkOperatorWorkspace,
  publicOperatorWorkspaceSummary,
} = require("./operator-workspace.cjs");
const { runPreflight } = require("./preflight.cjs");
const { parseRepositoryConfigText } = require("./repository-config.cjs");
const fs = require("fs");

const DEFAULT_REPOSITORY_CONFIG_FILES = [
  "templates/dogfood-command-only-config.yml",
  "templates/dogfood-repository-config.yml",
];
const DEFAULT_BUDGET_POLICY_FILE = "config/budget-policies.dogfood.example.json";
const DEFAULT_MODEL_CATALOG_FILE = "config/model-catalog.json";
const DOGFOOD_TEXT_MAX_CHARS = 1000;
const PUBLIC_REDACTION_PATTERNS = [
  [/\barn:aws[a-z-]*:[^\s"'`,)]+/gi, "arn:aws:[redacted]"],
  [/\b\d{12}\b/g, "[redacted-aws-account-id]"],
];

function collectDogfoodReadiness(options = {}) {
  const root = options.root || process.cwd();
  const now = options.now || new Date();
  const repositoryConfigFiles =
    options.repositoryConfigFiles && options.repositoryConfigFiles.length
      ? options.repositoryConfigFiles
      : DEFAULT_REPOSITORY_CONFIG_FILES;
  const budgetPolicyFile = options.budgetPolicyFile || DEFAULT_BUDGET_POLICY_FILE;
  const modelCatalogFile = options.modelCatalogFile || DEFAULT_MODEL_CATALOG_FILE;
  const includePreflight = Boolean(options.includePreflight);
  const strictPreflight = Boolean(options.strictPreflight);
  const operatorWorkspaceDir = options.operatorWorkspaceDir || "";
  const requireOperatorWorkspaceReady = Boolean(options.requireOperatorWorkspaceReady);

  const repositoryConfigs = collectRepositoryConfigs(repositoryConfigFiles, root);
  const budgetPolicies = collectBudgetPolicies(budgetPolicyFile, root);
  const modelCatalog = collectModelCatalog(modelCatalogFile, root);
  const operatorWorkspace = operatorWorkspaceDir
    ? collectOperatorWorkspace({
        directory: operatorWorkspaceDir,
        requireReady: requireOperatorWorkspaceReady,
        root,
      })
    : null;
  const preflight = includePreflight
    ? collectPreflight({
        env: options.env || process.env,
        now,
        profile: options.preflightProfile || "server",
        strict: strictPreflight,
      })
    : null;

  const ready =
    repositoryConfigs.status === "ok" &&
    budgetPolicies.status === "ok" &&
    modelCatalog.status === "ok" &&
    (!operatorWorkspace ||
      (operatorWorkspace.status === "ok" &&
        (!requireOperatorWorkspaceReady || operatorWorkspace.ready))) &&
    (!preflight || preflight.ok);

  return {
    version: 1,
    generatedAt: now.toISOString(),
    ready,
    inputs: {
      repositoryConfigFiles: repositoryConfigFiles.map((file) =>
        publicPath(file, root)
      ),
      budgetPolicyFile: publicPath(budgetPolicyFile, root),
      modelCatalogFile: publicPath(modelCatalogFile, root),
      preflight: includePreflight
        ? {
            profile: publicText(options.preflightProfile || "server"),
            strict: strictPreflight,
          }
        : null,
      operatorWorkspace: operatorWorkspaceDir
        ? {
            directory: "[operator-workspace]",
            requireReady: requireOperatorWorkspaceReady,
          }
        : null,
    },
    checks: {
      repositoryConfigs,
      budgetPolicies,
      modelCatalog,
      operatorWorkspace,
      preflight,
    },
  };
}

function collectRepositoryConfigs(files, root) {
  const configs = [];
  const errors = [];
  for (const file of files) {
    try {
      const absolutePath = path.resolve(root, file);
      const config = parseRepositoryConfigText(
        fs.readFileSync(absolutePath, "utf8"),
        file
      );
      configs.push({
        file: publicPath(file, root),
        enabled: Boolean(config.enabled),
        commandsEnabled: config.commands.enabled !== false,
        initialReviewKinds: config.reviewKinds.initial.map((kind) =>
          publicText(kind)
        ),
        followupReviewKinds: config.reviewKinds.followup.map((kind) =>
          publicText(kind)
        ),
        allowedReviewKinds: config.reviewKinds.allowed.map((kind) =>
          publicText(kind)
        ),
        lanes: config.lanes.map((lane) =>
          publicText(`${lane.provider}:${lane.model}`)
        ),
        maxJobsPerDelivery: config.limits.maxJobsPerDelivery || null,
      });
    } catch (error) {
      errors.push({
        file: publicPath(file, root),
        message: publicText(safeErrorLine(error)),
      });
    }
  }
  return {
    status: errors.length ? "error" : "ok",
    count: configs.length,
    configs,
    errors,
  };
}

function collectBudgetPolicies(file, root) {
  try {
    const document = loadBudgetPolicyFile(path.resolve(root, file));
    const enabledPolicies = document.policies.filter(
      (policy) => policy.enabled !== false
    );
    const scopes = [...new Set(document.policies.map((policy) => policy.scopeType))]
      .sort()
      .map((scope) => publicText(scope));
    const cappedScopes = Object.fromEntries(
      scopes.map((scope) => [
        scope,
        enabledPolicies.filter((policy) => policy.scopeType === scope).length,
      ])
    );
    return {
      status: "ok",
      file: publicPath(file, root),
      currency: publicText(document.currency),
      policyCount: document.policies.length,
      enabledPolicyCount: enabledPolicies.length,
      scopes,
      cappedScopes,
      errors: [],
    };
  } catch (error) {
    return {
      status: "error",
      file: publicPath(file, root),
      currency: "",
      policyCount: 0,
      enabledPolicyCount: 0,
      scopes: [],
      cappedScopes: {},
      errors: [publicText(safeErrorLine(error))],
    };
  }
}

function collectModelCatalog(file, root) {
  try {
    const catalog = loadModelCatalog({ path: path.resolve(root, file) });
    return {
      status: "ok",
      file: publicPath(file, root),
      defaultProvider: publicText(catalog.defaultProvider),
      defaultModel: publicText(
        catalog.providers[catalog.defaultProvider]?.defaultModel || ""
      ),
      providers: Object.fromEntries(
        Object.entries(catalog.providers).map(([provider, settings]) => [
          publicText(provider),
          {
            defaultModel: publicText(settings.defaultModel || ""),
            modelCount: Object.keys(settings.models).length,
            requireExplicitModel: Boolean(settings.requireExplicitModel),
          },
        ])
      ),
      errors: [],
    };
  } catch (error) {
    return {
      status: "error",
      file: publicPath(file, root),
      defaultProvider: "",
      defaultModel: "",
      providers: {},
      errors: [publicText(safeErrorLine(error))],
    };
  }
}

function collectPreflight(input) {
  const result = runPreflight(input);
  return {
    status: result.ok ? "ok" : "error",
    ok: Boolean(result.ok),
    profile: publicText(result.profile || input.profile || "server"),
    strict: Boolean(input.strict),
    checks: Array.isArray(result.checks) ? result.checks.length : 0,
    warnings: safeMessages(result.warnings),
    errors: safeMessages(result.errors),
  };
}

function collectOperatorWorkspace(input) {
  const directory = path.resolve(input.directory);
  try {
    const workspace = checkOperatorWorkspace({
      directory,
      dogfoodChecklistFile: path.resolve(input.root, "config/dogfood-checklist.json"),
      productionCutoverChecklistFile: path.resolve(input.root, "config/production-cutover-checklist.json"),
      releaseGatesFile: path.resolve(input.root, "config/v0-release-gates.json"),
      requireReady: Boolean(input.requireReady),
      securityReviewChecklistFile: path.resolve(input.root, "config/security-review-checklist.json"),
    });
    const summary = publicOperatorWorkspaceSummary(workspace);
    return {
      status: "ok",
      ready: Boolean(summary.ready),
      directory: summary.directory,
      files: summary.files,
      summaries: summary.summaries,
      errors: [],
    };
  } catch (error) {
    return {
      status: "error",
      ready: false,
      directory: "[operator-workspace]",
      files: [],
      summaries: {},
      errors: [operatorWorkspaceError(error, directory, input.root)],
    };
  }
}

function formatDogfoodReadinessMarkdown(report) {
  const lines = [
    "# 6529bot Dogfood Readiness",
    "",
    [
      "This report is public-safe. It validates static dogfood inputs and,",
      "when requested, summarizes no-network preflight posture without printing",
      "secrets, live resource identifiers, or private budget scope values.",
    ].join(" "),
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Generated: ${publicText(report.generatedAt)}`,
    "",
    "## Inputs",
    "",
    `- repository configs: ${report.inputs.repositoryConfigFiles
      .map((item) => publicText(item))
      .join(", ")}`,
    `- budget policy: ${publicText(report.inputs.budgetPolicyFile)}`,
    `- model catalog: ${publicText(report.inputs.modelCatalogFile)}`,
    `- preflight: ${
      report.inputs.preflight
        ? `${publicText(report.inputs.preflight.profile)}${
            report.inputs.preflight.strict ? " strict" : ""
          }`
        : "not included"
    }`,
    `- operator workspace: ${
      report.inputs.operatorWorkspace
        ? `${publicText(report.inputs.operatorWorkspace.directory)}${
            report.inputs.operatorWorkspace.requireReady ? " require-ready" : ""
          }`
        : "not included"
    }`,
    "",
    "## Repository Configs",
    "",
  ];

  if (report.checks.repositoryConfigs.errors.length) {
    for (const error of report.checks.repositoryConfigs.errors) {
      lines.push(`- error in ${publicText(error.file)}: ${publicText(error.message)}`);
    }
  } else {
    for (const config of report.checks.repositoryConfigs.configs) {
      lines.push(
        [
          `- ${publicText(config.file)}:`,
          `enabled=${config.enabled}`,
          `commands=${config.commandsEnabled}`,
          `initial=${list(config.initialReviewKinds)}`,
          `followup=${list(config.followupReviewKinds)}`,
          `lanes=${list(config.lanes, "central default")}`,
          `maxJobs=${config.maxJobsPerDelivery || "central default"}`,
        ].join(" ")
      );
    }
  }

  lines.push(
    "",
    "## Budget Policies",
    "",
    budgetLine(report.checks.budgetPolicies),
    "",
    "## Model Catalog",
    "",
    modelCatalogLine(report.checks.modelCatalog)
  );

  if (report.checks.preflight) {
    lines.push("", "## Preflight", "", preflightLine(report.checks.preflight));
    if (report.checks.preflight.errors.length) {
      lines.push("", "Preflight errors:");
      for (const error of report.checks.preflight.errors) {
        lines.push(`- ${publicText(error.name)}: ${publicText(error.message)}`);
      }
    }
    if (report.checks.preflight.warnings.length) {
      lines.push("", "Preflight warnings:");
      for (const warning of report.checks.preflight.warnings) {
        lines.push(`- ${publicText(warning.name)}: ${publicText(warning.message)}`);
      }
    }
  }

  if (report.checks.operatorWorkspace) {
    lines.push(
      "",
      "## Operator Workspace",
      "",
      operatorWorkspaceLine(report.checks.operatorWorkspace)
    );
    if (report.checks.operatorWorkspace.errors.length) {
      lines.push("", "Operator workspace errors:");
      for (const error of report.checks.operatorWorkspace.errors) {
        lines.push(`- ${publicText(error)}`);
      }
    } else {
      lines.push(
        `- release gates: ${checklistLine(report.checks.operatorWorkspace.summaries.releaseGates)}`,
        `- dogfood: ${checklistLine(report.checks.operatorWorkspace.summaries.dogfood)}`,
        `- security review: ${checklistLine(report.checks.operatorWorkspace.summaries.securityReview)}`,
        `- production cutover: ${checklistLine(report.checks.operatorWorkspace.summaries.productionCutover)}`,
        `- operator evidence: ${checklistLine(report.checks.operatorWorkspace.summaries.operatorEvidence)}`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function budgetLine(summary) {
  if (summary.status !== "ok") {
    return `- error: ${summary.errors
      .map((error) => publicText(error))
      .join("; ")}`;
  }
  return [
    `- ${publicText(summary.file)}:`,
    `${summary.enabledPolicyCount}/${summary.policyCount} enabled policies,`,
    `scopes=${list(summary.scopes)}`,
  ].join(" ");
}

function modelCatalogLine(summary) {
  if (summary.status !== "ok") {
    return `- error: ${summary.errors
      .map((error) => publicText(error))
      .join("; ")}`;
  }
  const providers = Object.entries(summary.providers)
    .map(([provider, settings]) => {
      const model = settings.defaultModel || "explicit required";
      return `${provider}:${model} (${settings.modelCount} models)`;
    })
    .join(", ");
  return [
    `- ${publicText(summary.file)}:`,
    `default=${publicText(summary.defaultProvider)}:${publicText(summary.defaultModel)}`,
    `providers=${publicText(providers)}`,
  ].join(" ");
}

function preflightLine(summary) {
  return [
    `- ${summary.ok ? "ok" : "not ready"}:`,
    `${summary.checks} checks,`,
    `${summary.errors.length} errors,`,
    `${summary.warnings.length} warnings`,
  ].join(" ");
}

function operatorWorkspaceLine(summary) {
  if (summary.status !== "ok") {
    return `- error: ${summary.errors
      .map((error) => publicText(error))
      .join("; ")}`;
  }
  return [
    `- ${summary.ready ? "ready" : "not ready"}:`,
    `${summary.files.length} private workspace files parsed`,
  ].join(" ");
}

function checklistLine(summary = {}) {
  return [
    summary.ready ? "ready" : "not ready",
    `${count(summary.complete)} complete`,
    `${count(summary.pending)} pending`,
    `${count(summary.blocked)} blocked`,
    `${count(summary.deferred)} deferred`,
  ].join(", ");
}

function count(value) {
  return Number.isFinite(value) ? value : 0;
}

function safeMessages(messages) {
  return (messages || []).map((item) => ({
    name: publicText(item.name),
    message: publicText(item.message),
  }));
}

function list(values, fallback = "none") {
  return values && values.length
    ? values.map((value) => publicText(value)).join(",")
    : fallback;
}

function publicPath(filePath, root) {
  const resolved = path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "[external-path-set]";
  }
  return publicText(relative.split(path.sep).join("/"));
}

function publicText(value, maxChars = DOGFOOD_TEXT_MAX_CHARS) {
  let text = redactSensitiveText(value);
  for (const [pattern, replacement] of PUBLIC_REDACTION_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.slice(0, maxChars);
}

function operatorWorkspaceError(error, directory, root) {
  let message = safeErrorLine(error).split(directory).join("[operator-workspace]");
  message = message.split(path.resolve(root)).join("[repo-root]");
  return publicText(message);
}

module.exports = {
  DEFAULT_BUDGET_POLICY_FILE,
  DEFAULT_MODEL_CATALOG_FILE,
  DEFAULT_REPOSITORY_CONFIG_FILES,
  collectOperatorWorkspace,
  collectDogfoodReadiness,
  formatDogfoodReadinessMarkdown,
  publicText,
};
