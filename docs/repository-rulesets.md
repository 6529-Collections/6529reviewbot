# Repository Rulesets

Repository rulesets and branch protection are GitHub-side controls. This
public repository can document the expected posture and check that release
docs mention it, but an operator must still verify the live repository settings
in GitHub before broad community release.

## Protected Branches

Protect `main` before using this repository for production dogfood or public
release tags.

Recommended `main` rules:

- require pull requests before merging;
- require conversation resolution before merging;
- require the `check` and `dependency-review` pull request checks;
- require branches to be up to date before merge when GitHub reports the
  branch is out of date;
- disallow force pushes and branch deletion;
- keep bypass permissions narrow and review bypass use in private operator
  evidence.

Do not require CodeRabbit while its review quota is rate-limited. Treat
CodeRabbit comments as useful review input when available, not as a required
release gate.

OpenSSF Scorecard runs on `main` after merge. It is monitored after every
merged PR, but it is not a pull request status check that can replace the
local `npm run release:check` gate.

## Protected Tags

Protect release tag patterns such as `v*` before publishing public dogfood
tags.

Recommended tag rules:

- restrict tag creation to maintainers who own release execution;
- prevent moving or deleting existing release tags;
- require `npm run release:tag-plan -- -- --release <version> --release-notes <release-notes.md> --require-ready`
  before creating a tag;
- require completed release notes to pass `npm run release:notes:check`;
- record the tag name, commit SHA, release notes path, and GitHub Release URL
  in private operator evidence.

The release tag plan remains dry-run only. It verifies clean synced `main`,
release-note readiness, local tag availability, and remote tag availability;
the operator still creates the annotated tag and GitHub Release explicitly.

## Evidence Boundary

Public release notes may say the repository ruleset guidance is checked when
`npm run check:repository-rulesets` passes. They may say the live rulesets are
ready only after an operator records the GitHub settings summary in private
operator evidence or explicitly defers the risk.

Do not copy GitHub organization security settings, bypass-user lists, private
team names, or screenshots with account identifiers into public artifacts.
Summarize them with public-safe language such as `main branch protection
verified with required PR checks` or `release tag ruleset verified for v*
tags`.

## Maintenance

Run the contract check after changing repository governance, release tags,
release operations, branch-protection guidance, or PR validation policy:

```bash
npm run check:repository-rulesets
```

