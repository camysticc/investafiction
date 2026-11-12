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
