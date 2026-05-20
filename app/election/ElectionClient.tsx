"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ElectionMaterial } from "@/lib/types";

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

export default function ElectionClient() {
  const [materials, setMaterials] = useState<ElectionMaterial[]>([]);
  const [activeTab, setActiveTab] = useState("candidates");
  const [activePosition, setActivePosition] = useState("all");
  const [status, setStatus] = useState("");
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);

  useEffect(() => {
    fetch("/api/election-materials", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setMaterials(data.materials || []))
      .catch(() => setStatus("Could not load election materials right now."));
  }, []);

  const visibleMaterials = useMemo(() => {
    return materials.filter((material) => {
      const kindMatch =
        activeTab === "incumbents"
          ? material.material_kind === "incumbent"
          : material.material_kind !== "incumbent";
      const positionMatch = activePosition === "all" || material.position === activePosition;
      return kindMatch && positionMatch;
    });
  }, [materials, activeTab, activePosition]);

  async function submitMaterial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Submitting...");
    const response = await fetch("/api/election-materials", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || "Could not submit material.");
      return;
    }
    event.currentTarget.reset();
    setStatus("Submitted for review.");
  }

  return (
    <>
      <section className="panel">
        <p className="eyebrow">Union Elections • Transparency • Member Awareness</p>
        <h1>Election Information</h1>
        <p className="lead">
          Campaign literature can be submitted directly here. Approved items appear as clean candidate cards with a detail page.
        </p>
      </section>

      <section className="submission-panel">
        <button className="btn primary" type="button" onClick={() => setShowSubmissionForm((value) => !value)}>
          {showSubmissionForm ? "Hide Submission Form" : "Make a Submission"}
        </button>
      </section>

      {showSubmissionForm ? (
        <section className="panel submission-panel">
          <h2>Submit Campaign Material</h2>
          <form className="compact-form" onSubmit={submitMaterial}>
            <div className="field">
              <label htmlFor="candidate_name">Candidate Name</label>
              <input id="candidate_name" name="candidate_name" required />
            </div>
            <div className="field">
              <label htmlFor="position">Position</label>
              <select id="position" name="position" required>
                {positions.map((position) => (
                  <option key={position} value={position}>
                    {formatPosition(position)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="summary">Summary</label>
              <input id="summary" name="summary" />
            </div>
            <div className="field">
              <label htmlFor="external_url">Link optional</label>
              <input id="external_url" name="external_url" />
            </div>
            <div className="field">
              <label htmlFor="file">Upload PDF/image optional</label>
              <input id="file" name="file" type="file" />
            </div>
            <div className="field">
              <label htmlFor="submitter_name">Your Name optional</label>
              <input id="submitter_name" name="submitter_name" />
            </div>
            <div className="field">
              <label htmlFor="submitter_email">Your Email optional</label>
              <input id="submitter_email" name="submitter_email" type="email" />
            </div>
            <div className="hp-field" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input id="website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <button className="btn primary" type="submit">
              Submit for Review
            </button>
          </form>
          {status ? <p className="muted">{status}</p> : null}
        </section>
      ) : status ? (
        <p className="muted submission-panel">{status}</p>
      ) : null}

      <section className="submission-panel">
        <div className="tab-row">
          <button className={activeTab === "candidates" ? "btn primary" : "btn"} type="button" onClick={() => setActiveTab("candidates")}>
            Candidates
          </button>
          <button className={activeTab === "incumbents" ? "btn primary" : "btn"} type="button" onClick={() => setActiveTab("incumbents")}>
            Incumbents
          </button>
        </div>
        <div className="tab-row" style={{ marginTop: 12 }}>
          {["all", ...positions].map((position) => (
            <button
              className={activePosition === position ? "btn primary" : "btn"}
              key={position}
              type="button"
              onClick={() => setActivePosition(position)}
            >
              {position === "all" ? "All" : formatPosition(position)}
            </button>
          ))}
        </div>
        <div className="candidate-grid">
          {visibleMaterials.map((material) => (
            <Link className="card candidate-card candidate-link-card" href={`/election/${material.id}`} key={material.id}>
              <span className="badge">{formatPosition(material.position)}</span>
              <h2>{material.candidate_name}</h2>
              <p className="muted">{material.material_kind === "incumbent" ? "Current office holder" : "Candidate material"}</p>
            </Link>
          ))}
        </div>
        {!visibleMaterials.length ? <div className="panel muted submission-panel">No approved materials here yet.</div> : null}
      </section>
    </>
  );
}

function formatPosition(position: string) {
  return position
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
