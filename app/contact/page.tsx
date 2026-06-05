import ContactForm from "./ContactForm";

export default function ContactPage() {
  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Contact Us</p>
        <h1>Send Something To The Admins</h1>
        <p className="lead">
          Use this page to submit union flyers or information you would like to see posted, suggestions for the
          site, or issues you notice while using it. You can include an image if that helps explain what you are
          sending.
        </p>
      </section>
      <ContactForm />
    </main>
  );
}
