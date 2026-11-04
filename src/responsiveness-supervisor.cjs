"use strict";

// Owns the target dev server for a responsiveness run and supervises the
// Playwright sweep. Playwright's own webServer only watches the server while
// it starts, so a dev server that later exits or stops answering left the run
// waiting until the GitHub job timeout with no summary. This module starts the
// server, waits for it, health-probes it during the sweep, enforces an overall
// deadline, and stops every child process tree before the runner writes its
// summary.

const childProcess = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { StringDecoder } = require("string_decoder");
const { redactSensitiveText } = require("./diagnostics.cjs");

const DEFAULT_SERVER_START_TIMEOUT_MS = 180000;
const DEFAULT_HEALTH_PROBE_INTERVAL_MS = 5000;
const DEFAULT_HEALTH_PROBE_TIMEOUT_MS = 15000;
const DEFAULT_HEALTH_STALL_MS = 90000;
const DEFAULT_KILL_GRACE_MS = 5000;
const EXISTING_SERVER_PROBE_TIMEOUT_MS = 5000;
const READINESS_PROBE_TIMEOUT_MS = 30000;
const PLAYWRIGHT_GLOBAL_TIMEOUT_RESERVE_MS = 90000;
const DEFAULT_LOG_TAIL_LINES = 40;
const MAX_LOG_LINE_CHARS = 240;
const MAX_LOG_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PARTIAL_LINE_CHARS = 4096;

// Exit codes for runs the supervisor stops early. 1 stays "checks failed".
const ABORT_EXIT_CODES = {
  "dev-server-exit": 3,
  "dev-server-stall": 3,
  "dev-server-start": 3,
  "playwright-start": 1,
  deadline: 4,
  interrupted: 130,
};

function resolveSupervisorTimings(env = process.env) {
  return {
    serverStartTimeoutMs: positiveIntegerEnv(
      env,
      "REVIEWBOT_RESPONSIVENESS_SERVER_TIMEOUT_MS",
      DEFAULT_SERVER_START_TIMEOUT_MS
    ),
    healthProbeIntervalMs: positiveIntegerEnv(
      env,
      "REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_INTERVAL_MS",
      DEFAULT_HEALTH_PROBE_INTERVAL_MS
    ),
    healthProbeTimeoutMs: positiveIntegerEnv(
      env,
      "REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_TIMEOUT_MS",
      DEFAULT_HEALTH_PROBE_TIMEOUT_MS
    ),
    healthStallMs: positiveIntegerEnv(
      env,
      "REVIEWBOT_RESPONSIVENESS_HEALTH_STALL_MS",
      DEFAULT_HEALTH_STALL_MS
    ),
    killGraceMs: positiveIntegerEnv(
      env,
      "REVIEWBOT_RESPONSIVENESS_KILL_GRACE_MS",
      DEFAULT_KILL_GRACE_MS
    ),
    healthProbePath: normalizeProbePath(env.REVIEWBOT_RESPONSIVENESS_HEALTH_PROBE_PATH),
  };
}

function positiveIntegerEnv(env, name, fallback) {
  const value = Number(env?.[name]);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeProbePath(value) {
  const text = String(value || "").trim();
  return text.startsWith("/") && !text.startsWith("//") ? text : "";
}

// Resolves to { responded, status, error }. Any HTTP response counts as
// responded, whatever its status; only connection errors and timeouts do not.
function probeHttp(url, { timeoutMs = DEFAULT_HEALTH_PROBE_TIMEOUT_MS, ignoreHTTPSErrors = false, signal } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    let request = null;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      if (request) {
        request.destroy();
      }
      resolve(result);
    };
    const onAbort = () => finish({ responded: false, status: 0, error: "probe cancelled" });

    let target;
    try {
      target = new URL(url);
    } catch {
      finish({ responded: false, status: 0, error: "invalid probe URL" });
      return;
    }
    if (signal?.aborted) {
      onAbort();
      return;
    }
    const client = target.protocol === "https:" ? https : http;
    try {
      request = client.request(
        target,
        {
          method: "GET",
          agent: false,
          headers: {
            accept: "*/*",
            "user-agent": "6529reviewbot-responsiveness-health",
          },
          rejectUnauthorized: !ignoreHTTPSErrors,
        },
        (response) => {
          response.on("error", () => {});
          response.resume();
          finish({ responded: true, status: response.statusCode || 0 });
        }
      );
    } catch (error) {
      finish({ responded: false, status: 0, error: errorText(error) });
      return;
    }
    request.on("error", (error) => finish({ responded: false, status: 0, error: errorText(error) }));
    timer = setTimeout(
      () => finish({ responded: false, status: 0, error: `no response within ${formatSeconds(timeoutMs)}` }),
      Math.max(1, timeoutMs)
    );
    if (signal) {
      signal.addEventListener("abort", onAbort, { once: true });
    }
    request.end();
  });
}

// Mirrors Playwright's webServer readiness rule: 2xx-403 is ready, and a 404
// on "/" is retried as "/index.html".
async function checkServerReady(url, options = {}) {
  const result = await probeHttp(url, options);
  if (isReadyStatus(result)) {
    return true;
  }
  const target = new URL(url);
  if (result.responded && result.status === 404 && target.pathname === "/") {
    target.pathname = "/index.html";
    return isReadyStatus(await probeHttp(target.toString(), options));
  }
  return false;
}

function isReadyStatus(result) {
  return Boolean(result?.responded && result.status >= 200 && result.status < 404);
}

async function waitForServerReady({ url, ignoreHTTPSErrors, timeoutMs, signal }) {
  const deadline = Date.now() + timeoutMs;
  const backoff = [100, 250, 500];
  while (!signal?.aborted && Date.now() < deadline) {
    const remainingMs = deadline - Date.now();
    const ready = await checkServerReady(url, {
      timeoutMs: Math.max(1, Math.min(READINESS_PROBE_TIMEOUT_MS, remainingMs)),
      ignoreHTTPSErrors,
      signal,
    });
    if (ready) {
      return true;
    }
    await sleep(Math.min(backoff.shift() || 1000, Math.max(0, deadline - Date.now())), signal);
  }
  return false;
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted || ms <= 0) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Probes the server on a fixed interval and reports a stall once no probe has
// received any HTTP response for stallMs. The stall check runs on its own
// timer, so a probe that hangs cannot delay detection.
function startLivenessMonitor({ url, ignoreHTTPSErrors, intervalMs, probeTimeoutMs, stallMs, onStall }) {
  const controller = new AbortController();
  let lastResponseAt = Date.now();
  let lastError = "";
  let stopped = false;

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(checker);
    controller.abort();
  };

  const checker = setInterval(() => {
    const silentMs = Date.now() - lastResponseAt;
    if (!stopped && silentMs >= stallMs) {
      stop();
      onStall({ silentMs, lastError });
    }
  }, Math.max(50, Math.min(1000, Math.floor(stallMs / 4))));

  (async () => {
    while (!stopped) {
      const result = await probeHttp(url, {
        timeoutMs: probeTimeoutMs,
        ignoreHTTPSErrors,
        signal: controller.signal,
      });
      if (stopped) {
        return;
      }
      if (result.responded) {
        lastResponseAt = Date.now();
        lastError = "";
      } else {
        lastError = result.error || "no response";
      }
      await sleep(intervalMs, controller.signal);
    }
  })();

  return { stop };
}

function createOutputCapture({ logPath = "", tailLines = DEFAULT_LOG_TAIL_LINES, maxBytes = MAX_LOG_FILE_BYTES, onStderrLine = null } = {}) {
  const lines = [];
  const partial = { stdout: "", stderr: "" };
  const decoders = { stdout: new StringDecoder("utf8"), stderr: new StringDecoder("utf8") };
  let fd = null;
  let bytesWritten = 0;
  let truncated = false;
  if (logPath) {
    try {
      fd = fs.openSync(logPath, "w");
    } catch {
      fd = null;
    }
  }

  const writeLog = (text) => {
    if (fd === null || !text) {
      return;
    }
    try {
      if (bytesWritten >= maxBytes) {
        if (!truncated) {
          truncated = true;
          fs.writeSync(fd, "\n[6529reviewbot] dev server log truncated\n");
        }
        return;
      }
      const buffer = Buffer.from(text, "utf8");
      const slice = buffer.subarray(0, Math.max(0, maxBytes - bytesWritten));
      fs.writeSync(fd, slice);
      bytesWritten += slice.length;
    } catch {
      // Logging is best effort; the in-memory tail still feeds the summary.
    }
  };

  // The log file is uploaded as a workflow artifact, where Actions secret
  // masking does not apply, so redact each complete line before writing it.
  // Redacting whole lines keeps a token split across chunks intact for the
  // patterns to match.
  const pushLine = (stream, line) => {
    const clean = stripAnsi(line).replace(/\s+$/, "");
    writeLog(`${redactSensitiveText(clean)}\n`);
    if (stream === "stderr" && onStderrLine) {
      onStderrLine(clean);
    }
    if (!clean.trim()) {
      return;
    }
    lines.push(clean);
    if (lines.length > tailLines) {
      lines.shift();
    }
  };

  return {
    write(stream, chunk) {
      const key = stream === "stderr" ? "stderr" : "stdout";
      const text = decoders[key].write(chunk);
      const parts = (partial[key] + text).split(/\r\n|\n|\r/);
      partial[key] = parts.pop();
      for (const part of parts) {
        pushLine(key, part);
      }
      if (partial[key].length > MAX_PARTIAL_LINE_CHARS) {
        pushLine(key, partial[key]);
        partial[key] = "";
      }
    },
    tail() {
      const pending = [partial.stdout, partial.stderr]
        .map((line) => stripAnsi(line).replace(/\s+$/, ""))
        .filter((line) => line.trim());
      return [...lines, ...pending].slice(-tailLines).map(sanitizeLogLine);
    },
    close() {
      for (const key of ["stdout", "stderr"]) {
        const rest = partial[key] + decoders[key].end();
        partial[key] = "";
        if (rest) {
          pushLine(key, rest);
        }
      }
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // Ignore close failures; the file is diagnostic only.
        }
        fd = null;
      }
    },
  };
}

function stripAnsi(value) {
  return String(value || "").replace(
    // CSI, OSC, and single-character escape sequences.
    /\u001b(?:\[[0-?]*[ -\/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g,
    ""
  );
}

// Dev server output is untrusted target-PR output that can reach a public PR
// comment, so redact secret-shaped text, drop control characters, keep code
// fences from closing early, and bound each line.
function sanitizeLogLine(value) {
  const text = redactSensitiveText(String(value || ""))
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\t/g, "  ")
    .replace(/`{3,}/g, "'''");
  return text.length > MAX_LOG_LINE_CHARS ? `${text.slice(0, MAX_LOG_LINE_CHARS - 3)}...` : text;
}

// Children this module started as leaders of their own process group. Group
// signals go only to these, so teardown can never reach the runner's own
// group, the step shell, or the Actions runner.
const OWNED_PROCESS_GROUPS = new WeakSet();

function spawnProcessGroup(command, args, { cwd, env, shell = false, stdio = "inherit" } = {}) {
  const spawnOptions = {
    cwd,
    env,
    shell,
    stdio,
    // A separate process group lets the supervisor stop the whole tree
    // (pnpm, Next.js workers, Playwright workers, Chromium) with one signal.
    detached: process.platform !== "win32",
    windowsHide: true,
  };
  const child =
    args && args.length > 0
      ? childProcess.spawn(command, args, spawnOptions)
      : childProcess.spawn(command, spawnOptions);
  if (spawnOptions.detached && child.pid) {
    OWNED_PROCESS_GROUPS.add(child);
  }
  return child;
}

function isRunning(child) {
  return Boolean(child?.pid) && child.exitCode === null && child.signalCode === null;
}

function signalProcessTree(child, signal) {
  if (!child?.pid) {
    return;
  }
  if (process.platform === "win32") {
    if (isRunning(child)) {
      childProcess.spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    }
    return;
  }
  if (!OWNED_PROCESS_GROUPS.has(child) || child.pid === process.pid) {
    // Not a group this module created: signal only that one process.
    if (isRunning(child)) {
      try {
        child.kill(signal);
      } catch {
        // Already gone.
      }
    }
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    // ESRCH: the process group is already gone.
  }
}

function waitForExit(child, timeoutMs) {
  if (!isRunning(child)) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.removeListener("exit", onExit);
      resolve(false);
    }, Math.max(1, timeoutMs));
    child.once("exit", onExit);
  });
}

async function terminateProcessTree(child, graceMs = DEFAULT_KILL_GRACE_MS) {
  if (!child?.pid) {
    return;
  }
  if (isRunning(child)) {
    signalProcessTree(child, "SIGTERM");
    if (!(await waitForExit(child, graceMs))) {
      signalProcessTree(child, "SIGKILL");
      await waitForExit(child, 2000);
    }
  }
  // The group leader can exit while children it started keep running.
  if (process.platform !== "win32") {
    signalProcessTree(child, "SIGKILL");
  }
}

function describeExit(label, code, signal) {
  if (code !== null && code !== undefined) {
    const hint = code > 128 ? signalNameForNumber(code - 128) : "";
    return `${label} exited with code ${code}${hint ? ` (${hint})` : ""}`;
  }
  return `${label} exited after signal ${signal || "unknown"}`;
}

// Shells report "killed by signal N" as exit code 128+N. These numbers are the
// same on Linux and macOS; the runner's CI host is Linux.
const POSIX_SIGNAL_NAMES = {
  1: "SIGHUP",
  2: "SIGINT",
  3: "SIGQUIT",
  4: "SIGILL",
  6: "SIGABRT",
  8: "SIGFPE",
  9: "SIGKILL",
  11: "SIGSEGV",
  13: "SIGPIPE",
  14: "SIGALRM",
  15: "SIGTERM",
};

function signalNameForNumber(number) {
  return POSIX_SIGNAL_NAMES[number] || "";
}

function playwrightGlobalTimeoutMs(remainingMs) {
  const reserve = Math.min(PLAYWRIGHT_GLOBAL_TIMEOUT_RESERVE_MS, Math.floor(Math.max(0, remainingMs) / 4));
  return Math.max(1000, Math.floor(remainingMs - reserve));
}

function installSignalHandlers(onSignal, source = process) {
  const handlers = ["SIGINT", "SIGTERM"].map((signal) => {
    const handler = () => onSignal(signal);
    source.on(signal, handler);
    return [signal, handler];
  });
  return {
    remove() {
      for (const [signal, handler] of handlers) {
        source.removeListener(signal, handler);
      }
    },
  };
}

async function superviseBenchmark({
  baseUrl,
  ignoreHTTPSErrors = false,
  reuseExistingServer = false,
  devServer,
  playwright,
  startedAt = Date.now(),
  deadlineAt,
  deadlineLabel = "",
  timings = resolveSupervisorTimings(),
  healthProbePath = "/",
  logPath = "",
  handleSignals = true,
  signalSource = process,
  echoDevServerStderr = true,
  onAbort = null,
  log = (message) => process.stderr.write(`${message}\n`),
}) {
  const controller = new AbortController();
  const capture = createOutputCapture({
    logPath,
    onStderrLine: echoDevServerStderr ? (line) => process.stderr.write(`[WebServer] ${line}\n`) : null,
  });
  let devServerChild = null;
  let devServerClosed = null;
  let playwrightChild = null;
  let monitor = null;
  let reusedServer = false;
  let playwrightResult = null;
  const state = {
    abort: null,
    stopping: false,
    serverReady: false,
    playwrightExited: false,
  };
  let resolveAbort = () => {};
  const abortPromise = new Promise((resolve) => {
    resolveAbort = resolve;
  });
  const abort = (kind, reason, extra = {}) => {
    if (state.abort || state.stopping) {
      return;
    }
    state.abort = {
      kind,
      reason,
      exitCode: ABORT_EXIT_CODES[kind] || 1,
      elapsedMs: Date.now() - startedAt,
      ...extra,
    };
    log(`[responsiveness runner] stopping the benchmark: ${reason}`);
    // Record the reason before any teardown starts. A host shutdown can kill
    // the runner within seconds of its SIGTERM, before the children are down.
    if (onAbort) {
      try {
        onAbort({
          ...state.abort,
          playwrightStarted: Boolean(playwrightChild),
          devServerStarted: Boolean(devServerChild),
          reusedServer,
          devServerTail: reusedServer ? [] : capture.tail(),
          devServerLogPath: reusedServer ? "" : logPath,
        });
      } catch (error) {
        log(`[responsiveness runner] could not write the early summary: ${errorText(error)}`);
      }
    }
    controller.abort();
    resolveAbort(state.abort);
  };

  const budgetMs = Math.max(0, deadlineAt - startedAt);
  const deadlineReason = (suffix = "") =>
    `runner deadline reached after ${formatMinutes(budgetMs)}${deadlineLabel ? ` (${deadlineLabel})` : ""}${suffix}`;
  const deadlineTimer = setTimeout(
    () => abort("deadline", deadlineReason()),
    Math.max(0, deadlineAt - Date.now())
  );
  const signalHandlers = handleSignals
    ? installSignalHandlers(
        (signal) =>
          abort("interrupted", `runner received ${signal}`, { exitCode: signal === "SIGINT" ? 130 : 143 }),
        signalSource
      )
    : null;

  try {
    const alreadyAvailable = await checkServerReady(baseUrl, {
      timeoutMs: EXISTING_SERVER_PROBE_TIMEOUT_MS,
      ignoreHTTPSErrors,
      signal: controller.signal,
    });
    if (!state.abort && alreadyAvailable) {
      if (reuseExistingServer) {
        reusedServer = true;
        state.serverReady = true;
      } else {
        abort(
          "dev-server-start",
          `${baseUrl} is already in use; stop the other server or pass --reuse-existing-server`
        );
      }
    }

    if (!state.abort && !reusedServer) {
      devServerChild = spawnProcessGroup(devServer.command, [], {
        cwd: devServer.cwd,
        env: devServer.env,
        shell: true,
        // Keep stdin open like Playwright's webServer; some dev servers exit
        // when stdin closes.
        stdio: ["pipe", "pipe", "pipe"],
      });
      devServerClosed = new Promise((resolve) => devServerChild.once("close", resolve));
      devServerChild.stdout.on("data", (chunk) => capture.write("stdout", chunk));
      devServerChild.stderr.on("data", (chunk) => capture.write("stderr", chunk));
      devServerChild.stdin.on("error", () => {});
      devServerChild.on("error", (error) =>
        abort("dev-server-start", `dev server could not start: ${errorText(error)}`)
      );
      devServerChild.on("exit", (code, signal) => {
        if (state.stopping || state.playwrightExited) {
          return;
        }
        abort(
          "dev-server-exit",
          `${describeExit("dev server", code, signal)}${state.serverReady ? "" : " before it became ready"}`,
          { devServerExitCode: code, devServerSignal: signal || null }
        );
      });

      const ready = await waitForServerReady({
        url: baseUrl,
        ignoreHTTPSErrors,
        timeoutMs: timings.serverStartTimeoutMs,
        signal: controller.signal,
      });
      if (!state.abort && !ready) {
        abort(
          "dev-server-start",
          `dev server did not become ready at ${baseUrl} within ${formatSeconds(timings.serverStartTimeoutMs)}`
        );
      }
      if (!state.abort) {
        state.serverReady = true;
      }
    }

    if (!state.abort) {
      monitor = startLivenessMonitor({
        url: new URL(healthProbePath || "/", baseUrl).toString(),
        ignoreHTTPSErrors,
        intervalMs: timings.healthProbeIntervalMs,
        probeTimeoutMs: timings.healthProbeTimeoutMs,
        stallMs: timings.healthStallMs,
        onStall: ({ silentMs, lastError }) =>
          abort(
            "dev-server-stall",
            `dev server stopped responding (no HTTP response to ${healthProbePath || "/"} for ${formatSeconds(silentMs)}${lastError ? `; last probe: ${sanitizeLogLine(lastError)}` : ""})`
          ),
      });

      const globalTimeoutMs = playwrightGlobalTimeoutMs(deadlineAt - Date.now());
      const globalDeadlineAt = Date.now() + globalTimeoutMs;
      playwrightChild = spawnProcessGroup(playwright.command, playwright.args || [], {
        cwd: playwright.cwd,
        env: {
          ...playwright.env,
          REVIEWBOT_RESPONSIVENESS_PLAYWRIGHT_GLOBAL_TIMEOUT_MS: String(globalTimeoutMs),
        },
        shell: Boolean(playwright.shell),
        stdio: playwright.stdio || "inherit",
      });
      const exited = new Promise((resolve) => {
        playwrightChild.once("exit", (code, signal) => resolve({ code, signal }));
        playwrightChild.once("error", (error) => resolve({ code: null, signal: null, error }));
      });
      const outcome = await Promise.race([exited, abortPromise.then(() => null)]);
      if (outcome) {
        state.playwrightExited = true;
        playwrightResult = outcome;
        if (outcome.error) {
          abort("playwright-start", `Playwright could not start: ${errorText(outcome.error)}`);
        } else if (outcome.code !== 0 && Date.now() >= globalDeadlineAt - 1000) {
          abort("deadline", deadlineReason("; Playwright stopped at its global timeout"));
        }
      }
    }
  } finally {
    // From here on, exits and stalls are the teardown itself, not a reason to
    // abort. Set this first so no later step can classify a finished run.
    state.stopping = true;
    // After a SIGINT/SIGTERM the host may be shutting down; stop children fast.
    const killGraceMs =
      state.abort?.kind === "interrupted" ? Math.min(1000, timings.killGraceMs) : timings.killGraceMs;
    clearTimeout(deadlineTimer);
    if (monitor) {
      monitor.stop();
    }
    if (signalHandlers) {
      signalHandlers.remove();
    }
    controller.abort();
    if (playwrightChild) {
      if (!state.playwrightExited) {
        await terminateProcessTree(playwrightChild, killGraceMs);
      }
      playwrightChild.unref();
    }
    if (devServerChild) {
      await terminateProcessTree(devServerChild, killGraceMs);
      // Let the last output (often the crash message) drain, but never wait
      // on a pipe an escaped grandchild still holds open.
      const drainWait = new AbortController();
      await Promise.race([devServerClosed, sleep(Math.min(2000, killGraceMs), drainWait.signal)]);
      drainWait.abort();
      for (const stream of [devServerChild.stdin, devServerChild.stdout, devServerChild.stderr]) {
        stream?.destroy();
      }
      devServerChild.unref();
    }
    capture.close();
  }

  return {
    abort: state.abort,
    playwrightExitCode: playwrightResult ? playwrightResult.code : null,
    playwrightSignal: playwrightResult ? playwrightResult.signal : null,
    playwrightStarted: Boolean(playwrightChild),
    devServerStarted: Boolean(devServerChild),
    reusedServer,
    devServerTail: reusedServer ? [] : capture.tail(),
    devServerLogPath: reusedServer ? "" : logPath,
  };
}

function formatSeconds(ms) {
  const seconds = Math.max(0, ms) / 1000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function formatMinutes(ms) {
  return ms < 60000 ? formatSeconds(ms) : `${(ms / 60000).toFixed(1)} min`;
}

function errorText(error) {
  return String(error?.code ? `${error.code}: ${error.message}` : error?.message || error || "unknown error")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

module.exports = {
  ABORT_EXIT_CODES,
  DEFAULT_HEALTH_PROBE_INTERVAL_MS,
  DEFAULT_HEALTH_PROBE_TIMEOUT_MS,
  DEFAULT_HEALTH_STALL_MS,
  DEFAULT_LOG_TAIL_LINES,
  DEFAULT_SERVER_START_TIMEOUT_MS,
  checkServerReady,
  createOutputCapture,
  describeExit,
  formatMinutes,
  playwrightGlobalTimeoutMs,
  probeHttp,
  resolveSupervisorTimings,
  sanitizeLogLine,
  signalProcessTree,
  spawnProcessGroup,
  stripAnsi,
  superviseBenchmark,
  terminateProcessTree,
};
