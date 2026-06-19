"use strict";

const FRONTEND_REPO = "6529-Collections/6529seize-frontend";
const MAX_HINTS_PER_KIND = 24;

function collectFrontendReviewHints(input = {}) {
  const kind = String(input.kind || "").toLowerCase();
  if (!["i18n", "wcag"].includes(kind)) {
    return [];
  }
  if (String(input.repo || "") !== FRONTEND_REPO) {
    return [];
  }

  const addedLines = parseAddedDiffLines(input.diff || "");
  const scannedLines = [];
  const hints = [];
  for (const added of addedLines) {
    if (hints.length >= MAX_HINTS_PER_KIND) {
      break;
    }
    if (!shouldScanFile(added.file, kind)) {
      continue;
    }
    scannedLines.push(added);
    const lineHints = kind === "i18n" ? i18nHintsForLine(added) : wcagHintsForLine(added);
    for (const hint of lineHints) {
      appendHint(hints, hint);
      if (hints.length >= MAX_HINTS_PER_KIND) {
        break;
      }
    }
  }
  if (kind === "wcag" && hints.length < MAX_HINTS_PER_KIND) {
    for (const hint of wcagContextualHintsForAddedLines(scannedLines)) {
      appendHint(hints, hint);
      if (hints.length >= MAX_HINTS_PER_KIND) {
        break;
      }
    }
  }
  return hints;
}

function parseAddedDiffLines(diff) {
  const result = [];
  let file = "";
  let newLine = 0;
  for (const rawLine of String(diff || "").split(/\r?\n/)) {
    const fileMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(rawLine);
    if (fileMatch) {
      file = unquoteDiffPath(fileMatch[2]);
      newLine = 0;
      continue;
    }

    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(rawLine);
    if (hunkMatch) {
      newLine = Number(hunkMatch[1]);
      continue;
    }

    if (!file || newLine <= 0) {
      continue;
    }

    if (/^(?:\+\+\+|---)\s/.test(rawLine)) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      result.push({
        file,
        line: newLine,
        text: rawLine.slice(1),
      });
      newLine += 1;
      continue;
    }

    if (!rawLine.startsWith("-")) {
      newLine += 1;
    }
  }
  return result;
}

function i18nHintsForLine(added) {
  const text = added.text;
  const hints = [];
  if (
    !isI18nFormattingHelperPath(added.file) &&
    (/\b(?:toLocaleString|toLocaleDateString|toLocaleTimeString|localeCompare)\s*\(/.test(text) ||
      /\bnew\s+Intl\.[A-Za-z][A-Za-z0-9_]*\s*\(/.test(text))
  ) {
    hints.push(
      hint(added, {
        ruleId: "i18n/no-direct-locale-formatting",
        category: "i18n",
        severity: "major",
        confidence: "high",
        message: "New locale-sensitive formatting or sorting should use the frontend i18n helpers.",
        why: "Direct locale APIs often miss the app locale, fallback policy, and testable helper behavior.",
        suggestedFix:
          "Use the repo helpers from i18n/format.ts or i18n/locales.ts, such as formatNumber, formatDate, formatRelativeTime, or compareLocalized.",
        standardReference: "ops/standards/frontend-i18n-localization.md",
      })
    );
  }

  const attrMatch = /\b(aria-label|title|placeholder|alt)\s*=\s*["']([^"']{2,})["']/.exec(text);
  if (attrMatch && !isProbablyNonUserFacingLiteral(attrMatch[2])) {
    hints.push(
      hint(added, {
        ruleId: "i18n/no-hardcoded-accessible-name",
        category: "i18n",
        severity: "major",
        confidence: "medium-high",
        message: `New hardcoded ${attrMatch[1]} text should be message-backed with visible copy.`,
        why: "Accessible names, placeholders, titles, and alt text are user-facing copy and need the same localization path as visible labels.",
        suggestedFix:
          "Move the text into the en-US message source and call the local t(locale, key, params) path used by the touched component.",
        standardReference: "ops/standards/frontend-i18n-localization.md",
      })
    );
  }

  const jsxTextMatch = /(?:<>|<[A-Za-z][A-Za-z0-9.:-]*\b[^>]*>)\s*([A-Za-z][^<>{}\n]{2,80})\s*<\//.exec(text);
  if (jsxTextMatch && !isProbablyNonUserFacingLiteral(jsxTextMatch[1])) {
    hints.push(
      hint(added, {
        ruleId: "i18n/no-new-hardcoded-jsx-text",
        category: "i18n",
        severity: "major",
        confidence: "medium",
        message: "New JSX text should be message-backed in migrated or touched frontend UI.",
        why: "Progressive localization requires new and touched visible copy to enter the message source instead of becoming new debt.",
        suggestedFix:
          "Use an existing message helper in the component area, add an en-US source key, and keep partial locale fallback behavior explicit.",
        standardReference: "ops/standards/frontend-i18n-localization.md",
      })
    );
  }

  if (/["'`][A-Za-z][^"'`]{8,}["'`]\s*\+|\+\s*["'`][A-Za-z][^"'`]{8,}["'`]/.test(text)) {
    hints.push(
      hint(added, {
        ruleId: "i18n/no-sentence-concat",
        category: "i18n",
        severity: "minor",
        confidence: "medium",
        message: "New user-facing sentence fragments should use interpolation instead of concatenation.",
        why: "Sentence concatenation breaks word order and grammar in translated locales.",
        suggestedFix: "Use one full message with named interpolation parameters.",
        standardReference: "ops/standards/frontend-i18n-localization.md",
      })
    );
  }

  if (/\b(?:EN-UK|en_UK|en-UK)\b/.test(text)) {
    hints.push(
      hint(added, {
        ruleId: "i18n/supported-locale-id",
        category: "i18n",
        severity: "major",
        confidence: "high",
        message: "Use supported BCP 47 locale identifiers.",
        why: "The frontend locale set uses en-GB, not EN-UK/en_UK/en-UK.",
        suggestedFix: "Replace the unsupported variant with en-GB.",
        standardReference: "ops/standards/frontend-i18n-localization.md",
      })
    );
  }

  return hints;
}

function wcagHintsForLine(added) {
  const text = added.text;
  const hints = [];
  const clickableMatch = /<\s*(div|span|li|section|article|p|img)\b[^>]*\bonClick\s*=/.exec(text);
  if (clickableMatch) {
    hints.push(
      hint(added, {
        ruleId: "wcag/no-clickable-noninteractive",
        category: "wcag",
        severity: "major",
        confidence: "high",
        message: `New clickable ${clickableMatch[1]} should be a semantic interactive element.`,
        why: "Native buttons and links expose keyboard behavior, roles, states, and names without custom reimplementation.",
        suggestedFix: "Use button or Link/a as appropriate, then verify keyboard access and focus visibility.",
        standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
      })
    );
  }

  if (/<\s*(input|select|textarea)\b/i.test(text) && !hasInlineFormControlName(text)) {
    hints.push(
      hint(added, {
        ruleId: "wcag/form-control-label",
        category: "wcag",
        severity: "major",
        confidence: "medium-high",
        message: "New form controls need associated labels or accessible names.",
        why: "Unlabeled controls are hard to operate with screen readers and voice control.",
        suggestedFix: "Associate a visible label, aria-labelledby, or a justified aria-label with the control.",
        standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
      })
    );
  }

  if (/<\s*(button|a)\b[^>]*(?:<\s*(?:[A-Z][A-Za-z0-9]*Icon|svg)\b|className=["'][^"']*\bicon\b)/.test(text) && !/\b(?:aria-label|aria-labelledby|title)\s*=/.test(text)) {
    hints.push(
      hint(added, {
        ruleId: "wcag/icon-button-accessible-name",
        category: "wcag",
        severity: "major",
        confidence: "medium",
        message: "Icon-only controls need a stable accessible name.",
        why: "Users of assistive technology need the control purpose exposed independently from the icon graphic.",
        suggestedFix: "Add a localized aria-label or visible text, and hide decorative SVGs from assistive tech when needed.",
        standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
      })
    );
  }

  if (/\brole\s*=\s*["']dialog["']/.test(text)) {
    hints.push(
      hint(added, {
        ruleId: "wcag/dialog-focus-management",
        category: "wcag",
        severity: "major",
        confidence: "medium",
        message: "New dialog semantics need focus management and should prefer native dialog where practical.",
        why: "Modal and dialog UI must move focus, preserve context, support dismissal, and restore focus after close.",
        suggestedFix:
          "Prefer a native dialog element or verify the custom dialog manages focus, labels, dismissal, inert background behavior, and restoration.",
        standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
        manualCheckRequired: true,
      })
    );
  }

  if (/:\s*focus(?:-visible)?\b/.test(text) && /\boutline\s*:\s*(?:0|none)\b/.test(text)) {
    hints.push(
      hint(added, {
        ruleId: "wcag/focus-visible-not-removed",
        category: "wcag",
        severity: "major",
        confidence: "medium-high",
        message: "Focus styles should not be removed without an accessible replacement.",
        why: "Keyboard users need a visible focus indicator to understand where actions will occur.",
        suggestedFix: "Preserve the default outline or add a clearly visible :focus-visible replacement.",
        standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
      })
    );
  }

  if (/\bautoFocus\b/.test(text)) {
    hints.push(
      hint(added, {
        ruleId: "wcag/focus-order",
        category: "wcag",
        severity: "minor",
        confidence: "medium",
        message: "New autofocus behavior needs focus-order review.",
        why: "Unexpected focus movement can disorient keyboard and screen-reader users.",
        suggestedFix: "Verify autofocus is task-critical, announced in context, and does not skip required content.",
        standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
        manualCheckRequired: true,
      })
    );
  }

  return hints;
}

function wcagContextualHintsForAddedLines(addedLines) {
  const hints = [];
  const byFile = new Map();
  for (const added of addedLines) {
    const list = byFile.get(added.file) || [];
    list.push(added);
    byFile.set(added.file, list);
  }

  for (const lines of byFile.values()) {
    for (const hint of multilineIconControlHints(lines)) {
      appendHint(hints, hint);
    }
    for (const hint of multilineFocusOutlineHints(lines)) {
      appendHint(hints, hint);
    }
  }
  return hints;
}

function multilineIconControlHints(lines) {
  const hints = [];
  let control = null;
  for (const added of lines) {
    const text = added.text;
    const openMatch = /<\s*(button|a)\b([^>]*)>/.exec(text);
    if (openMatch && !hasAccessibleControlName(openMatch[2] || "")) {
      control = {
        tag: openMatch[1],
        start: added,
        sawIcon: hasIconOnlySignal(text),
        sawText: hasVisibleInlineText(text),
        lineCount: 0,
      };
      if (new RegExp(`</\\s*${control.tag}\\s*>`).test(text)) {
        if (control.sawIcon && !control.sawText) {
          hints.push(iconButtonHint(control.start, "medium"));
        }
        control = null;
      }
      continue;
    }

    if (!control) {
      continue;
    }
    control.lineCount += 1;
    if (hasAccessibleControlName(text)) {
      control = null;
      continue;
    }
    if (hasIconOnlySignal(text)) {
      control.sawIcon = true;
    }
    if (hasVisibleInlineText(text)) {
      control.sawText = true;
    }
    if (new RegExp(`</\\s*${control.tag}\\s*>`).test(text)) {
      if (control.sawIcon && !control.sawText) {
        hints.push(iconButtonHint(control.start, "medium"));
      }
      control = null;
      continue;
    }
    if (control.lineCount > 8) {
      control = null;
    }
  }
  return hints;
}

function multilineFocusOutlineHints(lines) {
  const hints = [];
  let focusRule = null;
  for (const added of lines) {
    const text = added.text;
    if (/:\s*focus(?:-visible)?\b/.test(text)) {
      focusRule = {
        start: added,
        lineCount: 0,
      };
    }
    if (focusRule) {
      focusRule.lineCount += 1;
      if (/\boutline\s*:\s*(?:0|none)\b/.test(text)) {
        hints.push(focusVisibleHint(added, "medium"));
        focusRule = null;
        continue;
      }
      if (text.includes("}") || focusRule.lineCount > 8) {
        focusRule = null;
      }
    }
  }
  return hints;
}

function formatReviewHintsForPrompt(hints) {
  if (!Array.isArray(hints) || hints.length === 0) {
    return "";
  }
  return hints
    .map((item) =>
      [
        `- ${item.file}:${item.line} ${item.ruleId} (${item.severity}, confidence ${item.confidence})`,
        `  message: ${item.message}`,
        `  why: ${item.why}`,
        `  suggestedFix: ${item.suggestedFix}`,
        `  standard: ${item.standardReference}`,
        item.manualCheckRequired ? "  manualCheckRequired: true" : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
}

function appendHint(hints, hint) {
  if (!hint) {
    return;
  }
  if (hints.some((item) => item.ruleId === hint.ruleId && item.file === hint.file && item.line === hint.line)) {
    return;
  }
  hints.push(hint);
}

function hint(added, details) {
  return {
    blocking: false,
    manualCheckRequired: false,
    ...details,
    file: added.file,
    line: added.line,
    sample: truncateSample(added.text),
  };
}

function iconButtonHint(added, confidence = "medium") {
  return hint(added, {
    ruleId: "wcag/icon-button-accessible-name",
    category: "wcag",
    severity: "major",
    confidence,
    message: "Icon-only controls need a stable accessible name.",
    why: "Users of assistive technology need the control purpose exposed independently from the icon graphic.",
    suggestedFix: "Add a localized aria-label or visible text, and hide decorative SVGs from assistive tech when needed.",
    standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
  });
}

function focusVisibleHint(added, confidence = "medium-high") {
  return hint(added, {
    ruleId: "wcag/focus-visible-not-removed",
    category: "wcag",
    severity: "major",
    confidence,
    message: "Focus styles should not be removed without an accessible replacement.",
    why: "Keyboard users need a visible focus indicator to understand where actions will occur.",
    suggestedFix: "Preserve the default outline or add a clearly visible :focus-visible replacement.",
    standardReference: "ops/standards/frontend-accessibility-wcag-22-aa.md",
  });
}

function shouldScanFile(file, kind) {
  const normalized = String(file || "").replace(/\\/g, "/");
  if (!normalized || isTestOrFixturePath(normalized)) {
    return false;
  }
  if (!/^(app|components|contexts|helpers|hooks|i18n|lib|pages|services|store|styles|utils)\//.test(normalized)) {
    return false;
  }
  if (kind === "wcag") {
    return /\.(tsx|jsx|ts|js|scss|css|mdx?)$/i.test(normalized);
  }
  return /\.(tsx|jsx|ts|js|json|mdx?)$/i.test(normalized);
}

function isTestOrFixturePath(file) {
  return (
    /(^|\/)(?:__tests__|tests?|e2e|fixtures?|mocks?)\//i.test(file) ||
    /\.(?:test|spec)\.[tj]sx?$/i.test(file)
  );
}

function isProbablyNonUserFacingLiteral(value) {
  const text = String(value || "").trim();
  if (!text || text.length < 2) {
    return true;
  }
  if (/^[A-Z0-9_./:-]+$/.test(text)) {
    return true;
  }
  if (/^(true|false|null|undefined)$/i.test(text)) {
    return true;
  }
  if (/^https?:\/\//i.test(text)) {
    return true;
  }
  return false;
}

function isI18nFormattingHelperPath(file) {
  const normalized = String(file || "").replace(/\\/g, "/");
  return /^i18n\/(?:format|locales)\.[tj]sx?$/.test(normalized);
}

function hasInlineFormControlName(text) {
  return (
    /\b(?:aria-label|aria-labelledby|type=["']hidden["'])\b/i.test(text) ||
    /<\s*label\b/i.test(text)
  );
}

function hasAccessibleControlName(text) {
  return /\b(?:aria-label|aria-labelledby|title)\s*=/.test(text);
}

function hasIconOnlySignal(text) {
  return /<\s*(?:[A-Z][A-Za-z0-9]*Icon|svg)\b|className=["'][^"']*\bicon\b/.test(text);
}

function hasVisibleInlineText(text) {
  return />(?!\s*<)\s*[A-Za-z][^<>{}\n]{1,80}\s*</.test(text);
}

function unquoteDiffPath(value) {
  return String(value || "").replace(/^"|"$/g, "");
}

function truncateSample(value) {
  const text = String(value || "").trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

module.exports = {
  FRONTEND_REPO,
  collectFrontendReviewHints,
  formatReviewHintsForPrompt,
  parseAddedDiffLines,
};
