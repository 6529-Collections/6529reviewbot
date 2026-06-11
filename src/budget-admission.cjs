"use strict";

const BUDGET_SCOPES = ["global", "org", "repo", "requestor", "pr", "provider", "model", "review_kind"];

function budgetPolicyFromEnv(env = process.env) {
  return {
    mode: enumValue(env.REVIEWBOT_BUDGET_MODE || "enforce", ["enforce", "warn", "off"], "REVIEWBOT_BUDGET_MODE"),
    currency: "USD",
    defaultEstimatedCostUsd: nonNegativeNumberEnv(
      env.REVIEWBOT_BUDGET_DEFAULT_ESTIMATED_COST_USD,
      1
    ),
    caps: {
      global: capsFromEnv(env, "GLOBAL"),
      org: capsFromEnv(env, "ORG"),
      repo: capsFromEnv(env, "REPO"),
      requestor: capsFromEnv(env, "REQUESTOR"),
      pr: capsFromEnv(env, "PR"),
      provider: capsFromEnv(env, "PROVIDER"),
      model: capsFromEnv(env, "MODEL"),
      review_kind: capsFromEnv(env, "REVIEW_KIND"),
    },
    explicitPolicies: [],
  };
}

function evaluateBudgetAdmission(input) {
  const policy = input.policy || budgetPolicyFromEnv();
  const subject = input.subject || budgetSubjectFromEvent(input.event, input.admission, input.run || {});
  const estimatedCostUsd = estimateCostUsd(input.estimate, subject, policy);
  const policies = budgetPoliciesForSubject(subject, policy);

  if (policy.mode === "off") {
    return budgetDecision("skipped", true, "budget_off", "Budget checks are disabled.", {
      estimatedCostUsd,
      subject,
      exceeded: [],
    });
  }

  if (policies.length === 0) {
    return budgetDecision("allowed", true, "no_budget_caps", "No budget caps are configured.", {
      estimatedCostUsd,
      subject,
      exceeded: [],
    });
  }

  const snapshot = input.spendSnapshot || { unavailable: true, totals: {} };
  if (snapshot.unavailable) {
    const reason = snapshot.reason || "Budget spend snapshot is unavailable.";
    return budgetDecision(policy.mode === "warn" ? "warning" : "denied", policy.mode === "warn", "budget_snapshot_unavailable", reason, {
      estimatedCostUsd,
      subject,
      exceeded: [],
    });
  }

  const exceeded = [];
  for (const budget of policies) {
    for (const period of ["daily", "weekly", "monthly"]) {
      const capUsd = budget[`${period}BudgetUsd`];
      if (capUsd === null || capUsd === undefined) {
        continue;
      }
      const currentUsd = currentSpendUsd(snapshot, budget.scopeType, budget.scopeValue, period);
      const estimatedForScope = estimatedCostForScope(estimatedCostUsd, subject, budget.scopeType);
      const projectedUsd = roundUsd(currentUsd + estimatedForScope);
      if (projectedUsd > capUsd) {
        exceeded.push({
          scopeType: budget.scopeType,
          scopeValue: budget.scopeValue,
          period,
          currentUsd,
          estimatedUsd: estimatedForScope,
          projectedUsd,
          capUsd,
        });
      }
    }
  }

  if (exceeded.length === 0) {
    return budgetDecision("allowed", true, "within_budget", "Estimated review spend is within configured budgets.", {
      estimatedCostUsd,
      subject,
      exceeded,
    });
  }

  if (policy.mode === "warn") {
    return budgetDecision("warning", true, "budget_exceeded_warning", "Estimated review spend exceeds configured budget, but budget mode is warn.", {
      estimatedCostUsd,
      subject,
      exceeded,
    });
  }

  return budgetDecision("denied", false, "budget_exceeded", "Estimated review spend exceeds configured budget.", {
    estimatedCostUsd,
    subject,
    exceeded,
  });
}

function budgetSubjectFromEvent(event = {}, admission = {}, run = {}) {
  const repo = event.repository?.fullName || "";
  const org = repo.includes("/") ? repo.split("/")[0] : "";
  const reviewKinds = event.reviewKinds || [];
  return {
    org,
    repo,
    pr: repo && event.prNumber ? `${repo}#${event.prNumber}` : "",
    prNumber: event.prNumber || null,
    requestor: admission.requestor || event.commentAuthor || event.actor || event.prAuthor || "",
    provider: run.provider || "",
    model: run.model || "",
    reviewKinds,
  };
}

function budgetPoliciesForSubject(subject, policy) {
  const policies = [];
  for (const scopeType of BUDGET_SCOPES) {
    const caps = policy.caps?.[scopeType] || {};
    if (!hasCaps(caps)) {
      continue;
    }
    if (scopeType === "review_kind") {
      for (const scopeValue of subject.reviewKinds || []) {
        policies.push({
          scopeType,
          scopeValue,
          dailyBudgetUsd: caps.dailyBudgetUsd,
          weeklyBudgetUsd: caps.weeklyBudgetUsd,
          monthlyBudgetUsd: caps.monthlyBudgetUsd,
        });
      }
      continue;
    }
    const scopeValue = scopeValueForSubject(subject, scopeType);
    if (scopeValue) {
      policies.push({
        scopeType,
        scopeValue,
        dailyBudgetUsd: caps.dailyBudgetUsd,
        weeklyBudgetUsd: caps.weeklyBudgetUsd,
        monthlyBudgetUsd: caps.monthlyBudgetUsd,
      });
    }
  }

  for (const explicit of policy.explicitPolicies || []) {
    if (!explicit.enabled) {
      continue;
    }
    const scopeValue = explicit.scopeValue === "*" ? scopeValueForSubject(subject, explicit.scopeType) || "*" : explicit.scopeValue;
    if (!scopeValueMatchesSubject(subject, explicit.scopeType, explicit.scopeValue)) {
      continue;
    }
    policies.push({
      scopeType: explicit.scopeType,
      scopeValue,
      dailyBudgetUsd: nullableNumber(explicit.dailyBudgetUsd),
      weeklyBudgetUsd: nullableNumber(explicit.weeklyBudgetUsd),
      monthlyBudgetUsd: nullableNumber(explicit.monthlyBudgetUsd),
    });
  }

  return policies;
}

function scopeValueForSubject(subject, scopeType) {
  if (scopeType === "global") {
    return "*";
  }
  if (scopeType === "review_kind") {
    return subject.reviewKinds.length === 1 ? subject.reviewKinds[0] : "*";
  }
  return subject[scopeType] || "";
}

function scopeValueMatchesSubject(subject, scopeType, scopeValue) {
  if (!BUDGET_SCOPES.includes(scopeType)) {
    return false;
  }
  if (scopeValue === "*") {
    return Boolean(scopeValueForSubject(subject, scopeType) || scopeType === "global");
  }
  if (scopeType === "review_kind") {
    return subject.reviewKinds.includes(scopeValue);
  }
  return scopeValueForSubject(subject, scopeType) === scopeValue;
}

function estimateCostUsd(estimate, subject, policy) {
  if (estimate && estimate.estimatedCostUsd !== undefined) {
    return roundUsd(nonNegativeNumber(estimate.estimatedCostUsd, "estimatedCostUsd"));
  }
  const reviewKindCount = Math.max(1, subject.reviewKinds.length || 1);
  return roundUsd(policy.defaultEstimatedCostUsd * reviewKindCount);
}

function estimatedCostForScope(totalEstimatedUsd, subject, scopeType) {
  if (scopeType !== "review_kind") {
    return totalEstimatedUsd;
  }
  return roundUsd(totalEstimatedUsd / Math.max(1, subject.reviewKinds.length || 1));
}

function currentSpendUsd(snapshot, scopeType, scopeValue, period) {
  const key = budgetScopeKey(scopeType, scopeValue);
  const totals = snapshot.totals?.[key] || {};
  return roundUsd(Number(totals[`${period}Usd`] || 0));
}

function budgetScopeKey(scopeType, scopeValue) {
  return `${scopeType}:${scopeValue}`;
}

function capsFromEnv(env, prefix) {
  return {
    dailyBudgetUsd: optionalUsd(env[`REVIEWBOT_BUDGET_${prefix}_DAILY_USD`]),
    weeklyBudgetUsd: optionalUsd(env[`REVIEWBOT_BUDGET_${prefix}_WEEKLY_USD`]),
    monthlyBudgetUsd: optionalUsd(env[`REVIEWBOT_BUDGET_${prefix}_MONTHLY_USD`]),
  };
}

function hasCaps(caps) {
  return ["dailyBudgetUsd", "weeklyBudgetUsd", "monthlyBudgetUsd"].some(
    (key) => caps[key] !== null && caps[key] !== undefined
  );
}

function optionalUsd(value) {
  if (value === undefined || value === "") {
    return null;
  }
  return nonNegativeNumber(value, "budget cap");
}

function nonNegativeNumberEnv(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  return nonNegativeNumber(value, "budget value");
}

function nonNegativeNumber(value, name) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function nullableNumber(value) {
  return value === null || value === undefined ? null : nonNegativeNumber(value, "budget value");
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) {
    throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function roundUsd(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function budgetDecision(status, allowed, code, reason, data) {
  return {
    status,
    allowed,
    code,
    reason,
    currency: "USD",
    ...data,
  };
}

module.exports = {
  BUDGET_SCOPES,
  budgetPolicyFromEnv,
  budgetPoliciesForSubject,
  budgetScopeKey,
  budgetSubjectFromEvent,
  evaluateBudgetAdmission,
  estimateCostUsd,
};
