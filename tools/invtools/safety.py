"""Synthetic data safety scan.

Looks through every text file in a built case for phone numbers, IP
addresses, email addresses and web addresses that fall outside the
reserved ranges listed in docs/SYNTHETIC_DATA.md.
"""
from __future__ import annotations

import ipaddress
import re
from pathlib import Path

from .validate import Report

TEXT_EXT = {".json", ".md", ".csv", ".txt", ".eml", ".svg"}
MOBILE = re.compile(r"(?<!\d)(?:\+44\s?7|07)(\d{3})\s?(\d{6})(?!\d)")
LANDLINE = re.compile(r"(?<!\d)0(1\d{2,3}|2\d)\s?(\d{3,4})\s?(\d{4})(?!\d)")
IPV4 = re.compile(r"(?<![\d.])(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?![\d.])")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})")
URL = re.compile(r"https?://([A-Za-z0-9.-]+)")

HEX64 = re.compile(r"[0-9a-f]{64}")
DOC_NETS = [ipaddress.ip_network(n) for n in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24")]
PRIVATE_NETS = [ipaddress.ip_network(n) for n in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8")]
OK_DOMAINS = ("example.com", "example.net", "example.org")
OK_TLDS = (".test", ".invalid", ".example", ".localhost")
SCHEMA_HOSTS = {"json-schema.org", "investafiction.test", "www.w3.org"}


def _domain_ok(d: str) -> bool:
    d = d.lower().rstrip(".")
    return d in SCHEMA_HOSTS or d.endswith(OK_TLDS) or any(d == x or d.endswith("." + x) for x in OK_DOMAINS)


def scan(folder: Path) -> Report:
    rep = Report()
    for p in sorted(Path(folder).rglob("*")):
        if not p.is_file() or p.suffix.lower() not in TEXT_EXT:
            continue
        rel = p.relative_to(folder).as_posix()
        text = p.read_text(encoding="utf-8", errors="replace")
        # Hashes are long hex strings that can look like phone numbers. Drop them first.
        text = HEX64.sub(" ", text)
        for m in MOBILE.finditer(text):
            if not (m.group(1) == "700" and m.group(2).startswith("900")):
                rep.err(f"{rel}: mobile number {m.group(0)} is outside the 07700 900xxx drama range")
        for m in LANDLINE.finditer(text):
            if not (m.group(1) == "20" and m.group(2) == "7946" and m.group(3).startswith("0")):
                rep.err(f"{rel}: landline {m.group(0)} is outside the 020 7946 0xxx drama range")
        for m in IPV4.finditer(text):
            try:
                ip = ipaddress.ip_address(m.group(1))
            except ValueError:
                continue
            if any(ip in n for n in DOC_NETS):
                continue
            if any(ip in n for n in PRIVATE_NETS):
                continue
            # Version strings such as 1.4.2.0 also match, so only flag plausible public addresses.
            if all(int(x) < 10 for x in m.group(1).split(".")):
                continue
            rep.err(f"{rel}: IP address {ip} is not in a documentation or private range")
        for m in EMAIL.finditer(text):
            if not _domain_ok(m.group(1)):
                rep.err(f"{rel}: email domain {m.group(1)} is not reserved")
        for m in URL.finditer(text):
            if not _domain_ok(m.group(1)):
                rep.err(f"{rel}: web address {m.group(1)} is not on a reserved domain")
    return rep
