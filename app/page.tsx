import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header className="hero">
        <img src="/solidarity.jpg" alt="Solidarity banner" />
        <div className="hero-content">
          <p className="eyebrow">Union Solidarity • Independent Information • Free Speech</p>
          <h1>Rank & File 6787</h1>
          <p className="lead">
            A member-run space for discussion, resources, workplace information, and rank-and-file voice.
          </p>
        </div>
      </header>

      <main className="container">
        <section className="grid">
          <article className="panel">
            <h2>Forum</h2>
            <p className="muted">Anonymous posts and replies with moderation before publication.</p>
            <Link className="btn primary" href="/forum">
              Open Forum
            </Link>
          </article>
          <article className="panel">
            <h2>Incentive</h2>
            <p className="muted">Production bonus data will move from static JSON into Supabase.</p>
            <Link className="btn" href="/production-bonus">
              View Incentive
            </Link>
          </article>
        </section>
      </main>
    </>
  );
}
