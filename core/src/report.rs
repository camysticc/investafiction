//! Report and log exports.

use crate::attempt::*;
use crate::model::CaseData;
use serde_json::Value;
use std::collections::BTreeSet;

fn ent_label(case: &CaseData, id: &str) -> String {
    case.entity(id).map(|e| e.label.clone()).unwrap_or_else(|| id.to_string())
}

fn cite_label(case: &CaseData, a: &Attempt, id: &str) -> String {
    if let Some(i) = case.item(id) {
        return format!("{} {}", i.id, i.title);
    }
    if let Some(c) = a.captures.iter().find(|c| c.id == id) {
        return format!("{} capture of {} at {} (SHA-256 {})", c.id, c.url, c.case_time, &c.hash.get(..16).unwrap_or(""));
    }
    id.to_string()
}

fn kind_label(k: &str) -> &str {
    match k {
        "fact" => "Fact",
        "inference" => "Inference",
        "assumption" => "Assumption",
        _ => k,
    }
}

pub fn markdown(case: &CaseData, a: &Attempt, player: &str) -> String {
    let r = &a.report;
    let mut md = String::new();
    let m = &case.manifest;
    md += &format!("# {} - analyst report\n\n", m.title);
    md += &format!("Case reference: {} v{}  \nAttempt: {} ({} mode)  \nPrepared by: {}  \n\n", m.id, m.version, a.id, a.mode, player);
    md += "*Fictional training exercise. Not official training and not legal advice.*\n\n";
    md += "## 1. Summary\n\n";
    md += &format!("{}\n\n", if r.summary.trim().is_empty() { "(not written)" } else { r.summary.trim() });
    md += "## 2. Scope and method\n\n";
    md += &format!("Tasking: {}\n\n", case.intake.tasking);
    md += &format!("{}\n\n", if r.scope_method.trim().is_empty() { "(not written)" } else { r.scope_method.trim() });
    md += "## 3. Key findings\n\n";
    let mut cited: BTreeSet<String> = BTreeSet::new();
    let findings: Vec<&Finding> = a.findings.iter().filter(|f| f.in_report).collect();
    if findings.is_empty() {
        md += "(no findings selected)\n\n";
    }
    for (i, f) in findings.iter().enumerate() {
        let grade = f.grade.as_ref().map(|g| format!(" Grade {}{}.", g.source, g.info)).unwrap_or_default();
        md += &format!("{}. **{}.** {}{}  \n   Sources: {}\n", i + 1, kind_label(&f.kind), f.statement.trim(), grade, if f.evidence.is_empty() { "NONE (uncited)".to_string() } else { f.evidence.join(", ") });
        cited.extend(f.evidence.iter().cloned());
    }
    md += "\n";
    if r.include_timeline {
        md += "## 4. Timeline\n\nAll times UTC.\n\n| Time | Event | Sources | Note |\n|---|---|---|---|\n";
        for e in &a.timeline {
            md += &format!("| {} | {} | {} | {} |\n", e.time.replace('T', " ").trim_end_matches('Z'), e.description.replace('|', "/"), e.evidence.join(", "), e.clock_note.replace('|', "/"));
            cited.extend(e.evidence.iter().cloned());
        }
        md += "\n";
    }
    if r.include_links {
        md += "## 5. Link chart summary\n\n";
        if a.links.is_empty() {
            md += "(no links recorded)\n\n";
        }
        for l in &a.links {
            let style = if l.evidence.is_empty() { "assumed, no evidence" } else { "evidenced" };
            md += &format!("- {} to {}: {} ({}{})\n", ent_label(case, &l.from), ent_label(case, &l.to), if l.kind.is_empty() { "linked" } else { &l.kind }, style, if l.evidence.is_empty() { String::new() } else { format!(": {}", l.evidence.join(", ")) });
            cited.extend(l.evidence.iter().cloned());
        }
        md += "\n";
    }
    md += "## 6. Evidence relied on\n\n";
    for c in &cited {
        md += &format!("- {}\n", cite_label(case, a, c));
    }
    md += "\n## 7. Gaps and limitations\n\n";
    md += &format!("{}\n\n", if r.gaps.trim().is_empty() { "(not written)" } else { r.gaps.trim() });
    md += "## 8. Recommendations\n\n";
    md += &format!("{}\n\n", if r.recommendations.trim().is_empty() { "(not written)" } else { r.recommendations.trim() });
    md += "## 9. Legality, necessity and proportionality\n\n";
    let l = &r.legality;
    md += &format!("**Legality.** {}\n\n**Necessity.** {}\n\n**Proportionality.** {}\n\n", l.legality.trim(), l.necessity.trim(), l.proportionality.trim());
    let reqs: Vec<&RequestRecord> = a.requests.iter().collect();
    if !reqs.is_empty() {
        md += "Requests made:\n\n";
        for q in reqs {
            md += &format!("- {} {} for {} ({}{}): {}\n", q.id, q.request_type, q.target, if q.date_from.is_empty() { String::new() } else { format!("{} to {}, ", q.date_from, q.date_to) }, if q.granted { "granted" } else { "refused" }, q.justification.replace('\n', " "));
        }
        md += "\n";
    }
    md += "## Sign-off\n\n";
    if l.signed {
        md += &format!("Signed as case lead by **{}** at {}.\n", if l.signed_by.is_empty() { player } else { &l.signed_by }, l.signed_at);
    } else {
        md += &format!("Not yet signed. Prepared by {player}.\n");
    }
    md
}

pub fn debrief_markdown(case: &CaseData, r: &Value) -> String {
    let mut md = format!("# Debrief: {}\n\n", case.manifest.title);
    md += &format!("**Score:** {} ({})\n\n", r["total"], r["band"].as_str().unwrap_or(""));
    if let Some(cats) = r["categories"].as_array() {
        md += "| Category | Points | Out of |\n|---|---|---|\n";
        for c in cats {
            md += &format!("| {} | {} | {} |\n", c["label"].as_str().unwrap_or(""), c["points"], c["weight"]);
        }
        md += "\n";
    }
    md += "## Key findings\n\n";
    for f in r["findings"].as_array().into_iter().flatten() {
        md += &format!("- [{}] {}{}: {}\n", if f["found"] == true { "found" } else { "missed" }, f["statement"].as_str().unwrap_or(""), if f["required"] == true { "" } else { " (stretch)" }, f["explain"].as_str().unwrap_or(""));
    }
    md += "\n## Red herrings\n\n";
    for h in r["herrings"].as_array().into_iter().flatten() {
        md += &format!("- {} {}: {}\n", h["label"].as_str().unwrap_or(""), if h["followed"] == true { "(followed)" } else { "(avoided)" }, h["explain"].as_str().unwrap_or(""));
    }
    md += "\n## Procedural events\n\n";
    let ev = r["procedural_events"].as_array().cloned().unwrap_or_default();
    if ev.is_empty() {
        md += "None. Well handled.\n";
    }
    for t in ev {
        md += &format!("- {} ({}, minus {}): {}\n", t["title"].as_str().unwrap_or(""), t["severity"].as_str().unwrap_or(""), t["penalty"], t["lesson"].as_str().unwrap_or(""));
    }
    md += &format!("\n## What a careful analyst would do next\n\n{}\n", r["next_steps"].as_str().unwrap_or(""));
    md
}

fn csv_cell(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') { format!("\"{}\"", s.replace('"', "\"\"")) } else { s.to_string() }
}

pub fn timeline_csv(a: &Attempt) -> String {
    let mut out = String::from("time_utc,description,sources,entities,confidence,clock_note\n");
    for e in &a.timeline {
        out += &[e.time.as_str(), &e.description, &e.evidence.join(" "), &e.entities.join(" "), &e.confidence, &e.clock_note].iter().map(|c| csv_cell(c)).collect::<Vec<_>>().join(",");
        out += "\n";
    }
    out
}

pub fn timeline_md(case: &CaseData, a: &Attempt) -> String {
    let mut md = format!("# Timeline: {}\n\nAll times UTC.\n\n| Time | Event | Sources | Entities |\n|---|---|---|---|\n", case.manifest.title);
    for e in &a.timeline {
        md += &format!("| {} | {} | {} | {} |\n", e.time, e.description.replace('|', "/"), e.evidence.join(", "), e.entities.iter().map(|x| ent_label(case, x)).collect::<Vec<_>>().join(", "));
    }
    md
}

pub fn actions_csv(a: &Attempt) -> String {
    let mut out = String::from("seq,time,case_time,view,action,target,detail\n");
    for e in &a.actions {
        out += &[e.seq.to_string().as_str(), &e.time, &e.case_time, &e.view, &e.action, &e.target, &e.detail].iter().map(|c| csv_cell(c)).collect::<Vec<_>>().join(",");
        out += "\n";
    }
    out
}
