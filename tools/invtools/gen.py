"""Seeded generators for synthetic case data.

Everything here follows the synthetic data rules in docs/SYNTHETIC_DATA.md:
drama-range phone numbers, documentation IP ranges, reserved email
domains and vehicle registrations that cannot match a real format.
The same seed always produces the same output.
"""
from __future__ import annotations

import random
import string
from datetime import datetime, timedelta, timezone

UTC = timezone.utc

FIRST = ["Aled", "Bryony", "Cian", "Delyth", "Emrys", "Farah", "Gethin", "Hollis", "Ines", "Jory",
         "Kezia", "Lorcan", "Maelys", "Niamh", "Orrin", "Perrin", "Quilla", "Rhian", "Soren", "Tamsin",
         "Ulric", "Vashti", "Wren", "Xanthe", "Yorick", "Zelda", "Anwen", "Bram", "Corin", "Dilys",
         "Elowen", "Fenn", "Greer", "Huw", "Isolde", "Jago", "Kit", "Linnea", "Merryn", "Nye",
         "Oona", "Piran", "Roscoe", "Seren", "Tobin", "Una", "Vale", "Wynne", "Ysolde", "Zander"]
SURNAME_A = ["Ash", "Brack", "Cold", "Dun", "Elm", "Fern", "Gall", "Holt", "Ivy", "Kell",
             "Lark", "Moss", "North", "Oak", "Pell", "Quarr", "Rook", "Stain", "Thorn", "Wex"]
SURNAME_B = ["by", "combe", "ford", "gate", "ham", "hurst", "ley", "mere", "ridge", "stow",
             "thwaite", "well", "wick", "worth", "dale", "field", "brook", "lowe", "ton", "more"]

# A short guard list. Generated names are also checked by docs/SYNTHETIC_DATA.md review.
BLOCKED_NAMES = {"Tamsin Ashby", "Huw Edwards"}


class Gen:
    def __init__(self, seed: int):
        self.r = random.Random(seed)
        self._used_names: set[str] = set()
        self._used_phones: set[int] = set()
        self._used_plates: set[str] = set()

    # ---- people and identifiers -------------------------------------------------
    def name(self) -> str:
        for _ in range(500):
            n = f"{self.r.choice(FIRST)} {self.r.choice(SURNAME_A)}{self.r.choice(SURNAME_B)}"
            if n not in self._used_names and n not in BLOCKED_NAMES:
                self._used_names.add(n)
                return n
        raise RuntimeError("Ran out of names")

    def mobile(self) -> str:
        """A mobile number from the 07700 900000 to 900999 drama range."""
        for _ in range(2000):
            n = self.r.randint(0, 999)
            if n not in self._used_phones:
                self._used_phones.add(n)
                return f"07700 900{n:03d}"
        raise RuntimeError("Ran out of drama-range numbers")

    def landline(self) -> str:
        return f"020 7946 0{self.r.randint(0, 999):03d}"

    def ip(self) -> str:
        net = self.r.choice(["192.0.2", "198.51.100", "203.0.113"])
        return f"{net}.{self.r.randint(1, 254)}"

    def plate(self) -> str:
        """Invented registration with a hyphen, which no current UK format uses."""
        for _ in range(500):
            p = (self.r.choice("QXZ") + self.r.choice(string.ascii_uppercase) + str(self.r.randint(0, 9))
                 + "-" + str(self.r.randint(0, 9)) + "".join(self.r.choice("KQXZJV") for _ in range(2)))
            if p not in self._used_plates:
                self._used_plates.add(p)
                return p
        raise RuntimeError("Ran out of plates")

    def account(self) -> tuple[str, str]:
        """Fictional sort code (99-xx-xx block) and eight digit account number."""
        return f"99-{self.r.randint(10, 99)}-{self.r.randint(10, 99)}", f"{self.r.randint(0, 99999999):08d}"

    def email(self, name: str, domain: str = "example.com") -> str:
        first, last = name.lower().split(" ", 1)
        style = self.r.choice(["{f}.{l}", "{f}{l}", "{fi}{l}", "{f}_{l}{n}"])
        local = style.format(f=first, l=last.replace(" ", ""), fi=first[0], n=self.r.randint(1, 99))
        return f"{local}@{domain}"

    def serial(self, prefix: str = "") -> str:
        return prefix + "".join(self.r.choice("0123456789ABCDEF") for _ in range(12))

    def money(self, lo: float, hi: float) -> float:
        return round(self.r.uniform(lo, hi), 2)

    # ---- time -----------------------------------------------------------------
    def time_between(self, start: datetime, end: datetime) -> datetime:
        span = int((end - start).total_seconds())
        return start + timedelta(seconds=self.r.randint(0, max(span, 1)))

    def working_time(self, day: datetime, start_h: int = 8, end_h: int = 18) -> datetime:
        base = day.replace(hour=start_h, minute=0, second=0, microsecond=0)
        return base + timedelta(minutes=self.r.randint(0, (end_h - start_h) * 60 - 1))

    def choice(self, seq):
        return self.r.choice(seq)

    def sample(self, seq, k):
        return self.r.sample(seq, k)

    def chance(self, p: float) -> bool:
        return self.r.random() < p

    def randint(self, a: int, b: int) -> int:
        return self.r.randint(a, b)

    def shuffle(self, seq):
        self.r.shuffle(seq)
        return seq


def iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def t(s: str) -> datetime:
    """Parse '2026-03-02 09:15' (UTC) into a datetime."""
    return datetime.strptime(s, "%Y-%m-%d %H:%M").replace(tzinfo=UTC)


def days(start: datetime, n: int, weekdays_only: bool = False):
    d = start
    out = []
    while len(out) < n:
        if not weekdays_only or d.weekday() < 5:
            out.append(d)
        d += timedelta(days=1)
    return out


def csv_text(columns: list[str], rows: list[list]) -> str:
    def cell(v):
        s = "" if v is None else (f"{v:.2f}" if isinstance(v, float) else str(v))
        if any(c in s for c in ',"\n'):
            s = '"' + s.replace('"', '""') + '"'
        return s
    lines = [",".join(cell(c) for c in columns)]
    lines += [",".join(cell(v) for v in row) for row in rows]
    return "\n".join(lines) + "\n"
