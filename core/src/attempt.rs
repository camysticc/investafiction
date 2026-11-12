//! The saved state of one attempt at a case. One JSON file per attempt.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

pub const SAVE_VERSION: u32 = 3;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CustodyEntry {
    pub id: String,
    pub evidence: String,
    /// received, copied, examined, examined_original, hashed, integrity_reported, alter_blocked
    pub action: String,
    pub time: String,
    pub case_time: String,
    #[serde(default)]
    pub reason: String,
    #[serde(default)]
    pub hash: String,
    pub by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ActionEntry {
    pub seq: u64,
    pub time: String,
    pub case_time: String,
    pub view: String,
    pub action: String,
    pub target: String,
    #[serde(default)]
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Grade {
    pub source: String,
    pub info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Finding {
    pub id: String,
    pub statement: String,
    /// fact, inference or assumption
    #[serde(rename = "type")]
    pub kind: String,
    pub evidence: Vec<String>,
    #[serde(default)]
    pub grade: Option<Grade>,
    pub created: String,
    #[serde(default)]
    pub in_report: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Event {
    pub id: String,
    pub time: String,
    pub description: String,
    pub evidence: Vec<String>,
    #[serde(default)]
    pub entities: Vec<String>,
    #[serde(default)]
    pub confidence: String,
    /// Note from the player about any clock correction applied.
    #[serde(default)]
    pub clock_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Link {
    pub id: String,
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub evidence: Vec<String>,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub suggested: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RequestRecord {
    pub id: String,
    pub request_type: String,
    pub target: String,
    #[serde(default)]
    pub date_from: String,
    #[serde(default)]
    pub date_to: String,
    pub justification: String,
    pub granted: bool,
    pub response: String,
    pub stage: String,
    pub time: String,
    #[serde(default)]
    pub rule: Option<String>,
    #[serde(default)]
    pub broad: bool,
    #[serde(default)]
    pub unfounded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Capture {
    pub id: String,
    pub page: String,
    pub url: String,
    pub title: String,
    pub time: String,
    pub case_time: String,
    pub hash: String,
    #[serde(default)]
    pub snapshot: Option<usize>,
    /// full (preserved properly) or screenshot (no time or hash recorded)
    pub method: String,
    #[serde(default)]
    pub persona: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TrapEvent {
    pub trap: String,
    pub title: String,
    pub category: String,
    pub severity: String,
    pub penalty: f64,
    pub lesson: String,
    pub time: String,
    pub target: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HintUse {
    pub objective: String,
    pub level: u8,
    pub text: String,
    pub cost: f64,
    pub time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Message {
    pub id: String,
    pub stage: String,
    pub from: String,
    pub text: String,
    pub time: String,
    pub case_time: String,
    #[serde(default)]
    pub read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Legality {
    #[serde(default)]
    pub legality: String,
    #[serde(default)]
    pub necessity: String,
    #[serde(default)]
    pub proportionality: String,
    #[serde(default)]
    pub signed: bool,
    #[serde(default)]
    pub signed_by: String,
    #[serde(default)]
    pub signed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Report {
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub scope_method: String,
    #[serde(default)]
    pub gaps: String,
    #[serde(default)]
    pub recommendations: String,
    #[serde(default = "yes")]
    pub include_timeline: bool,
    #[serde(default = "yes")]
    pub include_links: bool,
    #[serde(default)]
    pub legality: Legality,
    #[serde(default)]
    pub exports: Vec<String>,
}

fn yes() -> bool {
    true
}

/// A link the player made in the statement comparison tool.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaimLink {
    pub id: String,
    pub claim: String,
    /// agrees, conflicts, adds_detail or unverifiable (with another claim), supports or contradicts (with evidence)
    pub relation: String,
    #[serde(default)]
    pub other_claim: Option<String>,
    #[serde(default)]
    pub evidence: Vec<String>,
    #[serde(default)]
    pub note: String,
    pub created: String,
}

/// A place sent to the map from a witness claim.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MapPin {
    pub id: String,
    pub claim: String,
    pub location: String,
    pub label: String,
    #[serde(default)]
    pub time: Option<String>,
    pub source: String,
}

/// Settings chosen when the attempt started that change the score.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreSettings {
    /// How many hint levels are available (0 to 3).
    #[serde(default = "three")]
    pub hints_available: u8,
    /// Procedural warnings before mistakes (training mode only).
    #[serde(default = "yes")]
    pub warnings: bool,
}

fn three() -> u8 {
    3
}

impl Default for ScoreSettings {
    fn default() -> Self {
        ScoreSettings { hints_available: 3, warnings: true }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attempt {
    pub save_version: u32,
    pub id: String,
    pub case_id: String,
    pub case_version: String,
    /// training or assessment
    pub mode: String,
    pub started: String,
    pub updated: String,
    #[serde(default)]
    pub active_seconds: u64,
    #[serde(default)]
    pub scope_acknowledged: bool,
    #[serde(default)]
    pub open_stages: Vec<String>,
    #[serde(default)]
    pub stage_opened_at: BTreeMap<String, u64>,
    #[serde(default)]
    pub objectives_done: BTreeSet<String>,
    /// Evidence released by requests, in addition to the open stages.
    #[serde(default)]
    pub extra_evidence: Vec<String>,
    #[serde(default)]
    pub extra_pages: Vec<String>,
    #[serde(default)]
    pub unlocked_pages: BTreeSet<String>,
    #[serde(default)]
    pub persona_pages: BTreeSet<String>,
    #[serde(default)]
    pub custody: Vec<CustodyEntry>,
    #[serde(default)]
    pub actions: Vec<ActionEntry>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub item_notes: BTreeMap<String, String>,
    #[serde(default)]
    pub findings: Vec<Finding>,
    #[serde(default)]
    pub timeline: Vec<Event>,
    #[serde(default)]
    pub links: Vec<Link>,
    #[serde(default)]
    pub grades: BTreeMap<String, Grade>,
    #[serde(default)]
    pub requests: Vec<RequestRecord>,
    #[serde(default)]
    pub authorities: BTreeSet<String>,
    #[serde(default)]
    pub captures: Vec<Capture>,
    #[serde(default)]
    pub page_views: BTreeMap<String, u32>,
    #[serde(default)]
    pub hints: Vec<HintUse>,
    #[serde(default)]
    pub traps: Vec<TrapEvent>,
    #[serde(default)]
    pub warned: BTreeSet<String>,
    #[serde(default)]
    pub messages: Vec<Message>,
    #[serde(default)]
    pub report: Report,
    #[serde(default)]
    pub view: Value,
    #[serde(default)]
    pub integrity_reports: BTreeMap<String, String>,
    #[serde(default)]
    pub submitted: bool,
    #[serde(default)]
    pub submitted_at: String,
    #[serde(default)]
    pub result: Option<Value>,
    #[serde(default)]
    pub counter: u64,
    #[serde(default)]
    pub claim_links: Vec<ClaimLink>,
    #[serde(default)]
    pub pins: Vec<MapPin>,
    #[serde(default)]
    pub score_settings: ScoreSettings,
}

impl Attempt {
    pub fn next_id(&mut self, prefix: &str) -> String {
        self.counter += 1;
        format!("{prefix}-{:03}", self.counter)
    }
}

/// Bring an older save up to the current version, one step at a time.
pub fn migrate(mut v: Value) -> Result<Value, String> {
    let mut ver = v.get("save_version").and_then(|x| x.as_u64()).unwrap_or(1) as u32;
    if ver > SAVE_VERSION {
        return Err(format!("This save was made by a newer version of Investafiction (save format {ver})."));
    }
    while ver < SAVE_VERSION {
        match ver {
            // Version 1 stored notes per item under "notes_by_item" and had no counter.
            1 => {
                if let Some(obj) = v.as_object_mut() {
                    if let Some(n) = obj.remove("notes_by_item") {
                        obj.insert("item_notes".into(), n);
                    }
                    let count = ["findings", "timeline", "links", "requests", "captures", "custody"]
                        .iter()
                        .map(|k| obj.get(*k).and_then(|a| a.as_array()).map(|a| a.len()).unwrap_or(0))
                        .sum::<usize>();
                    obj.insert("counter".into(), Value::from(count as u64 + 100));
                }
            }
            // Version 2 had no statement links, map pins or score settings. Defaults fill them in.
            2 => {}
            _ => {}
        }
        ver += 1;
        v["save_version"] = Value::from(ver);
    }
    Ok(v)
}
