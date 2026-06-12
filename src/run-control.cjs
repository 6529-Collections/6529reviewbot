"use strict";

const crypto = require("crypto");

const RUN_CONTROL_SCOPES = [
  "global",
  "org",
  "repo",
  "requestor",
  "pr",
  "provider",
  "model",
  "review_kind",
];

function runControlPolicyFromEnv(env = process.env) {
  const mode = enumValue(
    env.REVIEWBOT_RUN_CONTROL_MODE || "off",
    ["off", "warn", "enforce"],
    "REVIEWBOT_RUN_CONTROL_MODE"
  );
  return {
    mode,
    dedupeEnabled: boolEnv(
      env.REVIEWBOT_RUN_CONTROL_DEDUPE_ENABLED,
      mode !== "off"
    ),
    dedupeTtlSeconds: positiveIntEnv(
      env.REVIEWBOT_RUN_CONTROL_DEDUPE_TTL_SECONDS,
      24 * 60 * 60,
      "REVIEWBOT_RUN_CONTROL_DEDUPE_TTL_SECONDS"
    ),
    maxConcurrent: {
      global: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_GLOBAL_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_GLOBAL_MAX_CONCURRENT"
      ),
      org: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_ORG_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_ORG_MAX_CONCURRENT"
      ),
      repo: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_REPO_MAX_CONCURRENT"
      ),
      requestor: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_REQUESTOR_MAX_CONCURRENT"
      ),
      pr: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_PR_MAX_CONCURRENT"
      ),
      provider: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_PROVIDER_MAX_CONCURRENT"
      ),
      model: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_MODEL_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_MODEL_MAX_CONCURRENT"
      ),
      review_kind: optionalNonNegativeIntEnv(
        env.REVIEWBOT_RUN_CONTROL_REVIEW_KIND_MAX_CONCURRENT,
        "REVIEWBOT_RUN_CONTROL_REVIEW_KIND_MAX_CONCURRENT"
      ),
    },
  };
}

function evaluateRunControl(input = {}) {
  const policy = input.policy || runControlPolicyFromEnv();
  const job = input.job || {};
  const subject = input.subject || runControlSubjectFromJob(job);
  const runKey = input.runKey || runControlKeyForJob(job);

  if (policy.mode === "off") {
    return runControlDecision("skipped", true, "run_control_off", "Run control is disabled.", {
      runKey,
      subject,
      duplicate: null,
      exceeded: [],
    });
  }

  const snapshot = input.snapshot || { unavailable: true };
  if (snapshot.unavailable) {
    const reason = snapshot.reason || "Run-control claim snapshot is unavailable.";
    return runControlDecision(
      policy.mode === "warn" ? "warning" : "denied",
      policy.mode === "warn",
      "run_control_snapshot_unavailable",
      reason,
      {
        runKey,
        subject,
        duplicate: null,
        exceeded: [],
      }
    );
  }

  if (policy.dedupeEnabled && snapshot.duplicate) {
    return runControlDecision(
      policy.mode === "warn" ? "warning" : "denied",
      policy.mode === "warn",
      "duplicate_run",
      "A matching review job is already claimed or has already run.",
      {
        runKey,
        subject,
        duplicate: publicDuplicate(snapshot.duplicate),
        exceeded: [],
      }
    );
  }

  const exceeded = concurrencyExcesses(subject, policy, snapshot);
  if (exceeded.length) {
    return runControlDecision(
      policy.mode === "warn" ? "warning" : "denied",
      policy.mode === "warn",
      "concurrency_limit_exceeded",
      "Review concurrency would exceed configured run-control limits.",
      {
        runKey,
        subject,
        duplicate: null,
        exceeded,
      }
    );
  }

  return runControlDecision(
    "allowed",
    true,
    policy.dedupeEnabled || hasConcurrencyLimits(policy)
      ? "run_control_claimed"
      : "run_control_no_limits",
    "Run-control checks passed.",
    {
      runKey,
      subject,
      duplicate: null,
      exceeded: [],
    }
  );
}

function attachRunControlToReviewJob(job, runControl) {
  const next = { ...job, runControl: runControl || null };
  if (!runControl) {
    return next;
  }
  if (!runControl.allowed) {
    return { ...next, status: "run_control_denied" };
  }
  if (runControl.status === "warning") {
    return { ...next, status: "run_control_warning" };
  }
  return { ...next, status: "admitted" };
}

function runControlSummaryForJobs(jobs) {
  const decisions = (jobs || []).map((job) => job.runControl).filter(Boolean);
  const active = decisions.filter((decision) => decision.status !== "skipped");
  const denied = active.filter((decision) => !decision.allowed);
  const warnings = active.filter((decision) => decision.status === "warning");
  if (!active.length) {
    return {
      status: "skipped",
      allowed: true,
      code: "run_control_off",
      reason: "Run control is disabled.",
      deniedJobs: 0,
      warningJobs: 0,
      totalJobs: decisions.length,
    };
  }
  if (denied.length > 0 && denied.length === active.length) {
    return {
      status: "denied",
      allowed: false,
      code: denied[0].code,
      reason: denied[0].reason,
      deniedJobs: denied.length,
      warningJobs: warnings.length,
      totalJobs: active.length,
    };
  }
  if (denied.length > 0) {
    return {
      status: "partial",
      allowed: true,
      code: "some_jobs_run_control_denied",
      reason: "Some review jobs were denied by run control.",
      deniedJobs: denied.length,
      warningJobs: warnings.length,
      totalJobs: active.length,
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
      totalJobs: active.length,
    };
  }
  return {
    status: "allowed",
    allowed: true,
    code: active[0]?.code || "run_control_claimed",
    reason: active[0]?.reason || "Run-control checks passed.",
    deniedJobs: 0,
    warningJobs: 0,
    totalJobs: active.length,
  };
}

function runControlSubjectFromJob(job = {}) {
  const repo = job.repository?.fullName || "";
  const org = repo.includes("/") ? repo.split("/")[0] : "";
  return {
    org,
    repo,
    pr: repo && job.prNumber ? `${repo}#${job.prNumber}` : "",
    prNumber: job.prNumber || null,
    requestor: job.requestor || job.actor || job.prAuthor || "",
    provider: job.provider || "",
    model: job.model || "",
    reviewKind: job.reviewKind || "",
  };
}

function runControlKeyForJob(job = {}) {
  if (job.runKey) {
    return job.runKey;
  }
  const parts = [
    job.repository?.fullName || "",
    job.prNumber || "",
    job.headSha || "",
    job.trigger || "",
    job.commentId || "",
    job.commandName || "",
    job.reviewKind || "",
    job.provider || "",
    job.model || "",
  ];
  const hash = crypto.createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
  return `rk_${hash}`;
}

function runControlScopeKey(scopeType, scopeValue) {
  return `${scopeType}:${scopeValue}`;
}

function runControlScopeValue(subject, scopeType) {
  if (scopeType === "global") {
    return "*";
  }
  if (scopeType === "review_kind") {
    return subject.reviewKind || "";
  }
  return subject[scopeType] || "";
}

function concurrencyExcesses(subject, policy, snapshot) {
  const exceeded = [];
  for (const scopeType of RUN_CONTROL_SCOPES) {
    const maxConcurrent = policy.maxConcurrent?.[scopeType];
    if (maxConcurrent === null || maxConcurrent === undefined) {
      continue;
    }
    const scopeValue = runControlScopeValue(subject, scopeType);
    if (!scopeValue) {
      continue;
    }
    const active = activeCountForScope(snapshot, scopeType, scopeValue);
    if (active >= maxConcurrent) {
      exceeded.push({
        scopeType,
        scopeValue,
        active,
        maxConcurrent,
      });
    }
  }
  return exceeded;
}

function activeCountForScope(snapshot, scopeType, scopeValue) {
  const active = snapshot.active || {};
  return nonNegativeInteger(active[runControlScopeKey(scopeType, scopeValue)] || 0, "active count");
}

function hasConcurrencyLimits(policy) {
  return Object.values(policy.maxConcurrent || {}).some(
    (value) => value !== null && value !== undefined
  );
}

function publicDuplicate(duplicate) {
  if (!duplicate || typeof duplicate !== "object") {
    return null;
  }
  return {
    runKey: duplicate.runKey || "",
    jobId: duplicate.jobId || "",
    status: duplicate.status || "",
    createdAt: duplicate.createdAt || "",
  };
}

function runControlDecision(status, allowed, code, reason, data) {
  return {
    status,
    allowed,
    code,
    reason,
    ...data,
  };
}

function boolEnv(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
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

function optionalNonNegativeIntEnv(value, name) {
  if (value === undefined || value === "") {
    return null;
  }
  return nonNegativeInteger(value, name);
}

function nonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

module.exports = {
  RUN_CONTROL_SCOPES,
  attachRunControlToReviewJob,
  evaluateRunControl,
  runControlKeyForJob,
  runControlPolicyFromEnv,
  runControlScopeKey,
  runControlScopeValue,
  runControlSubjectFromJob,
  runControlSummaryForJobs,
};
