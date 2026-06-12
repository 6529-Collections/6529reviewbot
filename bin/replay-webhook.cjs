#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const { safeErrorLine } = require("../src/diagnostics.cjs");
const {
  createGitHubAppIntegration,
  githubAppAuthSettingsFromEnv,
  isGitHubAppAuthConfigured,
} = require("../src/github-app-auth.cjs");
const {
  parseRepositoryConfigText,
} = require("../src/repository-config.cjs");
const {
  handleGitHubWebhook,
} = require("../src/app-server.cjs");
const {
  signGitHubWebhook,
  webhookSettingsFromEnv,
} = require("../src/github-webhook.cjs");
const {
  createReviewJobEnqueuer,
} = require("../src/worker-adapter.cjs");

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const result = await replayWebhook(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.statusCode >= 400) {
    process.exitCode = 1;
  }
}

async function replayWebhook(options = {}) {
  const rawBody = normalizePayloadBody(readPayload(options.payloadPath, options));
  const payload = parsePayload(rawBody);
  const envWebhookSettings = webhookSettingsFromEnv();
  const webhookSecret = options.webhookSecret || envWebhookSettings.webhookSecret || "replay-secret";
  const eventName = options.eventName || inferEventName(payload);
  const deliveryId = options.deliveryId || `replay-${Date.now()}`;
  const settings = {
    ...envWebhookSettings,
    webhookSecret,
  };
  const githubApp = githubAppIntegrationFromEnv();
  const headers = {
    "x-hub-signature-256": options.signature || signGitHubWebhook(webhookSecret, rawBody),
    "x-github-event": eventName,
    "x-github-delivery": deliveryId,
  };
  const replayOptions = {
    headers,
    rawBody,
    settings,
    enqueueReviewJobs: options.dispatch
      ? createReviewJobEnqueuer()
      : dryRunReviewJobEnqueuer,
  };

  const actorContext = actorContextFromOptions(options);
  if (actorContext) {
    replayOptions.resolveActorContext = async (event) => ({
      login: actorContext.login || requestorForReplay(event),
      permission: actorContext.permission,
      isOrgMember: actorContext.isOrgMember,
      organizations: actorContext.organizations,
    });
  } else {
    if (githubApp) {
      replayOptions.resolveActorContext = githubApp.resolveActorContext;
    }
  }

  if (options.repositoryConfigPath) {
    replayOptions.loadRepositoryConfig = async () =>
      loadRepositoryConfigFile(options.repositoryConfigPath);
  } else {
    if (githubApp) {
      replayOptions.loadRepositoryConfig = githubApp.loadRepositoryConfig;
    }
  }

  if (options.assumeEmptyBudget) {
    replayOptions.resolveBudgetSnapshot = async () => ({ unavailable: false, totals: {} });
  }
  if (options.estimatedCostUsd !== undefined) {
    replayOptions.estimateBudgetCost = async () => ({
      estimatedCostUsd: options.estimatedCostUsd,
    });
  }

  const result = await handleGitHubWebhook(replayOptions);
  return {
    replay: {
      dryRun: !options.dispatch,
      dispatched: Boolean(options.dispatch),
      eventName,
      deliveryId,
      payloadBytes: Buffer.byteLength(rawBody),
      repositoryConfig: options.repositoryConfigPath || "",
      actorPermission: options.actorPermission || "",
      assumeEmptyBudget: Boolean(options.assumeEmptyBudget),
      estimatedCostUsd: options.estimatedCostUsd ?? null,
    },
    ...result,
  };
}

function parseArgs(argv) {
  const options = {
    dispatch: false,
    assumeEmptyBudget: false,
    orgMember: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--dispatch") {
      options.dispatch = true;
      continue;
    }
    if (arg === "--assume-empty-budget") {
      options.assumeEmptyBudget = true;
      continue;
    }
    if (arg === "--org-member") {
      options.orgMember = true;
      continue;
    }
    const valueOptions = {
      "--payload": "payloadPath",
      "--event": "eventName",
      "--delivery": "deliveryId",
      "--signature": "signature",
      "--webhook-secret": "webhookSecret",
      "--actor": "actorLogin",
      "--actor-permission": "actorPermission",
      "--repository-config": "repositoryConfigPath",
      "--estimated-cost-usd": "estimatedCostUsd",
    };
    if (Object.prototype.hasOwnProperty.call(valueOptions, arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value.`);
      }
      index += 1;
      options[valueOptions[arg]] =
        arg === "--estimated-cost-usd" ? nonNegativeNumber(value, arg) : value;
      continue;
    }
    throw new Error(`Unknown argument '${arg}'.`);
  }

  if (!options.help && !options.payloadPath) {
    throw new Error("Pass --payload <file> or --payload - for stdin.");
  }
  if (options.actorPermission) {
    options.actorPermission = normalizePermission(options.actorPermission);
  }
  return options;
}

function readPayload(payloadPath, options = {}) {
  if (payloadPath === "-") {
    if (options.readStdin) {
      return Buffer.from(options.readStdin());
    }
    return Buffer.from(fs.readFileSync(0, "utf8"));
  }
  const absolutePath = path.resolve(process.cwd(), payloadPath);
  return fs.readFileSync(absolutePath);
}

function parsePayload(rawBody) {
  try {
    return JSON.parse(normalizePayloadBody(rawBody).toString("utf8"));
  } catch (cause) {
    const error = new Error("Replay payload must be valid JSON.");
    error.cause = cause;
    throw error;
  }
}

function normalizePayloadBody(rawBody) {
  const bytes = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody));
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.subarray(3);
  }
  return bytes;
}

function inferEventName(payload) {
  if (payload?.pull_request) {
    return "pull_request";
  }
  if (payload?.issue && payload?.comment) {
    return "issue_comment";
  }
  if (payload?.zen || payload?.hook) {
    return "ping";
  }
  throw new Error("Could not infer GitHub event. Pass --event <name>.");
}

function actorContextFromOptions(options) {
  if (!options.actorLogin && !options.actorPermission && !options.orgMember) {
    return null;
  }
  return {
    login: options.actorLogin || "",
    permission: options.actorPermission || "none",
    isOrgMember: Boolean(options.orgMember),
    organizations: options.orgMember ? ["replay"] : [],
  };
}

function requestorForReplay(event) {
  return event.commentAuthor || event.actor || event.prAuthor || "";
}

async function loadRepositoryConfigFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const text = fs.readFileSync(absolutePath, "utf8");
  return {
    status: "loaded",
    source: "local_file",
    path: filePath,
    ref: "",
    reason: "",
    config: parseRepositoryConfigText(text, filePath),
  };
}

async function dryRunReviewJobEnqueuer(jobs) {
  return {
    accepted: false,
    adapter: "dry_run",
    jobCount: jobs.length,
    acceptedJobs: 0,
    failedJobs: 0,
    reason: "Webhook replay dry run; no workers dispatched.",
  };
}

function githubAppIntegrationFromEnv() {
  const settings = githubAppAuthSettingsFromEnv();
  if (!isGitHubAppAuthConfigured(settings)) {
    return null;
  }
  return createGitHubAppIntegration({ settings });
}

function normalizePermission(value) {
  const permission = String(value || "").trim().toLowerCase();
  const allowed = ["none", "read", "triage", "write", "maintain", "admin"];
  if (!allowed.includes(permission)) {
    throw new Error(`--actor-permission must be one of: ${allowed.join(", ")}.`);
  }
  return permission;
}

function nonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function printUsage() {
  console.log(`Usage: node bin/replay-webhook.cjs --payload <payload.json> [options]

Safely replay a saved GitHub webhook payload through the App admission,
repository-config, budget, and job-fanout pipeline.

Options:
  --event <name>                 GitHub event name. Inferred for pull_request,
                                 issue_comment, and ping payloads.
  --delivery <id>                Delivery id to use. Defaults to replay-<time>.
  --signature <sha256=...>       Verify with an existing signature.
  --webhook-secret <secret>      Secret used to verify/sign the replay payload.
  --actor <login>                Override actor login for admission diagnostics.
  --actor-permission <level>     none, read, triage, write, maintain, or admin.
  --org-member                   Mark the override actor as an org member.
  --repository-config <file>     Load target repo config from a local file.
  --assume-empty-budget          Use an empty spend snapshot for budget checks.
  --estimated-cost-usd <amount>  Override estimated per-job cost.
  --dispatch                     Dispatch admitted jobs through configured worker.
  -h, --help                     Show this help.

Without --dispatch, replay is a dry run and will not call providers or workers.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(safeErrorLine(error));
    process.exitCode = 1;
  });
}

module.exports = {
  actorContextFromOptions,
  dryRunReviewJobEnqueuer,
  inferEventName,
  normalizePayloadBody,
  parseArgs,
  parsePayload,
  replayWebhook,
};
