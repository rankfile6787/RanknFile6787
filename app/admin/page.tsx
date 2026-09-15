import AdminClient from "./AdminClient";

export default function AdminPage() {
  return (
    <>
      <header className="hero">
        <img src="/solidarity.jpg" alt="Solidarity banner" />
        <div className="hero-content">
          <p className="eyebrow">Admin</p>
          <h1>Moderation Console</h1>
          <p className="lead">Review posts and replies before they appear in the forum.</p>
        </div>
      </header>
      <main className="container">
        <AdminClient />
      </main>
    </>
  );
}
