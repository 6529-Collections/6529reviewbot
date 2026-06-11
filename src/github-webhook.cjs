"use strict";

const crypto = require("crypto");

const DEFAULT_WEBHOOK_PATH = "/webhooks/github";
const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;
const REVIEW_KINDS = ["general", "followup", "wcag", "i18n", "security"];
const INITIAL_REVIEW_KINDS = ["general", "wcag", "i18n", "security"];

function webhookSettingsFromEnv(env = process.env) {
  return {
    webhookSecret: env.GITHUB_WEBHOOK_SECRET || env.REVIEWBOT_GITHUB_WEBHOOK_SECRET || "",
    webhookPath: env.REVIEWBOT_WEBHOOK_PATH || DEFAULT_WEBHOOK_PATH,
    maxBodyBytes: positiveIntEnv(env.REVIEWBOT_WEBHOOK_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES),
  };
}

function positiveIntEnv(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got '${value}'.`);
  }
  return parsed;
}

function assertWebhookSettings(settings) {
  if (!settings.webhookSecret) {
    throw new Error("GITHUB_WEBHOOK_SECRET or REVIEWBOT_GITHUB_WEBHOOK_SECRET is required.");
  }
  if (!settings.webhookPath.startsWith("/")) {
    throw new Error("REVIEWBOT_WEBHOOK_PATH must start with '/'.");
  }
}

function signGitHubWebhook(secret, body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  return `sha256=${crypto.createHmac("sha256", secret).update(bytes).digest("hex")}`;
}

function verifyGitHubWebhookSignature(secret, body, signatureHeader) {
  if (!secret || !signatureHeader) {
    return false;
  }
  const signature = String(signatureHeader).trim();
  if (!signature.startsWith("sha256=")) {
    return false;
  }
  const hex = signature.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    return false;
  }

  const expected = Buffer.from(signGitHubWebhook(secret, body).slice("sha256=".length), "hex");
  const actual = Buffer.from(hex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function assertGitHubWebhookSignature(secret, body, headers) {
  const signature = headerValue(headers, "x-hub-signature-256");
  if (!verifyGitHubWebhookSignature(secret, body, signature)) {
    const error = new Error("Invalid GitHub webhook signature.");
    error.statusCode = 401;
    throw error;
  }
}

function headerValue(headers, name) {
  if (!headers) {
    return "";
  }
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return Array.isArray(value) ? value[0] || "" : value || "";
    }
  }
  return "";
}

async function readRequestBody(request, maxBodyBytes = DEFAULT_MAX_BODY_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBodyBytes) {
      const error = new Error(`Webhook body exceeds ${maxBodyBytes} bytes.`);
      error.statusCode = 413;
      throw error;
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function parseWebhookJson(body) {
  try {
    return JSON.parse(Buffer.isBuffer(body) ? body.toString("utf8") : String(body));
  } catch (cause) {
    const error = new Error("Webhook body must be valid JSON.");
    error.statusCode = 400;
    error.cause = cause;
    throw error;
  }
}

function normalizeGitHubWebhook(headers, payload) {
  const eventName = headerValue(headers, "x-github-event");
  const deliveryId = headerValue(headers, "x-github-delivery");
  const action = payload?.action || "";
  const repository = payload?.repository || {};
  const issue = payload?.issue || {};
  const pullRequest = payload?.pull_request || {};
  const sender = payload?.sender || {};

  const base = {
    eventName,
    deliveryId,
    action,
    repository: {
      id: repository.id || null,
      fullName: repository.full_name || "",
      private: Boolean(repository.private),
      defaultBranch: repository.default_branch || "",
    },
    installationId: payload?.installation?.id || null,
    actor: sender.login || "",
    shouldEnqueue: false,
    reason: "",
  };

  if (eventName === "ping") {
    return { ...base, kind: "ping", reason: "GitHub ping event." };
  }

  if (eventName === "pull_request") {
    return normalizePullRequestEvent(base, pullRequest);
  }

  if (eventName === "issue_comment") {
    return normalizeIssueCommentEvent(base, issue, payload?.comment || {});
  }

  return {
    ...base,
    kind: "ignored",
    reason: `Unsupported GitHub event '${eventName || "unknown"}'.`,
  };
}

function normalizePullRequestEvent(base, pullRequest) {
  const supportedActions = new Set(["opened", "synchronize", "reopened", "ready_for_review"]);
  if (!supportedActions.has(base.action)) {
    return {
      ...base,
      kind: "ignored",
      prNumber: pullRequest.number || null,
      reason: `Unsupported pull_request action '${base.action || "unknown"}'.`,
    };
  }

  const reviewKinds = base.action === "synchronize" ? ["followup"] : INITIAL_REVIEW_KINDS;
  return {
    ...base,
    kind: "pull_request",
    shouldEnqueue: true,
    trigger: "pull_request",
    prNumber: pullRequest.number || null,
    prAuthor: pullRequest.user?.login || "",
    headSha: pullRequest.head?.sha || "",
    headRepoFullName: pullRequest.head?.repo?.full_name || "",
    baseSha: pullRequest.base?.sha || "",
    baseRepoFullName: pullRequest.base?.repo?.full_name || base.repository.fullName,
    draft: Boolean(pullRequest.draft),
    reviewKinds,
    reason: `Accepted pull_request.${base.action}.`,
  };
}

function normalizeIssueCommentEvent(base, issue, comment) {
  if (base.action !== "created") {
    return {
      ...base,
      kind: "ignored",
      issueNumber: issue.number || null,
      reason: `Unsupported issue_comment action '${base.action || "unknown"}'.`,
    };
  }

  if (!issue.pull_request) {
    return {
      ...base,
      kind: "ignored",
      issueNumber: issue.number || null,
      reason: "Issue comment is not on a pull request.",
    };
  }

  const command = parseReviewCommand(comment.body || "");
  if (!command) {
    return {
      ...base,
      kind: "ignored",
      prNumber: issue.number || null,
      commentId: comment.id || null,
      reason: "Comment did not contain a 6529bot command.",
    };
  }

  return {
    ...base,
    kind: "comment_command",
    shouldEnqueue: true,
    trigger: "comment",
    prNumber: issue.number || null,
    prAuthor: issue.user?.login || "",
    commentId: comment.id || null,
    commentAuthor: comment.user?.login || "",
    command,
    reviewKinds: command.reviewKinds,
    reason: `Accepted comment command '${command.name}'.`,
  };
}

function parseReviewCommand(body) {
  const line = String(body)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => /^\/6529bot\b/i.test(item) || /^@6529bot\b/i.test(item));
  if (!line) {
    return null;
  }

  const tokens = line.split(/\s+/);
  const rawName = tokens[1] ? tokens[1].toLowerCase() : "review";
  const args = tokens.slice(2).map((item) => item.toLowerCase());

  if (rawName === "help") {
    return { name: "help", args, reviewKinds: [] };
  }

  if (rawName === "review") {
    const requestedKinds = args.filter((item) => REVIEW_KINDS.includes(item));
    if (args.includes("all")) {
      return { name: "review", args, reviewKinds: INITIAL_REVIEW_KINDS };
    }
    return { name: "review", args, reviewKinds: requestedKinds.length ? requestedKinds : ["general"] };
  }

  if (REVIEW_KINDS.includes(rawName)) {
    return { name: rawName, args, reviewKinds: [rawName] };
  }

  return null;
}

module.exports = {
  DEFAULT_MAX_BODY_BYTES,
  DEFAULT_WEBHOOK_PATH,
  INITIAL_REVIEW_KINDS,
  REVIEW_KINDS,
  assertGitHubWebhookSignature,
  assertWebhookSettings,
  headerValue,
  normalizeGitHubWebhook,
  parseReviewCommand,
  parseWebhookJson,
  readRequestBody,
  signGitHubWebhook,
  verifyGitHubWebhookSignature,
  webhookSettingsFromEnv,
};
