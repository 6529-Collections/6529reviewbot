# Responsiveness Runner

The responsiveness runner is a manual, non-production benchmark lane for
frontend pull requests. It checks a target PR by installing the target
repository, starting its local Next.js server, and running a temporary
Playwright harness across web desktop, web mobile, native mobile, and Electron
desktop contexts.

It is intentionally not wired into target repositories yet. Use it from this
repository's manual `6529bot Responsiveness` workflow while evaluating speed,
signal quality, and failure modes.

## Runner Size

The workflow defaults to the GitHub larger-runner label:

```text
ubuntu-latest-8-cores
```

For 6529, that label currently maps to a repo-scoped self-hosted Ubuntu runner
for `6529reviewbot` with 8 vCPU, 32 GB RAM, and a 300 GB encrypted gp3 root
volume. If the organization later uses a GitHub-hosted larger runner or a
different self-hosted label, pass that label through the workflow's
`runner_label` input.

Keep this workflow manual-only until the runner isolation story is stronger.
The benchmark installs dependencies and runs the target frontend PR, so it
executes target repository code on the selected runner. Do not put production
provider keys, AWS app credentials, or other privileged secrets on this runner.

## Manual Workflow

Run `.github/workflows/responsiveness.yml` from the Actions tab with:

```text
target_repo: 6529-Collections/6529seize-frontend
pr_number:  <existing frontend PR number>
runner_label: ubuntu-latest-8-cores
contexts: web-desktop,web-mobile,native-mobile,electron-desktop
max_pages: 12
workers: 4
plan_only: false
```

For a cheap dry run that only infers routes:

```text
plan_only: true
```

The workflow writes the markdown summary to the GitHub job summary and uploads
`.reviewbot-responsiveness` as an artifact containing:

- `plan.json`: changed files, inferred routes, contexts, and route reasons.
- `summary.md`: pass/fail, duration, failures, warnings, and slowest checks.
- `results/*.json`: per-route/per-context deterministic check results.
- `screenshots/*.png`: one full-page screenshot per completed check.
- `playwright-report.json` and `playwright-output/`: Playwright output.

## Contexts

The default reference mode runs these four contexts in parallel:

```text
web-desktop      1440x900 desktop Chrome
web-mobile       390x844 mobile/touch Chrome
native-mobile    390x844 mobile/touch with a Capacitor native-platform shim
electron-desktop 1280x800 desktop Chrome with an Electron user-agent suffix
```

The native context is a browser-level Capacitor shim, not a real iOS or Android
simulator. It is meant to catch app-shell layout regressions quickly before a
deeper device/simulator setup exists.

## Route Inference

The runner diffs the target PR base SHA against the checked-out head and maps
changed files to routes. It always includes a tiny shell canary:

```text
/
/waves
```

Global layout, provider, navigation, header, auth, style, package, or config
changes expand to a broader smoke set:

```text
/
/waves
/network
/the-memes
/meme-lab
/rememes
/notifications
/open-mobile?path=%2Fwaves
```

Component and app-route changes map to their closest stable page, capped by the
`max_pages` workflow input.

## Deterministic Checks

Each context/route check records:

- HTTP status.
- page errors and fatal console/hydration signals.
- horizontal document overflow.
- Next.js error overlay presence.
- title, URL, viewport meta, body class, and navigation/header/main presence.
- a full-page screenshot.

Hard failures fail the workflow. Non-fatal console errors and 4xx responses are
reported as warnings.

## Local Usage

From this repository:

```bash
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD \
  --plan-only
```

For a real local run, install the frontend dependencies first and then omit
`--plan-only`:

```bash
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD \
  --contexts web-desktop,web-mobile,native-mobile,electron-desktop \
  --max-pages 12 \
  --workers 4
```

When a frontend server is already hot locally, reuse it instead of having
Playwright start one:

```bash
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD \
  --base-url http://127.0.0.1:3001 \
  --reuse-existing-server
```

## Rollout Boundary

Do not add this workflow to frontend repositories or GitHub App webhook fanout
until benchmark data shows:

- typical trusted PR runtime is acceptable for developers;
- route inference catches the right pages;
- false positives are tolerable;
- native/Electron shims are useful enough to keep in the default mode;
- the runner has no production secrets or privileged AWS credentials.
