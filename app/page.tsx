import Dashboard from "@/components/Dashboard";
import { getLatest, getHistory } from "@/lib/data-source";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [latest, history] = await Promise.all([getLatest(), getHistory()]);
  return <Dashboard latest={latest} history={history} />;
}
