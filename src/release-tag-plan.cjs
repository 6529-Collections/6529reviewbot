"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const { normalizeReleaseVersion } = require("./release-notes-draft.cjs");
const {
  validateReleaseNotesPublication,
} = require("./release-notes-publication.cjs");

const DRY_RUN_NOTICE = "This command does not create tags or GitHub Releases.";

function collectReleaseTagPlan(options = {}) {
  const release = normalizeReleaseVersion(options.release || options.version || "v0.1.0");
  const git = options.git || collectGitState(options);
  const releaseNotes = collectReleaseNotesState(options);
  const errors = [];
  const warnings = [];

  if (!options.allowNonMain && git.branch !== "main") {
    errors.push(`release tags should be planned from main; current branch is '${git.branch || "unknown"}'.`);
  }
  if (git.dirty) {
    errors.push("working tree must be clean before planning a release tag.");
  }
  if (git.upstream) {
    if (git.ahead > 0) {
      errors.push(`local branch is ${git.ahead} commit(s) ahead of ${git.upstream}; push or reset before tagging.`);
    }
    if (git.behind > 0) {
      errors.push(`local branch is ${git.behind} commit(s) behind ${git.upstream}; pull before tagging.`);
    }
  } else {
    warnings.push("no upstream branch was detected; verify remote main before tagging.");
  }
  if (!releaseNotes.provided) {
    const message = "completed release notes were not supplied.";
    if (options.requireReleaseNotes) {
      errors.push(message);
    } else {
      warnings.push(`${message} Run release:notes:check before publishing.`);
    }
  } else if (!releaseNotes.report.ready) {
    for (const error of releaseNotes.report.errors) {
      errors.push(`release notes: ${error}`);
    }
    for (const warning of releaseNotes.report.warnings) {
      warnings.push(`release notes: ${warning}`);
    }
  }

  const ready = errors.length === 0;
  return {
    version: 1,
    release,
    ready,
    generatedAt: (options.now || new Date()).toISOString(),
    git: publicGitState(git),
    releaseNotes,
    errors,
    warnings,
    commands: tagCommands(release, git.commit),
  };
}

function collectGitState(options = {}) {
  const cwd = options.root || process.cwd();
  const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  const commit = gitOutput(["rev-parse", "HEAD"], cwd);
  const status = gitOutput(["status", "--porcelain"], cwd);
  const upstream = gitOutput(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], cwd, {
    optional: true,
  });
  const aheadBehind = upstream
    ? gitOutput(["rev-list", "--left-right", "--count", "HEAD...@{u}"], cwd, {
        optional: true,
      })
    : "";
  const [ahead, behind] = parseAheadBehind(aheadBehind);
  return {
    branch,
    commit,
    dirty: Boolean(status.trim()),
    upstream,
    ahead,
    behind,
  };
}

function collectReleaseNotesState(options = {}) {
  const file = options.releaseNotesFile || options.notesFile || "";
  if (!file && options.releaseNotesMarkdown === undefined) {
    return {
      provided: false,
      report: null,
    };
  }
  const markdown =
    options.releaseNotesMarkdown !== undefined
      ? String(options.releaseNotesMarkdown)
      : fs.readFileSync(file, "utf8");
  return {
    provided: true,
    file: file ? "[release-notes-file]" : "",
    report: validateReleaseNotesPublication(markdown, {
      requireNoWarnings: Boolean(options.requireNoWarnings),
    }),
  };
}

function publicGitState(git) {
  return {
    branch: String(git.branch || ""),
    commit: String(git.commit || ""),
    dirty: Boolean(git.dirty),
    upstream: String(git.upstream || ""),
    ahead: wholeNumber(git.ahead),
    behind: wholeNumber(git.behind),
  };
}

function tagCommands(release, commit) {
  const safeCommit = /^[0-9a-f]{7,40}$/i.test(String(commit || "")) ? commit : "<reviewed-commit-sha>";
  return [
    "git fetch origin --tags",
    `git tag -a ${release} -m "${release} dogfood release" ${safeCommit}`,
    `git push origin ${release}`,
    `Create the GitHub Release for ${release} from the checked release notes Markdown.`,
  ];
}

function formatReleaseTagPlanMarkdown(plan) {
  const lines = [
    `# Release Tag Plan ${plan.release}`,
    "",
    `Ready to tag: ${plan.ready ? "yes" : "no"}`,
    `Generated: ${plan.generatedAt}`,
    DRY_RUN_NOTICE,
    "",
    "## Git",
    "",
    `- branch: ${plan.git.branch || "unknown"}`,
    `- commit: ${plan.git.commit || "unknown"}`,
    `- dirty: ${plan.git.dirty ? "yes" : "no"}`,
    `- upstream: ${plan.git.upstream || "none"}`,
    `- ahead/behind: ${plan.git.ahead}/${plan.git.behind}`,
    "",
    "## Release Notes",
    "",
    `- supplied: ${plan.releaseNotes.provided ? "yes" : "no"}`,
    `- ready: ${plan.releaseNotes.report ? (plan.releaseNotes.report.ready ? "yes" : "no") : "not checked"}`,
    "",
    "## Commands",
    "",
    ...plan.commands.map((command) => `- \`${command}\``),
  ];
  if (plan.errors.length) {
    lines.push("", "## Errors", "", ...plan.errors.map((error) => `- ${error}`));
  }
  if (plan.warnings.length) {
    lines.push("", "## Warnings", "", ...plan.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

function gitOutput(args, cwd, options = {}) {
  try {
    return childProcess.execFileSync(gitBin(), args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", options.optional ? "ignore" : "pipe"],
    }).trim();
  } catch (error) {
    if (options.optional) {
      return "";
    }
    throw error;
  }
}

function parseAheadBehind(value) {
  const match = String(value || "").trim().match(/^(\d+)\s+(\d+)$/);
  if (!match) {
    return [0, 0];
  }
  return [Number(match[1]), Number(match[2])];
}

function wholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
}

function gitBin() {
  if (process.env.GIT_BIN) {
    return process.env.GIT_BIN;
  }
  const windowsGit = "C:\\Program Files\\Git\\cmd\\git.exe";
  if (process.platform === "win32" && fs.existsSync(windowsGit)) {
    return windowsGit;
  }
  return "git";
}

module.exports = {
  collectReleaseTagPlan,
  DRY_RUN_NOTICE,
  formatReleaseTagPlanMarkdown,
  parseAheadBehind,
  tagCommands,
};
