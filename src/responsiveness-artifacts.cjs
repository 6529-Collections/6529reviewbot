"use strict";

const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { awsCliBin, shouldUseShellForAwsCli } = require("./data-api.cjs");
const { safeErrorLine } = require("./diagnostics.cjs");

const DEFAULT_VIEWER_PATH_PREFIX = "/artifacts/responsiveness";
const DEFAULT_S3_PREFIX = "responsiveness";
const DEFAULT_PRESIGN_SECONDS = 900;
const DEFAULT_MAX_UPLOAD_FILES = 250;

function responsivenessArtifactSettingsFromEnv(env = process.env) {
  const bucket = env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_S3_BUCKET || "";
  const viewerBaseUrl = env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_VIEWER_BASE_URL || "";
  const enabled = parseBool(
    env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_ENABLED ||
      (bucket && viewerBaseUrl ? "true" : "false")
  );
  return {
    enabled,
    failClosed: parseBool(env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_FAIL_CLOSED || "false"),
    region:
      env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_AWS_REGION ||
      env.REVIEW_USAGE_AWS_REGION ||
      env.AWS_REGION ||
      "us-east-1",
    bucket,
    keyPrefix: cleanS3Prefix(
      env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_S3_PREFIX || DEFAULT_S3_PREFIX
    ),
    viewerBaseUrl: trimTrailingSlash(viewerBaseUrl),
    viewerPathPrefix: normalizeViewerPathPrefix(
      env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_VIEWER_PATH_PREFIX ||
        DEFAULT_VIEWER_PATH_PREFIX
    ),
    presignSeconds: boundedPositiveInt(
      env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_PRESIGN_SECONDS ||
        DEFAULT_PRESIGN_SECONDS,
      "REVIEWBOT_RESPONSIVENESS_ARTIFACTS_PRESIGN_SECONDS",
      60,
      3600
    ),
    maxUploadFiles: boundedPositiveInt(
      env.REVIEWBOT_RESPONSIVENESS_ARTIFACTS_MAX_UPLOAD_FILES ||
        DEFAULT_MAX_UPLOAD_FILES,
      "REVIEWBOT_RESPONSIVENESS_ARTIFACTS_MAX_UPLOAD_FILES",
      1,
      1000
    ),
  };
}

function uploadResponsivenessArtifacts(settings, options = {}) {
  const workspace = path.resolve(options.workspace || ".reviewbot-responsiveness");
  const log = options.log || console.warn;
  const manifestPath = path.join(workspace, "artifact-upload.json");
  const startedAt = new Date().toISOString();
  if (!settings.enabled) {
    const skipped = {
      ok: true,
      uploaded: false,
      skipped: true,
      reason: "responsiveness artifact upload disabled",
      files: [],
      screenshots: [],
      generatedAt: startedAt,
    };
    writeJson(manifestPath, skipped);
    return skipped;
  }
  const missing = missingArtifactSettings(settings);
  if (missing.length) {
    const result = {
      ok: false,
      uploaded: false,
      skipped: true,
      reason: `responsiveness artifact settings missing: ${missing.join(", ")}`,
      files: [],
      screenshots: [],
      generatedAt: startedAt,
    };
    writeJson(manifestPath, result);
    if (settings.failClosed) {
      throw new Error(result.reason);
    }
    log(result.reason);
    return result;
  }
  if (!fs.existsSync(workspace)) {
    const result = {
      ok: false,
      uploaded: false,
      skipped: true,
      reason: `responsiveness artifact workspace does not exist: ${workspace}`,
      files: [],
      screenshots: [],
      generatedAt: startedAt,
    };
    writeJson(manifestPath, result);
    if (settings.failClosed) {
      throw new Error(result.reason);
    }
    log(result.reason);
    return result;
  }

  const token = safeArtifactToken(options.token || process.env.REVIEWBOT_RESPONSIVENESS_ARTIFACT_TOKEN);
  const uploadFiles = collectUploadFiles(workspace, settings.maxUploadFiles);
  const context = normalizeUploadContext(options.context || {});
  const manifest = {
    ok: true,
    uploaded: false,
    skipped: false,
    token,
    viewerBaseUrl: settings.viewerBaseUrl,
    viewerPathPrefix: settings.viewerPathPrefix,
    generatedAt: startedAt,
    context,
    files: [],
    screenshots: [],
  };
  writeJson(manifestPath, manifest);

  const filesWithManifest = [
    ...uploadFiles,
    {
      absolutePath: manifestPath,
      relativePath: "artifact-upload.json",
      sizeBytes: safeStatSize(manifestPath),
    },
  ];

  try {
    for (const file of filesWithManifest) {
      const key = s3KeyForArtifact(settings, token, file.relativePath);
      awsS3Cp(settings, file.absolutePath, key, contentTypeForPath(file.relativePath));
      const entry = {
        path: file.relativePath,
        sizeBytes: file.sizeBytes,
        contentType: contentTypeForPath(file.relativePath),
        url: buildArtifactViewerUrl(settings, token, file.relativePath),
      };
      manifest.files.push(entry);
      if (isScreenshotPath(file.relativePath)) {
        manifest.screenshots.push(entry);
      }
    }
    manifest.uploaded = true;
    manifest.completedAt = new Date().toISOString();
    writeJson(manifestPath, manifest);
    awsS3Cp(
      settings,
      manifestPath,
      s3KeyForArtifact(settings, token, "artifact-upload.json"),
      "application/json"
    );
    return manifest;
  } catch (error) {
    manifest.ok = false;
    manifest.uploaded = false;
    manifest.error = safeErrorLine(error);
    manifest.completedAt = new Date().toISOString();
    writeJson(manifestPath, manifest);
    if (settings.failClosed) {
      throw error;
    }
    log(`responsiveness artifact upload failed: ${manifest.error}`);
    return manifest;
  }
}

function collectUploadFiles(workspace, maxFiles = DEFAULT_MAX_UPLOAD_FILES) {
  const root = path.resolve(workspace);
  const files = [];
  for (const relativePath of listFiles(root)) {
    if (!isUploadArtifactPath(relativePath)) {
      continue;
    }
    const absolutePath = path.join(root, relativePath);
    files.push({
      absolutePath,
      relativePath,
      sizeBytes: safeStatSize(absolutePath),
    });
  }
  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return files.slice(0, maxFiles);
}

function listFiles(root, relativeDir = "") {
  const current = path.join(root, relativeDir);
  if (!fs.existsSync(current)) {
    return [];
  }
  const result = [];
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const relativePath = slash(path.join(relativeDir, entry.name));
    if (entry.isDirectory()) {
      result.push(...listFiles(root, relativePath));
    } else if (entry.isFile()) {
      result.push(relativePath);
    }
  }
  return result;
}

function buildArtifactViewerUrl(settings, token, artifactPath) {
  if (!settings.viewerBaseUrl) {
    return "";
  }
  const encodedPath = encodeArtifactPath(artifactPath);
  return `${settings.viewerBaseUrl}${settings.viewerPathPrefix}/${encodeURIComponent(token)}/${encodedPath}`;
}

async function handleResponsivenessArtifactRequest(request, options = {}) {
  const settings = options.settings || responsivenessArtifactSettingsFromEnv();
  const url = new URL(request.url || "/", "http://localhost");
  if (!isResponsivenessArtifactPath(url.pathname, settings)) {
    return null;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return { statusCode: 405, body: { ok: false, error: "Method not allowed." } };
  }
  if (!settings.enabled || missingArtifactSettings(settings).length) {
    return { statusCode: 404, body: { ok: false, error: "Artifact viewer is not configured." } };
  }
  const parsed = parseArtifactViewerPath(url.pathname, settings);
  if (!parsed.ok) {
    return { statusCode: 404, body: { ok: false, error: "Artifact not found." } };
  }
  const key = s3KeyForArtifact(settings, parsed.token, parsed.artifactPath);
  const location = presignS3Object(settings, key, options);
  return {
    statusCode: 302,
    headers: {
      location,
      "cache-control": "private, no-store",
    },
    body: "",
  };
}

function isResponsivenessArtifactPath(pathname, settings) {
  const prefix = settings.viewerPathPrefix || DEFAULT_VIEWER_PATH_PREFIX;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function parseArtifactViewerPath(pathname, settings) {
  const prefix = settings.viewerPathPrefix || DEFAULT_VIEWER_PATH_PREFIX;
  const rest = pathname.slice(prefix.length).replace(/^\/+/, "");
  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) {
    return { ok: false };
  }
  const token = safeArtifactToken(decodeURIComponent(parts[0]));
  if (!token) {
    return { ok: false };
  }
  const artifactPath = parts.slice(1).map(decodeURIComponent).join("/");
  if (!isUploadArtifactPath(artifactPath)) {
    return { ok: false };
  }
  return { ok: true, token, artifactPath };
}

function s3KeyForArtifact(settings, token, artifactPath) {
  const cleanPath = cleanArtifactPath(artifactPath);
  const parts = [settings.keyPrefix, safeArtifactToken(token), cleanPath].filter(Boolean);
  return parts.join("/");
}

function presignS3Object(settings, key, options = {}) {
  const execFileSync = options.execFileSync || childProcess.execFileSync;
  const stdout = execFileSync(
    awsCliBin(),
    [
      "s3",
      "presign",
      `s3://${settings.bucket}/${key}`,
      "--region",
      settings.region,
      "--expires-in",
      String(settings.presignSeconds),
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: shouldUseShellForAwsCli(),
      maxBuffer: 1024 * 1024,
    }
  );
  const url = String(stdout || "").trim();
  if (!/^https:\/\/.+/.test(url)) {
    throw new Error("aws s3 presign did not return an HTTPS URL.");
  }
  return url;
}

function awsS3Cp(settings, absolutePath, key, contentType) {
  childProcess.execFileSync(
    awsCliBin(),
    [
      "s3",
      "cp",
      absolutePath,
      `s3://${settings.bucket}/${key}`,
      "--region",
      settings.region,
      "--content-type",
      contentType,
      "--cache-control",
      "private, max-age=0, no-cache",
      "--no-progress",
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
      shell: shouldUseShellForAwsCli(),
      maxBuffer: 1024 * 1024,
    }
  );
}

function writeGitHubOutput(result, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) {
    return;
  }
  const lines = [
    `uploaded=${result.uploaded ? "true" : "false"}`,
    `token=${safeOutputValue(result.token || "")}`,
    `manifest_url=${safeOutputValue(fileUrl(result, "artifact-upload.json"))}`,
    `screenshots_count=${Array.isArray(result.screenshots) ? result.screenshots.length : 0}`,
  ];
  fs.appendFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

function fileUrl(result, artifactPath) {
  return (result.files || []).find((file) => file.path === artifactPath)?.url || "";
}

function safeOutputValue(value) {
  return String(value || "").replace(/[\r\n]/g, "");
}

function readArtifactUploadManifest(workspace) {
  const manifestPath = path.join(path.resolve(workspace), "artifact-upload.json");
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

function screenshotUrlForPath(uploadManifest, screenshotPath) {
  const normalized = cleanArtifactPath(screenshotPath);
  return (
    (uploadManifest?.screenshots || uploadManifest?.files || []).find(
      (file) => file.path === normalized
    )?.url || ""
  );
}

function isUploadArtifactPath(value) {
  const artifactPath = cleanArtifactPath(value);
  if (!artifactPath) {
    return false;
  }
  if (artifactPath === "summary.md" || artifactPath === "plan.json" || artifactPath === "pr.json") {
    return true;
  }
  if (artifactPath === "screenshots.json" || artifactPath === "artifact-upload.json") {
    return true;
  }
  if (artifactPath === "visual-review.md" || artifactPath === "visual-review.json") {
    return true;
  }
  if (/^screenshots\/[A-Za-z0-9._-]+\.png$/.test(artifactPath)) {
    return true;
  }
  if (/^results\/[A-Za-z0-9._-]+\.json$/.test(artifactPath)) {
    return true;
  }
  return false;
}

function isScreenshotPath(value) {
  return /^screenshots\/[A-Za-z0-9._-]+\.png$/.test(cleanArtifactPath(value));
}

function contentTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".json") {
    return "application/json";
  }
  if (ext === ".md") {
    return "text/markdown; charset=utf-8";
  }
  return "application/octet-stream";
}

function cleanArtifactPath(value) {
  const text = slash(String(value || "").trim()).replace(/^\/+/, "");
  if (!text || text.includes("..") || /[\0\r\n\\]/.test(text)) {
    return "";
  }
  return text;
}

function cleanS3Prefix(value) {
  return slash(String(value || ""))
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");
}

function encodeArtifactPath(value) {
  return cleanArtifactPath(value)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function normalizeViewerPathPrefix(value) {
  const text = `/${String(value || DEFAULT_VIEWER_PATH_PREFIX).replace(/^\/+|\/+$/g, "")}`;
  if (!/^\/[A-Za-z0-9._~/-]+$/.test(text)) {
    throw new Error("REVIEWBOT_RESPONSIVENESS_ARTIFACTS_VIEWER_PATH_PREFIX is invalid.");
  }
  return text;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function safeArtifactToken(value) {
  const token = String(value || "").trim();
  if (!token) {
    return crypto.randomBytes(24).toString("base64url");
  }
  if (!/^[A-Za-z0-9_-]{24,96}$/.test(token)) {
    return "";
  }
  return token;
}

function missingArtifactSettings(settings) {
  const missing = [];
  for (const key of ["region", "bucket", "viewerBaseUrl", "keyPrefix"]) {
    if (!settings[key]) {
      missing.push(key);
    }
  }
  return missing;
}

function normalizeUploadContext(context) {
  return {
    repo: safeContextString(context.repo),
    prNumber: safeContextString(context.prNumber),
    headSha: safeContextString(context.headSha),
    workflowRunId: safeContextString(context.workflowRunId),
    jobId: safeContextString(context.jobId),
  };
}

function safeContextString(value) {
  return String(value || "").replace(/[\r\n]/g, " ").slice(0, 200);
}

function boundedPositiveInt(value, name, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function slash(value) {
  return String(value || "").split(path.sep).join("/");
}

function safeStatSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

module.exports = {
  DEFAULT_VIEWER_PATH_PREFIX,
  buildArtifactViewerUrl,
  collectUploadFiles,
  contentTypeForPath,
  handleResponsivenessArtifactRequest,
  isResponsivenessArtifactPath,
  isUploadArtifactPath,
  parseArtifactViewerPath,
  readArtifactUploadManifest,
  responsivenessArtifactSettingsFromEnv,
  screenshotUrlForPath,
  s3KeyForArtifact,
  uploadResponsivenessArtifacts,
  writeGitHubOutput,
};
