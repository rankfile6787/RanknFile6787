import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.rankandfile6787.com"),
  title: "Rank & File 6787",
  description: "Independent member information, discussion, and rank-and-file resources.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Rank & File 6787",
    statusBarStyle: "black-translucent",
  },
  applicationName: "Rank & File 6787",
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#b22222",
  },
};

const navItems = [
  ["Home", "/"],
  ["Forum", "/forum"],
  ["Resources", "/resources"],
  ["Election", "/election"],
  ["Union Leaflets", "/union-leaflets"],
  ["Incentive", "/production-bonus"],
  ["Notifications", "/notifications"],
  ["Pay Calculator", "/paycalc"],
];

const publicSiteOrigin = "https://www.rankandfile6787.com";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") || "";
  const host = requestHeaders.get("host") || "";
  const navOrigin = host.startsWith("admin.") ? publicSiteOrigin : "";
  const hideNav = pathname.startsWith("/paycalc");

  return (
    <html lang="en">
      <body>
        {!hideNav ? (
          <nav className="site-nav">
            <Link className="brand" href={`${navOrigin}/`}>
              Rank & File 6787
            </Link>
            <div className="nav-links">
              {navItems.map(([label, href]) => (
                <Link href={`${navOrigin}${href}`} key={href}>
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
        {children}
      </body>
    </html>
  );
}
