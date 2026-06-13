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
  applyRuntimeControlToEvent,
  filterRuntimeControlJobs,
  publicRuntimeControlDecision,
  runtimeControlPolicyFromEnv,
} = require("./runtime-control.cjs");
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
const {
  redactSensitiveText,
  safeErrorLine,
} = require("./diagnostics.cjs");

function createReviewbotServer(options = {}) {
  const settings = options.settings || webhookSettingsFromEnv();
  assertWebhookSettings(settings);
  const enqueueReviewJobs = options.enqueueReviewJobs || options.enqueueReview || defaultEnqueueReviewJobs;
  const admissionPolicy = options.admissionPolicy || admissionPolicyFromEnv();
  const resolveActorContext = options.resolveActorContext || defaultResolveActorContext;
  const budgetPolicy = options.budgetPolicy || budgetPolicyFromEnv();
  const loadBudgetPolicy = options.loadBudgetPolicy || defaultLoadBudgetPolicy;
  const resolveBudgetSnapshot = options.resolveBudgetSnapshot || defaultResolveBudgetSnapshot;
  const estimateBudgetCost = options.estimateBudgetCost || defaultEstimateBudgetCost;
  const runControlPolicy = options.runControlPolicy || runControlPolicyFromEnv();
  const runtimeControlPolicy = options.runtimeControlPolicy || runtimeControlPolicyFromEnv();
  const claimReviewJob = options.claimReviewJob || defaultClaimReviewJob;
  const jobPolicy = options.jobPolicy || reviewJobPolicyFromEnv();
  const repositoryConfigPolicy =
    options.repositoryConfigPolicy || repositoryConfigPolicyFromEnv();
  const loadRepositoryConfig =
    options.loadRepositoryConfig ||
    ((event) => loadRepositoryConfigForEvent(event, { policy: repositoryConfigPolicy }));
  const usageApiSettings = options.usageApiSettings || usageApiSettingsFromEnv();
  const recordJobEvent = options.recordJobEvent || defaultRecordJobEvent;
  const updateRunClaimStatus = options.updateRunClaimStatus || defaultUpdateRunClaimStatus;
  const logger = options.logger || console;

  return http.createServer(async (request, response) => {
    try {
      const result = await handleHttpRequest(request, {
        settings,
        enqueueReviewJobs,
        admissionPolicy,
        resolveActorContext,
        budgetPolicy,
        loadBudgetPolicy,
        runtimeControlPolicy,
        resolveBudgetSnapshot,
        estimateBudgetCost,
        runControlPolicy,
        claimReviewJob,
        jobPolicy,
        repositoryConfigPolicy,
        loadRepositoryConfig,
        usageApiSettings,
        recordJobEvent,
        updateRunClaimStatus,
        loadUsageEvents: options.loadUsageEvents,
        loadBudgetPolicies: options.loadBudgetPolicies,
        loadBudgetStatus: options.loadBudgetStatus,
        loadModelPriceStatus: options.loadModelPriceStatus,
        loadAlertStatus: options.loadAlertStatus,
        loadJobEvents: options.loadJobEvents,
        loadRunClaims: options.loadRunClaims,
        loadAdminStatus: options.loadAdminStatus,
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

  if (request.method === "GET" && isGitHubAppOperatorPath(url.pathname)) {
    return {
      statusCode: 200,
      body: githubAppOperatorResponse(url),
    };
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
        loadBudgetStatus: options.loadBudgetStatus,
        loadModelPriceStatus: options.loadModelPriceStatus,
        loadAlertStatus: options.loadAlertStatus,
        loadJobEvents: options.loadJobEvents,
        loadRunClaims: options.loadRunClaims,
        loadAdminStatus: options.loadAdminStatus,
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
    loadBudgetPolicy: options.loadBudgetPolicy,
    runtimeControlPolicy: options.runtimeControlPolicy,
    resolveBudgetSnapshot: options.resolveBudgetSnapshot,
    estimateBudgetCost: options.estimateBudgetCost,
    runControlPolicy: options.runControlPolicy,
    claimReviewJob: options.claimReviewJob,
    jobPolicy: options.jobPolicy,
    repositoryConfigPolicy: options.repositoryConfigPolicy,
    loadRepositoryConfig: options.loadRepositoryConfig,
    recordJobEvent: options.recordJobEvent,
    updateRunClaimStatus: options.updateRunClaimStatus,
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

  const runtimeControlPolicy = input.runtimeControlPolicy || runtimeControlPolicyFromEnv();
  const runtimeControlled = applyRuntimeControlToEvent(configuredEvent, runtimeControlPolicy);
  const controlledEvent = runtimeControlled.event;
  const runtimeControl = {
    event: publicRuntimeControlDecision(runtimeControlled.control),
    jobs: null,
  };
  if (!controlledEvent.shouldEnqueue) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(controlledEvent),
        configuration,
        runtimeControl,
      },
    };
  }

  const resolveActorContext = input.resolveActorContext || defaultResolveActorContext;
  const actorContext = await resolveActorContext(controlledEvent);
  const admissionPolicy = mergeRepositoryAdmissionPolicy(
    input.admissionPolicy || admissionPolicyFromEnv(),
    repositoryConfig
  );
  const admission = evaluateAdmission(controlledEvent, actorContext, admissionPolicy);
  if (!admission.allowed) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(controlledEvent),
        configuration,
        runtimeControl,
        admission,
      },
    };
  }

  const jobPolicy = mergeRepositoryJobPolicy(
    input.jobPolicy || reviewJobPolicyFromEnv(),
    repositoryConfig
  );
  const candidateJobs = createReviewJobs(controlledEvent, { admission }, jobPolicy);
  if (candidateJobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(controlledEvent),
        configuration,
        runtimeControl,
        admission,
        jobs: [],
      },
    };
  }

  const runtimeControlledJobs = filterRuntimeControlJobs(candidateJobs, runtimeControlPolicy);
  runtimeControl.jobs = publicRuntimeControlDecision(runtimeControlledJobs.control);
  const runtimeDeniedJobs = runtimeControlledJobs.deniedJobs;
  await recordRuntimeControlDeniedJobEvents(input.recordJobEvent, runtimeDeniedJobs);
  if (runtimeControlledJobs.jobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(controlledEvent),
        configuration,
        runtimeControl,
        admission,
        jobs: [],
        deniedJobs: runtimeDeniedJobs.map(publicReviewJobSummary),
      },
    };
  }

  const budgetedJobs = [];
  const admittedJobs = [];
  const deniedJobs = [];
  const resolveBudgetSnapshot = input.resolveBudgetSnapshot || defaultResolveBudgetSnapshot;
  const estimateBudgetCost = input.estimateBudgetCost || defaultEstimateBudgetCost;
  const loadBudgetPolicy = input.loadBudgetPolicy || defaultLoadBudgetPolicy;
  const baseBudgetPolicy = await loadBudgetPolicy(input.budgetPolicy || budgetPolicyFromEnv(), {
    event: controlledEvent,
    admission,
    configuration,
    repositoryConfig,
  });
  const budgetPolicy = mergeRepositoryBudgetPolicy(
    baseBudgetPolicy,
    repositoryConfig
  );
  for (const job of runtimeControlledJobs.jobs) {
    const jobEvent = eventForReviewJob(controlledEvent, job);
    const spendSnapshot = await resolveBudgetSnapshot(jobEvent, admission, job, budgetPolicy);
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
        event: publicEventSummary(controlledEvent),
        configuration,
        runtimeControl,
        admission,
        budget,
        jobs: [],
        deniedJobs: [...runtimeDeniedJobs, ...deniedJobs].map(publicReviewJobSummary),
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
      event: controlledEvent,
      admission,
      budget,
      configuration,
      policy: runControlPolicy,
      allJobs: budgetedJobs,
      deniedJobs: [...runtimeDeniedJobs, ...deniedJobs],
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
  const allDeniedJobs = [...runtimeDeniedJobs, ...deniedJobs, ...runControlDeniedJobs];
  const allKnownJobs = [...runtimeDeniedJobs, ...deniedJobs, ...runControlledJobs];
  if (dispatchableJobs.length === 0) {
    return {
      statusCode: 200,
      body: {
        ok: true,
        enqueued: false,
        event: publicEventSummary(controlledEvent),
        configuration,
        runtimeControl,
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
      event: controlledEvent,
      admission,
      budget,
      runControl,
      configuration,
      runtimeControl,
      deniedJobs: allDeniedJobs,
      allJobs: allKnownJobs,
    });
  } catch (error) {
    await recordRunClaimDispatchExceptionStatuses(
      input.updateRunClaimStatus,
      dispatchableJobs,
      error
    );
    await recordDispatchExceptionEvents(input.recordJobEvent, dispatchableJobs, error);
    throw error;
  }
  const accepted = enqueueResult?.accepted !== false;
  await recordRunClaimDispatchStatuses(
    input.updateRunClaimStatus,
    dispatchableJobs,
    enqueueResult || {}
  );
  await recordJobEvents(
    input.recordJobEvent,
    dispatchJobEventsFromQueueResult(dispatchableJobs, enqueueResult || {})
  );
  return {
    statusCode: accepted ? 202 : 200,
    body: {
      ok: true,
      enqueued: accepted,
      event: publicEventSummary(controlledEvent),
      configuration,
      runtimeControl,
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

async function defaultLoadBudgetPolicy(policy) {
  return policy;
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

async function defaultUpdateRunClaimStatus() {
  return { skipped: true };
}

async function recordRuntimeControlDeniedJobEvents(recordJobEvent, jobs) {
  await recordJobEvents(
    recordJobEvent,
    (jobs || []).map((job) =>
      jobEventFromReviewJob(job, "runtime_disabled", {
        stage: "runtime_control",
        accepted: false,
        reason: job.runtimeControl?.reason || "",
      })
    )
  );
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

async function recordRunClaimDispatchExceptionStatuses(updateRunClaimStatus, jobs, error) {
  await recordRunClaimDispatchStatuses(
    updateRunClaimStatus,
    jobs,
    {
      accepted: false,
      reason: safeError(error),
      jobs: (jobs || []).map((job) => ({
        jobId: job.id,
        accepted: false,
        reason: safeError(error),
      })),
      claimStatus: "dispatch_error",
    }
  );
}

async function recordRunClaimDispatchStatuses(updateRunClaimStatus, jobs, queueResult = {}) {
  const updater = updateRunClaimStatus || defaultUpdateRunClaimStatus;
  const perJobResults = new Map();
  for (const result of queueResult.jobs || []) {
    if (result.jobId) {
      perJobResults.set(result.jobId, result);
    }
  }
  for (const job of jobs || []) {
    if (!job.runControl || job.runControl.status === "skipped") {
      continue;
    }
    const result = perJobResults.get(job.id);
    const hasPerJobResult = Boolean(result);
    const accepted = hasPerJobResult ? Boolean(result.accepted) : queueResult.accepted !== false;
    const status =
      result?.claimStatus || queueResult.claimStatus || (accepted ? "dispatching" : "dispatch_failed");
    await updater(job, status, {
      metadata: {
        queueStatus: queueResult.status || "",
        queueReason: result?.reason || queueResult.reason || "",
        adapter: result?.adapter || queueResult.adapter || "",
        workflow: result?.workflow || queueResult.workflow || "",
        workflowRepo: result?.workflowRepo || queueResult.workflowRepo || "",
        workflowRef: result?.workflowRef || queueResult.workflowRef || "",
      },
    });
  }
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

function isGitHubAppOperatorPath(pathname) {
  return [
    "/github-app/manifest-complete",
    "/github-app/setup",
    "/github-app/callback",
  ].includes(pathname);
}

function githubAppOperatorResponse(url) {
  if (url.pathname === "/github-app/manifest-complete") {
    return {
      ok: true,
      kind: "github_app_manifest_complete",
      codeReceived: Boolean(url.searchParams.get("code")),
      stateReceived: Boolean(url.searchParams.get("state")),
      nextStep:
        "From a private operator environment, run: npm run github-app:convert -- -- --code <code-from-url> --output <private-json-path>",
      warning:
        "Do not paste the manifest code, generated App credentials, webhook payloads, or private repository details into public issues, pull requests, logs, or release notes.",
    };
  }
  if (url.pathname === "/github-app/setup") {
    return {
      ok: true,
      kind: "github_app_setup",
      nextStep:
        "Install 6529bot on selected repositories only, then continue with docs/install.md and docs/github-app-registration.md.",
      warning:
        "Keep provider keys, GitHub App credentials, AWS access, and alert routing secrets in bot-owned infrastructure.",
    };
  }
  return {
    ok: true,
    kind: "github_app_callback",
    nextStep:
      "6529bot does not use a browser OAuth callback for normal review operation. Use GitHub App installation credentials and the central App server instead.",
  };
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(body)}\n`);
}

function safeError(error) {
  return safeErrorLine(error);
}

module.exports = {
  createReviewbotServer,
  defaultEstimateBudgetCost,
  defaultEnqueueReviewJobs,
  defaultClaimReviewJob,
  defaultRecordJobEvent,
  defaultUpdateRunClaimStatus,
  defaultLoadBudgetPolicy,
  defaultResolveActorContext,
  defaultResolveBudgetSnapshot,
  handleGitHubWebhook,
  handleHttpRequest,
  githubAppOperatorResponse,
  isGitHubAppOperatorPath,
  normalizeConfigLoadResult,
  publicEventSummary,
  redactSensitiveText,
};
