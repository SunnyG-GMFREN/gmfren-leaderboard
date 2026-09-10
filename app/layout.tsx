import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GMFREN Leaderboard — Top Engagers",
  description:
    "Ranking @gmfrenmeme's most active followers by likes, reposts, and replies over the last 30 days.",
  openGraph: {
    title: "GMFREN Leaderboard",
    description:
      "Top 50 GMFREN supporters ranked by engagement over the last 30 days.",
    url: "https://leaderboard.gmfren.xyz",
    siteName: "GMFREN Leaderboard",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-body bg-ink text-[#eef2fb] min-h-screen">
        {children}
      </body>
    </html>
  );
}
