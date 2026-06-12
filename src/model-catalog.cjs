"use strict";

const fs = require("fs");
const path = require("path");

const PROVIDERS = ["anthropic", "openai", "openrouter"];
const DEFAULT_MODEL_CATALOG_PATH = path.resolve(
  __dirname,
  "..",
  "config",
  "model-catalog.json"
);

function modelCatalogPathFromEnv(env = process.env) {
  return path.resolve(
    env.REVIEWBOT_MODEL_CATALOG_PATH || DEFAULT_MODEL_CATALOG_PATH
  );
}

function loadModelCatalog(options = {}) {
  const catalogPath = options.path || modelCatalogPathFromEnv(options.env);
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  return validateModelCatalog(catalog, catalogPath);
}

function validateModelCatalog(catalog, catalogPath = "model catalog") {
  assertPlainObject(catalog, catalogPath);
  assertEqual(catalog.version, 1, `${catalogPath} version must be 1.`);
  const defaultProvider = normalizeProvider(catalog.defaultProvider || "anthropic");
  assertPlainObject(catalog.providers, `${catalogPath} providers`);

  const providers = {};
  for (const provider of PROVIDERS) {
    const rawProvider = catalog.providers[provider];
    assertPlainObject(rawProvider, `${catalogPath} providers.${provider}`);
    const defaultModel = String(rawProvider.defaultModel || "").trim();
    const requireExplicitModel = Boolean(rawProvider.requireExplicitModel);
    const models = normalizeModels(rawProvider.models || {}, provider, catalogPath);
    if (!defaultModel && !requireExplicitModel) {
      throw new Error(
        `${catalogPath} providers.${provider}.defaultModel is required unless requireExplicitModel is true.`
      );
    }
    if (defaultModel && !Object.prototype.hasOwnProperty.call(models, defaultModel)) {
      throw new Error(
        `${catalogPath} providers.${provider}.defaultModel '${defaultModel}' must be listed in models.`
      );
    }
    providers[provider] = {
      defaultModel,
      requireExplicitModel,
      models,
    };
  }

  for (const provider of Object.keys(catalog.providers)) {
    normalizeProvider(provider);
  }

  return {
    version: 1,
    defaultProvider,
    providers,
  };
}

function normalizeModels(rawModels, provider, catalogPath) {
  assertPlainObject(rawModels, `${catalogPath} providers.${provider}.models`);
  const models = {};
  for (const [model, metadata] of Object.entries(rawModels)) {
    const modelName = String(model || "").trim();
    if (!modelName || /\s/.test(modelName)) {
      throw new Error(`${catalogPath} providers.${provider}.models contains invalid model '${model}'.`);
    }
    assertPlainObject(metadata, `${catalogPath} providers.${provider}.models.${modelName}`);
    models[modelName] = {
      status: String(metadata.status || "available"),
      notes: String(metadata.notes || ""),
    };
  }
  return models;
}

function defaultProvider(env = process.env, catalog = loadModelCatalog({ env })) {
  return normalizeProvider(
    env.REVIEWBOT_DEFAULT_PROVIDER || env.REVIEW_PROVIDER || catalog.defaultProvider
  );
}

function defaultModelForProvider(
  provider,
  env = process.env,
  catalog = loadModelCatalog({ env })
) {
  const normalized = normalizeProvider(provider);
  return (
    env[`REVIEWBOT_DEFAULT_${normalized.toUpperCase()}_MODEL`] ||
    env[`REVIEW_DEFAULT_${normalized.toUpperCase()}_MODEL`] ||
    catalog.providers[normalized].defaultModel ||
    ""
  );
}

function normalizeProvider(provider) {
  const normalized = String(provider || "").trim().toLowerCase();
  if (!PROVIDERS.includes(normalized)) {
    throw new Error(`Provider must be one of ${PROVIDERS.join(", ")}. Got '${provider}'.`);
  }
  return normalized;
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message);
  }
}

module.exports = {
  DEFAULT_MODEL_CATALOG_PATH,
  PROVIDERS,
  defaultModelForProvider,
  defaultProvider,
  loadModelCatalog,
  modelCatalogPathFromEnv,
  normalizeProvider,
  validateModelCatalog,
};
