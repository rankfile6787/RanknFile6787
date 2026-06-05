export type CommentStatus = "pending" | "approved" | "rejected";

export type CommentCategory = "general" | "news" | "questions";

export type ForumComment = {
  id: string;
  parent_id: string | null;
  created_at: string;
  display_name: string;
  category: CommentCategory;
  body: string;
  status: CommentStatus;
  website?: string | null;
  ip_hash?: string | null;
};

export type BonusRow = {
  week_ending: string;
  coke: string | null;
  primary_area: string | null;
  hot_roll: string | null;
  finishing: string | null;
  plate: string | null;
  plant_avg: string | null;
};

export type ManagedDocument = {
  id: string;
  section: "flyers" | "resources";
  title: string;
  description: string | null;
  file_url: string | null;
  file_path: string | null;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

export type ElectionMaterial = {
  id: string;
  candidate_name: string;
  position: string;
  material_kind: "incumbent" | "candidate" | "campaign-material";
  summary: string | null;
  file_url: string | null;
  file_path: string | null;
  external_url: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  status: CommentStatus;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

export type ContactSubmission = {
  id: string;
  created_at: string;
  name: string | null;
  contact: string | null;
  topic: "flyer" | "suggestion" | "site-issue" | "other";
  message: string;
  image_url: string | null;
  image_path: string | null;
  status: "new" | "reviewed" | "archived";
};
