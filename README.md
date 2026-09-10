# GMFREN Leaderboard

Tracks who engages most with [@gmfrenmeme](https://x.com/gmfrenmeme) on X — likes,
reposts, and replies — over a rolling 30-day window, and ranks the top 50 supporters.
Read-only, official X API v2 only. No scraping, no write access.

Live at **https://leaderboard.gmfren.xyz**.

## How it works

- **Collector** (`scripts/collect.mjs`) runs on a GitHub Actions schedule, calls
  `GET /2/tweets/{id}/liking_users`, `GET /2/tweets/{id}/retweeted_by`, and the
  mentions endpoint (for replies), aggregates per-user totals, and commits the
  results to `data/latest.json` and `data/history.json`.
- **Site** (Next.js, deployed on Vercel) reads those JSON files at request time
  and renders the sortable leaderboard + 30-day trend chart.
- **Cost control**: likes/reposts are refreshed hourly only for posts published
  in the last 48h, and fully swept once a day for the whole 30-day window. A
  monthly spend cap (`BUDGET_MONTH_USD`) is enforced — the collector estimates
  cost from each post's public like/retweet counts before fetching, and skips
  the priciest, least-recent posts if a run would exceed the remaining budget.

## One-time setup

### 1. Create X API keys (OAuth 1.0a, user context, as @gmfrenmeme)

1. Sign in to [console.x.com](https://console.x.com) **as the @gmfrenmeme account**
   (Owned Reads pricing only applies when the app authenticates as the account
   whose own posts/mentions it reads).
2. Create a Project + App. Under the app's **User authentication settings**,
   set permissions to **Read** only (never Read+Write).
3. Under the Project's billing page, set a **spending limit** — start at
   $10–15 — before generating any keys, so nothing can run away on you.
4. Generate: **API Key & Secret**, then **Access Token & Secret** (make sure
   you generate the access token *after* setting app permissions to Read).
5. You'll have four values: `API Key`, `API Key Secret`, `Access Token`,
   `Access Token Secret`.

### 2. Add repository secrets

In this repo: **Settings → Secrets and variables → Actions**, add:

| Name | Value |
| --- | --- |
| `X_API_KEY` | from step 1 |
| `X_API_SECRET` | from step 1 |
| `X_ACCESS_TOKEN` | from step 1 |
| `X_ACCESS_TOKEN_SECRET` | from step 1 |

Optional repository **variables** (Settings → Secrets and variables → Actions → Variables tab):

| Name | Default | Purpose |
| --- | --- | --- |
| `X_ACCOUNT_USERNAME` | `gmfrenmeme` | account to track |
| `BUDGET_MONTH_USD` | `15` | hard monthly spend cap in USD |

### 3. First run

Go to **Actions → Collect GMFREN engagement data → Run workflow** and pick
`daily` for the first manual run (does a full sweep so the leaderboard isn't
empty). After that, the hourly + daily schedules in
`.github/workflows/collect.yml` take over automatically.

### 4. Vercel

The Next.js app reads `DATA_SOURCE_BASE_URL` (a Vercel env var) pointing at
this repo's raw data folder, e.g.
`https://raw.githubusercontent.com/<owner>/<repo>/main/data`. Falls back to
the bundled JSON files in `data/` if unset, so the site never 500s.

## Data notes & limitations

- The X API does not expose *when* a like or repost happened — only who did
  it, as of now. So the 30-day trend line for likes/reposts accumulates
  starting from the day this collector first ran, not retroactively.
- Replies **are** timestamped, so the reply portion of the trend is accurate
  for the full 30-day window from day one.
- Score = `likes × 1 + reposts × 2 + replies × 3`. Adjust `WEIGHTS` in
  `scripts/collect.mjs` if you want different weighting.
