//! Deliberately bad packs must be rejected cleanly, with nothing added to
//! the library. Each test starts from the real starter pack and breaks it.

use base64::Engine as _;
use invcore::{Engine, dispatch};
use serde_json::{Value, json};
use std::io::{Cursor, Read, Write};
use std::path::PathBuf;

fn good_pack() -> Vec<(String, Vec<u8>)> {
    let bytes = std::fs::read(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../packs/dist/the-ledger.invcase")).unwrap();
    let mut z = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
    let mut out = vec![];
    for i in 0..z.len() {
        let mut f = z.by_index(i).unwrap();
        let name = f.name().unwrap().to_string();
        let mut buf = vec![];
        f.read_to_end(&mut buf).unwrap();
        out.push((name, buf));
    }
    out
}

fn zip_of(files: &[(String, Vec<u8>)]) -> Vec<u8> {
    let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for (n, b) in files {
        w.start_file(n.as_str(), opts).unwrap();
        w.write_all(b).unwrap();
    }
    w.finish().unwrap().into_inner()
}

fn rehash(files: &mut Vec<(String, Vec<u8>)>) {
    use sha2::{Digest, Sha256};
    let mut map = serde_json::Map::new();
    for (n, b) in files.iter() {
        if n != "manifest.json" {
            map.insert(n.clone(), Value::String(hex::encode(Sha256::digest(b))));
        }
    }
    let idx = files.iter().position(|(n, _)| n == "manifest.json").unwrap();
    let mut m: Value = serde_json::from_slice(&files[idx].1).unwrap();
    m["files"] = Value::Object(map);
    files[idx].1 = serde_json::to_vec_pretty(&m).unwrap();
}

fn inspect(bytes: Vec<u8>) -> Result<Value, (String, Vec<String>)> {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    let r = dispatch(&mut e, "pack.inspect", &json!({"data_b64": base64::engine::general_purpose::STANDARD.encode(&bytes)}));
    let lib = dispatch(&mut e, "library.list", &json!({})).unwrap();
    assert!(lib["cases"].as_array().unwrap().is_empty(), "nothing is added during inspection");
    let tmp = dir.path().join("tmp");
    if r.is_err() && tmp.exists() {
        assert_eq!(std::fs::read_dir(&tmp).unwrap().count(), 0, "rejected packs leave nothing behind");
    }
    r.map_err(|e| (e.message, e.details))
}

fn expect_reject(bytes: Vec<u8>, needle: &str) {
    match inspect(bytes) {
        Ok(_) => panic!("pack should have been rejected ({needle})"),
        Err((_, details)) => assert!(details.iter().any(|d| d.to_lowercase().contains(&needle.to_lowercase())), "expected '{needle}' in {details:?}"),
    }
}

#[test]
fn good_pack_passes() {
    let files = good_pack();
    let r = inspect(zip_of(&files)).expect("the real pack is valid");
    assert_eq!(r["summary"]["items"], 45);
}

#[test]
fn rejects_path_traversal() {
    let mut files = good_pack();
    files.push(("../../escape.json".into(), b"{}".to_vec()));
    expect_reject(zip_of(&files), "unsafe path");
    let mut files = good_pack();
    files.push(("/abs/escape.json".into(), b"{}".to_vec()));
    expect_reject(zip_of(&files), "unsafe path");
}

#[test]
fn rejects_wrong_hash() {
    let mut files = good_pack();
    let i = files.iter().position(|(n, _)| n == "evidence/EV-002.md").unwrap();
    files[i].1.extend_from_slice(b"\nTampered line.\n");
    expect_reject(zip_of(&files), "does not match its manifest hash");
}

#[test]
fn rejects_missing_file() {
    let mut files = good_pack();
    files.retain(|(n, _)| n != "evidence/EV-010.csv");
    expect_reject(zip_of(&files), "missing");
}

#[test]
fn rejects_oversized_file() {
    let mut files = good_pack();
    files.push(("evidence/huge.csv".into(), vec![b'a'; 11 * 1024 * 1024]));
    expect_reject(zip_of(&files), "per-file limit");
}

#[test]
fn rejects_executable_and_scripted_svg() {
    let mut files = good_pack();
    files.push(("assets/run.exe".into(), b"MZ".to_vec()));
    expect_reject(zip_of(&files), "not allowed");
    let mut files = good_pack();
    files.push(("assets/x.svg".into(), b"<svg><script>alert(1)</script></svg>".to_vec()));
    rehash(&mut files);
    expect_reject(zip_of(&files), "scripting");
}

#[test]
fn rejects_broken_schema() {
    let mut files = good_pack();
    let i = files.iter().position(|(n, _)| n == "intake.json").unwrap();
    let mut v: Value = serde_json::from_slice(&files[i].1).unwrap();
    v.as_object_mut().unwrap().remove("tasking");
    v["clock_start"] = json!("not a date");
    files[i].1 = serde_json::to_vec(&v).unwrap();
    rehash(&mut files);
    expect_reject(zip_of(&files), "intake.json");
}

#[test]
fn rejects_broken_cross_reference() {
    let mut files = good_pack();
    let i = files.iter().position(|(n, _)| n == "solution.json").unwrap();
    let mut v: Value = serde_json::from_slice(&files[i].1).unwrap();
    v["findings"][0]["evidence_any"] = json!(["EV-999"]);
    files[i].1 = serde_json::to_vec(&v).unwrap();
    rehash(&mut files);
    expect_reject(zip_of(&files), "EV-999");
}

#[test]
fn refuses_newer_schema_version() {
    let mut files = good_pack();
    let i = files.iter().position(|(n, _)| n == "manifest.json").unwrap();
    let mut v: Value = serde_json::from_slice(&files[i].1).unwrap();
    v["schema_version"] = json!("2.0");
    files[i].1 = serde_json::to_vec(&v).unwrap();
    match inspect(zip_of(&files)) {
        Err((_, d)) => assert!(d[0].contains("newer"), "{d:?}"),
        Ok(_) => panic!("should refuse"),
    }
}

#[test]
fn rejects_non_zip() {
    expect_reject(b"this is not a zip".to_vec(), "not a case pack");
}

#[test]
fn changed_on_disk_after_import_is_refused() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    let b64 = base64::engine::general_purpose::STANDARD.encode(zip_of(&good_pack()));
    let r = dispatch(&mut e, "pack.inspect", &json!({"data_b64": b64})).unwrap();
    dispatch(&mut e, "pack.install", &json!({"token": r["token"]})).unwrap();
    std::fs::write(dir.path().join("cases/the-ledger/evidence/EV-001.md"), "edited").unwrap();
    assert!(dispatch(&mut e, "attempt.new", &json!({"case_id": "the-ledger", "mode": "training"})).is_err());
}

#[test]
fn hashing_matches_known_values() {
    assert_eq!(invcore::util::sha256_hex(b""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    assert_eq!(invcore::util::sha256_hex(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
}

#[test]
fn old_saves_are_migrated() {
    let v = json!({"save_version": 1, "id": "A1", "notes_by_item": {"EV-001": "x"}, "findings": [{}, {}]});
    let m = invcore::attempt::migrate(v).unwrap();
    assert_eq!(m["save_version"], invcore::attempt::SAVE_VERSION);
    assert_eq!(m["item_notes"]["EV-001"], "x");
    assert!(m["counter"].as_u64().unwrap() >= 102);
    assert!(invcore::attempt::migrate(json!({"save_version": 99})).is_err());
}

#[test]
fn profile_damage_shows_welcome_again() {
    let dir = tempfile::tempdir().unwrap();
    let mut e = Engine::new(dir.path());
    dispatch(&mut e, "profile.set", &json!({"name": "Officer Smith"})).unwrap();
    assert!(e.profile().is_some());
    std::fs::write(dir.path().join("profile.json"), "{ broken").unwrap();
    assert!(e.profile().is_none());
    assert!(dispatch(&mut e, "profile.set", &json!({"name": "Someone Else"})).is_err(), "only the three presets");
}

#[test]
fn pdf_export_is_well_formed() {
    let pdf = invcore::pdf::from_markdown("# Title\n\n## Section\n\nSome text with £ and (brackets).\n\n- item\n\n| a | b |\n|---|---|\n| 1 | 2 |\n", "Test");
    let s = String::from_utf8_lossy(&pdf);
    assert!(s.starts_with("%PDF-1.4") && s.trim_end().ends_with("%%EOF"));
    assert!(s.contains("/Count 1"));
}
