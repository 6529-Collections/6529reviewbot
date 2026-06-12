"use strict";

const DEFAULT_BUDGET_WARNING_PERCENT = 80;
const DEFAULT_BUDGET_CRITICAL_PERCENT = 100;
const DEFAULT_SPIKE_WINDOW_HOURS = 24;
const DEFAULT_SPIKE_BASELINE_DAYS = 7;
const DEFAULT_SPIKE_MULTIPLIER = 3;
const DEFAULT_SPIKE_MIN_USD = 25;
const DEFAULT_MAX_ALERTS = 50;
const DEFAULT_SPIKE_DIMENSIONS = ["global", "repo", "requestor", "provider", "model", "review_kind"];

const BUDGET_PERIODS = [
  { name: "daily", capKey: "dailyBudgetUsd", start: startOfUtcDay },
  { name: "weekly", capKey: "weeklyBudgetUsd", start: startOfUtcWeek },
  { name: "monthly", capKey: "monthlyBudgetUsd", start: startOfUtcMonth },
];

function spendAlertPolicyFromEnv(env = process.env) {
  const budgetWarningPercent = positiveNumber(
    env.REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT,
    DEFAULT_BUDGET_WARNING_PERCENT,
    "REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT"
  );
  const budgetCriticalPercent = positiveNumber(
    env.REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT,
    DEFAULT_BUDGET_CRITICAL_PERCENT,
    "REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT"
  );
  if (budgetWarningPercent > budgetCriticalPercent) {
    throw new Error("REVIEWBOT_ALERTS_BUDGET_WARNING_PERCENT must be <= REVIEWBOT_ALERTS_BUDGET_CRITICAL_PERCENT.");
  }
  return {
    enabled: parseBool(env.REVIEWBOT_ALERTS_ENABLED || "false"),
    budgetWarningPercent,
    budgetCriticalPercent,
    spikeWindowHours: positiveInt(
      env.REVIEWBOT_ALERTS_SPIKE_WINDOW_HOURS,
      DEFAULT_SPIKE_WINDOW_HOURS,
      "REVIEWBOT_ALERTS_SPIKE_WINDOW_HOURS"
    ),
    spikeBaselineDays: positiveInt(
      env.REVIEWBOT_ALERTS_SPIKE_BASELINE_DAYS,
      DEFAULT_SPIKE_BASELINE_DAYS,
      "REVIEWBOT_ALERTS_SPIKE_BASELINE_DAYS"
    ),
    spikeMultiplier: positiveNumber(
      env.REVIEWBOT_ALERTS_SPIKE_MULTIPLIER,
      DEFAULT_SPIKE_MULTIPLIER,
      "REVIEWBOT_ALERTS_SPIKE_MULTIPLIER"
    ),
    spikeMinUsd: nonNegativeNumber(
      env.REVIEWBOT_ALERTS_SPIKE_MIN_USD,
      DEFAULT_SPIKE_MIN_USD,
      "REVIEWBOT_ALERTS_SPIKE_MIN_USD"
    ),
    spikeDimensions: csv(env.REVIEWBOT_ALERTS_SPIKE_DIMENSIONS || DEFAULT_SPIKE_DIMENSIONS.join(",")),
    alertOnNewSpend: parseBool(env.REVIEWBOT_ALERTS_SPIKE_ALERT_ON_NEW_SPEND || "true"),
    maxAlerts: positiveInt(env.REVIEWBOT_ALERTS_MAX_ALERTS, DEFAULT_MAX_ALERTS, "REVIEWBOT_ALERTS_MAX_ALERTS"),
  };
}

function evaluateSpendAlerts(input = {}) {
  const policy = input.policy || spendAlertPolicyFromEnv(input.env);
  const now = input.now ? new Date(input.now) : new Date();
  const events = (input.events || []).map(normalizeUsageEvent).filter((event) => event.createdAtDate);
  const budgetPolicies = (input.budgetPolicies || []).map(normalizeBudgetPolicy).filter((budget) => budget.enabled);
  const alerts = [
    ...budgetUtilizationAlerts(events, budgetPolicies, now, policy),
    ...spendSpikeAlerts(events, now, policy),
  ];
  return alerts.sort(compareAlerts).slice(0, policy.maxAlerts);
}

function budgetUtilizationAlerts(events, budgetPolicies, now, policy) {
  const alerts = [];
  for (const budget of budgetPolicies) {
    for (const period of BUDGET_PERIODS) {
      const capUsd = nullableNumber(budget[period.capKey]);
      if (!capUsd || capUsd <= 0) {
        continue;
      }
      const periodStart = period.start(now);
      const currentCostUsd = roundUsd(
        events
          .filter((event) => event.createdAtDate >= periodStart && event.createdAtDate <= now)
          .filter((event) => eventMatchesScope(event, budget.scopeType, budget.scopeValue))
          .reduce((total, event) => total + event.costUsd, 0)
      );
      const percent = capUsd > 0 ? roundPercent((currentCostUsd / capUsd) * 100) : 0;
      if (percent < policy.budgetWarningPercent) {
        continue;
      }
      const severity = percent >= policy.budgetCriticalPercent ? "critical" : "warning";
      alerts.push({
        id: `budget_utilization:${period.name}:${budget.scopeType}:${budget.scopeValue}:${dateKey(periodStart)}`,
        kind: "budget_utilization",
        severity,
        title: `${severityLabel(severity)} ${period.name} budget utilization for ${scopeLabel(budget.scopeType, budget.scopeValue)}`,
        message: `${scopeLabel(budget.scopeType, budget.scopeValue)} has used $${formatUsd(currentCostUsd)} of its ${period.name} $${formatUsd(capUsd)} budget (${percent}%).`,
        scopeType: budget.scopeType,
        scopeValue: budget.scopeValue,
        period: period.name,
        currentCostUsd,
        capUsd,
        percent,
        thresholdPercent: severity === "critical" ? policy.budgetCriticalPercent : policy.budgetWarningPercent,
        sortScore: percent,
      });
    }
  }
  return alerts;
}

function spendSpikeAlerts(events, now, policy) {
  const alerts = [];
  const windowMs = policy.spikeWindowHours * 60 * 60 * 1000;
  const nowMs = now.getTime();
  const currentStart = new Date(nowMs - windowMs);
  const baselineStart = new Date(currentStart.getTime() - policy.spikeBaselineDays * 24 * 60 * 60 * 1000);
  const baselineWindows = Math.max(1, Math.floor((currentStart.getTime() - baselineStart.getTime()) / windowMs));
  const dimensions = policy.spikeDimensions.length ? policy.spikeDimensions : DEFAULT_SPIKE_DIMENSIONS;

  for (const dimension of dimensions) {
    const current = groupSpend(
      events.filter((event) => event.createdAtDate >= currentStart && event.createdAtDate <= now),
      dimension
    );
    const baseline = groupSpend(
      events.filter((event) => event.createdAtDate >= baselineStart && event.createdAtDate < currentStart),
      dimension
    );
    for (const [scopeValue, currentCostUsd] of current.entries()) {
      if (currentCostUsd <= 0) {
        continue;
      }
      const baselineCostUsd = baseline.get(scopeValue) || 0;
      const baselineAverageUsd = roundUsd(baselineCostUsd / baselineWindows);
      const multiplierThresholdUsd = baselineAverageUsd * policy.spikeMultiplier;
      const thresholdUsd = roundUsd(Math.max(policy.spikeMinUsd, multiplierThresholdUsd));
      const isNewSpend = baselineAverageUsd === 0 && policy.alertOnNewSpend;
      if (currentCostUsd < thresholdUsd || (!isNewSpend && baselineAverageUsd === 0)) {
        continue;
      }
      const ratio = baselineAverageUsd > 0 ? roundPercent(currentCostUsd / baselineAverageUsd) : null;
      const severity = currentCostUsd >= thresholdUsd * 2 ? "critical" : "warning";
      alerts.push({
        id: `spend_spike:${dimension}:${scopeValue}:${dateTimeKey(currentStart)}`,
        kind: "spend_spike",
        severity,
        title: `${severityLabel(severity)} spend spike for ${scopeLabel(dimension, scopeValue)}`,
        message: spikeMessage({
          scopeType: dimension,
          scopeValue,
          currentCostUsd,
          baselineAverageUsd,
          thresholdUsd,
          policy,
        }),
        scopeType: dimension,
        scopeValue,
        windowHours: policy.spikeWindowHours,
        baselineDays: policy.spikeBaselineDays,
        currentCostUsd: roundUsd(currentCostUsd),
        baselineAverageUsd,
        thresholdUsd,
        multiplier: policy.spikeMultiplier,
        ratio,
        sortScore: baselineAverageUsd > 0 ? ratio : currentCostUsd,
      });
    }
  }

  return alerts;
}

function groupSpend(events, dimension) {
  const groups = new Map();
  for (const event of events) {
    const scopeValue = eventDimension(event, dimension);
    if (!scopeValue) {
      continue;
    }
    groups.set(scopeValue, roundUsd((groups.get(scopeValue) || 0) + event.costUsd));
  }
  return groups;
}

function eventDimension(event, dimension) {
  if (dimension === "global") {
    return "*";
  }
  if (dimension === "repo") {
    return event.repoFullName || "";
  }
  if (dimension === "requestor") {
    return event.requestor || "";
  }
  if (dimension === "provider") {
    return event.provider || "";
  }
  if (dimension === "model") {
    return event.model || "";
  }
  if (dimension === "review_kind") {
    return event.reviewKind || "";
  }
  return "";
}

function eventMatchesScope(event, scopeType, scopeValue) {
  if (scopeType === "global" || scopeValue === "*") {
    return true;
  }
  if (scopeType === "org") {
    return event.repoFullName.startsWith(`${scopeValue}/`);
  }
  if (scopeType === "repo") {
    return event.repoFullName === scopeValue;
  }
  if (scopeType === "requestor") {
    return event.requestor === scopeValue;
  }
  if (scopeType === "pr") {
    return `${event.repoFullName}#${event.prNumber || ""}` === scopeValue;
  }
  if (scopeType === "provider") {
    return event.provider === scopeValue;
  }
  if (scopeType === "model") {
    return event.model === scopeValue;
  }
  if (scopeType === "review_kind") {
    return event.reviewKind === scopeValue;
  }
  return false;
}

function normalizeUsageEvent(event = {}) {
  const metadata = normalizeMetadata(event.metadata);
  const createdAt = event.createdAt || event.created_at || "";
  const createdAtDate = dateOrNull(createdAt);
  const actualCostUsd = nullableNumber(event.actualCostUsd ?? event.actual_cost_usd);
  const estimatedCostUsd = nullableNumber(event.estimatedCostUsd ?? event.estimated_cost_usd);
  return {
    createdAt,
    createdAtDate,
    repoFullName: event.repoFullName || event.repo_full_name || "",
    prNumber: nullableNumber(event.prNumber ?? event.pr_number),
    prAuthor: event.prAuthor || event.pr_author || "",
    requestor: event.requestor || metadata.requestor || event.prAuthor || event.pr_author || "",
    reviewKind: event.reviewKind || event.review_kind || "",
    provider: event.provider || "",
    model: event.model || "",
    costUsd: roundUsd(actualCostUsd ?? estimatedCostUsd ?? event.costUsd ?? event.cost_usd ?? 0),
  };
}

function normalizeBudgetPolicy(policy = {}) {
  return {
    scopeType: policy.scopeType || policy.scope_type || "",
    scopeValue: policy.scopeValue || policy.scope_value || "*",
    dailyBudgetUsd: nullableNumber(policy.dailyBudgetUsd ?? policy.daily_budget_usd),
    weeklyBudgetUsd: nullableNumber(policy.weeklyBudgetUsd ?? policy.weekly_budget_usd),
    monthlyBudgetUsd: nullableNumber(policy.monthlyBudgetUsd ?? policy.monthly_budget_usd),
    enabled: policy.enabled !== false,
  };
}

function spikeMessage(input) {
  if (input.baselineAverageUsd > 0) {
    return `${scopeLabel(input.scopeType, input.scopeValue)} used $${formatUsd(input.currentCostUsd)} in the last ${input.policy.spikeWindowHours}h versus a $${formatUsd(input.baselineAverageUsd)} baseline average.`;
  }
  return `${scopeLabel(input.scopeType, input.scopeValue)} used $${formatUsd(input.currentCostUsd)} in the last ${input.policy.spikeWindowHours}h with no matching baseline spend.`;
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

function scopeLabel(scopeType, scopeValue) {
  return `${scopeType}:${scopeValue || "*"}`;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcWeek(date) {
  const start = startOfUtcDay(date);
  const day = start.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return start;
}

function startOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function dateTimeKey(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function dateOrNull(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeMetadata(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function nullableNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  const number = numericSetting(value, fallback, name);
  if (number <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return number;
}

function nonNegativeNumber(value, fallback, name) {
  const number = numericSetting(value, fallback, name);
  if (number < 0) {
    throw new Error(`${name} must be >= 0.`);
  }
  return number;
}

function numericSetting(value, fallback, name) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${name} must be a number.`);
  }
  return number;
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function roundUsd(value) {
  return Math.round(Number(value || 0) * 1000000) / 1000000;
}

function roundPercent(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatUsd(value) {
  return roundUsd(value).toFixed(2);
}

module.exports = {
  DEFAULT_SPIKE_DIMENSIONS,
  evaluateSpendAlerts,
  eventMatchesScope,
  normalizeBudgetPolicy,
  normalizeUsageEvent,
  spendAlertPolicyFromEnv,
};
