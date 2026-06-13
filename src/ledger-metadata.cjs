"use strict";

const { redactSensitiveText } = require("./diagnostics.cjs");

const LEDGER_METADATA_KEY_PATTERN = /^[A-Za-z0-9_.-]{1,80}$/;
const FORBIDDEN_LEDGER_METADATA_KEY_PATTERN =
  /(prompt|diff|providerresponse|provideroutput|providerraw|rawprovider|webhookpayload|rawwebhook|stdout|stderr|credential|secret|token|authorization)/i;

function normalizeLedgerMetadata(value, options = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const maxStringChars = positiveInteger(options.maxStringChars || 1000, "maxStringChars");
  const includeNull = Boolean(options.includeNull);
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isSafeLedgerMetadataKey(key) || item === undefined) {
      continue;
    }
    if (item === null) {
      if (includeNull) {
        result[key] = null;
      }
    } else if (typeof item === "string") {
      result[key] = redactSensitiveText(item).slice(0, maxStringChars);
    } else if (typeof item === "number") {
      if (Number.isFinite(item)) {
        result[key] = item;
      }
    } else if (typeof item === "boolean") {
      result[key] = item;
    }
  }
  return result;
}

function isSafeLedgerMetadataKey(key) {
  const text = String(key || "");
  if (!LEDGER_METADATA_KEY_PATTERN.test(text)) {
    return false;
  }
  if (redactSensitiveText(text) !== text) {
    return false;
  }
  const compact = text.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return !FORBIDDEN_LEDGER_METADATA_KEY_PATTERN.test(compact);
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

module.exports = {
  FORBIDDEN_LEDGER_METADATA_KEY_PATTERN,
  LEDGER_METADATA_KEY_PATTERN,
  isSafeLedgerMetadataKey,
  normalizeLedgerMetadata,
};
