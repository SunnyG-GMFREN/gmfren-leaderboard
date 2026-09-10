"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  ArrowUpDown,
  Heart,
  Repeat2,
  MessageCircle,
  Trophy,
  Search,
  Wallet,
  Clock,
} from "lucide-react";
import Logo from "./Logo";
import type { LatestData, HistoryData, LeaderboardEntry } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

type SortKey = "rank" | "likes" | "reposts" | "replies" | "score";

const LINE_COLORS = [
  "#FFC93C",
  "#5EE6C8",
  "#FF8FAB",
  "#8AB4FF",
  "#C9A2FF",
  "#7CD87C",
];

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function Dashboard({
  latest,
  history,
}: {
  latest: LatestData;
  history: HistoryData;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(
    latest.leaderboard.slice(0, 3).map((u) => u.user_id)
  );

  const rows = useMemo(() => {
    const filtered = latest.leaderboard.filter(
      (u) =>
        u.username.toLowerCase().includes(query.toLowerCase()) ||
        u.name.toLowerCase().includes(query.toLowerCase())
    );
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      return (a[sortKey] - b[sortKey]) * dir;
    });
    return sorted;
  }, [latest.leaderboard, sortKey, sortDir, query]);

  const totals = latest.leaderboard.reduce(
    (acc, u) => {
      acc.likes += u.likes;
      acc.reposts += u.reposts;
      acc.replies += u.replies;
      acc.score += u.score;
      return acc;
    },
    { likes: 0, reposts: 0, replies: 0, score: 0 }
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  }

  const chartData = useMemo(() => {
    const dates = history.daily.map((d) => d.date);
    const datasets = selected.map((id, i) => {
      const series = history.per_user_daily[id] || [];
      const map = new Map(series.map((p) => [p.date, p.score]));
      const meta = history.per_user_meta[id];
      return {
        label: meta ? `@${meta.username}` : id,
        data: dates.map((d) => map.get(d) ?? 0),
        borderColor: LINE_COLORS[i % LINE_COLORS.length],
        backgroundColor: LINE_COLORS[i % LINE_COLORS.length] + "22",
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2,
        fill: false,
      };
    });
    return {
      labels: dates.map((d) =>
        new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
      ),
      datasets,
    };
  }, [history, selected]);

  const spendPct = Math.min(
    100,
    Math.round(
      (latest.estimated_month_spend_usd / Math.max(latest.budget_month_usd, 0.01)) * 100
    )
  );

  if (!latest.leaderboard.length) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-10 md:py-14">
        <div className="flex items-center gap-3 mb-10">
          <Logo size={40} />
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-sun leading-tight">
              GMFREN Leaderboard
            </h1>
            <p className="text-mist text-sm">Top engagers on @gmfrenmeme</p>
          </div>
        </div>
        <div className="bg-ink-card border border-line rounded-xl2 p-10 text-center rise">
          <Clock size={28} className="mx-auto text-sun mb-3" />
          <h2 className="font-display text-lg text-sun-soft mb-2">Collecting first data run…</h2>
          <p className="text-mist text-sm max-w-md mx-auto">
            The hourly collector hasn&apos;t published a leaderboard yet. Once the X API keys are
            added and the first run completes, the top 50 engagers will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-10 md:py-14">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8 rise">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="font-display text-2xl md:text-3xl text-sun leading-tight">
              GMFREN Leaderboard
            </h1>
            <p className="text-mist text-sm">
              Top engagers on{" "}
              <a
                href="https://x.com/gmfrenmeme"
                target="_blank"
                className="text-sun-soft underline underline-offset-2"
              >
                @gmfrenmeme
              </a>{" "}
              · last {latest.window_days} days
            </p>
          </div>
        </div>
        <a
          href="https://gmfren.xyz"
          className="hidden md:inline-flex items-center gap-1.5 text-sm border border-line rounded-full px-4 py-2 text-mist hover:text-sun hover:border-sun/50 transition"
          data-testid="link-main-site"
        >
          ← gmfren.xyz
        </a>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KpiCard
          icon={<Trophy size={16} />}
          label="Tracked posts"
          value={String(latest.tracked_posts)}
        />
        <KpiCard
          icon={<Heart size={16} />}
          label="Total actions"
          value={(totals.likes + totals.reposts + totals.replies).toLocaleString()}
        />
        <KpiCard
          icon={<Wallet size={16} />}
          label="API spend (mo.)"
          value={`$${latest.estimated_month_spend_usd.toFixed(2)} / $${latest.budget_month_usd.toFixed(0)}`}
          sub={`${spendPct}% of budget`}
        />
        <KpiCard
          icon={<Clock size={16} />}
          label="Updated"
          value={timeAgo(latest.generated_at)}
          sub={latest.last_full_sweep ? `Full sweep ${timeAgo(latest.last_full_sweep)}` : undefined}
        />
      </div>

      {/* Trend chart */}
      <div className="bg-ink-card border border-line rounded-xl2 p-5 mb-8 rise">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg text-sun-soft">30-Day Engagement Trend</h2>
          <span className="text-xs text-mist">Click rows below to compare (max 6)</span>
        </div>
        <div className="h-64">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: {
                  labels: { color: "#8b9ab3", boxWidth: 10, boxHeight: 10 },
                },
                tooltip: { backgroundColor: "#141f34", borderColor: "#22304a", borderWidth: 1 },
              },
              scales: {
                x: { ticks: { color: "#8b9ab3" }, grid: { color: "#1b2740" } },
                y: {
                  ticks: { color: "#8b9ab3" },
                  grid: { color: "#1b2740" },
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
        <p className="text-xs text-mist mt-3 leading-relaxed">
          Reply activity is reconstructed for the full 30-day window from reply timestamps.
          The X API does not expose timestamps for likes or reposts, so like/repost trend
          points accumulate from the day this dashboard started collecting data forward —
          older days show replies only.
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-3 rise">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by handle or name…"
            data-testid="input-search"
            className="w-full bg-ink-raised border border-line rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:border-sun/60 placeholder:text-mist"
          />
        </div>
        <span className="text-xs text-mist whitespace-nowrap">
          {rows.length} of {latest.leaderboard.length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-ink-card border border-line rounded-xl2 overflow-hidden rise">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-mist border-b border-line bg-ink-raised">
                <Th label="#" />
                <Th label="User" />
                <SortTh label="Likes" active={sortKey === "likes"} dir={sortDir} onClick={() => toggleSort("likes")} icon={<Heart size={13} />} />
                <SortTh label="Reposts" active={sortKey === "reposts"} dir={sortDir} onClick={() => toggleSort("reposts")} icon={<Repeat2 size={13} />} />
                <SortTh label="Replies" active={sortKey === "replies"} dir={sortDir} onClick={() => toggleSort("replies")} icon={<MessageCircle size={13} />} />
                <SortTh label="Score" active={sortKey === "score"} dir={sortDir} onClick={() => toggleSort("score")} icon={<Trophy size={13} />} />
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((u) => (
                <Row
                  key={u.user_id}
                  u={u}
                  selected={selected.includes(u.user_id)}
                  onToggle={() => toggleSelected(u.user_id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-mist mt-6 text-center">
        Score = likes × {latest.weights.like} + reposts × {latest.weights.repost} + replies × {latest.weights.reply}.
        Data via the official X API v2 (liking_users, retweeted_by, mentions) — read-only, no scraping.
      </p>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-ink-card border border-line rounded-xl2 p-4">
      <div className="flex items-center gap-1.5 text-mist text-xs mb-1.5">
        {icon}
        {label}
      </div>
      <div className="font-display text-lg text-[#eef2fb] tabular">{value}</div>
      {sub && <div className="text-xs text-mist mt-0.5">{sub}</div>}
    </div>
  );
}

function Th({ label }: { label: string }) {
  return <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">{label}</th>;
}

function SortTh({
  label,
  active,
  dir,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">
      <button
        onClick={onClick}
        data-testid={`sort-${label.toLowerCase()}`}
        className={`flex items-center gap-1 hover:text-sun transition ${active ? "text-sun" : ""}`}
      >
        {icon}
        {label}
        <ArrowUpDown size={11} className={active ? (dir === "asc" ? "rotate-180" : "") : "opacity-40"} />
      </button>
    </th>
  );
}

function Row({
  u,
  selected,
  onToggle,
}: {
  u: LeaderboardEntry;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <tr
      onClick={onToggle}
      data-testid={`row-user-${u.user_id}`}
      className={`border-b border-line/60 last:border-0 cursor-pointer transition hover:bg-ink-raised ${
        selected ? "bg-sun/5" : ""
      }`}
    >
      <td className="px-4 py-2.5 text-mist tabular">{u.rank}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <img
            src={u.profile_image_url || "/avatar-fallback.svg"}
            alt=""
            width={28}
            height={28}
            className="rounded-full bg-ink-raised border border-line"
          />
          <div className="min-w-0">
            <div className="font-medium text-[#eef2fb] truncate max-w-[160px]">{u.name}</div>
            <a
              href={`https://x.com/${u.username}`}
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-mist hover:text-sun-soft"
            >
              @{u.username}
            </a>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5 tabular">{u.likes}</td>
      <td className="px-4 py-2.5 tabular">{u.reposts}</td>
      <td className="px-4 py-2.5 tabular">{u.replies}</td>
      <td className="px-4 py-2.5 tabular font-semibold text-sun">{u.score}</td>
    </tr>
  );
}
