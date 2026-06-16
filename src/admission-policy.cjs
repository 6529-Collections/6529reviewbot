"use strict";

const ADMISSION_REPO_MODES = ["trusted", "off", "open"];
const DRAFT_PR_MODES = ["skip_all", "skip", "auto_only", "allow"];
const DRAFT_PR_MODE_CAPABILITIES = Object.freeze({
  skip_all: Object.freeze({ automatic: false, commands: false }),
  skip: Object.freeze({ automatic: false, commands: true }),
  auto_only: Object.freeze({ automatic: true, commands: false }),
  allow: Object.freeze({ automatic: true, commands: true }),
});
const TRUSTED_PERMISSION_ORDER = ["none", "read", "triage", "write", "maintain", "admin"];
const DEFAULT_ADMISSION_POLICY = {
  publicRepoMode: "trusted",
  privateRepoMode: "open",
  draftPrMode: "skip",
  trustedPermission: "write",
};

function admissionPolicyFromEnv(env = process.env) {
  return {
    publicRepoMode: enumValue(
      env.REVIEWBOT_PUBLIC_REPO_MODE || DEFAULT_ADMISSION_POLICY.publicRepoMode,
      ADMISSION_REPO_MODES,
      "REVIEWBOT_PUBLIC_REPO_MODE"
    ),
    privateRepoMode: enumValue(
      env.REVIEWBOT_PRIVATE_REPO_MODE || DEFAULT_ADMISSION_POLICY.privateRepoMode,
      ADMISSION_REPO_MODES,
      "REVIEWBOT_PRIVATE_REPO_MODE"
    ),
    draftPrMode: enumValue(
      env.REVIEWBOT_DRAFT_PR_MODE || DEFAULT_ADMISSION_POLICY.draftPrMode,
      DRAFT_PR_MODES,
      "REVIEWBOT_DRAFT_PR_MODE"
    ),
    trustedUsers: csvSet(env.REVIEWBOT_TRUSTED_USERS || ""),
    trustedTeams: csvSet(env.REVIEWBOT_TRUSTED_TEAMS || ""),
    trustedOrganizations: csvSet(env.REVIEWBOT_TRUSTED_ORGS || ""),
    trustedPermission: enumValue(
      env.REVIEWBOT_TRUSTED_PERMISSION || DEFAULT_ADMISSION_POLICY.trustedPermission,
      TRUSTED_PERMISSION_ORDER,
      "REVIEWBOT_TRUSTED_PERMISSION"
    ),
    allowedPrAuthors: csvSet(env.REVIEWBOT_ALLOWED_PR_AUTHORS || ""),
    denyUsers: csvSet(env.REVIEWBOT_DENY_USERS || ""),
  };
}

function evaluateAdmission(event, actorContext = {}, policy = admissionPolicyFromEnv()) {
  if (!event || !event.kind) {
    return denied("missing_event", "No normalized event was provided.", "", policy);
  }

  if (event.kind === "ping" || event.kind === "ignored") {
    return skipped("ignored_event", event.reason || "Event does not request review work.", "", policy);
  }

  const requestor = requestorForEvent(event);
  const normalizedActor = normalizeActorContext(requestor, actorContext);
  if (policy.denyUsers.has(normalizedActor.login)) {
    return denied("blocked_actor", `Actor '${requestor}' is blocked by policy.`, requestor, policy);
  }

  if (!event.reviewKinds || event.reviewKinds.length === 0) {
    return skipped("no_review_kinds", "Event does not request model review work.", requestor, policy);
  }

  if (event.draft) {
    const draftCapabilities = draftPrModeCapabilities(policy.draftPrMode);
    if (isExplicitReviewRequest(event)) {
      if (!draftCapabilities.commands) {
        return skipped(
          "draft_pull_request",
          "Explicit draft pull request review commands are disabled by policy.",
          requestor,
          policy
        );
      }
    } else if (!draftCapabilities.automatic) {
      return skipped(
        "draft_pull_request",
        "Automatic draft pull request reviews are skipped until ready for review.",
        requestor,
        policy
      );
    }
  }

  if (policy.allowedPrAuthors.size) {
    const prAuthor = String(event.prAuthor || "").toLowerCase();
    if (!prAuthor) {
      return denied("missing_pr_author", "PR author is required by policy.", requestor, policy);
    }
    if (!policy.allowedPrAuthors.has(prAuthor)) {
      return denied(
        "blocked_pr_author",
        `PR author '${event.prAuthor}' is not allowed by policy.`,
        requestor,
        policy
      );
    }
  }

  const repoMode = event.repository?.private ? policy.privateRepoMode : policy.publicRepoMode;
  if (repoMode === "off") {
    return skipped("repo_mode_off", "Review automation is disabled for this repository visibility.", requestor, policy);
  }

  if (repoMode === "open") {
    return allowed("repo_mode_open", "Repository policy allows review requests from any actor.", requestor, policy, {
      trustedActor: isTrustedActor(normalizedActor, policy),
    });
  }

  if (isTrustedActor(normalizedActor, policy)) {
    return allowed("trusted_actor", "Actor is trusted for review requests.", requestor, policy, {
      trustedActor: true,
    });
  }

  return denied(
    "untrusted_actor",
    "Public repositories require a trusted actor before model review work can run.",
    requestor,
    policy,
    { trustedActor: false }
  );
}

function normalizeActorContext(requestor, actorContext = {}) {
  const permission = normalizePermission(actorContext.permission || actorContext.repositoryPermission || "none");
  return {
    login: String(actorContext.login || actorContext.actor || requestor || "").toLowerCase(),
    isOrgMember: Boolean(actorContext.isOrgMember || actorContext.organizationMember),
    teams: new Set((actorContext.teams || []).map((team) => String(team).toLowerCase())),
    organizations: new Set((actorContext.organizations || []).map((org) => String(org).toLowerCase())),
    permission,
  };
}

function isTrustedActor(actor, policy) {
  if (!actor.login) {
    return false;
  }
  if (policy.trustedUsers.has(actor.login)) {
    return true;
  }
  if (actor.isOrgMember) {
    return true;
  }
  for (const org of actor.organizations) {
    if (policy.trustedOrganizations.has(org)) {
      return true;
    }
  }
  for (const team of actor.teams) {
    if (policy.trustedTeams.has(team)) {
      return true;
    }
  }
  return permissionAtLeast(actor.permission, policy.trustedPermission);
}

function requestorForEvent(event) {
  if (event.trigger === "comment") {
    return event.commentAuthor || event.actor || "";
  }
  return event.actor || event.prAuthor || "";
}

function isExplicitReviewRequest(event) {
  return event?.trigger === "comment";
}

function draftPrModeCapabilities(mode) {
  const capabilities = DRAFT_PR_MODE_CAPABILITIES[mode];
  if (!capabilities) {
    throw new Error(`draft PR mode must be one of: ${DRAFT_PR_MODES.join(", ")}`);
  }
  return capabilities;
}

function draftPrModeFromCapabilities(capabilities) {
  const automatic = Boolean(capabilities?.automatic);
  const commands = Boolean(capabilities?.commands);
  if (!automatic && !commands) {
    return "skip_all";
  }
  if (!automatic && commands) {
    return "skip";
  }
  if (automatic && !commands) {
    return "auto_only";
  }
  return "allow";
}

function restrictiveDraftPrMode(baseMode, configuredMode) {
  const base = draftPrModeCapabilities(baseMode || DEFAULT_ADMISSION_POLICY.draftPrMode);
  const configured = draftPrModeCapabilities(configuredMode || baseMode || DEFAULT_ADMISSION_POLICY.draftPrMode);
  return draftPrModeFromCapabilities({
    automatic: base.automatic && configured.automatic,
    commands: base.commands && configured.commands,
  });
}

function permissionAtLeast(actual, required) {
  const actualIndex = TRUSTED_PERMISSION_ORDER.indexOf(normalizePermission(actual));
  const requiredIndex = TRUSTED_PERMISSION_ORDER.indexOf(normalizePermission(required));
  return actualIndex >= requiredIndex;
}

function normalizePermission(value) {
  const lower = String(value || "none").toLowerCase();
  return TRUSTED_PERMISSION_ORDER.includes(lower) ? lower : "none";
}

function csvSet(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function allowed(code, reason, requestor, policy, extra = {}) {
  return decision("allowed", true, code, reason, requestor, policy, extra);
}

function denied(code, reason, requestor, policy, extra = {}) {
  return decision("denied", false, code, reason, requestor, policy, extra);
}

function skipped(code, reason, requestor, policy, extra = {}) {
  return decision("skipped", false, code, reason, requestor, policy, extra);
}

function decision(status, allowedValue, code, reason, requestor, policy, extra) {
  return {
    status,
    allowed: allowedValue,
    code,
    reason,
    requestor,
    policy: {
      publicRepoMode: policy.publicRepoMode,
      privateRepoMode: policy.privateRepoMode,
      draftPrMode: policy.draftPrMode,
      trustedPermission: policy.trustedPermission,
    },
    ...extra,
  };
}

module.exports = {
  ADMISSION_REPO_MODES,
  DEFAULT_ADMISSION_POLICY,
  DRAFT_PR_MODE_CAPABILITIES,
  DRAFT_PR_MODES,
  TRUSTED_PERMISSION_ORDER,
  admissionPolicyFromEnv,
  draftPrModeCapabilities,
  draftPrModeFromCapabilities,
  evaluateAdmission,
  isExplicitReviewRequest,
  isTrustedActor,
  normalizeActorContext,
  permissionAtLeast,
  requestorForEvent,
  restrictiveDraftPrMode,
};
