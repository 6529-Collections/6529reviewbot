"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const DEFAULT_CONTEXTS = [
  "web-desktop",
  "web-mobile",
  "native-mobile",
  "electron-desktop",
];

const CONTEXTS = {
  "web-desktop": {
    label: "Web desktop",
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    userAgentSuffix: "",
    platformFamily: "web-desktop",
  },
  "web-mobile": {
    label: "Web mobile",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgentSuffix: "",
    platformFamily: "web-mobile",
  },
  "web-narrow": {
    label: "Web narrow desktop",
    viewport: { width: 1279, height: 900 },
    isMobile: false,
    hasTouch: false,
    userAgentSuffix: "",
    platformFamily: "web-narrow",
  },
  "web-tablet-touch": {
    label: "Web tablet touch",
    viewport: { width: 1024, height: 768 },
    isMobile: true,
    hasTouch: true,
    userAgentSuffix: "",
    platformFamily: "web-tablet",
  },
  "native-mobile": {
    label: "Native mobile app",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    nativePlatform: "ios",
    userAgentSuffix: " 6529NativeShell/1.0",
    platformFamily: "native",
    simulated: true,
  },
  "native-ios": {
    label: "Native iOS app",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    nativePlatform: "ios",
    userAgentSuffix: " 6529NativeShell/1.0",
    platformFamily: "native",
    simulated: true,
  },
  "native-android": {
    label: "Native Android app",
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    nativePlatform: "android",
    userAgentSuffix: " 6529NativeShell/1.0 Android",
    platformFamily: "native",
    simulated: true,
  },
  "electron-desktop": {
    label: "Electron desktop",
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
    userAgentSuffix: " Electron/37.0.0 6529Core/1.0",
    platformFamily: "electron",
    simulated: true,
  },
};

const SHELL_CANARY_ROUTES = ["/", "/waves"];
const FALLBACK_ROUTES = ["/", "/waves", "/network", "/the-memes", "/meme-lab", "/rememes"];
const GLOBAL_ROUTES = [
  "/",
  "/waves",
  "/network",
  "/the-memes",
  "/meme-lab",
  "/rememes",
  "/notifications",
  "/open-mobile?path=%2Fwaves",
];

const ROUTE_MAPPINGS = [
  { pattern: /^components[\/\\]waves[\/\\]/, routes: ["/waves"] },
  { pattern: /^app[\/\\]waves(?:[\/\\]|$)/, routes: ["/waves"] },
  { pattern: /^components[\/\\]brain[\/\\]/, routes: ["/waves", "/my-stream"] },
  { pattern: /^components[\/\\]the-memes[\/\\]/, routes: ["/the-memes"] },
  { pattern: /^app[\/\\]the-memes(?:[\/\\]|$)/, routes: ["/the-memes"] },
  { pattern: /^components[\/\\]memelab[\/\\]/, routes: ["/meme-lab"] },
  { pattern: /^app[\/\\]meme-lab(?:[\/\\]|$)/, routes: ["/meme-lab"] },
  { pattern: /^components[\/\\]rememes[\/\\]/, routes: ["/rememes"] },
  { pattern: /^app[\/\\]rememes(?:[\/\\]|$)/, routes: ["/rememes"] },
  { pattern: /^components[\/\\]network[\/\\]/, routes: ["/network"] },
  { pattern: /^app[\/\\]network(?:[\/\\]|$)/, routes: ["/network"] },
  { pattern: /^components[\/\\]notifications[\/\\]/, routes: ["/notifications"] },
  { pattern: /^app[\/\\]notifications(?:[\/\\]|$)/, routes: ["/notifications"] },
  { pattern: /^components[\/\\]nextGen[\/\\]/, routes: ["/nextgen"] },
  { pattern: /^app[\/\\]nextgen(?:[\/\\]|$)/, routes: ["/nextgen"] },
  { pattern: /^components[\/\\]6529Gradient[\/\\]/, routes: ["/6529-gradient"] },
  { pattern: /^app[\/\\]6529-gradient(?:[\/\\]|$)/, routes: ["/6529-gradient"] },
  { pattern: /^components[\/\\]header[\/\\]share[\/\\]/, routes: ["/", "/waves"] },
  { pattern: /^app[\/\\]open-mobile(?:[\/\\]|$)/, routes: ["/open-mobile?path=%2Fwaves"] },
];

const GLOBAL_PATTERNS = [
  /^app[\/\\]layout\./,
  /^app[\/\\]global-error\./,
  /^app[\/\\]error\./,
  /^components[\/\\]layout[\/\\]/,
  /^components[\/\\]providers[\/\\]/,
  /^components[\/\\]navigation[\/\\]/,
  /^components[\/\\]header[\/\\]/,
  /^components[\/\\]auth[\/\\]/,
  /^components[\/\\]mobile-wrapper-dialog[\/\\]/,
  /^hooks[\/\\]useCapacitor\./,
  /^hooks[\/\\]useAndroidKeyboard\./,
  /^hooks[\/\\]useElectron\./,
  /^styles[\/\\]/,
  /^tailwind\.config\./,
  /^next\.config\./,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
];

const DEFAULT_PROFILE = {
  id: "generic-next-frontend",
  label: "Generic Next.js frontend",
  packageNames: [],
  shellCanaryRoutes: SHELL_CANARY_ROUTES,
  fallbackRoutes: FALLBACK_ROUTES,
  globalRoutes: GLOBAL_ROUTES,
  routeMappings: ROUTE_MAPPINGS,
  globalPatterns: GLOBAL_PATTERNS,
  platformNotes: [
    "web-desktop is real Chromium at desktop size.",
    "web-mobile is real Chromium with mobile/touch emulation.",
    "native-mobile/native-ios/native-android are browser-level Capacitor simulations.",
    "electron-desktop is Chromium with an Electron user-agent simulation.",
  ],
  deterministicChecks: [],
};

const PROFILE_6529_SEIZE_FRONTEND = {
  id: "6529seize-frontend",
  label: "6529 Seize frontend",
  packageNames: ["6529seize"],
  shellCanaryRoutes: ["/", "/waves"],
  fallbackRoutes: [
    "/",
    "/waves",
    "/network",
    "/the-memes",
    "/meme-lab",
    "/rememes",
    "/meme-calendar",
    "/discover",
  ],
  globalRoutes: [
    "/",
    "/waves",
    "/messages",
    "/network",
    "/the-memes",
    "/meme-lab",
    "/rememes",
    "/meme-calendar",
    "/notifications",
    "/open-mobile?path=%2Fwaves",
  ],
  routeMappings: [
    ...ROUTE_MAPPINGS,
    { pattern: /^components[\/\\]messages[\/\\]/, routes: ["/messages"] },
    { pattern: /^app[\/\\]messages(?:[\/\\]|$)/, routes: ["/messages"] },
    { pattern: /^components[\/\\]user[\/\\]/, routes: ["/6529er/collected", "/6529er"] },
    { pattern: /^app[\/\\]\[user\][\/\\]collected(?:[\/\\]|$)/, routes: ["/6529er/collected"] },
    { pattern: /^app[\/\\]\[user\](?:[\/\\]|$)/, routes: ["/6529er"] },
    { pattern: /^components[\/\\]mobile-wrapper-dialog[\/\\]/, routes: ["/", "/open-mobile?path=%2Fwaves"] },
    { pattern: /^components[\/\\]app-wallets[\/\\]/, routes: ["/tools/app-wallets"] },
    { pattern: /^app[\/\\]tools[\/\\]app-wallets(?:[\/\\]|$)/, routes: ["/tools/app-wallets"] },
    { pattern: /^components[\/\\]drops[\/\\]create[\/\\]/, routes: ["/waves/create"] },
    { pattern: /^components[\/\\]waves[\/\\]create-wave[\/\\]/, routes: ["/waves/create"] },
    { pattern: /^app[\/\\]drop-forge(?:[\/\\]|$)/, routes: ["/drop-forge"] },
    { pattern: /^components[\/\\]drop-forge[\/\\]/, routes: ["/drop-forge"] },
    { pattern: /^app[\/\\]meme-calendar(?:[\/\\]|$)/, routes: ["/meme-calendar"] },
    { pattern: /^components[\/\\]meme-calendar[\/\\]/, routes: ["/meme-calendar"] },
    { pattern: /^app[\/\\]discover(?:[\/\\]|$)/, routes: ["/discover"] },
    { pattern: /^components[\/\\]community-curations[\/\\]/, routes: ["/waves", "/discover"] },
    { pattern: /^components[\/\\]header[\/\\]share[\/\\]/, routes: ["/", "/open-mobile?path=%2Fwaves"] },
  ],
  globalPatterns: [
    ...GLOBAL_PATTERNS,
    /^contexts[\/\\]/,
    /^helpers[\/\\]navigation\./,
    /^hooks[\/\\]useDeviceInfo\./,
    /^hooks[\/\\]isMobileScreen\./,
    /^hooks[\/\\]useDeepLinkNavigation\./,
    /^utils[\/\\]monitoring[\/\\]mobileLaunchTiming/,
    /^config[\/\\]nextConfig\./,
    /^config[\/\\]env\./,
  ],
  platformNotes: [
    "web-desktop should exercise WebLayout/sidebar at 1440x900.",
    "web-mobile should exercise SmallScreenLayout, not the native AppLayout.",
    "native-mobile/native-ios/native-android are fast browser-level Capacitor simulations of AppLayout, bottom navigation, viewport-fit, keyboard/app/deep-link plugins, and body class.",
    "electron-desktop is a fast browser-level Electron renderer simulation using the Electron user-agent branch; it is not a packaged desktop app launch.",
    "Access/restricted pages intentionally bypass the standard app layout shell.",
  ],
  deterministicChecks: [
    "native-capacitor-contract",
    "electron-user-agent-contract",
    "6529-layout-branch-metrics",
    "open-mobile-deeplink-route",
  ],
};

const RESPONSIVENESS_PROFILES = [
  PROFILE_6529_SEIZE_FRONTEND,
  DEFAULT_PROFILE,
];

function parseArgs(argv = []) {
  const options = {
    target: process.cwd(),
    baseRef: "origin/main",
    headRef: "HEAD",
    outputDir: "",
    baseUrl: "http://localhost:3001",
    port: 3001,
    maxPages: 12,
    contexts: DEFAULT_CONTEXTS,
    workers: 4,
    profile: "",
    planOnly: false,
    changedFilesPath: "",
    pages: [],
    failOnWarning: false,
    installCommand: "",
    reuseExistingServer: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`${arg} requires a value.`);
      }
      return argv[index];
    };

    if (arg === "--target") {
      options.target = next();
    } else if (arg === "--base-ref") {
      options.baseRef = next();
    } else if (arg === "--head-ref") {
      options.headRef = next();
    } else if (arg === "--output-dir") {
      options.outputDir = next();
    } else if (arg === "--base-url") {
      options.baseUrl = next();
    } else if (arg === "--port") {
      options.port = positiveInt(next(), arg);
    } else if (arg === "--max-pages") {
      options.maxPages = positiveInt(next(), arg);
    } else if (arg === "--contexts") {
      options.contexts = splitCsv(next());
    } else if (arg === "--workers") {
      options.workers = positiveInt(next(), arg);
    } else if (arg === "--profile") {
      options.profile = next();
    } else if (arg === "--changed-files") {
      options.changedFilesPath = next();
    } else if (arg === "--pages") {
      options.pages = splitCsv(next());
    } else if (arg === "--install-command") {
      options.installCommand = next();
    } else if (arg === "--reuse-existing-server") {
      options.reuseExistingServer = true;
    } else if (arg === "--plan-only") {
      options.planOnly = true;
    } else if (arg === "--fail-on-warning") {
      options.failOnWarning = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return normalizeOptions(options);
}

function normalizeOptions(options) {
  const target = path.resolve(options.target);
  const outputDir = path.resolve(
    options.outputDir || path.join(target, ".reviewbot-responsiveness")
  );
  const contexts = options.contexts.map((context) => {
    if (!CONTEXTS[context]) {
      throw new Error(`Unknown responsiveness context: ${context}`);
    }
    return context;
  });
  return {
    ...options,
    target,
    outputDir,
    contexts,
    profile: String(options.profile || ""),
  };
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || String(parsed) !== String(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function detectResponsivenessProfile(target, explicitProfile = "") {
  const requested = String(explicitProfile || "").trim();
  if (requested) {
    const found = RESPONSIVENESS_PROFILES.find((profile) => profile.id === requested);
    if (!found) {
      throw new Error(`Unknown responsiveness profile: ${requested}`);
    }
    return found;
  }

  const packageName = packageNameForTarget(target);
  return (
    RESPONSIVENESS_PROFILES.find((profile) =>
      (profile.packageNames || []).includes(packageName)
    ) || DEFAULT_PROFILE
  );
}

function packageNameForTarget(target) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(target, "package.json"), "utf8")
    );
    return String(packageJson.name || "");
  } catch {
    return "";
  }
}

function publicProfile(profile) {
  return {
    id: profile.id,
    label: profile.label,
    platformNotes: profile.platformNotes || [],
    deterministicChecks: profile.deterministicChecks || [],
  };
}

function collectChangedFiles(options) {
  if (options.changedFilesPath) {
    return readChangedFiles(options.changedFilesPath);
  }

  for (const range of [`${options.baseRef}...${options.headRef}`, `${options.baseRef}..${options.headRef}`]) {
    const result = childProcess.spawnSync(
      "git",
      ["-C", options.target, "diff", "--name-only", "--diff-filter=ACMR", range],
      {
        encoding: "utf8",
        shell: process.platform === "win32",
      }
    );
    if (result.status !== 0) {
      continue;
    }
    const files = result.stdout
      .split(/\r?\n/)
      .map((file) => file.trim())
      .filter(Boolean);
    if (files.length > 0) {
      return files;
    }
  }

  return [];
}

function readChangedFiles(filePath) {
  return fs
    .readFileSync(path.resolve(filePath), "utf8")
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function buildPlan(options) {
  const profile = detectResponsivenessProfile(options.target, options.profile);
  const changedFiles = collectChangedFiles(options);
  const inferred = options.pages.length
    ? {
        routes: options.pages,
        reasons: options.pages.map((route) => ({
          route,
          reason: "explicit --pages input",
        })),
        fallback: false,
      }
    : inferRoutes(changedFiles, options.maxPages, profile);

  return {
    target: options.target,
    baseRef: options.baseRef,
    headRef: options.headRef,
    baseUrl: options.baseUrl,
    outputDir: options.outputDir,
    profile: publicProfile(profile),
    contexts: options.contexts.map((name) => ({ name, ...CONTEXTS[name] })),
    changedFiles,
    routes: inferred.routes.slice(0, options.maxPages),
    routeReasons: inferred.reasons,
    fallback: inferred.fallback,
    maxPages: options.maxPages,
    workers: options.workers,
  };
}

function inferRoutes(changedFiles, maxPages, profile = DEFAULT_PROFILE) {
  const routes = new Map();
  const reasons = [];
  const shellCanaryRoutes = profile.shellCanaryRoutes || SHELL_CANARY_ROUTES;
  const fallbackRoutes = profile.fallbackRoutes || FALLBACK_ROUTES;
  const routeMappings = profile.routeMappings || ROUTE_MAPPINGS;
  const globalPatterns = profile.globalPatterns || GLOBAL_PATTERNS;
  const globalRoutes = profile.globalRoutes || GLOBAL_ROUTES;

  const add = (route, reason) => {
    if (!route || routes.has(route)) {
      return;
    }
    routes.set(route, true);
    reasons.push({ route, reason });
  };

  for (const route of shellCanaryRoutes) {
    add(route, "shell canary");
  }

  for (const file of changedFiles) {
    const normalized = file.replace(/\\/g, "/");
    const appRoute = routeFromAppPage(normalized);
    if (appRoute) {
      add(appRoute, `${file} maps to app route`);
    }

    for (const mapping of routeMappings) {
      if (mapping.pattern.test(normalized)) {
        for (const route of mapping.routes) {
          add(route, `${file} matched ${mapping.pattern}`);
        }
      }
    }

    if (globalPatterns.some((pattern) => pattern.test(normalized))) {
      for (const route of globalRoutes) {
        add(route, `${file} is shared/global UI`);
      }
    }
  }

  if (routes.size <= shellCanaryRoutes.length && changedFiles.length > 0) {
    for (const route of fallbackRoutes) {
      add(route, "changed files had no precise route mapping");
    }
  }

  if (changedFiles.length === 0) {
    for (const route of fallbackRoutes) {
      add(route, "no changed files available");
    }
  }

  return {
    routes: Array.from(routes.keys()).slice(0, maxPages),
    reasons,
    fallback: changedFiles.length === 0 || routes.size <= shellCanaryRoutes.length,
  };
}

function routeFromAppPage(file) {
  const match = file.match(/^app\/(.+)\/page\.(?:client\.)?(?:tsx|ts|jsx|js)$/);
  if (!match) {
    if (/^app\/page\.(?:tsx|ts|jsx|js)$/.test(file)) {
      return "/";
    }
    return "";
  }

  const segments = match[1].split("/");
  if (segments.some((segment) => segment.startsWith("[") || segment.startsWith("("))) {
    return routeForDynamicAppSegments(segments);
  }

  return `/${segments.join("/")}`.replace(/\/+/g, "/");
}

function routeForDynamicAppSegments(segments) {
  const root = segments[0];
  if (root === "the-memes") {
    return "/the-memes";
  }
  if (root === "meme-lab") {
    return "/meme-lab";
  }
  if (root === "rememes") {
    return "/rememes";
  }
  if (root === "nextgen") {
    return "/nextgen";
  }
  if (root === "6529-gradient") {
    return "/6529-gradient";
  }
  if (root === "waves") {
    return "/waves";
  }
  return `/${root}`;
}

function prepareHarness(plan, options) {
  const harnessDir = path.join(options.outputDir, "harness");
  const testsDir = path.join(harnessDir, "tests");
  const resultsDir = path.join(options.outputDir, "results");
  const screenshotsDir = path.join(options.outputDir, "screenshots");
  const playwrightOutputDir = path.join(options.outputDir, "playwright-output");

  fs.rmSync(options.outputDir, { recursive: true, force: true });
  fs.mkdirSync(testsDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(playwrightOutputDir, { recursive: true });

  fs.writeFileSync(path.join(options.outputDir, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
  fs.writeFileSync(path.join(harnessDir, "routes.json"), `${JSON.stringify(plan.routes, null, 2)}\n`);
  fs.writeFileSync(
    path.join(harnessDir, "profile.json"),
    `${JSON.stringify(plan.profile || publicProfile(DEFAULT_PROFILE), null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(harnessDir, "contexts.json"),
    `${JSON.stringify(plan.contexts, null, 2)}\n`
  );
  fs.writeFileSync(path.join(harnessDir, "global-setup.cjs"), buildPlaywrightGlobalSetup());
  fs.writeFileSync(path.join(harnessDir, "playwright.config.cjs"), buildPlaywrightConfig(plan, options));
  fs.writeFileSync(path.join(testsDir, "responsiveness.spec.cjs"), buildPlaywrightSpec());

  return {
    harnessDir,
    configPath: path.join(harnessDir, "playwright.config.cjs"),
    resultsDir,
    screenshotsDir,
  };
}

function buildPlaywrightConfig(plan, options) {
  return `${headerComment()}
const path = require("node:path");
const { defineConfig, devices } = require("@playwright/test");
const contexts = require("./contexts.json");

const outputRoot = ${JSON.stringify(options.outputDir)};
const baseURL = ${JSON.stringify(options.baseUrl)};
const target = ${JSON.stringify(options.target)};
const port = ${JSON.stringify(String(options.port))};

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests"),
  testMatch: /responsiveness\\.spec\\.cjs$/,
  globalSetup: path.join(__dirname, "global-setup.cjs"),
  fullyParallel: true,
  workers: ${JSON.stringify(options.workers)},
  retries: 0,
  timeout: Number(process.env.REVIEWBOT_RESPONSIVENESS_TEST_TIMEOUT_MS || 25000),
  reporter: [
    ["list"],
    ["json", { outputFile: path.join(outputRoot, "playwright-report.json") }],
  ],
  outputDir: path.join(outputRoot, "playwright-output"),
  use: {
    baseURL,
    actionTimeout: Number(process.env.REVIEWBOT_RESPONSIVENESS_ACTION_TIMEOUT_MS || 8000),
    navigationTimeout: Number(process.env.REVIEWBOT_RESPONSIVENESS_NAVIGATION_TIMEOUT_MS || 12000),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: contexts.map((context) => ({
    name: context.name,
    use: {
      ...devices["Desktop Chrome"],
      viewport: context.viewport,
      isMobile: context.isMobile,
      hasTouch: context.hasTouch,
      deviceScaleFactor: context.isMobile ? 3 : 1,
      userAgent: \`\${devices["Desktop Chrome"].userAgent}\${context.userAgentSuffix || ""}\`,
    },
    metadata: context,
  })),
  webServer: {
    command: ${JSON.stringify(options.installCommand || "./bin/6529 run dev")},
    cwd: target,
    url: baseURL,
    reuseExistingServer: ${JSON.stringify(options.reuseExistingServer)},
    timeout: Number(process.env.REVIEWBOT_RESPONSIVENESS_SERVER_TIMEOUT_MS || 180000),
    env: {
      PORT: port,
      PORT_SEARCH_LIMIT: "1",
      API_ENDPOINT: process.env.REVIEWBOT_RESPONSIVENESS_API_ENDPOINT || "https://api.6529.io",
      WS_ENDPOINT: process.env.REVIEWBOT_RESPONSIVENESS_WS_ENDPOINT || "wss://ws.6529.io",
      ALLOWLIST_API_ENDPOINT: process.env.REVIEWBOT_RESPONSIVENESS_ALLOWLIST_API_ENDPOINT || "https://allowlist-api.6529.io",
      BASE_ENDPOINT: baseURL,
      MOBILE_APP_SCHEME: process.env.REVIEWBOT_RESPONSIVENESS_MOBILE_APP_SCHEME || "mobile6529",
      CORE_SCHEME: process.env.REVIEWBOT_RESPONSIVENESS_CORE_SCHEME || "core6529",
      NEXTGEN_CHAIN_ID: process.env.REVIEWBOT_RESPONSIVENESS_NEXTGEN_CHAIN_ID || "1",
      IPFS_API_ENDPOINT: process.env.REVIEWBOT_RESPONSIVENESS_IPFS_API_ENDPOINT || "https://api-ipfs.6529.io",
      IPFS_GATEWAY_ENDPOINT: process.env.REVIEWBOT_RESPONSIVENESS_IPFS_GATEWAY_ENDPOINT || "https://ipfs.6529.io",
      ASSETS_FROM_S3: process.env.REVIEWBOT_RESPONSIVENESS_ASSETS_FROM_S3 || "false",
      SEIZE_6529_COMMAND: "1",
      USE_TURBO: process.env.USE_TURBO || (process.platform === "win32" ? "false" : "true"),
    },
  },
});
`;
}

function buildPlaywrightGlobalSetup() {
  return `${headerComment()}
const routes = require("./routes.json");

module.exports = async (config) => {
  const baseURL = config.projects?.[0]?.use?.baseURL || "http://localhost:3001";
  for (const route of routes) {
    const url = new URL(route, baseURL).toString();
    await fetchWithTimeout(url, 20000).catch(() => {});
  }
};

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "6529reviewbot-responsiveness-prewarm",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
`;
}

function buildPlaywrightSpec() {
  return `${headerComment()}
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("@playwright/test");

let sharp = null;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

const routes = require("../routes.json");
const profile = require("../profile.json");
const outputRoot = path.resolve(__dirname, "..", "..");
const resultsDir = path.join(outputRoot, "results");
const screenshotsDir = path.join(outputRoot, "screenshots");

test.describe.configure({ mode: "parallel" });

for (const route of routes) {
  test(route, async ({ page }, testInfo) => {
    const mode = testInfo.project.name;
    const metadata = testInfo.project.metadata || {};
    if (mode === "native-mobile") {
      await installCapacitorShim(page, metadata.nativePlatform || "ios");
    }

    const consoleErrors = [];
    const pageErrors = [];
    const networkFailures = [];
    const networkResponses = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(sanitizeMessage(message.text()));
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(sanitizeMessage(error.message || String(error)));
    });
    page.on("requestfailed", (request) => {
      const failure = summarizeRequestFailure(request);
      if (failure) {
        networkFailures.push(failure);
      }
    });
    page.on("response", (response) => {
      const problem = summarizeProblemResponse(response);
      if (problem) {
        networkResponses.push(problem);
      }
    });

    const startedAt = Date.now();
    let responseStatus = null;
    let responseUrl = "";
    try {
      const response = await page.goto(route, {
        waitUntil: "commit",
        timeout: Number(process.env.REVIEWBOT_RESPONSIVENESS_GOTO_TIMEOUT_MS || 12000),
      });
      responseStatus = response ? response.status() : null;
      responseUrl = response ? response.url() : page.url();
      await settlePage(page, pageErrors);
    } catch (error) {
      pageErrors.push(sanitizeMessage(error.message || String(error)));
    }

    let contentReadiness = {
      ok: false,
      reason: "content readiness was not checked",
      durationMs: 0,
      metrics: null,
    };
    try {
      contentReadiness = await waitForMeaningfulAppContent(page);
    } catch (error) {
      contentReadiness = {
        ok: false,
        reason: \`content readiness check failed: \${sanitizeMessage(error.message || String(error))}\`,
        durationMs: 0,
        metrics: null,
      };
    }

    const metricsResult = contentReadiness.metrics
      ? { ok: true, metrics: contentReadiness.metrics }
      : await readMetrics(page);
    if (!metricsResult.ok) {
      pageErrors.push(\`metrics failed: \${sanitizeMessage(metricsResult.error)}\`);
    }
    const metrics = metricsResult.metrics || fallbackMetrics(page);
    metrics.nextErrorOverlayText = summarizeOverlayText(metrics.nextErrorOverlayText);

    const screenshotPath = path.join(screenshotsDir, \`\${safeName(mode)}--\${safeName(route)}.png\`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch((error) => {
      pageErrors.push(\`screenshot failed: \${sanitizeMessage(error.message || String(error))}\`);
    });
    const screenshotAnalysis = await analyzeScreenshot(screenshotPath).catch((error) => ({
      available: false,
      error: sanitizeMessage(error.message || String(error)),
    }));
    const nextAssetProblems = [
      ...networkFailures.filter(isNextAssetProblem),
      ...networkResponses.filter(isNextAssetProblem),
    ];

    const warnings = [];
    const failures = [];
    if (responseStatus === null) {
      failures.push("navigation did not produce a response");
    } else if (responseStatus >= 500) {
      failures.push(\`HTTP \${responseStatus}\`);
    } else if (responseStatus >= 400) {
      warnings.push(\`HTTP \${responseStatus}\`);
    }
    if (metrics.horizontalOverflow > 3) {
      failures.push(\`horizontal overflow \${metrics.horizontalOverflow}px\`);
    }
    if (metrics.nextErrorOverlay) {
      failures.push("Next.js error overlay is visible");
    }
    if (!metrics.contentReady) {
      failures.push(contentReadiness.reason || "6529 app shell did not render meaningful content");
    }
    if (screenshotAnalysis.blankLike) {
      failures.push(
        \`screenshot appears blank or near-uniform despite app readiness; nonWhiteRatio=\${screenshotAnalysis.nonWhiteRatio}, luminanceStdDev=\${screenshotAnalysis.luminanceStdDev}\`
      );
    }
    if (nextAssetProblems.length > 0) {
      failures.push(
        \`\${nextAssetProblems.length} Next.js asset request(s) failed or were blocked; 6529 PR-local responsiveness runs must use local _next assets with ASSETS_FROM_S3=false; examples: \${summarizeNextAssetProblems(nextAssetProblems)}\`
      );
    }
    if (pageErrors.length > 0) {
      failures.push(\`\${pageErrors.length} page error(s)\`);
    }
    if (mode === "native-mobile") {
      const shimActive = Boolean(metrics.nativeShimActive || metrics.nativeIsNativePlatform || metrics.nativePlatform);
      if (!shimActive) {
        failures.push("native Capacitor shim did not activate");
      } else if (!metrics.nativeIsNativePlatform || metrics.nativePlatform !== (metadata.nativePlatform || "ios")) {
        failures.push(
          \`native Capacitor shim did not report expected platform \${metadata.nativePlatform || "ios"}\`
        );
      }
    }
    if (mode === "electron-desktop") {
      const isElectron = String(metrics.userAgent || "").includes("Electron");
      if (!isElectron) {
        failures.push("Electron user agent did not activate");
      }
    }
    const profileProbe = profileAwareProbe({ profile, mode, route, metadata, metrics });
    warnings.push(...profileProbe.warnings);
    failures.push(...profileProbe.failures);
    if (consoleErrors.some((message) => /hydration|uncaught|runtime error/i.test(message))) {
      failures.push("fatal console error detected");
    } else if (consoleErrors.length > 0) {
      warnings.push(\`\${consoleErrors.length} console error(s)\`);
    }

    const result = {
      mode,
      route,
      responseStatus,
      responseUrl,
      durationMs: Date.now() - startedAt,
      metrics,
      warnings,
      failures,
      consoleErrors: consoleErrors.slice(0, 20),
      pageErrors: pageErrors.slice(0, 20),
      networkFailures: networkFailures.slice(0, 30),
      networkResponses: networkResponses.slice(0, 30),
      nextAssetFailures: nextAssetProblems.slice(0, 20),
      contentReadiness: {
        ok: Boolean(contentReadiness.ok),
        reason: contentReadiness.reason,
        durationMs: contentReadiness.durationMs,
      },
      profileProbe,
      screenshotAnalysis,
      screenshot: path.relative(outputRoot, screenshotPath).replace(/\\\\/g, "/"),
    };
    fs.writeFileSync(
      path.join(resultsDir, \`\${safeName(mode)}--\${safeName(route)}.json\`),
      \`\${JSON.stringify(result, null, 2)}\\n\`
    );

    if (failures.length > 0) {
      throw new Error(failures.join("; "));
    }
  });
}

function profileAwareProbe({ profile, mode, route, metadata, metrics }) {
  const warnings = [];
  const failures = [];
  if (profile?.id !== "6529seize-frontend") {
    return { warnings, failures };
  }

  const normalizedRoute = String(route || "");
  const isNativeContext =
    metadata.platformFamily === "native" || /^native(?:-|$)/.test(String(mode || ""));
  const isElectronContext =
    metadata.platformFamily === "electron" || String(mode || "") === "electron-desktop";
  const isOpenMobileRoute = normalizedRoute.startsWith("/open-mobile");
  const shellBypassRoute =
    normalizedRoute.startsWith("/access") || normalizedRoute.startsWith("/restricted");

  if (isNativeContext && !metrics.nextErrorOverlay) {
    if (!metrics.hasCapacitorNativeClass) {
      failures.push("6529 native profile: body.capacitor-native was not applied");
    }
    if (!String(metrics.viewportMeta || "").includes("viewport-fit=cover")) {
      failures.push("6529 native profile: viewport-fit=cover is missing");
    }
    if (!metrics.nativePluginAvailableKeyboard) {
      warnings.push("6529 native profile: Keyboard plugin shim is unavailable");
    }
    if (!metrics.nativePluginAvailableApp) {
      warnings.push("6529 native profile: App plugin shim is unavailable");
    }
    if (!shellBypassRoute && !isOpenMobileRoute && !metrics.bottomNavigationVisible) {
      warnings.push("6529 native profile: bottom navigation was not visible");
    }
  }

  if (isElectronContext && !metrics.electronDetected) {
    failures.push("6529 electron profile: Electron user-agent branch was not active");
  }

  if (mode === "web-narrow" && metrics.layoutRootDataNarrow !== "true" && !shellBypassRoute) {
    warnings.push("6529 web profile: narrow desktop layout marker was not active");
  }

  if (isOpenMobileRoute && metrics.openMobilePromptVisible === false && !metrics.nextErrorOverlay) {
    warnings.push("6529 open-mobile profile: mobile handoff prompt was not visible");
  }

  return { warnings, failures };
}

async function settlePage(page, pageErrors) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      return;
    } catch (error) {
      if (isNavigationRace(error)) {
        await page.waitForTimeout(500);
        continue;
      }
      pageErrors.push(sanitizeMessage(error.message || String(error)));
      return;
    }
  }
  pageErrors.push("page did not settle after client navigation");
}

async function waitForMeaningfulAppContent(page) {
  const timeoutMs = Number(process.env.REVIEWBOT_RESPONSIVENESS_CONTENT_TIMEOUT_MS || 15000);
  const startedAt = Date.now();
  let lastMetrics = null;
  let lastError = "";

  while (Date.now() - startedAt <= timeoutMs) {
    const metricsResult = await readMetrics(page);
    if (metricsResult.ok) {
      lastMetrics = metricsResult.metrics;
      if (lastMetrics.contentReady) {
        return {
          ok: true,
          reason: "6529 app shell rendered meaningful content",
          durationMs: Date.now() - startedAt,
          metrics: lastMetrics,
        };
      }
      if (lastMetrics.nextErrorOverlay) {
        if (!summarizeOverlayText(lastMetrics.nextErrorOverlayText)) {
          const expanded = await expandNextOverlayDiagnostics(page);
          if (expanded) {
            const expandedMetrics = await readMetrics(page);
            if (expandedMetrics.ok) {
              lastMetrics = expandedMetrics.metrics;
            }
          }
        }
        return {
          ok: false,
          reason: "Next.js error overlay is visible before content readiness",
          durationMs: Date.now() - startedAt,
          metrics: lastMetrics,
        };
      }
    } else {
      lastError = metricsResult.error || "";
    }

    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs <= 0) {
      break;
    }
    await page.waitForTimeout(Math.min(500, remainingMs));
  }

  return {
    ok: false,
    reason: contentReadinessFailureReason(lastMetrics, lastError, timeoutMs),
    durationMs: Date.now() - startedAt,
    metrics: lastMetrics,
  };
}

async function expandNextOverlayDiagnostics(page) {
  try {
    const clicked = await page.evaluate(() => {
      const overlayElements = Array.from(
        document.querySelectorAll("nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-dialog]")
      );
      const overlayRoots = [];
      const visitRoots = (node, depth = 0) => {
        if (!node || depth > 8) return;
        overlayRoots.push(node);
        if (node.shadowRoot) {
          visitRoots(node.shadowRoot, depth + 1);
        }
        for (const child of Array.from(node.children || [])) {
          if (child.shadowRoot) {
            visitRoots(child.shadowRoot, depth + 1);
          }
        }
      };
      for (const element of overlayElements) {
        visitRoots(element);
      }
      const labelFor = (element) =>
        String(
          element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            element.textContent ||
            ""
        )
          .replace(/\\s+/g, " ")
          .trim();
      for (const root of overlayRoots) {
        const candidates = Array.from(root.querySelectorAll?.("button, [role='button']") || []);
        for (const candidate of candidates) {
          const label = labelFor(candidate);
          if (/open\\s+next|next\\.?j?s?\\s+dev\\s+tools?/i.test(label)) {
            candidate.click();
            return true;
          }
        }
      }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(750);
    }
    return Boolean(clicked);
  } catch {
    return false;
  }
}

function contentReadinessFailureReason(metrics, lastError, timeoutMs) {
  if (!metrics) {
    return lastError
      ? \`6529 app shell metrics were unavailable before screenshot: \${sanitizeMessage(lastError)}\`
      : "6529 app shell metrics were unavailable before screenshot";
  }

  const seconds = (timeoutMs / 1000).toFixed(1);
  const signals = (metrics.contentSignals || []).join(", ") || "none";
  return [
    \`6529 app shell did not render meaningful content within \${seconds}s\`,
    \`visibleTextLength=\${metrics.visibleTextLength || 0}\`,
    \`visibleInteractiveElements=\${metrics.visibleInteractiveElements || 0}\`,
    \`visibleAppShellElements=\${metrics.visibleAppShellElements || 0}\`,
    \`signals=\${signals}\`,
  ].join("; ");
}

async function readMetrics(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(doc?.scrollWidth || 0, body?.scrollWidth || 0);
        const clientWidth = doc?.clientWidth || window.innerWidth;
        const scrollHeight = Math.max(doc?.scrollHeight || 0, body?.scrollHeight || 0);
        const clientHeight = doc?.clientHeight || window.innerHeight;
        const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") || "";
        const capacitor = window.Capacitor || {};
        let nativePlatform = "";
        let nativeIsNativePlatform = false;
        let nativePluginAvailableKeyboard = false;
        let nativePluginAvailableApp = false;
        let nativePluginAvailableDevice = false;
        try {
          nativePlatform = typeof capacitor.getPlatform === "function" ? capacitor.getPlatform() : "";
        } catch {
          nativePlatform = "";
        }
        try {
          nativeIsNativePlatform =
            typeof capacitor.isNativePlatform === "function" ? Boolean(capacitor.isNativePlatform()) : false;
        } catch {
          nativeIsNativePlatform = false;
        }
        try {
          nativePluginAvailableKeyboard =
            typeof capacitor.isPluginAvailable === "function"
              ? Boolean(capacitor.isPluginAvailable("Keyboard"))
              : false;
          nativePluginAvailableApp =
            typeof capacitor.isPluginAvailable === "function"
              ? Boolean(capacitor.isPluginAvailable("App"))
              : false;
          nativePluginAvailableDevice =
            typeof capacitor.isPluginAvailable === "function"
              ? Boolean(capacitor.isPluginAvailable("Device"))
              : false;
        } catch {
          nativePluginAvailableKeyboard = false;
          nativePluginAvailableApp = false;
          nativePluginAvailableDevice = false;
        }
        const visible = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const visibleElement = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        const visibleCount = (selector) =>
          Array.from(document.querySelectorAll(selector)).filter(visibleElement).length;
        const visibleTextIncludes = (value) =>
          (document.body?.innerText || "").toLowerCase().includes(String(value || "").toLowerCase());
        const layoutRoot = document.querySelector(".layout-root");
        const bottomNavigation = Array.from(document.querySelectorAll("nav")).find((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height >= 40 &&
            Math.abs(window.innerHeight - rect.bottom) <= 8 &&
            style.position === "fixed" &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            style.opacity !== "0"
          );
        });
        const androidKeyboardHeight =
          window.getComputedStyle(document.documentElement).getPropertyValue("--android-keyboard-height").trim();
        const visibleText = (body?.innerText || "").replace(/\\s+/g, " ").trim();
        const bodyText = (body?.textContent || "").replace(/\\s+/g, " ").trim();
        const visibleInteractiveElements = visibleCount(
          'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
        );
        const visibleMediaElements = visibleCount("img, picture, video, canvas, svg");
        const visibleAppShellElements = visibleCount(
          [
            "main",
            '[role="main"]',
            "header",
            '[role="banner"]',
            "nav",
            '[role="navigation"]',
            "footer",
            '[role="contentinfo"]',
            ".layout-root",
            ".layout-main",
            ".tailwind-scope",
            '[class*="headerPlaceholder"]',
            '[class*="capacitorPlaceholder"]',
            '[class*="capacitorHeaderRow"]',
            '[class*="capacitorMainContainer"]',
          ].join(",")
        );
        const contentSignals = [];
        const hasMain = visible("main") || visible('[role="main"]');
        const hasHeader = visible("header") || visible('[role="banner"]');
        const hasFooter = visible("footer") || visible('[role="contentinfo"]');
        const hasNavigation = visible("nav") || visible('[role="navigation"]');
        if (hasMain) contentSignals.push("main");
        if (hasHeader) contentSignals.push("header");
        if (hasNavigation) contentSignals.push("navigation");
        if (hasFooter) contentSignals.push("footer");
        if (visibleAppShellElements > 0) contentSignals.push("6529-shell-marker");
        if (visibleText.length >= 20) contentSignals.push("visible-text");
        if (visibleInteractiveElements >= 2) contentSignals.push("interactive-elements");
        if (visibleMediaElements > 0) contentSignals.push("media-elements");
        const nextOverlayElements = Array.from(
          document.querySelectorAll(
            [
              "nextjs-portal",
              "[data-nextjs-dialog-overlay]",
              "[data-nextjs-dialog]",
              "[data-nextjs-toast]",
              "[data-nextjs-errors-dialog]",
            ].join(",")
          )
        );
        const nextErrorDialogElements = Array.from(
          document.querySelectorAll(
            [
              "[data-nextjs-dialog-overlay]",
              "[data-nextjs-dialog]",
              "[data-nextjs-errors-dialog]",
            ].join(",")
          )
        );
        const compactText = (value) => String(value || "").replace(/\\s+/g, " ").trim();
        const nextDevToolsOnlyText = (value) => {
          const normalized = compactText(value)
            .toLowerCase()
            .replace(/next\\.?\\s*j\\.?\\s*s?/g, "nextjs ")
            .replace(/\\bclo\\s+e\\b/g, "close")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
          if (!normalized) return false;
          // Single-letter and digit tokens are Next Dev Tools extraction noise
          // from "Next.js" and issue-count badges, not standalone diagnostics.
          const residual = normalized
            .replace(
              /\\b(nextjs|next|js|j|dev|tool|tools|item|route|static|dynamic|bundler|turbopack|info|preference|preferences|close|clo|open|issue|issues|overlay|collapse|badge|0|1)\\b/g,
              " "
            )
            .replace(/\\s+/g, "")
            .trim();
          return residual === "";
        };
        const looksLikeNextErrorOverlayText = (value) => {
          const text = compactText(value);
          if (!text || nextDevToolsOnlyText(text)) return false;
          return /build error|runtime error|module not found|failed to compile|unhandled|uncaught|hydration|error:/i.test(text);
        };
        const skipTextElement = (node) => {
          const tagName = String(node?.tagName || "").toUpperCase();
          return ["STYLE", "SCRIPT", "NOSCRIPT", "TEMPLATE", "SVG", "PATH"].includes(tagName);
        };
        const collectNodeText = (node, parts, state, depth = 0) => {
          if (!node || state.length >= 2000 || depth > 12) return;
          if (node.nodeType === Node.TEXT_NODE) {
            if (skipTextElement(node.parentElement)) {
              return;
            }
            const text = compactText(node.textContent);
            if (text) {
              parts.push(text);
              state.length += text.length + 1;
            }
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
            return;
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (skipTextElement(node)) {
              return;
            }
            const ariaLabel = compactText(node.getAttribute("aria-label"));
            if (ariaLabel) {
              parts.push(ariaLabel);
              state.length += ariaLabel.length + 1;
            }
            if (node.shadowRoot) {
              collectNodeText(node.shadowRoot, parts, state, depth + 1);
            }
          }
          for (const child of Array.from(node.childNodes || [])) {
            collectNodeText(child, parts, state, depth + 1);
            if (state.length >= 2000) break;
          }
        };
        const overlayParts = [];
        const overlayState = { length: 0 };
        for (const element of nextOverlayElements) {
          collectNodeText(element, overlayParts, overlayState);
          if (overlayState.length >= 2000) break;
        }
        const nextErrorOverlayText = compactText(overlayParts.join(" ")).slice(0, 2000);
        const hasNextErrorDialog = nextErrorDialogElements.some((element) => {
          const parts = [];
          const state = { length: 0 };
          collectNodeText(element, parts, state);
          return looksLikeNextErrorOverlayText(parts.join(" "));
        });
        const nextErrorOverlay =
          hasNextErrorDialog || looksLikeNextErrorOverlayText(nextErrorOverlayText);
        const contentReady =
          !nextErrorOverlay &&
          (hasMain ||
            hasHeader ||
            hasNavigation ||
            hasFooter ||
            visibleAppShellElements > 0 ||
            visibleText.length >= 20 ||
            visibleInteractiveElements >= 2 ||
            visibleMediaElements > 0);
        return {
          title: document.title,
          url: window.location.href,
          userAgent: navigator.userAgent,
          bodyClass: body?.className || "",
          hasCapacitorNativeClass: body?.classList?.contains("capacitor-native") || false,
          electronDetected: navigator.userAgent.includes("Electron"),
          nativeShimActive: Boolean(window.__reviewbotNativeShimActive),
          nativePlatform,
          nativeIsNativePlatform,
          nativePluginAvailableKeyboard,
          nativePluginAvailableApp,
          nativePluginAvailableDevice,
          viewportMeta,
          layoutRootDataMobile: layoutRoot?.getAttribute("data-mobile") || "",
          layoutRootDataNarrow: layoutRoot?.getAttribute("data-narrow") || "",
          layoutRootDataSmall: layoutRoot?.getAttribute("data-small") || "",
          bottomNavigationVisible: Boolean(bottomNavigation),
          bottomNavigationHeight: bottomNavigation ? Math.round(bottomNavigation.getBoundingClientRect().height) : 0,
          androidKeyboardHeight,
          openMobilePromptVisible: visibleTextIncludes("Opening 6529 Mobile"),
          scrollWidth,
          clientWidth,
          scrollHeight,
          clientHeight,
          horizontalOverflow: Math.max(0, scrollWidth - clientWidth),
          verticalOverflow: Math.max(0, scrollHeight - clientHeight),
          hasMain,
          hasHeader,
          hasFooter,
          hasNavigation,
          bodyTextLength: bodyText.length,
          visibleTextLength: visibleText.length,
          visibleInteractiveElements,
          visibleMediaElements,
          visibleAppShellElements,
          contentReady,
          contentSignals,
          nextErrorOverlay,
          nextErrorOverlayText,
        };
      });
      return { ok: true, metrics };
    } catch (error) {
      if (isNavigationRace(error)) {
        await page.waitForTimeout(500);
        continue;
      }
      return { ok: false, error: error.message || String(error) };
    }
  }
  return { ok: false, error: "page kept navigating while metrics were collected" };
}

function fallbackMetrics(page) {
  return {
    title: "",
    url: page.url(),
    userAgent: "",
    bodyClass: "",
    hasCapacitorNativeClass: false,
    electronDetected: false,
    nativeShimActive: false,
    nativePlatform: "",
    nativeIsNativePlatform: false,
    nativePluginAvailableKeyboard: false,
    nativePluginAvailableApp: false,
    nativePluginAvailableDevice: false,
    viewportMeta: "",
    layoutRootDataMobile: "",
    layoutRootDataNarrow: "",
    layoutRootDataSmall: "",
    bottomNavigationVisible: false,
    bottomNavigationHeight: 0,
    androidKeyboardHeight: "",
    openMobilePromptVisible: false,
    scrollWidth: 0,
    clientWidth: 0,
    scrollHeight: 0,
    clientHeight: 0,
    horizontalOverflow: 0,
    verticalOverflow: 0,
    hasMain: false,
    hasHeader: false,
    hasFooter: false,
    hasNavigation: false,
    bodyTextLength: 0,
    visibleTextLength: 0,
    visibleInteractiveElements: 0,
    visibleMediaElements: 0,
    visibleAppShellElements: 0,
    contentReady: false,
    contentSignals: [],
    nextErrorOverlay: false,
    nextErrorOverlayText: "",
  };
}

function isNavigationRace(error) {
  return /execution context was destroyed|most likely because of a navigation|cannot find context|navigation/i.test(
    error?.message || String(error)
  );
}

function summarizeRequestFailure(request) {
  const resourceType = request.resourceType();
  const url = request.url();
  if (!isInterestingNetworkResource(resourceType, url)) {
    return null;
  }
  return {
    url: sanitizeUrl(url),
    resourceType,
    failure: sanitizeMessage(request.failure()?.errorText || "request failed"),
  };
}

function summarizeProblemResponse(response) {
  const status = response.status();
  if (status < 400) {
    return null;
  }
  const request = response.request();
  const resourceType = request.resourceType();
  const url = response.url();
  if (!isInterestingNetworkResource(resourceType, url)) {
    return null;
  }
  return {
    url: sanitizeUrl(url),
    resourceType,
    status,
    statusText: sanitizeMessage(response.statusText() || ""),
  };
}

function isInterestingNetworkResource(resourceType, url) {
  return (
    isNextAssetUrl(url) ||
    ["document", "script", "stylesheet", "fetch", "xhr"].includes(resourceType)
  );
}

function isNextAssetProblem(problem) {
  return isNextAssetUrl(problem?.url || "");
}

function isNextAssetUrl(value) {
  return /(?:\\/|%2F)_next(?:\\/|%2F)(?:static|webpack|image)|\\/web_build\\/[^/]+\\/_next\\//i.test(
    String(value || "")
  );
}

function summarizeNextAssetProblems(problems) {
  return problems
    .slice(0, 3)
    .map((problem) => {
      const reason = problem.status ? \`HTTP \${problem.status}\` : problem.failure || "failed";
      return \`\${problem.resourceType || "resource"} \${reason} \${problem.url}\`;
    })
    .join("; ");
}

async function analyzeScreenshot(screenshotPath) {
  if (!sharp || !fs.existsSync(screenshotPath)) {
    return {
      available: false,
      blankLike: false,
      reason: sharp ? "screenshot file missing" : "sharp unavailable",
    };
  }

  const image = sharp(screenshotPath).rotate().resize({
    width: 96,
    height: 96,
    fit: "inside",
    withoutEnlargement: true,
  });
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = Math.max(1, info.width * info.height);
  let opaquePixels = 0;
  let nonWhitePixels = 0;
  let luminanceSum = 0;
  let luminanceSquaredSum = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha < 8) {
      continue;
    }
    opaquePixels += 1;
    if (red < 245 || green < 245 || blue < 245) {
      nonWhitePixels += 1;
    }
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceSum += luminance;
    luminanceSquaredSum += luminance * luminance;
  }

  const denominator = Math.max(1, opaquePixels);
  const meanLuminance = luminanceSum / denominator;
  const variance = Math.max(0, luminanceSquaredSum / denominator - meanLuminance * meanLuminance);
  const luminanceStdDev = Math.sqrt(variance);
  const nonWhiteRatio = nonWhitePixels / denominator;
  const opaqueRatio = opaquePixels / pixels;
  const nearWhiteBlank = opaqueRatio > 0.98 && meanLuminance >= 248 && nonWhiteRatio < 0.003;
  const nearUniformBlank = opaqueRatio > 0.98 && luminanceStdDev < 1.5;

  return {
    available: true,
    blankLike: nearWhiteBlank || nearUniformBlank,
    nearWhiteBlank,
    nearUniformBlank,
    width: info.width,
    height: info.height,
    opaqueRatio: Number(opaqueRatio.toFixed(4)),
    nonWhiteRatio: Number(nonWhiteRatio.toFixed(4)),
    meanLuminance: Number(meanLuminance.toFixed(2)),
    luminanceStdDev: Number(luminanceStdDev.toFixed(2)),
  };
}

async function installCapacitorShim(page, platform) {
  await page.addInitScript((nativePlatform) => {
    const listeners = new Map();
    let listenerId = 0;
    const pluginResult = {
      addListener: async (eventName, callback) => {
        const id = String(++listenerId);
        listeners.set(id, { eventName, callback });
        return { remove: async () => listeners.delete(id) };
      },
      removeAllListeners: async () => {
        listeners.clear();
      },
    };
    const emit = (eventName, payload = {}) => {
      for (const listener of listeners.values()) {
        if (listener.eventName === eventName && typeof listener.callback === "function") {
          try {
            listener.callback(payload);
          } catch {
            // Test harness event delivery should not crash the app under review.
          }
        }
      }
    };
    window.CapacitorCustomPlatform = {
      name: nativePlatform,
      plugins: {},
    };
    window.__reviewbotNativeShimActive = true;
    window.__reviewbotCapacitorEmit = emit;
    window.Capacitor = {
      ...window.Capacitor,
      getPlatform: () => nativePlatform,
      isNativePlatform: () => true,
      isPluginAvailable: (name) => ["App", "Keyboard", "Device"].includes(String(name || "")),
      convertFileSrc: (value) => value,
      Plugins: {
        App: {
          ...pluginResult,
          getState: async () => ({ isActive: true }),
        },
        Keyboard: pluginResult,
        Device: {
          getId: async () => ({ identifier: "reviewbot-device" }),
          getInfo: async () => ({
            platform: nativePlatform,
            operatingSystem: nativePlatform === "android" ? "android" : "ios",
            osVersion: nativePlatform === "android" ? "15" : "18.0",
            model: nativePlatform === "android" ? "Pixel 9" : "iPhone",
            manufacturer: nativePlatform === "android" ? "Google" : "Apple",
            isVirtual: true,
            webViewVersion: "reviewbot",
          }),
        },
      },
    };
    if (nativePlatform === "ios") {
      window.webkit = window.webkit || { messageHandlers: {} };
      window.webkit.messageHandlers = window.webkit.messageHandlers || {};
      window.webkit.messageHandlers.bridge = window.webkit.messageHandlers.bridge || {
        postMessage: () => {},
      };
    }
    if (nativePlatform === "android") {
      window.androidBridge = window.androidBridge || {
        postMessage: () => {},
      };
    }
  }, platform);
}

function sanitizeMessage(value) {
  return String(value || "").replace(/\\s+/g, " ").slice(0, 1000);
}

function summarizeOverlayText(value) {
  const text = sanitizeMessage(value)
    .replace(/Open\\s+Next\\.?j?s?\\s+Dev\\s+Tools?/gi, "")
    .replace(/Compiling\\s*(?:\\.\\s*){1,}/gi, "Compiling")
    .trim();
  if (!text) {
    return "";
  }
  return text.slice(0, 500);
}

function sanitizeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    for (const key of Array.from(url.searchParams.keys())) {
      if (/(?:token|secret|signature|credential|key|auth|session|jwt)/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString().slice(0, 500);
  } catch {
    return sanitizeMessage(value).slice(0, 500);
  }
}

function safeName(value) {
  return String(value || "root")
    .replace(/^\\/+/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "root";
}
`;
}

function runResponsiveness(options) {
  const startedAt = Date.now();
  const plan = buildPlan(options);
  fs.mkdirSync(options.outputDir, { recursive: true });
  fs.writeFileSync(path.join(options.outputDir, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);

  if (options.planOnly) {
    const summary = summarizePlan(plan);
    fs.writeFileSync(path.join(options.outputDir, "summary.md"), summary);
    fs.writeFileSync(
      path.join(options.outputDir, "screenshots.json"),
      `${JSON.stringify(buildScreenshotManifest({ plan, results: [] }), null, 2)}\n`
    );
    return { plan, exitCode: 0, summary, durationMs: Date.now() - startedAt };
  }

  const harness = prepareHarness(plan, options);
  const env = {
    ...process.env,
    NODE_PATH: [path.join(options.target, "node_modules"), process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    REVIEWBOT_RESPONSIVENESS_OUTPUT_DIR: options.outputDir,
  };
  const result = childProcess.spawnSync(
    resolvePnpmCommand(),
    ["exec", "playwright", "test", "--config", harness.configPath],
    {
      cwd: options.target,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    }
  );

  const checkResults = readCheckResults(harness.resultsDir);
  const runErrors = readPlaywrightErrors(path.join(options.outputDir, "playwright-report.json"));
  const summary = summarizeRun({
    plan,
    results: checkResults,
    runErrors,
    exitCode: result.status ?? 1,
    durationMs: Date.now() - startedAt,
  });
  fs.writeFileSync(path.join(options.outputDir, "summary.md"), summary);
  fs.writeFileSync(
    path.join(options.outputDir, "screenshots.json"),
    `${JSON.stringify(buildScreenshotManifest({ plan, results: checkResults }), null, 2)}\n`
  );

  return {
    plan,
    exitCode: result.status ?? 1,
    summary,
    durationMs: Date.now() - startedAt,
    results: checkResults,
  };
}

function buildScreenshotManifest({ plan, results }) {
  const screenshots = (results || [])
    .filter((result) => result.screenshot)
    .map((result) => ({
      context: result.mode,
      route: result.route,
      path: result.screenshot,
      durationMs: result.durationMs,
      responseStatus: result.responseStatus,
      warnings: result.warnings || [],
      failures: result.failures || [],
      horizontalOverflow: result.metrics?.horizontalOverflow || 0,
      hasCapacitorNativeClass: Boolean(result.metrics?.hasCapacitorNativeClass),
      electronDetected: Boolean(result.metrics?.electronDetected),
      viewportMeta: result.metrics?.viewportMeta || "",
      layoutRootDataMobile: result.metrics?.layoutRootDataMobile || "",
      layoutRootDataNarrow: result.metrics?.layoutRootDataNarrow || "",
      layoutRootDataSmall: result.metrics?.layoutRootDataSmall || "",
      bottomNavigationVisible: Boolean(result.metrics?.bottomNavigationVisible),
      bottomNavigationHeight: result.metrics?.bottomNavigationHeight || 0,
      androidKeyboardHeight: result.metrics?.androidKeyboardHeight || "",
      profileProbe: result.profileProbe || null,
      contentReady: Boolean(result.metrics?.contentReady),
      contentSignals: result.metrics?.contentSignals || [],
      visibleTextLength: result.metrics?.visibleTextLength || 0,
      visibleInteractiveElements: result.metrics?.visibleInteractiveElements || 0,
      visibleAppShellElements: result.metrics?.visibleAppShellElements || 0,
      screenshotAnalysis: result.screenshotAnalysis || null,
      nextAssetFailures: result.nextAssetFailures || [],
      networkFailures: (result.networkFailures || []).slice(0, 5),
      networkResponses: (result.networkResponses || []).slice(0, 5),
      nextErrorOverlay: Boolean(result.metrics?.nextErrorOverlay),
      nextErrorOverlayText: summarizeOverlayText(result.metrics?.nextErrorOverlayText),
    }));
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    baseRef: plan.baseRef,
    headRef: plan.headRef,
    profile: plan.profile || null,
    contexts: plan.contexts.map((context) => context.name),
    routes: plan.routes,
    screenshots,
  };
}

function summarizeOverlayText(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/Open\s+Next\.?j?s?\s+Dev\s+Tools?/gi, "")
    .replace(/Compiling\s*(?:\.\s*){1,}/gi, "Compiling")
    .trim();
  if (!text || isNextDevToolsOnlyText(text)) {
    return "";
  }
  return text.slice(0, 500);
}

function isNextDevToolsOnlyText(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/next\.?\s*j\.?\s*s?/g, "nextjs ")
    .replace(/\bclo\s+e\b/g, "close")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) {
    return false;
  }
  // Single-letter and digit tokens are Next Dev Tools extraction noise from
  // "Next.js" and issue-count badges, not standalone diagnostics.
  const residual = normalized
    .replace(
      /\b(nextjs|next|js|j|dev|tool|tools|item|route|static|dynamic|bundler|turbopack|info|preference|preferences|close|clo|open|issue|issues|overlay|collapse|badge|0|1)\b/g,
      " "
    )
    .replace(/\s+/g, "")
    .trim();
  return residual === "";
}

function resolvePnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function readCheckResults(resultsDir) {
  if (!fs.existsSync(resultsDir)) {
    return [];
  }
  return fs
    .readdirSync(resultsDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(resultsDir, file), "utf8")));
}

function readPlaywrightErrors(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return [];
  }
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const errors = (report.errors || [])
      .map((error) => summarizeErrorMessage(error.message || error.stack || error))
      .filter(Boolean);
    for (const suite of report.suites || []) {
      collectPlaywrightTestErrors(suite, errors);
    }
    return errors.slice(0, 20);
  } catch {
    return [];
  }
}

function collectPlaywrightTestErrors(suite, errors) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      for (const result of test.results || []) {
        for (const error of result.errors || []) {
          const message = summarizeErrorMessage(error.message || error.stack || error);
          if (message) {
            errors.push(`${spec.title}: ${message}`);
          }
        }
      }
    }
  }
  for (const child of suite.suites || []) {
    collectPlaywrightTestErrors(child, errors);
  }
}

function summarizeErrorMessage(value) {
  return String(value || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function summarizePlan(plan) {
  const lines = [
    "# 6529bot Responsiveness Plan",
    "",
    `Target: ${plan.target}`,
    `Profile: ${plan.profile?.label || plan.profile?.id || "none"}`,
    `Base: \`${plan.baseRef}\``,
    `Head: \`${plan.headRef}\``,
    `Base URL: ${plan.baseUrl}`,
    `Contexts: ${plan.contexts.map((context) => `\`${context.name}\``).join(", ")}`,
    `Routes (${plan.routes.length}/${plan.maxPages}): ${plan.routes.map((route) => `\`${route}\``).join(", ")}`,
    `Changed files: ${plan.changedFiles.length}`,
    "",
  ];
  if (plan.fallback) {
    lines.push("Fallback routing was used because changed files were unavailable or imprecise.", "");
  }
  if (plan.profile?.platformNotes?.length) {
    lines.push("## Platform Notes", "");
    for (const note of plan.profile.platformNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }
  lines.push("## Route Reasons", "");
  for (const reason of plan.routeReasons) {
    if (plan.routes.includes(reason.route)) {
      lines.push(`- \`${reason.route}\`: ${reason.reason}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summarizeRun({ plan, results, runErrors = [], exitCode, durationMs }) {
  const failures = results.filter((result) => result.failures.length > 0);
  const warnings = results.filter((result) => result.warnings.length > 0);
  const lines = [
    "# 6529bot Responsiveness Summary",
    "",
    `Status: ${exitCode === 0 ? "pass" : "fail"}`,
    `Duration: ${(durationMs / 1000).toFixed(1)}s`,
    `Profile: ${plan.profile?.label || plan.profile?.id || "none"}`,
    `Contexts: ${plan.contexts.map((context) => `\`${context.name}\``).join(", ")}`,
    `Routes: ${plan.routes.map((route) => `\`${route}\``).join(", ")}`,
    `Checks completed: ${results.length}/${plan.routes.length * plan.contexts.length}`,
    `Failures: ${failures.length + runErrors.length}`,
    `Warnings: ${warnings.length}`,
    "",
  ];

  if (runErrors.length > 0) {
    lines.push("## Run Errors", "");
    const groupedRunErrors = compactRunErrors(runErrors);
    for (const entry of groupedRunErrors.slice(0, 10)) {
      lines.push(`- ${entry.count > 1 ? `${entry.count} checks: ` : ""}${entry.message}`);
    }
    if (groupedRunErrors.length > 10) {
      lines.push(`- ${groupedRunErrors.length - 10} additional run error group(s) omitted from this summary.`);
    }
    lines.push("");
  }

  if (plan.profile?.platformNotes?.length) {
    lines.push("## Platform Context", "");
    for (const note of plan.profile.platformNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  const platformMatrix = summarizePlatformMatrix(results);
  if (platformMatrix.length > 0) {
    lines.push("## Platform Matrix", "");
    for (const row of platformMatrix) {
      lines.push(
        `- \`${row.mode}\`: ${row.completed} check(s), failures=${row.failures}, warnings=${row.warnings}, avg=${row.averageSeconds}s`
      );
    }
    lines.push("");
  }

  if (failures.length > 0) {
    lines.push("## Failures", "");
    const groupedFailures = groupResultFailures(failures);
    for (const group of groupedFailures.slice(0, 20)) {
      lines.push(
        `- ${group.count} check(s): ${group.message}; examples: ${formatResultExamples(group.examples)}`
      );
    }
    if (groupedFailures.length > 20) {
      lines.push(`- ${groupedFailures.length - 20} additional failure group(s) omitted from this summary.`);
    }
    lines.push("");
  }

  const overlayDiagnostics = distinctOverlayDiagnostics(results);
  if (overlayDiagnostics.length > 0) {
    lines.push("## Next.js Overlay Diagnostics", "");
    for (const diagnostic of overlayDiagnostics) {
      lines.push(`- \`${diagnostic.mode}\` \`${diagnostic.route}\`: ${diagnostic.text}`);
    }
    lines.push("");
  }

  if (warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const result of warnings.slice(0, 20)) {
      lines.push(`- \`${result.mode}\` \`${result.route}\`: ${result.warnings.join("; ")}`);
    }
    lines.push("");
  }

  lines.push("## Slowest Checks", "");
  for (const result of [...results].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10)) {
    lines.push(
      `- \`${result.mode}\` \`${result.route}\`: ${(result.durationMs / 1000).toFixed(1)}s, screenshot \`${result.screenshot}\``
    );
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function distinctOverlayDiagnostics(results) {
  const seen = new Set();
  const diagnostics = [];
  for (const result of results || []) {
    const text = summarizeOverlayText(result.metrics?.nextErrorOverlayText);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    diagnostics.push({
      mode: result.mode,
      route: result.route,
      text,
    });
    if (diagnostics.length >= 5) {
      break;
    }
  }
  return diagnostics;
}

function compactRunErrors(errors) {
  const groups = new Map();
  for (const error of errors || []) {
    const message = summarizeRunErrorForGrouping(error);
    const existing = groups.get(message) || { message, count: 0 };
    existing.count += 1;
    groups.set(message, existing);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function summarizeRunErrorForGrouping(value) {
  return String(value || "")
    .replace(/^\/[^:]*:\s*/, "<route>: ")
    .replace(/\s+\d+ \|.*$/g, "")
    .replace(/\s+at \/home\/runner\/work\/.*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function groupResultFailures(results) {
  const groups = new Map();
  for (const result of results || []) {
    const message = (result.failures || []).join("; ");
    const existing = groups.get(message) || { message, count: 0, examples: [] };
    existing.count += 1;
    if (existing.examples.length < 8) {
      existing.examples.push(result);
    }
    groups.set(message, existing);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function formatResultExamples(results) {
  return (results || [])
    .map((result) => `\`${result.mode}\` \`${result.route}\``)
    .join(", ");
}

function summarizePlatformMatrix(results) {
  const groups = new Map();
  for (const result of results || []) {
    const mode = result.mode || "unknown";
    const existing = groups.get(mode) || {
      mode,
      completed: 0,
      failures: 0,
      warnings: 0,
      durationMs: 0,
    };
    existing.completed += 1;
    existing.failures += result.failures?.length ? 1 : 0;
    existing.warnings += result.warnings?.length ? 1 : 0;
    existing.durationMs += Number(result.durationMs || 0);
    groups.set(mode, existing);
  }
  return [...groups.values()]
    .sort((left, right) => left.mode.localeCompare(right.mode))
    .map((group) => ({
      ...group,
      averageSeconds:
        group.completed > 0 ? (group.durationMs / group.completed / 1000).toFixed(1) : "0.0",
    }));
}

function headerComment() {
  return "// Generated by 6529reviewbot responsiveness runner. Do not commit.\n";
}

function printHelp() {
  console.log(`Run a temporary Playwright responsiveness sweep against a checked-out frontend PR.

Usage:
  node bin/responsiveness-runner.cjs --target <repo> [options]

Options:
  --target <dir>          Target frontend repo checkout. Default: cwd.
  --base-ref <ref>        Base ref/SHA for changed-file inference. Default: origin/main.
  --head-ref <ref>        Head ref/SHA for changed-file inference. Default: HEAD.
  --output-dir <dir>      Output directory. Default: <target>/.reviewbot-responsiveness.
  --base-url <url>        Local app URL. Default: http://localhost:3001.
  --port <number>         App port. Default: 3001.
  --contexts <csv>        Contexts. Default: ${DEFAULT_CONTEXTS.join(",")}.
  --profile <id>          Responsiveness profile. Default: auto-detect from package.json.
  --max-pages <number>    Maximum routes to check. Default: 12.
  --workers <number>      Playwright workers. Default: 4.
  --changed-files <file>  Newline-separated changed file list.
  --pages <csv>           Explicit route list, bypassing inference.
  --install-command <cmd> Web server command. Default: ./bin/6529 run dev.
  --reuse-existing-server Reuse a server already listening at --base-url.
  --plan-only             Write plan and skip Playwright.
`);
}

module.exports = {
  CONTEXTS,
  DEFAULT_CONTEXTS,
  RESPONSIVENESS_PROFILES,
  buildPlan,
  buildPlaywrightConfig,
  buildPlaywrightSpec,
  collectChangedFiles,
  detectResponsivenessProfile,
  buildScreenshotManifest,
  inferRoutes,
  isNextDevToolsOnlyText,
  parseArgs,
  publicProfile,
  runResponsiveness,
  summarizeOverlayText,
};
