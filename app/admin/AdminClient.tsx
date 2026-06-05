"use client";

import { useEffect, useMemo, useState } from "react";
import type { BonusRow, CommentStatus, ContactSubmission, ElectionMaterial, ForumComment, ManagedDocument } from "@/lib/types";

type AdminSection = "comments" | "contact" | "incentive" | "flyers" | "election" | "resources" | "settings";
type ContactStatus = ContactSubmission["status"];

const commentStatuses: CommentStatus[] = ["pending", "approved", "rejected"];
const contactStatuses: ContactStatus[] = ["new", "reviewed", "archived"];
const adminSections: Array<[AdminSection, string]> = [
  ["comments", "Comments"],
  ["contact", "Contact"],
  ["incentive", "Incentive"],
  ["flyers", "Flyers"],
  ["election", "Election"],
  ["resources", "Resources"],
  ["settings", "Settings"],
];

const positions = [
  "president",
  "vice-president",
  "recording-secretary",
  "financial-secretary",
  "grievance-chairman",
  "treasurer",
  "guide",
  "inner-guard",
  "outer-guard",
  "trustee",
  "zone-1-griever",
  "zone-2-griever",
  "zone-3-griever",
  "zone-4-griever",
  "zone-5-griever",
  "zone-6-griever",
  "zone-7-griever",
];
const materialKinds = ["incumbent", "candidate", "campaign-material"];

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

export default function AdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [status, setStatus] = useState("");
  const [section, setSection] = useState<AdminSection>("comments");
  const [commentStatus, setCommentStatus] = useState<CommentStatus>("pending");
  const [contactStatus, setContactStatus] = useState<ContactStatus>("new");
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [contactSubmissions, setContactSubmissions] = useState<ContactSubmission[]>([]);
  const [bonusRows, setBonusRows] = useState<BonusRow[]>([]);
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [materials, setMaterials] = useState<ElectionMaterial[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [bonusForm, setBonusForm] = useState({
    week_ending: "",
    coke: "",
    primary_area: "",
    hot_roll: "",
    finishing: "",
    plate: "",
    plant_avg: "",
  });

  const visibleComments = useMemo(() => {
    return comments.filter((comment) => comment.status === commentStatus);
  }, [comments, commentStatus]);

  const materialCounts = useMemo(() => {
    return Object.fromEntries(commentStatuses.map((item) => [item, materials.filter((row) => row.status === item).length]));
  }, [materials]);

  const visibleContactSubmissions = useMemo(() => {
    return contactSubmissions.filter((submission) => submission.status === contactStatus);
  }, [contactSubmissions, contactStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const type = params.get("type");
    if (accessToken && type === "recovery") {
      setToken(accessToken);
      setMustChangePassword(true);
      setStatus("Choose a new password to finish the reset.");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Signing in...");

    try {
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase public environment variables are not configured.");
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || data.msg || "Could not sign in.");
      if (!data.access_token) throw new Error("Signed in, but no access token was returned.");

      setToken(data.access_token);
      const needsPasswordChange = Boolean(data.user?.user_metadata?.force_password_change);
      setMustChangePassword(needsPasswordChange);
      setStatus("Signed in.");
      if (!needsPasswordChange) {
        await Promise.all([
          loadComments(data.access_token),
          loadContactSubmissions(data.access_token),
          loadBonusRows(data.access_token),
          loadDocuments("flyers", data.access_token),
          loadElectionMaterials(data.access_token),
        ]);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not sign in.");
    }
  }

  async function authedFetch(path: string, init: RequestInit = {}, accessToken = token) {
    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function requestPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    const targetEmail = (resetEmail || email).trim();
    if (!targetEmail) {
      setStatus("Enter the admin email address first.");
      return;
    }

    setStatus("Sending password reset email...");
    const response = await fetch("/api/admin/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "Could not send password reset email.");
      return;
    }
    setStatus("If that email is an admin account, a reset link has been sent.");
    setShowResetForm(false);
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (!supabaseUrl || !supabaseAnonKey) return;
    setStatus("Updating password...");
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: newPassword,
        data: { force_password_change: false },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error_description || data.msg || data.error || "Could not update password.");
      return;
    }
    setNewPassword("");
    setMustChangePassword(false);
    setStatus("Password updated.");
    await Promise.all([loadComments(), loadContactSubmissions(), loadBonusRows(), loadDocuments("flyers"), loadElectionMaterials()]);
  }

  async function loadComments(accessToken = token) {
    if (!accessToken) return;
    const data = await authedFetch("/api/comments?status=all", {}, accessToken);
    setComments(data.comments || []);
  }

  async function loadBonusRows(accessToken = token) {
    if (!accessToken) return;
    const data = await authedFetch("/api/admin/bonus", {}, accessToken);
    setBonusRows(data.rows || []);
  }

  async function loadContactSubmissions(accessToken = token) {
    if (!accessToken) return;
    const data = await authedFetch("/api/contact?status=all", {}, accessToken);
    setContactSubmissions(data.submissions || []);
  }

  async function loadDocuments(nextSection: "flyers" | "resources", accessToken = token) {
    if (!accessToken) return;
    const data = await authedFetch(`/api/admin/documents?section=${nextSection}&admin=1`, {}, accessToken);
    setDocuments(data.documents || []);
  }

  async function loadElectionMaterials(accessToken = token) {
    if (!accessToken) return;
    const data = await authedFetch("/api/admin/election-materials", {}, accessToken);
    setMaterials(data.materials || []);
  }

  async function moderateComment(id: string, action: "approve" | "reject") {
    setStatus(`${action === "approve" ? "Approving" : "Rejecting"} comment...`);
    await authedFetch("/api/comments/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await loadComments();
    setStatus("Comment updated.");
  }

  async function moderateElection(id: string, action: "approve" | "reject") {
    setStatus(`${action === "approve" ? "Approving" : "Rejecting"} election material...`);
    await authedFetch("/api/admin/election-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await loadElectionMaterials();
    setStatus("Election material updated.");
  }

  async function updateContactSubmission(id: string, nextStatus: ContactStatus) {
    setStatus("Updating contact submission...");
    await authedFetch("/api/contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    await loadContactSubmissions();
    setStatus("Contact submission updated.");
  }

  async function deleteContactSubmission(id: string) {
    setStatus("Deleting contact submission...");
    await authedFetch(`/api/contact?id=${id}`, { method: "DELETE" });
    await loadContactSubmissions();
    setStatus("Contact submission deleted.");
  }

  async function updateElectionMaterial(id: string, formData: FormData) {
    setStatus("Updating election material...");
    await authedFetch("/api/admin/election-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        action: "update",
        candidate_name: formData.get("candidate_name"),
        position: formData.get("position"),
        material_kind: formData.get("material_kind"),
        status: formData.get("status"),
        display_order: formData.get("display_order"),
        summary: formData.get("summary"),
        external_url: formData.get("external_url"),
      }),
    });
    await loadElectionMaterials();
    setStatus("Election material updated.");
  }

  async function saveBonus(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Saving incentive row...");
    await authedFetch("/api/admin/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bonusForm),
    });
    setBonusForm({ week_ending: "", coke: "", primary_area: "", hot_roll: "", finishing: "", plate: "", plant_avg: "" });
    await loadBonusRows();
    setStatus("Incentive row saved.");
  }

  async function saveDocument(event: React.FormEvent<HTMLFormElement>, docSection: "flyers" | "resources") {
    event.preventDefault();
    setStatus(`Saving ${docSection === "flyers" ? "flyer" : "resource"}...`);
    const formData = new FormData(event.currentTarget);
    formData.set("section", docSection);
    await authedFetch("/api/admin/documents", { method: "POST", body: formData });
    event.currentTarget.reset();
    await loadDocuments(docSection);
    setStatus("Saved.");
  }

  async function deleteDocument(id: string, docSection: "flyers" | "resources") {
    setStatus("Deleting...");
    await authedFetch(`/api/admin/documents?id=${id}`, { method: "DELETE" });
    setDeleteConfirmId("");
    await loadDocuments(docSection);
    setStatus("Deleted.");
  }

  function openSection(nextSection: AdminSection) {
    setSection(nextSection);
    if (nextSection === "flyers") loadDocuments("flyers").catch((error) => setStatus(error.message));
    if (nextSection === "resources") loadDocuments("resources").catch((error) => setStatus(error.message));
    if (nextSection === "election") loadElectionMaterials().catch((error) => setStatus(error.message));
    if (nextSection === "incentive") loadBonusRows().catch((error) => setStatus(error.message));
    if (nextSection === "contact") loadContactSubmissions().catch((error) => setStatus(error.message));
  }

  return (
    <div className="admin-shell">
      <aside className="panel admin-sidebar">
        <h2>Admin</h2>
        {!token ? (
          <>
            <form onSubmit={signIn}>
              <div className="field">
                <label htmlFor="admin-email">Email</label>
                <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="admin-password">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <button className="btn primary" type="submit">
                Sign In
              </button>
              <button className="reply-button" type="button" onClick={() => setShowResetForm((value) => !value)}>
                Forgot password?
              </button>
            </form>
            {showResetForm ? (
              <form className="reset-form" onSubmit={requestPasswordReset}>
                <div className="field">
                  <label htmlFor="reset-email">Reset Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    value={resetEmail || email}
                    onChange={(event) => setResetEmail(event.target.value)}
                    required
                  />
                </div>
                <button className="btn" type="submit">
                  Send Reset Link
                </button>
              </form>
            ) : null}
          </>
        ) : mustChangePassword ? (
          <form onSubmit={changePassword}>
            <p className="muted">Set a new password before using the admin tools.</p>
            <div className="field">
              <label htmlFor="new-password">New Password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <button className="btn primary" type="submit">
              Change Password
            </button>
          </form>
        ) : (
          <div className="admin-nav">
            {adminSections.map(([key, label]) => (
              <button className={section === key ? "btn primary" : "btn"} key={key} type="button" onClick={() => openSection(key)}>
                {label}
              </button>
            ))}
          </div>
        )}
        {status ? <p className="muted">{status}</p> : null}
      </aside>

      <section>
        {!token ? <div className="panel muted">Sign in to manage the site.</div> : null}
        {token && mustChangePassword ? <div className="panel muted">Password change required before admin tools unlock.</div> : null}
        {token && !mustChangePassword && section === "comments" ? (
          <CommentModeration
            comments={visibleComments}
            counts={Object.fromEntries(commentStatuses.map((item) => [item, comments.filter((row) => row.status === item).length]))}
            status={commentStatus}
            setStatus={setCommentStatus}
            moderate={moderateComment}
            refresh={loadComments}
          />
        ) : null}
        {token && !mustChangePassword && section === "contact" ? (
          <ContactPanel
            submissions={visibleContactSubmissions}
            counts={Object.fromEntries(contactStatuses.map((item) => [item, contactSubmissions.filter((row) => row.status === item).length]))}
            status={contactStatus}
            setStatus={(nextStatus) => {
              setContactStatus(nextStatus);
            }}
            refresh={() => loadContactSubmissions()}
            update={updateContactSubmission}
            remove={deleteContactSubmission}
          />
        ) : null}
        {token && !mustChangePassword && section === "incentive" ? (
          <IncentivePanel form={bonusForm} setForm={setBonusForm} rows={bonusRows} save={saveBonus} />
        ) : null}
        {token && !mustChangePassword && section === "flyers" ? (
          <DocumentPanel
            section="flyers"
            documents={documents}
            save={saveDocument}
            remove={deleteDocument}
            deleteConfirmId={deleteConfirmId}
            setDeleteConfirmId={setDeleteConfirmId}
          />
        ) : null}
        {token && !mustChangePassword && section === "resources" ? (
          <DocumentPanel
            section="resources"
            documents={documents}
            save={saveDocument}
            remove={deleteDocument}
            deleteConfirmId={deleteConfirmId}
            setDeleteConfirmId={setDeleteConfirmId}
          />
        ) : null}
        {token && !mustChangePassword && section === "election" ? (
          <ElectionPanel
            materials={materials}
            counts={materialCounts}
            moderate={moderateElection}
            refresh={loadElectionMaterials}
            update={updateElectionMaterial}
          />
        ) : null}
        {token && !mustChangePassword && section === "settings" ? (
          <AdminSettingsPanel token={token} setStatus={setStatus} />
        ) : null}
      </section>
    </div>
  );
}

function AdminSettingsPanel({ token, setStatus }: { token: string; setStatus: (status: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setSupported(supportsPush());
    if (supportsPush()) {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setSubscribed(Boolean(subscription)))
        .catch(() => null);
    }
  }, []);

  async function enableAdminNotifications() {
    if (!supported) {
      setStatus("This browser does not support web push notifications.");
      return;
    }

    setStatus("Requesting notification permission...");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("Admin notifications were not enabled.");
      return;
    }

    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js").catch(() => null);
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

    const response = await fetch("/api/push/subscriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        audience: "admin",
        subscription,
        preferences: { pending_comments: true, contact_submissions: true },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "Could not save admin notifications.");
      return;
    }

    setSubscribed(true);
    setStatus("Admin notifications enabled for pending forum comments.");
  }

  async function disableAdminNotifications() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      setSubscribed(false);
      setStatus("Admin notifications are already off.");
      return;
    }

    await fetch("/api/push/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => null);
    await subscription.unsubscribe();
    setSubscribed(false);
    setStatus("Admin notifications disabled.");
  }

  return (
    <section className="panel">
      <div className="admin-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Admin Notifications</h2>
          <p className="muted">Get an alert when a new forum comment or reply is waiting for approval.</p>
        </div>
      </div>
      <div className="button-row">
        <button className="btn primary" type="button" onClick={enableAdminNotifications}>
          {subscribed ? "Update Admin Notifications" : "Enable Admin Notifications"}
        </button>
        {subscribed ? (
          <button className="btn" type="button" onClick={disableAdminNotifications}>
            Disable
          </button>
        ) : null}
      </div>
      {!supported ? <p className="install-help">Use a browser or installed app that supports web push notifications.</p> : null}
    </section>
  );
}

function ContactPanel({
  submissions,
  counts,
  status,
  setStatus,
  refresh,
  update,
  remove,
}: {
  submissions: ContactSubmission[];
  counts: Record<string, number>;
  status: ContactStatus;
  setStatus: (status: ContactStatus) => void;
  refresh: () => void;
  update: (id: string, status: ContactStatus) => void;
  remove: (id: string) => void;
}) {
  return (
    <>
      <div className="admin-head">
        <div>
          <p className="eyebrow">Contact</p>
          <h2>Contact Submissions</h2>
        </div>
        <button className="btn" type="button" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="tab-row">
        {contactStatuses.map((item) => (
          <button className={status === item ? "btn primary" : "btn"} type="button" key={item} onClick={() => setStatus(item)}>
            {item} ({counts[item] || 0})
          </button>
        ))}
      </div>
      <div className="feed">
        {submissions.map((submission) => (
          <article className="card contact-submission-card" key={submission.id}>
            <div className="post-meta">
              <strong>{submission.name || "Anonymous"}</strong>
              <span>{new Date(submission.created_at).toLocaleString()}</span>
              <span className="badge">{submission.topic}</span>
              <span className={`status-${submission.status}`}>{submission.status}</span>
            </div>
            {submission.contact ? <p className="muted">Contact: {submission.contact}</p> : null}
            <p>{submission.message}</p>
            {submission.image_url ? (
              <a className="document-preview contact-preview" href={submission.image_url} target="_blank" rel="noreferrer">
                <img src={submission.image_url} alt="Contact submission upload" />
              </a>
            ) : null}
            <div className="button-row">
              {submission.status !== "reviewed" ? (
                <button className="btn primary" type="button" onClick={() => update(submission.id, "reviewed")}>
                  Mark Reviewed
                </button>
              ) : null}
              {submission.status !== "archived" ? (
                <button className="btn" type="button" onClick={() => update(submission.id, "archived")}>
                  Archive
                </button>
              ) : null}
              {submission.status !== "new" ? (
                <button className="btn" type="button" onClick={() => update(submission.id, "new")}>
                  Move To New
                </button>
              ) : null}
              <button className="btn danger" type="button" onClick={() => remove(submission.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
        {!submissions.length ? <div className="panel muted">No {status} contact submissions.</div> : null}
      </div>
    </>
  );
}

function CommentModeration({
  comments,
  counts,
  status,
  setStatus,
  moderate,
  refresh,
}: {
  comments: ForumComment[];
  counts: Record<string, number>;
  status: CommentStatus;
  setStatus: (status: CommentStatus) => void;
  moderate: (id: string, action: "approve" | "reject") => void;
  refresh: () => void;
}) {
  return (
    <>
      <div className="admin-head">
        <div>
          <p className="eyebrow">Forum</p>
          <h2>Comment Moderation</h2>
        </div>
        <button className="btn" type="button" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="tab-row">
        {commentStatuses.map((item) => (
          <button className={status === item ? "btn primary" : "btn"} type="button" key={item} onClick={() => setStatus(item)}>
            {item} ({counts[item] || 0})
          </button>
        ))}
      </div>
      <div className="feed">
        {comments.map((comment) => (
          <article className="card" key={comment.id}>
            <div className="post-meta">
              <strong>{comment.display_name}</strong>
              <span>{new Date(comment.created_at).toLocaleString()}</span>
              <span className={`status-${comment.status}`}>{comment.status}</span>
              <span className="badge">{comment.category}</span>
            </div>
            <p>{comment.body}</p>
            <div className="button-row">
              {comment.status !== "approved" ? (
                <button className="btn primary" type="button" onClick={() => moderate(comment.id, "approve")}>
                  Approve
                </button>
              ) : null}
              {comment.status !== "rejected" ? (
                <button className="btn danger" type="button" onClick={() => moderate(comment.id, "reject")}>
                  Reject
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!comments.length ? <div className="panel muted">No {status} comments.</div> : null}
      </div>
    </>
  );
}

function IncentivePanel({
  form,
  setForm,
  rows,
  save,
}: {
  form: Record<string, string>;
  setForm: (form: any) => void;
  rows: BonusRow[];
  save: (event: React.FormEvent) => void;
}) {
  return (
    <>
      <div className="admin-head">
        <div>
          <p className="eyebrow">Weekly Data</p>
          <h2>Incentive</h2>
        </div>
      </div>
      <form className="panel compact-form" onSubmit={save}>
        {[
          ["week_ending", "Week Ending", "date"],
          ["coke", "Coke", "text"],
          ["primary_area", "Primary", "text"],
          ["hot_roll", "Hot Roll", "text"],
          ["finishing", "Finishing", "text"],
          ["plate", "Plate", "text"],
          ["plant_avg", "Plant Avg", "text"],
        ].map(([key, label, type]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <input
              id={key}
              type={type}
              value={form[key] || ""}
              onChange={(event) => setForm({ ...form, [key]: event.target.value })}
              required={key === "week_ending"}
            />
          </div>
        ))}
        <button className="btn primary" type="submit">
          Save Week
        </button>
      </form>
      <div className="feed">
        {rows.slice(0, 10).map((row) => (
          <article className="card" key={row.week_ending}>
            <strong>{row.week_ending}</strong>
            <p className="muted">
              Coke {row.coke || "-"} • Primary {row.primary_area || "-"} • Hot Roll {row.hot_roll || "-"} • Finishing{" "}
              {row.finishing || "-"} • Plate {row.plate || "-"} • Plant Avg {row.plant_avg || "-"}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

function DocumentPanel({
  section,
  documents,
  save,
  remove,
  deleteConfirmId,
  setDeleteConfirmId,
}: {
  section: "flyers" | "resources";
  documents: ManagedDocument[];
  save: (event: React.FormEvent<HTMLFormElement>, section: "flyers" | "resources") => void;
  remove: (id: string, section: "flyers" | "resources") => void;
  deleteConfirmId: string;
  setDeleteConfirmId: (id: string) => void;
}) {
  const label = section === "flyers" ? "Flyers" : "Resources";
  return (
    <>
      <div className="admin-head">
        <div>
          <p className="eyebrow">{label}</p>
          <h2>{label}</h2>
        </div>
      </div>
      <form className="panel compact-form" onSubmit={(event) => save(event, section)}>
        <div className="field">
          <label htmlFor={`${section}-title`}>Title</label>
          <input id={`${section}-title`} name="title" required />
        </div>
        <div className="field">
          <label htmlFor={`${section}-description`}>Description</label>
          <input id={`${section}-description`} name="description" />
        </div>
        <div className="field">
          <label htmlFor={`${section}-url`}>External URL optional</label>
          <input id={`${section}-url`} name="external_url" />
        </div>
        <div className="field">
          <label htmlFor={`${section}-file`}>Upload file optional</label>
          <input id={`${section}-file`} name="file" type="file" />
        </div>
        <button className="btn primary" type="submit">
          Publish {label.slice(0, -1)}
        </button>
      </form>
      <div className="feed">
        {documents.map((doc) => (
          <article className="card" key={doc.id}>
            <div className="post-meta">
              <strong>{doc.title}</strong>
              <span>{doc.status}</span>
            </div>
            {doc.description ? <p>{doc.description}</p> : null}
            {doc.file_url ? (
              <a className="btn" href={doc.file_url} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
            {deleteConfirmId === doc.id ? (
              <div className="button-row">
                <button className="btn danger" type="button" onClick={() => remove(doc.id, section)}>
                  Confirm Delete
                </button>
                <button className="btn" type="button" onClick={() => setDeleteConfirmId("")}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="btn danger" type="button" onClick={() => setDeleteConfirmId(doc.id)}>
                Delete
              </button>
            )}
          </article>
        ))}
        {!documents.length ? <div className="panel muted">No {label.toLowerCase()} yet.</div> : null}
      </div>
    </>
  );
}

function ElectionPanel({
  materials,
  counts,
  moderate,
  refresh,
  update,
}: {
  materials: ElectionMaterial[];
  counts: Record<string, number>;
  moderate: (id: string, action: "approve" | "reject") => void;
  refresh: () => void;
  update?: (id: string, formData: FormData) => void;
}) {
  const [status, setStatus] = useState<CommentStatus>("pending");
  const visible = materials.filter((item) => item.status === status);
  return (
    <>
      <div className="admin-head">
        <div>
          <p className="eyebrow">Election</p>
          <h2>Election Materials</h2>
        </div>
        <button className="btn" type="button" onClick={refresh}>
          Refresh
        </button>
      </div>
      <div className="tab-row">
        {commentStatuses.map((item) => (
          <button className={status === item ? "btn primary" : "btn"} type="button" key={item} onClick={() => setStatus(item)}>
            {item} ({counts[item] || 0})
          </button>
        ))}
      </div>
      <div className="feed">
        {visible.map((material) => (
          <article className="card" key={material.id}>
            <div className="post-meta">
              <strong>{material.candidate_name}</strong>
              <span>{material.position}</span>
              <span className={`status-${material.status}`}>{material.status}</span>
            </div>
            {material.summary ? <p>{material.summary}</p> : null}
            <form
              className="compact-form admin-edit-form"
              onSubmit={(event) => {
                event.preventDefault();
                update?.(material.id, new FormData(event.currentTarget));
              }}
            >
              <div className="field">
                <label>Candidate</label>
                <input name="candidate_name" defaultValue={material.candidate_name} />
              </div>
              <div className="field">
                <label>Position</label>
                <select name="position" defaultValue={material.position}>
                  {positions.map((position) => (
                    <option value={position} key={position}>
                      {position}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Category</label>
                <select name="material_kind" defaultValue={material.material_kind}>
                  {materialKinds.map((kind) => (
                    <option value={kind} key={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select name="status" defaultValue={material.status}>
                  {commentStatuses.map((item) => (
                    <option value={item} key={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Display Order</label>
                <input name="display_order" type="number" defaultValue={material.display_order || 0} />
              </div>
              <div className="field">
                <label>Summary</label>
                <input name="summary" defaultValue={material.summary || ""} />
              </div>
              <div className="field">
                <label>External URL</label>
                <input name="external_url" defaultValue={material.external_url || ""} />
              </div>
              <button className="btn" type="submit">
                Save Changes
              </button>
            </form>
            <div className="button-row">
              {material.file_url ? (
                <a className="btn" href={material.file_url} target="_blank" rel="noreferrer">
                  File
                </a>
              ) : null}
              {material.external_url ? (
                <a className="btn" href={material.external_url} target="_blank" rel="noreferrer">
                  Link
                </a>
              ) : null}
              {material.status !== "approved" ? (
                <button className="btn primary" type="button" onClick={() => moderate(material.id, "approve")}>
                  Approve
                </button>
              ) : null}
              {material.status !== "rejected" ? (
                <button className="btn danger" type="button" onClick={() => moderate(material.id, "reject")}>
                  Reject
                </button>
              ) : null}
            </div>
          </article>
        ))}
        {!visible.length ? <div className="panel muted">No {status} election materials.</div> : null}
      </div>
    </>
  );
}

export { positions };
