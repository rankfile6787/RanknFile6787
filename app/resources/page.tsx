import DocumentsClient from "../components/DocumentsClient";

export default function ResourcesPage() {
  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Resources</p>
        <h1>Union Resources</h1>
        <p className="lead">Agreements, bylaws, forms, and other member resources.</p>
      </section>
      <DocumentsClient section="resources" />
    </main>
  );
}
