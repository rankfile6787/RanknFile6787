import webpush, { type PushSubscription } from "web-push";
import { createServiceSupabase } from "./supabase";

export type NotificationPreferenceKey =
  | "forum_posts"
  | "forum_replies"
  | "incentive_updates"
  | "new_flyers"
  | "new_resources"
  | "pending_comments";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const defaultNotificationPreferences: NotificationPreferences = {
  forum_posts: true,
  forum_replies: true,
  incentive_updates: true,
  new_flyers: true,
  new_resources: false,
  pending_comments: false,
};

type StoredSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  audience: "public" | "admin";
  preferences: Partial<NotificationPreferences> | null;
};

type NotificationPayload = {
  type: NotificationPreferenceKey;
  title: string;
  body: string;
  url: string;
  audience?: "public" | "admin";
};

function isPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configureWebPush() {
  if (!isPushConfigured()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return true;
}

function toPushSubscription(subscription: StoredSubscription): PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

function isEnabled(subscription: StoredSubscription, type: NotificationPreferenceKey) {
  const preferences = {
    ...defaultNotificationPreferences,
    ...(subscription.preferences || {}),
  };
  return preferences[type] !== false;
}

export function excerpt(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export async function sendPushNotification(payload: NotificationPayload) {
  if (!configureWebPush()) return { sent: 0, failed: 0 };

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, audience, preferences")
    .eq("audience", payload.audience || "public");

  if (error || !data?.length) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  await Promise.all(
    (data as StoredSubscription[])
      .filter((subscription) => isEnabled(subscription, payload.type))
      .map(async (subscription) => {
        try {
          await webpush.sendNotification(
            toPushSubscription(subscription),
            JSON.stringify({
              title: payload.title,
              body: payload.body,
              url: payload.url,
              type: payload.type,
            })
          );
          sent += 1;
        } catch (error) {
          failed += 1;
          const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
          }
        }
      })
  );

  await supabase.from("push_notification_events").insert({
    notification_type: payload.type,
    audience: payload.audience || "public",
    title: payload.title,
    body: payload.body,
    url: payload.url,
    sent_count: sent,
    failed_count: failed,
  });

  return { sent, failed };
}
