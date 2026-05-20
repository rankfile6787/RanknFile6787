import { loadEnvConfig } from "@next/env";
import bonusRows from "../public/production-bonus.backup.json";
import { createServiceSupabase } from "../lib/supabase";

loadEnvConfig(process.cwd());

const documents = [
  {
    section: "flyers",
    title: "Next Gen Movie Night",
    description: "Member event flyer.",
    file_url: "/files/Leaflets/next-gen-movienight.jpeg",
  },
  {
    section: "flyers",
    title: "March 2026 Meeting Notice",
    description: "Union meeting notice.",
    file_url: "/files/Leaflets/March 2026 Meeting notice.jpeg",
  },
  {
    section: "flyers",
    title: "Easter Egg Hunt 2026",
    description: "Member event flyer.",
    file_url: "/files/Leaflets/Easter Egg Hunt 2026.jpeg",
  },
  {
    section: "flyers",
    title: "April Food Truck",
    description: "Member information flyer.",
    file_url: "/files/Leaflets/April food truck.jpeg",
  },
  {
    section: "flyers",
    title: "April 2026 Meeting Notice",
    description: "Union meeting notice.",
    file_url: "/files/Leaflets/April 2026 Meeting notice.jpg",
  },
  {
    section: "resources",
    title: "Current Bylaws Amended 2019",
    description: "Current bylaws document.",
    file_url: "/files/Current Bylaws amended 2019.pdf",
  },
  {
    section: "resources",
    title: "2022 BLA",
    description: "Basic labor agreement.",
    file_url: "/files/BLA/2022_bla.pdf",
  },
  {
    section: "resources",
    title: "Open 2022 BLA Printer Version",
    description: "ClevelandCliffs Steel LLC agreement document.",
    file_url: "/files/Open 2022 BLA Printer Version - ClevelandCliffs Steel LLC 13.pdf",
  },
];

const electionMaterials = [
  ["Pete Trinidad Sr.", "president", "Current President of USW local 6787."],
  ["Billy Lowe", "vice-president", "Current Vice-President of USW local 6787."],
  ["Gus Sandilla", "recording-secretary", "Current recording-secretary of USW local 6787."],
  ["Ryan Kadish", "financial-secretary", "Current financial-secretary of USW local 6787."],
  ["Dave Williams", "grievance-chairman", "Current grievance-chairman of USW local 6787."],
  ["Bill Richardson", "treasurer", "Current treasurer of USW local 6787."],
  ["Brenda English", "guide", "Current guide of USW local 6787."],
  ["Ray Jackson", "inner-guard", "Current inner-guard of USW local 6787."],
  ["Steve Dujmovich", "outer-guard", "Current outer-guard of USW local 6787."],
  ["Craig Menear", "trustee", "Current trustee of USW local 6787."],
  ["Tony Lewis Sr.", "trustee", "Current trustee of USW local 6787."],
  ["Art Jackson", "trustee", "Current trustee of USW local 6787."],
  ["Josh Butts", "zone-1-griever", "Current Zone 1 Griever (Plate) of USW local 6787."],
  ['James "Chip" Decker', "zone-2-griever", "Current Zone 2 Griever (Finishing) of USW local 6787."],
  ["Chris Beach", "zone-3-griever", "Current Zone 3 Griever (Steel Making) of USW local 6787."],
  ["LaMark Haywood", "zone-4-griever", "Current Zone 4 Griever (Hot Mill) of USW local 6787."],
  ["Jason Odle", "zone-5-griever", "Current Zone 5 Griever (MEU) of USW local 6787."],
  ["Rob Neiswinger", "zone-6-griever", "Current Zone 6 Griever (Iron Producing) of USW local 6787."],
  ["Bryan Scott", "zone-7-griever", "Current Zone 7 Griever (Coke Ovens) of USW local 6787."],
].map(([candidate_name, position, summary], index) => ({
  candidate_name,
  position,
  summary,
  material_kind: "incumbent",
  status: "approved",
  display_order: index + 1,
}));

async function main() {
  const supabase = createServiceSupabase();

  const normalizedBonus = (bonusRows as any[]).map((row) => ({
    week_ending: row.week_ending,
    coke: row.coke || null,
    primary_area: row.primary || row.primary_area || null,
    hot_roll: row.hot_roll || null,
    finishing: row.finishing || null,
    plate: row.plate || null,
    plant_avg: row.plant_avg || null,
  }));

  const { error: bonusError } = await supabase
    .from("production_bonus_rows")
    .upsert(normalizedBonus, { onConflict: "week_ending" });
  if (bonusError) throw bonusError;

  const { count: documentCount, error: documentCountError } = await supabase
    .from("managed_documents")
    .select("*", { count: "exact", head: true });
  if (documentCountError) throw documentCountError;
  if (!documentCount) {
    const { error } = await supabase.from("managed_documents").insert(documents);
    if (error) throw error;
  }

  for (const material of electionMaterials) {
    const { data: existing, error: lookupError } = await supabase
      .from("election_materials")
      .select("id")
      .eq("candidate_name", material.candidate_name)
      .eq("position", material.position)
      .eq("material_kind", material.material_kind)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing?.id) {
      const { error } = await supabase.from("election_materials").update(material).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("election_materials").insert(material);
      if (error) throw error;
    }
  }

  console.log(`Seeded ${normalizedBonus.length} incentive rows.`);
  console.log(documentCount ? "Documents already existed; skipped document seed." : `Seeded ${documents.length} documents.`);
  console.log(`Seeded/updated ${electionMaterials.length} election entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
