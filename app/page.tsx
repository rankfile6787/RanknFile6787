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
        <section className="home-grid">
          <article className="panel home-card">
            <h2>Forum</h2>
            <p className="muted">Anonymous posts and replies with moderation before publication.</p>
            <Link className="btn primary" href="/forum">
              Open Forum
            </Link>
          </article>
          <article className="panel home-card">
            <h2>Resources</h2>
            <p className="muted">Agreements, bylaws, forms, and other member resources.</p>
            <Link className="btn" href="/resources">
              Open Resources
            </Link>
          </article>
          <article className="panel home-card">
            <h2>Election</h2>
            <p className="muted">Candidate information and election materials for members.</p>
            <Link className="btn" href="/election">
              Open Election
            </Link>
          </article>
          <article className="panel home-card">
            <h2>Union Leaflets</h2>
            <p className="muted">Meeting notices, event flyers, and union communications.</p>
            <Link className="btn" href="/union-leaflets">
              Open Leaflets
            </Link>
          </article>
          <article className="panel home-card">
            <h2>Incentive</h2>
            <p className="muted">Production bonus data will move from static JSON into Supabase.</p>
            <Link className="btn" href="/production-bonus">
              View Incentive
            </Link>
          </article>
          <article className="panel home-card">
            <h2>Pay Calculator</h2>
            <p className="muted">Estimate pay details with the member pay calculator.</p>
            <Link className="btn" href="/paycalc">
              Open Calculator
            </Link>
          </article>
        </section>
      </main>
    </>
  );
}
