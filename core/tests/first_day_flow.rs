//! Plays the Academy practice case, First Day, through the API and checks the
//! v1.3 features: statement links, sending claims to the timeline and map,
//! the difference-for-a-lie trap, score settings, replay, history and stores.

use base64::Engine as _;
use invcore::{Engine, dispatch};
use serde_json::{Value, json};
use std::path::PathBuf;

fn ok(e: &mut Engine, cmd: &str, args: Value) -> Value {
    match dispatch(e, cmd, &args) {
        Ok(v) => v,
        Err(err) => panic!("{cmd} failed: {} {:?}", err.message, err.details),
    }
}

fn act(e: &mut Engine, args: Value) -> Value {
    let mut a = args.clone();
    a["confirm"] = json!(true);
    ok(e, "act", a)
}

fn install(e: &mut Engine) {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packs/dist/first-day.invcase");
    let b64 = base64::engine::general_purpose::STANDARD.encode(std::fs::read(p).expect("build the packs first"));
    let r = ok(e, "pack.inspect", json!({"data_b64": b64}));
    let token = r["token"].as_str().unwrap().to_string();
    ok(e, "pack.install", json!({"token": token}));
}

fn traps(state: &Value) -> Vec<String> {
    state["attempt"]["traps"].as_array().unwrap().iter().map(|t| t["title"].as_str().unwrap().to_string()).collect()
}

#[test]
fn first_day_with_statements_replay_and_history() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    ok(&mut e, "profile.set", json!({"name": "Officer Smith"}));
    install(&mut e);

    // Score settings: only one hint level, warnings on
    ok(&mut e, "attempt.new", json!({"case_id": "first-day", "mode": "training", "hints_available": 1, "warnings": true}));
    let st = ok(&mut e, "state", json!({}));
    assert_eq!(st["attempt"]["score_settings"]["hints_available"], json!(1));
    act(&mut e, json!({"type": "ack_scope"}));
    act(&mut e, json!({"type": "hint", "objective": "OB-1-1"}));
    assert!(dispatch(&mut e, "act", &json!({"type": "hint", "objective": "OB-1-1"})).is_err(), "second hint level should be refused");

    // Stage 1
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    act(&mut e, json!({"type": "hash_check", "all": true}));
    act(&mut e, json!({"type": "report_integrity", "id": "EV-012", "note": "The first emailed copy does not match its hash. Using the verified copy EV-005 instead."}));
    // Statement claims from the customer are already released in stage 1
    let st = ok(&mut e, "state", json!({}));
    let sts = st["case"]["statements"].as_array().unwrap();
    assert_eq!(sts.len(), 1, "only the customer's statement is released in stage 1");
    // Send the customer's afternoon claim to the timeline and map
    let r = act(&mut e, json!({"type": "claim_send", "claim": "ST-1.2", "to": "timeline"}));
    assert!(r["state"]["attempt"]["timeline"].as_array().unwrap().iter().any(|ev| ev["description"].as_str().unwrap().contains("[ST-1.2]")));
    let r = act(&mut e, json!({"type": "claim_send", "claim": "ST-1.1", "to": "map"}));
    assert_eq!(r["state"]["attempt"]["pins"].as_array().unwrap().len(), 1);
    let pts = ok(&mut e, "map.points", json!({}));
    assert!(pts.as_array().unwrap().iter().any(|p| p["witness"] == json!(true)));
    for (t, d, ev) in [("2026-02-02 16:10", "Parcel packed", "EV-003"), ("2026-02-03 09:30", "Collected by courier (corrected)", "EV-005")] {
        act(&mut e, json!({"type": "add_event", "time": t, "description": d, "evidence": [ev]}));
    }
    let st = ok(&mut e, "state", json!({}));
    assert!(st["case"]["stages"][1]["open"] == json!(true), "stage 2 should open");

    // Stage 2: the driver's statement is released; link claims
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    act(&mut e, json!({"type": "hash_check", "all": true}));
    act(&mut e, json!({"type": "claim_link", "claim": "ST-1.3", "relation": "conflicts", "other_claim": "ST-2.3"}));
    act(&mut e, json!({"type": "claim_link", "claim": "ST-1.3", "relation": "supports", "evidence": ["EV-013"]}));
    act(&mut e, json!({"type": "claim_link", "claim": "ST-2.1", "relation": "supports", "evidence": ["EV-005"]}));
    assert!(dispatch(&mut e, "act", &json!({"type": "claim_link", "claim": "ST-1.3", "relation": "conflicts", "other_claim": "ST-1.3"})).is_err());
    // Training warns before the difference-for-a-lie trap
    let w = ok(&mut e, "act", json!({"type": "add_finding", "statement": "The driver lied about delivering to number 41.", "kind": "inference", "evidence": ["EV-008"]}));
    assert!(!w["warning"].is_null(), "should warn first in training mode");
    act(&mut e, json!({"type": "request", "request_type": "RT-PHOTO", "target": "ENT-PARCEL", "justification": "The parcel was marked delivered but never arrived. The photo and GPS show where it was left."}));
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    act(&mut e, json!({"type": "claim_link", "claim": "ST-2.2", "relation": "contradicts", "evidence": ["EV-006"]}));
    act(&mut e, json!({"type": "add_finding", "statement": "The delivery photo and GPS show the parcel was left at number 14, not 41.", "kind": "fact", "evidence": ["EV-006"]}));
    act(&mut e, json!({"type": "add_finding", "statement": "The parcel was most likely left at number 14 by mistake, with the digits swapped.", "kind": "inference", "evidence": ["EV-006", "EV-013"]}));
    let r = act(&mut e, json!({"type": "add_finding", "statement": "The driver was lying about the house number.", "kind": "inference", "evidence": ["EV-008"]}));
    assert!(traps(&r["state"]).iter().any(|t| t == "Mistaking a difference for a lie"));
    act(&mut e, json!({"type": "add_link", "from": "ENT-PARCEL", "to": "ENT-ADDR14", "kind": "left at", "evidence": ["EV-006"]}));
    act(&mut e, json!({"type": "report", "summary": "The parcel was most likely left at number 14 by mistake. The photo and GPS show 14 and the customer's doorbell saw nobody.",
        "scope_method": "Supplied records, two statements and one courier request.", "gaps": "Nobody has yet confirmed number 14 still has the parcel.",
        "recommendations": "Ask number 14 to pass it on and tell the courier.",
        "legality": "The shop asked for this review of its own records.", "necessity": "The photo was needed to see where the parcel was left.",
        "proportionality": "One narrow request about one parcel, nothing more."}));
    act(&mut e, json!({"type": "sign"}));
    let sub = ok(&mut e, "submit", json!({"confirm": true}));
    let res = &sub["result"];
    assert!(res["statement_checks"].as_array().unwrap().iter().filter(|c| c["found"] == json!(true)).count() >= 4);
    for area in ["evidence", "analysis", "reporting", "procedure"] {
        assert!(res["skills"][area].is_number(), "skill area {area} missing");
    }
    assert_eq!(res["score_settings"]["hints_available"], json!(1));

    // Replay is built from the saved logs
    let attempt_id = sub["state"]["attempt"]["id"].as_str().unwrap().to_string();
    let rp = ok(&mut e, "replay", json!({"case_id": "first-day", "attempt_id": attempt_id}));
    let kinds: Vec<&str> = rp["markers"].as_array().unwrap().iter().map(|m| m["kind"].as_str().unwrap()).collect();
    for k in ["start", "stage", "key", "trap", "hint", "submit"] {
        assert!(kinds.contains(&k), "replay is missing a {k} marker: {kinds:?}");
    }
    assert!(!rp["route"].as_array().unwrap().is_empty());
    ok(&mut e, "attempt.close", json!({}));
    let rp2 = ok(&mut e, "replay", json!({"case_id": "first-day", "attempt_id": attempt_id}));
    assert_eq!(rp["markers"].as_array().unwrap().len(), rp2["markers"].as_array().unwrap().len());

    // History feeds the dashboard and resets without touching saves
    let h = ok(&mut e, "history.get", json!({}));
    assert_eq!(h["attempts"].as_array().unwrap().len(), 1);
    ok(&mut e, "history.reset", json!({}));
    assert_eq!(ok(&mut e, "history.get", json!({}))["attempts"].as_array().unwrap().len(), 0);
    let lib = ok(&mut e, "library.list", json!({}));
    assert_eq!(lib["cases"][0]["attempts"].as_array().unwrap().len(), 1, "case saves must survive a history reset");
}

#[test]
fn stores_are_versioned_and_damage_safe() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    assert!(ok(&mut e, "store.get", json!({"name": "settings"}))["data"].is_null());
    ok(&mut e, "store.set", json!({"name": "settings", "data": {"theme": "dark"}}));
    assert_eq!(ok(&mut e, "store.get", json!({"name": "settings"}))["data"]["theme"], json!("dark"));
    std::fs::write(dir.path().join("settings.json"), b"{not json").unwrap();
    let r = ok(&mut e, "store.get", json!({"name": "settings"}));
    assert!(r["data"].is_null() && r["damaged"] == json!(true));
    assert!(dispatch(&mut e, "store.get", &json!({"name": "../profile"})).is_err());
    // A damaged settings file never touches the profile
    ok(&mut e, "profile.set", json!({"name": "Sergeant Nolan"}));
    std::fs::write(dir.path().join("academy.json"), b"garbage").unwrap();
    assert_eq!(ok(&mut e, "profile.get", json!({}))["profile"]["name"], json!("Sergeant Nolan"));
}
