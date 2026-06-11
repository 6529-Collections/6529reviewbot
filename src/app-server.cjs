"use strict";

const http = require("http");
const {
  admissionPolicyFromEnv,
  evaluateAdmission,
  requestorForEvent,
} = require("./admission-policy.cjs");
const {
  budgetPolicyFromEnv,
  evaluateBudgetAdmission,
} = require("./budget-admission.cjs");
const {
  attachBudgetToReviewJob,
  budgetSummaryForJobs,
  createReviewJobs,
  eventForReviewJob,
  publicReviewJobSummary,
  reviewJobPolicyFromEnv,
} = require("./review-job.cjs");
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
  const enqueueReviewJobs = options.enqueueReviewJobs || options.enqueueReview || defaultEnqueueReviewJobs;
  const admissionPolicy = options.admissionPolicy || admissionPolicyFromEnv();
  const resolveActorContext = options.resolveActorContext || defaultResolveActorContext;
  const budgetPolicy = options.budgetPolicy || budgetPolicyFromEnv();
  const resolveBudgetSnapshot = options.resolveBudgetSnapshot || defaultResolveBudgetSnapshot;
  const estimateBudgetCost = options.estimateBudgetCost || defaultEstimateBudgetCost;
  const jobPolicy = options.jobPolicy || reviewJobPolicyFromEnv();
  const logger = options.logger || console;

  return http.createServer(async (request, response) => {
    try {
      const result = await handleHttpRequest(request, {
        settings,
        enqueueReviewJobs,
        admissionPolicy,
        resolveActorContext,
        budgetPolicy,
        resolveBudgetSnapshot,
        estimateBudgetCost,
        jobPolicy,
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
    enqueueReviewJobs: options.enqueueReviewJobs,
    admissionPolicy: options.admissionPolicy,
    resolveActorContext: options.resolveActorContext,
    budgetPolicy: options.budgetPolicy,
    resolveBudgetSnapshot: options.resolveBudgetSnapshot,
    estimateBudgetCost: options.estimateBudgetCost,
    jobPolicy: options.jobPolicy,
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

  const candidateJobs = createReviewJobs(event, { admission }, input.jobPolicy || reviewJobPolicyFromEnv());
  if (candidateJobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(event),
        admission,
        jobs: [],
      },
    };
  }

  const budgetedJobs = [];
  const admittedJobs = [];
  const deniedJobs = [];
  const resolveBudgetSnapshot = input.resolveBudgetSnapshot || defaultResolveBudgetSnapshot;
  const estimateBudgetCost = input.estimateBudgetCost || defaultEstimateBudgetCost;
  const budgetPolicy = input.budgetPolicy || budgetPolicyFromEnv();
  for (const job of candidateJobs) {
    const jobEvent = eventForReviewJob(event, job);
    const spendSnapshot = await resolveBudgetSnapshot(jobEvent, admission, job);
    const estimate = await estimateBudgetCost(jobEvent, admission, job);
    const budget = evaluateBudgetAdmission({
      event: jobEvent,
      admission,
      run: jobEvent.run,
      policy: budgetPolicy,
      spendSnapshot,
      estimate,
    });
    const budgetedJob = attachBudgetToReviewJob(job, budget);
    budgetedJobs.push(budgetedJob);
    if (budget.allowed) {
      admittedJobs.push(budgetedJob);
    } else {
      deniedJobs.push(budgetedJob);
    }
  }

  const budget = budgetSummaryForJobs(budgetedJobs);
  if (admittedJobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(event),
        admission,
        budget,
        jobs: [],
        deniedJobs: deniedJobs.map(publicReviewJobSummary),
      },
    };
  }

  const enqueueReviewJobs = input.enqueueReviewJobs || input.enqueueReview || defaultEnqueueReviewJobs;
  const enqueueResult = await enqueueReviewJobs(admittedJobs, {
    event,
    admission,
    budget,
    deniedJobs,
    allJobs: budgetedJobs,
  });
  const accepted = enqueueResult?.accepted !== false;
  return {
    statusCode: accepted ? 202 : 200,
    body: {
      ok: true,
      enqueued: accepted,
      event: publicEventSummary(event),
      admission,
      budget,
      jobs: admittedJobs.map(publicReviewJobSummary),
      deniedJobs: deniedJobs.map(publicReviewJobSummary),
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

async function defaultResolveBudgetSnapshot() {
  return {
    unavailable: true,
    reason: "No budget spend snapshot resolver configured.",
  };
}

async function defaultEstimateBudgetCost() {
  return {};
}

async function defaultEnqueueReviewJobs(jobs) {
  return {
    accepted: false,
    reason: "No review queue configured.",
    jobCount: jobs.length,
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
  defaultEstimateBudgetCost,
  defaultEnqueueReviewJobs,
  defaultResolveActorContext,
  defaultResolveBudgetSnapshot,
  handleGitHubWebhook,
  handleHttpRequest,
  publicEventSummary,
};
