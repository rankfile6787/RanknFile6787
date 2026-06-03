"use client";

import { useEffect, useState } from "react";

type PreferenceKey = "forum_posts" | "forum_replies" | "incentive_updates" | "new_flyers" | "new_resources";

const preferenceOptions: Array<{ key: PreferenceKey; label: string }> = [
  { key: "forum_posts", label: "Forum posts" },
  { key: "forum_replies", label: "Forum replies" },
  { key: "incentive_updates", label: "Incentive updates" },
  { key: "new_flyers", label: "New flyers" },
  { key: "new_resources", label: "New resources" },
];

const defaultPreferences: Record<PreferenceKey, boolean> = {
  forum_posts: true,
  forum_replies: true,
  incentive_updates: true,
  new_flyers: true,
  new_resources: false,
};

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function supportsPush() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export default function NotificationSettingsCard() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState("");
  const [preferences, setPreferences] = useState(defaultPreferences);

  useEffect(() => {
    setSupported(supportsPush());

    const saved = localStorage.getItem("rank-file-notification-preferences");
    if (saved) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(saved) });
      } catch {
        localStorage.removeItem("rank-file-notification-preferences");
      }
    }

    if (supportsPush()) {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => null);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("rank-file-notification-preferences", JSON.stringify(preferences));
  }, [preferences]);

  async function saveSubscription(subscription: PushSubscription, nextPreferences = preferences) {
    const response = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, preferences: nextPreferences }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Could not save notification settings.");
    }
  }

  async function enableNotifications() {
    if (!supported) {
      setStatus("This browser does not support web push notifications.");
      return;
    }

    setStatus("Requesting permission...");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("Notifications were not enabled.");
      return;
    }

    const [{ publicKey }, registration] = await Promise.all([
      fetch("/api/push/vapid-public-key").then((response) => response.json()),
      navigator.serviceWorker.ready,
    ]);

    if (!publicKey) {
      setStatus("Notification keys are not configured yet.");
      return;
    }

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    await saveSubscription(subscription);
    setSubscribed(true);
    setStatus("Notifications enabled.");
  }

  async function disableNotifications() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      setSubscribed(false);
      setStatus("Notifications are already off.");
      return;
    }

    await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => null);
    await subscription.unsubscribe();
    setSubscribed(false);
    setStatus("Notifications disabled.");
  }

  async function updatePreference(key: PreferenceKey, value: boolean) {
    const nextPreferences = { ...preferences, [key]: value };
    setPreferences(nextPreferences);

    if (!subscribed) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await saveSubscription(subscription, nextPreferences);
    setStatus("Notification preferences saved.");
  }

  return (
    <section className="notification-card">
      <div>
        <p className="eyebrow">Notifications</p>
        <h2>Get Rank & File Updates</h2>
        <p className="muted">
          Choose alerts for approved forum activity, incentive updates, new flyers, and resources.
        </p>
      </div>

      <div className="notification-options">
        {preferenceOptions.map((option) => (
          <label key={option.key}>
            <input
              type="checkbox"
              checked={preferences[option.key]}
              onChange={(event) => updatePreference(option.key, event.target.checked)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <div className="button-row">
        <button className="btn primary" type="button" onClick={enableNotifications}>
          {subscribed ? "Update Notifications" : "Enable Notifications"}
        </button>
        {subscribed ? (
          <button className="btn" type="button" onClick={disableNotifications}>
            Disable
          </button>
        ) : null}
      </div>

      {!supported ? <p className="install-help">Install the site app or use a supported mobile browser for alerts.</p> : null}
      {status ? <p className="install-help">{status}</p> : null}
    </section>
  );
}
