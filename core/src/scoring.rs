//! The marking scheme from section 10 of the plan, and the debrief.

use crate::attempt::*;
use crate::engine::Session;
use crate::model::*;
use crate::util::parse_time;
use serde_json::{Value, json};
use std::collections::BTreeSet;

pub const WEIGHTS: [(&str, &str, f64); 6] = [
    ("findings", "Key findings", 35.0),
    ("analysis", "Analysis quality", 20.0),
    ("report", "Report quality", 15.0),
    ("handling", "Evidence handling and integrity", 15.0),
    ("procedure", "Procedure, legality and ethics", 10.0),
    ("grading", "Grading accuracy", 5.0),
];

fn grade_distance(a: &str, b: &str) -> i32 {
    let ord = |s: &str| s.chars().next().map(|c| c as i32).unwrap_or(0);
    (ord(a) - ord(b)).abs()
}

pub fn band(total: f64) -> &'static str {
    if total >= 85.0 {
        "Distinction"
    } else if total >= 70.0 {
        "Merit"
    } else if total >= 55.0 {
        "Pass"
    } else {
        "Needs work"
    }
}

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

pub fn score(case: &CaseData, attempt: &Attempt) -> Value {
    // A scratch session lets scoring reuse the engine's matching rules.
    let s = Session { case: case.clone(), attempt: attempt.clone(), player: String::new() };
    let sol = &case.solution;
    let report_findings: Vec<&Finding> = attempt.findings.iter().filter(|f| f.in_report).collect();
    let mut notes: Vec<String> = vec![];

    // ---- Key findings (35)
    let mut found = vec![];
    let (mut req_total, mut req_score, mut stretch_score): (f64, f64, f64) = (0.0, 0.0, 0.0);
    for kf in &sol.findings {
        let hit = attempt.findings.iter().find(|f| s.finding_matches(kf, f));
        let mut credit = 0.0;
        let mut label_ok = false;
        if let Some(f) = hit {
            label_ok = f.kind == kf.kind || (kf.kind == "fact" && f.kind == "inference");
            credit = if label_ok { 1.0 } else { 0.5 };
        }
        if kf.required {
            req_total += 1.0;
            req_score += credit;
        } else {
            stretch_score += credit * 0.5;
        }
        found.push(json!({
            "id": kf.id, "required": kf.required, "statement": kf.statement, "type": kf.kind, "found": hit.is_some(),
            "label_ok": label_ok, "your_finding": hit.map(|f| json!({"id": f.id, "statement": f.statement, "type": f.kind, "evidence": f.evidence})),
            "evidence": kf.evidence_any, "min_sources": kf.min_sources, "explain": kf.explain,
        }));
    }
    let findings_frac = if req_total > 0.0 { ((req_score + stretch_score) / req_total).min(1.0) } else { 0.0 };

    // ---- Analysis quality (20)
    // a) labelling: facts need two independent sources or a key-finding match labelled fact
    let labelled: Vec<f64> = attempt
        .findings
        .iter()
        .map(|f| {
            let matched = sol.findings.iter().find(|kf| s.finding_matches(kf, f));
            match (f.kind.as_str(), matched) {
                (_, Some(kf)) if kf.kind == f.kind => 1.0,
                ("fact", Some(_)) => 0.3,
                (_, Some(_)) => 0.8,
                ("fact", None) => if f.evidence.len() >= 2 { 0.7 } else { 0.4 },
                (_, None) => 0.8,
            }
        })
        .collect();
    let label_frac = if labelled.is_empty() { 0.0 } else { labelled.iter().sum::<f64>() / labelled.len() as f64 };
    // b) links: accepted links found, and links backed by evidence
    let links_found: Vec<Value> = sol
        .links
        .iter()
        .map(|l| {
            let mine = attempt.links.iter().find(|m| (m.from == l.a && m.to == l.b) || (m.from == l.b && m.to == l.a));
            let ok = mine.map(|m| m.evidence.iter().any(|e| l.evidence_any.contains(e) || attempt.captures.iter().any(|c| &c.id == e && l.evidence_any.contains(&c.page)))).unwrap_or(false);
            json!({"a": l.a, "b": l.b, "note": l.note, "found": mine.is_some(), "backed": ok})
        })
        .collect();
    let link_found_frac = if sol.links.is_empty() { 1.0 } else { links_found.iter().filter(|l| l["backed"] == json!(true)).count() as f64 / sol.links.len() as f64 };
    let backed_frac = if attempt.links.is_empty() { 0.0 } else { attempt.links.iter().filter(|l| !l.evidence.is_empty()).count() as f64 / attempt.links.len() as f64 };
    // c) timeline accuracy against the key events
    let key_events: Vec<&TrueEvent> = sol.timeline.iter().filter(|t| t.key).collect();
    let timeline_cmp: Vec<Value> = sol
        .timeline
        .iter()
        .map(|te| {
            let m = attempt.timeline.iter().find(|e| s.event_matches(te, e));
            json!({"id": te.id, "time": te.time, "label": te.label, "key": te.key, "matched": m.is_some(), "your_event": m.map(|e| json!({"time": e.time, "description": e.description}))})
        })
        .collect();
    let tl_frac = if key_events.is_empty() { 1.0 } else { key_events.iter().filter(|te| attempt.timeline.iter().any(|e| s.event_matches(te, e))).count() as f64 / key_events.len() as f64 };
    // d) red herrings
    let herrings: Vec<Value> = sol
        .herrings
        .iter()
        .map(|h| {
            let followed = report_findings.iter().any(|f| f.kind != "assumption" && keywords_match(&f.statement, &h.keywords) && f.evidence.iter().any(|e| h.evidence.contains(e)));
            json!({"id": h.id, "label": h.label, "followed": followed, "explain": h.explain})
        })
        .collect();
    let followed = herrings.iter().filter(|h| h["followed"] == json!(true)).count();
    let herring_frac = if sol.herrings.is_empty() { 1.0 } else { 1.0 - followed as f64 / sol.herrings.len() as f64 };
    let analysis_frac = 0.25 * label_frac + 0.25 * (0.7 * link_found_frac + 0.3 * backed_frac) + 0.3 * tl_frac + 0.2 * herring_frac;

    // ---- Report quality (15)
    let r = &attempt.report;
    let sections = [&r.summary, &r.scope_method, &r.gaps, &r.recommendations];
    let section_frac = sections.iter().map(|t| (t.split_whitespace().count() as f64 / 40.0).min(1.0)).sum::<f64>() / 4.0;
    let cited_frac = if report_findings.is_empty() { 0.0 } else { report_findings.iter().filter(|f| !f.evidence.is_empty()).count() as f64 / report_findings.len() as f64 };
    let gaps_admitted: Vec<Value> = sol
        .gaps
        .iter()
        .map(|g| {
            let all_text = format!("{} {}", r.gaps, report_findings.iter().filter(|f| f.kind != "fact").map(|f| f.statement.as_str()).collect::<Vec<_>>().join(" "));
            json!({"id": g.id, "label": g.label, "admitted": keywords_match(&all_text, &g.keywords)})
        })
        .collect();
    let gap_frac = if sol.gaps.is_empty() { 1.0 } else { gaps_admitted.iter().filter(|g| g["admitted"] == json!(true)).count() as f64 / sol.gaps.len() as f64 };
    let report_frac = 0.35 * section_frac + 0.35 * cited_frac + 0.3 * gap_frac;

    // ---- Evidence handling (15)
    let released = s.released();
    let examined: Vec<&String> = released.iter().filter(|e| s.examined(e)).collect();
    let continuity_ok = examined.iter().filter(|e| !attempt.traps.iter().any(|t| t.trap == "TR-CONT" && &t.target == **e)).count();
    let continuity_frac = if examined.is_empty() { 0.0 } else { continuity_ok as f64 / examined.len() as f64 };
    let received_frac = if released.is_empty() { 0.0 } else { released.iter().filter(|e| s.received(e)).count() as f64 / released.len() as f64 };
    let hashed_frac = if released.is_empty() { 0.0 } else { released.iter().filter(|e| attempt.custody.iter().any(|c| &c.evidence == *e && c.action == "hashed")).count() as f64 / released.len() as f64 };
    let originals: Vec<&CustodyEntry> = attempt.custody.iter().filter(|c| c.action == "examined_original").collect();
    let reason_frac = if originals.is_empty() { 1.0 } else { originals.iter().filter(|c| c.reason.split_whitespace().count() >= 5).count() as f64 / originals.len() as f64 };
    let altered = attempt.traps.iter().any(|t| t.trap == "TR-ALTER");
    let integrity_items: Vec<&EvidenceItem> = released.iter().filter_map(|e| case.item(e)).filter(|i| i.tags.iter().any(|t| t == "integrity_test")).collect();
    let integrity_frac = if integrity_items.is_empty() { 1.0 } else { integrity_items.iter().filter(|i| attempt.integrity_reports.contains_key(&i.id)).count() as f64 / integrity_items.len() as f64 };
    let mut handling_frac = 0.25 * received_frac + 0.25 * continuity_frac + 0.25 * hashed_frac + 0.1 * reason_frac + 0.15 * integrity_frac;
    if altered {
        handling_frac *= 0.5;
        notes.push("An attempt to alter an original was recorded, which halves the handling mark.".into());
    }
    if attempt.captures.iter().any(|c| c.persona) {
        notes.push("Some captures were obtained through a false persona. That material would be tainted.".into());
    }

    // ---- Procedure (10): start full and lose points per trap
    let mut penalty = 0.0;
    let mut cont = 0;
    for t in &attempt.traps {
        if t.trap == "TR-CONT" {
            cont += 1;
            if cont > 3 {
                continue;
            }
        }
        penalty += t.penalty;
    }
    let procedure_pts = (10.0 - penalty).max(0.0);

    // ---- Grading (5)
    let mut graded = 0;
    let mut close = 0;
    for (id, g) in &attempt.grades {
        if let Some(exp) = sol.grades.get(id) {
            graded += 1;
            if grade_distance(&g.source, &exp.source) <= 1 && grade_distance(&g.info, &exp.info) <= 1 {
                close += 1;
            }
        }
    }
    let expected_released = sol.grades.keys().filter(|k| released.contains(k)).count().max(1);
    let coverage = (graded as f64 / (expected_released as f64 * 0.5)).min(1.0);
    let grading_frac = if graded == 0 { 0.0 } else { (close as f64 / graded as f64) * coverage };

    let parts = [
        ("findings", findings_frac * 35.0),
        ("analysis", analysis_frac * 20.0),
        ("report", report_frac * 15.0),
        ("handling", handling_frac * 15.0),
        ("procedure", procedure_pts),
        ("grading", grading_frac * 5.0),
    ];
    let hint_cost: f64 = attempt.hints.iter().map(|h| h.cost).sum();
    let raw: f64 = parts.iter().map(|(_, v)| v).sum::<f64>() - hint_cost;
    let mut total = round1(raw.clamp(0.0, 100.0));
    let serious: Vec<&TrapEvent> = attempt.traps.iter().filter(|t| t.severity == "serious").collect();
    let capped = !serious.is_empty() && total >= 70.0;
    if capped {
        total = 69.0;
        notes.push("A serious breach caps the result at Pass, whatever the other scores were.".into());
    }
    let categories: Vec<Value> = WEIGHTS
        .iter()
        .zip(parts.iter())
        .map(|((key, label, w), (_, pts))| json!({"key": key, "label": label, "weight": w, "points": round1(*pts)}))
        .collect();

    // Stage times compared with their targets
    let mut stage_times = vec![];
    let opened: Vec<(String, u64)> = case.stages.stages.iter().filter_map(|st| attempt.stage_opened_at.get(&st.id).map(|t| (st.id.clone(), *t))).collect();
    for (i, (sid, t0)) in opened.iter().enumerate() {
        let t1 = opened.get(i + 1).map(|x| x.1).unwrap_or(attempt.active_seconds);
        let st = case.stages.stages.iter().find(|x| &x.id == sid).unwrap();
        stage_times.push(json!({"stage": sid, "title": st.title, "minutes": ((t1.saturating_sub(*t0)) as f64 / 60.0).round(), "target": st.target_minutes}));
    }

    let procedural: Vec<Value> = attempt.traps.iter().map(|t| json!(t)).collect();
    let refused: Vec<&RequestRecord> = attempt.requests.iter().filter(|r| !r.granted).collect();
    let uncaptured: BTreeSet<&String> = attempt.page_views.keys().filter(|p| !attempt.captures.iter().any(|c| &&c.page == p && c.method == "full")).collect();

    json!({
        "total": total, "band": band(total), "capped": capped, "hint_cost": hint_cost, "categories": categories,
        "findings": found, "links": links_found, "timeline": timeline_cmp, "herrings": herrings, "gaps": gaps_admitted,
        "procedural_events": procedural, "refused_requests": refused, "notes": notes, "stage_times": stage_times,
        "next_steps": sol.next_steps, "story": sol.story,
        "detail": {
            "label_quality": round1(label_frac * 100.0), "links_found": round1(link_found_frac * 100.0), "timeline_accuracy": round1(tl_frac * 100.0),
            "herrings_followed": followed, "sections_complete": round1(section_frac * 100.0), "findings_cited": round1(cited_frac * 100.0),
            "gaps_admitted": round1(gap_frac * 100.0), "received": round1(received_frac * 100.0), "continuity": round1(continuity_frac * 100.0),
            "hashed": round1(hashed_frac * 100.0), "integrity_reported": round1(integrity_frac * 100.0), "grades_close": close, "grades_compared": graded,
            "pages_viewed_not_captured": uncaptured.len(),
            "active_minutes": (attempt.active_seconds as f64 / 60.0).round(),
            "first_timeline_time": attempt.timeline.first().and_then(|e| parse_time(&e.time)).map(crate::util::iso),
        },
    })
}
