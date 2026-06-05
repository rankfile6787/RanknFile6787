"use client";

import { useState } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState("");

  async function submitContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Sending...");

    const form = event.currentTarget;
    const response = await fetch("/api/contact", {
      method: "POST",
      body: new FormData(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "Could not send your message.");
      return;
    }

    form.reset();
    setStatus("Sent. Thank you for sharing it with the admins.");
  }

  return (
    <form className="panel contact-form" onSubmit={submitContact}>
      <div className="field">
        <label htmlFor="contact-name">Name optional</label>
        <input id="contact-name" name="name" maxLength={120} placeholder="Rank & File" />
      </div>
      <div className="field">
        <label htmlFor="contact-info">Contact info optional</label>
        <input id="contact-info" name="contact" maxLength={180} placeholder="Email or phone if you want a reply" />
      </div>
      <div className="field">
        <label htmlFor="contact-topic">Topic</label>
        <select id="contact-topic" name="topic" defaultValue="other">
          <option value="flyer">Union flyer or information to post</option>
          <option value="suggestion">Site suggestion</option>
          <option value="site-issue">Issue with the site</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="field contact-message">
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          maxLength={3000}
          placeholder="Tell the admins what you want to share, suggest, or report."
        />
      </div>
      <div className="field contact-message">
        <label htmlFor="contact-image">Upload image optional</label>
        <input id="contact-image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
      </div>
      <div className="hp-field" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="composer-actions">
        {status ? <p className="muted">{status}</p> : <span />}
        <button className="btn primary" type="submit">
          Send
        </button>
      </div>
    </form>
  );
}
