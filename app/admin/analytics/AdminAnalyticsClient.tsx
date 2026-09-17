"use client";

import { useEffect, useMemo, useState } from "react";

type PeriodMetrics = {
  views: number;
  unique_visitors: number;
  sessions: number;
  new_visitors?: number;
  returning_visitors?: number;
};

type DailyMetric = {
  date: string;
  views: number;
  unique_visitors: number;
};

type HourlyMetric = {
  hour: number;
  views: number;
  unique_visitors: number;
};

type ForumAnalytics = {
  generated_at: string;
  today: PeriodMetrics;
  last_7_days: PeriodMetrics;
  last_30_days: PeriodMetrics;
  all_time: PeriodMetrics & { first_view: string | null; last_view: string | null };
  daily: DailyMetric[];
  hourly_30d: HourlyMetric[];
};

const tokenKey = "rankfile_admin_analytics_token";

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 || 12;
  return `${display}:00 ${suffix}`;
}

function MetricCard({ title, period }: { title: string; period: PeriodMetrics }) {
  return (
    <article className="card">
      <p className="eyebrow">{title}</p>
      <h2 style={{ marginBottom: "0.35rem" }}>{period.unique_visitors.toLocaleString()}</h2>
      <p style={{ marginTop: 0 }}>unique visitors</p>
      <p className="muted" style={{ marginBottom: 0 }}>
        {period.views.toLocaleString()} page views • {period.sessions.toLocaleString()} sessions
      </p>
    </article>
  );
}

export default function AdminAnalyticsClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [analytics, setAnalytics] = useState<ForumAnalytics | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const busiestHours = useMemo(() => {
    return [...(analytics?.hourly_30d || [])]
      .filter((row) => row.views > 0)
      .sort((a, b) => b.views - a.views || b.unique_visitors - a.unique_visitors)
      .slice(0, 6);
  }, [analytics]);

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem(tokenKey);
    if (!savedToken) return;
    setToken(savedToken);
    loadAnalytics(savedToken).catch(() => null);
  }, []);

  async function loadAnalytics(accessToken = token) {
    if (!accessToken) return;
    setLoading(true);
    setStatus("Loading analytics...");
    try {
      const response = await fetch("/api/admin/forum-analytics", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem(tokenKey);
          setToken("");
          setAnalytics(null);
          throw new Error("Your admin session expired. Sign in again.");
        }
        throw new Error(data.error || "Could not load analytics.");
      }
      setAnalytics(data.analytics || null);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Signing in...");

    try {
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase public environment variables are not configured.");
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error_description || data.msg || "Could not sign in.");
      if (!data.access_token) throw new Error("Signed in, but no access token was returned.");

      window.sessionStorage.setItem(tokenKey, data.access_token);
      setToken(data.access_token);
      setPassword("");
      await loadAnalytics(data.access_token);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign in.");
    }
  }

  function signOut() {
    window.sessionStorage.removeItem(tokenKey);
    setToken("");
    setAnalytics(null);
    setStatus("");
  }

  if (!token) {
    return (
      <section className="panel" style={{ maxWidth: 520 }}>
        <p className="eyebrow">Admin Access</p>
        <h2>Forum Analytics</h2>
        <p className="muted">Sign in with the same admin account used for the moderation console.</p>
        <form onSubmit={signIn}>
          <div className="field">
            <label htmlFor="analytics-admin-email">Email</label>
            <input
              id="analytics-admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="analytics-admin-password">Password</label>
            <input
              id="analytics-admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="btn primary" type="submit">Sign In</button>
          {status ? <p className="muted" role="status">{status}</p> : null}
        </form>
      </section>
    );
  }

  return (
    <div>
      <div className="admin-head">
        <div>
          <p className="eyebrow">Forum</p>
          <h2>Visitor Analytics</h2>
          <p className="muted">Anonymous traffic counts for the public forum. Times use Central Time.</p>
        </div>
        <div className="button-row">
          <button className="btn" type="button" disabled={loading} onClick={() => loadAnalytics()}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn" type="button" onClick={signOut}>Sign Out</button>
        </div>
      </div>

      {status ? <div className="panel muted" role="status">{status}</div> : null}

      {analytics ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <MetricCard title="Today" period={analytics.today} />
            <MetricCard title="Last 7 Days" period={analytics.last_7_days} />
            <MetricCard title="Last 30 Days" period={analytics.last_30_days} />
            <MetricCard title="All Time" period={analytics.all_time} />
          </div>

          <section className="panel" style={{ marginBottom: "1rem" }}>
            <div className="admin-head">
              <div>
                <p className="eyebrow">Last 30 Days</p>
                <h2>New vs. Returning</h2>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "1rem" }}>
              <div>
                <strong style={{ fontSize: "1.8rem" }}>{(analytics.last_30_days.new_visitors || 0).toLocaleString()}</strong>
                <p className="muted">new visitors</p>
              </div>
              <div>
                <strong style={{ fontSize: "1.8rem" }}>{(analytics.last_30_days.returning_visitors || 0).toLocaleString()}</strong>
                <p className="muted">returning visitors</p>
              </div>
            </div>
          </section>

          <section className="panel" style={{ marginBottom: "1rem" }}>
            <div className="admin-head">
              <div>
                <p className="eyebrow">Daily Trend</p>
                <h2>Last 14 Days</h2>
              </div>
            </div>
            <div style={{ display: "grid", gap: "0.65rem" }}>
              {analytics.daily.map((row) => (
                <div key={row.date} style={{ display: "grid", gridTemplateColumns: "95px 1fr auto", gap: "0.8rem", alignItems: "center" }}>
                  <span>{new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  <progress value={row.views} max={Math.max(1, ...analytics.daily.map((item) => item.views))} style={{ width: "100%" }} />
                  <span className="muted">{row.views} views / {row.unique_visitors} unique</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="admin-head">
              <div>
                <p className="eyebrow">Last 30 Days</p>
                <h2>Busiest Times</h2>
              </div>
            </div>
            {busiestHours.length ? (
              <div className="feed">
                {busiestHours.map((row) => (
                  <article className="card" key={row.hour}>
                    <strong>{formatHour(row.hour)}</strong>
                    <p className="muted" style={{ marginBottom: 0 }}>
                      {row.views.toLocaleString()} views • {row.unique_visitors.toLocaleString()} unique visitors
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No tracked forum traffic yet.</p>
            )}
          </section>

          <p className="muted" style={{ marginTop: "1rem" }}>
            Tracking is first-party and anonymous: no names, raw IP addresses, locations, referrers, or user-agent strings are stored. A random browser ID is used only to estimate unique and returning visitors. Counts begin when this feature was enabled; earlier Vercel request logs are not backfilled.
          </p>
        </>
      ) : null}
    </div>
  );
}
