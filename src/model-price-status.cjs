"use strict";

const {
  assertDataApiSettings,
  executeStatement,
  fieldValue,
  nullableNumber,
} = require("./data-api.cjs");
const { redactSensitiveText } = require("./diagnostics.cjs");
const {
  DEFAULT_MAX_SOURCE_AGE_DAYS,
} = require("./model-prices.cjs");
const { quoteIdent } = require("./usage-ledger.cjs");

const MAX_SOURCE_CHECK_CLOCK_SKEW_MS = 5 * 60 * 1000;

function modelPriceStatusPolicyFromEnv(env = process.env) {
  return {
    maxSourceAgeDays: positiveNumberEnv(
      env.REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS,
      DEFAULT_MAX_SOURCE_AGE_DAYS,
      "REVIEWBOT_MODEL_PRICE_MAX_SOURCE_AGE_DAYS"
    ),
  };
}

function readModelPriceStatus(settings, options = {}) {
  assertDataApiSettings(settings, "Model price status ledger");
  const query = buildModelPriceStatusQuery(settings.schema);
  const execute = options.executeStatement || executeStatement;
  const response = execute(settings, query.sql, query.parameters, {
    tempPrefix: "6529-model-price-status-",
    maxBuffer: 16 * 1024 * 1024,
  });
  return summarizeModelPriceStatus(
    (response.records || []).map((record) =>
      modelPriceStatusRecordToPrice(record, options)
    ),
    options
  );
}

function buildModelPriceStatusQuery(schema) {
  return {
    sql: `
select
  provider,
  model,
  input_usd_per_million::text,
  cached_input_usd_per_million::text,
  output_usd_per_million::text,
  reasoning_usd_per_million::text,
  currency,
  effective_from::text,
  effective_to::text,
  source_url,
  source_checked_at::text
from ${quoteIdent(schema)}.ai_model_prices
where effective_from <= now()
  and (effective_to is null or effective_to > now())
order by provider, model, effective_from desc, id desc
`,
    parameters: [],
  };
}

function modelPriceStatusRecordToPrice(record, options = {}) {
  const sourceUrl = fieldValue(record[9]) || "";
  const sourceCheckedAt = fieldValue(record[10]) || "";
  const sourceFreshness = modelPriceSourceFreshness(sourceCheckedAt, options);
  const rates = {
    inputUsdPerMillion: nullableFiniteNumber(fieldValue(record[2])),
    cachedInputUsdPerMillion: nullableFiniteNumber(fieldValue(record[3])),
    outputUsdPerMillion: nullableFiniteNumber(fieldValue(record[4])),
    reasoningUsdPerMillion: nullableFiniteNumber(fieldValue(record[5])),
  };
  return {
    provider: adminText(fieldValue(record[0]) || "", 80),
    model: adminText(fieldValue(record[1]) || "", 160),
    currency: adminText(fieldValue(record[6]) || "USD", 16),
    rates,
    missingRates: missingRateNames(rates),
    effectiveFrom: adminText(fieldValue(record[7]) || "", 80),
    effectiveTo: adminText(fieldValue(record[8]) || "", 80),
    sourceCheckedAt: adminText(sourceCheckedAt, 80),
    sourceAgeDays: sourceFreshness.ageDays,
    sourceStatus: sourceFreshness.status,
    sourceHost: adminText(sourceHost(sourceUrl), 160),
    hasSourceUrl: Boolean(sourceUrl),
  };
}

function summarizeModelPriceStatus(prices, options = {}) {
  const policy = {
    maxSourceAgeDays: positiveNumberEnv(
      options.maxSourceAgeDays,
      DEFAULT_MAX_SOURCE_AGE_DAYS,
      "maxSourceAgeDays"
    ),
  };
  const providers = new Set();
  const providerModels = new Set();
  const summary = {
    activeRows: prices.length,
    providerCount: 0,
    providerModelCount: 0,
    staleRows: 0,
    futureRows: 0,
    missingSourceRows: 0,
    invalidSourceRows: 0,
    incompleteRows: 0,
  };
  for (const price of prices) {
    if (price.provider) {
      providers.add(price.provider);
    }
    if (price.provider && price.model) {
      providerModels.add(`${price.provider}:${price.model}`);
    }
    if (price.sourceStatus === "stale") {
      summary.staleRows += 1;
    }
    if (price.sourceStatus === "future") {
      summary.futureRows += 1;
    }
    if (price.sourceStatus === "missing") {
      summary.missingSourceRows += 1;
    }
    if (price.sourceStatus === "invalid") {
      summary.invalidSourceRows += 1;
    }
    if (price.missingRates.length > 0) {
      summary.incompleteRows += 1;
    }
  }
  summary.providerCount = providers.size;
  summary.providerModelCount = providerModels.size;
  return {
    policy,
    summary,
    prices,
  };
}

function modelPriceSourceFreshness(value, options = {}) {
  const text = String(value || "").trim();
  if (!text) {
    return { status: "missing", ageDays: null };
  }
  const sourceCheckedMs = Date.parse(text);
  if (Number.isNaN(sourceCheckedMs)) {
    return { status: "invalid", ageDays: null };
  }
  const nowMs = Date.parse(options.now || new Date().toISOString());
  if (Number.isNaN(nowMs)) {
    throw new Error("model price status now must be an ISO date/time string.");
  }
  const maxDays = positiveNumberEnv(
    options.maxSourceAgeDays,
    DEFAULT_MAX_SOURCE_AGE_DAYS,
    "maxSourceAgeDays"
  );
  const ageDays = Math.floor((nowMs - sourceCheckedMs) / 86_400_000);
  if (sourceCheckedMs - nowMs > MAX_SOURCE_CHECK_CLOCK_SKEW_MS) {
    return { status: "future", ageDays };
  }
  if (ageDays > maxDays) {
    return { status: "stale", ageDays };
  }
  return { status: "fresh", ageDays };
}

function missingRateNames(rates) {
  return Object.entries(rates)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
}

function sourceHost(value) {
  if (!value) {
    return "";
  }
  try {
    return new URL(String(value)).host;
  } catch {
    return "";
  }
}

function nullableFiniteNumber(value) {
  const number = nullableNumber(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumberEnv(value, fallback, name) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return number;
}

function adminText(value, maxChars) {
  return redactSensitiveText(value).slice(0, maxChars);
}

module.exports = {
  buildModelPriceStatusQuery,
  modelPriceSourceFreshness,
  modelPriceStatusPolicyFromEnv,
  modelPriceStatusRecordToPrice,
  readModelPriceStatus,
  summarizeModelPriceStatus,
};
