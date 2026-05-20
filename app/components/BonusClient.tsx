"use client";

import { useEffect, useState } from "react";

type BonusRow = {
  week_ending: string;
  coke?: string | null;
  primary?: string | null;
  primary_area?: string | null;
  hot_roll?: string | null;
  finishing?: string | null;
  plate?: string | null;
  plant_avg?: string | null;
};

export default function BonusClient() {
  const [rows, setRows] = useState<BonusRow[]>([]);

  useEffect(() => {
    fetch("/api/bonus", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setRows(data.rows || []))
      .catch(() => setRows([]));
  }, []);

  const latest = rows[0];

  return (
    <>
      {latest ? (
        <section className="grid" style={{ marginTop: 24 }}>
          {[
            ["Coke", latest.coke],
            ["Primary", latest.primary_area || latest.primary],
            ["Hot Roll", latest.hot_roll],
            ["Finishing", latest.finishing],
            ["Plate", latest.plate],
            ["Plant Avg", latest.plant_avg],
          ].map(([label, value]) => (
            <article className="panel" key={label}>
              <p className="muted">{label}</p>
              <h2>{value || "-"}</h2>
              <p className="muted">Week ending {latest.week_ending}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 24, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {["Week Ending", "Coke", "Primary", "Hot Roll", "Finishing", "Plate", "Plant Avg"].map((heading) => (
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }} key={heading}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.week_ending}>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{row.week_ending}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{row.coke}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{row.primary_area || row.primary}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{row.hot_roll}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{row.finishing}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{row.plate}</td>
                <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{row.plant_avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
