"use strict";

const crypto = require("crypto");
const {
  PROVIDERS,
  defaultModelForProvider: catalogDefaultModelForProvider,
  defaultProvider,
  normalizeProvider,
} = require("./model-catalog.cjs");
const DEFAULT_MAX_JOBS_PER_DELIVERY = 8;

function reviewJobPolicyFromEnv(env = process.env) {
  return {
    lanes: parseReviewLanes(env.REVIEWBOT_REVIEW_LANES || "", env),
    maxJobsPerDelivery: positiveIntEnv(
      env.REVIEWBOT_MAX_JOBS_PER_DELIVERY,
      DEFAULT_MAX_JOBS_PER_DELIVERY,
      "REVIEWBOT_MAX_JOBS_PER_DELIVERY"
    ),
  };
}

function parseReviewLanes(value, env = process.env) {
  const raw = String(value || "").trim();
  const lanes = raw
    ? raw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => parseReviewLane(item, env))
    : [defaultReviewLane(env)];

  return dedupeLanes(lanes);
}

function defaultReviewLane(env) {
  const provider = defaultProvider(env);
  return normalizeReviewLane({
    provider,
    model:
      env.REVIEWBOT_DEFAULT_MODEL ||
      env.REVIEW_MODEL ||
      catalogDefaultModelForProvider(provider, env),
  });
}

function parseReviewLane(value, env = process.env) {
  const match = String(value).match(/^([a-z0-9_-]+)\s*[:=]\s*(.+)$/i);
  if (!match) {
    throw new Error(
      `Invalid REVIEWBOT_REVIEW_LANES entry '${value}'. Use provider:model, for example anthropic:claude-opus-4-8.`
    );
  }
  const provider = match[1];
  const model = match[2] || catalogDefaultModelForProvider(provider, env);
  return normalizeReviewLane({ provider, model });
}

function normalizeReviewLane(lane) {
  const provider = normalizeProvider(lane.provider);
  const model = String(lane.model || "").trim() || catalogDefaultModelForProvider(provider);
  if (!model) {
    throw new Error(
      `No model configured for provider '${provider}'. Set REVIEWBOT_REVIEW_LANES, REVIEWBOT_DEFAULT_MODEL, REVIEW_MODEL, or REVIEW_DEFAULT_${provider.toUpperCase()}_MODEL.`
    );
  }
  return {
    provider,
    model,
    lane: `${provider}:${slugPart(model)}`,
  };
}

function dedupeLanes(lanes) {
  const seen = new Set();
  const result = [];
  for (const lane of lanes) {
    const key = `${lane.provider}\0${lane.model}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(lane);
  }
  return result;
}

function createReviewJobs(event, controls = {}, policy = reviewJobPolicyFromEnv()) {
  if (!event || !event.shouldEnqueue) {
    return [];
  }
  const reviewKinds = uniqueStrings(event.reviewKinds || []);
  if (reviewKinds.length === 0) {
    return [];
  }

  const jobs = [];
  const lanes = policy.lanes && policy.lanes.length ? policy.lanes : reviewJobPolicyFromEnv().lanes;
  for (const reviewKind of reviewKinds) {
    for (const lane of lanes) {
      jobs.push(createReviewJob(event, reviewKind, lane, controls));
    }
  }

  const maxJobs = policy.maxJobsPerDelivery || DEFAULT_MAX_JOBS_PER_DELIVERY;
  if (jobs.length > maxJobs) {
    const error = new Error(
      `Webhook delivery would create ${jobs.length} review jobs, above REVIEWBOT_MAX_JOBS_PER_DELIVERY=${maxJobs}.`
    );
    error.statusCode = 422;
    throw error;
  }

  return jobs;
}

function createReviewJob(event, reviewKind, lane, controls = {}) {
  const normalizedLane = normalizeReviewLane(lane);
  const requestor =
    controls.admission?.requestor || event.commentAuthor || event.actor || event.prAuthor || "";
  const job = {
    id: stableReviewJobId(event, reviewKind, normalizedLane),
    version: 1,
    status: "pending",
    repository: event.repository,
    installationId: event.installationId || null,
    deliveryId: event.deliveryId || "",
    eventName: event.eventName || "",
    eventAction: event.action || "",
    eventKind: event.kind || "",
    trigger: event.trigger || "",
    prNumber: event.prNumber || null,
    prAuthor: event.prAuthor || "",
    headSha: event.headSha || "",
    baseSha: event.baseSha || "",
    headRepoFullName: event.headRepoFullName || "",
    baseRepoFullName: event.baseRepoFullName || event.repository?.fullName || "",
    actor: event.actor || "",
    requestor,
    commentId: event.commentId || null,
    commandName: event.command?.name || "",
    reviewKind,
    provider: normalizedLane.provider,
    model: normalizedLane.model,
    lane: normalizedLane.lane,
    runKey: stableReviewJobRunKey(event, reviewKind, normalizedLane),
    createdAt: controls.createdAt || new Date().toISOString(),
  };
  return controls.admission ? { ...job, admission: controls.admission } : job;
}

function eventForReviewJob(event, job) {
  return {
    ...event,
    reviewKinds: [job.reviewKind],
    run: {
      provider: job.provider,
      model: job.model,
      lane: job.lane,
      reviewKind: job.reviewKind,
      jobId: job.id,
    },
  };
}

function attachBudgetToReviewJob(job, budget) {
  return {
    ...job,
    status: budget?.allowed
      ? budget.status === "warning"
        ? "budget_warning"
        : "admitted"
      : "budget_denied",
    budget: budget || null,
  };
}

function publicReviewJobSummary(job) {
  return {
    id: job.id,
    status: job.status,
    repository: job.repository?.fullName || "",
    prNumber: job.prNumber,
    headSha: job.headSha,
    reviewKind: job.reviewKind,
    provider: job.provider,
    model: job.model,
    lane: job.lane,
    runKey: job.runKey,
    requestor: job.requestor,
    trigger: job.trigger,
    budget: job.budget
      ? {
          status: job.budget.status,
          allowed: job.budget.allowed,
          code: job.budget.code,
          estimatedCostUsd: job.budget.estimatedCostUsd,
        }
      : null,
    runControl: job.runControl
      ? {
          status: job.runControl.status,
          allowed: job.runControl.allowed,
          code: job.runControl.code,
          runKey: job.runControl.runKey,
        }
      : null,
    runtimeControl: job.runtimeControl
      ? {
          status: job.runtimeControl.status,
          allowed: job.runtimeControl.allowed,
          code: job.runtimeControl.code,
        }
      : null,
  };
}

function budgetSummaryForJobs(jobs) {
  const decisions = jobs.map((job) => job.budget).filter(Boolean);
  const denied = decisions.filter((decision) => !decision.allowed);
  const warnings = decisions.filter((decision) => decision.status === "warning");
  if (denied.length > 0 && denied.length === decisions.length) {
    return {
      status: "denied",
      allowed: false,
      code: denied[0].code,
      reason: denied[0].reason,
      deniedJobs: denied.length,
      warningJobs: warnings.length,
      totalJobs: decisions.length,
    };
  }
  if (denied.length > 0) {
    return {
      status: "partial",
      allowed: true,
      code: "some_jobs_denied",
      reason: "Some review jobs were denied by budget admission.",
      deniedJobs: denied.length,
      warningJobs: warnings.length,
      totalJobs: decisions.length,
    };
  }
  if (warnings.length > 0) {
    return {
      status: "warning",
      allowed: true,
      code: warnings[0].code,
      reason: warnings[0].reason,
      deniedJobs: 0,
      warningJobs: warnings.length,
      totalJobs: decisions.length,
    };
  }
  return {
    status: decisions.length ? "allowed" : "skipped",
    allowed: true,
    code: decisions[0]?.code || "no_jobs",
    reason: decisions[0]?.reason || "No review jobs required budget admission.",
    deniedJobs: 0,
    warningJobs: 0,
    totalJobs: decisions.length,
  };
}

function stableReviewJobId(event, reviewKind, lane) {
  const parts = [
    event.deliveryId || "",
    event.repository?.fullName || "",
    event.prNumber || "",
    event.headSha || "",
    event.commentId || "",
    event.command?.name || "",
    reviewKind,
    lane.provider,
    lane.model,
  ];
  const hash = crypto.createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
  return `rj_${hash}`;
}

function stableReviewJobRunKey(event, reviewKind, lane) {
  const parts = [
    event.repository?.fullName || "",
    event.prNumber || "",
    event.headSha || "",
    event.trigger || "",
    event.commentId || "",
    event.command?.name || "",
    reviewKind,
    lane.provider,
    lane.model,
  ];
  const hash = crypto.createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
  return `rk_${hash}`;
}

function positiveIntEnv(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function slugPart(value) {
  return (
    String(value || "default")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120) || "default"
  );
}

module.exports = {
  DEFAULT_MAX_JOBS_PER_DELIVERY,
  PROVIDERS,
  attachBudgetToReviewJob,
  budgetSummaryForJobs,
  createReviewJobs,
  eventForReviewJob,
  parseReviewLanes,
  publicReviewJobSummary,
  reviewJobPolicyFromEnv,
  stableReviewJobId,
  stableReviewJobRunKey,
};
