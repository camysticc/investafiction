//! Types for the files inside a case pack. The JSON Schemas in /schemas are
//! the source of truth; these structs mirror them. Validation against the
//! schemas happens in `pack.rs` before anything is deserialised here.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub schema_version: String,
    pub id: String,
    pub title: String,
    pub version: String,
    pub author: String,
    pub licence: String,
    #[serde(default)]
    pub assets_licence: String,
    pub specialty: String,
    pub difficulty: String,
    pub estimated_minutes: u32,
    #[serde(default)]
    pub seed: i64,
    #[serde(default)]
    pub summary: String,
    pub files: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Authority {
    pub id: String,
    pub label: String,
    pub covers: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Intake {
    pub tasking: String,
    pub scope: Vec<String>,
    pub out_of_scope: Vec<String>,
    pub authorities: Vec<Authority>,
    pub constraints: Vec<String>,
    pub clock_start: String,
    pub case_lead: String,
    #[serde(default)]
    pub osint_access: Option<String>,
    #[serde(default)]
    pub subjects: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Objective {
    pub id: String,
    pub text: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stage {
    pub id: String,
    pub title: String,
    pub target_minutes: u32,
    #[serde(default)]
    pub unlock_text: String,
    pub message: String,
    pub evidence: Vec<String>,
    #[serde(default)]
    pub osint_pages: Vec<String>,
    pub objectives: Vec<Objective>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestType {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(default)]
    pub description: String,
    pub target_kinds: Vec<String>,
    pub available_from: String,
    pub needs_dates: bool,
    #[serde(default)]
    pub allow_all: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stages {
    pub stages: Vec<Stage>,
    pub request_types: Vec<RequestType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entity {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(default)]
    pub role: String,
    #[serde(default)]
    pub identifiers: Vec<String>,
    #[serde(default)]
    pub attributes: BTreeMap<String, String>,
    #[serde(default)]
    pub hidden_until: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entities {
    pub entities: Vec<Entity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustodyStep {
    pub time: String,
    pub action: String,
    pub by: String,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TableInfo {
    #[serde(default)]
    pub time_column: Option<String>,
    #[serde(default)]
    pub entity_columns: Vec<String>,
    #[serde(default)]
    pub location_column: Option<String>,
    #[serde(default)]
    pub x_column: Option<String>,
    #[serde(default)]
    pub y_column: Option<String>,
    #[serde(default)]
    pub map_entity: Option<String>,
    #[serde(default)]
    pub description_columns: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceItem {
    pub id: String,
    pub title: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub file: String,
    pub source: String,
    pub source_group: String,
    pub acquired: String,
    #[serde(default)]
    pub acquired_by: String,
    #[serde(default)]
    pub summary: String,
    pub original_hash: String,
    pub custody: Vec<CustodyStep>,
    #[serde(default)]
    pub clock_offset_minutes: Option<i64>,
    #[serde(default)]
    pub clock_note: String,
    #[serde(default)]
    pub timezone_note: String,
    #[serde(default)]
    pub handling: String,
    #[serde(default = "default_marking")]
    pub marking: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
    #[serde(default)]
    pub table: Option<TableInfo>,
}

fn default_marking() -> String {
    "none".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceRegister {
    pub items: Vec<EvidenceItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Site {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub kind: String,
    #[serde(default)]
    pub colour: Option<String>,
    #[serde(default)]
    pub tagline: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub id: String,
    pub site: String,
    pub url: String,
    pub kind: String,
    pub title: String,
    #[serde(default)]
    pub handle: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub avatar: String,
    #[serde(default)]
    pub bio: String,
    #[serde(default)]
    pub private: bool,
    #[serde(default)]
    pub fields: BTreeMap<String, String>,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub posts: Vec<serde_json::Value>,
    #[serde(default)]
    pub connections: Vec<String>,
    #[serde(default)]
    pub links: Vec<String>,
    #[serde(default)]
    pub search_terms: Vec<String>,
    #[serde(default)]
    pub snapshots: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsintImage {
    pub file: String,
    #[serde(default)]
    pub metadata: BTreeMap<String, String>,
    #[serde(default)]
    pub licence: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Osint {
    pub sites: Vec<Site>,
    pub pages: Vec<Page>,
    #[serde(default)]
    pub images: Vec<OsintImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapLocation {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub x: f64,
    pub y: f64,
    #[serde(default)]
    pub radius: Option<f64>,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub stage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MapData {
    pub name: String,
    pub width: f64,
    pub height: f64,
    pub features: Vec<serde_json::Value>,
    pub locations: Vec<MapLocation>,
}

/// A condition used for objective checks, stage unlocks and similar tests.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Condition {
    pub kind: String,
    #[serde(default)]
    pub of: Vec<Condition>,
    #[serde(default)]
    pub ids: Vec<String>,
    #[serde(default)]
    pub all_released: bool,
    #[serde(default)]
    pub min: Option<usize>,
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub request: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub a: Option<String>,
    #[serde(default)]
    pub b: Option<String>,
    #[serde(default)]
    pub pages: Vec<String>,
    #[serde(default)]
    pub stage: Option<String>,
}

pub type Keywords = Vec<Vec<String>>;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Trigger {
    pub kind: String,
    #[serde(default)]
    pub ids: Vec<String>,
    #[serde(default)]
    pub pages: Vec<String>,
    #[serde(default)]
    pub max_views: Option<u32>,
    #[serde(default)]
    pub unless_authority: Option<String>,
    #[serde(default)]
    pub keywords: Keywords,
    #[serde(default)]
    pub types: Vec<String>,
    #[serde(default)]
    pub contradicting: Vec<String>,
    #[serde(default)]
    pub offset_minutes: Option<i64>,
    #[serde(default)]
    pub tolerance_minutes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trap {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub category: String,
    pub trigger: Trigger,
    pub penalty: f64,
    pub severity: String,
    pub lesson: String,
    #[serde(default)]
    pub warning: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Releases {
    #[serde(default)]
    pub evidence: Vec<String>,
    #[serde(default)]
    pub authority: Option<String>,
    #[serde(default)]
    pub osint_pages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestRule {
    pub id: String,
    pub request_type: String,
    pub targets: Vec<String>,
    #[serde(default)]
    pub must_cover: Vec<String>,
    #[serde(default)]
    pub max_days: Option<i64>,
    #[serde(default)]
    pub justification: Keywords,
    #[serde(default)]
    pub min_groups: Option<usize>,
    pub releases: Releases,
    pub grant_message: String,
    #[serde(default)]
    pub refuse_broad: String,
    #[serde(default)]
    pub refuse_dates: String,
    #[serde(default)]
    pub refuse_justification: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rules {
    pub traps: Vec<Trap>,
    pub request_rules: Vec<RequestRule>,
    #[serde(default = "two")]
    pub broad_request_penalty: f64,
    #[serde(default = "one")]
    pub unfounded_request_penalty: f64,
}

fn two() -> f64 {
    2.0
}
fn one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyFinding {
    pub id: String,
    pub required: bool,
    #[serde(default)]
    pub stage: Option<String>,
    pub statement: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub evidence_any: Vec<String>,
    pub min_sources: usize,
    pub keywords: Keywords,
    pub explain: String,
    /// osint, evidence, analysis, reporting or procedure. Used by the skills dashboard.
    #[serde(default)]
    pub skill: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatementCheck {
    pub id: String,
    pub claim: String,
    #[serde(default)]
    pub other_claim: Option<String>,
    #[serde(default)]
    pub evidence: Vec<String>,
    /// conflicts (with other_claim), contradicted or supported (by evidence), agrees (with other_claim)
    pub relation: String,
    pub explain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteStep {
    pub stage: String,
    pub label: String,
    pub note: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Claim {
    pub id: String,
    pub text: String,
    #[serde(default)]
    pub time: Option<String>,
    #[serde(default)]
    pub place: Option<String>,
    #[serde(default)]
    pub entities: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Statement {
    pub id: String,
    pub evidence: String,
    pub witness: String,
    pub role: String,
    pub date: String,
    pub claims: Vec<Claim>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Statements {
    pub statements: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolutionLink {
    pub a: String,
    pub b: String,
    pub evidence_any: Vec<String>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrueEvent {
    pub id: String,
    pub time: String,
    pub label: String,
    pub evidence_any: Vec<String>,
    pub tolerance_minutes: i64,
    #[serde(default)]
    pub key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Herring {
    pub id: String,
    pub label: String,
    pub evidence: Vec<String>,
    pub keywords: Keywords,
    pub explain: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExpectedGrade {
    pub source: String,
    pub info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gap {
    pub id: String,
    pub label: String,
    pub keywords: Keywords,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Solution {
    pub findings: Vec<KeyFinding>,
    pub links: Vec<SolutionLink>,
    pub timeline: Vec<TrueEvent>,
    pub herrings: Vec<Herring>,
    pub grades: BTreeMap<String, ExpectedGrade>,
    pub objective_checks: BTreeMap<String, Condition>,
    pub stage_unlocks: BTreeMap<String, Condition>,
    pub hints: BTreeMap<String, Vec<String>>,
    pub noise: Vec<String>,
    pub gaps: Vec<Gap>,
    pub next_steps: String,
    #[serde(default)]
    pub story: String,
    #[serde(default)]
    pub statement_checks: Vec<StatementCheck>,
    #[serde(default)]
    pub route: Vec<RouteStep>,
}

/// Everything loaded from an installed case folder.
#[derive(Debug, Clone)]
pub struct CaseData {
    pub dir: std::path::PathBuf,
    pub manifest: Manifest,
    pub brief: String,
    pub intake: Intake,
    pub stages: Stages,
    pub entities: Vec<Entity>,
    pub evidence: Vec<EvidenceItem>,
    pub osint: Osint,
    pub map: Option<MapData>,
    pub statements: Vec<Statement>,
    pub rules: Rules,
    pub solution: Solution,
    /// Hashes recorded when the pack was imported, by relative path.
    pub import_hashes: BTreeMap<String, String>,
}

impl CaseData {
    pub fn item(&self, id: &str) -> Option<&EvidenceItem> {
        self.evidence.iter().find(|e| e.id == id)
    }
    pub fn page(&self, id: &str) -> Option<&Page> {
        self.osint.pages.iter().find(|p| p.id == id)
    }
    pub fn entity(&self, id: &str) -> Option<&Entity> {
        self.entities.iter().find(|e| e.id == id)
    }
    pub fn stage_index(&self, id: &str) -> Option<usize> {
        self.stages.stages.iter().position(|s| s.id == id)
    }
    pub fn claim(&self, id: &str) -> Option<(&Statement, &Claim)> {
        self.statements.iter().find_map(|s| s.claims.iter().find(|c| c.id == id).map(|c| (s, c)))
    }
    pub fn is_statement_doc(&self, evidence: &str) -> bool {
        self.statements.iter().any(|s| s.evidence == evidence)
    }
    pub fn request_type(&self, id: &str) -> Option<&RequestType> {
        self.stages.request_types.iter().find(|r| r.id == id)
    }
}

/// Lower-case keyword match: every group must have at least one hit.
pub fn keywords_match(text: &str, groups: &Keywords) -> bool {
    if groups.is_empty() {
        return false;
    }
    let low = text.to_lowercase();
    groups.iter().all(|g| g.iter().any(|alt| low.contains(&alt.to_lowercase())))
}

pub fn keyword_groups_hit(text: &str, groups: &Keywords) -> usize {
    let low = text.to_lowercase();
    groups.iter().filter(|g| g.iter().any(|alt| low.contains(&alt.to_lowercase()))).count()
}
