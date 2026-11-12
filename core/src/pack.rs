//! Opening, checking and installing case packs.
//!
//! Every pack is treated as untrusted. The steps follow section 6.2 of the
//! project plan: size and type checks, safe unzip, manifest hashes, schema
//! validation, cross references, then a summary for the player to confirm.

use crate::model::*;
use crate::util::{read_json, sha256_hex, write_json};
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{Cursor, Read};
use std::path::{Component, Path, PathBuf};

pub const SUPPORTED_MAJOR: u32 = 1;
pub const MAX_PACK_BYTES: usize = 50 * 1024 * 1024;
pub const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
pub const MAX_FILES: usize = 600;
pub const ALLOWED_EXT: &[&str] = &["json", "md", "csv", "txt", "eml", "svg", "png", "jpg", "jpeg"];
pub const REQUIRED: &[&str] = &[
    "manifest.json",
    "brief.md",
    "intake.json",
    "stages.json",
    "entities.json",
    "evidence/evidence.json",
    "rules.json",
    "solution.json",
];

const SCHEMAS: &[(&str, &str)] = &[
    ("manifest.json", include_str!("../../schemas/manifest.schema.json")),
    ("intake.json", include_str!("../../schemas/intake.schema.json")),
    ("stages.json", include_str!("../../schemas/stages.schema.json")),
    ("entities.json", include_str!("../../schemas/entities.schema.json")),
    ("evidence/evidence.json", include_str!("../../schemas/evidence.schema.json")),
    ("osint/osint.json", include_str!("../../schemas/osint.schema.json")),
    ("map/map.json", include_str!("../../schemas/map.schema.json")),
    ("rules.json", include_str!("../../schemas/rules.schema.json")),
    ("solution.json", include_str!("../../schemas/solution.schema.json")),
    ("statements.json", include_str!("../../schemas/statements.schema.json")),
];

#[derive(Debug, Clone, Serialize)]
pub struct PackSummary {
    pub id: String,
    pub title: String,
    pub version: String,
    pub author: String,
    pub licence: String,
    pub specialty: String,
    pub difficulty: String,
    pub estimated_minutes: u32,
    pub summary: String,
    pub items: usize,
    pub stages: usize,
    pub osint_pages: usize,
    pub files: usize,
    pub warnings: Vec<String>,
}

/// Unzip a pack into `dest` with every safety rule switched on.
pub fn safe_unzip(bytes: &[u8], dest: &Path) -> Result<Vec<String>, Vec<String>> {
    if bytes.len() > MAX_PACK_BYTES {
        return Err(vec![format!("The pack is larger than {} MB.", MAX_PACK_BYTES / 1024 / 1024)]);
    }
    if bytes.len() < 4 || &bytes[0..2] != b"PK" {
        return Err(vec!["This file is not a case pack. A .invcase file is a zip archive.".into()]);
    }
    let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| vec![format!("The archive could not be read: {e}")])?;
    let mut errors = vec![];
    let mut names = vec![];
    let count = (0..zip.len()).filter(|i| zip.by_index(*i).map(|f| !f.is_dir()).unwrap_or(false)).count();
    if count > MAX_FILES {
        return Err(vec![format!("The pack holds {count} files. The limit is {MAX_FILES}.")]);
    }
    for i in 0..zip.len() {
        let mut f = match zip.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                errors.push(format!("Entry {i} could not be read: {e}"));
                continue;
            }
        };
        if f.is_dir() {
            continue;
        }
        let raw = f.name().map(|n| n.to_string()).unwrap_or_default();
        let enclosed = f.enclosed_name();
        let unsafe_name = raw.starts_with('/')
            || raw.contains('\\')
            || raw.contains(':')
            || raw.split('/').any(|p| p == ".." || p.is_empty())
            || enclosed.is_none();
        if unsafe_name {
            return Err(vec![format!("Blocked an unsafe path in the archive: {raw}")]);
        }
        let rel = enclosed.unwrap();
        if rel.components().any(|c| !matches!(c, Component::Normal(_))) {
            return Err(vec![format!("Blocked an unsafe path in the archive: {raw}")]);
        }
        let ext = rel.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if !ALLOWED_EXT.contains(&ext.as_str()) {
            errors.push(format!("{raw}: this file type is not allowed in packs. Packs hold data only."));
            continue;
        }
        if f.size() > MAX_FILE_BYTES {
            errors.push(format!("{raw}: larger than the per-file limit of {} MB.", MAX_FILE_BYTES / 1024 / 1024));
            continue;
        }
        let mut buf = Vec::new();
        if let Err(e) = (&mut f).take(MAX_FILE_BYTES + 1).read_to_end(&mut buf) {
            errors.push(format!("{raw}: could not be unpacked ({e})"));
            continue;
        }
        if buf.len() as u64 > MAX_FILE_BYTES {
            errors.push(format!("{raw}: larger than the per-file limit."));
            continue;
        }
        let target = dest.join(&rel);
        if !target.starts_with(dest) {
            return Err(vec![format!("Blocked an unsafe path in the archive: {raw}")]);
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| vec![e.to_string()])?;
        }
        fs::write(&target, &buf).map_err(|e| vec![e.to_string()])?;
        names.push(raw);
    }
    if errors.is_empty() { Ok(names) } else { Err(errors) }
}

fn list_files(root: &Path) -> BTreeMap<String, PathBuf> {
    fn walk(base: &Path, dir: &Path, out: &mut BTreeMap<String, PathBuf>) {
        if let Ok(rd) = fs::read_dir(dir) {
            for e in rd.flatten() {
                let p = e.path();
                if p.is_dir() {
                    walk(base, &p, out);
                } else if let Ok(rel) = p.strip_prefix(base) {
                    let key = rel.components().map(|c| c.as_os_str().to_string_lossy().to_string()).collect::<Vec<_>>().join("/");
                    out.insert(key, p);
                }
            }
        }
    }
    let mut out = BTreeMap::new();
    walk(root, root, &mut out);
    out
}

fn check_svg(text: &str) -> Option<&'static str> {
    let low = text.to_lowercase();
    if low.contains("<script") || low.contains("javascript:") || low.contains("<foreignobject") {
        return Some("contains scripting");
    }
    // on* event attributes
    let bytes = low.as_bytes();
    for i in 1..bytes.len().saturating_sub(3) {
        if bytes[i - 1].is_ascii_whitespace() && bytes[i] == b'o' && bytes[i + 1] == b'n' {
            let rest = &low[i + 2..];
            let name_len = rest.chars().take_while(|c| c.is_ascii_alphabetic()).count();
            if name_len > 0 && rest[name_len..].trim_start().starts_with('=') {
                return Some("contains an event handler attribute");
            }
        }
    }
    for pat in ["href=\"http", "href='http", "href=\"//", "src=\"http", "xlink:href=\"http", "url(http"] {
        if low.contains(pat) {
            return Some("refers to an external resource");
        }
    }
    None
}

/// Check an unpacked pack folder. Returns the loaded case on success.
pub fn verify_dir(root: &Path) -> Result<(CaseData, Vec<String>), Vec<String>> {
    let files = list_files(root);
    let mut errors: Vec<String> = vec![];
    let mut warnings: Vec<String> = vec![];
    for req in REQUIRED {
        if !files.contains_key(*req) {
            errors.push(format!("Missing required file: {req}"));
        }
    }
    if !errors.is_empty() {
        return Err(errors);
    }

    // Manifest first, so the schema version can be checked before anything else.
    let manifest_v: Value = match fs::read(&files["manifest.json"]).ok().and_then(|b| serde_json::from_slice(&b).ok()) {
        Some(v) => v,
        None => return Err(vec!["manifest.json is not valid JSON.".into()]),
    };
    if let Some(ver) = manifest_v.get("schema_version").and_then(|v| v.as_str()) {
        let major: u32 = ver.split('.').next().and_then(|m| m.parse().ok()).unwrap_or(0);
        if major > SUPPORTED_MAJOR {
            return Err(vec![format!(
                "This pack was built for schema version {ver}, which is newer than this app supports ({SUPPORTED_MAJOR}.x). Update Investafiction to open it."
            )]);
        }
        if major < SUPPORTED_MAJOR {
            return Err(vec![format!("This pack uses schema version {ver}, which is too old to upgrade.")]);
        }
    }

    // Hash every file against the manifest.
    let listed: BTreeMap<String, String> = manifest_v
        .get("files")
        .and_then(|f| serde_json::from_value(f.clone()).ok())
        .unwrap_or_default();
    for (rel, path) in &files {
        if rel == "manifest.json" {
            continue;
        }
        match listed.get(rel) {
            None => errors.push(format!("{rel} is in the pack but not in the manifest hash list.")),
            Some(h) => {
                let actual = fs::read(path).map(|b| sha256_hex(&b)).unwrap_or_default();
                if &actual != h {
                    errors.push(format!("{rel} does not match its manifest hash. The pack may have been changed or damaged."));
                }
            }
        }
        if rel.ends_with(".svg") {
            if let Ok(t) = fs::read_to_string(path) {
                if let Some(why) = check_svg(&t) {
                    errors.push(format!("{rel} {why}, which packs may not include."));
                }
            }
        }
    }
    for rel in listed.keys() {
        if !files.contains_key(rel) {
            errors.push(format!("The manifest lists {rel} but the file is missing."));
        }
    }

    // Schemas
    let mut parsed: BTreeMap<&str, Value> = BTreeMap::new();
    for (rel, schema_text) in SCHEMAS {
        let Some(path) = files.get(*rel) else { continue };
        let value: Value = match fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()) {
            Some(v) => v,
            None => {
                errors.push(format!("{rel} is not valid JSON."));
                continue;
            }
        };
        let schema: Value = serde_json::from_str(schema_text).expect("bundled schema is valid JSON");
        let validator = jsonschema::options().should_validate_formats(true).build(&schema).expect("bundled schema compiles");
        let mut n = 0;
        for e in validator.iter_errors(&value) {
            n += 1;
            if n <= 15 {
                let loc = e.instance_path().to_string();
                errors.push(format!("{rel} at {}: {e}", if loc.is_empty() { "/" } else { &loc }));
            }
        }
        if n > 15 {
            errors.push(format!("{rel}: {} more schema errors not shown.", n - 15));
        }
        parsed.insert(rel, value);
    }
    if !errors.is_empty() {
        return Err(errors);
    }

    let take = |k: &str| parsed.get(k).cloned().unwrap();
    let case = CaseData {
        dir: root.to_path_buf(),
        manifest: serde_json::from_value(take("manifest.json")).map_err(|e| vec![e.to_string()])?,
        brief: fs::read_to_string(&files["brief.md"]).map_err(|e| vec![e.to_string()])?,
        intake: serde_json::from_value(take("intake.json")).map_err(|e| vec![e.to_string()])?,
        stages: serde_json::from_value(take("stages.json")).map_err(|e| vec![e.to_string()])?,
        entities: serde_json::from_value::<Entities>(take("entities.json")).map_err(|e| vec![e.to_string()])?.entities,
        evidence: serde_json::from_value::<EvidenceRegister>(take("evidence/evidence.json")).map_err(|e| vec![e.to_string()])?.items,
        osint: match parsed.get("osint/osint.json") {
            Some(v) => serde_json::from_value(v.clone()).map_err(|e| vec![e.to_string()])?,
            None => Osint::default(),
        },
        map: match parsed.get("map/map.json") {
            Some(v) => Some(serde_json::from_value(v.clone()).map_err(|e| vec![e.to_string()])?),
            None => None,
        },
        statements: match parsed.get("statements.json") {
            Some(v) => serde_json::from_value::<Statements>(v.clone()).map_err(|e| vec![e.to_string()])?.statements,
            None => vec![],
        },
        rules: serde_json::from_value(take("rules.json")).map_err(|e| vec![e.to_string()])?,
        solution: serde_json::from_value(take("solution.json")).map_err(|e| vec![e.to_string()])?,
        import_hashes: listed.clone(),
    };
    cross_refs(&case, &files, &mut errors, &mut warnings);
    if errors.is_empty() { Ok((case, warnings)) } else { Err(errors) }
}

fn cross_refs(c: &CaseData, files: &BTreeMap<String, PathBuf>, errors: &mut Vec<String>, warnings: &mut Vec<String>) {
    let items: BTreeSet<&str> = c.evidence.iter().map(|e| e.id.as_str()).collect();
    let pages: BTreeSet<&str> = c.osint.pages.iter().map(|p| p.id.as_str()).collect();
    let ents: BTreeSet<&str> = c.entities.iter().map(|e| e.id.as_str()).collect();
    let stage_ids: Vec<&str> = c.stages.stages.iter().map(|s| s.id.as_str()).collect();
    let cite_ok = |id: &str| items.contains(id) || pages.contains(id);

    if items.len() != c.evidence.len() {
        errors.push("Two evidence items share the same id.".into());
    }
    if ents.len() != c.entities.len() {
        errors.push("Two entities share the same id.".into());
    }
    for e in &c.evidence {
        if !files.contains_key(&e.file) {
            errors.push(format!("{}: its file {} is missing.", e.id, e.file));
        }
    }
    let mut released: BTreeMap<&str, usize> = BTreeMap::new();
    for s in &c.stages.stages {
        for e in &s.evidence {
            *released.entry(e.as_str()).or_default() += 1;
            if !items.contains(e.as_str()) {
                errors.push(format!("Stage {} releases unknown evidence {e}.", s.id));
            }
        }
        for p in &s.osint_pages {
            if !pages.contains(p.as_str()) {
                errors.push(format!("Stage {} releases unknown page {p}.", s.id));
            }
        }
    }
    for r in &c.rules.request_rules {
        if c.request_type(&r.request_type).is_none() {
            errors.push(format!("{}: unknown request type {}.", r.id, r.request_type));
        }
        for t in &r.targets {
            if !ents.contains(t.as_str()) {
                errors.push(format!("{}: unknown target {t}.", r.id));
            }
        }
        for e in &r.releases.evidence {
            *released.entry(e.as_str()).or_default() += 1;
        }
    }
    for e in &c.evidence {
        let n = released.get(e.id.as_str()).copied().unwrap_or(0);
        if n != 1 {
            errors.push(format!("{} must be released in exactly one stage or request, found {n}.", e.id));
        }
    }
    for r in &c.stages.request_types {
        if !stage_ids.contains(&r.available_from.as_str()) {
            errors.push(format!("{}: unknown stage {}.", r.id, r.available_from));
        }
    }
    for f in &c.solution.findings {
        for e in &f.evidence_any {
            if !cite_ok(e) {
                errors.push(format!("Solution finding {} names unknown evidence {e}.", f.id));
            }
        }
    }
    for l in &c.solution.links {
        for end in [&l.a, &l.b] {
            if !ents.contains(end.as_str()) {
                errors.push(format!("A solution link uses an entity that is not defined: {end}."));
            }
        }
        for e in &l.evidence_any {
            if !cite_ok(e) {
                errors.push(format!("A solution link cites unknown evidence {e}."));
            }
        }
    }
    for t in &c.solution.timeline {
        for e in &t.evidence_any {
            if !cite_ok(e) {
                errors.push(format!("Timeline event {} cites unknown evidence {e}.", t.id));
            }
        }
    }
    for s in &c.stages.stages {
        for o in &s.objectives {
            if !c.solution.objective_checks.contains_key(&o.id) {
                errors.push(format!("Objective {} has no check in the solution file.", o.id));
            }
            if !c.solution.hints.contains_key(&o.id) {
                warnings.push(format!("Objective {} has no hints.", o.id));
            }
        }
    }
    for s in c.stages.stages.iter().skip(1) {
        if !c.solution.stage_unlocks.contains_key(&s.id) {
            errors.push(format!("Stage {} has no unlock condition.", s.id));
        }
    }
    // Statements and the checks that mark them
    let mut claim_ids = BTreeSet::new();
    for st in &c.statements {
        if !items.contains(st.evidence.as_str()) {
            errors.push(format!("Statement {} points to unknown evidence {}.", st.id, st.evidence));
        }
        for cl in &st.claims {
            if !cl.id.starts_with(&format!("{}.", st.id)) {
                errors.push(format!("Claim {} must start with its statement id {}.", cl.id, st.id));
            }
            if !claim_ids.insert(cl.id.as_str()) {
                errors.push(format!("Claim {} is defined twice.", cl.id));
            }
            if let Some(pl) = &cl.place {
                if !c.map.as_ref().map(|m| m.locations.iter().any(|l| &l.id == pl)).unwrap_or(false) {
                    errors.push(format!("Claim {} names a place that is not on the map: {pl}.", cl.id));
                }
            }
            if let Some(t) = &cl.time {
                if crate::util::parse_time(t).is_none() {
                    errors.push(format!("Claim {} has a time that cannot be read.", cl.id));
                }
            }
            for e in &cl.entities {
                if !ents.contains(e.as_str()) {
                    errors.push(format!("Claim {} names an unknown entity {e}.", cl.id));
                }
            }
        }
    }
    for chk in &c.solution.statement_checks {
        if !claim_ids.contains(chk.claim.as_str()) {
            errors.push(format!("Statement check {} names unknown claim {}.", chk.id, chk.claim));
        }
        if let Some(o) = &chk.other_claim {
            if !claim_ids.contains(o.as_str()) {
                errors.push(format!("Statement check {} names unknown claim {o}.", chk.id));
            }
        }
        if matches!(chk.relation.as_str(), "conflicts" | "agrees") && chk.other_claim.is_none() {
            errors.push(format!("Statement check {} needs a second claim.", chk.id));
        }
        if matches!(chk.relation.as_str(), "contradicted" | "supported") && chk.evidence.is_empty() {
            errors.push(format!("Statement check {} needs evidence.", chk.id));
        }
        for e in &chk.evidence {
            if !cite_ok(e) {
                errors.push(format!("Statement check {} cites unknown evidence {e}.", chk.id));
            }
        }
    }
    for r in &c.solution.route {
        if !stage_ids.contains(&r.stage.as_str()) {
            errors.push(format!("Suggested route step '{}' names unknown stage {}.", r.label, r.stage));
        }
    }
    for p in &c.osint.pages {
        if !c.osint.sites.iter().any(|s| s.id == p.site) {
            errors.push(format!("Page {} belongs to unknown site {}.", p.id, p.site));
        }
    }
    for img in &c.osint.images {
        if !files.contains_key(&img.file) {
            errors.push(format!("OSINT image {} is missing.", img.file));
        }
    }
}

pub fn summary_of(c: &CaseData, warnings: Vec<String>) -> PackSummary {
    PackSummary {
        id: c.manifest.id.clone(),
        title: c.manifest.title.clone(),
        version: c.manifest.version.clone(),
        author: c.manifest.author.clone(),
        licence: c.manifest.licence.clone(),
        specialty: c.manifest.specialty.clone(),
        difficulty: c.manifest.difficulty.clone(),
        estimated_minutes: c.manifest.estimated_minutes,
        summary: c.manifest.summary.clone(),
        items: c.evidence.len(),
        stages: c.stages.stages.len(),
        osint_pages: c.osint.pages.len(),
        files: c.manifest.files.len() + 1,
        warnings,
    }
}

/// Where the import record for an installed case is kept. It sits next to
/// the case folder, not inside it, so the folder still matches its manifest.
pub fn import_record_path(dir: &Path) -> PathBuf {
    let name = dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    dir.with_file_name(format!("{name}.import.json"))
}

/// Load an installed case. Packs are checked again on load, so a pack that
/// was changed on disk after import is refused rather than shown.
pub fn load_installed(dir: &Path) -> Result<CaseData, Vec<String>> {
    let (mut case, _) = verify_dir(dir)?;
    if let Ok(v) = read_json::<BTreeMap<String, String>>(&import_record_path(dir)) {
        case.import_hashes = v;
    }
    Ok(case)
}

pub fn record_import_hashes(dir: &Path, case: &CaseData) -> std::io::Result<()> {
    write_json(&import_record_path(dir), &case.manifest.files)
}
