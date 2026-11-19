export interface Project {
  id: number;
  name: string;
  description: string;
  task_type: string;
  labels: string[];
  created_at: string;
}

export interface Dataset {
  id: number;
  project_id: number;
  name: string;
  description: string;
  record_count: number;
  created_at: string;
}

export interface RecordItem {
  id: number;
  dataset_id: number;
  text: string;
  row_index: number;
  ai_label: string | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  human_label: string | null;
  review_status: string;
  is_flagged: boolean;
}

export interface ImportResult {
  dataset_id: number;
  imported: number;
  skipped: number;
  cleaned: number;
  issues: number;
}

export interface AnnotateResult {
  annotated: number;
  failed: number;
  mode: string;
}

export interface ReviewLog {
  id: number;
  annotation_id: number;
  action: string;
  old_label: string | null;
  new_label: string | null;
  reviewer: string;
  note: string;
  created_at: string;
}

export interface QualityIssue {
  id: number;
  dataset_id: number;
  record_id: number | null;
  issue_type: string;
  severity: string;
  detail: string;
  resolved: boolean;
  created_at: string;
}

export interface LabelStat {
  label: string;
  count: number;
}

export interface Analytics {
  dataset_id: number;
  total: number;
  annotated: number;
  reviewed: number;
  pending_review: number;
  ai_distribution: LabelStat[];
  human_distribution: LabelStat[];
  ai_human_agreement: number | null;
  low_confidence: number;
  flagged: number;
  reviewer_stats: { reviewer: string; count: number }[];
}

export interface Dashboard {
  projects: number;
  datasets: number;
  records: number;
  annotated: number;
  reviewed: number;
  pending_review: number;
  open_issues: number;
}

export interface AppSettings {
  llm_base_url: string;
  llm_model: string;
  llm_api_key_set: boolean;
  mode: string;
}
