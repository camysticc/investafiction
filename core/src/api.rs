//! One entry point for the interface. The Tauri shell and the browser dev
//! server both call `dispatch` with a command name and JSON arguments.

use crate::engine::{ApiError, Engine, R};
use base64::Engine as _;
use serde_json::{Value, json};

fn s<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("")
}

pub fn dispatch(engine: &mut Engine, cmd: &str, args: &Value) -> R<Value> {
    match cmd {
        "app.info" => Ok(json!({"version": env!("CARGO_PKG_VERSION"), "data_dir": engine.data_dir.display().to_string(), "schema_major": crate::pack::SUPPORTED_MAJOR, "presets": crate::engine::PRESET_NAMES})),
        "profile.get" => Ok(json!({"profile": engine.profile()})),
        "profile.set" => engine.set_profile(s(args, "name"), args.get("text_scale").and_then(|x| x.as_f64())).map(|p| json!({"profile": p})),
        "store.get" => crate::records::store_get(&engine.data_dir, s(args, "name")).map_err(ApiError::new),
        "store.set" => crate::records::store_set(&engine.data_dir, s(args, "name"), args.get("data").unwrap_or(&Value::Null)).map_err(ApiError::new),
        "history.get" => Ok(json!({"attempts": crate::records::history(&engine.data_dir)})),
        "history.reset" => crate::records::history_reset(&engine.data_dir).map(|_| json!({"reset": true})).map_err(|e| ApiError::new(e.to_string())),
        "data.usage" => Ok(crate::records::usage(&engine.data_dir)),
        "data.export_saves" => {
            let bundle = crate::records::export_bundle(&engine.data_dir);
            let text = serde_json::to_string_pretty(&bundle).unwrap_or_default();
            engine.write_export(&format!("investafiction-saves-{}.json", chrono::Utc::now().format("%Y%m%d-%H%M")), text.as_bytes())
        }
        "data.import_saves" => {
            let raw = base64::engine::general_purpose::STANDARD.decode(s(args, "data_b64")).map_err(|_| ApiError::new("The file could not be read."))?;
            let v: Value = serde_json::from_slice(&raw).map_err(|_| ApiError::new("The file is not valid JSON."))?;
            crate::records::import_bundle(&engine.data_dir, &v).map_err(ApiError::new)
        }
        "data.clear_caches" => Ok(crate::records::clear_caches(&engine.data_dir)),
        "data.delete_all" => {
            if s(args, "confirm") != "DELETE EVERYTHING" {
                return Err(ApiError::new("Type DELETE EVERYTHING to confirm."));
            }
            engine.session = None;
            crate::records::delete_all(&engine.data_dir).map(|_| json!({"deleted": true})).map_err(|e| ApiError::new(e.to_string()))
        }
        "data.write_file" => {
            let raw = base64::engine::general_purpose::STANDARD.decode(s(args, "data_b64")).map_err(|_| ApiError::new("Export data was not valid."))?;
            let name: String = s(args, "filename").chars().filter(|c| c.is_ascii_alphanumeric() || "-_.".contains(*c)).collect();
            if ![".json", ".md", ".png", ".svg", ".txt", ".csv"].iter().any(|e| name.ends_with(e)) {
                return Err(ApiError::new("That export type is not supported."));
            }
            engine.write_export(&name, &raw)
        }
        "replay" => engine.replay(s(args, "case_id"), s(args, "attempt_id")),
        "profile.reset" => {
            let _ = std::fs::remove_file(engine.data_dir.join("profile.json"));
            engine.session = None;
            Ok(json!({"profile": null}))
        }
        "library.list" => Ok(json!({"cases": engine.library()})),
        "pack.inspect" => {
            let data = base64::engine::general_purpose::STANDARD.decode(s(args, "data_b64")).map_err(|_| ApiError::new("The file could not be read."))?;
            engine.inspect_pack(&data)
        }
        "pack.install" => engine.install_pack(s(args, "token")),
        "pack.cancel" => {
            engine.cancel_pending(s(args, "token"));
            Ok(json!({}))
        }
        "pack.remove" => engine.remove_case(s(args, "case_id")),
        "attempt.new" => engine.new_attempt(s(args, "case_id"), s(args, "mode"), args),
        "attempt.open" => engine.open_attempt(s(args, "case_id"), s(args, "attempt_id")),
        "attempt.delete" => engine.delete_attempt(s(args, "case_id"), s(args, "attempt_id")),
        "attempt.close" => engine.close(),
        "attempt.reset" => engine.reset(),
        "state" => engine.state(),
        "act" => engine.act(args),
        "evidence.open" => engine.evidence_content(args),
        "asset" => {
            let sess = engine.session.as_ref().ok_or_else(|| ApiError::new("No case is open."))?;
            sess.asset(s(args, "path"))
        }
        "osint.search" => engine.osint_search(s(args, "query")),
        "osint.open" => engine.osint_open(args),
        "search" => engine.search(args),
        "links.suggest" => engine.suggest_links(),
        "map.points" => engine.map_points(),
        "report.preview" => engine.report_preview(),
        "export" => engine.export(args),
        "submit" => engine.submit(args.get("confirm").and_then(|c| c.as_bool()).unwrap_or(false)),
        _ => Err(ApiError::new(format!("Unknown command: {cmd}"))),
    }
}

/// Dispatch and wrap the outcome as {ok, data} or {ok:false, error}.
pub fn call(engine: &mut Engine, cmd: &str, args: &Value) -> Value {
    match dispatch(engine, cmd, args) {
        Ok(v) => json!({"ok": true, "data": v}),
        Err(e) => json!({"ok": false, "error": e}),
    }
}
