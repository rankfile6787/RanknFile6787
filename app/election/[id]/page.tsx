import Link from "next/link";
import { createServiceSupabase } from "@/lib/supabase";
import type { ElectionMaterial } from "@/lib/types";

export default async function ElectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("election_materials")
    .select("*")
    .eq("id", id)
    .eq("status", "approved")
    .single();

  const material = data as ElectionMaterial | null;

  if (!material) {
    return (
      <main className="container">
        <section className="panel">
          <h1>Material Not Found</h1>
          <p className="lead">This election material is not available publicly.</p>
          <Link className="btn primary" href="/election">
            Back to Election
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">{formatPosition(material.position)}</p>
        <h1>{material.candidate_name}</h1>
        <p className="lead">{material.summary || "Approved election material."}</p>
        <div className="button-row" style={{ marginTop: 18 }}>
          <Link className="btn" href="/election">
            Back
          </Link>
          {material.file_url ? (
            <a className="btn primary" href={material.file_url} target="_blank" rel="noreferrer">
              Open File
            </a>
          ) : null}
          {material.external_url ? (
            <a className="btn" href={material.external_url} target="_blank" rel="noreferrer">
              Open Link
            </a>
          ) : null}
        </div>
      </section>

      {material.file_url ? <ElectionFilePreview material={material} /> : null}
      {material.external_url ? (
        <section className="panel submission-panel">
          <h2>Submitted Link</h2>
          <a className="document-link" href={material.external_url} target="_blank" rel="noreferrer">
            <strong>{material.external_url}</strong>
            <span>Open</span>
          </a>
        </section>
      ) : null}
    </main>
  );
}

function ElectionFilePreview({ material }: { material: ElectionMaterial }) {
  const url = material.file_url || "";
  const isImage = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url);
  const isPdf = /\.pdf(\?|$)/i.test(url);

  return (
    <section className="panel submission-panel">
      <h2>Submitted Material</h2>
      {isImage ? (
        <a className="document-preview" href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`${material.candidate_name} campaign material`} />
        </a>
      ) : isPdf ? (
        <iframe className="pdf-frame" src={url} title={`${material.candidate_name} campaign material`} />
      ) : (
        <a className="document-link" href={url} target="_blank" rel="noreferrer">
          <strong>Submitted file</strong>
          <span>Open</span>
        </a>
      )}
    </section>
  );
}

function formatPosition(position: string) {
  return position
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
