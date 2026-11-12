//! The game engine. It owns the open case and attempt, applies every player
//! action, writes the audit trail, checks traps and objectives, and keeps
//! the answer key away from the interface until the report is submitted.

use crate::attempt::*;
use crate::model::*;
use crate::pack;
use crate::scoring;
use crate::util::*;
use base64::Engine as _;
use chrono::{Duration, Utc};
use serde::Serialize;
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};

pub const PRESET_NAMES: [&str; 3] = ["Officer Smith", "Detective Jones", "Sergeant Nolan"];
pub const HINT_COST: [f64; 3] = [0.5, 1.0, 1.5];

#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    pub message: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub details: Vec<String>,
}

impl ApiError {
    pub fn new(m: impl Into<String>) -> Self {
        ApiError { message: m.into(), details: vec![] }
    }
    pub fn with(m: impl Into<String>, details: Vec<String>) -> Self {
        ApiError { message: m.into(), details }
    }
}

impl From<std::io::Error> for ApiError {
    fn from(e: std::io::Error) -> Self {
        ApiError::new(e.to_string())
    }
}

pub type R<T> = Result<T, ApiError>;

fn bad(m: impl Into<String>) -> ApiError {
    ApiError::new(m)
}

pub struct Session {
    pub case: CaseData,
    pub attempt: Attempt,
    pub player: String,
}

pub struct Engine {
    pub data_dir: PathBuf,
    pub session: Option<Session>,
    pending: BTreeMap<String, PathBuf>,
    pending_n: u64,
}

/// Outcome of an action: notices for the player, and an optional warning
/// that needs confirmation (training mode) before the action goes ahead.
#[derive(Default)]
pub struct Outcome {
    pub notices: Vec<String>,
    pub warning: Option<String>,
    pub result: Value,
}

impl Outcome {
    fn warn(text: impl Into<String>) -> Self {
        Outcome { warning: Some(text.into()), ..Default::default() }
    }
}

impl Engine {
    pub fn new(data_dir: impl Into<PathBuf>) -> Self {
        let data_dir = data_dir.into();
        let _ = fs::create_dir_all(data_dir.join("cases"));
        let _ = fs::create_dir_all(data_dir.join("saves"));
        Engine { data_dir, session: None, pending: BTreeMap::new(), pending_n: 0 }
    }

    // ---------------------------------------------------------------- profile
    fn profile_path(&self) -> PathBuf {
        self.data_dir.join("profile.json")
    }

    /// The profile, or None when it is missing or damaged. In that case the
    /// welcome screen shows again. Saves are separate files and are kept.
    pub fn profile(&self) -> Option<Value> {
        let v: Value = read_json(&self.profile_path()).ok()?;
        let name = v.get("name")?.as_str()?;
        if !PRESET_NAMES.contains(&name) || v.get("first_launch_done")?.as_bool() != Some(true) {
            return None;
        }
        Some(v)
    }

    pub fn player_name(&self) -> String {
        self.profile()
            .and_then(|p| p.get("name").and_then(|n| n.as_str()).map(String::from))
            .unwrap_or_else(|| "Analyst".into())
    }

    pub fn set_profile(&mut self, name: &str, text_scale: Option<f64>) -> R<Value> {
        if !PRESET_NAMES.contains(&name) {
            return Err(bad("Choose one of the three preset names."));
        }
        let created = self
            .profile()
            .and_then(|p| p.get("created").and_then(|c| c.as_str()).map(String::from))
            .unwrap_or_else(now_iso);
        let scale = text_scale
            .or_else(|| self.profile().and_then(|p| p.get("text_scale").and_then(|s| s.as_f64())))
            .unwrap_or(1.0)
            .clamp(0.8, 1.6);
        let v = json!({"name": name, "first_launch_done": true, "created": created, "text_scale": scale});
        write_json(&self.profile_path(), &v)?;
        if let Some(s) = self.session.as_mut() {
            s.player = name.to_string();
        }
        Ok(v)
    }

    // ---------------------------------------------------------------- library
    fn case_dir(&self, id: &str) -> PathBuf {
        self.data_dir.join("cases").join(id)
    }

    fn save_dir(&self, case_id: &str) -> PathBuf {
        self.data_dir.join("saves").join(case_id)
    }

    pub fn library(&self) -> Value {
        let mut out = vec![];
        if let Ok(rd) = fs::read_dir(self.data_dir.join("cases")) {
            let mut dirs: Vec<_> = rd.flatten().filter(|e| e.path().is_dir()).collect();
            dirs.sort_by_key(|e| e.file_name());
            for d in dirs {
                let Ok(m) = read_json::<Manifest>(&d.path().join("manifest.json")) else { continue };
                let attempts = self.list_attempts(&m.id);
                out.push(json!({
                    "id": m.id, "title": m.title, "version": m.version, "specialty": m.specialty,
                    "difficulty": m.difficulty, "estimated_minutes": m.estimated_minutes, "summary": m.summary,
                    "author": m.author, "licence": m.licence, "attempts": attempts,
                }));
            }
        }
        let rank = |d: &Value| match d["difficulty"].as_str() { Some("Beginner") => 0, Some("Intermediate") => 1, Some("Hard") => 2, _ => 3 };
        out.sort_by_key(|c| (rank(c), c["title"].as_str().unwrap_or("").to_string()));
        Value::Array(out)
    }

    fn list_attempts(&self, case_id: &str) -> Vec<Value> {
        let mut v = vec![];
        if let Ok(rd) = fs::read_dir(self.save_dir(case_id)) {
            for e in rd.flatten() {
                let p = e.path();
                if p.extension().and_then(|x| x.to_str()) != Some("json") {
                    continue;
                }
                let Ok(raw) = read_json::<Value>(&p) else { continue };
                let Ok(raw) = migrate(raw) else { continue };
                let Ok(a) = serde_json::from_value::<Attempt>(raw) else { continue };
                let result = a.result.as_ref();
                v.push(json!({
                    "id": a.id, "mode": a.mode, "started": a.started, "updated": a.updated,
                    "active_seconds": a.active_seconds, "submitted": a.submitted,
                    "stage": a.open_stages.last().cloned().unwrap_or_default(),
                    "score": result.and_then(|r| r.get("total")).cloned(),
                    "band": result.and_then(|r| r.get("band")).cloned(),
                }));
            }
        }
        v.sort_by(|a, b| b["updated"].as_str().cmp(&a["updated"].as_str()));
        v
    }

    /// Steps 2 to 7 of the import process. The pack is unpacked into a
    /// temporary folder and checked. Nothing is added to the library yet.
    pub fn inspect_pack(&mut self, bytes: &[u8]) -> R<Value> {
        self.pending_n += 1;
        let token = format!("p{}-{}", Utc::now().timestamp_millis(), self.pending_n);
        let tmp = self.data_dir.join("tmp").join(&token);
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp)?;
        if let Err(errs) = pack::safe_unzip(bytes, &tmp) {
            let _ = fs::remove_dir_all(&tmp);
            return Err(ApiError::with("The pack was rejected. Nothing has been added.", errs));
        }
        match pack::verify_dir(&tmp) {
            Ok((case, warnings)) => {
                let summary = pack::summary_of(&case, warnings);
                let exists = self.case_dir(&case.manifest.id).exists();
                let installed_version = read_json::<Manifest>(&self.case_dir(&case.manifest.id).join("manifest.json")).ok().map(|m| m.version);
                self.pending.insert(token.clone(), tmp);
                Ok(json!({"token": token, "summary": summary, "already_installed": exists, "installed_version": installed_version}))
            }
            Err(errs) => {
                let _ = fs::remove_dir_all(&tmp);
                Err(ApiError::with("The pack was rejected. Nothing has been added.", errs))
            }
        }
    }

    pub fn install_pack(&mut self, token: &str) -> R<Value> {
        let tmp = self.pending.remove(token).ok_or_else(|| bad("That import has expired. Choose the file again."))?;
        let (case, _) = pack::verify_dir(&tmp).map_err(|e| ApiError::with("The pack changed while waiting.", e))?;
        let id = case.manifest.id.clone();
        if !safe_id(&id) {
            return Err(bad("The case id is not valid."));
        }
        if self.session.as_ref().map(|s| s.case.manifest.id == id).unwrap_or(false) {
            self.session = None;
        }
        let dest = self.case_dir(&id);
        let _ = fs::remove_dir_all(&dest);
        fs::create_dir_all(dest.parent().unwrap())?;
        if fs::rename(&tmp, &dest).is_err() {
            copy_dir(&tmp, &dest)?;
            let _ = fs::remove_dir_all(&tmp);
        }
        pack::record_import_hashes(&dest, &case)?;
        Ok(json!({"installed": id}))
    }

    pub fn cancel_pending(&mut self, token: &str) {
        if let Some(p) = self.pending.remove(token) {
            let _ = fs::remove_dir_all(p);
        }
    }

    pub fn remove_case(&mut self, id: &str) -> R<Value> {
        if !safe_id(id) {
            return Err(bad("Unknown case."));
        }
        if self.session.as_ref().map(|s| s.case.manifest.id == id).unwrap_or(false) {
            self.session = None;
        }
        let dir = self.case_dir(id);
        let _ = fs::remove_file(pack::import_record_path(&dir));
        fs::remove_dir_all(dir)?;
        Ok(json!({"removed": id, "saves_kept": true}))
    }

    // ---------------------------------------------------------------- attempts
    pub fn new_attempt(&mut self, case_id: &str, mode: &str, opts: &Value) -> R<Value> {
        if !safe_id(case_id) {
            return Err(bad("Unknown case."));
        }
        let case = pack::load_installed(&self.case_dir(case_id)).map_err(|e| ApiError::with("The case could not be opened.", e))?;
        let mode = if mode == "assessment" { "assessment" } else { "training" };
        let now = now_iso();
        let id = format!("A{}", Utc::now().format("%Y%m%d-%H%M%S%3f"));
        let attempt = Attempt {
            save_version: SAVE_VERSION,
            id: id.clone(),
            case_id: case_id.into(),
            case_version: case.manifest.version.clone(),
            mode: mode.into(),
            started: now.clone(),
            updated: now,
            active_seconds: 0,
            scope_acknowledged: false,
            open_stages: vec![],
            stage_opened_at: BTreeMap::new(),
            objectives_done: BTreeSet::new(),
            extra_evidence: vec![],
            extra_pages: vec![],
            unlocked_pages: BTreeSet::new(),
            persona_pages: BTreeSet::new(),
            custody: vec![],
            actions: vec![],
            notes: String::new(),
            item_notes: BTreeMap::new(),
            findings: vec![],
            timeline: vec![],
            links: vec![],
            grades: BTreeMap::new(),
            requests: vec![],
            authorities: case.intake.authorities.iter().map(|a| a.id.clone()).collect(),
            captures: vec![],
            page_views: BTreeMap::new(),
            hints: vec![],
            traps: vec![],
            warned: BTreeSet::new(),
            messages: vec![],
            report: Report { include_timeline: true, include_links: true, ..Default::default() },
            view: json!({}),
            integrity_reports: BTreeMap::new(),
            submitted: false,
            submitted_at: String::new(),
            result: None,
            counter: 0,
            claim_links: vec![],
            pins: vec![],
            score_settings: ScoreSettings {
                hints_available: if mode == "training" { opts.get("hints_available").and_then(|h| h.as_u64()).unwrap_or(3).min(3) as u8 } else { 0 },
                warnings: mode == "training" && opts.get("warnings").and_then(|w| w.as_bool()).unwrap_or(true),
            },
        };
        let player = self.player_name();
        let mut s = Session { case, attempt, player };
        let detail = format!("{mode} mode, hints {}, warnings {}", s.attempt.score_settings.hints_available, if s.attempt.score_settings.warnings { "on" } else { "off" });
        s.log("library", "attempt_started", case_id, &detail);
        s.save(&self.data_dir)?;
        self.session = Some(s);
        Ok(json!({"attempt_id": id}))
    }

    pub fn open_attempt(&mut self, case_id: &str, attempt_id: &str) -> R<Value> {
        if !safe_id(case_id) || !safe_id(attempt_id) {
            return Err(bad("Unknown attempt."));
        }
        let case = pack::load_installed(&self.case_dir(case_id)).map_err(|e| ApiError::with("The case could not be opened. It may have been changed on disk.", e))?;
        let raw: Value = read_json(&self.save_dir(case_id).join(format!("{attempt_id}.json"))).map_err(bad)?;
        let attempt: Attempt = serde_json::from_value(migrate(raw).map_err(bad)?).map_err(|e| bad(format!("The save could not be read: {e}")))?;
        let player = self.player_name();
        let mut s = Session { case, attempt, player };
        s.log("library", "attempt_resumed", attempt_id, "");
        s.save(&self.data_dir)?;
        self.session = Some(s);
        self.state()
    }

    pub fn delete_attempt(&mut self, case_id: &str, attempt_id: &str) -> R<Value> {
        if !safe_id(case_id) || !safe_id(attempt_id) {
            return Err(bad("Unknown attempt."));
        }
        if self.session.as_ref().map(|s| s.attempt.id == attempt_id).unwrap_or(false) {
            self.session = None;
        }
        fs::remove_file(self.save_dir(case_id).join(format!("{attempt_id}.json")))?;
        Ok(json!({"deleted": attempt_id}))
    }

    pub fn close(&mut self) -> R<Value> {
        if let Some(s) = self.session.as_mut() {
            s.log("workspace", "attempt_closed", "", "");
            s.save(&self.data_dir)?;
        }
        self.session = None;
        Ok(json!({"closed": true}))
    }

    fn sess(&mut self) -> R<&mut Session> {
        self.session.as_mut().ok_or_else(|| bad("No case is open."))
    }

    pub fn state(&mut self) -> R<Value> {
        let profile = self.profile();
        let s = self.sess()?;
        Ok(s.state_json(profile))
    }

    /// Apply an action, save, and return the new state with any notices.
    pub fn act(&mut self, args: &Value) -> R<Value> {
        let data_dir = self.data_dir.clone();
        let profile = self.profile();
        let s = self.sess()?;
        let kind = args.get("type").and_then(|t| t.as_str()).unwrap_or("").to_string();
        if s.attempt.submitted && !matches!(kind.as_str(), "view" | "tick" | "read_message" | "notes") {
            return Err(bad("This attempt has been submitted. Start a new attempt to work the case again."));
        }
        let confirm = args.get("confirm").and_then(|c| c.as_bool()).unwrap_or(false);
        let mut out = s.apply(&kind, args, confirm)?;
        if out.warning.is_none() {
            let notices = s.progress();
            out.notices.extend(notices);
            s.save(&data_dir)?;
        }
        Ok(json!({
            "state": s.state_json(profile),
            "notices": out.notices,
            "warning": out.warning,
            "result": out.result,
        }))
    }

    pub fn evidence_content(&mut self, args: &Value) -> R<Value> {
        let data_dir = self.data_dir.clone();
        let profile = self.profile();
        let s = self.sess()?;
        let out = s.open_evidence(args)?;
        if out.warning.is_some() {
            return Ok(json!({"warning": out.warning}));
        }
        let notices = s.progress();
        s.save(&data_dir)?;
        let mut result = out.result;
        result["state"] = s.state_json(profile);
        result["notices"] = json!([out.notices, notices].concat());
        Ok(result)
    }

    pub fn osint_open(&mut self, args: &Value) -> R<Value> {
        let data_dir = self.data_dir.clone();
        let profile = self.profile();
        let s = self.sess()?;
        let out = s.osint_open(args)?;
        if out.warning.is_some() {
            return Ok(json!({"warning": out.warning}));
        }
        let notices = s.progress();
        s.save(&data_dir)?;
        let mut r = out.result;
        r["state"] = s.state_json(profile);
        r["notices"] = json!([out.notices, notices].concat());
        Ok(r)
    }

    pub fn osint_search(&mut self, q: &str) -> R<Value> {
        let s = self.sess()?;
        s.log("browser", "web_search", q, "");
        Ok(s.osint_search(q))
    }

    pub fn search(&mut self, args: &Value) -> R<Value> {
        let s = self.sess()?;
        Ok(s.search(args))
    }

    pub fn suggest_links(&mut self) -> R<Value> {
        let s = self.sess()?;
        Ok(s.suggest_links())
    }

    pub fn map_points(&mut self) -> R<Value> {
        let s = self.sess()?;
        Ok(s.map_points())
    }

    pub fn submit(&mut self, confirm: bool) -> R<Value> {
        let data_dir = self.data_dir.clone();
        let profile = self.profile();
        let s = self.sess()?;
        if s.attempt.submitted {
            return Ok(json!({"result": s.attempt.result, "state": s.state_json(profile)}));
        }
        if !s.attempt.report.legality.signed {
            return Err(bad("Complete and sign the legality, necessity and proportionality statement before submitting."));
        }
        if !s.attempt.findings.iter().any(|f| f.in_report) {
            return Err(bad("Add at least one finding to the report before submitting."));
        }
        if !confirm {
            let missing: Vec<String> = s.report_issues();
            return Ok(json!({"warning": format!("Submitting ends this attempt and shows the answers. {}", if missing.is_empty() { "The report passes the citation check.".to_string() } else { format!("Report check: {}", missing.join(" ")) })}));
        }
        s.final_traps();
        let result = scoring::score(&s.case, &s.attempt);
        s.attempt.result = Some(result.clone());
        s.attempt.submitted = true;
        s.attempt.submitted_at = now_iso();
        s.log("report", "submitted", "", &format!("score {}", result["total"]));
        s.save(&data_dir)?;
        let traps: Vec<Value> = s.attempt.traps.iter().map(|t| json!({"trap": t.trap, "title": t.title, "category": t.category, "severity": t.severity})).collect();
        let record = json!({
            "attempt_id": s.attempt.id, "case_id": s.case.manifest.id, "case_title": s.case.manifest.title,
            "difficulty": s.case.manifest.difficulty, "date": s.attempt.submitted_at, "mode": s.attempt.mode,
            "total": result["total"], "band": result["band"], "categories": result["categories"], "skills": result["skills"],
            "minutes": (s.attempt.active_seconds as f64 / 60.0).round(), "estimated_minutes": s.case.manifest.estimated_minutes,
            "traps": traps, "hints_used": s.attempt.hints.len(), "score_settings": s.attempt.score_settings,
        });
        let _ = crate::records::history_add(&data_dir, record);
        Ok(json!({"result": result, "state": s.state_json(profile)}))
    }

    pub fn export(&mut self, args: &Value) -> R<Value> {
        let data_dir = self.data_dir.clone();
        let s = self.sess()?;
        let kind = args.get("kind").and_then(|k| k.as_str()).unwrap_or("");
        let base = format!("{}-{}", s.case.manifest.id, s.attempt.id);
        let (name, bytes): (String, Vec<u8>) = match kind {
            "report_md" => {
                s.export_traps();
                (format!("{base}-report.md"), crate::report::markdown(&s.case, &s.attempt, &s.player).into_bytes())
            }
            "report_pdf" => {
                s.export_traps();
                let md = crate::report::markdown(&s.case, &s.attempt, &s.player);
                (format!("{base}-report.pdf"), crate::pdf::from_markdown(&md, &format!("{} report", s.case.manifest.title)))
            }
            "debrief_md" => {
                let r = s.attempt.result.clone().ok_or_else(|| bad("Submit the report first."))?;
                (format!("{base}-debrief.md"), crate::report::debrief_markdown(&s.case, &r).into_bytes())
            }
            "timeline_csv" => (format!("{base}-timeline.csv"), crate::report::timeline_csv(&s.attempt).into_bytes()),
            "timeline_md" => (format!("{base}-timeline.md"), crate::report::timeline_md(&s.case, &s.attempt).into_bytes()),
            "action_log_csv" => (format!("{base}-action-log.csv"), crate::report::actions_csv(&s.attempt).into_bytes()),
            "file" => {
                // Content prepared by the interface, such as an SVG or PNG of the link chart.
                let fname = args.get("filename").and_then(|f| f.as_str()).unwrap_or("export.txt");
                let safe: String = fname.chars().filter(|c| c.is_ascii_alphanumeric() || "-_.".contains(*c)).collect();
                let ext_ok = [".svg", ".png", ".csv", ".md", ".txt"].iter().any(|e| safe.ends_with(e));
                if !ext_ok {
                    return Err(bad("That export type is not supported."));
                }
                let data = args.get("data_b64").and_then(|d| d.as_str()).unwrap_or("");
                let bytes = base64::engine::general_purpose::STANDARD.decode(data).map_err(|_| bad("Export data was not valid."))?;
                (format!("{base}-{safe}"), bytes)
            }
            _ => return Err(bad("Unknown export type.")),
        };
        let dir = dirs::download_dir().map(|d| d.join("Investafiction")).unwrap_or_else(|| data_dir.join("exports"));
        let dir = if fs::create_dir_all(&dir).is_ok() { dir } else { data_dir.join("exports") };
        fs::create_dir_all(&dir)?;
        let path = dir.join(&name);
        fs::write(&path, &bytes)?;
        s.attempt.report.exports.push(format!("{} {}", now_iso(), name));
        s.log("export", kind, &name, &path.display().to_string());
        s.save(&data_dir)?;
        Ok(json!({"path": path.display().to_string(), "filename": name, "data_b64": base64::engine::general_purpose::STANDARD.encode(&bytes)}))
    }

    pub fn report_preview(&mut self) -> R<Value> {
        let s = self.sess()?;
        Ok(json!({"markdown": crate::report::markdown(&s.case, &s.attempt, &s.player), "issues": s.report_issues()}))
    }

    /// Replay of a submitted attempt. Works for the open attempt or any saved one.
    pub fn replay(&mut self, case_id: &str, attempt_id: &str) -> R<Value> {
        if let Some(s) = self.session.as_ref() {
            if (attempt_id.is_empty() || s.attempt.id == attempt_id) && s.attempt.submitted {
                return Ok(crate::replay::build(&s.case, &s.attempt));
            }
        }
        if !safe_id(case_id) || !safe_id(attempt_id) {
            return Err(bad("Unknown attempt."));
        }
        let case = pack::load_installed(&self.case_dir(case_id)).map_err(|e| ApiError::with("The case could not be opened.", e))?;
        let raw: Value = read_json(&self.save_dir(case_id).join(format!("{attempt_id}.json"))).map_err(bad)?;
        let attempt: Attempt = serde_json::from_value(migrate(raw).map_err(bad)?).map_err(|e| bad(format!("The save could not be read: {e}")))?;
        if !attempt.submitted {
            return Err(bad("A replay is available once the report has been submitted."));
        }
        Ok(crate::replay::build(&case, &attempt))
    }

    pub fn reset(&mut self) -> R<Value> {
        let (case_id, mode, opts) = {
            let s = self.sess()?;
            (s.case.manifest.id.clone(), s.attempt.mode.clone(), json!({"hints_available": s.attempt.score_settings.hints_available, "warnings": s.attempt.score_settings.warnings}))
        };
        self.close()?;
        self.new_attempt(&case_id, &mode, &opts)
    }
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for e in fs::read_dir(from)? {
        let e = e?;
        let p = e.path();
        let t = to.join(e.file_name());
        if p.is_dir() { copy_dir(&p, &t)? } else { fs::copy(&p, &t).map(|_| ())? }
    }
    Ok(())
}

fn s_arg<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("")
}

fn list_arg(v: &Value, k: &str) -> Vec<String> {
    v.get(k)
        .and_then(|x| x.as_array())
        .map(|a| a.iter().filter_map(|x| x.as_str().map(|s| s.trim().to_string())).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default()
}

fn dedupe(mut v: Vec<String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    v.retain(|x| seen.insert(x.clone()));
    v
}

impl Session {
    // ------------------------------------------------------------ basics
    pub fn case_time(&self) -> String {
        let start = parse_time(&self.case.intake.clock_start).unwrap_or_else(Utc::now);
        iso(start + Duration::seconds(self.attempt.active_seconds as i64))
    }

    pub fn log(&mut self, view: &str, action: &str, target: &str, detail: &str) {
        let seq = self.attempt.actions.len() as u64 + 1;
        let entry = ActionEntry {
            seq,
            time: now_iso(),
            case_time: self.case_time(),
            view: view.into(),
            action: action.into(),
            target: target.into(),
            detail: detail.chars().take(400).collect(),
        };
        self.attempt.actions.push(entry);
    }

    pub fn save(&mut self, data_dir: &Path) -> std::io::Result<()> {
        self.attempt.updated = now_iso();
        let path = data_dir.join("saves").join(&self.attempt.case_id).join(format!("{}.json", self.attempt.id));
        write_json(&path, &self.attempt)
    }

    fn training(&self) -> bool {
        self.attempt.mode == "training"
    }

    pub fn released(&self) -> Vec<String> {
        let mut v = vec![];
        for s in &self.case.stages.stages {
            if self.attempt.open_stages.contains(&s.id) {
                v.extend(s.evidence.iter().cloned());
            }
        }
        v.extend(self.attempt.extra_evidence.iter().cloned());
        dedupe(v)
    }

    pub fn is_released(&self, id: &str) -> bool {
        self.released().iter().any(|e| e == id)
    }

    pub fn pages_available(&self) -> Vec<String> {
        let mut v = vec![];
        for s in &self.case.stages.stages {
            if self.attempt.open_stages.contains(&s.id) {
                v.extend(s.osint_pages.iter().cloned());
            }
        }
        v.extend(self.attempt.extra_pages.iter().cloned());
        dedupe(v)
    }

    fn has_custody(&self, id: &str, action: &str) -> bool {
        self.attempt.custody.iter().any(|c| c.evidence == id && c.action == action)
    }

    pub fn received(&self, id: &str) -> bool {
        self.has_custody(id, "received")
    }

    pub fn examined(&self, id: &str) -> bool {
        self.has_custody(id, "examined") || self.has_custody(id, "examined_original")
    }

    fn custody(&mut self, evidence: &str, action: &str, reason: &str, hash: &str) {
        let id = self.attempt.next_id("CL");
        let entry = CustodyEntry {
            id,
            evidence: evidence.into(),
            action: action.into(),
            time: now_iso(),
            case_time: self.case_time(),
            reason: reason.into(),
            hash: hash.into(),
            by: self.player.clone(),
        };
        self.attempt.custody.push(entry);
    }

    fn has_trap(&self, trap: &str, target: &str) -> bool {
        self.attempt.traps.iter().any(|t| t.trap == trap && (target.is_empty() || t.target == target))
    }

    fn record_trap(&mut self, trap: &Trap, target: &str, detail: &str) {
        if self.has_trap(&trap.id, target) {
            return;
        }
        let ev = TrapEvent {
            trap: trap.id.clone(),
            title: trap.title.clone(),
            category: trap.category.clone(),
            severity: trap.severity.clone(),
            penalty: trap.penalty,
            lesson: trap.lesson.clone(),
            time: self.case_time(),
            target: target.into(),
            detail: detail.into(),
        };
        self.attempt.traps.push(ev);
    }

    fn builtin(&self, id: &str) -> Trap {
        let (title, cat, sev, pen, lesson) = match id {
            "TR-ALTER" => ("Altering original evidence", "alter_original", "serious", 5.0,
                "Original data that might be relied on must never be changed. Work on a verified copy and record what you did."),
            "TR-CONT" => ("Broken continuity", "continuity", "minor", 1.0,
                "Log receipt of an item before you examine it, so the chain of custody has no gap."),
            "TR-BROAD" => ("Collecting too much", "collection", "major", self.case.rules.broad_request_penalty,
                "Ask only for the data you need, for the people and period that matter. Broad requests are disproportionate."),
            "TR-UNFOUNDED" => ("Unjustified request", "scope", "minor", self.case.rules.unfounded_request_penalty,
                "Every request needs a clear reason linked to the tasking. A request with no grounds is refused."),
            "TR-PERSONA" => ("Getting in by deception", "deception", "serious", 4.0,
                "Using a false persona to reach private material needs specific authority. Without it, the access is unlawful and the material is tainted."),
            "TR-SCREENSHOT" => ("Capture not preserved", "capture", "minor", 1.0,
                "A quick screenshot has no capture time, address or hash, so it cannot show what you saw. Capture pages properly."),
            _ => ("Procedural error", "other", "minor", 1.0, ""),
        };
        Trap { id: id.into(), title: title.into(), category: cat.into(), trigger: Trigger::default(), penalty: pen, severity: sev.into(), lesson: lesson.into(), warning: String::new() }
    }

    fn traps_of(&self, kind: &str) -> Vec<Trap> {
        self.case.rules.traps.iter().filter(|t| t.trigger.kind == kind).cloned().collect()
    }

    fn authorised(&self, t: &Trap) -> bool {
        t.trigger.unless_authority.as_ref().map(|a| self.attempt.authorities.contains(a)).unwrap_or(false)
    }

    /// In training mode, return a warning once before a trap fires.
    fn gate(&mut self, key: &str, text: &str, confirm: bool) -> Option<Outcome> {
        if self.training() && self.attempt.score_settings.warnings && !confirm {
            Some(Outcome::warn(text))
        } else {
            let _ = key;
            None
        }
    }

    // ------------------------------------------------------------ citations
    /// The key and independence group of something the player cited. Captures
    /// stand in for the web page they preserve.
    fn cite_info(&self, cite: &str) -> Option<(String, String)> {
        if let Some(e) = self.case.item(cite) {
            return Some((e.id.clone(), e.source_group.clone()));
        }
        if let Some(c) = self.attempt.captures.iter().find(|c| c.id == cite && c.method == "full") {
            let site = self.case.page(&c.page).map(|p| p.site.clone()).unwrap_or_default();
            return Some((c.page.clone(), format!("web:{site}:{}", c.page)));
        }
        None
    }

    fn citable(&self, cite: &str) -> bool {
        (self.case.item(cite).is_some() && self.is_released(cite))
            || self.attempt.captures.iter().any(|c| c.id == cite && c.method == "full")
    }

    pub fn finding_matches(&self, kf: &KeyFinding, f: &Finding) -> bool {
        if !keywords_match(&f.statement, &kf.keywords) {
            return false;
        }
        let groups: BTreeSet<String> = f
            .evidence
            .iter()
            .filter_map(|c| self.cite_info(c))
            .filter(|(k, _)| kf.evidence_any.contains(k))
            .map(|(_, g)| g)
            .collect();
        groups.len() >= kf.min_sources
    }

    pub fn has_finding(&self, key: &str) -> bool {
        self.case
            .solution
            .findings
            .iter()
            .find(|k| k.id == key)
            .map(|kf| self.attempt.findings.iter().any(|f| self.finding_matches(kf, f)))
            .unwrap_or(false)
    }

    pub fn event_matches(&self, te: &TrueEvent, e: &Event) -> bool {
        let (Some(a), Some(b)) = (parse_time(&te.time), parse_time(&e.time)) else { return false };
        let cites = e.evidence.iter().filter_map(|c| self.cite_info(c)).any(|(k, _)| te.evidence_any.contains(&k));
        cites && (a - b).num_minutes().abs() <= te.tolerance_minutes
    }

    fn link_exists(&self, a: &str, b: &str) -> bool {
        self.attempt.links.iter().any(|l| ((l.from == a && l.to == b) || (l.from == b && l.to == a)) && !l.evidence.is_empty())
    }

    // ------------------------------------------------------------ conditions
    pub fn eval(&self, c: &Condition) -> bool {
        let ids_or_released = |c: &Condition| -> Vec<String> { if c.all_released { self.released() } else { c.ids.clone() } };
        match c.kind.as_str() {
            "start" => true,
            "all" => c.of.iter().all(|x| self.eval(x)),
            "any" => c.of.iter().any(|x| self.eval(x)),
            "scope_acknowledged" => self.attempt.scope_acknowledged,
            "received" => {
                let ids = ids_or_released(c);
                !ids.is_empty() && ids.iter().all(|i| self.received(i))
            }
            "examined" => {
                let ids = ids_or_released(c);
                let n = ids.iter().filter(|i| self.examined(i)).count();
                n >= c.min.unwrap_or(ids.len()) && !ids.is_empty()
            }
            "hashed" => {
                let ids = ids_or_released(c);
                !ids.is_empty() && ids.iter().all(|i| self.has_custody(i, "hashed"))
            }
            "graded" => self.attempt.grades.len() + self.attempt.findings.iter().filter(|f| f.grade.is_some()).count() >= c.min.unwrap_or(1),
            "finding" => c.key.as_deref().map(|k| self.has_finding(k)).unwrap_or(false),
            "findings_count" => self.attempt.findings.len() >= c.min.unwrap_or(1),
            "request_granted" => {
                let r = c.request.as_deref().unwrap_or("");
                self.attempt.requests.iter().any(|q| q.granted && q.rule.as_deref() == Some(r))
            }
            "authority" => c.id.as_deref().map(|a| self.attempt.authorities.contains(a)).unwrap_or(false),
            "timeline_count" => self.attempt.timeline.len() >= c.min.unwrap_or(1),
            "timeline_event" => {
                let key = c.key.as_deref().unwrap_or("");
                self.case.solution.timeline.iter().find(|t| t.id == key).map(|te| self.attempt.timeline.iter().any(|e| self.event_matches(te, e))).unwrap_or(false)
            }
            "link" => self.link_exists(c.a.as_deref().unwrap_or(""), c.b.as_deref().unwrap_or("")),
            "links_count" => self.attempt.links.len() >= c.min.unwrap_or(1),
            "captured" => c.pages.iter().all(|p| self.attempt.captures.iter().any(|cap| &cap.page == p && cap.method == "full")),
            "objectives" => {
                let st = c.stage.as_deref().unwrap_or("");
                self.case
                    .stages
                    .stages
                    .iter()
                    .find(|s| s.id == st)
                    .map(|s| s.objectives.iter().filter(|o| o.required).all(|o| self.attempt.objectives_done.contains(&o.id)))
                    .unwrap_or(false)
            }
            "legality_done" => self.attempt.report.legality.signed,
            "hash_mismatch_reported" => c.ids.iter().all(|i| self.attempt.integrity_reports.contains_key(i)),
            _ => false,
        }
    }

    /// Mark objectives done and open stages whose trigger is met.
    pub fn progress(&mut self) -> Vec<String> {
        let mut notices = vec![];
        if self.attempt.open_stages.is_empty() && self.attempt.scope_acknowledged {
            let first = self.case.stages.stages[0].clone();
            self.open_stage(&first, &mut notices);
        }
        loop {
            let mut changed = false;
            let open: Vec<Stage> = self.case.stages.stages.iter().filter(|s| self.attempt.open_stages.contains(&s.id)).cloned().collect();
            for st in &open {
                for ob in &st.objectives {
                    if self.attempt.objectives_done.contains(&ob.id) {
                        continue;
                    }
                    if let Some(chk) = self.case.solution.objective_checks.get(&ob.id) {
                        if self.eval(chk) {
                            self.attempt.objectives_done.insert(ob.id.clone());
                            notices.push(format!("Objective complete: {}", ob.text));
                            self.log("objectives", "objective_complete", &ob.id, &ob.text);
                            changed = true;
                        }
                    }
                }
            }
            if let Some(next) = self.case.stages.stages.iter().find(|s| !self.attempt.open_stages.contains(&s.id)).cloned() {
                if !self.attempt.open_stages.is_empty() {
                    if let Some(cond) = self.case.solution.stage_unlocks.get(&next.id) {
                        if self.eval(cond) {
                            self.open_stage(&next, &mut notices);
                            changed = true;
                        }
                    }
                }
            }
            if !changed {
                break;
            }
        }
        notices
    }

    fn open_stage(&mut self, st: &Stage, notices: &mut Vec<String>) {
        self.attempt.open_stages.push(st.id.clone());
        self.attempt.stage_opened_at.insert(st.id.clone(), self.attempt.active_seconds);
        let id = self.attempt.next_id("MSG");
        let m = Message {
            id,
            stage: st.id.clone(),
            from: self.case.intake.case_lead.clone(),
            text: st.message.clone(),
            time: now_iso(),
            case_time: self.case_time(),
            read: false,
        };
        self.attempt.messages.push(m);
        let n = st.evidence.len();
        notices.push(format!("{} is open. {} new item{} and a message from the case lead.", st.title, n, if n == 1 { "" } else { "s" }));
        self.log("stages", "stage_opened", &st.id, &st.title);
    }

    // ------------------------------------------------------------ evidence
    pub fn open_evidence(&mut self, args: &Value) -> R<Outcome> {
        let id = s_arg(args, "id").to_string();
        let original = s_arg(args, "as") == "original";
        let reason = s_arg(args, "reason").trim().to_string();
        let confirm = args.get("confirm").and_then(|c| c.as_bool()).unwrap_or(false);
        if !self.is_released(&id) {
            return Err(bad("That item has not been released to you."));
        }
        let item = self.case.item(&id).cloned().unwrap();
        if original && reason.chars().count() < 10 {
            return Err(bad("Opening an original needs a short reason (principle 2). Explain why a working copy is not enough."));
        }
        let scope_traps: Vec<Trap> = self.traps_of("evidence_opened").into_iter().filter(|t| t.trigger.ids.contains(&id) && !self.authorised(t)).collect();
        if !self.examined(&id) {
            if let Some(t) = scope_traps.first() {
                let text = if t.warning.is_empty() { format!("Check the scope before opening this item. {}", t.lesson) } else { t.warning.clone() };
                if let Some(o) = self.gate(&t.id, &text, confirm) {
                    return Ok(o);
                }
            }
        }
        if !self.received(&id) {
            if let Some(o) = self.gate("TR-CONT", "You have not logged receipt of this item yet. Examining it first leaves a gap in the chain of custody. Log receipt first, or continue anyway.", confirm) {
                return Ok(o);
            }
            if !self.has_trap("TR-CONT", &id) {
                let t = self.builtin("TR-CONT");
                self.record_trap(&t, &id, "Examined before receipt was logged");
            }
        }
        for t in scope_traps {
            self.record_trap(&t, &id, "Opened without authority");
        }
        let path = self.case.dir.join(&item.file);
        let bytes = fs::read(&path)?;
        let hash = sha256_hex(&bytes);
        if original {
            self.custody(&id, "examined_original", &reason, "");
            self.log("evidence", "opened_original", &id, &reason);
        } else {
            if !self.has_custody(&id, "copied") {
                self.custody(&id, "copied", "Working copy made for examination", &hash);
            }
            if !self.has_custody(&id, "examined") {
                self.custody(&id, "examined", "", "");
            }
            self.log("evidence", "opened_copy", &id, &item.title);
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        let content = match ext.as_str() {
            "svg" | "png" | "jpg" | "jpeg" => {
                let mime = match ext.as_str() { "svg" => "image/svg+xml", "png" => "image/png", _ => "image/jpeg" };
                json!({"kind": "image", "data_url": format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(&bytes))})
            }
            _ => json!({"kind": "text", "ext": ext, "text": String::from_utf8_lossy(&bytes)}),
        };
        Ok(Outcome { result: json!({"content": content, "original": original}), ..Default::default() })
    }

    pub fn asset(&self, rel: &str) -> R<Value> {
        let rel_ok = (rel.starts_with("osint/") || rel.starts_with("assets/") || rel.starts_with("evidence/")) && !rel.contains("..");
        if !rel_ok || !self.case.manifest.files.contains_key(rel) {
            return Err(bad("Unknown asset."));
        }
        if rel.starts_with("evidence/") {
            return Err(bad("Evidence must be opened through the evidence viewer."));
        }
        let bytes = fs::read(self.case.dir.join(rel))?;
        let mime = if rel.ends_with(".svg") { "image/svg+xml" } else if rel.ends_with(".png") { "image/png" } else { "image/jpeg" };
        let meta = self.case.osint.images.iter().find(|i| i.file == rel).map(|i| json!(i.metadata)).unwrap_or(json!({}));
        Ok(json!({"data_url": format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(&bytes)), "metadata": meta}))
    }

    // ------------------------------------------------------------ actions
    fn apply(&mut self, kind: &str, a: &Value, confirm: bool) -> R<Outcome> {
        match kind {
            "ack_scope" => {
                if !self.attempt.scope_acknowledged {
                    self.attempt.scope_acknowledged = true;
                    self.log("brief", "scope_acknowledged", "", "Scope and authorities acknowledged");
                }
                Ok(Outcome::default())
            }
            "tick" => {
                let secs = a.get("seconds").and_then(|x| x.as_u64()).unwrap_or(0).min(120);
                self.attempt.active_seconds += secs;
                Ok(Outcome::default())
            }
            "view" => {
                // Merge, so the open tab and the link chart layout are both kept.
                if let Some(obj) = a.get("view").and_then(|v| v.as_object()) {
                    if !self.attempt.view.is_object() {
                        self.attempt.view = json!({});
                    }
                    for (k, v) in obj {
                        self.attempt.view[k] = v.clone();
                    }
                }
                Ok(Outcome::default())
            }
            "save" => {
                self.log("workspace", "manual_save", "", "");
                Ok(Outcome { notices: vec!["Saved.".into()], ..Default::default() })
            }
            "read_message" => {
                let id = s_arg(a, "id").to_string();
                if let Some(m) = self.attempt.messages.iter_mut().find(|m| m.id == id) {
                    m.read = true;
                }
                Ok(Outcome::default())
            }
            "log_receipt" => {
                let ids = if a.get("all").and_then(|x| x.as_bool()).unwrap_or(false) { self.released() } else { list_arg(a, "ids") };
                let mut n = 0;
                for id in ids {
                    if self.is_released(&id) && !self.received(&id) {
                        let hash_note = self.case.item(&id).map(|i| i.original_hash.clone()).unwrap_or_default();
                        self.custody(&id, "received", "Receipt logged; seals and labels checked against the register", &hash_note);
                        self.log("evidence", "receipt_logged", &id, "");
                        n += 1;
                    }
                }
                Ok(Outcome { notices: vec![format!("Receipt logged for {n} item{}.", if n == 1 { "" } else { "s" })], ..Default::default() })
            }
            "hash_check" => self.hash_check(a),
            "hash_compare" => {
                let (x, y) = (s_arg(a, "a").to_string(), s_arg(a, "b").to_string());
                let hx = self.file_hash(&x)?;
                let hy = self.file_hash(&y)?;
                self.log("integrity", "hash_compare", &format!("{x} {y}"), if hx == hy { "identical" } else { "different" });
                Ok(Outcome { result: json!({"a": hx, "b": hy, "same": hx == hy}), ..Default::default() })
            }
            "hash_paste" => {
                let id = s_arg(a, "id").to_string();
                let pasted = s_arg(a, "hash").trim().to_lowercase();
                let h = self.file_hash(&id)?;
                self.log("integrity", "hash_paste_check", &id, if h == pasted { "match" } else { "no match" });
                Ok(Outcome { result: json!({"hash": h, "match": h == pasted}), ..Default::default() })
            }
            "report_integrity" => {
                let id = s_arg(a, "id").to_string();
                let note = s_arg(a, "note").trim().to_string();
                if note.len() < 10 {
                    return Err(bad("Describe the integrity problem in a sentence or two."));
                }
                if !self.is_released(&id) {
                    return Err(bad("Unknown item."));
                }
                self.attempt.integrity_reports.insert(id.clone(), note.clone());
                self.custody(&id, "integrity_reported", &note, "");
                self.log("integrity", "integrity_issue_reported", &id, &note);
                Ok(Outcome { notices: vec!["Integrity issue recorded and reported to the case lead.".into()], ..Default::default() })
            }
            "alter_original" => {
                let id = s_arg(a, "id").to_string();
                let op = s_arg(a, "op").to_string();
                if let Some(o) = self.gate("TR-ALTER", "This is an original exhibit. Changing or renaming it breaks principle 1 and would be a serious breach. Work on the copy instead.", confirm) {
                    return Ok(o);
                }
                let t = self.builtin("TR-ALTER");
                self.record_trap(&t, &id, &format!("Attempted to {op} the original"));
                self.custody(&id, "alter_blocked", &format!("Attempt to {op} the original was blocked"), "");
                self.log("evidence", "alter_original_blocked", &id, &op);
                Ok(Outcome { notices: vec!["The change was blocked. Originals are read-only. The attempt has been recorded in the audit trail.".into()], ..Default::default() })
            }
            "item_note" => {
                let id = s_arg(a, "id").to_string();
                self.attempt.item_notes.insert(id.clone(), s_arg(a, "text").to_string());
                Ok(Outcome::default())
            }
            "notes" => {
                self.attempt.notes = s_arg(a, "text").to_string();
                Ok(Outcome::default())
            }
            "grade" => {
                let target = s_arg(a, "target").to_string();
                let g = Grade { source: s_arg(a, "source").to_string(), info: s_arg(a, "info").to_string() };
                if !"ABCDE".contains(&g.source) || g.source.len() != 1 || !"12345".contains(&g.info) || g.info.len() != 1 {
                    return Err(bad("Use a source grade from A to E and an information grade from 1 to 5."));
                }
                if let Some(f) = self.attempt.findings.iter_mut().find(|f| f.id == target) {
                    f.grade = Some(g.clone());
                } else if self.citable(&target) {
                    self.attempt.grades.insert(target.clone(), g.clone());
                } else {
                    return Err(bad("Unknown item to grade."));
                }
                self.log("grading", "graded", &target, &format!("{}{}", g.source, g.info));
                Ok(Outcome::default())
            }
            "add_finding" | "update_finding" => self.upsert_finding(kind, a, confirm),
            "delete_finding" => {
                let id = s_arg(a, "id").to_string();
                self.attempt.findings.retain(|f| f.id != id);
                self.log("findings", "finding_deleted", &id, "");
                Ok(Outcome::default())
            }
            "report_finding" => {
                let id = s_arg(a, "id").to_string();
                let on = a.get("on").and_then(|x| x.as_bool()).unwrap_or(true);
                if let Some(f) = self.attempt.findings.iter_mut().find(|f| f.id == id) {
                    f.in_report = on;
                }
                Ok(Outcome::default())
            }
            "add_event" | "update_event" => self.upsert_event(kind, a, confirm),
            "delete_event" => {
                let id = s_arg(a, "id").to_string();
                self.attempt.timeline.retain(|e| e.id != id);
                self.log("timeline", "event_deleted", &id, "");
                Ok(Outcome::default())
            }
            "add_link" | "update_link" => self.upsert_link(kind, a),
            "delete_link" => {
                let id = s_arg(a, "id").to_string();
                self.attempt.links.retain(|l| l.id != id);
                self.log("links", "link_deleted", &id, "");
                Ok(Outcome::default())
            }
            "request" => self.request(a),
            "persona" => self.persona(a, confirm),
            "capture" => self.capture(a, confirm),
            "hint" => self.hint(a),
            "claim_link" => self.claim_link(a, confirm),
            "claim_unlink" => {
                let id = s_arg(a, "id").to_string();
                let before = self.attempt.claim_links.len();
                self.attempt.claim_links.retain(|l| l.id != id);
                if before == self.attempt.claim_links.len() {
                    return Err(bad("Unknown statement link."));
                }
                self.log("statements", "claim_unlinked", &id, "");
                Ok(Outcome::default())
            }
            "claim_send" => self.claim_send(a),
            "report" => {
                let r = &mut self.attempt.report;
                for (k, slot) in [("summary", &mut r.summary), ("scope_method", &mut r.scope_method), ("gaps", &mut r.gaps), ("recommendations", &mut r.recommendations)] {
                    if let Some(v) = a.get(k).and_then(|x| x.as_str()) {
                        *slot = v.to_string();
                    }
                }
                if let Some(v) = a.get("include_timeline").and_then(|x| x.as_bool()) {
                    r.include_timeline = v;
                }
                if let Some(v) = a.get("include_links").and_then(|x| x.as_bool()) {
                    r.include_links = v;
                }
                let l = &mut r.legality;
                let mut changed = false;
                for (k, slot) in [("legality", &mut l.legality), ("necessity", &mut l.necessity), ("proportionality", &mut l.proportionality)] {
                    if let Some(v) = a.get(k).and_then(|x| x.as_str()) {
                        if *slot != v {
                            *slot = v.to_string();
                            changed = true;
                        }
                    }
                }
                if changed && l.signed {
                    l.signed = false;
                }
                Ok(Outcome::default())
            }
            "sign" => {
                let l = &self.attempt.report.legality;
                let short: Vec<&str> = [("legality", &l.legality), ("necessity", &l.necessity), ("proportionality", &l.proportionality)]
                    .iter()
                    .filter(|(_, v)| v.trim().chars().count() < 25)
                    .map(|(k, _)| *k)
                    .collect();
                if !short.is_empty() {
                    return Err(bad(format!("Write a little more for: {}. Each part needs at least a sentence.", short.join(", "))));
                }
                let player = self.player.clone();
                let l = &mut self.attempt.report.legality;
                l.signed = true;
                l.signed_by = player.clone();
                l.signed_at = now_iso();
                self.log("report", "legality_signed", "", &format!("Signed as case lead: {player}"));
                Ok(Outcome { notices: vec!["Statement signed.".into()], ..Default::default() })
            }
            _ => Err(bad(format!("Unknown action: {kind}"))),
        }
    }

    fn file_hash(&self, id: &str) -> R<String> {
        let item = self.case.item(id).filter(|_| self.is_released(id)).ok_or_else(|| bad("Unknown item."))?;
        Ok(sha256_hex(&fs::read(self.case.dir.join(&item.file))?))
    }

    fn hash_check(&mut self, a: &Value) -> R<Outcome> {
        let ids = if a.get("all").and_then(|x| x.as_bool()).unwrap_or(false) { self.released() } else { list_arg(a, "ids") };
        let mut results = vec![];
        let mut mismatches = 0;
        for id in ids {
            let Some(item) = self.case.item(&id).cloned() else { continue };
            if !self.is_released(&id) {
                continue;
            }
            let h = self.file_hash(&id)?;
            let import = self.case.import_hashes.get(&item.file).cloned().unwrap_or_default();
            let matches_original = h == item.original_hash;
            let matches_import = h == import;
            if !matches_original {
                mismatches += 1;
            }
            self.custody(&id, "hashed", if matches_original { "SHA-256 matches the acquisition record" } else { "SHA-256 does NOT match the acquisition record" }, &h);
            self.log("integrity", "hash_checked", &id, if matches_original { "match" } else { "mismatch" });
            results.push(json!({"id": id, "hash": h, "original_hash": item.original_hash, "import_hash": import, "matches_original": matches_original, "matches_import": matches_import}));
        }
        let n = results.len();
        let notice = if mismatches == 0 {
            format!("{n} item{} hashed. All match their acquisition records.", if n == 1 { "" } else { "s" })
        } else {
            format!("{n} item{} hashed. {mismatches} did not match the acquisition record. Record and report it before relying on that item.", if n == 1 { "" } else { "s" })
        };
        Ok(Outcome { notices: vec![notice], result: json!(results), ..Default::default() })
    }

    fn upsert_finding(&mut self, kind: &str, a: &Value, confirm: bool) -> R<Outcome> {
        let statement = s_arg(a, "statement").trim().to_string();
        let ftype = s_arg(a, "kind").to_string();
        let evidence = dedupe(list_arg(a, "evidence"));
        if statement.chars().count() < 8 {
            return Err(bad("Write the finding as a full sentence."));
        }
        if !["fact", "inference", "assumption"].contains(&ftype.as_str()) {
            return Err(bad("Label the finding as a fact, an inference or an assumption."));
        }
        if ftype == "fact" && evidence.is_empty() {
            return Err(bad("A finding cannot be marked as fact without at least one evidence link."));
        }
        for e in &evidence {
            if !self.citable(e) {
                return Err(bad(format!("{e} cannot be cited. Cite released evidence items or properly captured web pages.")));
            }
        }
        // Traps: overclaiming and citing sensitive material
        let draft = Finding { id: String::new(), statement: statement.clone(), kind: ftype.clone(), evidence: evidence.clone(), grade: None, created: String::new(), in_report: false };
        let claim_traps: Vec<Trap> = self
            .traps_of("finding_claim")
            .into_iter()
            .filter(|t| keywords_match(&statement, &t.trigger.keywords) && (t.trigger.types.is_empty() || t.trigger.types.contains(&ftype)))
            .collect();
        if let Some(t) = claim_traps.iter().find(|t| !self.has_trap(&t.id, "")) {
            let text = if t.warning.is_empty() { format!("Be careful with this wording. {}", t.lesson) } else { t.warning.clone() };
            if let Some(o) = self.gate(&t.id, &text, confirm) {
                return Ok(o);
            }
        }
        let lies = self.lie_traps(&statement, &evidence);
        if let Some(t) = lies.iter().find(|t| !self.has_trap(&t.id, "")) {
            let text = if t.warning.is_empty() { format!("Careful. {}", t.lesson) } else { t.warning.clone() };
            if let Some(o) = self.gate(&t.id, &text, confirm) {
                return Ok(o);
            }
        }
        for t in lies {
            self.record_trap(&t, "", &statement);
        }
        let sensitive: Vec<String> = evidence.iter().filter(|e| self.case.item(e).map(|i| i.marking == "privileged" || i.marking == "restricted").unwrap_or(false)).cloned().collect();
        if !sensitive.is_empty() && self.training() && !confirm {
            return Ok(Outcome::warn(format!("{} is marked {}. Quoting or relying on it in a report needs care. Consider leaving it out and flagging it to the case lead instead.", sensitive.join(", "), self.case.item(&sensitive[0]).map(|i| i.marking.clone()).unwrap_or_default())));
        }
        for t in claim_traps {
            self.record_trap(&t, "", &statement);
        }
        let _ = draft;
        let id = if kind == "add_finding" {
            let id = self.attempt.next_id("F");
            self.attempt.findings.push(Finding { id: id.clone(), statement: statement.clone(), kind: ftype.clone(), evidence, grade: None, created: self.case_time(), in_report: true });
            id
        } else {
            let id = s_arg(a, "id").to_string();
            let f = self.attempt.findings.iter_mut().find(|f| f.id == id).ok_or_else(|| bad("Unknown finding."))?;
            f.statement = statement.clone();
            f.kind = ftype.clone();
            f.evidence = evidence;
            id
        };
        self.log("findings", if kind == "add_finding" { "finding_added" } else { "finding_updated" }, &id, &format!("[{ftype}] {statement}"));
        Ok(Outcome { result: json!({"id": id}), ..Default::default() })
    }

    fn upsert_event(&mut self, kind: &str, a: &Value, confirm: bool) -> R<Outcome> {
        let time = parse_time(s_arg(a, "time")).ok_or_else(|| bad("Enter the time as YYYY-MM-DD HH:MM (UTC)."))?;
        let description = s_arg(a, "description").trim().to_string();
        if description.is_empty() {
            return Err(bad("Describe the event."));
        }
        let evidence = dedupe(list_arg(a, "evidence"));
        for e in &evidence {
            if !self.citable(e) {
                return Err(bad(format!("{e} cannot be cited.")));
            }
        }
        let ev = Event {
            id: String::new(),
            time: iso(time),
            description: description.clone(),
            evidence: evidence.clone(),
            entities: dedupe(list_arg(a, "entities")),
            confidence: s_arg(a, "confidence").to_string(),
            clock_note: s_arg(a, "clock_note").to_string(),
        };
        if self.training() && !confirm {
            if let Some(w) = self.clock_warning(&ev) {
                return Ok(Outcome::warn(w));
            }
        }
        let id = if kind == "add_event" {
            let id = self.attempt.next_id("EVT");
            self.attempt.timeline.push(Event { id: id.clone(), ..ev });
            id
        } else {
            let id = s_arg(a, "id").to_string();
            let e = self.attempt.timeline.iter_mut().find(|e| e.id == id).ok_or_else(|| bad("Unknown event."))?;
            *e = Event { id: id.clone(), ..ev };
            id
        };
        self.attempt.timeline.sort_by(|x, y| x.time.cmp(&y.time));
        self.log("timeline", if kind == "add_event" { "event_added" } else { "event_updated" }, &id, &description);
        Ok(Outcome { result: json!({"id": id}), ..Default::default() })
    }

    /// Does this event use a known-wrong device time without correcting it?
    fn clock_hit(&self, t: &Trap, e: &Event) -> bool {
        let off = t.trigger.offset_minutes.unwrap_or(0);
        let tol = t.trigger.tolerance_minutes.unwrap_or(3);
        let Some(pt) = parse_time(&e.time) else { return false };
        if !e.evidence.iter().any(|c| t.trigger.ids.contains(c)) {
            return false;
        }
        self.case.solution.timeline.iter().filter(|te| te.evidence_any.iter().any(|x| t.trigger.ids.contains(x))).any(|te| {
            let Some(tt) = parse_time(&te.time) else { return false };
            let device = tt + Duration::minutes(off);
            (pt - device).num_minutes().abs() <= tol && (pt - tt).num_minutes().abs() > tol
        })
    }

    fn clock_warning(&self, e: &Event) -> Option<String> {
        for t in self.traps_of("clock_uncorrected") {
            if self.clock_hit(&t, e) {
                return Some(if t.warning.is_empty() { format!("Check the clock on the source before using this time. {}", t.lesson) } else { t.warning.clone() });
            }
        }
        for c in &e.evidence {
            if let Some(i) = self.case.item(c) {
                if i.clock_offset_minutes.unwrap_or(0) != 0 && e.clock_note.trim().is_empty() {
                    return Some(format!("{} has a recorded clock offset of {} minutes. Say in the clock note whether you corrected the time.", i.id, i.clock_offset_minutes.unwrap()));
                }
            }
        }
        None
    }

    fn upsert_link(&mut self, kind: &str, a: &Value) -> R<Outcome> {
        let from = s_arg(a, "from").to_string();
        let to = s_arg(a, "to").to_string();
        if from == to || self.case.entity(&from).is_none() || self.case.entity(&to).is_none() {
            return Err(bad("Choose two different entities to link."));
        }
        let evidence = dedupe(list_arg(a, "evidence"));
        for e in &evidence {
            if !self.citable(e) {
                return Err(bad(format!("{e} cannot be cited.")));
            }
        }
        let link = Link {
            id: String::new(),
            from: from.clone(),
            to: to.clone(),
            kind: s_arg(a, "kind").to_string(),
            evidence,
            note: s_arg(a, "note").to_string(),
            suggested: a.get("suggested").and_then(|x| x.as_bool()).unwrap_or(false),
        };
        let id = if kind == "add_link" {
            let id = self.attempt.next_id("LNK");
            self.attempt.links.push(Link { id: id.clone(), ..link });
            id
        } else {
            let id = s_arg(a, "id").to_string();
            let l = self.attempt.links.iter_mut().find(|l| l.id == id).ok_or_else(|| bad("Unknown link."))?;
            *l = Link { id: id.clone(), ..link };
            id
        };
        self.log("links", if kind == "add_link" { "link_added" } else { "link_updated" }, &id, &format!("{from} to {to}"));
        Ok(Outcome { result: json!({"id": id}), ..Default::default() })
    }

    fn request(&mut self, a: &Value) -> R<Outcome> {
        let rtype = s_arg(a, "request_type").to_string();
        let target = s_arg(a, "target").to_string();
        let justification = s_arg(a, "justification").trim().to_string();
        let (df, dt) = (s_arg(a, "date_from").to_string(), s_arg(a, "date_to").to_string());
        let rt = self.case.request_type(&rtype).cloned().ok_or_else(|| bad("Unknown request type."))?;
        let stage_open = self.attempt.open_stages.contains(&rt.available_from);
        if !stage_open {
            return Err(bad("That kind of request is not available yet."));
        }
        if justification.chars().count() < 20 {
            return Err(bad("Write a justification that explains why this is necessary and proportionate."));
        }
        if rt.needs_dates && (parse_date(&df).is_none() || parse_date(&dt).is_none()) {
            return Err(bad("Give a start and end date for the data you need."));
        }
        let stage = self.attempt.open_stages.last().cloned().unwrap_or_default();
        let mut rec = RequestRecord {
            id: self.attempt.next_id("REQ"),
            request_type: rtype.clone(),
            target: target.clone(),
            date_from: df.clone(),
            date_to: dt.clone(),
            justification: justification.clone(),
            granted: false,
            response: String::new(),
            stage,
            time: self.case_time(),
            rule: None,
            broad: false,
            unfounded: false,
        };
        let rules: Vec<RequestRule> = self.case.rules.request_rules.iter().filter(|r| r.request_type == rtype).cloned().collect();
        let mut penalty_trap: Option<&str> = None;
        if target == "ALL" {
            rec.broad = true;
            rec.response = rules.iter().map(|r| r.refuse_broad.clone()).find(|s| !s.is_empty()).unwrap_or_else(|| "Refused. A request covering every target is disproportionate. Name the specific target you need and say why.".into());
            penalty_trap = Some("TR-BROAD");
        } else if let Some(rule) = rules.iter().find(|r| r.targets.contains(&target)) {
            rec.rule = Some(rule.id.clone());
            if self.attempt.requests.iter().any(|q| q.granted && q.rule.as_deref() == Some(&rule.id)) {
                return Err(bad("That request has already been granted."));
            }
            let mut ok = true;
            if rt.needs_dates {
                let (from, to) = (parse_date(&df).unwrap(), parse_date(&dt).unwrap());
                if to < from {
                    return Err(bad("The end date is before the start date."));
                }
                let span = (to - from).num_days() + 1;
                if let Some(max) = rule.max_days {
                    if span > max {
                        ok = false;
                        rec.broad = true;
                        rec.response = if rule.refuse_broad.is_empty() { format!("Refused. {span} days is far wider than the enquiry needs. Narrow the date range to the period that matters.") } else { rule.refuse_broad.clone() };
                        penalty_trap = Some("TR-BROAD");
                    }
                }
                if ok && rule.must_cover.len() == 2 {
                    let (need_a, need_b) = (parse_date(&rule.must_cover[0]).unwrap(), parse_date(&rule.must_cover[1]).unwrap());
                    if from > need_a || to < need_b {
                        ok = false;
                        rec.response = if rule.refuse_dates.is_empty() { "Refused as framed. The dates you gave do not cover the period your own analysis points to. Check the dates and resubmit.".into() } else { rule.refuse_dates.clone() };
                    }
                }
            }
            if ok && !rule.justification.is_empty() {
                let hit = keyword_groups_hit(&justification, &rule.justification);
                let need = rule.min_groups.unwrap_or(rule.justification.len());
                if hit < need {
                    ok = false;
                    rec.response = if rule.refuse_justification.is_empty() { "Refused. The justification does not explain why this data is necessary for the tasking. Link it to what you have already found.".into() } else { rule.refuse_justification.clone() };
                }
            }
            if ok {
                rec.granted = true;
                rec.response = rule.grant_message.clone();
                for e in &rule.releases.evidence {
                    if !self.attempt.extra_evidence.contains(e) {
                        self.attempt.extra_evidence.push(e.clone());
                    }
                }
                for p in &rule.releases.osint_pages {
                    if !self.attempt.extra_pages.contains(p) {
                        self.attempt.extra_pages.push(p.clone());
                    }
                    self.attempt.unlocked_pages.insert(p.clone());
                }
                if let Some(auth) = &rule.releases.authority {
                    self.attempt.authorities.insert(auth.clone());
                }
            }
        } else {
            rec.unfounded = true;
            rec.response = "Refused. Nothing in the material so far gives grounds for this request against that target. Requests must be necessary for the tasking.".into();
            penalty_trap = Some("TR-UNFOUNDED");
        }
        let rec_id = rec.id.clone();
        if let Some(code) = penalty_trap {
            let t = self.builtin(code);
            self.record_trap(&t, &rec_id, &format!("{} against {}", rt.label, if target == "ALL" { "every target" } else { &target }));
        }
        let granted = rec.granted;
        let response = rec.response.clone();
        self.log("requests", if granted { "request_granted" } else { "request_refused" }, &rec_id, &format!("{}: {}", rt.label, target));
        self.attempt.requests.push(rec);
        let mut notices = vec![if granted { format!("Request granted. {response}") } else { format!("Request refused. {response}") }];
        if granted {
            let n = self.case.rules.request_rules.iter().find(|r| r.request_type == rtype && r.targets.contains(&target)).map(|r| r.releases.evidence.len()).unwrap_or(0);
            if n > 0 {
                notices.push(format!("{n} new item{} added to the evidence list.", if n == 1 { "" } else { "s" }));
            }
        }
        Ok(Outcome { notices, result: json!({"granted": granted, "response": response}), ..Default::default() })
    }

    // ------------------------------------------------------------ osint
    fn page_view(&self, p: &Page, snapshot: Option<usize>) -> Value {
        let site = self.case.osint.sites.iter().find(|s| s.id == p.site);
        let visible = !p.private || self.attempt.unlocked_pages.contains(&p.id) || self.attempt.persona_pages.contains(&p.id);
        let mut v = json!({
            "id": p.id, "url": p.url, "kind": p.kind, "title": p.title, "handle": p.handle,
            "display_name": p.display_name, "avatar": p.avatar, "private": p.private, "visible": visible,
            "site": site, "snapshots": p.snapshots.iter().map(|s| json!({"captured": s.get("captured"), "note": s.get("note")})).collect::<Vec<_>>(),
            "via_persona": self.attempt.persona_pages.contains(&p.id),
        });
        if visible {
            v["bio"] = json!(p.bio);
            v["fields"] = json!(p.fields);
            v["body"] = json!(p.body);
            v["posts"] = json!(p.posts);
            v["connections"] = json!(p.connections);
            let avail = self.pages_available();
            v["links"] = json!(p.links.iter().filter(|l| avail.contains(l)).filter_map(|l| self.case.page(l)).map(|lp| json!({"id": lp.id, "url": lp.url, "title": lp.title})).collect::<Vec<_>>());
            if let Some(i) = snapshot {
                if let Some(s) = p.snapshots.get(i) {
                    v["snapshot"] = json!(i);
                    v["snapshot_captured"] = s.get("captured").cloned().unwrap_or(Value::Null);
                    v["snapshot_note"] = s.get("note").cloned().unwrap_or(Value::Null);
                    for k in ["bio", "fields", "posts"] {
                        if let Some(x) = s.get(k) {
                            v[k] = x.clone();
                        }
                    }
                }
            }
        }
        v
    }

    fn resolve_page(&self, a: &Value) -> Option<Page> {
        let avail = self.pages_available();
        let id = s_arg(a, "page");
        let url = s_arg(a, "url").trim().trim_end_matches('/').to_lowercase();
        self.case
            .osint
            .pages
            .iter()
            .filter(|p| avail.contains(&p.id))
            .find(|p| (!id.is_empty() && p.id == id) || (!url.is_empty() && (p.url.trim_end_matches('/').to_lowercase() == url || p.url.trim_end_matches('/').to_lowercase() == format!("https://{url}"))))
            .cloned()
    }

    pub fn osint_open(&mut self, a: &Value) -> R<Outcome> {
        let confirm = a.get("confirm").and_then(|c| c.as_bool()).unwrap_or(false);
        let Some(p) = self.resolve_page(a) else {
            self.log("browser", "page_not_found", s_arg(a, "url"), "");
            return Ok(Outcome { result: json!({"not_found": true}), ..Default::default() });
        };
        let snapshot = a.get("snapshot").and_then(|x| x.as_u64()).map(|x| x as usize);
        let views = self.attempt.page_views.get(&p.id).copied().unwrap_or(0) + 1;
        for t in self.traps_of("excess_views") {
            if t.trigger.pages.contains(&p.id) && !self.authorised(&t) && views > t.trigger.max_views.unwrap_or(3) && !self.has_trap(&t.id, &p.id) {
                let text = if t.warning.is_empty() { format!("You have viewed this profile several times. {}", t.lesson) } else { t.warning.clone() };
                if let Some(o) = self.gate(&t.id, &text, confirm) {
                    return Ok(o);
                }
                self.record_trap(&t, &p.id, &format!("{views} views without authority"));
            }
        }
        self.attempt.page_views.insert(p.id.clone(), views);
        self.log("browser", if snapshot.is_some() { "archive_viewed" } else { "page_viewed" }, &p.id, &p.url);
        Ok(Outcome { result: json!({"page": self.page_view(&p, snapshot)}), ..Default::default() })
    }

    fn persona(&mut self, a: &Value, confirm: bool) -> R<Outcome> {
        let p = self.resolve_page(a).ok_or_else(|| bad("Unknown page."))?;
        if !p.private {
            return Err(bad("This page is public."));
        }
        let traps: Vec<Trap> = self.traps_of("persona_access").into_iter().filter(|t| t.trigger.pages.is_empty() || t.trigger.pages.contains(&p.id)).collect();
        let authorised = !traps.is_empty() && traps.iter().all(|t| self.authorised(t));
        if !authorised {
            let text = traps.first().map(|t| if t.warning.is_empty() { t.lesson.clone() } else { t.warning.clone() }).unwrap_or_else(|| self.builtin("TR-PERSONA").lesson);
            if let Some(o) = self.gate("TR-PERSONA", &format!("Using a fake persona to get into a private profile is deception. {text}"), confirm) {
                return Ok(o);
            }
            if traps.is_empty() {
                let t = self.builtin("TR-PERSONA");
                self.record_trap(&t, &p.id, "Follow request sent from a false persona");
            }
            for t in traps {
                self.record_trap(&t, &p.id, "Follow request sent from a false persona");
            }
        }
        self.attempt.persona_pages.insert(p.id.clone());
        self.log("browser", "persona_follow_request", &p.id, "Follow request accepted");
        Ok(Outcome { notices: vec!["The follow request was accepted. The profile is now visible.".into()], result: json!({"page": self.page_view(&p, None)}), ..Default::default() })
    }

    fn capture(&mut self, a: &Value, confirm: bool) -> R<Outcome> {
        let p = self.resolve_page(a).ok_or_else(|| bad("Unknown page."))?;
        let method = if s_arg(a, "method") == "screenshot" { "screenshot" } else { "full" };
        let snapshot = a.get("snapshot").and_then(|x| x.as_u64()).map(|x| x as usize);
        if !self.attempt.page_views.contains_key(&p.id) {
            return Err(bad("Open the page before capturing it."));
        }
        let view = self.page_view(&p, snapshot);
        if view["visible"] != json!(true) {
            return Err(bad("You cannot capture content you cannot see."));
        }
        for t in self.traps_of("capture_page") {
            if t.trigger.pages.contains(&p.id) && !self.has_trap(&t.id, &p.id) {
                let text = if t.warning.is_empty() { t.lesson.clone() } else { t.warning.clone() };
                if let Some(o) = self.gate(&t.id, &format!("Check before you collect this. {text}"), confirm) {
                    return Ok(o);
                }
                self.record_trap(&t, &p.id, "Captured material outside the scope of the case");
            }
        }
        if method == "screenshot" {
            if let Some(o) = self.gate("TR-SCREENSHOT", "A quick screenshot records no capture time, address or hash. It will not count as evidence. Use a full capture instead.", confirm) {
                return Ok(o);
            }
            let traps = self.traps_of("poor_capture");
            if traps.is_empty() {
                let t = self.builtin("TR-SCREENSHOT");
                self.record_trap(&t, &p.id, "Screenshot without capture details");
            }
            for t in traps {
                self.record_trap(&t, &p.id, "Screenshot without capture details");
            }
        }
        let canonical = serde_json::to_vec(&view).unwrap_or_default();
        let hash = if method == "full" { sha256_hex(&canonical) } else { String::new() };
        let id = self.attempt.next_id("CAP");
        let cap = Capture {
            id: id.clone(),
            page: p.id.clone(),
            url: p.url.clone(),
            title: format!("{}{}", p.title, snapshot.map(|i| format!(" (archive {})", i + 1)).unwrap_or_default()),
            time: now_iso(),
            case_time: self.case_time(),
            hash: hash.clone(),
            snapshot,
            method: method.into(),
            persona: self.attempt.persona_pages.contains(&p.id),
        };
        self.attempt.captures.push(cap);
        self.log("browser", if method == "full" { "page_captured" } else { "page_screenshot" }, &id, &format!("{} {}", p.url, hash));
        let notice = if method == "full" {
            format!("Captured as {id} with time, address and SHA-256. It can now be cited as evidence.")
        } else {
            format!("Screenshot saved as {id}. It has no capture details and cannot be cited.")
        };
        Ok(Outcome { notices: vec![notice], result: json!({"id": id}), ..Default::default() })
    }

    pub fn osint_search(&self, q: &str) -> Value {
        let q = q.trim().to_lowercase();
        if q.chars().count() < 2 {
            return json!([]);
        }
        let terms: Vec<&str> = q.split_whitespace().collect();
        let qn = norm_ident(&q);
        let avail = self.pages_available();
        let mut out = vec![];
        for p in self.case.osint.pages.iter().filter(|p| avail.contains(&p.id)) {
            let mut hay = vec![p.title.clone(), p.handle.clone(), p.display_name.clone(), p.url.clone()];
            hay.extend(p.search_terms.iter().cloned());
            if !p.private {
                hay.push(p.bio.clone());
                hay.extend(p.fields.values().cloned());
            }
            let text = hay.join(" ").to_lowercase();
            let normed = norm_ident(&text);
            let hit = terms.iter().all(|t| text.contains(t)) || (qn.len() >= 6 && normed.contains(&qn));
            if hit {
                let site = self.case.osint.sites.iter().find(|s| s.id == p.site).map(|s| s.name.clone()).unwrap_or_default();
                let snippet: String = if p.private { "This account is private.".into() } else { p.bio.chars().take(140).collect() };
                out.push(json!({"page": p.id, "url": p.url, "title": p.title, "site": site, "handle": p.handle, "snippet": snippet}));
            }
        }
        json!(out)
    }

    // ------------------------------------------------------------ statements
    fn claim_released(&self, id: &str) -> bool {
        self.case.claim(id).map(|(st, _)| self.is_released(&st.evidence)).unwrap_or(false)
    }

    fn claim_link(&mut self, a: &Value, confirm: bool) -> R<Outcome> {
        let claim = s_arg(a, "claim").to_string();
        let relation = s_arg(a, "relation").to_string();
        if !self.claim_released(&claim) {
            return Err(bad("That claim is not available yet."));
        }
        let with_claim = ["agrees", "conflicts", "adds_detail", "unverifiable"];
        let with_evidence = ["supports", "contradicts"];
        let (other, evidence) = if with_claim.contains(&relation.as_str()) {
            let o = s_arg(a, "other_claim").to_string();
            if relation == "unverifiable" && o.is_empty() {
                (None, vec![])
            } else {
                if o == claim || !self.claim_released(&o) {
                    return Err(bad("Choose a different claim to link to."));
                }
                (Some(o), vec![])
            }
        } else if with_evidence.contains(&relation.as_str()) {
            let ev = dedupe(list_arg(a, "evidence"));
            if ev.is_empty() {
                return Err(bad("Choose the evidence that supports or contradicts this claim."));
            }
            for e in &ev {
                if !self.citable(e) {
                    return Err(bad(format!("{e} cannot be cited.")));
                }
            }
            (None, ev)
        } else {
            return Err(bad("Unknown link type."));
        };
        let _ = confirm;
        let id = self.attempt.next_id("CLK");
        let note = s_arg(a, "note").trim().chars().take(400).collect::<String>();
        let detail = format!("{relation} {}", other.clone().unwrap_or_else(|| evidence.join(", ")));
        self.attempt.claim_links.push(ClaimLink { id: id.clone(), claim: claim.clone(), relation, other_claim: other, evidence, note, created: self.case_time() });
        self.log("statements", "claim_linked", &claim, &detail);
        Ok(Outcome { result: json!({"id": id}), ..Default::default() })
    }

    fn claim_send(&mut self, a: &Value) -> R<Outcome> {
        let id = s_arg(a, "claim").to_string();
        if !self.claim_released(&id) {
            return Err(bad("That claim is not available yet."));
        }
        let (st, cl) = self.case.claim(&id).map(|(s, c)| (s.clone(), c.clone())).unwrap();
        match s_arg(a, "to") {
            "timeline" => {
                let t = cl.time.clone().ok_or_else(|| bad("This claim has no time to send."))?;
                if self.attempt.timeline.iter().any(|e| e.description.contains(&format!("[{}]", cl.id))) {
                    return Err(bad("This claim is already on the timeline."));
                }
                let eid = self.attempt.next_id("E");
                self.attempt.timeline.push(Event {
                    id: eid.clone(),
                    time: t,
                    description: format!("{} says: {} [{}]", st.witness, cl.text, cl.id),
                    evidence: vec![st.evidence.clone()],
                    entities: cl.entities.clone(),
                    confidence: "witness account (uncorroborated)".into(),
                    clock_note: String::new(),
                });
                self.log("statements", "claim_to_timeline", &cl.id, &eid);
                Ok(Outcome { notices: vec![format!("Added to the timeline as {eid}, marked as a witness account.")], result: json!({"id": eid}), ..Default::default() })
            }
            "map" => {
                let loc = cl.place.clone().ok_or_else(|| bad("This claim has no place to send."))?;
                if self.attempt.pins.iter().any(|p| p.claim == cl.id) {
                    return Err(bad("This claim is already on the map."));
                }
                let pid = self.attempt.next_id("PIN");
                self.attempt.pins.push(MapPin { id: pid.clone(), claim: cl.id.clone(), location: loc, label: format!("{}: {}", st.witness, cl.text), time: cl.time.clone(), source: st.evidence.clone() });
                self.log("statements", "claim_to_map", &cl.id, &pid);
                Ok(Outcome { notices: vec!["Added to the map as a witness account.".into()], result: json!({"id": pid}), ..Default::default() })
            }
            _ => Err(bad("Send to the timeline or the map.")),
        }
    }

    /// Calling a witness a liar on the strength of a difference alone. Fires when
    /// the wording says someone lied, the finding cites a statement or names a
    /// witness, and none of the evidence that genuinely proves a falsehood is cited.
    fn lie_traps(&self, statement: &str, evidence: &[String]) -> Vec<Trap> {
        let low = statement.to_lowercase();
        let about_witness = evidence.iter().any(|e| self.case.is_statement_doc(e))
            || self.case.statements.iter().any(|st| {
                let w = st.witness.to_lowercase();
                low.contains(&w) || w.split_whitespace().last().map(|sur| sur.len() > 2 && low.contains(sur)).unwrap_or(false)
            });
        self.traps_of("lie_claim")
            .into_iter()
            .filter(|t| about_witness && keywords_match(statement, &t.trigger.keywords) && !evidence.iter().any(|e| t.trigger.contradicting.contains(e)))
            .collect()
    }

    fn hint(&mut self, a: &Value) -> R<Outcome> {
        if !self.training() {
            return Err(bad("Hints are switched off in assessment mode."));
        }
        let ob = s_arg(a, "objective").to_string();
        let open_obs: Vec<String> = self.case.stages.stages.iter().filter(|s| self.attempt.open_stages.contains(&s.id)).flat_map(|s| s.objectives.iter().map(|o| o.id.clone())).collect();
        if !open_obs.contains(&ob) {
            return Err(bad("That objective is not open."));
        }
        let used = self.attempt.hints.iter().filter(|h| h.objective == ob).count();
        let allowed = self.attempt.score_settings.hints_available as usize;
        if allowed == 0 {
            return Err(bad("Hints were switched off when this attempt started."));
        }
        if used >= allowed {
            return Err(bad(if allowed == 3 { "All three hints for this objective have been used.".to_string() } else { format!("This attempt allows {allowed} hint level{} per objective.", if allowed == 1 { "" } else { "s" }) }));
        }
        let text = self.case.solution.hints.get(&ob).and_then(|h| h.get(used)).cloned().unwrap_or_else(|| "No hint is available for this objective.".into());
        let cost = HINT_COST[used];
        self.attempt.hints.push(HintUse { objective: ob.clone(), level: used as u8 + 1, text: text.clone(), cost, time: self.case_time() });
        self.log("hints", "hint_used", &ob, &format!("level {}", used + 1));
        Ok(Outcome { result: json!({"level": used + 1, "text": text, "cost": cost}), ..Default::default() })
    }

    // ------------------------------------------------------------ end of case
    /// Traps that can only be judged once the report is complete.
    pub fn final_traps(&mut self) {
        let in_report: Vec<Finding> = self.attempt.findings.iter().filter(|f| f.in_report).cloned().collect();
        for t in self.traps_of("finding_claim") {
            if let Some(f) = in_report.iter().find(|f| keywords_match(&f.statement, &t.trigger.keywords) && (t.trigger.types.is_empty() || t.trigger.types.contains(&f.kind))) {
                self.record_trap(&t, "", &f.statement.clone());
            }
        }
        for t in self.traps_of("sensitive_cited") {
            if let Some(f) = in_report.iter().find(|f| f.evidence.iter().any(|e| t.trigger.ids.contains(e))) {
                self.record_trap(&t, "", &format!("{} cited in the report", f.id));
            }
        }
        for f in &in_report {
            for t in self.lie_traps(&f.statement, &f.evidence) {
                self.record_trap(&t, "", &f.statement.clone());
            }
        }
        for t in self.traps_of("confirmation_bias") {
            let theory = in_report.iter().any(|f| keywords_match(&f.statement, &t.trigger.keywords));
            let looked = t.trigger.contradicting.iter().any(|c| self.examined(c) || self.attempt.findings.iter().any(|f| f.evidence.contains(c)) || self.attempt.timeline.iter().any(|e| e.evidence.contains(c)));
            if theory && !looked {
                self.record_trap(&t, "", "The report backs a theory without dealing with the item that contradicts it");
            }
        }
        let events = self.attempt.timeline.clone();
        for t in self.traps_of("clock_uncorrected") {
            if events.iter().any(|e| self.clock_hit(&t, e)) {
                self.record_trap(&t, "", "Timeline uses an uncorrected device time");
            }
        }
    }

    fn export_traps(&mut self) {
        let in_report: Vec<Finding> = self.attempt.findings.iter().filter(|f| f.in_report).cloned().collect();
        for t in self.traps_of("sensitive_cited") {
            if let Some(f) = in_report.iter().find(|f| f.evidence.iter().any(|e| t.trigger.ids.contains(e))) {
                self.record_trap(&t, "", &format!("{} exported in a report", f.id));
            }
        }
    }

    pub fn report_issues(&self) -> Vec<String> {
        let mut v = vec![];
        for f in self.attempt.findings.iter().filter(|f| f.in_report) {
            if f.evidence.is_empty() {
                v.push(format!("{} has no citation.", f.id));
            }
        }
        let r = &self.attempt.report;
        for (k, label) in [(&r.summary, "summary"), (&r.scope_method, "scope and method"), (&r.gaps, "gaps and limitations"), (&r.recommendations, "recommendations")] {
            if k.trim().is_empty() {
                v.push(format!("The {label} section is empty."));
            }
        }
        if self.attempt.timeline.iter().any(|e| e.evidence.is_empty()) {
            v.push("Some timeline entries cite no evidence.".into());
        }
        v
    }

    // ------------------------------------------------------------ analysis helpers
    fn item_text(&self, item: &EvidenceItem) -> String {
        let p = self.case.dir.join(&item.file);
        let body = if item.kind == "image" { String::new() } else { fs::read_to_string(p).unwrap_or_default() };
        let meta: Vec<String> = item.metadata.iter().map(|(k, v)| format!("{k} {v}")).collect();
        format!("{} {} {} {} {} {}", item.id, item.title, item.summary, item.source, meta.join(" "), body)
    }

    pub fn search(&self, a: &Value) -> Value {
        let started = std::time::Instant::now();
        let q = s_arg(a, "query").trim().to_lowercase();
        let types = list_arg(a, "types");
        let tag = s_arg(a, "tag");
        let entity = s_arg(a, "entity");
        let grade = s_arg(a, "grade");
        let from = parse_time(s_arg(a, "from"));
        let to = parse_time(s_arg(a, "to")).map(|t| t + Duration::days(1));
        let ent_terms: Vec<String> = self.case.entity(entity).map(|e| { let mut v = e.identifiers.iter().map(|i| norm_ident(i)).collect::<Vec<_>>(); v.push(norm_ident(&e.label)); v }).unwrap_or_default();
        let terms: Vec<String> = q.split_whitespace().map(String::from).collect();
        let mut out = vec![];
        for id in self.released() {
            let Some(item) = self.case.item(&id) else { continue };
            if !types.is_empty() && !types.contains(&item.kind) {
                continue;
            }
            if !tag.is_empty() && !item.tags.iter().any(|t| t == tag) {
                continue;
            }
            if !grade.is_empty() && self.attempt.grades.get(&id).map(|g| format!("{}{}", g.source, g.info)).map(|g| !g.starts_with(grade)).unwrap_or(true) {
                continue;
            }
            let text = self.item_text(item);
            let low = text.to_lowercase();
            if !ent_terms.is_empty() {
                let normed = norm_ident(&low);
                if !ent_terms.iter().any(|t| !t.is_empty() && normed.contains(t)) {
                    continue;
                }
            }
            if from.is_some() || to.is_some() {
                let mut times: Vec<chrono::DateTime<Utc>> = vec![];
                if let Some(ti) = item.table.as_ref().and_then(|t| t.time_column.clone()) {
                    let rows = parse_csv(&fs::read_to_string(self.case.dir.join(&item.file)).unwrap_or_default());
                    if let Some(ci) = rows.first().and_then(|h| h.iter().position(|c| *c == ti)) {
                        times.extend(rows.iter().skip(1).filter_map(|r| r.get(ci)).filter_map(|c| parse_time(c)));
                    }
                }
                if times.is_empty() {
                    times.extend(parse_time(&item.acquired));
                }
                if !times.iter().any(|t| from.map(|f| *t >= f).unwrap_or(true) && to.map(|x| *t < x).unwrap_or(true)) {
                    continue;
                }
            }
            if !terms.is_empty() && !terms.iter().all(|t| low.contains(t)) {
                continue;
            }
            let mut snippets = vec![];
            if let Some(first) = terms.first() {
                for line in text.lines() {
                    if line.to_lowercase().contains(first.as_str()) {
                        snippets.push(line.chars().take(160).collect::<String>());
                        if snippets.len() >= 3 {
                            break;
                        }
                    }
                }
            }
            let hits = if terms.is_empty() { 0 } else { terms.iter().map(|t| low.matches(t.as_str()).count()).sum::<usize>() };
            out.push(json!({"id": id, "title": item.title, "type": item.kind, "hits": hits, "snippets": snippets}));
        }
        out.sort_by(|a, b| b["hits"].as_u64().cmp(&a["hits"].as_u64()));
        json!({"results": out, "ms": started.elapsed().as_millis() as u64})
    }

    fn ident_map(&self) -> BTreeMap<String, String> {
        let mut m = BTreeMap::new();
        for e in &self.case.entities {
            for i in &e.identifiers {
                m.insert(norm_ident(i), e.id.clone());
            }
        }
        m
    }

    pub fn suggest_links(&self) -> Value {
        let idents = self.ident_map();
        let mut pairs: BTreeMap<(String, String), (usize, BTreeSet<String>)> = BTreeMap::new();
        for id in self.released() {
            if !self.examined(&id) {
                continue;
            }
            let Some(item) = self.case.item(&id) else { continue };
            let Some(tab) = &item.table else { continue };
            if tab.entity_columns.len() < 2 {
                continue;
            }
            let rows = parse_csv(&fs::read_to_string(self.case.dir.join(&item.file)).unwrap_or_default());
            let Some(head) = rows.first() else { continue };
            let cols: Vec<usize> = tab.entity_columns.iter().filter_map(|c| head.iter().position(|h| h == c)).collect();
            for r in rows.iter().skip(1) {
                let mut ents: Vec<String> = cols.iter().filter_map(|c| r.get(*c)).filter_map(|v| idents.get(&norm_ident(v)).cloned()).collect();
                ents.sort();
                ents.dedup();
                for i in 0..ents.len() {
                    for j in i + 1..ents.len() {
                        let e = pairs.entry((ents[i].clone(), ents[j].clone())).or_default();
                        e.0 += 1;
                        e.1.insert(id.clone());
                    }
                }
            }
        }
        let visible = self.visible_entities();
        let mut out: Vec<Value> = pairs
            .into_iter()
            .filter(|((a, b), (n, _))| *n >= 3 && !self.link_exists(a, b) && visible.contains(a) && visible.contains(b))
            .map(|((a, b), (n, ev))| json!({"from": a, "to": b, "count": n, "evidence": ev, "reason": format!("Appear together in {n} records")}))
            .collect();
        out.sort_by(|x, y| y["count"].as_u64().cmp(&x["count"].as_u64()));
        json!(out)
    }

    fn visible_entities(&self) -> BTreeSet<String> {
        self.case
            .entities
            .iter()
            .filter(|e| e.hidden_until.as_ref().map(|s| self.attempt.open_stages.contains(s)).unwrap_or(true))
            .map(|e| e.id.clone())
            .collect()
    }

    pub fn map_points(&self) -> Value {
        let Some(map) = &self.case.map else { return json!([]) };
        let locs: BTreeMap<&str, &MapLocation> = map.locations.iter().map(|l| (l.id.as_str(), l)).collect();
        let mut out = vec![];
        for id in self.released() {
            let Some(item) = self.case.item(&id) else { continue };
            let Some(tab) = &item.table else { continue };
            if tab.location_column.is_none() && tab.x_column.is_none() {
                continue;
            }
            let rows = parse_csv(&fs::read_to_string(self.case.dir.join(&item.file)).unwrap_or_default());
            let Some(head) = rows.first() else { continue };
            let col = |name: &Option<String>| name.as_ref().and_then(|n| head.iter().position(|h| h == n));
            let (tc, lc, xc, yc) = (col(&tab.time_column), col(&tab.location_column), col(&tab.x_column), col(&tab.y_column));
            let dcols: Vec<usize> = tab.description_columns.iter().filter_map(|n| head.iter().position(|h| h == n)).collect();
            for r in rows.iter().skip(1) {
                let (x, y, label) = if let Some(l) = lc.and_then(|c| r.get(c)).and_then(|v| locs.get(v.as_str())) {
                    (l.x, l.y, l.label.clone())
                } else if let (Some(x), Some(y)) = (xc.and_then(|c| r.get(c)).and_then(|v| v.parse::<f64>().ok()), yc.and_then(|c| r.get(c)).and_then(|v| v.parse::<f64>().ok())) {
                    (x, y, String::new())
                } else {
                    continue;
                };
                let desc: Vec<String> = dcols.iter().filter_map(|c| r.get(*c).cloned()).collect();
                out.push(json!({
                    "evidence": id, "time": tc.and_then(|c| r.get(c)).cloned().unwrap_or_default(), "x": x, "y": y,
                    "label": label, "entity": tab.map_entity, "description": desc.join(" | "),
                    "offset": item.clock_offset_minutes.unwrap_or(0),
                }));
            }
        }
        let locs: BTreeMap<&str, &MapLocation> = map.locations.iter().map(|l| (l.id.as_str(), l)).collect();
        for p in &self.attempt.pins {
            if let Some(l) = locs.get(p.location.as_str()) {
                out.push(json!({"evidence": p.source, "time": p.time.clone().unwrap_or_default(), "x": l.x, "y": l.y, "label": l.label, "entity": null, "description": p.label, "offset": 0, "witness": true, "pin": p.id}));
            }
        }
        for p in &self.attempt.pins {
            if let Some(l) = locs.get(p.location.as_str()) {
                out.push(json!({"evidence": p.source, "time": p.time.clone().unwrap_or_default(), "x": l.x, "y": l.y, "label": l.label, "entity": null, "description": p.label, "offset": 0, "witness": true, "pin": p.id}));
            }
        }
        json!(out)
    }

    // ------------------------------------------------------------ state
    pub fn state_json(&self, profile: Option<Value>) -> Value {
        let a = &self.attempt;
        let released = self.released();
        let stage_order: BTreeMap<&str, usize> = self.case.stages.stages.iter().enumerate().map(|(i, s)| (s.id.as_str(), i)).collect();
        let released_by: BTreeMap<String, String> = {
            let mut m = BTreeMap::new();
            for s in &self.case.stages.stages {
                for e in &s.evidence {
                    m.insert(e.clone(), s.id.clone());
                }
            }
            for r in &a.requests {
                if r.granted {
                    if let Some(rule) = self.case.rules.request_rules.iter().find(|x| Some(&x.id) == r.rule.as_ref()) {
                        for e in &rule.releases.evidence {
                            m.insert(e.clone(), format!("request {}", r.id));
                        }
                    }
                }
            }
            m
        };
        let evidence: Vec<Value> = released
            .iter()
            .filter_map(|id| self.case.item(id))
            .map(|i| {
                let custody: Vec<&CustodyEntry> = a.custody.iter().filter(|c| c.evidence == i.id).collect();
                let received_at = custody.iter().position(|c| c.action == "received");
                let examined_at = custody.iter().position(|c| c.action.starts_with("examined"));
                let gap = matches!((examined_at, received_at), (Some(_), None)) || matches!((examined_at, received_at), (Some(e), Some(r)) if e < r);
                let last_hash = custody.iter().rev().find(|c| c.action == "hashed");
                json!({
                    "id": i.id, "title": i.title, "type": i.kind, "source": i.source, "source_group": i.source_group,
                    "acquired": i.acquired, "acquired_by": i.acquired_by, "summary": i.summary, "file": i.file,
                    "original_hash": i.original_hash, "pack_custody": i.custody, "custody": custody,
                    "clock_offset_minutes": i.clock_offset_minutes, "clock_note": i.clock_note, "timezone_note": i.timezone_note,
                    "handling": i.handling, "marking": i.marking, "tags": i.tags, "metadata": i.metadata, "table": i.table,
                    "released_by": released_by.get(&i.id), "received": received_at.is_some(), "examined": examined_at.is_some(),
                    "hashed": last_hash.is_some(), "hash_ok": last_hash.map(|h| h.hash == i.original_hash),
                    "continuity_gap": gap, "grade": a.grades.get(&i.id), "note": a.item_notes.get(&i.id),
                })
            })
            .collect();
        let stages: Vec<Value> = self
            .case
            .stages
            .stages
            .iter()
            .map(|s| {
                let open = a.open_stages.contains(&s.id);
                let mut v = json!({"id": s.id, "title": s.title, "target_minutes": s.target_minutes, "unlock_text": s.unlock_text, "open": open});
                if open {
                    v["message"] = json!(s.message);
                    v["opened_at"] = json!(a.stage_opened_at.get(&s.id));
                    v["objectives"] = json!(s.objectives.iter().map(|o| json!({"id": o.id, "text": o.text, "required": o.required, "done": a.objectives_done.contains(&o.id), "hints_used": a.hints.iter().filter(|h| h.objective == o.id).count()})).collect::<Vec<_>>());
                }
                v
            })
            .collect();
        let current = a.open_stages.last().cloned().unwrap_or_default();
        let cur_idx = stage_order.get(current.as_str()).copied().unwrap_or(0);
        let request_types: Vec<&RequestType> = self.case.stages.request_types.iter().filter(|r| stage_order.get(r.available_from.as_str()).map(|i| a.open_stages.len() > 0 && *i <= cur_idx).unwrap_or(false)).collect();
        let visible = self.visible_entities();
        let entities: Vec<&Entity> = self.case.entities.iter().filter(|e| visible.contains(&e.id)).collect();
        let pages = self.pages_available();
        let map = self.case.map.as_ref().map(|m| {
            json!({"name": m.name, "width": m.width, "height": m.height, "features": m.features,
                   "locations": m.locations.iter().filter(|l| l.stage.as_ref().map(|s| a.open_stages.contains(s)).unwrap_or(true)).collect::<Vec<_>>()})
        });
        let mut manifest = serde_json::to_value(&self.case.manifest).unwrap();
        manifest.as_object_mut().unwrap().remove("files");
        let show_traps = self.training() || a.submitted;
        let statements: Vec<&Statement> = self.case.statements.iter().filter(|st| released.contains(&st.evidence)).collect();
        let hint_cost: f64 = a.hints.iter().map(|h| h.cost).sum();
        json!({
            "profile": profile,
            "case": {
                "manifest": manifest, "brief": self.case.brief, "intake": self.case.intake, "stages": stages,
                "request_types": request_types, "entities": entities, "map": map,
                "osint": {"enabled": !self.case.osint.pages.is_empty(), "sites": self.case.osint.sites, "pages": pages.iter().filter_map(|p| self.case.page(p)).map(|p| json!({"id": p.id, "url": p.url, "title": p.title, "site": p.site})).collect::<Vec<_>>()},
                "evidence": evidence, "statements": statements,
            },
            "attempt": {
                "id": a.id, "mode": a.mode, "started": a.started, "updated": a.updated, "active_seconds": a.active_seconds,
                "case_time": self.case_time(), "scope_acknowledged": a.scope_acknowledged, "current_stage": current,
                "findings": a.findings, "timeline": a.timeline, "links": a.links, "notes": a.notes,
                "requests": a.requests, "authorities": a.authorities, "captures": a.captures, "page_views": a.page_views,
                "hints": a.hints, "hint_cost": hint_cost, "messages": a.messages, "report": a.report, "view": a.view,
                "actions": a.actions.iter().rev().take(400).collect::<Vec<_>>(), "action_count": a.actions.len(),
                "custody": a.custody, "integrity_reports": a.integrity_reports,
                "traps": if show_traps { json!(a.traps) } else { json!([]) },
                "submitted": a.submitted, "result": a.result, "report_issues": self.report_issues(),
                "claim_links": a.claim_links, "pins": a.pins, "score_settings": a.score_settings,
            },
        })
    }
}
