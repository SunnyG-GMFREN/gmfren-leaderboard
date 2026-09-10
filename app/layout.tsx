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
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap"
        />
      </head>
      <body className="font-body bg-ink text-[#eef2fb] min-h-screen">
        {children}
      </body>
    </html>
  );
}
