//! Plays The Ledger from import to debrief through the same API the
//! interface uses, and checks stages, requests, traps and scoring.

use base64::Engine as _;
use invcore::{Engine, dispatch};
use serde_json::{Value, json};
use std::path::PathBuf;

fn pack(name: &str) -> Vec<u8> {
    let p = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packs/dist").join(name);
    std::fs::read(&p).unwrap_or_else(|_| panic!("build the packs first: {}", p.display()))
}

fn ok(e: &mut Engine, cmd: &str, args: Value) -> Value {
    match dispatch(e, cmd, &args) {
        Ok(v) => v,
        Err(err) => panic!("{cmd} failed: {} {:?}", err.message, err.details),
    }
}

fn act(e: &mut Engine, args: Value) -> Value {
    let mut a = args.clone();
    a["confirm"] = json!(true);
    let r = ok(e, "act", a);
    assert!(r["warning"].is_null(), "unexpected warning: {}", r["warning"]);
    r
}

fn install(e: &mut Engine, file: &str) -> String {
    let b64 = base64::engine::general_purpose::STANDARD.encode(pack(file));
    let r = ok(e, "pack.inspect", json!({"data_b64": b64}));
    let token = r["token"].as_str().unwrap().to_string();
    ok(e, "pack.install", json!({"token": token}));
    r["summary"]["id"].as_str().unwrap().to_string()
}

fn ent(state: &Value, id: &str) -> String {
    state["case"]["entities"].as_array().unwrap().iter().find(|x| x["id"] == id).unwrap()["label"].as_str().unwrap().to_string()
}

fn surname(full: &str) -> String {
    full.split_whitespace().last().unwrap().to_string()
}

fn done(state: &Value, ob: &str) -> bool {
    state["case"]["stages"].as_array().unwrap().iter().flat_map(|s| s["objectives"].as_array().cloned().unwrap_or_default()).any(|o| o["id"] == ob && o["done"] == true)
}

fn stage_open(state: &Value, id: &str) -> bool {
    state["case"]["stages"].as_array().unwrap().iter().any(|s| s["id"] == id && s["open"] == true)
}

#[test]
fn ledger_full_playthrough() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    assert!(ok(&mut e, "profile.get", json!({}))["profile"].is_null());
    ok(&mut e, "profile.set", json!({"name": "Detective Jones"}));
    let id = install(&mut e, "the-ledger.invcase");
    assert_eq!(id, "the-ledger");
    ok(&mut e, "attempt.new", json!({"case_id": id, "mode": "training"}));
    let st = ok(&mut e, "state", json!({}));
    assert!(st["case"]["evidence"].as_array().unwrap().is_empty(), "nothing released before the scope is acknowledged");

    let st = act(&mut e, json!({"type": "ack_scope"}))["state"].clone();
    assert!(stage_open(&st, "S1"));
    let p1 = ent(&st, "ENT-P1");
    let p2 = ent(&st, "ENT-P2");

    // Training mode warns before examining an item whose receipt is not logged.
    let w = ok(&mut e, "evidence.open", json!({"id": "EV-003"}));
    assert!(w["warning"].is_string());
    // Out-of-scope personal statement warns too.
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    let w = ok(&mut e, "evidence.open", json!({"id": "EV-008"}));
    assert!(w["warning"].as_str().unwrap().contains("scope"));

    let r = act(&mut e, json!({"type": "hash_check", "all": true}));
    assert!(r["notices"][0].as_str().unwrap().contains("All match"));
    for id in ["EV-001", "EV-002", "EV-003", "EV-004", "EV-005", "EV-006", "EV-007"] {
        let r = ok(&mut e, "evidence.open", json!({"id": id}));
        assert!(r["content"]["text"].is_string());
    }
    // Opening an original needs a reason
    assert!(dispatch(&mut e, "evidence.open", &json!({"id": "EV-002", "as": "original"})).is_err());
    ok(&mut e, "evidence.open", json!({"id": "EV-002", "as": "original", "reason": "Checking the printed policy version number matches the copy"}));

    // A fact needs evidence
    assert!(dispatch(&mut e, "act", &json!({"type": "add_finding", "statement": "Something happened here", "kind": "fact", "evidence": []})).is_err());
    let r = act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "Every payment to the receiving business is just under the £5,000 approval limit.", "evidence": ["EV-003", "EV-002"]}));
    let st = r["state"].clone();
    assert!(done(&st, "OB-1-3"));
    for (t, g) in [("EV-003", "A1"), ("EV-002", "A1"), ("EV-007", "B3"), ("EV-001", "B3"), ("EV-006", "B2"), ("EV-004", "A1")] {
        act(&mut e, json!({"type": "grade", "target": t, "source": &g[0..1], "info": &g[1..2]}));
    }
    let st = ok(&mut e, "state", json!({}));
    assert!(stage_open(&st, "S2"), "stage 2 opens once stage 1 required objectives are done");

    // Stage 2
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    act(&mut e, json!({"type": "hash_check", "all": true}));
    for id in ["EV-012", "EV-013", "EV-014", "EV-015", "EV-016", "EV-017"] {
        ok(&mut e, "evidence.open", json!({"id": id}));
    }
    let res = ok(&mut e, "osint.search", json!({"query": "northgate packaging supplies"}));
    assert!(res.as_array().unwrap().iter().any(|p| p["page"] == "PG-002"));
    ok(&mut e, "osint.open", json!({"page": "PG-002"}));
    let cap = act(&mut e, json!({"type": "capture", "page": "PG-002", "method": "full"}));
    let cap_id = cap["result"]["id"].as_str().unwrap().to_string();
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "Northgate Packaging Supplies is a different business from the genuine supplier, with a similar name and its own account.", "evidence": ["EV-006", "EV-013", cap_id]}));
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "There were 16 payments to the receiving business.", "evidence": ["EV-003", "EV-012"]}));
    // Timezone trap: uncorrected Pacific time warns in training
    let w = ok(&mut e, "act", json!({"type": "add_event", "time": "2025-07-07 23:40", "description": "First approval", "evidence": ["EV-012"]}));
    assert!(w["warning"].is_string());
    for (t, d, ev) in [
        ("2025-07-07 15:52", "Supplier record created", "EV-014"),
        ("2025-07-08 06:40", "First approval (Pacific time corrected to UTC)", "EV-012"),
        ("2025-07-08 00:00", "First payment", "EV-003"),
        ("2025-08-14 12:00", "Approval while finance manager on leave", "EV-012"),
        ("2026-02-20 00:00", "Last payment", "EV-005"),
    ] {
        act(&mut e, json!({"type": "add_event", "time": t, "description": d, "evidence": [ev]}));
    }
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "The approvals export is in Pacific time (UTC-7), so the first approval was on 8 July UTC.", "evidence": ["EV-012"]}));
    let st = ok(&mut e, "state", json!({}));
    assert!(done(&st, "OB-2-4"));
    assert!(stage_open(&st, "S3"));

    // Stage 3
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    for id in ["EV-021", "EV-022", "EV-026", "EV-028", "EV-030"] {
        ok(&mut e, "evidence.open", json!({"id": id}));
    }
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "The invoices share the same author and were created on workstation WS-AP-03.", "evidence": ["EV-021", "EV-030"]}));
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "The introduction email's Reply-To address does not match the sender.", "evidence": ["EV-026", "EV-028"]}));
    // Over-broad request is refused and penalised
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-BANK", "target": "ALL", "date_from": "2025-01-01", "date_to": "2026-03-01", "justification": "We want to see every account in case anything is suspicious."}));
    assert_eq!(r["result"]["granted"], false);
    // Weak justification refused, no penalty
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-BANK", "target": "ENT-ACC2", "date_from": "2025-07-01", "date_to": "2026-02-28", "justification": "Please send the account information thanks."}));
    assert_eq!(r["result"]["granted"], false);
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-BANK", "target": "ENT-ACC2", "date_from": "2025-07-01", "date_to": "2026-02-28", "justification": "Sixteen payments went to this account just under the approval limit for invoices with no goods received. We need the holder and opening date."}));
    assert_eq!(r["result"]["granted"], true, "{}", r["result"]);
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    ok(&mut e, "evidence.open", json!({"id": "EV-033"}));
    ok(&mut e, "evidence.open", json!({"id": "EV-034"}));
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "The receiving account was opened on 3 July 2025, five days before the first payment.", "evidence": ["EV-033", "EV-003"]}));
    let st = ok(&mut e, "state", json!({}));
    assert!(stage_open(&st, "S4"));

    // Stage 4
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    for id in ["EV-035", "EV-036", "EV-037", "EV-038", "EV-039", "EV-040", "EV-041", "EV-043"] {
        ok(&mut e, "evidence.open", json!({"id": id}));
    }
    let sugg = ok(&mut e, "links.suggest", json!({}));
    assert!(sugg.as_array().unwrap().iter().any(|s| s["from"] == "ENT-ACC1" && s["to"] == "ENT-ACC2"), "{sugg}");
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "Six approvals were made while the finance manager was on leave.", "evidence": ["EV-012", "EV-035"]}));
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "All approvals to the receiving business came from workstation WS-AP-03.", "evidence": ["EV-036", "EV-030"]}));
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "The contact mobile on the bank application is the same as the AP supervisor's personal number.", "evidence": ["EV-033", "EV-037"]}));
    act(&mut e, json!({"type": "add_link", "from": "ENT-ACC2", "to": "ENT-P1", "kind": "contact detail", "evidence": ["EV-033", "EV-037"]}));
    act(&mut e, json!({"type": "add_link", "from": "ENT-ACC1", "to": "ENT-ACC2", "kind": "payments", "evidence": ["EV-003"]}));
    let r = act(&mut e, json!({"type": "request", "request_type": "RT-CDR", "target": "ENT-PH2", "date_from": "2025-07-01", "date_to": "2025-07-04", "justification": "This mobile number is the contact on the bank account opening application. Calls to the bank would corroborate who opened it."}));
    assert_eq!(r["result"]["granted"], true, "{}", r["result"]);
    act(&mut e, json!({"type": "log_receipt", "all": true}));
    ok(&mut e, "evidence.open", json!({"id": "EV-044"}));
    act(&mut e, json!({"type": "add_finding", "kind": "fact", "statement": "The application number called the bank business line on 1 to 3 July.", "evidence": ["EV-044", "EV-033"]}));
    let st = ok(&mut e, "state", json!({}));
    assert!(stage_open(&st, "S5"), "stage 5 should open");

    // Overclaim trap warns
    let w = ok(&mut e, "act", json!({"type": "add_finding", "kind": "fact", "statement": format!("{} set up the scheme.", surname(&p2)), "evidence": ["EV-012"]}));
    assert!(w["warning"].is_string());
    act(&mut e, json!({"type": "add_finding", "kind": "inference", "statement": "The finance manager's login was probably used by someone else, so the login does not prove who approved.", "evidence": ["EV-035", "EV-036"]}));
    act(&mut e, json!({"type": "add_finding", "kind": "inference", "statement": format!("{} is most likely responsible for the main scheme.", surname(&p1)), "evidence": ["EV-033", "EV-037", "EV-030"]}));
    act(&mut e, json!({"type": "report", "summary": "Sixteen payments totalling nearly eighty thousand pounds went to a business that does not exist as a real supplier. The account was set up days before the first payment, the invoices were made inside the company on WS-AP-03, and the bank contact number belongs to the accounts payable supervisor. The finance manager's login was used, but some approvals happened during leave.",
        "scope_method": "I examined the company bank statements, finance system exports, invoices, emails, rota, login logs and contact list. I made two narrow requests: to the bank for the receiving account and to the network for one number over four days. I worked on copies, logged receipt and hashed all items.",
        "gaps": "I cannot say who was physically at WS-AP-03 when the approvals were made; there is no CCTV. The cash withdrawals cannot be traced further and remain unknown. The identity document used to open the account has not been examined and is unverified.",
        "recommendations": "Secure WS-AP-03 for forensic examination, obtain the identity document from the bank, interview staff in a planned order, and switch off fast user switching on finance PCs with a second factor for approvals."}));
    act(&mut e, json!({"type": "report", "legality": "The examination used material supplied with the company's consent under the tasking.", "necessity": "Each request was needed to test a specific line of enquiry that came from the records.", "proportionality": "Requests were limited to one account and one number for short periods, and no personal data outside scope was used."}));
    act(&mut e, json!({"type": "sign"}));
    let st = ok(&mut e, "state", json!({}));
    assert!(done(&st, "OB-5-4"));

    // Export works
    let ex = ok(&mut e, "export", json!({"kind": "report_pdf"}));
    let pdf = base64::engine::general_purpose::STANDARD.decode(ex["data_b64"].as_str().unwrap()).unwrap();
    assert!(pdf.starts_with(b"%PDF-1.4"));
    let md = ok(&mut e, "report.preview", json!({}))["markdown"].as_str().unwrap().to_string();
    assert!(md.contains("Detective Jones"), "sign-off shows the chosen name");

    let w = ok(&mut e, "submit", json!({}));
    assert!(w["warning"].is_string());
    let res = ok(&mut e, "submit", json!({"confirm": true}))["result"].clone();
    let total = res["total"].as_f64().unwrap();
    println!("total {total} band {} cats {}", res["band"], res["categories"]);
    let found = res["findings"].as_array().unwrap().iter().filter(|f| f["found"] == true && f["required"] == true).count();
    assert_eq!(found, 12, "{}", serde_json::to_string_pretty(&res["findings"]).unwrap());
    assert!(total >= 70.0, "a careful playthrough should score at least Merit, got {total}");
    let traps: Vec<String> = res["procedural_events"].as_array().unwrap().iter().map(|t| t["title"].as_str().unwrap().to_string()).collect();
    assert!(traps.iter().any(|t| t == "Collecting too much"), "{traps:?}");

    // Save and resume restores the attempt exactly
    let attempt_id = st["attempt"]["id"].as_str().unwrap().to_string();
    ok(&mut e, "attempt.close", json!({}));
    let mut e2 = Engine::new(dir.path());
    let st2 = ok(&mut e2, "attempt.open", json!({"case_id": "the-ledger", "attempt_id": attempt_id}));
    assert_eq!(st2["attempt"]["submitted"], true);
    assert_eq!(st2["attempt"]["findings"].as_array().unwrap().len(), st["attempt"]["findings"].as_array().unwrap().len());
}

#[test]
fn assessment_mode_records_traps_without_warning() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    ok(&mut e, "profile.set", json!({"name": "Sergeant Nolan"}));
    install(&mut e, "the-ledger.invcase");
    ok(&mut e, "attempt.new", json!({"case_id": "the-ledger", "mode": "assessment"}));
    ok(&mut e, "act", json!({"type": "ack_scope"}));
    // No warning: examined without receipt, and out of scope
    let r = ok(&mut e, "evidence.open", json!({"id": "EV-008"}));
    assert!(r["warning"].is_null());
    let r = ok(&mut e, "act", json!({"type": "alter_original", "id": "EV-003", "op": "rename"}));
    assert!(r["warning"].is_null());
    // Traps are hidden from the interface until submission
    assert!(r["state"]["attempt"]["traps"].as_array().unwrap().is_empty());
    assert!(dispatch(&mut e, "act", &json!({"type": "hint", "objective": "OB-1-1"})).is_err(), "no hints in assessment mode");
    let sess = e.session.as_ref().unwrap();
    let titles: Vec<&str> = sess.attempt.traps.iter().map(|t| t.title.as_str()).collect();
    assert!(titles.contains(&"Working outside scope"));
    assert!(titles.contains(&"Broken continuity"));
    assert!(titles.contains(&"Altering original evidence"));
}
