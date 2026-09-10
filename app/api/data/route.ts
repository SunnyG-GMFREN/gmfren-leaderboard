import { NextResponse } from "next/server";
import { getLatest, getHistory } from "@/lib/data-source";

export const dynamic = "force-dynamic";

export async function GET() {
  const [latest, history] = await Promise.all([getLatest(), getHistory()]);
  return NextResponse.json({ latest, history });
}
