"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const {
  validateReleaseNotesPublication,
} = require("./release-notes-publication.cjs");
const {
  normalizeReleaseVersion,
  releaseTagNameError,
} = require("./release-version.cjs");

const DRY_RUN_NOTICE = "This command does not create tags or GitHub Releases.";

function collectReleaseTagPlan(options = {}) {
  const release = normalizeReleaseVersion(options.release || options.version || "v0.1.0");
  const releaseNotes = collectReleaseNotesState(options);
  const errors = [];
  const warnings = [];
  const tagNameError = releaseTagNameError(release);
  const git = options.git || collectGitState({ ...options, release, skipRemoteTagCheck: Boolean(tagNameError) });

  if (tagNameError) {
    errors.push(tagNameError);
  }
  if (!options.allowNonMain && git.branch !== "main") {
    errors.push(`release tags should be planned from main; current branch is '${git.branch || "unknown"}'.`);
  }
  if (git.dirty) {
    errors.push("working tree must be clean before planning a release tag.");
  }
  if (git.tagExists) {
    errors.push(`release tag '${release}' already exists locally; inspect tags before planning a release.`);
  }
  if (git.remoteTagExists) {
    errors.push(
      `release tag '${release}' already exists on ${git.remote || "origin"}; inspect remote tags before planning a release.`
    );
  }
  if (git.remoteTagCheckFailed) {
    const message = `remote tag check for '${release}' on ${git.remote || "origin"} did not complete.`;
    if (options.requireRemoteTagCheck) {
      errors.push(`${message} Run from a networked checkout or verify the remote tag manually before tagging.`);
    } else {
      warnings.push(`${message} Final --require-ready planning will fail until the remote can be checked.`);
    }
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
  } else {
    if (releaseNotes.release && releaseNotes.release !== release) {
      errors.push(`release notes title '${releaseNotes.release}' must match planned release '${release}'.`);
    }
    for (const warning of releaseNotes.report.warnings) {
      warnings.push(`release notes: ${warning}`);
    }
    if (!releaseNotes.report.ready) {
      for (const error of releaseNotes.report.errors) {
        errors.push(`release notes: ${error}`);
      }
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
    commands: tagCommands(release, git.commit, git.remote),
  };
}

function collectGitState(options = {}) {
  const cwd = options.root || process.cwd();
  const remote = options.remote || "origin";
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
  const tagExists = options.release
    ? Boolean(gitOutput(["tag", "--list", options.release], cwd, { optional: true }).trim())
    : false;
  const remoteTagState =
    options.release && !options.skipRemoteTagCheck
      ? collectRemoteTagState(cwd, remote, options.release)
      : { remote, remoteTagExists: false, remoteTagCheckFailed: false };
  return {
    branch,
    commit,
    dirty: Boolean(status.trim()),
    upstream,
    ahead,
    behind,
    tagExists,
    ...remoteTagState,
  };
}

function collectRemoteTagState(cwd, remote, release) {
  try {
    const output = childProcess.execFileSync(
      gitBin(),
      ["ls-remote", "--tags", remote, `refs/tags/${release}`],
      {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }
    );
    const expectedTag = `refs/tags/${release}`;
    const remoteTagExists = String(output || "")
      .split(/\r?\n/)
      .some((line) => {
        const ref = line.trim().split(/\s+/)[1];
        return ref === expectedTag || ref === `${expectedTag}^{}`;
      });
    return {
      remote,
      remoteTagExists,
      remoteTagCheckFailed: false,
    };
  } catch (error) {
    return {
      remote,
      remoteTagExists: false,
      remoteTagCheckFailed: true,
    };
  }
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
    release: releaseFromReleaseNotes(markdown),
    report: validateReleaseNotesPublication(markdown, {
      requireNoWarnings: Boolean(options.requireNoWarnings),
    }),
  };
}

function releaseFromReleaseNotes(markdown) {
  const match = String(markdown || "").match(/^#\s+6529reviewbot\s+([vV]?[0-9][0-9A-Za-z._-]*)\s*$/m);
  return match ? normalizeReleaseVersion(match[1]) : "";
}

function publicGitState(git) {
  return {
    branch: String(git.branch || ""),
    commit: String(git.commit || ""),
    dirty: Boolean(git.dirty),
    remote: String(git.remote || "origin"),
    upstream: String(git.upstream || ""),
    ahead: wholeNumber(git.ahead),
    behind: wholeNumber(git.behind),
    tagExists: Boolean(git.tagExists),
    remoteTagExists: Boolean(git.remoteTagExists),
    remoteTagCheckFailed: Boolean(git.remoteTagCheckFailed),
  };
}

function tagCommands(release, commit, remote = "origin") {
  const safeCommit = /^[0-9a-f]{7,40}$/i.test(String(commit || "")) ? commit : "<reviewed-commit-sha>";
  const safeRemote = /^[A-Za-z0-9._/-]+$/.test(String(remote || "")) ? remote : "origin";
  return [
    `git fetch ${safeRemote} --tags`,
    `git tag -a ${release} -m "${release} dogfood release" ${safeCommit}`,
    `git push ${safeRemote} ${release}`,
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
    `- remote: ${plan.git.remote || "origin"}`,
    `- upstream: ${plan.git.upstream || "none"}`,
    `- ahead/behind: ${plan.git.ahead}/${plan.git.behind}`,
    `- local tag exists: ${plan.git.tagExists ? "yes" : "no"}`,
    `- remote tag exists: ${
      plan.git.remoteTagCheckFailed ? "unchecked" : plan.git.remoteTagExists ? "yes" : "no"
    }`,
    "",
    "## Release Notes",
    "",
    `- supplied: ${plan.releaseNotes.provided ? "yes" : "no"}`,
    `- release: ${plan.releaseNotes.release || "unknown"}`,
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
  releaseFromReleaseNotes,
  releaseTagNameError,
  collectRemoteTagState,
  tagCommands,
};
