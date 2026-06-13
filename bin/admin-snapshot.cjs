#!/usr/bin/env node

"use strict";

const {
  collectAdminSnapshot,
  formatAdminSnapshotMarkdown,
} = require("../src/admin-snapshot.cjs");
const {
  createUsageApiClient,
  usageApiClientSettingsFromEnv,
} = require("../src/usage-api-client.cjs");
const { safeErrorLine } = require("../src/diagnostics.cjs");

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    json: false,
    quiet: false,
    requireOk: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--quiet") {
      options.quiet = true;
    } else if (arg === "--require-ok") {
      options.requireOk = true;
    } else if (arg === "--base-url") {
      options.baseUrl = requireValue(argv, (index += 1), arg);
    } else if (arg === "--actor") {
      options.actor = requireValue(argv, (index += 1), arg);
    } else if (arg === "--roles") {
      options.roles = csv(requireValue(argv, (index += 1), arg));
    } else if (arg === "--days") {
      options.days = requireValue(argv, (index += 1), arg);
    } else if (arg === "--recent-days") {
      options.recentDays = requireValue(argv, (index += 1), arg);
    } else if (arg === "--limit") {
      options.limit = requireValue(argv, (index += 1), arg);
    } else if (arg === "--stale-minutes") {
      options.staleMinutes = requireValue(argv, (index += 1), arg);
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main(argv = process.argv.slice(2), env = process.env, io = process) {
  const options = parseArgs(argv);
  if (options.help) {
    io.stdout.write(usage());
    return { ok: true, help: true };
  }
  const settings = {
    ...usageApiClientSettingsFromEnv(env),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.actor ? { actor: options.actor } : {}),
    ...(options.roles ? { roles: options.roles } : {}),
  };
  const client = createUsageApiClient({ settings });
  const snapshot = await collectAdminSnapshot({
    client,
    days: options.days,
    recentDays: options.recentDays,
    limit: options.limit,
    staleMinutes: options.staleMinutes,
  });
  if (!options.quiet) {
    io.stdout.write(
      options.json
        ? `${JSON.stringify(snapshot, null, 2)}\n`
        : formatAdminSnapshotMarkdown(snapshot)
    );
  }
  if (options.requireOk && !snapshot.ok) {
    const error = new Error("Admin snapshot has failed checks.");
    error.exitCode = 1;
    throw error;
  }
  return snapshot;
}

function usage() {
  return `Usage: npm run admin:snapshot -- --base-url <url> [options]

Options:
  --json              Print JSON instead of Markdown.
  --quiet             Do not print output.
  --require-ok        Exit non-zero when checks fail or warnings are present.
  --base-url <url>    Bot API base URL. Defaults to REVIEWBOT_USAGE_API_BASE_URL.
  --actor <value>     Admin actor for HMAC assertions.
  --roles <csv>       Admin roles for HMAC assertions.
  --days <n>          Admin summary lookback days.
  --recent-days <n>   Recent usage-events lookback days.
  --limit <n>         Recent rows per endpoint.
  --stale-minutes <n> Run-claim stale threshold.
`;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (value === undefined || value === "") {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function csv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(safeErrorLine(error));
    process.exitCode = error.exitCode || 1;
  });
}

module.exports = {
  main,
  parseArgs,
  usage,
};
