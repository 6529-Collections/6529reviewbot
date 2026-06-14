"use strict";

function normalizeImageRepositoryRef(value, options = {}) {
  const text = String(value || "").trim();
  const label = options.label || "image repository";
  if (!text) {
    throw new Error(options.requiredMessage || `${label} is required.`);
  }
  if (text === options.defaultValue) {
    return text;
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(text)) {
    throw new Error(options.schemeMessage || `${label} must not include a URL scheme.`);
  }
  if (text.includes("@")) {
    throw new Error(options.digestMessage || `${label} must not include a digest.`);
  }
  if (/:([^/]+)$/.test(text)) {
    throw new Error(options.tagMessage || `${label} must not include a tag.`);
  }
  if (text.split("/").some((segment) => !segment)) {
    throw new Error(options.emptySegmentMessage || `${label} must not contain empty path segments.`);
  }
  if (/[A-Z]/.test(text)) {
    throw new Error(options.lowercaseMessage || `${label} must be lowercase.`);
  }
  if (!/^[A-Za-z0-9._:/-]+$/.test(text)) {
    throw new Error(options.unsupportedMessage || `${label} contains unsupported characters.`);
  }
  return text;
}

module.exports = {
  normalizeImageRepositoryRef,
};
