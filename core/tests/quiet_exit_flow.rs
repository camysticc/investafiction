//! Plays Quiet Exit end to end: the hash mismatch, USB and cloud routes,
//! clock offsets, a witness phone authority and two-person attribution.

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
fn label(st: &Value, id: &str) -> String {
    st["case"]["entities"].as_array().unwrap().iter().find(|x| x["id"] == id).unwrap()["label"].as_str().unwrap().to_string()
}
fn open_stage(st: &Value, id: &str) -> bool {
    st["case"]["stages"].as_array().unwrap().iter().any(|s| s["id"] == id && s["open"] == true)
}
fn undone(st: &Value) -> Vec<String> {
    st["case"]["stages"].as_array().unwrap().iter().flat_map(|s| s["objectives"].as_array().cloned().unwrap_or_default()).filter(|o| o["required"] == true && o["done"] == false).map(|o| o["id"].as_str().unwrap().to_string()).collect()
}
fn f(e: &mut Engine, kind: &str, s: &str, ev: &[&str]) {
    let r = act(e, json!({"type": "add_finding", "kind": kind, "statement": s, "evidence": ev}));
    assert!(r["warning"].is_null());
}
fn receive_all(e: &mut Engine) {
    act(e, json!({"type": "log_receipt", "all": true}));
    act(e, json!({"type": "hash_check", "all": true}));
}

#[test]
fn quiet_exit_full_playthrough() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    ok(&mut e, "profile.set", json!({"name": "Sergeant Nolan"}));
    let bytes = std::fs::read(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packs/dist/quiet-exit.invcase")).unwrap();
    let r = ok(&mut e, "pack.inspect", json!({"data_b64": base64::engine::general_purpose::STANDARD.encode(bytes)}));
    ok(&mut e, "pack.install", json!({"token": r["token"]}));
    ok(&mut e, "attempt.new", json!({"case_id": "quiet-exit", "mode": "training"}));
    let st = act(&mut e, json!({"type": "ack_scope"}))["state"].clone();
    let sur = |s: String| s.split_whitespace().last().unwrap().to_string();
    let (p1, p2) = (sur(label(&st, "ENT-P1")), sur(label(&st, "ENT-P2")));
    let w4 = "ENT-W4";

    // Stage 1: integrity
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    let r = act(&mut e, json!({"type": "hash_check", "all": true}));
    let bad: Vec<String> = r["result"].as_array().unwrap().iter().filter(|x| x["matches_original"] == false).map(|x| x["id"].as_str().unwrap().to_string()).collect();
    assert_eq!(bad, vec!["EV-008".to_string()], "exactly one deliberately altered item");
    let w = ok(&mut e, "act", json!({"type": "add_finding", "kind": "fact", "statement": "The hash mismatch proves EV-008 was deliberately altered to cover tracks.", "evidence": ["EV-008"]}));
    assert!(w["warning"].is_string(), "treating a mismatch as proof is a trap");
    act(&mut e, json!({"type": "report_integrity", "id": "EV-008", "note": "SHA-256 does not match the acquisition record. Not relied on; re-acquisition requested."}));
    f(&mut e, "fact", "EV-008 does not match its acquisition hash. It has been reported and not relied on.", &["EV-008", "EV-003"]);
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S2"), "{:?}", undone(&st));

    // Stage 2: files and devices
    receive_all(&mut e);
    for id in ["EV-014", "EV-015", "EV-016", "EV-017", "EV-018", "EV-020"] {
        ok(&mut e, "evidence.open", json!({"id": id}));
    }
    f(&mut e, "fact", "On 19 Feb the KITTIWAKE files were copied to USB drive E: from WS-ENG-07.", &["EV-014", "EV-018"]);
    f(&mut e, "fact", "The USB drive serial number is KS-7731-0042.", &["EV-017", "EV-014"]);
    f(&mut e, "fact", "The same drive KS-7731-0042 was connected to the laptop LT-ENG-07 on 20 February.", &["EV-018", "EV-017"]);
    f(&mut e, "fact", "The KW_copy folder was deleted from the laptop on 26 Feb.", &["EV-016"]);
    f(&mut e, "fact", "The recovered deleted entries match the KITTIWAKE register.", &["EV-016", "EV-007"]);
    f(&mut e, "fact", "The 12 February modified timestamp change came from the CHG-0412 patch.", &["EV-020", "EV-014"]);
    f(&mut e, "fact", "A test copy of three files was made on 28 Jan to KW_test.", &["EV-017", "EV-014"]);
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S3"), "{:?}", undone(&st));

    // Stage 3
    receive_all(&mut e);
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-CLOUD", "target": "ENT-SVC", "date_from": "2026-02-24", "date_to": "2026-02-26", "justification": "A share link to the KITTIWAKE folder was created and opened externally; we need who accessed it and from which IP."}));
    assert_eq!(r["result"]["granted"], true, "{}", r["result"]);
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-BACKUP", "target": "ENT-WS07", "date_from": "2026-01-26", "date_to": "2026-01-31", "justification": "The USB test connection on 28 January predates the server log, which has rolled over. Restore access logs for that week."}));
    assert_eq!(r["result"]["granted"], true, "{}", r["result"]);
    receive_all(&mut e);
    ok(&mut e, "osint.open", json!({"page": "PG-002"}));
    let cap = act(&mut e, json!({"type": "capture", "page": "PG-002", "method": "full"}))["result"]["id"].as_str().unwrap().to_string();
    f(&mut e, "fact", "A share link was created on 24 Feb by svc-cadsync from WS-ENG-04.", &["EV-026", "EV-025"]);
    f(&mut e, "fact", "The link was opened from 203.0.113.88, registered to Harrowgate, and the files downloaded.", &["EV-037", &cap]);
    f(&mut e, "fact", "svc-cadsync shared the leaver's password, which was also known to the other engineer.", &["EV-027", "EV-028"]);
    f(&mut e, "inference", "Use of the svc-cadsync account does not prove who used it.", &["EV-027", "EV-028"]);
    f(&mut e, "fact", "The leaver emailed a spec summary to a personal address at example.net.", &["EV-029", "EV-004"]);
    f(&mut e, "fact", "The other engineer emailed the Harrowgate recruiter with a CV.", &["EV-030", "EV-015"]);
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S4"), "{:?}", undone(&st));

    // Stage 4
    receive_all(&mut e);
    // Clock trap: uncorrected lobby time warns
    let w = ok(&mut e, "act", json!({"type": "add_event", "time": "2026-02-19 19:12", "description": "Leaves (lobby camera)", "evidence": ["EV-042"]}));
    assert!(w["warning"].is_string());
    act(&mut e, json!({"type": "add_event", "time": "2026-02-19 19:05", "description": "Leaves (lobby camera, corrected by 7 minutes)", "evidence": ["EV-042"], "clock_note": "Corrected -7 min"}));
    f(&mut e, "fact", &format!("{p1} was on site on 19 Feb from 18:30 to 19:05 by door badge."), &["EV-039", "EV-040"]);
    f(&mut e, "fact", &format!("On 24 Feb {p2} was on site by door badge from 20:58 to 21:38 and the leaver was not."), &["EV-039", "EV-040"]);
    f(&mut e, "fact", "The lobby camera runs 7 minutes fast; corrected times match door access.", &["EV-042"]);
    f(&mut e, "inference", &format!("The guard probably mistook {p2} for the leaver."), &["EV-046", "EV-039"]);
    f(&mut e, "fact", "On 24 Feb the car entered at 20:55 and left at 21:45 on ANPR.", &["EV-040", "EV-041"]);
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S5"), "{:?}", undone(&st));

    // Stage 5
    receive_all(&mut e);
    let w = ok(&mut e, "evidence.open", json!({"id": "EV-013"}));
    assert!(w["warning"].is_string(), "personal phone needs authority");
    f(&mut e, "fact", "At 21:19 the company phone sent 'Link's live' to the recruiter.", &["EV-052", "EV-050"]);
    let st = ok(&mut e, "state", json!({}));
    let rec_num = st["case"]["entities"].as_array().unwrap().iter().find(|x| x["id"] == "ENT-REC").unwrap()["identifiers"][0].as_str().unwrap().to_string();
    f(&mut e, "fact", &format!("Both phones called the recruiter {rec_num}."), &["EV-049", "EV-050"]);
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-WPHONE", "target": w4, "justification": "The witness says they saw the engineer in the CAD room on the evening of 24 Feb and sent a message; it would corroborate presence."}));
    assert_eq!(r["result"]["granted"], true, "{}", r["result"]);
    receive_all(&mut e);
    f(&mut e, "fact", &format!("A 21:07 message puts {p2} in the CAD room."), &["EV-054", "EV-055"]);
    f(&mut e, "inference", "The data left by two routes, USB and cloud, linked to two people.", &["EV-017", "EV-026"]);
    act(&mut e, json!({"type": "add_link", "from": "ENT-P2", "to": "ENT-REC", "kind": "messages and calls", "evidence": ["EV-052", "EV-050"]}));
    let st = ok(&mut e, "state", json!({}));
    assert!(open_stage(&st, "S6"), "{:?}", undone(&st));

    // Stage 6
    let w = ok(&mut e, "act", json!({"type": "add_finding", "kind": "fact", "statement": format!("{p1} definitely made the USB copy."), "evidence": ["EV-014"]}));
    assert!(w["warning"].is_string(), "overclaiming warns");
    f(&mut e, "inference", &format!("{p1} most likely made the USB copy."), &["EV-014", "EV-017", "EV-039"]);
    f(&mut e, "inference", &format!("{p2} most likely created the share link in the cloud."), &["EV-039", "EV-052"]);
    for id in ["EV-014", "EV-017", "EV-018", "EV-016", "EV-025", "EV-026", "EV-027", "EV-037", "EV-039", "EV-040", "EV-050", "EV-052"] {
        act(&mut e, json!({"type": "grade", "target": id, "source": "A", "info": "1"}));
    }
    act(&mut e, json!({"type": "report", "summary": "The KITTIWAKE files left by two routes: a USB copy on 19 February, most likely by the leaver, and a cloud share on 24 February, most likely by the other engineer, opened from the competitor's address.",
        "scope_method": "Company devices, logs and phones, two narrow data requests and one witness phone with authority. All items hashed; one failed and was reported.",
        "gaps": "Server logs before 1 February rolled over and were only partly restored from backup. The USB drive is missing and its whereabouts unknown. Who at the competitor opened the link cannot be shown from an IP address. Nobody saw who typed at WS-ENG-04; the share link creation is not proved.",
        "recommendations": "Find the USB drive, interview both engineers, ask the competitor to preserve and return the data.",
        "legality": "Company consent for company devices, specific authority for the witness phone.", "necessity": "Each step tested a line of enquiry about how the files left.", "proportionality": "Bulk mail, the personal phone image and privileged material were left unexamined."}));
    act(&mut e, json!({"type": "sign"}));
    let res = ok(&mut e, "submit", json!({"confirm": true}))["result"].clone();
    let found = res["findings"].as_array().unwrap().iter().filter(|x| x["found"] == true && x["required"] == true).count();
    println!("total {} {} found {found}", res["total"], res["band"]);
    assert_eq!(found, 24, "{}", serde_json::to_string_pretty(&res["findings"]).unwrap());
    assert!(res["total"].as_f64().unwrap() >= 70.0);
}
