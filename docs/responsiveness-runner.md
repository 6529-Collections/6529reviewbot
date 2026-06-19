# Responsiveness Runner

The responsiveness runner checks frontend pull requests by installing the target
repository, starting its local Next.js server, and running a temporary
Playwright harness across web desktop, web mobile, native mobile, and Electron
desktop contexts.

There are two workflow entrypoints:

- `.github/workflows/responsiveness-review.yml` is the central production
  review workflow. The benchmark job runs target PR code on GitHub-hosted
  `ubuntu-latest` without model provider keys. A separate comment job posts a
  normal 6529bot PR comment and writes usage with provider `github`, model
  `actions-ubuntu-latest`. The comment job can also upload safe runner
  artifacts to private S3 and call Anthropic Opus for a screenshot-aware visual
  summary.
- `.github/workflows/responsiveness.yml` is a manual benchmark workflow for
  speed, signal-quality, and route-inference experiments.

## Runner Size

The manual workflow defaults to the GitHub-hosted runner label:

```text
ubuntu-latest
```

The production workflow also uses GitHub-hosted `ubuntu-latest`. If the
organization later provisions a larger GitHub-hosted runner label, pass that
label through the manual workflow's `runner_label` input first and only wire it
into production after measuring signal and cost.

The benchmark installs dependencies and runs target repository code, so keep
provider keys and AWS app credentials out of the benchmark job. The production
workflow posts comments and writes ledgers from a separate job.

## Manual Workflow

Run `.github/workflows/responsiveness.yml` from the Actions tab with:

```text
target_repo: 6529-Collections/6529seize-frontend
pr_number:  <existing frontend PR number>
runner_label: ubuntu-latest
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
- `screenshots.json`: machine-readable screenshot index with route, context,
  warning, failure, and timing metadata.
- `results/*.json`: per-route/per-context deterministic check results.
- `screenshots/*.png`: one full-page screenshot per completed check.
- `playwright-report.json` and `playwright-output/`: Playwright output.

Production PR comments include a link to the uploaded artifact when GitHub
returns one from `actions/upload-artifact`. Screenshot paths in the slowest
checks section link to that artifact; GitHub does not currently expose stable
per-file links inside the artifact zip.

When `REVIEWBOT_RESPONSIVENESS_ARTIFACTS_ENABLED=true`, the comment job also
uploads a bounded public-comment-safe subset to private S3:

- `summary.md`, `plan.json`, `pr.json`, `screenshots.json`, and
  `artifact-upload.json`.
- `results/*.json`.
- `screenshots/*.png`.

The S3 bucket should stay private. PR comments link through the central App
server viewer route, defaulting to:

```text
/artifacts/responsiveness/<opaque-token>/<artifact-path>
```

The viewer route validates the opaque token and artifact path shape, then
redirects to a short-lived presigned S3 URL. The opaque token is generated per
run and stored only in the artifact URL, so the route does not need a database.

When `REVIEWBOT_RESPONSIVENESS_AI_ENABLED=true`, the comment job sends the
deterministic summary plus the screenshot set to Anthropic Opus
(`REVIEWBOT_RESPONSIVENESS_AI_MODEL`, default `claude-opus-4-8`). The AI
summary becomes the top of the PR comment and the deterministic runner output
moves into an expandable details block. The workflow still records the GitHub
Actions compute row, and records the Opus call separately as
`responsiveness_visual` usage.

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
