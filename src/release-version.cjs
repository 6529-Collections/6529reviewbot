"use strict";

function normalizeReleaseVersion(value) {
  const text = String(value || "").replace(/[\r\n\t]/g, " ").trim();
  if (!/^[vV]?[0-9][0-9A-Za-z._-]*$/.test(text)) {
    throw new Error("release version must look like v0.1.0.");
  }
  return text.startsWith("v") || text.startsWith("V") ? `v${text.slice(1)}` : `v${text}`;
}

function releaseTagNameError(release) {
  const tag = String(release || "");
  if (tag.includes("..")) {
    return `release tag '${tag}' is not Git ref-safe; tag names must not contain consecutive dots.`;
  }
  if (tag.endsWith(".")) {
    return `release tag '${tag}' is not Git ref-safe; tag names must not end with a dot.`;
  }
  if (/\.lock$/i.test(tag)) {
    return `release tag '${tag}' is not Git ref-safe; tag names must not end with .lock.`;
  }
  return "";
}

module.exports = {
  normalizeReleaseVersion,
  releaseTagNameError,
};
