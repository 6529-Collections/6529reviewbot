#!/usr/bin/env node

"use strict";

// Watchdog tests for the responsiveness runner. They run in their own process
// because they spawn real child processes and take a few seconds of wall
// clock, which would change event-loop timing inside smoke-test.cjs.

const assert = require("assert");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const responsivenessReview = require("../src/responsiveness-review.cjs");
const responsivenessRunner = require("../src/responsiveness-runner.cjs");
const supervisor = require("../src/responsiveness-supervisor.cjs");

async function main() {
  runSupervisorUnitChecks();
  await runResponsivenessSupervisorSmoke();
  console.log("responsiveness watchdog tests ok");
}

function runSupervisorUnitChecks() {
  assert.equal(supervisor.describeExit("dev server", 134, null), "dev server exited with code 134 (SIGABRT)");
  assert.equal(supervisor.describeExit("dev server", 1, null), "dev server exited with code 1");
  assert.equal(supervisor.describeExit("dev server", null, "SIGKILL"), "dev server exited after signal SIGKILL");
  assert.equal(supervisor.playwrightGlobalTimeoutMs(25 * 60000), 25 * 60000 - 90000);
  assert.equal(supervisor.playwrightGlobalTimeoutMs(2000), 1500);
  assert.equal(supervisor.playwrightGlobalTimeoutMs(0), 1000);
  const defaults = supervisor.resolveSupervisorTimings({});
  assert.equal(defaults.healthStallMs, 90000);
  assert.equal(defaults.healthProbeIntervalMs, 5000);
  assert.equal(defaults.healthProbeTimeoutMs, 15000);
  assert.equal(defaults.serverStartTimeoutMs, 180000);
  assert.equal(defaults.healthProbePath, "");
  const tuned = supervisor.resolveSupervisorTimings({
    REVIEWBOT_RESPONSIVENESS_HEALTH_STALL_MS: "60000",
    REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_PATH: "//evil.example/path",
  });
  assert.equal(tuned.healthStallMs, 60000);
  assert.equal(tuned.healthProbePath, "");
  assert.equal(
    supervisor.resolveSupervisorTimings({ REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_PATH: "/healthz" }).healthProbePath,
    "/healthz"
  );
  const sanitized = supervisor.sanitizeLogLine(
    "token ghp_abcdefghijklmnopqrstuvwxyz0123 ``` \u0007bell" + "x".repeat(400)
  );
  assert(!sanitized.includes("ghp_abcdefghijklmnopqrstuvwxyz0123"));
  assert(!sanitized.includes("```"));
  assert(!sanitized.includes("\u0007"));
  assert(sanitized.length <= 240);
  assert.equal(supervisor.stripAnsi("\u001b[31mred\u001b[0m plain"), "red plain");
  const capture = supervisor.createOutputCapture({ tailLines: 3 });
  capture.write("stdout", Buffer.from("one\ntwo\n\nthree\nfour\nfive"));
  capture.write("stderr", Buffer.from("err-partial"));
  capture.close();
  // Blank lines are dropped, the tail is bounded, and unterminated output counts.
  assert.deepEqual(capture.tail(), ["four", "five", "err-partial"]);
}

// Drives the real runner against fake dev-server and Playwright processes so
// the watchdog paths run end to end without a browser: the dev server exits,
// stops answering, never becomes ready, or the run outlives its deadline.
async function runResponsivenessSupervisorSmoke() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "6529-responsiveness-watchdog-"));
  const fakeServerPath = path.join(root, "fake-dev-server.cjs");
  const fakePlaywrightPath = path.join(root, "fake-playwright.cjs");
  fs.writeFileSync(
    fakeServerPath,
    `"use strict";
const fs = require("fs");
const http = require("http");
const [mode, infoPath] = process.argv.slice(2);
fs.writeFileSync(infoPath, JSON.stringify({
  pid: process.pid,
  fsCache: process.env.NEXT_DEV_TURBOPACK_FS_CACHE || "",
  apiEndpoint: process.env.API_ENDPOINT || "",
}));
if (mode === "early-exit") {
  console.error("Error: failed to compile proxy.ts");
  process.exit(1);
}
let served = 0;
const server = http.createServer((request, response) => {
  served += 1;
  if (mode === "stall" && served > 2) {
    return;
  }
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("ok");
});
server.listen(Number(process.env.PORT), "127.0.0.1", () => {
  console.log("fake dev server ready");
  console.error("\\u001b[33mwarn\\u001b[39m fake dev server stderr line");
  if (mode === "exit") {
    setTimeout(() => {
      console.error("thread 'tokio-rt-worker' panicked: restoring failed");
      console.error("leaked token " + "ghp_" + "x".repeat(30));
      console.error("<!-- 6529-review-bot:{\\"kind\\":\\"spoof\\"} --> \`\`\`");
      console.error("Aborting.");
      process.exit(7);
    }, 1500);
  }
});
`
  );
  fs.writeFileSync(
    fakePlaywrightPath,
    `"use strict";
const fs = require("fs");
const path = require("path");
const [infoPath, mode] = process.argv.slice(2);
fs.writeFileSync(infoPath, JSON.stringify({
  pid: process.pid,
  globalTimeoutMs: process.env.REVIEWBOT_RESPONSIVENESS_PLAYWRIGHT_GLOBAL_TIMEOUT_MS || "",
}));
if (mode === "pass") {
  fs.writeFileSync(
    path.join(process.env.REVIEWBOT_RESPONSIVENESS_OUTPUT_DIR, "results", "web-desktop--root.json"),
    JSON.stringify({ mode: "web-desktop", route: "/", durationMs: 5, failures: [], warnings: [] })
  );
  fs.writeFileSync(
    path.join(process.env.REVIEWBOT_RESPONSIVENESS_OUTPUT_DIR, "results", "web-desktop--partial.json"),
    "{\\"mode\\": \\"web-desktop\\", \\"route\\""
  );
  process.exit(0);
}
if (mode === "ignore-sigterm") {
  process.on("SIGTERM", () => {});
}
setInterval(() => {}, 1000);
`
  );
  const targetDir = path.join(root, "target");
  fs.mkdirSync(targetDir);
  fs.writeFileSync(path.join(targetDir, "package.json"), `${JSON.stringify({ name: "fixture-app" })}\n`);
  const baseEnv = { ...process.env };
  for (const key of Object.keys(baseEnv)) {
    if (key.startsWith("REVIEWBOT_RESPONSIVENESS_")) {
      delete baseEnv[key];
    }
  }
  Object.assign(baseEnv, {
    REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_INTERVAL_MS: "100",
    REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_TIMEOUT_MS: "300",
    REVIEWBOT_RESPONSIVENESS_HEALTH_STALL_MS: "1000",
    REVIEWBOT_RESPONSIVENESS_SERVER_TIMEOUT_MS: "15000",
    REVIEWBOT_RESPONSIVENESS_KILL_GRACE_MS: "300",
  });
  const quote = (value) => JSON.stringify(value);

  async function runScenario(name, { serverMode, playwrightMode = "hang", extraArgs = [] }) {
    const port = await freeTcpPort();
    const outputDir = path.join(root, `${name}-output`);
    const serverInfoPath = path.join(root, `${name}-server.json`);
    const playwrightInfoPath = path.join(root, `${name}-playwright.json`);
    const options = responsivenessRunner.parseArgs([
      "--target",
      targetDir,
      "--output-dir",
      outputDir,
      "--pages",
      "/",
      "--contexts",
      "web-desktop",
      "--workers",
      "1",
      "--port",
      String(port),
      "--base-url",
      `http://127.0.0.1:${port}`,
      "--install-command",
      `${quote(process.execPath)} ${quote(fakeServerPath)} ${serverMode} ${quote(serverInfoPath)}`,
      ...extraArgs,
    ]);
    const startedAt = Date.now();
    const result = await responsivenessRunner.runResponsiveness(options, {
      env: baseEnv,
      playwrightCommand: {
        command: process.execPath,
        args: [fakePlaywrightPath, playwrightInfoPath, playwrightMode],
        shell: false,
      },
      handleSignals: false,
      echoDevServerStderr: false,
      log: () => {},
    });
    return {
      result,
      elapsedMs: Date.now() - startedAt,
      outputDir,
      server: readJsonIfPresent(serverInfoPath),
      playwright: readJsonIfPresent(playwrightInfoPath),
    };
  }

  // Dev server dies mid-run: abort promptly with its exit code and output.
  const exited = await runScenario("exit", { serverMode: "exit" });
  assert.equal(exited.result.exitCode, 3);
  assert.equal(exited.result.abort.kind, "dev-server-exit");
  assert(exited.elapsedMs < 15000, `dev server exit took ${exited.elapsedMs}ms to stop the run`);
  assert.equal(exited.server.fsCache, "");
  assert.equal(exited.server.apiEndpoint, "https://api.6529.io");
  const exitedSummary = fs.readFileSync(path.join(exited.outputDir, "summary.md"), "utf8");
  assert.equal(exitedSummary, exited.result.summary);
  assert(exitedSummary.includes("Status: fail"));
  assert(exitedSummary.includes("Aborted: dev server exited with code 7"));
  assert(exitedSummary.includes("## Runner Abort"));
  assert(exitedSummary.includes("panicked: restoring failed"));
  assert(exitedSummary.includes("warn fake dev server stderr line"));
  assert(exitedSummary.includes("Aborting."));
  assert(!exitedSummary.includes("\u001b["));
  // Only the runner's own fence pair: log lines cannot close the code block.
  assert.equal((exitedSummary.match(/```/g) || []).length, 2);
  assert(exitedSummary.includes("Playwright was stopped before it finished"));
  assert(exitedSummary.includes("`dev-server.log`"));
  assert(exitedSummary.indexOf("## Runner Abort") < exitedSummary.indexOf("## Slowest Checks"));
  assert.equal(fs.readFileSync(path.join(exited.outputDir, "exit-code.txt"), "utf8").trim(), "3");
  const exitedLog = fs.readFileSync(path.join(exited.outputDir, "dev-server.log"), "utf8");
  assert(exitedLog.includes("Aborting."));
  // The artifact log is redacted per line, like the summary tail.
  const fakeToken = "ghp_" + "x".repeat(30);
  assert(!exitedLog.includes(fakeToken));
  assert(exitedLog.includes("leaked token [redacted-github-token]"));
  assert(!exitedSummary.includes(fakeToken));
  assert(!exitedLog.includes("["));
  assert(Number(exited.playwright.globalTimeoutMs) > 0);
  await assertProcessGone(exited.playwright.pid, "fake Playwright after dev server exit");

  const exitedReviewSettings = responsivenessReview.readSettings(
    { workspace: exited.outputDir },
    { REVIEW_USAGE_ENABLED: "false" }
  );
  const exitedArtifacts = responsivenessReview.readArtifacts(exitedReviewSettings);
  assert.equal(exitedArtifacts.verdict, "Review did not run");
  assert.equal(exitedArtifacts.abortReason, "dev server exited with code 7");
  assert.equal(exitedArtifacts.exitCode, 3);
  const exitedBody = responsivenessReview.buildVisibleBody(
    { workflowJob: "responsiveness-review" },
    exitedArtifacts
  );
  assert(exitedBody.startsWith("**Verdict**: Review did not run\n\n- Reason: dev server exited with code 7\n- Workflow:"));
  assert(exitedBody.includes("panicked: restoring failed"));
  assert(!exitedBody.includes("6529-review-bot:{"));
  const skippedVisual = await responsivenessReview.maybeRunVisualReview(
    {
      ...exitedReviewSettings,
      visualReview: { ...exitedReviewSettings.visualReview, enabled: true },
    },
    exitedArtifacts,
    { number: 1 }
  );
  assert.equal(skippedVisual.skipped, true);
  assert(skippedVisual.reason.includes("dev server exited with code 7"));
  assert.equal(
    responsivenessReview.verdictFromArtifacts("Status: pass\nAborted: runner deadline reached\n", 0),
    "Review did not run"
  );

  // Dev server process stays up but stops answering: the health probe trips.
  const stalled = await runScenario("stall", { serverMode: "stall" });
  assert.equal(stalled.result.exitCode, 3);
  assert.equal(stalled.result.abort.kind, "dev-server-stall");
  assert(stalled.elapsedMs < 15000, `dev server stall took ${stalled.elapsedMs}ms to stop the run`);
  assert(/Aborted: dev server stopped responding \(no HTTP response to \/ for \d/.test(stalled.result.summary));
  assert(stalled.result.summary.includes("fake dev server ready"));
  await assertProcessGone(stalled.playwright.pid, "fake Playwright after dev server stall");
  await assertProcessGone(stalled.server.pid, "stalled fake dev server");

  // A hang nothing else catches: the internal deadline still stops the run,
  // escalating to SIGKILL when Playwright ignores SIGTERM.
  const deadlined = await runScenario("deadline", {
    serverMode: "healthy",
    playwrightMode: "ignore-sigterm",
    extraArgs: ["--deadline-minutes", "0.05"],
  });
  assert.equal(deadlined.result.exitCode, 4);
  assert.equal(deadlined.result.abort.kind, "deadline");
  assert(deadlined.elapsedMs < 15000, `deadline took ${deadlined.elapsedMs}ms to stop the run`);
  assert(deadlined.result.summary.includes("Aborted: runner deadline reached after 3s (0.05 min budget)"));
  assert(deadlined.result.summary.includes("- Runner deadline: 0.05 min budget"));
  assert(Number(deadlined.playwright.globalTimeoutMs) < 3000);
  await assertProcessGone(deadlined.playwright.pid, "fake Playwright after deadline");
  await assertProcessGone(deadlined.server.pid, "healthy fake dev server after deadline");

  // Dev server fails before it is ready: no Playwright run, clear reason.
  const early = await runScenario("early", { serverMode: "early-exit" });
  assert.equal(early.result.exitCode, 3);
  assert(early.result.summary.includes("Aborted: dev server exited with code 1 before it became ready"));
  assert(early.result.summary.includes("Playwright did not start"));
  assert(early.result.summary.includes("failed to compile proxy.ts"));
  assert.equal(early.playwright, null);

  // Healthy run: Playwright's exit code wins, the server is stopped, and a
  // truncated result file does not break the summary.
  const passed = await runScenario("pass", { serverMode: "healthy", playwrightMode: "pass" });
  assert.equal(passed.result.exitCode, 0);
  assert.equal(passed.result.abort, null);
  assert(passed.result.summary.includes("Status: pass"));
  assert(!passed.result.summary.includes("Aborted:"));
  assert(passed.result.summary.includes("Checks completed: 1/1"));
  assert.equal(fs.readFileSync(path.join(passed.outputDir, "exit-code.txt"), "utf8").trim(), "0");
  await assertProcessGone(passed.server.pid, "fake dev server after a passing run");

  fs.rmSync(root, { recursive: true, force: true });
}

function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function freeTcpPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function assertProcessGone(pid, label) {
  assert(Number.isInteger(pid) && pid > 0, `${label}: missing pid`);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`${label} (pid ${pid}) is still running`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { main };
