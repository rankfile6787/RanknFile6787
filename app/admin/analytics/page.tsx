import AdminAnalyticsClient from "./AdminAnalyticsClient";

export default function AdminAnalyticsPage() {
  return (
    <>
      <header className="hero">
        <img src="/solidarity.jpg" alt="Solidarity banner" />
        <div className="hero-content">
          <p className="eyebrow">Admin</p>
          <h1>Forum Analytics</h1>
          <p className="lead">See how often members are checking the forum without collecting identifying information.</p>
        </div>
      </header>
      <main className="container">
        <AdminAnalyticsClient />
      </main>
    </>
  );
}
