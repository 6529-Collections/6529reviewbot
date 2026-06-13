#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const reviewBot = require("../src/review-bot.cjs");

const root = path.resolve(__dirname, "..");

const providerAdapters = ["anthropic", "openai", "openrouter"];

const providerAdapterDocs = [
  "README.md",
  "docs/configuration.md",
  "docs/provider-setup.md",
  "docs/model-catalog.md",
  "docs/review-jobs.md",
  "docs/release-operations-map.md",
  "docs/release-readiness.md",
];

function main() {
  const result = checkProviderAdapters();
  console.log(
    `provider adapters ok (${result.providers} providers, ${result.sourceSnippets} source snippets, ${result.docs} docs checked)`
  );
}

function checkProviderAdapters(options = {}) {
  const findings = [];
  const sourceText = options.sourceText || readText("src/review-bot.cjs");
  checkProviderRoutingAndSource(sourceText, findings);
  checkOpenAIOptionGating(findings);
  checkUsageNormalization(findings);
  checkProviderErrorSafety(findings);
  checkDocs(options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`provider adapter check found ${findings.length} issue(s).`);
  }

  return {
    providers: providerAdapters.length,
    sourceSnippets: providerSourceSnippets.length,
    docs: providerAdapterDocs.length,
  };
}

const providerSourceSnippets = [
  "settings.provider === \"anthropic\"",
  "settings.provider === \"openai\"",
  "return await callOpenRouter(settings, prompt)",
  "https://api.anthropic.com/v1/messages",
  "\"anthropic-version\": \"2023-06-01\"",
  "\"x-api-key\": key",
  "max_tokens: settings.maxOutputTokens",
  "https://api.openai.com/v1/responses",
  "authorization: `Bearer ${key}`",
  "max_output_tokens: settings.maxOutputTokens",
  "body.reasoning = { effort: settings.reasoningEffort }",
  "body.text = { verbosity: settings.verbosity }",
  "OpenAI response incomplete",
  "https://openrouter.ai/api/v1/chat/completions",
  "\"http-referer\": settings.openrouterSiteUrl",
  "\"x-title\": settings.openrouterAppName",
  "usage: { include: true }",
];

function checkProviderRoutingAndSource(sourceText, findings) {
  for (const snippet of providerSourceSnippets) {
    if (!sourceText.includes(snippet)) {
      findings.push(`src/review-bot.cjs must keep provider adapter snippet '${snippet}'.`);
    }
  }
}

function checkOpenAIOptionGating(findings) {
  const gpt5 = reviewBot.openAIModelCapabilities("gpt-5.5");
  if (!gpt5.reasoning || !gpt5.textVerbosity) {
    findings.push(`gpt-5 family must enable reasoning and text verbosity, got ${JSON.stringify(gpt5)}.`);
  }
  const oSeries = reviewBot.openAIModelCapabilities("o3");
  if (!oSeries.reasoning || oSeries.textVerbosity) {
    findings.push(`o-series models must enable reasoning only, got ${JSON.stringify(oSeries)}.`);
  }
  const unknown = reviewBot.openAIModelCapabilities("custom-model");
  if (unknown.reasoning || unknown.textVerbosity) {
    findings.push(`unknown OpenAI model families must not get auto options, got ${JSON.stringify(unknown)}.`);
  }
  const optionCases = [
    ["auto", true, true],
    ["auto", false, false],
    ["always", false, true],
    ["never", true, false],
  ];
  for (const [mode, supported, expected] of optionCases) {
    const actual = reviewBot.shouldSendOpenAIOption(mode, supported);
    if (actual !== expected) {
      findings.push(`shouldSendOpenAIOption(${mode}, ${supported}) must be ${expected}, got ${actual}.`);
    }
  }
}

function checkUsageNormalization(findings) {
  const anthropic = reviewBot.normalizeAnthropicUsage({
    input_tokens: 10,
    cache_read_input_tokens: 3,
    output_tokens: 5,
  });
  expectUsage("anthropic", anthropic, {
    inputTokens: 10,
    cachedInputTokens: 3,
    outputTokens: 5,
    reasoningTokens: 0,
    totalTokens: 15,
  }, findings);

  const openai = reviewBot.normalizeOpenAIUsage({
    input_tokens: 11,
    input_tokens_details: { cached_tokens: 4 },
    output_tokens: 7,
    output_tokens_details: { reasoning_tokens: 2 },
    total_tokens: 18,
  });
  expectUsage("openai", openai, {
    inputTokens: 11,
    cachedInputTokens: 4,
    outputTokens: 7,
    reasoningTokens: 2,
    totalTokens: 18,
  }, findings);

  const openrouter = reviewBot.normalizeOpenRouterUsage({
    prompt_tokens: 12,
    cached_tokens: 5,
    completion_tokens: 8,
    reasoning_tokens: 3,
    total_tokens: 20,
  });
  expectUsage("openrouter", openrouter, {
    inputTokens: 12,
    cachedInputTokens: 5,
    outputTokens: 8,
    reasoningTokens: 3,
    totalTokens: 20,
  }, findings);
}

function checkProviderErrorSafety(findings) {
  const summary = reviewBot.providerErrorSummary({
    error: {
      type: "provider_error",
      code: "rate_limit",
      message:
        "failed with Bearer abcdefghijklmnopqrstuvwxyz123456 and sk-proj-abcdefghijklmnopqrstuvwx123456",
      raw: "ignored",
    },
  });
  if (!summary.includes("\"type\":\"provider_error\"") || !summary.includes("\"code\":\"rate_limit\"")) {
    findings.push(`providerErrorSummary must preserve safe provider type/code fields, got ${summary}.`);
  }
  if (summary.includes("Bearer abcdef") || summary.includes("sk-proj-abcdefghijkl")) {
    findings.push("providerErrorSummary must redact common token and provider-key shapes.");
  }
  if (reviewBot.providerErrorSummary({ raw: "<html>secret</html>" }) !== "provider returned a non-JSON error body") {
    findings.push("providerErrorSummary must not echo raw non-JSON provider error bodies.");
  }
  expectError(
    () =>
      reviewBot.requireProviderReviewText(
        { text: "   " },
        { provider: "openai", model: "gpt-5.5" }
      ),
    "returned empty review output",
    findings
  );
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "Reviews pull requests with Anthropic, OpenAI, or OpenRouter models.",
      "npm run check:provider-adapters",
    ],
    "docs/configuration.md": [
      "REVIEW_PROVIDER=anthropic|openai|openrouter",
      "REVIEW_OPENAI_REASONING=auto|always|never",
      "REVIEW_OPENAI_VERBOSITY=auto|always|never",
    ],
    "docs/provider-setup.md": [
      "OpenAI review runs use the Responses API path",
      "OpenRouter can return usage cost directly when usage accounting is requested",
      "npm run check:provider-adapters",
    ],
    "docs/model-catalog.md": [
      "OpenRouter intentionally has no built-in default",
      "npm run check:provider-adapters",
    ],
    "docs/review-jobs.md": [
      "Workers must still enforce engine-level context, token, timeout, and source path limits.",
    ],
    "docs/release-operations-map.md": [
      "npm run check:provider-adapters",
    ],
    "docs/release-readiness.md": [
      "provider adapter checker",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    const text = normalizeWhitespace(docTexts[doc] || readText(doc));
    for (const snippet of snippets) {
      if (!text.includes(normalizeWhitespace(snippet))) {
        findings.push(`${doc} must include '${snippet}'.`);
      }
    }
  }
}

function expectUsage(name, actual, expected, findings) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      findings.push(`${name} usage ${key} must be ${value}, got ${actual[key]}.`);
    }
  }
}

function expectError(fn, expectedMessage, findings) {
  try {
    fn();
    findings.push(`expected error containing '${expectedMessage}'.`);
  } catch (error) {
    if (!String(error.message || "").includes(expectedMessage)) {
      findings.push(`expected error containing '${expectedMessage}', got '${error.message}'.`);
    }
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  checkProviderAdapters,
  providerAdapters,
};
