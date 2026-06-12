"use strict";

const fs = require("fs");
const {
  assertDataApiSettings,
  executeStatement,
  fieldValue,
  nullableNumber,
  stringParam,
} = require("./data-api.cjs");
const { redactSensitiveText } = require("./diagnostics.cjs");
const { quoteIdent } = require("./usage-ledger.cjs");
const { normalizeProvider } = require("./model-catalog.cjs");

const DEFAULT_MAX_SOURCE_AGE_DAYS = 30;
const MAX_SOURCE_CHECK_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MODEL_PRICE_NOTE_MAX_CHARS = 1000;

function loadModelPriceFile(filePath) {
  return validateModelPriceFile(JSON.parse(fs.readFileSync(filePath, "utf8")), filePath);
}

function validateModelPriceFile(document, source = "model price file") {
  assertPlainObject(document, source);
  if (document.version !== 1) {
    throw new Error(`${source} version must be 1.`);
  }
  const currency = String(document.currency || "USD").trim().toUpperCase();
  if (currency !== "USD") {
    throw new Error(`${source} currency must be USD.`);
  }
  if (!Array.isArray(document.prices)) {
    throw new Error(`${source} prices must be an array.`);
  }
  return {
    version: 1,
    currency,
    prices: document.prices.map((price, index) =>
      normalizeModelPrice(price, `${source} prices[${index}]`)
    ),
  };
}

function normalizeModelPrice(price, source) {
  assertPlainObject(price, source);
  const provider = normalizeProvider(price.provider);
  const model = stringField(price.model, `${source}.model`);
  const effectiveFrom = isoDateField(price.effectiveFrom, `${source}.effectiveFrom`);
  const sourceCheckedAt = isoDateField(price.sourceCheckedAt, `${source}.sourceCheckedAt`);
  const normalized = {
    provider,
    model,
    inputUsdPerMillion: nullableUsd(price.inputUsdPerMillion, `${source}.inputUsdPerMillion`),
    cachedInputUsdPerMillion: nullableUsd(
      price.cachedInputUsdPerMillion,
      `${source}.cachedInputUsdPerMillion`
    ),
    outputUsdPerMillion: nullableUsd(price.outputUsdPerMillion, `${source}.outputUsdPerMillion`),
    reasoningUsdPerMillion: nullableUsd(
      price.reasoningUsdPerMillion,
      `${source}.reasoningUsdPerMillion`
    ),
    currency: "USD",
    effectiveFrom,
    sourceUrl: urlField(price.sourceUrl, `${source}.sourceUrl`),
    sourceCheckedAt,
    notes: optionalRedactedString(price.notes),
  };
  if (
    normalized.inputUsdPerMillion === null &&
    normalized.cachedInputUsdPerMillion === null &&
    normalized.outputUsdPerMillion === null &&
    normalized.reasoningUsdPerMillion === null
  ) {
    throw new Error(`${source} must include at least one price field.`);
  }
  return normalized;
}

function modelPriceStatements(schema, document) {
  const schemaIdent = quoteIdent(schema);
  const priceFile = validateModelPriceFile(document);
  const statements = [];
  for (const price of priceFile.prices) {
    statements.push({
      name: `close_current_${price.provider}_${price.model}`,
      sql: `
update ${schemaIdent}.ai_model_prices
set effective_to = cast(:effective_from as timestamptz)
where provider = :provider
  and model = :model
  and effective_to is null
  and effective_from < cast(:effective_from as timestamptz)
`,
      parameters: basePriceParams(price),
    });
    statements.push({
      name: `insert_${price.provider}_${price.model}`,
      sql: `
insert into ${schemaIdent}.ai_model_prices (
  provider,
  model,
  input_usd_per_million,
  cached_input_usd_per_million,
  output_usd_per_million,
  reasoning_usd_per_million,
  currency,
  effective_from,
  source_url,
  source_checked_at,
  notes
) values (
  :provider,
  :model,
  cast(:input_usd_per_million as numeric),
  cast(:cached_input_usd_per_million as numeric),
  cast(:output_usd_per_million as numeric),
  cast(:reasoning_usd_per_million as numeric),
  :currency,
  cast(:effective_from as timestamptz),
  :source_url,
  cast(:source_checked_at as timestamptz),
  :notes
) on conflict (provider, model, effective_from) do update set
  input_usd_per_million = excluded.input_usd_per_million,
  cached_input_usd_per_million = excluded.cached_input_usd_per_million,
  output_usd_per_million = excluded.output_usd_per_million,
  reasoning_usd_per_million = excluded.reasoning_usd_per_million,
  currency = excluded.currency,
  source_url = excluded.source_url,
  source_checked_at = excluded.source_checked_at,
  notes = excluded.notes`,
      parameters: [
        ...basePriceParams(price),
        decimalOrNullParam("input_usd_per_million", price.inputUsdPerMillion),
        decimalOrNullParam("cached_input_usd_per_million", price.cachedInputUsdPerMillion),
        decimalOrNullParam("output_usd_per_million", price.outputUsdPerMillion),
        decimalOrNullParam("reasoning_usd_per_million", price.reasoningUsdPerMillion),
        stringParam("currency", price.currency),
        stringOrNullParam("source_url", price.sourceUrl),
        stringParam("source_checked_at", price.sourceCheckedAt),
        stringOrNullParam("notes", price.notes),
      ],
    });
  }
  return statements;
}

function currentModelPriceStatement(schema, input) {
  const provider = normalizeProvider(input.provider);
  const model = stringField(input.model, "model price lookup model");
  const at = isoDateField(input.at || new Date().toISOString(), "model price lookup timestamp");
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
  source_checked_at::text,
  notes
from ${quoteIdent(schema)}.ai_model_prices
where provider = :provider
  and model = :model
  and effective_from <= cast(:at_ts as timestamptz)
  and (effective_to is null or effective_to > cast(:at_ts as timestamptz))
order by effective_from desc, id desc
limit 1`,
    parameters: [
      stringParam("provider", provider),
      stringParam("model", model),
      stringParam("at_ts", at),
    ],
  };
}

function readCurrentModelPrice(settings, input, options = {}) {
  assertDataApiSettings(settings, "Model price lookup");
  const statement = currentModelPriceStatement(settings.schema, input);
  const execute = options.executeStatement || executeStatement;
  const response = execute(settings, statement.sql, statement.parameters, {
    tempPrefix: "6529-model-price-read-",
    maxBuffer: 16 * 1024 * 1024,
  });
  return modelPriceFromRecord(response.records?.[0]);
}

function modelPriceFromRecord(record) {
  if (!record) {
    return null;
  }
  return {
    provider: fieldValue(record[0]) || "",
    model: fieldValue(record[1]) || "",
    inputUsdPerMillion: nullableNumber(fieldValue(record[2])),
    cachedInputUsdPerMillion: nullableNumber(fieldValue(record[3])),
    outputUsdPerMillion: nullableNumber(fieldValue(record[4])),
    reasoningUsdPerMillion: nullableNumber(fieldValue(record[5])),
    currency: fieldValue(record[6]) || "USD",
    effectiveFrom: fieldValue(record[7]) || "",
    effectiveTo: fieldValue(record[8]) || "",
    sourceUrl: fieldValue(record[9]) || "",
    sourceCheckedAt: fieldValue(record[10]) || "",
    notes: fieldValue(record[11]) || "",
  };
}

function estimateUsageCostUsd(usage = {}, price = {}) {
  if (!price || String(price.currency || "USD").toUpperCase() !== "USD") {
    return null;
  }
  const inputTokens = wholeTokens(usage.inputTokens);
  const cachedInputTokens = wholeTokens(usage.cachedInputTokens);
  const outputTokens = wholeTokens(usage.outputTokens);
  const reasoningTokens = wholeTokens(usage.reasoningTokens);
  const inputRate = nullableNumber(price.inputUsdPerMillion);
  const cachedInputRate = nullableNumber(price.cachedInputUsdPerMillion);
  const outputRate = nullableNumber(price.outputUsdPerMillion);
  const reasoningRate = nullableNumber(price.reasoningUsdPerMillion);
  const effectiveReasoningRate = reasoningRate ?? outputRate;
  if (inputTokens > 0 && inputRate === null) {
    return null;
  }
  if (cachedInputTokens > 0 && cachedInputRate === null && inputRate === null) {
    return null;
  }
  if (outputTokens > 0 && outputRate === null) {
    return null;
  }
  if (reasoningTokens > 0 && effectiveReasoningRate === null) {
    return null;
  }
  const cachedLooksLikeSubset = cachedInputTokens > 0 && cachedInputTokens <= inputTokens;
  const nonCachedInputTokens =
    cachedLooksLikeSubset && cachedInputRate !== null
      ? inputTokens - cachedInputTokens
      : inputTokens;
  let total = 0;
  total += tokenCost(nonCachedInputTokens, inputRate);
  if (cachedInputTokens > 0) {
    if (cachedInputRate !== null) {
      total += tokenCost(cachedInputTokens, cachedInputRate);
    } else if (!cachedLooksLikeSubset) {
      total += tokenCost(cachedInputTokens, inputRate);
    }
  }
  total += tokenCost(outputTokens, outputRate);
  total += tokenCost(reasoningTokens, effectiveReasoningRate);
  return roundUsd(total);
}

function applyModelPrices(settings, document, options = {}) {
  assertDataApiSettings(settings, "Model price ledger");
  const priceFile = validateModelPriceFile(document);
  if (!options.allowZeroPrice) {
    assertNoZeroPriceRows(priceFile);
  }
  if (!options.allowStaleSource) {
    assertFreshModelPriceSources(priceFile, {
      maxSourceAgeDays: options.maxSourceAgeDays,
      now: options.now,
    });
  }
  const statements = options.statements || modelPriceStatements(settings.schema, priceFile);
  const execute = options.executeStatement || executeStatement;
  const results = [];
  for (const statement of statements) {
    execute(settings, statement.sql, statement.parameters, {
      tempPrefix: "6529-model-prices-",
      maxBuffer: 16 * 1024 * 1024,
    });
    results.push({ name: statement.name, applied: true });
  }
  return results;
}

function assertFreshModelPriceSources(document, options = {}) {
  const staleRows = staleModelPriceSources(document, options);
  if (staleRows.length) {
    const maxDays = normalizeMaxSourceAgeDays(options.maxSourceAgeDays);
    const rows = staleRows.map(describeFreshnessIssue).join(", ");
    throw new Error(
      `model price sources are outside freshness policy (max ${maxDays} days): ${rows}; re-check provider pricing or pass --allow-stale-source with release evidence.`
    );
  }
  return validateModelPriceFile(document);
}

function staleModelPriceSources(document, options = {}) {
  const priceFile = validateModelPriceFile(document);
  const maxDays = normalizeMaxSourceAgeDays(options.maxSourceAgeDays);
  const nowMs = timestampMs(options.now || new Date().toISOString(), "model price source freshness timestamp");
  return priceFile.prices
    .map((price) => {
      const sourceCheckedMs = timestampMs(
        price.sourceCheckedAt,
        `model price sourceCheckedAt for ${price.provider}:${price.model}`
      );
      const ageDays = (nowMs - sourceCheckedMs) / 86_400_000;
      let reason = "";
      if (sourceCheckedMs - nowMs > MAX_SOURCE_CHECK_CLOCK_SKEW_MS) {
        reason = "future";
      } else if (ageDays > maxDays) {
        reason = "stale";
      }
      return {
        provider: price.provider,
        model: price.model,
        sourceCheckedAt: price.sourceCheckedAt,
        ageDays: Math.floor(ageDays),
        reason,
        stale: Boolean(reason),
      };
    })
    .filter((row) => row.stale);
}

function describeFreshnessIssue(row) {
  if (row.reason === "future") {
    return `${row.provider}:${row.model} sourceCheckedAt is in the future (${row.sourceCheckedAt})`;
  }
  return `${row.provider}:${row.model} checked ${row.ageDays} days ago`;
}

function assertNoZeroPriceRows(document, source = "model price file") {
  const priceFile = validateModelPriceFile(document, source);
  for (const price of priceFile.prices) {
    for (const field of priceRateFields()) {
      if (price[field] === 0) {
        throw new Error(
          `${source} ${price.provider}:${price.model} has zero ${field}; use --allow-zero-price only for a provider-documented free rate.`
        );
      }
    }
  }
  return priceFile;
}

function priceRateFields() {
  return [
    "inputUsdPerMillion",
    "cachedInputUsdPerMillion",
    "outputUsdPerMillion",
    "reasoningUsdPerMillion",
  ];
}

function renderModelPriceSql(schema, document) {
  return modelPriceStatements(schema, document)
    .map((statement) => {
      const params = Object.fromEntries(
        statement.parameters.map((param) => [param.name, param.value])
      );
      return [
        `-- ${statement.name}`,
        `-- parameters: ${JSON.stringify(params)}`,
        `${statement.sql.trim()};`,
      ].join("\n");
    })
    .join("\n\n");
}

function basePriceParams(price) {
  return [
    stringParam("provider", price.provider),
    stringParam("model", price.model),
    stringParam("effective_from", price.effectiveFrom),
  ];
}

function nullableUsd(value, source) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${source} must be a non-negative number.`);
  }
  return parsed;
}

function stringField(value, source) {
  const text = String(value || "").trim();
  if (!text || /\s/.test(text)) {
    throw new Error(`${source} must be a non-empty string without whitespace.`);
  }
  return text;
}

function optionalString(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function optionalRedactedString(value, maxChars = MODEL_PRICE_NOTE_MAX_CHARS) {
  const text = optionalString(value);
  return text ? redactSensitiveText(text).slice(0, maxChars) : "";
}

function urlField(value, source) {
  const text = stringField(value, source);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${source} must be an absolute http(s) URL.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${source} must be an absolute http(s) URL.`);
  }
  return text;
}

function isoDateField(value, source) {
  const text = String(value || "").trim();
  if (!text || Number.isNaN(Date.parse(text))) {
    throw new Error(`${source} must be an ISO date/time string.`);
  }
  return new Date(text).toISOString();
}

function timestampMs(value, source) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`${source} must be an ISO date/time string.`);
  }
  return timestamp;
}

function normalizeMaxSourceAgeDays(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_MAX_SOURCE_AGE_DAYS;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("model price max source age must be a non-negative number of days.");
  }
  return number;
}

function decimalOrNullParam(name, value) {
  if (value === null || value === undefined) {
    return nullParam(name);
  }
  return stringParam(name, String(value));
}

function stringOrNullParam(name, value) {
  if (!value) {
    return nullParam(name);
  }
  return stringParam(name, value);
}

function nullParam(name) {
  return { name, value: { isNull: true } };
}

function tokenCost(tokens, usdPerMillion) {
  if (!tokens || usdPerMillion === null || usdPerMillion === undefined) {
    return 0;
  }
  return (tokens * Number(usdPerMillion)) / 1_000_000;
}

function wholeTokens(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function roundUsd(value) {
  return Math.round((Number(value) || 0) * 100_000_000) / 100_000_000;
}

function assertPlainObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object.`);
  }
}

module.exports = {
  applyModelPrices,
  assertFreshModelPriceSources,
  assertNoZeroPriceRows,
  currentModelPriceStatement,
  DEFAULT_MAX_SOURCE_AGE_DAYS,
  describeFreshnessIssue,
  estimateUsageCostUsd,
  loadModelPriceFile,
  modelPriceFromRecord,
  modelPriceStatements,
  readCurrentModelPrice,
  renderModelPriceSql,
  staleModelPriceSources,
  validateModelPriceFile,
};
