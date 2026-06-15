"use strict";

const crypto = require("crypto");
const http = require("http");
const https = require("https");
const fs = require("fs");

const DEFAULT_TIMEOUT_MS = 30000;
const METADATA_TIMEOUT_MS = 1500;
const ECS_CREDENTIALS_HOST = "169.254.170.2";
const IMDS_HOST = "169.254.169.254";

async function main() {
  try {
    const input = JSON.parse(await readStdin());
    const response = await executeRdsDataStatement(input);
    process.stdout.write(JSON.stringify(response || {}));
  } catch (error) {
    process.stderr.write(`${safeError(error)}\n`);
    process.exitCode = 1;
  }
}

async function executeRdsDataStatement(input = {}) {
  const region = requiredString(input.region, "region");
  const payload = input.payload || {};
  const timeoutMs = positiveInteger(input.timeoutMs, DEFAULT_TIMEOUT_MS);
  const credentials = await resolveCredentials();
  const body = JSON.stringify(payload);
  const endpoint = new URL(`https://rds-data.${region}.amazonaws.com/Execute`);
  const headers = signAwsRequest({
    method: "POST",
    url: endpoint,
    region,
    service: "rds-data",
    body,
    credentials,
    headers: {
      "content-type": "application/json",
      "user-agent": "6529reviewbot-data-api",
    },
  });
  const response = await request(endpoint, {
    method: "POST",
    headers,
    body,
    timeoutMs,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `RDS Data API ExecuteStatement failed: ${response.statusCode} ${diagnosticTail(response.body, 500)}`
    );
  }
  return JSON.parse(response.body || "{}");
}

async function resolveCredentials(env = process.env) {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    return normalizeCredentials({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      sessionToken: env.AWS_SESSION_TOKEN || "",
    });
  }

  const containerCredentials = await resolveContainerCredentials(env);
  if (containerCredentials) {
    return containerCredentials;
  }

  const imdsCredentials = await resolveImdsCredentials();
  if (imdsCredentials) {
    return imdsCredentials;
  }

  throw new Error("Unable to resolve AWS credentials for RDS Data API.");
}

async function resolveContainerCredentials(env = process.env) {
  const relativeUri = env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || "";
  const fullUri = env.AWS_CONTAINER_CREDENTIALS_FULL_URI || "";
  if (!relativeUri && !fullUri) {
    return null;
  }

  const url = fullUri
    ? new URL(fullUri)
    : new URL(`http://${ECS_CREDENTIALS_HOST}${relativeUri}`);
  const headers = {};
  const token = containerAuthorizationToken(env);
  if (token) {
    headers.authorization = token;
  }
  const response = await request(url, {
    method: "GET",
    headers,
    timeoutMs: METADATA_TIMEOUT_MS,
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(
      `Container credential endpoint failed: ${response.statusCode} ${diagnosticTail(response.body, 300)}`
    );
  }
  return normalizeCredentials(JSON.parse(response.body || "{}"));
}

function containerAuthorizationToken(env = process.env) {
  if (env.AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE) {
    return fs.readFileSync(env.AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE, "utf8").trim();
  }
  return env.AWS_CONTAINER_AUTHORIZATION_TOKEN || "";
}

async function resolveImdsCredentials() {
  let token = "";
  try {
    const tokenResponse = await request(new URL(`http://${IMDS_HOST}/latest/api/token`), {
      method: "PUT",
      headers: {
        "x-aws-ec2-metadata-token-ttl-seconds": "21600",
      },
      timeoutMs: METADATA_TIMEOUT_MS,
    });
    if (tokenResponse.statusCode >= 200 && tokenResponse.statusCode < 300) {
      token = tokenResponse.body;
    }
  } catch (_error) {
    return null;
  }

  const headers = token ? { "x-aws-ec2-metadata-token": token } : {};
  try {
    const roleResponse = await request(
      new URL(`http://${IMDS_HOST}/latest/meta-data/iam/security-credentials/`),
      {
        method: "GET",
        headers,
        timeoutMs: METADATA_TIMEOUT_MS,
      }
    );
    if (roleResponse.statusCode < 200 || roleResponse.statusCode >= 300) {
      return null;
    }
    const roleName = roleResponse.body.trim().split("\n")[0];
    if (!roleName) {
      return null;
    }
    const credentialsResponse = await request(
      new URL(
        `http://${IMDS_HOST}/latest/meta-data/iam/security-credentials/${encodeURIComponent(roleName)}`
      ),
      {
        method: "GET",
        headers,
        timeoutMs: METADATA_TIMEOUT_MS,
      }
    );
    if (credentialsResponse.statusCode < 200 || credentialsResponse.statusCode >= 300) {
      return null;
    }
    return normalizeCredentials(JSON.parse(credentialsResponse.body || "{}"));
  } catch (_error) {
    return null;
  }
}

function normalizeCredentials(value = {}) {
  const credentials = {
    accessKeyId: value.accessKeyId || value.AccessKeyId || value.AccessKeyID || "",
    secretAccessKey: value.secretAccessKey || value.SecretAccessKey || "",
    sessionToken: value.sessionToken || value.Token || value.SessionToken || "",
  };
  if (!credentials.accessKeyId || !credentials.secretAccessKey) {
    throw new Error("AWS credentials response is missing access key material.");
  }
  return credentials;
}

function signAwsRequest(input = {}) {
  const method = input.method || "POST";
  const url = input.url;
  const body = input.body || "";
  const credentials = input.credentials || {};
  const amzDate = timestamp(new Date());
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const headers = {
    ...lowercaseHeaders(input.headers || {}),
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (credentials.sessionToken) {
    headers["x-amz-security-token"] = credentials.sessionToken;
  }

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${canonicalHeaderValue(headers[name])}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    method,
    url.pathname || "/",
    url.search ? url.search.slice(1) : "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = awsSigningKey(
    credentials.secretAccessKey,
    dateStamp,
    input.region,
    input.service
  );
  const signature = hmacHex(signingKey, stringToSign);
  return {
    ...headers,
    authorization:
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "http:" ? http : https;
    const req = transport.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
        timeout: positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS),
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            body: Buffer.concat(chunks).toString("utf8"),
          })
        );
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${options.timeoutMs} ms.`));
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}

function timestamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function awsSigningKey(secretAccessKey, dateStamp, region, service) {
  const kDate = hmac(Buffer.from(`AWS4${secretAccessKey}`, "utf8"), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest();
}

function hmacHex(key, value) {
  return crypto.createHmac("sha256", key).update(value, "utf8").digest("hex");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function lowercaseHeaders(headers) {
  const next = {};
  for (const [key, value] of Object.entries(headers)) {
    next[String(key).toLowerCase()] = value;
  }
  return next;
}

function canonicalHeaderValue(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

function requiredString(value, name) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return String(value);
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function diagnosticTail(value, maxChars) {
  const text = String(value || "");
  return text.length <= maxChars ? text : text.slice(text.length - maxChars);
}

function safeError(error) {
  return error && error.message ? error.message : String(error);
}

if (require.main === module) {
  main();
}

module.exports = {
  executeRdsDataStatement,
  normalizeCredentials,
  resolveCredentials,
  signAwsRequest,
};
