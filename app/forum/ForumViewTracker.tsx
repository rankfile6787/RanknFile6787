"use client";

import { useEffect } from "react";

const visitorKey = "rankfile_forum_visitor_id";
const sessionKey = "rankfile_forum_session_id";

function makeId() {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  if (browserCrypto) {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function storedId(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = makeId();
  storage.setItem(key, created);
  return created;
}

export default function ForumViewTracker() {
  useEffect(() => {
    try {
      const visitorId = storedId(window.localStorage, visitorKey);
      const sessionId = storedId(window.sessionStorage, sessionKey);
      const eventId = `${sessionId}_${Math.round(performance.timeOrigin)}`;

      fetch("/api/analytics/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          visitor_id: visitorId,
          session_id: sessionId,
        }),
        keepalive: true,
      }).catch(() => null);
    } catch {
      // Analytics should never interfere with the forum experience.
    }
  }, []);

  return null;
}
