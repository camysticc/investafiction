---
id: "gs.install"
title: "Installing and running Investafiction"
category: "Getting started"
answer: "Install it with the installer for your system, or run it from the source code with npm and Rust installed."
questions: ["how do i install it", "how do i run the program", "npm run tauri dev not working", "cargo not found", "how do i launch investafiction"]
synonyms: ["setup", "launch", "open the app", "build"]
tags: ["install"]
related: ["ts.case_wont_open", "about.version"]
version: "1.3"
---

**From an installer.** Run the installer for Windows, macOS or Linux and open Investafiction from your apps.

**From the source code.**
1. Install Node.js and Rust (rustup).
2. Open a terminal in the `app` folder.
3. Run `npm install`, then `npm run tauri dev`.

The first build takes several minutes because the Rust core is compiled. Later launches take seconds. Keep the terminal open while you use the program.
