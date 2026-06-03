"use client";

import { useEffect, useMemo, useState } from "react";
import type { ForumComment } from "@/lib/types";

const categories = ["general", "news", "questions"] as const;

export default function ForumClient() {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [status, setStatus] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [postForm, setPostForm] = useState({ display_name: "", category: "general", comment: "", website: "" });
  const [replyForm, setReplyForm] = useState({ display_name: "", comment: "", website: "" });

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

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Sending...");

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...postForm, parent_id: null }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "Could not submit post.");
      return;
    }

    setPostForm({ display_name: "", category: "general", comment: "", website: "" });
    setStatus("Submitted for approval.");
  }

  async function submitReply(event: React.FormEvent, parent: ForumComment) {
    event.preventDefault();
    setStatus("Sending reply...");

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...replyForm,
        category: parent.category,
        parent_id: parent.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "Could not submit reply.");
      return;
    }

    setReplyForm({ display_name: "", comment: "", website: "" });
    setReplyTo(null);
    setStatus("Reply submitted for approval.");
  }

  return (
    <div className="forum-shell">
      <section className="panel forum-composer">
        <form onSubmit={submitPost}>
          <div className="composer-row">
            <input
              aria-label="Name optional"
              value={postForm.display_name}
              maxLength={80}
              onChange={(event) => setPostForm({ ...postForm, display_name: event.target.value })}
              placeholder="Rank & File"
            />
            <select
              aria-label="Category"
              value={postForm.category}
              onChange={(event) => setPostForm({ ...postForm, category: event.target.value })}
            >
              {categories.map((category) => (
                <option value={category} key={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <textarea
            aria-label="Post"
            required
            maxLength={3000}
            value={postForm.comment}
            onChange={(event) => setPostForm({ ...postForm, comment: event.target.value })}
            placeholder="Write a post..."
          />
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={postForm.website}
              onChange={(event) => setPostForm({ ...postForm, website: event.target.value })}
            />
          </div>
          <div className="composer-actions">
            {status ? <p className="muted">{status}</p> : <span />}
            <button className="btn primary" type="submit">
              Post
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="button-row forum-filters">
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
            <article className="card forum-post" key={comment.id}>
              <div className="post-meta">
                <strong>{comment.display_name}</strong>
                <span>{new Date(comment.created_at).toLocaleString()}</span>
                <span className="badge">{comment.category}</span>
              </div>
              <p>{comment.body}</p>
              <button
                className="reply-button"
                type="button"
                onClick={() => {
                  setReplyTo(comment.id);
                  setReplyForm({ display_name: "", comment: "", website: "" });
                }}
              >
                Reply
              </button>

              {replyTo === comment.id ? (
                <form className="reply-composer" onSubmit={(event) => submitReply(event, comment)}>
                  <input
                    aria-label="Name optional"
                    value={replyForm.display_name}
                    maxLength={80}
                    onChange={(event) => setReplyForm({ ...replyForm, display_name: event.target.value })}
                    placeholder="Rank & File"
                  />
                  <textarea
                    aria-label="Reply"
                    required
                    maxLength={3000}
                    value={replyForm.comment}
                    onChange={(event) => setReplyForm({ ...replyForm, comment: event.target.value })}
                    placeholder={`Reply to ${comment.display_name}...`}
                  />
                  <div className="hp-field" aria-hidden="true">
                    <label htmlFor={`website-${comment.id}`}>Website</label>
                    <input
                      id={`website-${comment.id}`}
                      tabIndex={-1}
                      autoComplete="off"
                      value={replyForm.website}
                      onChange={(event) => setReplyForm({ ...replyForm, website: event.target.value })}
                    />
                  </div>
                  <div className="composer-actions">
                    <button className="btn" type="button" onClick={() => setReplyTo(null)}>
                      Cancel
                    </button>
                    <button className="btn primary" type="submit">
                      Reply
                    </button>
                  </div>
                </form>
              ) : null}

              {childrenFor(comment.id).map((reply) => (
                <div className="reply-card" key={reply.id}>
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
