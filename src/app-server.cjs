"use strict";

const http = require("http");
const {
  admissionPolicyFromEnv,
  evaluateAdmission,
  requestorForEvent,
} = require("./admission-policy.cjs");
const {
  assertGitHubWebhookSignature,
  assertWebhookSettings,
  normalizeGitHubWebhook,
  parseWebhookJson,
  readRequestBody,
  webhookSettingsFromEnv,
} = require("./github-webhook.cjs");

function createReviewbotServer(options = {}) {
  const settings = options.settings || webhookSettingsFromEnv();
  assertWebhookSettings(settings);
  const enqueueReview = options.enqueueReview || defaultEnqueueReview;
  const admissionPolicy = options.admissionPolicy || admissionPolicyFromEnv();
  const resolveActorContext = options.resolveActorContext || defaultResolveActorContext;
  const logger = options.logger || console;

  return http.createServer(async (request, response) => {
    try {
      const result = await handleHttpRequest(request, {
        settings,
        enqueueReview,
        admissionPolicy,
        resolveActorContext,
        logger,
      });
      sendJson(response, result.statusCode, result.body);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) {
        logger.error(`[reviewbot-app] ${safeError(error)}`);
      }
      sendJson(response, statusCode, {
        ok: false,
        error: statusCode >= 500 ? "Internal server error." : error.message,
      });
    }
  });
}

async function handleHttpRequest(request, options) {
  const url = new URL(request.url || "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/healthz") {
    return { statusCode: 200, body: { ok: true } };
  }

  if (url.pathname !== options.settings.webhookPath) {
    return { statusCode: 404, body: { ok: false, error: "Not found." } };
  }

  if (request.method !== "POST") {
    return { statusCode: 405, body: { ok: false, error: "Method not allowed." } };
  }

  const rawBody = await readRequestBody(request, options.settings.maxBodyBytes);
  return handleGitHubWebhook({
    headers: request.headers,
    rawBody,
    settings: options.settings,
    enqueueReview: options.enqueueReview,
    admissionPolicy: options.admissionPolicy,
    resolveActorContext: options.resolveActorContext,
  });
}

async function handleGitHubWebhook(input) {
  assertWebhookSettings(input.settings);
  assertGitHubWebhookSignature(input.settings.webhookSecret, input.rawBody, input.headers);

  const payload = parseWebhookJson(input.rawBody);
  const event = normalizeGitHubWebhook(input.headers, payload);
  if (!event.shouldEnqueue) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(event),
      },
    };
  }

  const resolveActorContext = input.resolveActorContext || defaultResolveActorContext;
  const actorContext = await resolveActorContext(event);
  const admission = evaluateAdmission(event, actorContext, input.admissionPolicy || admissionPolicyFromEnv());
  if (!admission.allowed) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(event),
        admission,
      },
    };
  }

  const enqueueReview = input.enqueueReview || defaultEnqueueReview;
  const enqueueResult = await enqueueReview(event, admission);
  const accepted = enqueueResult?.accepted !== false;
  return {
    statusCode: accepted ? 202 : 200,
    body: {
      ok: true,
      enqueued: accepted,
      event: publicEventSummary(event),
      admission,
      queue: enqueueResult || null,
    },
  };
}

async function defaultResolveActorContext(event) {
  return {
    login: requestorForEvent(event),
    permission: "none",
  };
}

async function defaultEnqueueReview(event) {
  return {
    accepted: false,
    reason: "No review queue configured.",
    eventKind: event.kind,
  };
}

function publicEventSummary(event) {
  return {
    kind: event.kind,
    trigger: event.trigger || "",
    eventName: event.eventName,
    action: event.action,
    repository: event.repository.fullName,
    prNumber: event.prNumber || null,
    actor: event.actor,
    reviewKinds: event.reviewKinds || [],
    reason: event.reason,
  };
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body)}\n`);
}

function safeError(error) {
  return error && error.stack ? error.stack.split("\n")[0] : String(error);
}

module.exports = {
  createReviewbotServer,
  defaultResolveActorContext,
  handleGitHubWebhook,
  handleHttpRequest,
  publicEventSummary,
};
