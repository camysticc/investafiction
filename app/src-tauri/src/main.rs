// Desktop shell. It wraps the React interface in a native window and passes
// every call to the Rust core through one command. The app makes no network
// connections: there are no network plugins, and the webview content
// security policy only allows local resources.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use invcore::Engine;
use serde_json::Value;
use std::sync::Mutex;
use tauri::Manager;

struct Core(Mutex<Engine>);

#[tauri::command]
fn call(state: tauri::State<'_, Core>, cmd: String, args: Value) -> Value {
    let mut engine = state.0.lock().unwrap_or_else(|p| p.into_inner());
    invcore::call(&mut engine, &cmd, &args)
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("no app data folder");
            app.manage(Core(Mutex::new(Engine::new(dir))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![call])
        .run(tauri::generate_context!())
        .expect("error while running Investafiction");
}
