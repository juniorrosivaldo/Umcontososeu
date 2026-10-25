export type Evidence = {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  topic: string;
  publisher: string;
  source_type: string;
  category: string;
  score: number;
  reasons: string[];
  created_at: string;
};
export type Run = {
  id: string;
  agent: string;
  status: string;
  mode: string;
  created_at: string;
  finished_at: string | null;
  result_count: number;
  error: string | null;
  details: { source_errors?: { topic: string; source: string; error: string }[] };
};
export type Recommendation = {
  id: string;
  title: string;
  rationale: string;
  action: string;
  priority: number;
  evidence_ids: string[];
  created_at: string;
};
export type ContentBody = {
  text: string;
  caption: string;
  scenes: string[];
  slides: string[];
  hashtags: string[];
  cover_prompt: string;
  notes: string;
};
export type Content = {
  id: string;
  format: string;
  title: string;
  body: ContentBody;
  status: string;
  version: number;
  commercial: boolean;
  created_at: string;
  approved_at: string | null;
  scheduled_at: string | null;
  evidence_ids: string[];
};
export type Agent = {
  name: string;
  enabled: boolean;
  interval_hours: number;
  level: number;
  mode: string;
  last_run: Run | null;
  next_run: string | null;
  schedule_note: string;
};
export type Overview = {
  workspace: { id: string; name: string; handle: string; segment: string; themes: string[] };
  counts: { evidence: number; recommendations: number; contents: number; customers: number };
  role: string;
  mode: string;
  database: string;
  runs: Run[];
  recommendations: Recommendation[];
};
export type Customer = {
  id: string;
  name: string;
  contact: string;
  notes: string;
  consent: boolean;
};
export type Order = {
  id: string;
  customer_id: string;
  description: string;
  amount_cents: number;
  status: string;
};
export type Metrics = {
  history: { id: string; created_at: string; metrics: Record<string, number> }[];
  delta: Record<string, number>;
  unavailable: string[];
};
export type Integrations = {
  openai: { configured: boolean; enabled: boolean; model: string };
  instagram: { configured: boolean; connection_verified: boolean; publishing_enabled: boolean };
  supabase: { configured: boolean; auth_mode: string };
  automation: { enabled_in_this_process: boolean; cron: string };
};
