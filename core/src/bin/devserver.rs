//! Browser development server. Serves the built interface from app/dist and
//! answers POST /api with the same dispatcher the desktop shell uses.
//!
//!     cargo run --features devserver --bin invcore-devserver -- <data dir> [port] [ui dir]
//!
//! It listens on 127.0.0.1 only. It is a development tool and is not shipped.

use invcore::{Engine, call};
use std::path::PathBuf;
use tiny_http::{Header, Method, Response, Server};

fn main() {
    let mut args = std::env::args().skip(1);
    let data = PathBuf::from(args.next().unwrap_or_else(|| "./devdata".into()));
    let port = args.next().unwrap_or_else(|| "8765".into());
    let ui = PathBuf::from(args.next().unwrap_or_else(|| "../app/dist".into()));
    let mut engine = Engine::new(&data);
    let server = Server::http(format!("127.0.0.1:{port}")).expect("could not bind");
    eprintln!("Investafiction dev server on http://127.0.0.1:{port} (data {})", data.display());
    for mut req in server.incoming_requests() {
        let url = req.url().split('?').next().unwrap_or("/").to_string();
        if req.method() == &Method::Post && url == "/api" {
            let mut body = String::new();
            let _ = req.as_reader().read_to_string(&mut body);
            let v: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
            let cmd = v.get("cmd").and_then(|c| c.as_str()).unwrap_or("").to_string();
            let args = v.get("args").cloned().unwrap_or_default();
            let out = call(&mut engine, &cmd, &args);
            let resp = Response::from_string(out.to_string()).with_header(Header::from_bytes("Content-Type", "application/json").unwrap());
            let _ = req.respond(resp);
            continue;
        }
        let rel = if url == "/" { "index.html".to_string() } else { url.trim_start_matches('/').to_string() };
        if rel.contains("..") {
            let _ = req.respond(Response::from_string("no").with_status_code(400));
            continue;
        }
        let path = ui.join(&rel);
        let path = if path.is_file() { path } else { ui.join("index.html") };
        match std::fs::read(&path) {
            Ok(bytes) => {
                let ct = match path.extension().and_then(|e| e.to_str()) {
                    Some("html") => "text/html; charset=utf-8",
                    Some("js") => "text/javascript",
                    Some("css") => "text/css",
                    Some("svg") => "image/svg+xml",
                    Some("png") => "image/png",
                    Some("woff2") => "font/woff2",
                    _ => "application/octet-stream",
                };
                let _ = req.respond(Response::from_data(bytes).with_header(Header::from_bytes("Content-Type", ct).unwrap()));
            }
            Err(_) => {
                let _ = req.respond(Response::from_string("not found").with_status_code(404));
            }
        }
    }
}
