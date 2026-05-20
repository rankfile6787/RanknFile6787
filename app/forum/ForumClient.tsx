"use client";

import { useEffect, useMemo, useState } from "react";
import type { ForumComment } from "@/lib/types";

const categories = ["general", "news", "questions"] as const;

export default function ForumClient() {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [status, setStatus] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [form, setForm] = useState({ display_name: "", category: "general", comment: "", website: "" });

  async function loadComments() {
    const response = await fetch("/api/comments", { cache: "no-store" });
    const data = await response.json();
    setComments(data.comments || []);
  }

  useEffect(() => {
    loadComments().catch(() => setStatus("Could not load comments right now."));
  }, []);

  const roots = useMemo(() => {
    return comments
      .filter((comment) => !comment.parent_id)
      .filter((comment) => activeCategory === "all" || comment.category === activeCategory);
  }, [comments, activeCategory]);

  function childrenFor(parentId: string) {
    return comments.filter((comment) => comment.parent_id === parentId);
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Sending...");

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, parent_id: replyTo }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "Could not submit post.");
      return;
    }

    setForm({ display_name: "", category: "general", comment: "", website: "" });
    setReplyTo(null);
    setStatus("Submitted for approval.");
  }

  return (
    <div className="split">
      <aside className="panel">
        <h2>{replyTo ? "Submit Reply" : "Submit Post"}</h2>
        <form onSubmit={submitComment}>
          <div className="field">
            <label htmlFor="display_name">Name optional</label>
            <input
              id="display_name"
              value={form.display_name}
              maxLength={80}
              onChange={(event) => setForm({ ...form, display_name: event.target.value })}
              placeholder="Rank & File"
            />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={form.category}
              disabled={Boolean(replyTo)}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="comment">Comment</label>
            <textarea
              id="comment"
              required
              maxLength={3000}
              value={form.comment}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
            />
          </div>
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => setForm({ ...form, website: event.target.value })}
            />
          </div>
          <div className="button-row">
            <button className="btn primary" type="submit">
              Send
            </button>
            {replyTo ? (
              <button className="btn" type="button" onClick={() => setReplyTo(null)}>
                Cancel Reply
              </button>
            ) : null}
          </div>
          {status ? <p className="muted">{status}</p> : null}
        </form>
      </aside>

      <section>
        <div className="button-row">
          {["all", ...categories].map((category) => (
            <button
              className={category === activeCategory ? "btn primary" : "btn"}
              type="button"
              key={category}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="feed">
          {roots.map((comment) => (
            <article className="card" key={comment.id}>
              <div className="post-meta">
                <strong>{comment.display_name}</strong>
                <span>{new Date(comment.created_at).toLocaleString()}</span>
                <span className="badge">{comment.category}</span>
              </div>
              <p>{comment.body}</p>
              <button className="btn" type="button" onClick={() => setReplyTo(comment.id)}>
                Reply
              </button>
              {childrenFor(comment.id).map((reply) => (
                <div className="card" key={reply.id} style={{ marginTop: 12, marginLeft: 18 }}>
                  <div className="post-meta">
                    <strong>{reply.display_name}</strong>
                    <span>{new Date(reply.created_at).toLocaleString()}</span>
                  </div>
                  <p>{reply.body}</p>
                </div>
              ))}
            </article>
          ))}
          {!roots.length ? <div className="panel muted">No approved posts found.</div> : null}
        </div>
      </section>
    </div>
  );
}
