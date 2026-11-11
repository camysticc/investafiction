//! Plays The Last Signal end to end: OSINT captures, a private profile
//! request, network requests, traps and scoring.

use base64::Engine as _;
use invcore::{Engine, dispatch};
use serde_json::{Value, json};
use std::path::PathBuf;

fn ok(e: &mut Engine, cmd: &str, args: Value) -> Value {
    match dispatch(e, cmd, &args) {
        Ok(v) => v,
        Err(err) => panic!("{cmd} {args} failed: {} {:?}", err.message, err.details),
    }
}
fn act(e: &mut Engine, mut a: Value) -> Value {
    a["confirm"] = json!(true);
    ok(e, "act", a)
}
fn ent(st: &Value, id: &str) -> String {
    st["case"]["entities"].as_array().unwrap().iter().find(|x| x["id"] == id).map(|x| x["label"].as_str().unwrap().to_string()).unwrap_or_default()
}
fn open_stage(st: &Value, id: &str) -> bool {
    st["case"]["stages"].as_array().unwrap().iter().any(|s| s["id"] == id && s["open"] == true)
}
fn undone(st: &Value) -> Vec<String> {
    st["case"]["stages"].as_array().unwrap().iter().flat_map(|s| s["objectives"].as_array().cloned().unwrap_or_default()).filter(|o| o["required"] == true && o["done"] == false).map(|o| o["id"].as_str().unwrap().to_string()).collect()
}
fn cap(e: &mut Engine, page: &str, snapshot: Option<u64>) -> String {
    let mut a = json!({"page": page});
    if let Some(s) = snapshot {
        a["snapshot"] = json!(s);
    }
    ok(e, "osint.open", a.clone());
    a["type"] = json!("capture");
    a["method"] = json!("full");
    act(e, a)["result"]["id"].as_str().unwrap().to_string()
}
fn finding(e: &mut Engine, kind: &str, s: &str, ev: &[&str]) {
    let r = act(e, json!({"type": "add_finding", "kind": kind, "statement": s, "evidence": ev}));
    assert!(r["warning"].is_null(), "warning for {s}: {}", r["warning"]);
}

#[test]
fn signal_full_playthrough() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    ok(&mut e, "profile.set", json!({"name": "Officer Smith"}));
    let bytes = std::fs::read(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packs/dist/the-last-signal.invcase")).unwrap();
    let r = ok(&mut e, "pack.inspect", json!({"data_b64": base64::engine::general_purpose::STANDARD.encode(bytes)}));
    ok(&mut e, "pack.install", json!({"token": r["token"]}));
    ok(&mut e, "attempt.new", json!({"case_id": "the-last-signal", "mode": "training"}));
    let st = act(&mut e, json!({"type": "ack_scope"}))["state"].clone();
    let mp = ent(&st, "ENT-MP");
    let p1 = ent(&st, "ENT-P1");
    let p3 = ent(&st, "ENT-P3");
    let sur = |n: &str| n.split_whitespace().last().unwrap().to_string();
    let handle = st["case"]["entities"].as_array().unwrap().iter().find(|x| x["id"] == "ENT-MP").unwrap()["identifiers"][0].as_str().unwrap().to_string();

    // Stage 1
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    let w = ok(&mut e, "evidence.open", json!({"id": "EV-016"}));
    assert!(w["warning"].is_string(), "street list is out of scope");
    for (t, d, ev) in [("2026-03-06 17:28", "Logs off till", "EV-005"), ("2026-03-06 19:40", "Leaves home by car", "EV-011"), ("2026-03-06 20:14", "Last message to friend", "EV-010"), ("2026-03-06 18:00", "Fuel", "EV-001")] {
        act(&mut e, json!({"type": "add_event", "time": t, "description": d, "evidence": [ev], "clock_note": "Doorbell corrected by 3 minutes"}));
    }
    finding(&mut e, "fact", "The last confirmed contact was the Natter message at 20:14 on Friday.", &["EV-010", "EV-002"]);
    finding(&mut e, "fact", "They left home by car with a holdall at about 19:40.", &["EV-003", "EV-011"]);
    finding(&mut e, "inference", "The welfare risk is medium: out of character but planned, with a message.", &["EV-007", "EV-010", "EV-001"]);
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S2"), "S2 should be open; undone {:?}", undone(&st));

    // Stage 2: OSINT
    let res = ok(&mut e, "osint.search", json!({"query": handle}));
    let pages: Vec<&str> = res.as_array().unwrap().iter().map(|p| p["page"].as_str().unwrap()).collect();
    assert!(pages.contains(&"PG-011"), "search returns the false match too: {pages:?}");
    let c1 = cap(&mut e, "PG-001", None);
    let c2 = cap(&mut e, "PG-002", None);
    let c11 = cap(&mut e, "PG-011", None);
    let c14 = cap(&mut e, "PG-014", None);
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    finding(&mut e, "fact", &format!("The genuine accounts are @{handle} on Chirp and Snapfolio."), &["EV-019", &c1]);
    finding(&mut e, "fact", "The Bayboard cat sitting account is an unrelated person, a false match.", &[&c11, "EV-019"]);
    finding(&mut e, "fact", "The Tuesday ritual photo was taken at Heronmere Lodges, view of the Gullstone tower.", &[&c2, &c14]);
    // Persona trap warns
    ok(&mut e, "osint.open", json!({"page": "PG-001"}));
    let w = ok(&mut e, "act", json!({"type": "request", "request_type": "RT-PROFILE", "target": "ALL", "justification": "We want to see all private profiles just in case."}));
    assert_eq!(w["result"]["granted"], false);
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-PROFILE", "target": "ENT-OA-P3-SNAP", "justification": "Welfare concern for a missing person. This is their close friend who comments on the Tuesday photos and may know where they go."}));
    assert_eq!(r["result"]["granted"], true, "{}", r["result"]);
    let page = ok(&mut e, "osint.open", json!({"page": "PG-007"}));
    assert_eq!(page["page"]["visible"], true, "authority unlocks the private profile");
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S3"), "S3 should be open; undone {:?}", undone(&st));

    // Stage 3
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    for id in ["EV-022", "EV-024", "EV-025", "EV-026"] {
        ok(&mut e, "evidence.open", json!({"id": id}));
    }
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-NET", "target": "ENT-PH-MP", "date_from": "2026-03-05", "date_to": "2026-03-07", "justification": "Welfare enquiry for a missing person; we need location and contact records around the last contact."}));
    assert_eq!(r["result"]["granted"], true, "{}", r["result"]);
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    ok(&mut e, "evidence.open", json!({"id": "EV-031"}));
    let pts = ok(&mut e, "map.points", json!({}));
    assert!(pts.as_array().unwrap().len() > 100, "map points from ANPR, location history and cells");
    finding(&mut e, "fact", "The car's ANPR reads match the phone location history on the route north.", &["EV-022", "EV-026"]);
    finding(&mut e, "fact", "Every Tuesday evening for six weeks they went to Heronmere.", &["EV-026", "EV-024"]);
    finding(&mut e, "fact", "The phone last connected at 22:40 on the KB-HERON cell, then switched off.", &["EV-031", "EV-025"]);
    let c2s = cap(&mut e, "PG-002", Some(0));
    finding(&mut e, "fact", "A deleted post in the archive mentions a little escape to Heronmere.", &[&c2s, "EV-025"]);
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S4"), "S4 should be open; undone {:?}", undone(&st));

    // Stage 4
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    finding(&mut e, "fact", &format!("{}'s alibi fails: ANPR shows his van on Quarry Road at 22:10 though his statement says home all evening.", sur(&p1)), &["EV-032", "EV-022", "EV-036"]);
    finding(&mut e, "fact", "On Saturday at 10:12 they paid by card at the Heronmere farm shop.", &["EV-024", "EV-038"]);
    act(&mut e, json!({"type": "add_link", "from": "ENT-MP", "to": "ENT-P3", "kind": "offered a place to stay", "evidence": ["EV-025"]}));
    // Overclaim trap warns
    let w = ok(&mut e, "act", json!({"type": "add_finding", "kind": "inference", "statement": format!("{} harmed the missing person.", sur(&p1)), "evidence": ["EV-022"]}));
    assert!(w["warning"].is_string());
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S5"), "S5 should be open; undone {:?}", undone(&st));

    // Stage 5
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    let c8 = cap(&mut e, "PG-008", Some(0));
    finding(&mut e, "fact", &format!("Cabin 7 at Heronmere Lodges is owned by the {} family.", sur(&p3)), &["EV-042", &c8]);
    finding(&mut e, "inference", &format!("{} probably knows where they are but did not mention the cabin.", sur(&p3)), &["EV-033", "EV-025"]);
    finding(&mut e, "inference", "Heronmere Lodges cabin 7 is the most likely location and the first priority.", &["EV-026", "EV-022", "EV-042"]);
    finding(&mut e, "inference", "The departure appears planned and voluntary.", &["EV-010", "EV-025"]);
    for id in ["EV-022", "EV-024", "EV-025", "EV-026", "EV-031", "EV-010", "EV-003", "EV-032"] {
        act(&mut e, json!({"type": "grade", "target": id, "source": "A", "info": "1"}));
    }
    act(&mut e, json!({"type": "report", "summary": format!("{mp} appears to have left voluntarily on Friday evening for Heronmere Lodges, cabin 7, owned by a close friend's family. The car, the phone and a Saturday card payment all point there. The ex-partner's alibi does not match ANPR."),
        "scope_method": "Supplied material, public pages captured with hashes, one authorised private profile, and network records for one number over three days.",
        "gaps": "There is no confirmed activity since Saturday at 10:12; it is unknown what happened since. Why the ex-partner drove towards Heronmere is unknown. The phone has been switched off since Friday so the location cannot be confirmed.",
        "recommendations": "Make a low-key welfare visit to cabin 7, speak to the friend first, and review the risk grade.",
        "legality": "Missing person enquiry under the tasking with specific authority for one private profile.", "necessity": "Each step was needed to find a person whose welfare is at risk.", "proportionality": "Only one number, three days, and one private profile were requested, with no collection about unrelated people."}));
    act(&mut e, json!({"type": "sign"}));
    let res = ok(&mut e, "submit", json!({"confirm": true}))["result"].clone();
    let found = res["findings"].as_array().unwrap().iter().filter(|f| f["found"] == true && f["required"] == true).count();
    println!("total {} {} found {found}", res["total"], res["band"]);
    assert_eq!(found, 16, "{}", serde_json::to_string_pretty(&res["findings"]).unwrap());
    assert!(res["total"].as_f64().unwrap() >= 70.0);
}
