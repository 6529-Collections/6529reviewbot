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
  attachRunControlToReviewJob,
  evaluateRunControl,
  runControlPolicyFromEnv,
  runControlSummaryForJobs,
} = require("./run-control.cjs");
const {
  applyRepositoryConfigToEvent,
  defaultRepositoryConfig,
  loadRepositoryConfigForEvent,
  mergeRepositoryAdmissionPolicy,
  mergeRepositoryBudgetPolicy,
  mergeRepositoryJobPolicy,
  publicRepositoryConfigSummary,
  repositoryConfigBlocksWork,
  repositoryConfigPolicyFromEnv,
} = require("./repository-config.cjs");
const {
  handleUsageApiRequest,
  isUsageApiPath,
  usageApiSettingsFromEnv,
} = require("./usage-api.cjs");
const {
  assertGitHubWebhookSignature,
  assertWebhookSettings,
  normalizeGitHubWebhook,
  parseWebhookJson,
  readRequestBody,
  webhookSettingsFromEnv,
} = require("./github-webhook.cjs");
const {
  dispatchJobEventsFromQueueResult,
  jobEventFromReviewJob,
} = require("./job-ledger.cjs");

function createReviewbotServer(options = {}) {
  const settings = options.settings || webhookSettingsFromEnv();
  assertWebhookSettings(settings);
  const enqueueReviewJobs = options.enqueueReviewJobs || options.enqueueReview || defaultEnqueueReviewJobs;
  const admissionPolicy = options.admissionPolicy || admissionPolicyFromEnv();
  const resolveActorContext = options.resolveActorContext || defaultResolveActorContext;
  const budgetPolicy = options.budgetPolicy || budgetPolicyFromEnv();
  const resolveBudgetSnapshot = options.resolveBudgetSnapshot || defaultResolveBudgetSnapshot;
  const estimateBudgetCost = options.estimateBudgetCost || defaultEstimateBudgetCost;
  const runControlPolicy = options.runControlPolicy || runControlPolicyFromEnv();
  const claimReviewJob = options.claimReviewJob || defaultClaimReviewJob;
  const jobPolicy = options.jobPolicy || reviewJobPolicyFromEnv();
  const repositoryConfigPolicy =
    options.repositoryConfigPolicy || repositoryConfigPolicyFromEnv();
  const loadRepositoryConfig =
    options.loadRepositoryConfig ||
    ((event) => loadRepositoryConfigForEvent(event, { policy: repositoryConfigPolicy }));
  const usageApiSettings = options.usageApiSettings || usageApiSettingsFromEnv();
  const recordJobEvent = options.recordJobEvent || defaultRecordJobEvent;
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
        runControlPolicy,
        claimReviewJob,
        jobPolicy,
        repositoryConfigPolicy,
        loadRepositoryConfig,
        usageApiSettings,
        recordJobEvent,
        loadUsageEvents: options.loadUsageEvents,
        loadBudgetPolicies: options.loadBudgetPolicies,
        authorizeUsageApiAdmin: options.authorizeUsageApiAdmin,
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

  const usageApiSettings = options.usageApiSettings || usageApiSettingsFromEnv();
  if (isUsageApiPath(url.pathname, usageApiSettings)) {
    return await handleUsageApiRequest(
      {
        method: request.method || "",
        url,
        headers: request.headers || {},
      },
      {
        settings: usageApiSettings,
        loadUsageEvents: options.loadUsageEvents,
        loadBudgetPolicies: options.loadBudgetPolicies,
        authorizeAdmin: options.authorizeUsageApiAdmin,
      }
    );
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
    runControlPolicy: options.runControlPolicy,
    claimReviewJob: options.claimReviewJob,
    jobPolicy: options.jobPolicy,
    repositoryConfigPolicy: options.repositoryConfigPolicy,
    loadRepositoryConfig: options.loadRepositoryConfig,
    recordJobEvent: options.recordJobEvent,
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

  const repositoryConfigPolicy =
    input.repositoryConfigPolicy || repositoryConfigPolicyFromEnv();
  const loadRepositoryConfig =
    input.loadRepositoryConfig ||
    ((nextEvent) => loadRepositoryConfigForEvent(nextEvent, { policy: repositoryConfigPolicy }));
  const configLoad = normalizeConfigLoadResult(await loadRepositoryConfig(event));
  const repositoryConfig = configLoad.config || defaultRepositoryConfig();
  const configuration = publicRepositoryConfigSummary(configLoad, repositoryConfig);
  if (repositoryConfigBlocksWork(configLoad, repositoryConfigPolicy)) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(event),
        configuration,
      },
    };
  }

  const configuredEvent = applyRepositoryConfigToEvent(event, repositoryConfig);
  if (!configuredEvent.shouldEnqueue) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(configuredEvent),
        configuration,
      },
    };
  }

  const resolveActorContext = input.resolveActorContext || defaultResolveActorContext;
  const actorContext = await resolveActorContext(configuredEvent);
  const admissionPolicy = mergeRepositoryAdmissionPolicy(
    input.admissionPolicy || admissionPolicyFromEnv(),
    repositoryConfig
  );
  const admission = evaluateAdmission(configuredEvent, actorContext, admissionPolicy);
  if (!admission.allowed) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(configuredEvent),
        configuration,
        admission,
      },
    };
  }

  const jobPolicy = mergeRepositoryJobPolicy(
    input.jobPolicy || reviewJobPolicyFromEnv(),
    repositoryConfig
  );
  const candidateJobs = createReviewJobs(configuredEvent, { admission }, jobPolicy);
  if (candidateJobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(configuredEvent),
        configuration,
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
  const budgetPolicy = mergeRepositoryBudgetPolicy(
    input.budgetPolicy || budgetPolicyFromEnv(),
    repositoryConfig
  );
  for (const job of candidateJobs) {
    const jobEvent = eventForReviewJob(configuredEvent, job);
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
  await recordBudgetJobEvents(input.recordJobEvent, budgetedJobs);

  const budget = budgetSummaryForJobs(budgetedJobs);
  if (admittedJobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(configuredEvent),
        configuration,
        admission,
        budget,
        jobs: [],
        deniedJobs: deniedJobs.map(publicReviewJobSummary),
      },
    };
  }

  const runControlledJobs = [];
  const runControlDeniedJobs = [];
  const dispatchableJobs = [];
  const claimReviewJob = input.claimReviewJob || defaultClaimReviewJob;
  const runControlPolicy = input.runControlPolicy || runControlPolicyFromEnv();
  for (const job of admittedJobs) {
    const runControl = await claimReviewJob(job, {
      event: configuredEvent,
      admission,
      budget,
      configuration,
      policy: runControlPolicy,
      allJobs: budgetedJobs,
      deniedJobs,
    });
    const controlledJob = attachRunControlToReviewJob(job, runControl);
    runControlledJobs.push(controlledJob);
    if (runControl?.allowed) {
      dispatchableJobs.push(controlledJob);
    } else {
      runControlDeniedJobs.push(controlledJob);
    }
  }
  await recordRunControlJobEvents(input.recordJobEvent, runControlledJobs);

  const runControl = runControlSummaryForJobs(runControlledJobs);
  const allDeniedJobs = [...deniedJobs, ...runControlDeniedJobs];
  const allKnownJobs = [...deniedJobs, ...runControlledJobs];
  if (dispatchableJobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(configuredEvent),
        configuration,
        admission,
        budget,
        runControl,
        jobs: [],
        deniedJobs: allDeniedJobs.map(publicReviewJobSummary),
      },
    };
  }

  const enqueueReviewJobs = input.enqueueReviewJobs || input.enqueueReview || defaultEnqueueReviewJobs;
  let enqueueResult;
  try {
    enqueueResult = await enqueueReviewJobs(dispatchableJobs, {
      event: configuredEvent,
      admission,
      budget,
      runControl,
      configuration,
      deniedJobs: allDeniedJobs,
      allJobs: allKnownJobs,
    });
  } catch (error) {
    await recordDispatchExceptionEvents(input.recordJobEvent, dispatchableJobs, error);
    throw error;
  }
  const accepted = enqueueResult?.accepted !== false;
  await recordJobEvents(
    input.recordJobEvent,
    dispatchJobEventsFromQueueResult(dispatchableJobs, enqueueResult || {})
  );
  return {
    statusCode: accepted ? 202 : 200,
    body: {
      ok: true,
      enqueued: accepted,
      event: publicEventSummary(configuredEvent),
      configuration,
      admission,
      budget,
      runControl,
      jobs: dispatchableJobs.map(publicReviewJobSummary),
      deniedJobs: allDeniedJobs.map(publicReviewJobSummary),
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

async function defaultClaimReviewJob(job, context = {}) {
  return evaluateRunControl({
    job,
    policy: context.policy || runControlPolicyFromEnv(),
    snapshot: {
      unavailable: true,
      reason: "No run-control claim store configured.",
    },
  });
}

async function defaultEnqueueReviewJobs(jobs) {
  return {
    accepted: false,
    reason: "No review queue configured.",
    jobCount: jobs.length,
  };
}

async function defaultRecordJobEvent() {
  return { skipped: true };
}

async function recordBudgetJobEvents(recordJobEvent, jobs) {
  await recordJobEvents(
    recordJobEvent,
    (jobs || []).map((job) =>
      jobEventFromReviewJob(job, budgetJobLedgerStatus(job), {
        stage: "budget",
        accepted: Boolean(job.budget?.allowed),
      })
    )
  );
}

async function recordRunControlJobEvents(recordJobEvent, jobs) {
  const events = [];
  for (const job of jobs || []) {
    const status = runControlJobLedgerStatus(job);
    if (!status) {
      continue;
    }
    events.push(
      jobEventFromReviewJob(job, status, {
        stage: "run_control",
        accepted: Boolean(job.runControl?.allowed),
        reason: job.runControl?.reason || "",
      })
    );
  }
  await recordJobEvents(recordJobEvent, events);
}

async function recordDispatchExceptionEvents(recordJobEvent, jobs, error) {
  await recordJobEvents(
    recordJobEvent,
    (jobs || []).map((job) =>
      jobEventFromReviewJob(job, "dispatch_error", {
        stage: "dispatch",
        accepted: false,
        reason: safeError(error),
      })
    )
  );
}

async function recordJobEvents(recordJobEvent, events) {
  const recorder = recordJobEvent || defaultRecordJobEvent;
  for (const event of events || []) {
    await recorder(event);
  }
}

function budgetJobLedgerStatus(job) {
  if (!job.budget?.allowed) {
    return "budget_denied";
  }
  return job.budget.status === "warning" ? "budget_warning" : "budget_admitted";
}

function runControlJobLedgerStatus(job) {
  if (!job.runControl || job.runControl.status === "skipped") {
    return null;
  }
  if (!job.runControl.allowed) {
    return job.runControl.code === "duplicate_run"
      ? "run_control_duplicate"
      : "run_control_denied";
  }
  return job.runControl.status === "warning"
    ? "run_control_warning"
    : "run_control_admitted";
}

function normalizeConfigLoadResult(result) {
  if (!result || typeof result !== "object") {
    return {
      status: "invalid",
      reason: "Repository config loader returned an invalid result.",
      config: defaultRepositoryConfig(),
    };
  }
  return result;
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
  defaultClaimReviewJob,
  defaultRecordJobEvent,
  defaultResolveActorContext,
  defaultResolveBudgetSnapshot,
  handleGitHubWebhook,
  handleHttpRequest,
  normalizeConfigLoadResult,
  publicEventSummary,
};
