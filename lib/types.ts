export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  username: string;
  name: string;
  profile_image_url?: string;
  likes: number;
  reposts: number;
  replies: number;
  score: number;
};

export type LatestData = {
  generated_at: string;
  account: string;
  window_days: number;
  weights: { like: number; repost: number; reply: number };
  tracked_posts: number;
  last_full_sweep: string | null;
  estimated_month_spend_usd: number;
  budget_month_usd: number;
  leaderboard: LeaderboardEntry[];
};

export type DailyPoint = {
  date: string;
  likes: number;
  reposts: number;
  replies: number;
  score: number;
};

export type HistoryData = {
  daily: DailyPoint[];
  per_user_daily: Record<string, DailyPoint[]>;
  per_user_meta: Record<string, { username: string; name: string }>;
};
