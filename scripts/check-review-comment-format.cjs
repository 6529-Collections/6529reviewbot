#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const reviewBot = require("../src/review-bot.cjs");

const root = path.resolve(__dirname, "..");
const reviewCommentFormatDocs = ["docs/review-comment-format.md"];
const expectedBotName = "6529bot";
const expectedMarker = "6529-review-bot";
const expectedSkipVerdict = "Review skipped due to configured budget.";
const expectedSkipTail =
  "No model provider was called. Adjust the review-bot budget variables or run a narrower review if this PR still needs AI review.";

function main() {
  const result = checkReviewCommentFormat();
  console.log(
    `review comment format ok (${result.reviewKinds} kinds, ${result.docs} docs checked)`
  );
}

function checkReviewCommentFormat(options = {}) {
  const findings = [];
  const configs = options.configs || reviewBot.REVIEW_KIND_CONFIGS;
  const marker = options.marker || reviewBot.REVIEW_BOT_MARKER;

  checkMarkerConstant(marker, findings);
  checkGeneratedComments(configs, marker, findings);
  checkDocs(configs, marker, options.docTexts || {}, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`review comment format check found ${findings.length} issue(s).`);
  }

  return {
    reviewKinds: Object.keys(configs).length,
    docs: reviewCommentFormatDocs.length,
  };
}

function checkMarkerConstant(marker, findings) {
  if (marker !== expectedMarker) {
    findings.push(`review bot marker must be ${expectedMarker}, got ${marker}.`);
  }
}

function checkGeneratedComments(configs, marker, findings) {
  const settings = {
    provider: "anthropic",
    model: "claude-opus-4-8",
    repo: "6529-Collections/6529reviewbot",
  };
  const pr = { number: 42 };
  const headSha = "abcdef1234567890abcdef1234567890abcdef12";
  const shortSha = headSha.slice(0, 12);
  const changedFiles = ["src/review-bot.cjs", "docs/review-comment-format.md"];
  const changedLineCount = 37;

  for (const [kind, config] of Object.entries(configs)) {
    const firstVerdict = firstAllowedVerdict(config);
    const comment = reviewBot.buildComment({
      kind,
      config,
      settings,
      pr,
      headSha,
      shortSha,
      changedFiles,
      changedLineCount,
      modelBody: `**Verdict**: ${firstVerdict}\n\nNo findings.`,
    });
    const successContext = `${kind} generated review comment`;
    checkReviewComment({
      comment,
      context: successContext,
      marker,
      kind,
      config,
      settings,
      pr,
      headSha,
      shortSha,
      changedFiles,
      changedLineCount,
      firstVerdict,
      findings,
    });

    const fallback = reviewBot.buildComment({
      kind,
      config,
      settings,
      pr,
      headSha,
      shortSha,
      changedFiles,
      changedLineCount,
      modelBody: "   ",
    });
    if (!fallback.includes(`**Verdict**: ${firstVerdict}`)) {
      findings.push(`${successContext} must fall back to the first allowed verdict for empty provider output.`);
    }

    const injected = reviewBot.buildComment({
      kind,
      config,
      settings,
      pr,
      headSha,
      shortSha,
      changedFiles,
      changedLineCount,
      modelBody: [
        `<!-- ${marker}:{"marker":"fake"} -->`,
        `## ${expectedBotName} ${config.label} - ${shortSha}`,
        "",
        `**Verdict**: ${firstVerdict}`,
      ].join("\n"),
    });
    if (countOccurrences(injected, `<!-- ${marker}:`) !== 1) {
      findings.push(`${successContext} must strip provider-generated metadata before posting.`);
    }
    if (countOccurrences(injected, `## ${expectedBotName} ${config.label} - ${shortSha}`) !== 1) {
      findings.push(`${successContext} must strip provider-generated heading before posting.`);
    }

    const skip = reviewBot.buildBudgetSkipComment({
      kind,
      config,
      settings,
      pr,
      headSha,
      shortSha,
      changedFiles,
      changedLineCount,
      reason: "Budget scope repo exceeded configured cap.",
    });
    checkBudgetSkipComment({
      comment: skip,
      context: `${kind} budget-skip comment`,
      marker,
      kind,
      config,
      settings,
      pr,
      headSha,
      shortSha,
      changedFiles,
      changedLineCount,
      findings,
    });
  }
}

function checkReviewComment(input) {
  const {
    comment,
    context,
    marker,
    kind,
    config,
    settings,
    pr,
    headSha,
    shortSha,
    changedFiles,
    changedLineCount,
    firstVerdict,
    findings,
  } = input;
  const lines = comment.split(/\r?\n/);
  const metadata = parseMetadataLine(lines[0], marker, context, findings);
  if (metadata) {
    checkMetadata(metadata, {
      context,
      kind,
      expectedMarker: reviewBot.commentMarker(kind, settings, shortSha),
      settings,
      pr,
      headSha,
      changedFiles,
      changedLineCount,
      findings,
    });
  }
  const heading = `## ${expectedBotName} ${config.label} - ${shortSha}`;
  if (lines[1] !== heading) {
    findings.push(`${context} heading must be '${heading}', got '${lines[1] || ""}'.`);
  }
  const firstVisibleBodyLine = firstNonEmptyLine(lines.slice(2));
  if (firstVisibleBodyLine !== `**Verdict**: ${firstVerdict}`) {
    findings.push(
      `${context} first visible body line must be '**Verdict**: ${firstVerdict}', got '${firstVisibleBodyLine || ""}'.`
    );
  }
}

function checkBudgetSkipComment(input) {
  const {
    comment,
    context,
    marker,
    kind,
    config,
    settings,
    pr,
    headSha,
    shortSha,
    changedFiles,
    changedLineCount,
    findings,
  } = input;
  const lines = comment.split(/\r?\n/);
  const metadata = parseMetadataLine(lines[0], marker, context, findings);
  if (metadata) {
    checkMetadata(metadata, {
      context,
      kind: "budget-skip",
      reviewKind: kind,
      expectedMarker: reviewBot.budgetSkipMarker(kind, settings, shortSha),
      settings,
      pr,
      headSha,
      changedFiles,
      changedLineCount,
      findings,
    });
  }
  const heading = `## ${expectedBotName} ${config.label} skipped - ${shortSha}`;
  if (lines[1] !== heading) {
    findings.push(`${context} heading must be '${heading}', got '${lines[1] || ""}'.`);
  }
  const firstVisibleBodyLine = firstNonEmptyLine(lines.slice(2));
  if (firstVisibleBodyLine !== `**Verdict**: ${expectedSkipVerdict}`) {
    findings.push(
      `${context} first visible body line must be '**Verdict**: ${expectedSkipVerdict}', got '${firstVisibleBodyLine || ""}'.`
    );
  }
  if (!comment.includes(expectedSkipTail)) {
    findings.push(`${context} must include the no-provider-call guidance.`);
  }
}

function parseMetadataLine(line, marker, context, findings) {
  const match = String(line || "").match(new RegExp(`^<!-- ${escapeRegExp(marker)}:(\\{.*\\}) -->$`));
  if (!match) {
    findings.push(`${context} must start with '<!-- ${marker}:{...} -->'.`);
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    findings.push(`${context} metadata must be JSON: ${error.message}`);
    return null;
  }
}

function checkMetadata(metadata, input) {
  const {
    context,
    kind,
    reviewKind,
    expectedMarker,
    settings,
    pr,
    headSha,
    changedFiles,
    changedLineCount,
    findings,
  } = input;
  const expected = {
    version: 1,
    marker: expectedMarker,
    kind,
    lane: reviewBot.reviewLane(settings),
    provider: settings.provider,
    model: settings.model,
    headSha,
    repo: settings.repo,
    pr: Number(pr.number),
    changedFiles: changedFiles.length,
    changedLines: changedLineCount,
  };
  if (reviewKind) {
    expected.reviewKind = reviewKind;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (metadata[key] !== value) {
      findings.push(`${context} metadata '${key}' must be ${JSON.stringify(value)}, got ${JSON.stringify(metadata[key])}.`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(String(metadata.createdAt || ""))) {
    findings.push(`${context} metadata must include an ISO createdAt timestamp.`);
  }
}

function checkDocs(configs, marker, docTexts, findings) {
  const docPath = "docs/review-comment-format.md";
  const text = docTexts[docPath] || readText(docPath);
  const normalized = normalizeWhitespace(text);
  const requiredSnippets = [
    `## ${expectedBotName} <review label> - <short-sha>`,
    "**Verdict**: <allowed verdict>",
    `<!-- ${marker}:{"version":1,"marker":"..."} -->`,
    `## ${expectedBotName} <review label> skipped - <short-sha>`,
    `**Verdict**: ${expectedSkipVerdict}`,
    expectedSkipTail,
    "`budget-skip`",
    "`reviewKind`",
  ];
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet) && !normalized.includes(normalizeWhitespace(snippet))) {
      findings.push(`${docPath} must include '${snippet}'.`);
    }
  }
  for (const [kind, config] of Object.entries(configs)) {
    if (!text.includes(`\`${kind}\``)) {
      findings.push(`${docPath} must document review kind '${kind}'.`);
    }
    if (!text.includes(`\`${config.label}\``)) {
      findings.push(`${docPath} must document review label '${config.label}'.`);
    }
    for (const verdict of allowedVerdicts(config)) {
      if (!text.includes(`\`${verdict}\``)) {
        findings.push(`${docPath} must document verdict '${verdict}' for ${kind}.`);
      }
    }
  }
}

function firstAllowedVerdict(config) {
  return allowedVerdicts(config)[0];
}

function allowedVerdicts(config) {
  return String(config.verdicts || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstNonEmptyLine(lines) {
  return lines.map((line) => line.trim()).find(Boolean) || "";
}

function countOccurrences(value, needle) {
  return String(value).split(needle).length - 1;
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
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
  checkReviewCommentFormat,
  expectedMarker,
  expectedSkipVerdict,
};
