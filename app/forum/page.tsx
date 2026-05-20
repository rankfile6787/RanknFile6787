import ForumClient from "./ForumClient";

export default function ForumPage() {
  return (
    <>
      <header className="hero">
        <img src="/solidarity.jpg" alt="Solidarity banner" />
        <div className="hero-content">
          <p className="eyebrow">Independent Member Information Board</p>
          <h1>Forum</h1>
          <p className="lead">Posts now flow toward Supabase moderation instead of Google Sheets and Apps Script.</p>
        </div>
      </header>
      <main className="container">
        <ForumClient />
      </main>
    </>
  );
}
