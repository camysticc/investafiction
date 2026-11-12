//! Small local files kept apart from the case saves: saved settings, Academy
//! progress, help centre data and the attempt history behind the skills
//! dashboard. Each has a version number. A damaged file reads as empty and
//! never touches anything else.

use crate::util::{now_iso, read_json, write_json};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

pub const STORES: &[&str] = &["settings", "academy", "help"];
pub const STORE_VERSION: u64 = 1;

fn store_path(dir: &Path, name: &str) -> PathBuf {
    dir.join(format!("{name}.json"))
}

/// Read a store. Returns {data, damaged}. Missing files give data null.
pub fn store_get(dir: &Path, name: &str) -> Result<Value, String> {
    if !STORES.contains(&name) {
        return Err("Unknown store.".into());
    }
    let p = store_path(dir, name);
    if !p.exists() {
        return Ok(json!({"data": null, "damaged": false}));
    }
    match read_json::<Value>(&p) {
        Ok(v) if v.get("version").and_then(|x| x.as_u64()).is_some() && v.get("data").is_some() => {
            let ver = v["version"].as_u64().unwrap();
            if ver > STORE_VERSION {
                Ok(json!({"data": null, "damaged": true, "reason": "made by a newer version"}))
            } else {
                Ok(json!({"data": v["data"], "damaged": false}))
            }
        }
        _ => Ok(json!({"data": null, "damaged": true})),
    }
}

pub fn store_set(dir: &Path, name: &str, data: &Value) -> Result<Value, String> {
    if !STORES.contains(&name) {
        return Err("Unknown store.".into());
    }
    let text = serde_json::to_string(data).map_err(|e| e.to_string())?;
    if text.len() > 2_000_000 {
        return Err("That is too much data to store.".into());
    }
    write_json(&store_path(dir, name), &json!({"version": STORE_VERSION, "saved": now_iso(), "data": data})).map_err(|e| e.to_string())?;
    Ok(json!({"saved": true}))
}

// ------------------------------------------------------------------ history

fn history_path(dir: &Path) -> PathBuf {
    dir.join("history.json")
}

pub fn history(dir: &Path) -> Vec<Value> {
    read_json::<Value>(&history_path(dir))
        .ok()
        .and_then(|v| v.get("attempts").and_then(|a| a.as_array()).cloned())
        .unwrap_or_default()
}

pub fn history_add(dir: &Path, record: Value) -> std::io::Result<()> {
    let mut all = history(dir);
    let id = record.get("attempt_id").cloned();
    all.retain(|r| r.get("attempt_id") != id.as_ref());
    all.push(record);
    write_json(&history_path(dir), &json!({"version": 1, "attempts": all}))
}

pub fn history_reset(dir: &Path) -> std::io::Result<()> {
    write_json(&history_path(dir), &json!({"version": 1, "attempts": []}))
}

// ------------------------------------------------------------------ data management

fn dir_size(p: &Path) -> u64 {
    let mut n = 0;
    if let Ok(rd) = std::fs::read_dir(p) {
        for e in rd.flatten() {
            let path = e.path();
            if path.is_dir() {
                n += dir_size(&path);
            } else if let Ok(m) = e.metadata() {
                n += m.len();
            }
        }
    }
    n
}

fn file_size(p: &Path) -> u64 {
    std::fs::metadata(p).map(|m| m.len()).unwrap_or(0)
}

pub fn usage(dir: &Path) -> Value {
    let stores: u64 = STORES.iter().map(|s| file_size(&dir.join(format!("{s}.json")))).sum::<u64>() + file_size(&dir.join("profile.json")) + file_size(&history_path(dir));
    json!({
        "data_dir": dir.display().to_string(),
        "cases": dir_size(&dir.join("cases")),
        "saves": dir_size(&dir.join("saves")),
        "settings_and_progress": stores,
        "caches": dir_size(&dir.join("tmp")) + dir_size(&dir.join("exports")),
    })
}

/// Settings the core itself needs: read straight from the settings store, with safe defaults.
pub fn setting_u64(dir: &Path, id: &str, default: u64) -> u64 {
    store_get(dir, "settings").ok().and_then(|v| v["data"].get(id).and_then(|x| x.as_u64())).unwrap_or(default)
}

/// Keep rotating backups of a save before it is overwritten.
pub fn backup_save(path: &Path, keep: u64) {
    if keep == 0 || !path.exists() {
        return;
    }
    let Some(dir) = path.parent().map(|p| p.join("backups")) else { return };
    let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else { return };
    if std::fs::create_dir_all(&dir).is_err() {
        return;
    }
    // Only take a new backup every few minutes, so autosaves do not churn the copies.
    let newest = dir.join(format!("{stem}.1.json"));
    if let Ok(m) = std::fs::metadata(&newest).and_then(|m| m.modified()) {
        if m.elapsed().map(|e| e.as_secs() < 300).unwrap_or(false) {
            return;
        }
    }
    for i in (1..keep).rev() {
        let from = dir.join(format!("{stem}.{i}.json"));
        if from.exists() {
            let _ = std::fs::rename(&from, dir.join(format!("{stem}.{}.json", i + 1)));
        }
    }
    let _ = std::fs::remove_file(dir.join(format!("{stem}.{}.json", keep + 1)));
    let _ = std::fs::copy(path, &newest);
}

/// One file with every save, the settings, Academy progress, help data and history.
pub fn export_bundle(dir: &Path) -> Value {
    let mut saves = serde_json::Map::new();
    if let Ok(rd) = std::fs::read_dir(dir.join("saves")) {
        for case in rd.flatten().filter(|e| e.path().is_dir()) {
            let mut m = serde_json::Map::new();
            if let Ok(files) = std::fs::read_dir(case.path()) {
                for f in files.flatten() {
                    let p = f.path();
                    if p.extension().and_then(|x| x.to_str()) == Some("json") {
                        if let Ok(v) = read_json::<Value>(&p) {
                            m.insert(p.file_stem().unwrap().to_string_lossy().to_string(), v);
                        }
                    }
                }
            }
            saves.insert(case.file_name().to_string_lossy().to_string(), Value::Object(m));
        }
    }
    let mut stores = serde_json::Map::new();
    for s in STORES {
        if let Ok(v) = store_get(dir, s) {
            stores.insert(s.to_string(), v["data"].clone());
        }
    }
    json!({"app": "Investafiction", "kind": "saves", "version": 1, "exported": now_iso(), "saves": saves, "stores": stores, "history": history(dir)})
}

pub fn import_bundle(dir: &Path, bundle: &Value) -> Result<Value, String> {
    if bundle.get("kind").and_then(|k| k.as_str()) != Some("saves") {
        return Err("That file is not an Investafiction saves export.".into());
    }
    let mut added = 0;
    let mut skipped = 0;
    let mut bad = 0;
    if let Some(saves) = bundle.get("saves").and_then(|s| s.as_object()) {
        for (case, attempts) in saves {
            if !crate::util::safe_id(case) {
                bad += 1;
                continue;
            }
            for (id, v) in attempts.as_object().into_iter().flatten() {
                if !crate::util::safe_id(id) {
                    bad += 1;
                    continue;
                }
                let ok = crate::attempt::migrate(v.clone()).ok().and_then(|m| serde_json::from_value::<crate::attempt::Attempt>(m).ok());
                let Some(a) = ok else {
                    bad += 1;
                    continue;
                };
                if a.case_id != *case || a.id != *id {
                    bad += 1;
                    continue;
                }
                let p = dir.join("saves").join(case).join(format!("{id}.json"));
                if p.exists() {
                    skipped += 1;
                    continue;
                }
                write_json(&p, &a).map_err(|e| e.to_string())?;
                added += 1;
            }
        }
    }
    if let Some(h) = bundle.get("history").and_then(|h| h.as_array()) {
        for r in h {
            let _ = history_add(dir, r.clone());
        }
    }
    Ok(json!({"added": added, "skipped": skipped, "rejected": bad}))
}

pub fn clear_caches(dir: &Path) -> Value {
    let before = dir_size(&dir.join("tmp"));
    let _ = std::fs::remove_dir_all(dir.join("tmp"));
    json!({"freed": before})
}

pub fn delete_all(dir: &Path) -> std::io::Result<()> {
    for sub in ["cases", "saves", "tmp", "exports"] {
        let _ = std::fs::remove_dir_all(dir.join(sub));
    }
    for f in ["profile.json", "history.json", "settings.json", "academy.json", "help.json"] {
        let _ = std::fs::remove_file(dir.join(f));
    }
    std::fs::create_dir_all(dir.join("cases"))?;
    std::fs::create_dir_all(dir.join("saves"))
}
