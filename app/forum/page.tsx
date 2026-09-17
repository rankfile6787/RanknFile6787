import ForumClient from "./ForumClient";
import ForumViewTracker from "./ForumViewTracker";

export default function ForumPage() {
  return (
    <>
      <ForumViewTracker />
      <header className="hero">
        <img src="/solidarity.jpg" alt="Solidarity banner" />
        <div className="hero-content">
          <p className="eyebrow">Independent Member Information Board</p>
          <h1>Forum</h1>
          <p className="lead">Share questions, news, and conversation with fellow members. Posts are reviewed before they appear.</p>
        </div>
      </header>
      <main className="container">
        <ForumClient />
      </main>
    </>
  );
}
