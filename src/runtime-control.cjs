"use strict";

function runtimeControlPolicyFromEnv(env = process.env) {
  return {
    enabled: parseBool(env.REVIEWBOT_ENABLED || "true"),
    disabledReason:
      env.REVIEWBOT_DISABLED_REASON || "Review automation is disabled by runtime control.",
    disabledOrganizations: csvSet(env.REVIEWBOT_DISABLED_ORGS || ""),
    disabledRepositories: csvSet(env.REVIEWBOT_DISABLED_REPOS || ""),
    disabledProviders: csvSet(env.REVIEWBOT_DISABLED_PROVIDERS || ""),
    disabledModels: csvSet(env.REVIEWBOT_DISABLED_MODELS || ""),
    disabledReviewKinds: csvSet(env.REVIEWBOT_DISABLED_REVIEW_KINDS || ""),
  };
}

function applyRuntimeControlToEvent(event = {}, policy = runtimeControlPolicyFromEnv()) {
  if (!event.shouldEnqueue) {
    return {
      event,
      control: decision("skipped", true, "event_not_enqueued", event.reason || "Event does not request review work."),
    };
  }

  const repo = String(event.repository?.fullName || "");
  const org = repo.includes("/") ? repo.split("/")[0] : "";
  if (!policy.enabled) {
    return disabledEvent(event, "runtime_disabled", policy.disabledReason);
  }
  if (org && policy.disabledOrganizations.has(org.toLowerCase())) {
    return disabledEvent(event, "org_disabled", `Review automation is disabled for organization '${org}'.`);
  }
  if (repo && policy.disabledRepositories.has(repo.toLowerCase())) {
    return disabledEvent(event, "repo_disabled", `Review automation is disabled for repository '${repo}'.`);
  }

  const reviewKinds = event.reviewKinds || [];
  const allowedReviewKinds = reviewKinds.filter(
    (kind) => !policy.disabledReviewKinds.has(String(kind).toLowerCase())
  );
  if (reviewKinds.length && allowedReviewKinds.length === 0) {
    return disabledEvent(event, "review_kind_disabled", "All requested review kinds are disabled by runtime control.");
  }
  if (allowedReviewKinds.length !== reviewKinds.length) {
    return {
      event: { ...event, reviewKinds: allowedReviewKinds },
      control: decision("filtered", true, "review_kinds_filtered", "Some requested review kinds are disabled by runtime control.", {
        disabledReviewKinds: reviewKinds.filter((kind) => !allowedReviewKinds.includes(kind)),
      }),
    };
  }

  return {
    event,
    control: decision("allowed", true, "runtime_control_allowed", "Runtime control allows this event."),
  };
}

function filterRuntimeControlJobs(jobs = [], policy = runtimeControlPolicyFromEnv()) {
  const allowedJobs = [];
  const deniedJobs = [];
  for (const job of jobs) {
    const denial = runtimeJobDenial(job, policy);
    if (!denial) {
      allowedJobs.push(job);
      continue;
    }
    deniedJobs.push({
      ...job,
      status: "runtime_disabled",
      runtimeControl: denial,
    });
  }
  return {
    jobs: allowedJobs,
    deniedJobs,
    control: {
      status: deniedJobs.length ? (allowedJobs.length ? "partial" : "denied") : "allowed",
      allowed: allowedJobs.length > 0,
      code: deniedJobs.length ? "jobs_filtered" : "runtime_control_allowed",
      reason: deniedJobs.length
        ? "Some review jobs are disabled by runtime control."
        : "Runtime control allows all jobs.",
      deniedJobs: deniedJobs.length,
      totalJobs: jobs.length,
    },
  };
}

function publicRuntimeControlDecision(control = {}) {
  return {
    status: control.status || "",
    allowed: control.allowed !== false,
    code: control.code || "",
    reason: control.reason || "",
    deniedJobs: control.deniedJobs || 0,
    totalJobs: control.totalJobs || 0,
  };
}

function runtimeControlPolicySummary(policy = runtimeControlPolicyFromEnv()) {
  return {
    enabled: policy.enabled !== false,
    disabledOrganizations: Array.from(policy.disabledOrganizations || []),
    disabledRepositories: Array.from(policy.disabledRepositories || []),
    disabledProviders: Array.from(policy.disabledProviders || []),
    disabledModels: Array.from(policy.disabledModels || []),
    disabledReviewKinds: Array.from(policy.disabledReviewKinds || []),
  };
}

function runtimeJobDenial(job, policy) {
  const provider = String(job.provider || "").toLowerCase();
  if (provider && policy.disabledProviders.has(provider)) {
    return decision("denied", false, "provider_disabled", `Provider '${job.provider}' is disabled by runtime control.`);
  }
  const model = String(job.model || "").toLowerCase();
  if (model && policy.disabledModels.has(model)) {
    return decision("denied", false, "model_disabled", `Model '${job.model}' is disabled by runtime control.`);
  }
  const reviewKind = String(job.reviewKind || "").toLowerCase();
  if (reviewKind && policy.disabledReviewKinds.has(reviewKind)) {
    return decision("denied", false, "review_kind_disabled", `Review kind '${job.reviewKind}' is disabled by runtime control.`);
  }
  return null;
}

function disabledEvent(event, code, reason) {
  return {
    event: {
      ...event,
      shouldEnqueue: false,
      reviewKinds: [],
      reason,
    },
    control: decision("denied", false, code, reason),
  };
}

function decision(status, allowed, code, reason, extra = {}) {
  return {
    status,
    allowed,
    code,
    reason,
    ...extra,
  };
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function csvSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

module.exports = {
  applyRuntimeControlToEvent,
  filterRuntimeControlJobs,
  publicRuntimeControlDecision,
  runtimeControlPolicyFromEnv,
  runtimeControlPolicySummary,
};
