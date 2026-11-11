// Shapes of the data the core sends. Kept loose where the core passes
// pack content straight through.

export type Profile = { name: string; first_launch_done: boolean; created: string; text_scale?: number };

export type Entity = { id: string; kind: string; label: string; role?: string; identifiers?: string[]; attributes?: Record<string, string> };

export type CustodyEntry = { id: string; evidence: string; action: string; time: string; case_time: string; reason: string; hash: string; by: string };

export type TableInfo = {
  time_column?: string;
  entity_columns?: string[];
  location_column?: string;
  x_column?: string;
  y_column?: string;
  map_entity?: string;
  description_columns?: string[];
};

export type Grade = { source: string; info: string };

export type EvidenceItem = {
  id: string;
  title: string;
  type: string;
  source: string;
  source_group: string;
  acquired: string;
  acquired_by: string;
  summary: string;
  file: string;
  original_hash: string;
  pack_custody: { time: string; action: string; by: string; note?: string }[];
  custody: CustodyEntry[];
  clock_offset_minutes?: number | null;
  clock_note: string;
  timezone_note: string;
  handling: string;
  marking: string;
  tags: string[];
  metadata: Record<string, string>;
  table?: TableInfo | null;
  released_by?: string;
  received: boolean;
  examined: boolean;
  hashed: boolean;
  hash_ok?: boolean | null;
  continuity_gap: boolean;
  grade?: Grade | null;
  note?: string | null;
};

export type Objective = { id: string; text: string; required: boolean; done: boolean; hints_used: number };
export type Stage = { id: string; title: string; target_minutes: number; unlock_text: string; open: boolean; message?: string; objectives?: Objective[]; opened_at?: number };

export type Finding = { id: string; statement: string; type: "fact" | "inference" | "assumption"; evidence: string[]; grade?: Grade | null; created: string; in_report: boolean };
export type TimelineEvent = { id: string; time: string; description: string; evidence: string[]; entities: string[]; confidence: string; clock_note: string };
export type Link = { id: string; from: string; to: string; type: string; evidence: string[]; note: string; suggested: boolean };
export type Capture = { id: string; page: string; url: string; title: string; time: string; case_time: string; hash: string; snapshot?: number | null; method: string; persona: boolean };
export type RequestRecord = { id: string; request_type: string; target: string; date_from: string; date_to: string; justification: string; granted: boolean; response: string; stage: string; time: string };
export type RequestType = { id: string; kind: string; label: string; description: string; target_kinds: string[]; available_from: string; needs_dates: boolean; allow_all: boolean };
export type Message = { id: string; stage: string; from: string; text: string; time: string; case_time: string; read: boolean };
export type ActionEntry = { seq: number; time: string; case_time: string; view: string; action: string; target: string; detail: string };
export type TrapEvent = { trap: string; title: string; category: string; severity: string; penalty: number; lesson: string; time: string; target: string; detail: string };
export type HintUse = { objective: string; level: number; text: string; cost: number; time: string };

export type Report = {
  summary: string;
  scope_method: string;
  gaps: string;
  recommendations: string;
  include_timeline: boolean;
  include_links: boolean;
  legality: { legality: string; necessity: string; proportionality: string; signed: boolean; signed_by: string; signed_at: string };
  exports: string[];
};

export type MapData = { name: string; width: number; height: number; features: any[]; locations: { id: string; label: string; kind: string; x: number; y: number; radius?: number; note?: string }[] };

export type CaseState = {
  manifest: { id: string; title: string; version: string; specialty: string; difficulty: string; estimated_minutes: number; summary: string; author: string; licence: string };
  brief: string;
  intake: { tasking: string; scope: string[]; out_of_scope: string[]; authorities: { id: string; label: string; covers: string }[]; constraints: string[]; clock_start: string; case_lead: string; osint_access?: string };
  stages: Stage[];
  request_types: RequestType[];
  entities: Entity[];
  map: MapData | null;
  osint: { enabled: boolean; sites: any[]; pages: { id: string; url: string; title: string; site: string }[] };
  evidence: EvidenceItem[];
};

export type AttemptState = {
  id: string;
  mode: "training" | "assessment";
  started: string;
  updated: string;
  active_seconds: number;
  case_time: string;
  scope_acknowledged: boolean;
  current_stage: string;
  findings: Finding[];
  timeline: TimelineEvent[];
  links: Link[];
  notes: string;
  requests: RequestRecord[];
  authorities: string[];
  captures: Capture[];
  page_views: Record<string, number>;
  hints: HintUse[];
  hint_cost: number;
  messages: Message[];
  report: Report;
  view: any;
  actions: ActionEntry[];
  action_count: number;
  custody: CustodyEntry[];
  integrity_reports: Record<string, string>;
  traps: TrapEvent[];
  submitted: boolean;
  result: any;
  report_issues: string[];
};

export type GameState = { profile: Profile | null; case: CaseState; attempt: AttemptState };

export type LibraryCase = {
  id: string;
  title: string;
  version: string;
  specialty: string;
  difficulty: string;
  estimated_minutes: number;
  summary: string;
  author: string;
  licence: string;
  attempts: { id: string; mode: string; started: string; updated: string; active_seconds: number; submitted: boolean; stage: string; score?: number; band?: string }[];
};

export const TYPE_LABELS: Record<string, string> = {
  bank_statement: "Bank statement",
  cdr: "Call records",
  anpr: "ANPR reads",
  camera_log: "Camera log",
  door_access: "Door access log",
  login_log: "Login log",
  server_log: "Server log",
  cloud_log: "Cloud sharing log",
  usb_history: "USB history",
  browser_history: "Browser history",
  file_listing: "File system listing",
  spreadsheet: "Spreadsheet",
  rota: "Rota",
  location_history: "Location history",
  email: "Email",
  phone_extraction: "Phone extraction",
  document: "Document",
  statement: "Witness statement",
  invoice: "Invoice",
  image: "Image",
  it_change_log: "IT change log",
  hr_document: "HR document",
  response: "Data request response",
};

export const TYPE_ICONS: Record<string, string> = {
  bank_statement: "£",
  cdr: "☎",
  anpr: "◫",
  camera_log: "◉",
  door_access: "⊟",
  login_log: "⌘",
  server_log: "≡",
  cloud_log: "☁",
  usb_history: "⏚",
  browser_history: "⌖",
  file_listing: "▤",
  spreadsheet: "▦",
  rota: "▥",
  location_history: "⌾",
  email: "✉",
  phone_extraction: "▯",
  document: "▭",
  statement: "✎",
  invoice: "₤",
  image: "▣",
  it_change_log: "⚙",
  hr_document: "▭",
  response: "⇲",
};
