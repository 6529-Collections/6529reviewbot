"use strict";

const fs = require("fs");
const { assertDataApiSettings, executeStatement, stringParam } = require("./data-api.cjs");
const { quoteIdent } = require("./usage-ledger.cjs");
const { normalizeProvider } = require("./model-catalog.cjs");

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
    notes: optionalString(price.notes),
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
  :notes
) on conflict (provider, model, effective_from) do update set
  input_usd_per_million = excluded.input_usd_per_million,
  cached_input_usd_per_million = excluded.cached_input_usd_per_million,
  output_usd_per_million = excluded.output_usd_per_million,
  reasoning_usd_per_million = excluded.reasoning_usd_per_million,
  currency = excluded.currency,
  source_url = excluded.source_url,
  notes = excluded.notes`,
      parameters: [
        ...basePriceParams(price),
        decimalOrNullParam("input_usd_per_million", price.inputUsdPerMillion),
        decimalOrNullParam("cached_input_usd_per_million", price.cachedInputUsdPerMillion),
        decimalOrNullParam("output_usd_per_million", price.outputUsdPerMillion),
        decimalOrNullParam("reasoning_usd_per_million", price.reasoningUsdPerMillion),
        stringParam("currency", price.currency),
        stringOrNullParam("source_url", price.sourceUrl),
        stringOrNullParam("notes", price.notes),
      ],
    });
  }
  return statements;
}

function applyModelPrices(settings, document, options = {}) {
  assertDataApiSettings(settings, "Model price ledger");
  const statements = options.statements || modelPriceStatements(settings.schema, document);
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

function assertPlainObject(value, source) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be an object.`);
  }
}

module.exports = {
  applyModelPrices,
  loadModelPriceFile,
  modelPriceStatements,
  renderModelPriceSql,
  validateModelPriceFile,
};
