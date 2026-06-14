"use strict";

const PLACEHOLDER_HOST_SUFFIXES = [".example", ".example.com", ".invalid", ".localhost", ".test"];
const PLACEHOLDER_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "::1", "[::1]", "example.com", "localhost"]);

function isPlaceholderHost(value) {
  const host = normalizeHost(value);
  if (!host || /^<[^>]+>$/.test(host)) {
    return true;
  }
  return PLACEHOLDER_HOSTS.has(host) || PLACEHOLDER_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function isPlaceholderOrigin(value) {
  const text = String(value || "").trim();
  if (!text || /^<[^>]+>$/.test(text)) {
    return true;
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch (error) {
    return false;
  }
  return isPlaceholderHost(parsed.hostname);
}

function isPlaceholderImageRepository(value) {
  const text = String(value || "").trim();
  if (!text || /^<[^>]+>/.test(text)) {
    return true;
  }
  const firstSegment = text.split("/")[0];
  if (!firstSegment || !/[.:]/.test(firstSegment)) {
    return false;
  }
  return isPlaceholderHost(firstSegment.replace(/:[0-9]+$/, ""));
}

function normalizeHost(value) {
  return String(value || "")
    .trim()
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .toLowerCase();
}

module.exports = {
  PLACEHOLDER_HOST_SUFFIXES,
  PLACEHOLDER_HOSTS,
  isPlaceholderHost,
  isPlaceholderImageRepository,
  isPlaceholderOrigin,
};
