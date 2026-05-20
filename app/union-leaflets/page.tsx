import DocumentsClient from "../components/DocumentsClient";

export default function UnionLeafletsPage() {
  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Leaflets</p>
        <h1>Union Leaflets</h1>
        <p className="lead">Published leaflets and member information flyers.</p>
      </section>
      <DocumentsClient section="flyers" />
    </main>
  );
}
