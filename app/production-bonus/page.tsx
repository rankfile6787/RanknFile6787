import BonusClient from "../components/BonusClient";

export default function ProductionBonusPage() {
  return (
    <main className="container">
      <p className="eyebrow">Incentive • Weekly Data</p>
      <h1>Incentive</h1>
      <p className="lead">Latest incentive values and weekly area history.</p>
      <BonusClient />
    </main>
  );
}
