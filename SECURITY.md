# Security policy

## How packs are handled

Case packs can be written by anyone, so the app treats every pack as untrusted.

- Packs larger than 50 MB, with more than 600 files, or with any file over 10 MB are refused.
- Only data file types are allowed: `.json .md .csv .txt .eml .svg .png .jpg .jpeg`. Nothing in a pack is ever run.
- Unzipping blocks absolute paths, `..` segments, drive letters and backslashes, so a pack cannot write outside its own folder.
- SVG files containing scripts, event handlers, `foreignObject` or external links are refused.
- Every file must match the SHA-256 listed in the manifest, every JSON file must pass its schema, and cross references must line up. Any failure stops the import and nothing is added to the library.
- Installed packs are checked again each time they open.
- Simulated web pages are rendered from structured data, never as HTML. The desktop app has no network plugins and its content security policy blocks network connections.

The answer key is kept in the Rust core to prevent accidental spoilers. It is not designed to stop a determined cheater.

## Reporting a problem

If you find a way for a pack to break out of these rules, run code, read files outside its folder or reach the network, please open a private security advisory on the repository rather than a public issue. Include the pack (or the steps to build it) and what happened. You will get a reply as soon as possible.

## Scope

Investafiction is a personal practice tool that runs offline. It stores everything locally in the app's data folder and has no accounts or servers.
