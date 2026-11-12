//! Investigation replay, built after submission from the saved action log,
//! custody log and findings, plus the suggested route in the case pack.
//! Nothing extra is stored.

use crate::attempt::*;
use crate::engine::Session;
use crate::model::*;
use crate::util::parse_time;
use serde_json::{Value, json};
use std::collections::BTreeSet;

fn secs(case: &CaseData, case_time: &str) -> i64 {
    match (parse_time(&case.intake.clock_start), parse_time(case_time)) {
        (Some(a), Some(b)) => (b - a).num_seconds().max(0),
        _ => 0,
    }
}

pub fn build(case: &CaseData, attempt: &Attempt) -> Value {
    let s = Session { case: case.clone(), attempt: attempt.clone(), player: String::new() };
    let sol = &case.solution;
    let important: BTreeSet<&String> = sol.findings.iter().flat_map(|k| k.evidence_any.iter()).collect();
    let stage_of = |t: i64| -> String {
        let mut cur = String::new();
        for st in &case.stages.stages {
            if let Some(o) = attempt.stage_opened_at.get(&st.id) {
                if (*o as i64) <= t {
                    cur = st.id.clone();
                }
            }
        }
        cur
    };
    // Which player finding reached which key finding
    let mut reached: Vec<(String, String, String)> = vec![]; // (finding id, kf id, kf statement)
    let mut missed = vec![];
    for kf in &sol.findings {
        if let Some(f) = attempt.findings.iter().find(|f| s.finding_matches(kf, f)) {
            reached.push((f.id.clone(), kf.id.clone(), kf.statement.clone()));
        } else {
            missed.push(json!({"id": kf.id, "statement": kf.statement, "required": kf.required, "evidence": kf.evidence_any, "explain": kf.explain}));
        }
    }

    let mut markers: Vec<Value> = vec![];
    let mut opened = BTreeSet::new();
    let mut push = |a: &ActionEntry, kind: &str, label: String, caption: String, good: Option<bool>| {
        let t = secs(case, &a.case_time);
        markers.push(json!({"seq": a.seq, "t": t, "case_time": a.case_time, "time": a.time, "kind": kind, "label": label, "caption": caption, "good": good, "stage": stage_of(t)}));
    };
    for a in &attempt.actions {
        match a.action.as_str() {
            "attempt_started" => push(a, "start", "Case started".into(), format!("You began the case in {}.", a.detail), None),
            "scope_acknowledged" => push(a, "scope", "Read the brief".into(), "You confirmed the scope and authorities before touching any evidence.".into(), Some(true)),
            "stage_opened" => push(a, "stage", format!("Stage opened: {}", a.detail), "New material and a message from the case lead arrived.".into(), None),
            "opened_copy" | "opened_original" if important.contains(&a.target) && opened.insert(a.target.clone()) => {
                let title = case.item(&a.target).map(|i| i.title.clone()).unwrap_or_default();
                let orig = a.action == "opened_original";
                push(a, "evidence", format!("First look at {}", a.target), format!("{title}. {}", if orig { "You opened the original rather than a working copy. A careful analyst examines a verified copy." } else { "This item mattered to the answer." }), Some(!orig));
            }
            "finding_added" => {
                if let Some((_, kf, st)) = reached.iter().find(|(f, _, _)| f == &a.target) {
                    push(a, "key", format!("Key finding reached ({kf})"), format!("Your finding {} matched: {st}", a.target), Some(true));
                } else {
                    push(a, "finding", format!("Finding {} recorded", a.target), a.detail.clone(), None);
                }
            }
            "request_made" | "request_granted" | "request_refused" => {
                let ok = a.action != "request_refused";
                push(a, "request", format!("Request {}", if ok { "granted" } else { "refused" }), a.detail.clone(), Some(ok));
            }
            "hint_used" => push(a, "hint", format!("Hint used ({})", a.detail), format!("A hint for objective {}. Hints cost a little each.", a.target), Some(false)),
            "integrity_issue_reported" => push(a, "integrity", format!("Integrity problem reported: {}", a.target), "You reported the problem instead of trying to fix it.".into(), Some(true)),
            "claim_linked" => push(a, "statement", format!("Statement link on {}", a.target), a.detail.clone(), None),
            "legality_signed" => push(a, "legality", "Legality statement signed".into(), "You recorded why the work was lawful, necessary and proportionate.".into(), Some(true)),
            "submitted" => push(a, "submit", "Report submitted".into(), a.detail.clone(), None),
            _ => {}
        }
    }
    // Traps carry their own case time
    for (i, t) in attempt.traps.iter().enumerate() {
        let ts = secs(case, &t.time);
        markers.push(json!({"seq": 1_000_000 + i, "t": ts, "case_time": t.time, "time": "", "kind": "trap", "label": t.title, "caption": t.lesson, "good": false, "stage": stage_of(ts), "severity": t.severity}));
    }
    markers.sort_by(|a, b| a["t"].as_i64().cmp(&b["t"].as_i64()).then(a["seq"].as_u64().cmp(&b["seq"].as_u64())));

    // Long idle gaps, measured in real time between actions
    let mut gaps = vec![];
    for w in attempt.actions.windows(2) {
        if let (Some(a), Some(b)) = (parse_time(&w[0].time), parse_time(&w[1].time)) {
            let mins = (b - a).num_minutes();
            if mins >= 10 {
                gaps.push(json!({"after_seq": w[0].seq, "t": secs(case, &w[0].case_time), "minutes": mins}));
            }
        }
    }
    // Time in each stage against its target
    let opened_stages: Vec<(&Stage, u64)> = case.stages.stages.iter().filter_map(|st| attempt.stage_opened_at.get(&st.id).map(|t| (st, *t))).collect();
    let mut stages = vec![];
    for (i, (st, t0)) in opened_stages.iter().enumerate() {
        let t1 = opened_stages.get(i + 1).map(|x| x.1).unwrap_or(attempt.active_seconds);
        stages.push(json!({"id": st.id, "title": st.title, "start": t0, "end": t1, "minutes": ((t1.saturating_sub(*t0)) as f64 / 60.0).round(), "target": st.target_minutes}));
    }
    let stuck = stages.iter().filter(|s| s["minutes"].as_f64().unwrap_or(0.0) > s["target"].as_f64().unwrap_or(0.0) * 1.3).map(|s| s["id"].clone()).collect::<Vec<_>>();

    json!({
        "case": {"id": case.manifest.id, "title": case.manifest.title, "estimated_minutes": case.manifest.estimated_minutes},
        "attempt": {"id": attempt.id, "mode": attempt.mode, "started": attempt.started, "submitted_at": attempt.submitted_at, "active_seconds": attempt.active_seconds, "score_settings": attempt.score_settings},
        "total_seconds": attempt.active_seconds.max(markers.last().and_then(|m| m["t"].as_u64()).unwrap_or(0)),
        "markers": markers,
        "missed": missed,
        "stages": stages,
        "stuck": stuck,
        "gaps": gaps,
        "route": sol.route.iter().map(|r| json!({"stage": r.stage, "label": r.label, "note": r.note, "stage_start": attempt.stage_opened_at.get(&r.stage)})).collect::<Vec<_>>(),
        "findings": attempt.findings,
        "custody": attempt.custody,
        "timeline": attempt.timeline,
        "result": attempt.result,
    })
}
