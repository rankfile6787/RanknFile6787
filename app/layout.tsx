import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rank & File 6787",
  description: "Independent member information, discussion, and rank-and-file resources.",
};

const navItems = [
  ["Home", "/"],
  ["Forum", "/forum"],
  ["Resources", "/resources"],
  ["Election", "/election"],
  ["Union Leaflets", "/union-leaflets"],
  ["Incentive", "/production-bonus"],
  ["Pay Calculator", "/paycalc"],
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") || "";
  const hideNav = pathname.startsWith("/paycalc");

  return (
    <html lang="en">
      <body>
        {!hideNav ? (
          <nav className="site-nav">
            <Link className="brand" href="/">
              Rank & File 6787
            </Link>
            <div className="nav-links">
              {navItems.map(([label, href]) => (
                <Link href={href} key={href}>
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
