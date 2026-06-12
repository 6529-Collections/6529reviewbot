"use strict";

const DEFAULT_DIAGNOSTIC_MAX_CHARS = 4000;
const SENSITIVE_TEXT_PATTERNS = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, "github_pat_[redacted]"],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g, "[redacted-github-token]"],
  [/\bsk-[A-Za-z0-9._-]{8,}\b/g, "sk-[redacted]"],
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    "[redacted-private-key]",
  ],
];

function safeErrorLine(error, maxChars = 500) {
  const stackText =
    error && typeof error.stack === "string" ? error.stack : String(error);
  const message = stackText.split("\n")[0];
  return redactSensitiveText(message).slice(0, maxChars);
}

function diagnosticTail(value, maxChars = DEFAULT_DIAGNOSTIC_MAX_CHARS) {
  return tail(redactSensitiveText(value), maxChars);
}

function redactSensitiveText(value) {
  let text = String(value || "");
  for (const [pattern, replacement] of SENSITIVE_TEXT_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function tail(value, maxChars = DEFAULT_DIAGNOSTIC_MAX_CHARS) {
  const text = String(value || "");
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

module.exports = {
  DEFAULT_DIAGNOSTIC_MAX_CHARS,
  diagnosticTail,
  redactSensitiveText,
  safeErrorLine,
  tail,
};
