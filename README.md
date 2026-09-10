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
   whose own posts/mentions it reads). Accept the Developer Agreement if asked.
2. Create a **Project**, then create an **App** inside it (any names are fine).
3. Open the app, find **User authentication settings**, and click **Set up**
   (or **Edit** if it's already configured).
   - **App permissions**: choose **Read only** — never Read+Write, since this
     app only ever needs to look up likers/retweeters/mentions.
   - **Type of App**: pick **Web App, Automated App or Bot**.
   - **Callback URI**: `http://localhost:3000/callback` (unused, but required).
   - **Website URL**: `https://gmfren.xyz` (or anything valid).
   - Click **Save**. A popup shows a **Client ID/Secret** (OAuth 2.0) — you can
     ignore and close that; this project uses OAuth 1.0a instead.
   - **Set permissions to Read only *before* generating tokens** — X bakes the
     permission level into a token at the moment it's issued, so a token made
     earlier won't pick up a later permission change without being regenerated.
4. Go to the app's **Keys and tokens** tab:
   - Under **Consumer Keys** (OAuth 1.0 Keys), click **Regenerate** — copy the
     **API Key** and **API Key Secret** immediately (shown once).
   - Under **Authentication Tokens → Access Token and Secret**, click
     **Generate** — copy the **Access Token** and **Access Token Secret**
     immediately (shown once).
5. You'll have four values: `API Key`, `API Key Secret`, `Access Token`,
   `Access Token Secret`. Store them in a password manager — anyone with these
   can act as the app against your account within its Read-only scope.
6. X API billing is **prepaid credits**, not a monthly plan — go to
   **Credits → Buy credits** in the console and add $10–15 (minimum $5). Since
   it's prepaid, calls simply stop working if you run out, which is itself a
   hard ceiling on spend on top of this project's own `BUDGET_MONTH_USD` cap.

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
