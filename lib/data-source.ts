import { promises as fs } from "fs";
import path from "path";
import type { LatestData, HistoryData } from "./types";

// Where the collector script (GitHub Actions) publishes fresh data.
// Set DATA_SOURCE_BASE_URL in Vercel env vars to something like:
//   https://raw.githubusercontent.com/<owner>/<repo>/main/data
// Falls back to the JSON files bundled in the repo so the site never
// breaks before the first collector run.
const REMOTE_BASE = process.env.DATA_SOURCE_BASE_URL;

async function readLocal<T>(file: string): Promise<T> {
  const p = path.join(process.cwd(), "data", file);
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw) as T;
}

async function readRemote<T>(file: string): Promise<T | null> {
  if (!REMOTE_BASE) return null;
  try {
    const res = await fetch(`${REMOTE_BASE}/${file}?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function getLatest(): Promise<LatestData> {
  const remote = await readRemote<LatestData>("latest.json");
  if (remote) return remote;
  return readLocal<LatestData>("latest.json");
}

export async function getHistory(): Promise<HistoryData> {
  const remote = await readRemote<HistoryData>("history.json");
  if (remote) return remote;
  return readLocal<HistoryData>("history.json");
}
