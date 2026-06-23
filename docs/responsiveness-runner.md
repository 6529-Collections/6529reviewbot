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
- `screenshots/*.png`: one full-page screenshot per completed check when
  possible; if full-page capture times out, the runner stores a viewport
  screenshot and reports the fallback as a warning. If both captures fail after
  the route has already rendered meaningful content, the run keeps the
  deterministic DOM metrics and reports missing screenshot evidence as a
  warning.
- `playwright-report.json` and `playwright-output/`: Playwright output.

Production PR comments include a link to the uploaded artifact when GitHub
returns one from `actions/upload-artifact`. Screenshot paths in the slowest
checks section link to that artifact; GitHub does not currently expose stable
per-file links inside the artifact zip.

The production workflow preserves artifacts and posts the 6529bot comment even
when deterministic checks fail, then fails the benchmark job after artifact
upload. This keeps the required GitHub check aligned with the review verdict
without losing debugging evidence.

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
`responsiveness_visual` usage. Full-resolution PNGs stay in the GitHub/S3
artifacts for humans and bots that need exact evidence. The Opus request uses
local resized JPEG copies, controlled by
`REVIEWBOT_RESPONSIVENESS_AI_MAX_IMAGE_DIMENSION` and
`REVIEWBOT_RESPONSIVENESS_AI_IMAGE_QUALITY`, so full-page screenshots remain
under provider many-image limits.
For 6529 frontend runs, the prompt includes the selected profile, route
reasons, platform notes, profile-specific deterministic probes, and per-image
metadata such as layout-root markers, `body.capacitor-native`, Electron
detection, bottom-navigation visibility, content readiness, blank-image
signals, and Next.js overlay/asset errors. The visible comment starts with the
Opus-authored summary and keeps the deterministic detail in an expandable
block.

## Contexts

The default reference mode runs these four contexts in parallel:

```text
web-desktop      1440x900 desktop Chrome
web-mobile       390x844 mobile/touch Chrome
native-mobile    390x844 mobile/touch with a Capacitor native-platform shim
electron-desktop 1280x800 desktop Chrome with an Electron user-agent suffix
```

Additional contexts are available for focused/manual runs:

```text
web-narrow        1279x900 desktop Chrome for the 6529 narrow layout boundary
web-tablet-touch  1024x768 touch Chrome
native-ios        390x844 native iOS simulation
native-android    412x915 native Android simulation
```

The native context is a browser-level Capacitor shim, not a real iOS or Android
simulator. It is meant to catch app-shell layout regressions quickly before a
deeper device/simulator setup exists. For 6529 frontend repositories, the
native assertion follows the actual app contract:
`Capacitor.isNativePlatform()` and `Capacitor.getPlatform()` must report the
shimmed native platform, `Capacitor.isPluginAvailable()` must expose the App,
Keyboard, and Device plugins used by the app shell, `viewport-fit=cover` must
be present, and `CapacitorSetup` should apply `body.capacitor-native`.
The native checks also record whether a bottom navigation is visible on normal
app-shell routes. Electron checks are also browser-level: they verify that the
renderer takes the Electron user-agent branch, but do not launch a packaged
desktop app.

## Profiles

The runner auto-detects a responsiveness profile from the target
`package.json`; pass `--profile <id>` to override it.

The `6529seize-frontend` profile is tuned to the 6529 web, Capacitor, and
Electron code paths:

- shell canaries: `/` and `/waves`;
- global smoke routes: `/`, `/waves`, `/messages`, `/network`, `/the-memes`,
  `/meme-lab`, `/rememes`, `/meme-calendar`, `/notifications`, and
  `/open-mobile?path=%2Fwaves`;
- route mappings for user pages, messages, app wallets, wave creation,
  Drop Forge, Meme Calendar, Discover, community curations, and mobile wrapper
  dialogs;
- global-pattern expansion for layout/context/navigation/device/deep-link/env
  changes;
- profile probes for the native Capacitor contract, Electron branch, 6529
  layout branch markers, and open-mobile handoff route.

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
- Next.js error overlay presence and concise overlay text, including open
  shadow-DOM text when available, capped before it is written to artifacts or
  sent to visual review.
- content readiness before screenshot capture. A route must render meaningful
  visible 6529 app content or shell evidence, such as visible text,
  interactive elements, media, landmarks, or known 6529 layout markers. Blank
  or near-empty captures fail instead of being passed to the visual reviewer as
  useful screenshots.
- late content recovery after screenshot capture. If the first readiness probe
  races route compilation but the screenshot is clearly nonblank, the runner
  re-reads DOM metrics after capture. When that late read confirms meaningful
  content and no Next.js error overlay, the route is reported with warnings for
  the late recovery and transient navigation timeout instead of a hard false
  failure.
- screenshot evidence quality when `sharp` is available in the target
  checkout. Near-white or near-uniform PNGs fail deterministically, even if the
  DOM reports content readiness, because humans and bots cannot use blank
  artifacts as visual evidence. Near-black screenshots with only a tiny
  framework badge are also treated as blank evidence so first-hit dev-server
  shells can use the transient route retry path.
- screenshot capture fallback. Full-page screenshots are preferred, but a
  content-ready page is not failed solely because Chromium times out while
  stitching a full-page screenshot. The runner retries with a viewport
  screenshot and reports that fallback as a warning; if both captures fail after
  content readiness, the missing evidence remains a warning with
  `screenshot unavailable`. If content never became ready, screenshot capture
  failure stays attached to the hard page failure.
- failed or blocked Next.js build asset requests. For 6529 PR-local dev-server
  runs the runner forces `ASSETS_FROM_S3=false` through
  `REVIEWBOT_RESPONSIVENESS_ASSETS_FROM_S3=false`, so checked-out PR
  `_next/static` and webpack assets are loaded from the local `_next` server
  instead of a production CloudFront `web_build` prefix. Local `/_next/image`
  optimizer requests for remote content images are not treated as build-asset
  leaks.
- bounded browser-based prewarm before assertions. The runner first performs
  lightweight HTTP prewarm and then visits planned routes in Chromium desktop
  and web-mobile contexts before parallel checks start. This lets
  Next.js/Turbopack finish route and client chunk compilation for both the
  desktop and SmallScreenLayout branches before screenshots are used as
  evidence without multiplying CI load by every simulated surface. The prewarm
  has a default 180s wall-clock budget, a default 30s per-route timeout, and
  aborts repeated metric-evaluation failures. Set
  `REVIEWBOT_RESPONSIVENESS_SKIP_BROWSER_PREWARM=true` only for local harness
  debugging; set `REVIEWBOT_RESPONSIVENESS_PREWARM_CONTEXTS=all` or a
  comma-separated context list only when debugging context-specific compilation.
- transient route retry. After prewarm, a first assertion attempt can still race
  a dev-server route compile. The runner retries only when the first attempt has
  no navigation response, no meaningful content, a blank/near-uniform screenshot,
  and a `page.goto` commit timeout. Persistent blanks still fail. The default
  attempt limit is two and can be tuned with
  `REVIEWBOT_RESPONSIVENESS_ROUTE_RETRY_ATTEMPTS`.
- target app endpoint isolation. The generated Playwright web server ignores
  ambient target-repo `API_ENDPOINT` / `WS_ENDPOINT` values and supplies safe
  remote defaults through `REVIEWBOT_RESPONSIVENESS_API_ENDPOINT`,
  `REVIEWBOT_RESPONSIVENESS_WS_ENDPOINT`, and related namespaced overrides.
  This keeps local development shells that point at `localhost` from hijacking
  responsiveness runs.
- title, URL, viewport meta, body class, navigation/header/main presence, and
  content-readiness diagnostics.
- 6529 profile diagnostics when applicable: native shim/plugin state,
  `body.capacitor-native`, layout-root mobile/narrow/small markers, Electron
  branch detection, bottom navigation visibility, Android keyboard CSS
  variable, open-mobile handoff prompt, and profile-probe failures/warnings.
- a full-page screenshot when possible, otherwise a viewport screenshot with a
  fallback warning, or `screenshot unavailable` when content rendered but both
  capture modes timed out.

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

Use the namespaced `REVIEWBOT_RESPONSIVENESS_*` variables when a local run must
target a non-default API or websocket endpoint. Do not rely on ambient
target-repo `API_ENDPOINT` values:

```bash
REVIEWBOT_RESPONSIVENESS_API_ENDPOINT=https://api.6529.io \
REVIEWBOT_RESPONSIVENESS_WS_ENDPOINT=wss://ws.6529.io \
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD
```

When a frontend server is already hot locally, reuse it instead of having
Playwright start one:

```bash
npm run responsiveness:run -- \
  --target ../6529seize-frontend \
  --base-ref origin/main \
  --head-ref HEAD \
  --base-url http://localhost:3001 \
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
