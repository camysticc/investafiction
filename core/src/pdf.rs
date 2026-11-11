//! A very small PDF writer for report exports. It lays out plain text from
//! the Markdown report in Helvetica, one of the fonts every PDF reader has
//! built in, so no font files need to ship with the app.

fn esc(s: &str) -> String {
    let mut o = String::new();
    for c in s.chars() {
        match c {
            '(' | ')' | '\\' => {
                o.push('\\');
                o.push(c);
            }
            // WinAnsi covers Latin-1; map a few common characters and drop the rest.
            '\u{2018}' | '\u{2019}' => o.push('\''),
            '\u{201C}' | '\u{201D}' => o.push('"'),
            '\u{2013}' | '\u{2014}' => o.push('-'),
            '\u{00A3}' => o.push_str("\\243"),
            c if (c as u32) < 128 => o.push(c),
            c if (c as u32) < 256 => o.push_str(&format!("\\{:03o}", c as u32)),
            _ => o.push('?'),
        }
    }
    o
}

/// Rough Helvetica widths in thousandths of an em, good enough for wrapping.
fn char_w(c: char) -> f64 {
    match c {
        'i' | 'j' | 'l' | '.' | ',' | ':' | ';' | '\'' | '|' | '!' => 278.0,
        'f' | 't' | 'r' | ' ' | '(' | ')' | '-' | '/' => 333.0,
        'm' | 'w' | 'M' | 'W' => 833.0,
        'A'..='Z' => 667.0,
        '0'..='9' => 556.0,
        _ => 540.0,
    }
}

fn width(s: &str, size: f64) -> f64 {
    s.chars().map(char_w).sum::<f64>() * size / 1000.0
}

fn wrap(text: &str, size: f64, max: f64) -> Vec<String> {
    let mut lines = vec![];
    let mut cur = String::new();
    for word in text.split_whitespace() {
        let trial = if cur.is_empty() { word.to_string() } else { format!("{cur} {word}") };
        if width(&trial, size) > max && !cur.is_empty() {
            lines.push(std::mem::take(&mut cur));
            cur = word.to_string();
        } else {
            cur = trial;
        }
    }
    if !cur.is_empty() {
        lines.push(cur);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

pub fn from_markdown(md: &str, title: &str) -> Vec<u8> {
    const W: f64 = 595.0;
    const H: f64 = 842.0;
    const M: f64 = 56.0;
    let mut pages: Vec<String> = vec![];
    let mut cur = String::new();
    let mut y = H - M;
    let mut page_no = 1;
    let footer = |n: usize| format!("BT /F1 8 Tf {M} 30 Td ({}) Tj ET\n", esc(&format!("{title}  |  fictional training exercise  |  page {n}")));
    let emit = |cur: &mut String, y: &mut f64, font: &str, size: f64, indent: f64, text: &str, pages: &mut Vec<String>, page_no: &mut usize| {
        for line in wrap(text, size, W - 2.0 * M - indent) {
            if *y < M + 20.0 {
                cur.push_str(&footer(*page_no));
                pages.push(std::mem::take(cur));
                *page_no += 1;
                *y = H - M;
            }
            cur.push_str(&format!("BT /{font} {size} Tf {:.1} {:.1} Td ({}) Tj ET\n", M + indent, *y, esc(&line)));
            *y -= size * 1.35;
        }
    };
    for raw in md.lines() {
        let line = raw.trim_end();
        let clean = |s: &str| s.replace("**", "").replace('*', "").replace('`', "");
        if let Some(h) = line.strip_prefix("# ") {
            emit(&mut cur, &mut y, "F2", 17.0, 0.0, &clean(h), &mut pages, &mut page_no);
            y -= 6.0;
        } else if let Some(h) = line.strip_prefix("## ") {
            y -= 6.0;
            emit(&mut cur, &mut y, "F2", 12.5, 0.0, &clean(h), &mut pages, &mut page_no);
            y -= 2.0;
        } else if line.starts_with("|---") {
            continue;
        } else if line.starts_with('|') {
            let cells: Vec<String> = line.trim_matches('|').split('|').map(|c| clean(c.trim())).collect();
            emit(&mut cur, &mut y, "F1", 8.5, 0.0, &cells.join("   "), &mut pages, &mut page_no);
        } else if line.trim().is_empty() {
            y -= 5.0;
        } else if let Some(item) = line.strip_prefix("- ") {
            emit(&mut cur, &mut y, "F1", 10.0, 10.0, &format!("- {}", clean(item)), &mut pages, &mut page_no);
        } else {
            emit(&mut cur, &mut y, "F1", 10.0, if raw.starts_with("   ") { 14.0 } else { 0.0 }, &clean(line), &mut pages, &mut page_no);
        }
    }
    cur.push_str(&footer(page_no));
    pages.push(cur);

    // Assemble objects: 1 catalog, 2 pages, 3 F1, 4 F2, then page + content pairs.
    let mut objs: Vec<String> = vec![];
    objs.push("<< /Type /Catalog /Pages 2 0 R >>".into());
    let kids: Vec<String> = (0..pages.len()).map(|i| format!("{} 0 R", 5 + i * 2)).collect();
    objs.push(format!("<< /Type /Pages /Kids [{}] /Count {} >>", kids.join(" "), pages.len()));
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>".into());
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>".into());
    for (i, content) in pages.iter().enumerate() {
        objs.push(format!("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {} 0 R >>", 6 + i * 2));
        objs.push(format!("<< /Length {} >>\nstream\n{}endstream", content.len(), content));
    }
    let mut out = String::from("%PDF-1.4\n");
    let mut offsets = vec![];
    for (i, o) in objs.iter().enumerate() {
        offsets.push(out.len());
        out.push_str(&format!("{} 0 obj\n{}\nendobj\n", i + 1, o));
    }
    let xref = out.len();
    out.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objs.len() + 1));
    for off in offsets {
        out.push_str(&format!("{off:010} 00000 n \n"));
    }
    out.push_str(&format!("trailer\n<< /Size {} /Root 1 0 R /Info << /Title ({}) /Producer (Investafiction) >> >>\nstartxref\n{xref}\n%%EOF\n", objs.len() + 1, esc(title)));
    out.into_bytes()
}
