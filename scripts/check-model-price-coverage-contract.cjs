#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const modelPricesCli = require("../bin/apply-model-prices.cjs");
const {
  assertModelPriceCatalogCoverage,
  modelPriceCatalogCoverage,
  requiredModelPriceRowsFromCatalog,
} = require("../src/model-prices.cjs");

const root = path.resolve(__dirname, "..");
const targetDocs = [
  "README.md",
  "docs/model-pricing.md",
  "docs/operations.md",
  "docs/provider-setup.md",
  "docs/release-operations-map.md",
  "docs/release.md",
  "docs/release-readiness.md",
  "docs/roadmap.md",
];

function main() {
  const result = checkModelPriceCoverageContract();
  console.log(
    `model price coverage contract ok (${result.coverageCases} coverage cases, ${result.docs} docs checked)`
  );
}

function checkModelPriceCoverageContract(options = {}) {
  const findings = [];
  const sourceTexts = options.sourceTexts || {};
  const docTexts = options.docTexts || {};

  checkReadyCoverage(findings);
  checkMissingCoverage(findings);
  checkRateCoverage(findings);
  checkZeroAndFreshnessCoverage(findings);
  checkPlaceholderSourceCoverage(findings);
  checkCli(findings);
  checkSourceAnchors(sourceTexts, findings);
  checkDocs(docTexts, findings);

  if (findings.length) {
    if (!options.quiet) {
      for (const finding of findings) {
        console.error(finding);
      }
    }
    throw new Error(`model price coverage contract check found ${findings.length} issue(s).`);
  }

  return {
    coverageCases: 6,
    docs: targetDocs.length,
  };
}

function checkReadyCoverage(findings) {
  const catalog = sampleCatalog();
  const required = requiredModelPriceRowsFromCatalog(catalog);
  if (required.map(priceKey).join(",") !== "anthropic:claude-opus-4-8,openai:gpt-5.5") {
    findings.push("model price coverage must require catalog default provider/model lanes.");
  }
  const coverage = modelPriceCatalogCoverage(freshPriceDocument(), catalog, {
    now: "2026-06-14T00:00:00.000Z",
  });
  if (!coverage.ready || coverage.covered !== 2 || coverage.required.length !== 2) {
    findings.push("fresh non-zero price rows must cover both catalog default lanes.");
  }
  try {
    assertModelPriceCatalogCoverage(freshPriceDocument(), catalog, {
      now: "2026-06-14T00:00:00.000Z",
    });
  } catch (error) {
    findings.push(`fresh catalog coverage should pass: ${error.message}`);
  }
}

function checkMissingCoverage(findings) {
  const document = freshPriceDocument();
  document.prices = document.prices.slice(0, 1);
  expectCoverageError(
    document,
    /missing rows: openai:gpt-5\.5/,
    "missing catalog default lanes must fail coverage",
    findings
  );
}

function checkRateCoverage(findings) {
  const document = freshPriceDocument();
  document.prices[1].outputUsdPerMillion = null;
  expectCoverageError(
    document,
    /missing input\/output rates: openai:gpt-5\.5/,
    "catalog coverage must require both input and output rates",
    findings
  );
}

function checkZeroAndFreshnessCoverage(findings) {
  const zeroDocument = freshPriceDocument();
  zeroDocument.prices[0].inputUsdPerMillion = 0;
  expectCoverageError(
    zeroDocument,
    /zero-rate placeholders: anthropic:claude-opus-4-8 inputUsdPerMillion/,
    "catalog coverage must reject zero placeholders by default",
    findings
  );
  try {
    assertModelPriceCatalogCoverage(zeroDocument, sampleCatalog(), {
      allowZeroPrice: true,
      now: "2026-06-14T00:00:00.000Z",
    });
  } catch (error) {
    findings.push(`allow-zero override should allow documented zero rows: ${error.message}`);
  }

  const staleDocument = freshPriceDocument();
  staleDocument.prices[0].sourceCheckedAt = "2026-04-01T00:00:00.000Z";
  expectCoverageError(
    staleDocument,
    /stale or future source evidence: anthropic:claude-opus-4-8 checked/,
    "catalog coverage must reject stale source evidence by default",
    findings
  );
  try {
    assertModelPriceCatalogCoverage(staleDocument, sampleCatalog(), {
      allowStaleSource: true,
      now: "2026-06-14T00:00:00.000Z",
    });
  } catch (error) {
    findings.push(`allow-stale override should allow accepted stale rows: ${error.message}`);
  }
}

function checkPlaceholderSourceCoverage(findings) {
  const document = freshPriceDocument();
  document.prices[0].sourceUrl = "https://provider.example/pricing";
  expectCoverageError(
    document,
    /placeholder source URLs: anthropic:claude-opus-4-8 provider\.example/,
    "catalog coverage must reject placeholder source URLs",
    findings
  );
}

function checkCli(findings) {
  try {
    const args = modelPricesCli.parseArgs([
      "--file",
      "prices.json",
      "--catalog",
      "catalog.json",
      "--require-catalog-coverage",
      "--allow-zero-price",
    ]);
    assert.equal(args.file, "prices.json");
    assert.equal(args.catalog, "catalog.json");
    assert.equal(args.requireCatalogCoverage, true);
    assert.equal(args.allowZeroPrice, true);
  } catch (error) {
    findings.push(`model-prices CLI must parse catalog coverage flags: ${error.message}`);
  }

  try {
    modelPricesCli.parseArgs(["--catalog"]);
    findings.push("model-prices CLI must require a catalog path value.");
  } catch (error) {
    if (!String(error.message).includes("--catalog requires a value")) {
      findings.push("model-prices CLI missing catalog error should be explicit.");
    }
  }
}

function expectCoverageError(document, pattern, label, findings) {
  try {
    assertModelPriceCatalogCoverage(document, sampleCatalog(), {
      now: "2026-06-14T00:00:00.000Z",
    });
    findings.push(label);
  } catch (error) {
    if (!pattern.test(String(error.message))) {
      findings.push(`${label}; got '${error.message}'.`);
    }
  }
}

function sampleCatalog() {
  return {
    version: 1,
    defaultProvider: "anthropic",
    providers: {
      anthropic: {
        defaultModel: "claude-opus-4-8",
        requireExplicitModel: false,
        models: {
          "claude-opus-4-8": { status: "default", notes: "" },
        },
      },
      openai: {
        defaultModel: "gpt-5.5",
        requireExplicitModel: false,
        models: {
          "gpt-5.5": { status: "default", notes: "" },
        },
      },
      openrouter: {
        defaultModel: "",
        requireExplicitModel: true,
        models: {},
      },
    },
  };
}

function freshPriceDocument() {
  return {
    version: 1,
    currency: "USD",
    prices: [
      {
        provider: "anthropic",
        model: "claude-opus-4-8",
        inputUsdPerMillion: 1,
        cachedInputUsdPerMillion: 0.5,
        outputUsdPerMillion: 5,
        reasoningUsdPerMillion: null,
        effectiveFrom: "2026-06-12T00:00:00.000Z",
        sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/pricing",
        sourceCheckedAt: "2026-06-12T12:00:00.000Z",
        notes: "Reviewed against provider pricing docs.",
      },
      {
        provider: "openai",
        model: "gpt-5.5",
        inputUsdPerMillion: 1,
        cachedInputUsdPerMillion: null,
        outputUsdPerMillion: 5,
        reasoningUsdPerMillion: 5,
        effectiveFrom: "2026-06-12T00:00:00.000Z",
        sourceUrl: "https://platform.openai.com/docs/pricing",
        sourceCheckedAt: "2026-06-12T12:00:00.000Z",
        notes: "Reviewed against provider pricing docs.",
      },
    ],
  };
}

function checkSourceAnchors(sourceTexts, findings) {
  const requiredBySource = {
    "package.json": ["check:model-price-coverage", "model-prices"],
    "src/model-prices.cjs": [
      "assertModelPriceCatalogCoverage",
      "requiredModelPriceRowsFromCatalog",
      "placeholder source URLs",
      "missing input/output rates",
    ],
    "bin/apply-model-prices.cjs": [
      "--require-catalog-coverage",
      "assertModelPriceCatalogCoverage",
      "--catalog",
    ],
    "scripts/release-check.cjs": ["scripts/check-model-price-coverage-contract.cjs"],
    "config/release-operations-map.json": [
      "model-price-coverage-contract",
      "--require-catalog-coverage",
    ],
  };
  for (const [file, snippets] of Object.entries(requiredBySource)) {
    checkSnippets(getText(file, sourceTexts), snippets, file, findings);
  }
}

function checkDocs(docTexts, findings) {
  const requiredByDoc = {
    "README.md": [
      "npm run check:model-price-coverage",
      "npm run model-prices -- -- --file prices.json --require-catalog-coverage",
    ],
    "docs/model-pricing.md": [
      "## Catalog Coverage",
      "npm run model-prices -- -- --file prices.json --require-catalog-coverage",
      "every catalog default provider/model lane",
      "input and output rates",
      "placeholder source URLs",
      "npm run check:model-price-coverage",
    ],
    "docs/operations.md": [
      "npm run model-prices -- -- --file <reviewed-model-price-file.json> --require-catalog-coverage",
      "npm run check:model-price-coverage",
    ],
    "docs/provider-setup.md": [
      "--require-catalog-coverage",
      "catalog default lanes",
    ],
    "docs/release-operations-map.md": [
      "npm run check:model-price-coverage",
      "model price coverage",
    ],
    "docs/release.md": [
      "npm run check:model-price-coverage",
      "--require-catalog-coverage",
    ],
    "docs/release-readiness.md": [
      "model price coverage",
      "catalog default provider/model lanes",
    ],
    "docs/roadmap.md": [
      "model price coverage",
      "catalog default provider/model lanes",
    ],
  };
  for (const [doc, snippets] of Object.entries(requiredByDoc)) {
    checkSnippets(getText(doc, docTexts), snippets, doc, findings);
  }
}

function checkSnippets(text, snippets, label, findings) {
  const normalizedText = normalizeWhitespace(text);
  for (const snippet of snippets) {
    if (!normalizedText.includes(normalizeWhitespace(snippet))) {
      findings.push(`${label} must include '${snippet}'.`);
    }
  }
}

function getText(relativePath, overrides) {
  if (Object.prototype.hasOwnProperty.call(overrides, relativePath)) {
    return overrides[relativePath];
  }
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function priceKey(price) {
  return `${price.provider}:${price.model}`;
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
  checkModelPriceCoverageContract,
};
