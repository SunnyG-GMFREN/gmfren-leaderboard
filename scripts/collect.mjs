#!/usr/bin/env node
/**
 * GMFREN Leaderboard — data collector
 * ------------------------------------
 * READ-ONLY. Only calls GET endpoints on the official X API v2 via
 * OAuth 1.0a user context. Never posts, likes, follows, or DMs.
 *
 * Run modes (set RUN_MODE env var, defaults to "hourly"):
 *   hourly — refresh replies (cheap) for the full 30-day window, and
 *            refresh likers/retweeters only for posts published in the
 *            last RECENT_HOURS hours (default 48h). Keeps hourly cost low.
 *   daily  — same as hourly, plus a full sweep: refresh likers/retweeters
 *            for every tracked post in the 30-day window.
 *
 * A monthly spend cap (BUDGET_MONTH_USD) is enforced using X's own
 * published per-object pricing. If a run would exceed the remaining
 * budget, the priciest, least-recent posts are skipped first — replies
 * are never skipped since they are effectively free (Owned Reads).
 */
import { TwitterApi } from "twitter-api-v2";
import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const DATA_DIR = path.join(ROOT, "data");
const CACHE_DIR = path.join(DATA_DIR, "_cache");
const CACHE_FILE = path.join(CACHE_DIR, "post_engagement.json");
const META_FILE = path.join(DATA_DIR, "meta.json");
const LATEST_FILE = path.join(DATA_DIR, "latest.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

const RUN_MODE = process.env.RUN_MODE || "hourly";
const ACCOUNT_USERNAME = (process.env.X_ACCOUNT_USERNAME || "gmfrenmeme").replace(/^@/, "");
const WINDOW_DAYS = Number(process.env.WINDOW_DAYS || 30);
const RECENT_HOURS = Number(process.env.RECENT_HOURS || 48);
const BUDGET_MONTH_USD = Number(process.env.BUDGET_MONTH_USD || 15);
const TOP_N = Number(process.env.TOP_N || 50);
// Rank participants beyond the top 50 too, but only persist trend history
// for this many, to keep history.json small.
const HISTORY_TRACK_N = Number(process.env.HISTORY_TRACK_N || 100);

const WEIGHTS = { like: 1, repost: 2, reply: 3 };
// Published per-object pricing, see https://docs.x.com/x-api/getting-started/pricing
const COST = { ownedRead: 0.001, likeRead: 0.001, userRead: 0.01 };

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoUTC(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch {
    return fallback;
  }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required secret: ${name}. See README.md for setup.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const client = new TwitterApi({
    appKey: requireEnv("X_API_KEY"),
    appSecret: requireEnv("X_API_SECRET"),
    accessToken: requireEnv("X_ACCESS_TOKEN"),
    accessSecret: requireEnv("X_ACCESS_TOKEN_SECRET"),
  });
  const v2 = client.v2;

  const meta = await readJson(META_FILE, {
    first_run_date: todayUTC(),
    month: todayUTC().slice(0, 7),
    spend_usd_month: 0,
    cumulative_by_date: {},
  });

  // Reset spend counter on month rollover.
  const curMonth = todayUTC().slice(0, 7);
  if (meta.month !== curMonth) {
    meta.month = curMonth;
    meta.spend_usd_month = 0;
  }

  const cache = await readJson(CACHE_FILE, {});

  console.log(`[collect] mode=${RUN_MODE} account=@${ACCOUNT_USERNAME} budget_left=$${(BUDGET_MONTH_USD - meta.spend_usd_month).toFixed(3)}`);

  // 1. Resolve account user id (cache it — costs one User:Read the first time only).
  let accountId = meta.account_id;
  if (!accountId) {
    const me = await v2.userByUsername(ACCOUNT_USERNAME);
    accountId = me.data.id;
    meta.account_id = accountId;
    meta.spend_usd_month += COST.userRead;
  }

  // 2. Fetch own posts from the tracking window (Owned Read — cheap).
  const startTime = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
  const posts = [];
  let ownedReadCount = 0;
  const timeline = await v2.userTimeline(accountId, {
    exclude: ["retweets"],
    start_time: startTime,
    max_results: 100,
    "tweet.fields": ["created_at", "public_metrics"],
  });
  for await (const tweet of timeline) {
    posts.push(tweet);
    ownedReadCount++;
    if (ownedReadCount >= 500) break; // sanity cap
  }
  meta.spend_usd_month += ownedReadCount * COST.ownedRead;
  console.log(`[collect] tracked posts in window: ${posts.length}`);

  // 3. Fetch replies via mentions (Owned Read — cheap). Always full window.
  const repliesByDate = {}; // date -> { userId: count }
  const userInfo = {}; // userId -> { username, name, profile_image_url }
  const postIds = new Set(posts.map((p) => p.id));
  let mentionReadCount = 0;
  try {
    const mentions = await v2.userMentionTimeline(accountId, {
      start_time: startTime,
      max_results: 100,
      expansions: ["author_id"],
      "tweet.fields": ["created_at", "in_reply_to_user_id", "referenced_tweets", "author_id"],
      "user.fields": ["username", "name", "profile_image_url"],
    });
    for (const u of mentions.includes?.users ?? []) {
      userInfo[u.id] = { username: u.username, name: u.name, profile_image_url: u.profileImageUrl || u.profile_image_url };
    }
    for await (const tweet of mentions) {
      mentionReadCount++;
      const authorId = tweet.author_id;
      if (!authorId || authorId === accountId) continue;
      const isReplyToUs = String(tweet.in_reply_to_user_id || "") === String(accountId);
      const referencesOurPost = (tweet.referenced_tweets || []).some((r) => postIds.has(r.id));
      if (!isReplyToUs && !referencesOurPost) continue;
      const date = (tweet.created_at || "").slice(0, 10);
      if (!date) continue;
      repliesByDate[date] ??= {};
      repliesByDate[date][authorId] = (repliesByDate[date][authorId] || 0) + 1;
      if (mentionReadCount >= 800) break;
    }
  } catch (err) {
    console.warn(`[collect] mentions fetch failed (continuing without replies this run): ${err.message}`);
  }
  meta.spend_usd_month += mentionReadCount * COST.ownedRead;

  // 4. Decide which posts get a likers/retweeters refresh this run.
  const recentCutoff = Date.now() - RECENT_HOURS * 3600000;
  let candidates = posts.filter((p) => new Date(p.created_at).getTime() >= recentCutoff);
  if (RUN_MODE === "daily") {
    candidates = posts; // full sweep
  }
  // Prioritize posts we haven't refreshed in the longest time, then by recency.
  candidates.sort((a, b) => {
    const aStale = new Date(cache[a.id]?.fetched_at || 0).getTime();
    const bStale = new Date(cache[b.id]?.fetched_at || 0).getTime();
    return aStale - bStale;
  });

  const remainingBudget = BUDGET_MONTH_USD - meta.spend_usd_month;
  let budgetLeft = Math.max(remainingBudget, 0);
  const toFetch = [];
  let skipped = 0;
  for (const p of candidates) {
    const m = p.public_metrics || {};
    const estCost = (m.like_count || 0) * COST.likeRead + (m.retweet_count || 0) * COST.userRead;
    if (estCost <= budgetLeft) {
      toFetch.push(p);
      budgetLeft -= estCost;
    } else {
      skipped++;
    }
  }
  if (skipped) {
    console.warn(`[collect] budget guard: skipped likers/retweeters refresh for ${skipped} post(s) this run.`);
  }

  // 5. Fetch likers + retweeters for the selected posts, replacing cache entries.
  for (const p of toFetch) {
    cache[p.id] ??= {};
    cache[p.id].published_at = p.created_at;
    try {
      const likers = [];
      const likingUsers = await v2.tweetLikedBy(p.id, {
        max_results: 100,
        "user.fields": ["username", "name", "profile_image_url"],
      });
      for await (const u of likingUsers) {
        likers.push(u.id);
        userInfo[u.id] = { username: u.username, name: u.name, profile_image_url: u.profileImageUrl || u.profile_image_url };
      }
      cache[p.id].likers = likers;
      meta.spend_usd_month += likers.length * COST.likeRead;
    } catch (err) {
      console.warn(`[collect] liking_users failed for ${p.id}: ${err.message}`);
    }
    try {
      const retweeters = [];
      const retweetedBy = await v2.tweetRetweetedBy(p.id, {
        max_results: 100,
        "user.fields": ["username", "name", "profile_image_url"],
      });
      for await (const u of retweetedBy) {
        retweeters.push(u.id);
        userInfo[u.id] = { username: u.username, name: u.name, profile_image_url: u.profileImageUrl || u.profile_image_url };
      }
      cache[p.id].retweeters = retweeters;
      meta.spend_usd_month += retweeters.length * COST.userRead;
    } catch (err) {
      console.warn(`[collect] retweeted_by failed for ${p.id}: ${err.message}`);
    }
    cache[p.id].fetched_at = new Date().toISOString();
  }

  // Drop cache entries for posts that fell out of the 30-day window.
  for (const id of Object.keys(cache)) {
    if (!postIds.has(id)) delete cache[id];
  }

  // 6. Aggregate totals across all cached posts (today's cumulative snapshot).
  const cumulativeToday = {}; // userId -> { likes, reposts }
  for (const id of Object.keys(cache)) {
    for (const uid of cache[id].likers || []) {
      cumulativeToday[uid] ??= { likes: 0, reposts: 0 };
      cumulativeToday[uid].likes++;
    }
    for (const uid of cache[id].retweeters || []) {
      cumulativeToday[uid] ??= { likes: 0, reposts: 0 };
      cumulativeToday[uid].reposts++;
    }
  }

  const today = todayUTC();
  meta.cumulative_by_date[today] = cumulativeToday;
  // Prune snapshots outside the tracking window (+1 day buffer for delta calc).
  const cutoffDate = daysAgoUTC(WINDOW_DAYS + 1);
  for (const d of Object.keys(meta.cumulative_by_date)) {
    if (d < cutoffDate) delete meta.cumulative_by_date[d];
  }

  // Total replies per user across the window (for the leaderboard).
  const repliesTotalByUser = {};
  for (const date of Object.keys(repliesByDate)) {
    for (const [uid, count] of Object.entries(repliesByDate[date])) {
      repliesTotalByUser[uid] = (repliesTotalByUser[uid] || 0) + count;
    }
  }

  // 7. Build the leaderboard.
  const allUserIds = new Set([
    ...Object.keys(cumulativeToday),
    ...Object.keys(repliesTotalByUser),
  ]);
  let leaderboard = [...allUserIds].map((uid) => {
    const likes = cumulativeToday[uid]?.likes || 0;
    const reposts = cumulativeToday[uid]?.reposts || 0;
    const replies = repliesTotalByUser[uid] || 0;
    const score = likes * WEIGHTS.like + reposts * WEIGHTS.repost + replies * WEIGHTS.reply;
    const info = userInfo[uid] || {};
    return {
      user_id: uid,
      username: info.username || uid,
      name: info.name || info.username || "Unknown",
      profile_image_url: info.profile_image_url,
      likes,
      reposts,
      replies,
      score,
    };
  });
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, TOP_N).map((u, i) => ({ ...u, rank: i + 1 }));

  const latest = {
    generated_at: new Date().toISOString(),
    account: ACCOUNT_USERNAME,
    window_days: WINDOW_DAYS,
    weights: WEIGHTS,
    tracked_posts: posts.length,
    last_full_sweep: RUN_MODE === "daily" ? new Date().toISOString() : (await readJson(LATEST_FILE, {})).last_full_sweep || null,
    estimated_month_spend_usd: Math.round(meta.spend_usd_month * 1000) / 1000,
    budget_month_usd: BUDGET_MONTH_USD,
    leaderboard,
  };

  // 8. Rebuild 30-day history for the users we're tracking (top HISTORY_TRACK_N).
  const trackedIds = leaderboard.slice(0, HISTORY_TRACK_N).map((u) => u.user_id);
  const dates = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) dates.push(daysAgoUTC(i));

  const perUserDaily = {};
  const perUserMeta = {};
  const dailyTotals = dates.map((d) => ({ date: d, likes: 0, reposts: 0, replies: 0, score: 0 }));

  for (const uid of trackedIds) {
    const entry = leaderboard.find((u) => u.user_id === uid);
    perUserMeta[uid] = { username: entry.username, name: entry.name };
    const series = [];
    let prevLikes = 0;
    let prevReposts = 0;
    let haveBaseline = false;
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      const snap = meta.cumulative_by_date[d]?.[uid];
      let likesDelta = 0;
      let repostsDelta = 0;
      if (snap) {
        likesDelta = haveBaseline ? Math.max(0, snap.likes - prevLikes) : 0;
        repostsDelta = haveBaseline ? Math.max(0, snap.reposts - prevReposts) : 0;
        prevLikes = snap.likes;
        prevReposts = snap.reposts;
        haveBaseline = true;
      }
      const repliesDelta = repliesByDate[d]?.[uid] || 0;
      const score = likesDelta * WEIGHTS.like + repostsDelta * WEIGHTS.repost + repliesDelta * WEIGHTS.reply;
      series.push({ date: d, likes: likesDelta, reposts: repostsDelta, replies: repliesDelta, score });
      dailyTotals[i].likes += likesDelta;
      dailyTotals[i].reposts += repostsDelta;
      dailyTotals[i].replies += repliesDelta;
      dailyTotals[i].score += score;
    }
    perUserDaily[uid] = series;
  }

  const history = { daily: dailyTotals, per_user_daily: perUserDaily, per_user_meta: perUserMeta };

  await writeJson(LATEST_FILE, latest);
  await writeJson(HISTORY_FILE, history);
  await writeJson(CACHE_FILE, cache);
  await writeJson(META_FILE, meta);

  console.log(`[collect] done. leaderboard size=${leaderboard.length} spend_this_month=$${meta.spend_usd_month.toFixed(3)}/$${BUDGET_MONTH_USD}`);
}

main().catch((err) => {
  console.error("[collect] fatal error:", err);
  process.exit(1);
});
