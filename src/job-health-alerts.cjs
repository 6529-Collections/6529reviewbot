"use strict";

const DEFAULT_JOB_FAILURE_LOOKBACK_HOURS = 6;
const DEFAULT_JOB_FAILURE_THRESHOLD = 1;
const DEFAULT_STALE_CLAIM_HOURS = 2;
const DEFAULT_STALE_CLAIM_THRESHOLD = 1;
const DEFAULT_JOB_MAX_ALERTS = 25;
const FAILURE_STATUSES = ["dispatch_failed", "dispatch_error", "failed"];
const ACTIVE_CLAIM_STATUSES = ["claimed", "dispatching", "running"];

function jobHealthAlertPolicyFromEnv(env = process.env) {
  const defaultEnabled = env.REVIEWBOT_JOB_LEDGER_ENABLED || "false";
  return {
    enabled: parseBool(env.REVIEWBOT_ALERTS_JOB_HEALTH_ENABLED ?? defaultEnabled),
    failureLookbackHours: positiveNumber(
      env.REVIEWBOT_ALERTS_JOB_FAILURE_LOOKBACK_HOURS,
      DEFAULT_JOB_FAILURE_LOOKBACK_HOURS,
      "REVIEWBOT_ALERTS_JOB_FAILURE_LOOKBACK_HOURS"
    ),
    failureThreshold: positiveInt(
      env.REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD,
      DEFAULT_JOB_FAILURE_THRESHOLD,
      "REVIEWBOT_ALERTS_JOB_FAILURE_THRESHOLD"
    ),
    staleClaimHours: positiveNumber(
      env.REVIEWBOT_ALERTS_STALE_CLAIM_HOURS,
      DEFAULT_STALE_CLAIM_HOURS,
      "REVIEWBOT_ALERTS_STALE_CLAIM_HOURS"
    ),
    staleClaimThreshold: positiveInt(
      env.REVIEWBOT_ALERTS_STALE_CLAIM_THRESHOLD,
      DEFAULT_STALE_CLAIM_THRESHOLD,
      "REVIEWBOT_ALERTS_STALE_CLAIM_THRESHOLD"
    ),
    maxAlerts: positiveInt(
      env.REVIEWBOT_ALERTS_JOB_MAX_ALERTS,
      positiveInt(env.REVIEWBOT_ALERTS_MAX_ALERTS, DEFAULT_JOB_MAX_ALERTS, "REVIEWBOT_ALERTS_MAX_ALERTS"),
      "REVIEWBOT_ALERTS_JOB_MAX_ALERTS"
    ),
  };
}

function evaluateJobHealthAlerts(input = {}) {
  const policy = input.policy || jobHealthAlertPolicyFromEnv(input.env);
  if (!policy.enabled) {
    return [];
  }
  const now = input.now ? new Date(input.now) : new Date();
  const jobEvents = (input.jobEvents || []).map(normalizeJobEvent);
  const runClaims = (input.runClaims || []).map(normalizeRunClaim);
  const alerts = [
    ...jobFailureAlerts(jobEvents, now, policy),
    ...staleRunClaimAlerts(runClaims, now, policy),
  ];
  return alerts.sort(compareAlerts).slice(0, policy.maxAlerts);
}

function jobFailureAlerts(events, now, policy) {
  const cutoff = new Date(now.getTime() - policy.failureLookbackHours * 60 * 60 * 1000);
  const groups = new Map();
  for (const event of events) {
    if (!FAILURE_STATUSES.includes(event.status)) {
      continue;
    }
    if (!event.createdAtDate || event.createdAtDate < cutoff || event.createdAtDate > now) {
      continue;
    }
    const key = `${event.repoFullName || "unknown"}:${event.status}`;
    const group = groups.get(key) || {
      repoFullName: event.repoFullName || "unknown",
      status: event.status,
      count: 0,
      latestAt: event.createdAtDate,
      sampleJobIds: [],
    };
    group.count += 1;
    if (event.createdAtDate > group.latestAt) {
      group.latestAt = event.createdAtDate;
    }
    if (event.jobId && group.sampleJobIds.length < 3) {
      group.sampleJobIds.push(event.jobId);
    }
    groups.set(key, group);
  }

  const alerts = [];
  for (const group of groups.values()) {
    if (group.count < policy.failureThreshold) {
      continue;
    }
    const severity = group.count >= Math.max(policy.failureThreshold * 3, policy.failureThreshold + 2)
      ? "critical"
      : "warning";
    alerts.push({
      id: `job_failure:${group.status}:${group.repoFullName}:${dateTimeKey(cutoff)}`,
      kind: "job_failure",
      severity,
      title: `${severityLabel(severity)} ${group.status} jobs for repo:${group.repoFullName}`,
      message: `${group.count} ${group.status} job event(s) were recorded for repo:${group.repoFullName} in the last ${policy.failureLookbackHours}h.`,
      scopeType: "repo",
      scopeValue: group.repoFullName,
      status: group.status,
      failureCount: group.count,
      threshold: policy.failureThreshold,
      lookbackHours: policy.failureLookbackHours,
      latestAt: group.latestAt.toISOString(),
      sampleJobIds: group.sampleJobIds,
      sortScore: group.count,
    });
  }
  return alerts;
}

function staleRunClaimAlerts(claims, now, policy) {
  const staleBefore = new Date(now.getTime() - policy.staleClaimHours * 60 * 60 * 1000);
  const groups = new Map();
  for (const claim of claims) {
    if (!ACTIVE_CLAIM_STATUSES.includes(claim.status)) {
      continue;
    }
    if (!claim.updatedAtDate || claim.updatedAtDate > staleBefore) {
      continue;
    }
    if (claim.expiresAtDate && claim.expiresAtDate <= now) {
      continue;
    }
    const key = `${claim.repoFullName || "unknown"}:${claim.status}`;
    const group = groups.get(key) || {
      repoFullName: claim.repoFullName || "unknown",
      status: claim.status,
      count: 0,
      oldestUpdatedAt: claim.updatedAtDate,
      sampleJobIds: [],
    };
    group.count += 1;
    if (claim.updatedAtDate < group.oldestUpdatedAt) {
      group.oldestUpdatedAt = claim.updatedAtDate;
    }
    if (claim.jobId && group.sampleJobIds.length < 3) {
      group.sampleJobIds.push(claim.jobId);
    }
    groups.set(key, group);
  }

  const alerts = [];
  for (const group of groups.values()) {
    if (group.count < policy.staleClaimThreshold) {
      continue;
    }
    const ageHours = (now.getTime() - group.oldestUpdatedAt.getTime()) / (60 * 60 * 1000);
    const severity =
      group.count >= Math.max(policy.staleClaimThreshold * 3, policy.staleClaimThreshold + 2) ||
      ageHours >= policy.staleClaimHours * 3
        ? "critical"
        : "warning";
    alerts.push({
      id: `stale_run_claim:${group.status}:${group.repoFullName}:${dateTimeKey(group.oldestUpdatedAt)}`,
      kind: "stale_run_claim",
      severity,
      title: `${severityLabel(severity)} stale ${group.status} run claims for repo:${group.repoFullName}`,
      message: `${group.count} active run-control claim(s) for repo:${group.repoFullName} have been ${group.status} for at least ${policy.staleClaimHours}h.`,
      scopeType: "repo",
      scopeValue: group.repoFullName,
      status: group.status,
      staleClaimCount: group.count,
      threshold: policy.staleClaimThreshold,
      staleClaimHours: policy.staleClaimHours,
      oldestUpdatedAt: group.oldestUpdatedAt.toISOString(),
      sampleJobIds: group.sampleJobIds,
      sortScore: Math.max(group.count, ageHours),
    });
  }
  return alerts;
}

function normalizeJobEvent(event = {}) {
  const createdAt = event.createdAt || event.created_at || "";
  return {
    jobId: event.jobId || event.job_id || "",
    status: String(event.status || ""),
    repoFullName: event.repoFullName || event.repo_full_name || "",
    createdAt,
    createdAtDate: dateOrNull(createdAt),
  };
}

function normalizeRunClaim(claim = {}) {
  const updatedAt = claim.updatedAt || claim.updated_at || "";
  const expiresAt = claim.expiresAt || claim.expires_at || "";
  return {
    jobId: claim.jobId || claim.job_id || "",
    status: String(claim.status || ""),
    repoFullName: claim.repoFullName || claim.repo_full_name || "",
    updatedAt,
    updatedAtDate: dateOrNull(updatedAt),
    expiresAt,
    expiresAtDate: dateOrNull(expiresAt),
  };
}

function compareAlerts(left, right) {
  const severity = severityRank(right.severity) - severityRank(left.severity);
  if (severity) {
    return severity;
  }
  return (right.sortScore || 0) - (left.sortScore || 0) || left.id.localeCompare(right.id);
}

function severityRank(severity) {
  return severity === "critical" ? 2 : severity === "warning" ? 1 : 0;
}

function severityLabel(severity) {
  return severity === "critical" ? "Critical" : "Warning";
}

function dateOrNull(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateTimeKey(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function positiveInt(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function positiveNumber(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return number;
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

module.exports = {
  ACTIVE_CLAIM_STATUSES,
  FAILURE_STATUSES,
  evaluateJobHealthAlerts,
  jobHealthAlertPolicyFromEnv,
};
