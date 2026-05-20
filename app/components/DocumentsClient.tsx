"use client";

import { useEffect, useState } from "react";
import type { ManagedDocument } from "@/lib/types";

export default function DocumentsClient({ section }: { section: "flyers" | "resources" }) {
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(`/api/documents?section=${section}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setDocuments(data.documents || []))
      .catch(() => setStatus("Could not load this section right now."));
  }, [section]);

  return (
    <div className={`feed document-feed ${section}-feed`}>
      {documents.map((document) => (
        <article className="card document-card" key={document.id}>
          <div className="post-meta">
            <strong>{document.title}</strong>
            <span>{new Date(document.created_at).toLocaleDateString()}</span>
          </div>
          {document.description ? <p>{document.description}</p> : null}
          <DocumentPreview document={document} />
        </article>
      ))}
      {status ? <div className="panel muted">{status}</div> : null}
      {!documents.length && !status ? <div className="panel muted">No published items yet.</div> : null}
    </div>
  );
}

function DocumentPreview({ document }: { document: ManagedDocument }) {
  if (!document.file_url) return null;
  const url = document.file_url;
  const lower = url.toLowerCase();
  const isImage = /\.(png|jpe?g|gif|webp|avif)(\?|$)/.test(lower);
  const isPdf = /\.pdf(\?|$)/.test(lower);

  if (isImage) {
    return (
      <a className="document-preview" href={url} target="_blank" rel="noreferrer" aria-label={`Open ${document.title}`}>
        <img src={url} alt={document.title} />
      </a>
    );
  }

  if (isPdf) {
    return (
      <a className="document-link" href={url} target="_blank" rel="noreferrer">
        <strong>{document.title}</strong>
        <span>PDF</span>
      </a>
    );
  }

  return (
    <a className="document-link" href={url} target="_blank" rel="noreferrer">
      <strong>{document.title}</strong>
      <span>Link</span>
    </a>
  );
}
