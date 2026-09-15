"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ForumComment } from "@/lib/types";

const categories = ["general", "news", "questions"] as const;

export default function ForumClient() {
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [status, setStatus] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyStatus, setReplyStatus] = useState("");
  const [replyConfirmation, setReplyConfirmation] = useState<string | null>(null);
  const replyEditor = useRef<HTMLTextAreaElement>(null);
  const postImage = useRef<HTMLInputElement>(null);
  const replyImage = useRef<HTMLInputElement>(null);
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

  function openReply(commentId: string) {
    setReplyTo(commentId);
    setReplyStatus("");
    setReplyConfirmation(null);
    setReplyForm({ display_name: "", comment: "", website: "" });
  }

  useEffect(() => {
    if (replyTo) replyEditor.current?.focus();
  }, [replyTo]);

  function submission(form: { display_name: string; comment: string; website: string }, category: string, parentId: string | null, image: File | undefined) {
    const data = new FormData();
    data.set("display_name", form.display_name);
    data.set("comment", form.comment);
    data.set("website", form.website);
    data.set("category", category);
    if (parentId) data.set("parent_id", parentId);
    if (image) data.set("image", image);
    return data;
  }

  async function submitPost(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Sending...");

    const response = await fetch("/api/comments", {
      method: "POST",
      body: submission(postForm, postForm.category, null, postImage.current?.files?.[0]),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error || "Could not submit post.");
      return;
    }

    setPostForm({ display_name: "", category: "general", comment: "", website: "" });
    if (postImage.current) postImage.current.value = "";
    setStatus("Submitted for approval.");
  }

  async function submitReply(event: React.FormEvent, parent: ForumComment) {
    event.preventDefault();
    setReplyStatus("Sending reply...");

    const response = await fetch("/api/comments", {
      method: "POST",
      body: submission(replyForm, parent.category, parent.id, replyImage.current?.files?.[0]),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setReplyStatus(data.error || "Could not submit reply.");
      return;
    }

    setReplyForm({ display_name: "", comment: "", website: "" });
    if (replyImage.current) replyImage.current.value = "";
    setReplyTo(null);
    setReplyStatus("");
    setReplyConfirmation(parent.id);
  }

  function renderComment(comment: ForumComment, isRoot = false): React.ReactNode {
    const children = childrenFor(comment.id);
    const content = (
      <>
        <div className="post-meta">
          <strong>{comment.display_name}</strong>
          <span>{new Date(comment.created_at).toLocaleString()}</span>
          {isRoot ? <span className="badge">{comment.category}</span> : null}
        </div>
        {comment.body ? <p>{comment.body}</p> : null}
        {comment.image_url ? <img className="forum-image" src={comment.image_url} alt={`Image posted by ${comment.display_name}`} loading="lazy" /> : null}
        <button className="reply-button" type="button" onClick={() => openReply(comment.id)}>
          Reply
        </button>
        {replyConfirmation === comment.id ? <p className="muted" role="status">Reply submitted for approval.</p> : null}

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
              ref={replyEditor}
              aria-label="Reply"
              maxLength={3000}
              value={replyForm.comment}
              onChange={(event) => setReplyForm({ ...replyForm, comment: event.target.value })}
              placeholder={`Reply to ${comment.display_name}...`}
            />
            <label className="image-picker">Upload picture optional
              <input ref={replyImage} name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
            </label>
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
              {replyStatus ? <p className="muted" role="status">{replyStatus}</p> : null}
              <button className="btn" type="button" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
              <button className="btn primary" type="submit">
                Reply
              </button>
            </div>
          </form>
        ) : null}

        {children.map((reply) => renderComment(reply))}
      </>
    );

    return isRoot ? (
      <article className="card forum-post" key={comment.id}>
        {content}
      </article>
    ) : (
      <div className="reply-card" key={comment.id}>
        {content}
      </div>
    );
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
            maxLength={3000}
            value={postForm.comment}
            onChange={(event) => setPostForm({ ...postForm, comment: event.target.value })}
            placeholder="Write a post..."
          />
          <label className="image-picker">Upload picture optional
            <input ref={postImage} name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
          </label>
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
          {roots.map((comment) => renderComment(comment, true))}
          {!roots.length ? <div className="panel muted">No approved posts found.</div> : null}
        </div>
      </section>
    </div>
  );
}
