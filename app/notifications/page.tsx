import NotificationSettingsCard from "../components/NotificationSettingsCard";

export default function NotificationsPage() {
  return (
    <main className="container">
      <section className="panel">
        <p className="eyebrow">Notifications</p>
        <h1>Notification Settings</h1>
        <p className="lead">Choose which Rank & File updates should send browser or app notifications.</p>
      </section>
      <NotificationSettingsCard />
    </main>
  );
}
