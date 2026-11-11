"""Case 3: Quiet Exit. Digital forensics and data theft, hard.

STORY BIBLE (private, for authors)

Ashgrove Dynamics Ltd designs marine sensor housings. Its confidential
KITTIWAKE design files (214 files) left the business in the weeks before a
senior engineer (P1) resigned to join Harrowgate Marine Systems.

The truth is two routes:
1. USB. On 28 January P1 test-copied 3 files to a USB drive (serial
   KS-7731-0042). On 19 February, on site from 18:30 to 19:05, P1 copied all
   214 files from WS-ENG-07 to the same drive between 18:42 and 18:51. On
   20 February the drive was plugged into P1's company laptop and the files
   copied in. On 26 February P1 deleted that folder from the laptop.
2. Cloud. On 24 February at 21:15 a share link to the KITTIWAKE folder was
   made with the shared service account svc-cadsync, from WS-ENG-04 (P2's
   workstation). P2 was on site from 20:58 to 21:38. P1 was not. At 21:19
   P2 messaged a Harrowgate recruiter "Link's live". The link was opened
   from a Harrowgate IP address at 08:02 on 25 February.

svc-cadsync was set up by P1 and shares P1's password. P2 also knew it.
Proving the account was used does not prove who used it.

Complications: a software update on 12 February changed modified times on
every KITTIWAKE file; the lobby camera runs 7 minutes fast; the night guard
thinks he saw P1 on 24 February (he saw P2, who also has a beard); one
export file fails its hash check because IT re-exported it; server logs
before 1 February have rolled over; a contractor's admin activity is
routine; a privileged email sits in the mail export; the head of design
keeps personal photo backups on the server (a separate breach to report,
not pursue).
"""
from datetime import timedelta

from invtools.casekit import (C_all, C_finding, C_graded, C_hashed, C_legality, C_link, C_mismatch, C_objectives,
                              C_received, C_request, C_timeline, Case)
from invtools.common import sha256_bytes
from invtools.gen import Gen, iso, t

SEED = 3303


def make_case() -> Case:
    g = Gen(SEED)
    c = Case(id="quiet-exit", title="Quiet Exit", version="1.0.0", specialty="Digital forensics and data theft",
             difficulty="Hard", minutes=210, seed=SEED,
             summary="Confidential design files left a research business before an engineer resigned. Work out how, when, "
                     "with which devices and accounts, who was on site, and how sure anyone can be about who did it.")
    P1, P2, P3, P4, P5, P6 = (g.name() for _ in range(6))
    W1, W2, W3, W4 = (g.name() for _ in range(4))
    REC = g.name()
    sur = lambda n: n.split(" ", 1)[1]
    first = lambda n: n.split(" ", 1)[0]
    u = lambda n: (n[0] + sur(n)).lower()
    U1, U2, U3, U4, U5, U6 = u(P1), u(P2), u(P3), u(P4), u(P5), u(P6)
    m = {k: g.mobile() for k in ["p1", "p2", "p5", "rec", "w4", "p1personal", "w3"]}
    car1, car2, car3 = g.plate(), g.plate(), g.plate()
    CO = "Ashgrove Dynamics Ltd"
    EXT = "Harrowgate Marine Systems"
    SERIAL = "KS-7731-0042"
    EXT_IP = "203.0.113.88"
    DOM = "ashgrove.example.com"

    c.brief = f"""
# Quiet Exit

**{CO}** designs pressure housings for marine sensors at a small site on the Moorend Industrial Estate, Kestrel Bay. Its most valuable work is a set of confidential design files called **KITTIWAKE**.

On 2 March 2026 the IT manager noticed an old alert from the company's cloud storage provider: someone outside the business had opened a share link to the KITTIWAKE folder on 25 February. Two days before that, a senior design engineer, {P1}, had finished their notice period. They are joining a competitor, {EXT}.

The managing director has referred the matter. You are the analyst. The company has supplied forensic images and exports from its workstations, servers, cloud service, door access, cameras and phones.

Establish how the data left, when, which devices and accounts were involved, who was physically on site, and how confident anyone can be about who did it. Separate what is proved from what is likely and what is unknown. Expect the picture to change as you go.

*All people, businesses, places and data in this case are fictional.*
"""
    c.intake = {
        "tasking": f"Establish how the KITTIWAKE design files left {CO}, when, through which devices and accounts, who was on site, "
                   "and give a cautious assessment of attribution.",
        "scope": [f"Company devices, accounts, logs and records of {CO}", "Company-owned phones and their records",
                  "Requests for third-party data and authority where necessary and proportionate"],
        "out_of_scope": ["Personal devices and personal accounts, unless specific authority is granted", "Legally privileged material",
                         "Bulk material about staff with no connection to the files"],
        "authorities": [{"id": "AUTH-BASE", "label": "Company consent and tasking", "covers": "Company-owned devices, accounts and records supplied for this enquiry"}],
        "constraints": ["Work on copies only. Hash every item before relying on it.", "Report integrity problems; do not try to fix them.",
                        "Do not contact staff or the competitor."],
        "clock_start": "2026-03-09T09:00:00Z",
        "case_lead": "Detective Inspector, Cyber Crime Unit",
        "osint_access": "public_only",
    }
    E = c.entity
    E("ENT-ORG1", "organisation", CO, role="Victim organisation")
    E("ENT-EXT", "organisation", EXT, role="External party (competitor)", identifiers=[EXT_IP])
    E("ENT-P1", "person", P1, role="Senior design engineer (resigned)", identifiers=[U1])
    E("ENT-P2", "person", P2, role="Design engineer", identifiers=[U2])
    E("ENT-P3", "person", P3, role="IT contractor with admin access", identifiers=[U3, "adm-" + U3])
    E("ENT-P4", "person", P4, role="IT manager", identifiers=[U4])
    E("ENT-P5", "person", P5, role="Head of design", identifiers=[U5])
    E("ENT-P6", "person", P6, role="Office and facilities manager", identifiers=[U6])
    E("ENT-W1", "person", W1, role="Managing director (witness)")
    E("ENT-W2", "person", W2, role="HR manager (witness)")
    E("ENT-W3", "person", W3, role="Night security guard (witness)")
    E("ENT-W4", "person", W4, role="Lab technician (witness)", identifiers=[m["w4"]])
    E("ENT-REC", "person", REC, role=f"Recruiter at {EXT}", identifiers=[m["rec"]], hidden_until="S3")
    E("ENT-SVC", "online_account", "Service account svc-cadsync", identifiers=["svc-cadsync"])
    E("ENT-USB", "device", f"USB drive serial {SERIAL}", identifiers=[SERIAL], hidden_until="S2")
    E("ENT-WS07", "device", "Workstation WS-ENG-07", identifiers=["WS-ENG-07", "10.1.4.27"])
    E("ENT-WS04", "device", "Workstation WS-ENG-04", identifiers=["WS-ENG-04", "10.1.4.24"])
    E("ENT-LT07", "device", "Laptop LT-ENG-07", identifiers=["LT-ENG-07"])
    E("ENT-PH-P1", "phone", f"{m['p1']} (company mobile)", identifiers=[m["p1"]])
    E("ENT-PH-P2", "phone", f"{m['p2']} (company mobile)", identifiers=[m["p2"]])
    E("ENT-PH-REC", "phone", f"{m['rec']} (recruiter)", identifiers=[m["rec"]], hidden_until="S5")
    E("ENT-V1", "vehicle", f"Car {car1}", identifiers=[car1], hidden_until="S4")
    E("ENT-V2", "vehicle", f"Car {car2}", identifiers=[car2], hidden_until="S4")

    kw_files = []
    parts = ["housing", "endcap", "oring-groove", "pressure-test", "mount", "seal", "window", "bracket", "cable-gland", "anode"]
    for i in range(214):
        p = parts[i % len(parts)]
        kw_files.append((f"KW-{p}-{i // len(parts) + 1:02d}{'.step' if i % 3 == 0 else '.cad' if i % 3 == 1 else '.pdf'}", g.randint(80, 9000) * 1024))
    test_files = kw_files[:3]
    MOD_UPDATE = "2026-02-12T02:14:00Z"

    def ts(s):
        return iso(t(s))

    # ------------------------------------------------------------------ STAGE 1: scoping and integrity
    c.document("EV-001", "Referral letter from the managing director", "document", f"""
# Referral

**From:** {W1}, Managing Director, {CO}
**Date:** 4 March 2026

On 2 March our IT manager, {P4}, found an alert from our cloud storage provider dated 25 February. It said a share link to our KITTIWAKE project folder had been opened from outside the company. KITTIWAKE is our most valuable design work and is classed as confidential.

{P1}, a senior design engineer, resigned on 2 February and left on 27 February to join {EXT}. We are worried that our designs have gone with them, but we have not accused anyone.

We have asked {P4} to secure images and exports of the relevant systems. We would like an independent view of what happened.
""", source=CO, source_group="referral", acquired="2026-03-04 12:00", stage="S1", summary="Why the case was referred.", grade=("B", "3"))
    c.document("EV-002", "IT environment summary", "document", f"""
# IT environment

- **File server FS01** holds `\\\\fs01\\projects`. KITTIWAKE lives in `\\\\fs01\\projects\\KITTIWAKE` (214 files).
- **Engineering workstations:** WS-ENG-01 to WS-ENG-08 (Windows). Fast user switching is enabled.
- **Laptops:** issued to senior engineers. LT-ENG-07 was {P1}'s.
- **Cloud storage:** a synced copy of the projects share, used to send files to manufacturers. Share links can be created by any account with edit rights.
- **Service account svc-cadsync:** syncs CAD files to the cloud. It has edit rights on the cloud copy.
- **Log retention:** file server access logs are kept for 28 days, then roll over. Older logs exist only in weekly backups.
- **Network:** engineering VLAN 10.1.4.0/24. Public address 198.51.100.14.
""", source=f"{CO} IT", source_group="it-docs", acquired="2026-03-04 12:00", stage="S1", summary="How the systems fit together.", grade=("B", "2"))
    acq = [["EV-items", "Imaged or exported by", "Date", "Method"],
           ["Workstation and laptop listings", P4, "2026-03-02 to 2026-03-03", "Forensic imaging tool, exports hashed at creation"],
           ["Server and cloud logs", P4, "2026-03-03", "Native export, hashed"],
           ["Door access, cameras, ANPR", P6, "2026-03-03", "Native export, hashed"],
           ["Phones (company)", "External examiner", "2026-03-05", "Logical extraction, hashed"]]
    c.table("EV-003", "Acquisition notes", "spreadsheet", acq[0], acq[1:], source=f"{CO} IT", source_group="it-docs",
            acquired="2026-03-04 12:00", stage="S1", summary="Who acquired what, when and how.", grade=("B", "2"))
    staff = [[P1, "Senior design engineer", U1, "Left 2026-02-27"], [P2, "Design engineer", U2, ""], [P3, "IT contractor (admin)", "adm-" + U3, "Contract to 2026-06"],
             [P4, "IT manager", U4, ""], [P5, "Head of design", U5, ""], [P6, "Office and facilities manager", U6, ""],
             [W1, "Managing director", u(W1), ""], [W2, "HR manager", u(W2), ""], [W4, "Lab technician", u(W4), ""],
             [W3, "Night security (agency)", "none", "Agency staff"]]
    c.table("EV-004", "Staff and user accounts", "spreadsheet", ["name", "role", "username", "note"], staff,
            table={"entity_columns": ["username"]}, source=f"{CO} HR and IT", source_group="hr-it-list", acquired="2026-03-04 12:00", stage="S1",
            summary="Who is who, and their usernames.", grade=("B", "2"))
    c.document("EV-005", f"Resignation letter: {P1}", "hr_document", f"# Resignation\n\nDear {W1},\n\nPlease accept this letter as notice of my resignation. My last day will be Friday 27 February 2026. I have accepted a role at {EXT}.\n\nThank you for the last six years.\n\n{P1}\n\n*Received by HR 2 February 2026.*",
               source=f"{CO} HR", source_group="hr", acquired="2026-03-04 12:00", stage="S1", summary="Notice of resignation.", grade=("A", "1"))
    c.document("EV-006", "Data classification and acceptable use policy", "document", """
# Data classification and acceptable use

- KITTIWAKE files are **Confidential**. They may only be shared outside the business through an approved manufacturer link, with the head of design's sign-off.
- Removable storage (USB drives) must not be used for Confidential files.
- Shared or generic accounts must not be used by individuals for their own work. Passwords must never be shared.
- Personal files must not be stored on company servers.
""", source=f"{CO} policy library", source_group="policy", acquired="2026-03-04 12:00", stage="S1", summary="What staff may and may not do with confidential files.", grade=("A", "1"))
    reg = [[name, str(size), sha256_bytes(name.encode())[:16], "Confidential"] for name, size in kw_files]
    c.table("EV-007", "KITTIWAKE file register", "spreadsheet", ["file", "size_bytes", "content_hash_prefix", "class"], reg,
            source=f"{CO} design office", source_group="kw-register", acquired="2026-03-04 12:00", stage="S1",
            summary="The 214 KITTIWAKE files, with sizes and content hashes.", grade=("A", "1"))

    # Hash mismatch item: first export of the WS-ENG-04 listing, re-exported later by IT.
    ws04_rows = []
    for name, size in kw_files[:40]:
        ws04_rows.append([f"C:\\Users\\{U2}\\Projects\\KITTIWAKE\\{name}", str(size), "2025-11-03T09:00:00Z", MOD_UPDATE, "2026-02-24T21:12:00Z", "no"])
    first_export = "path,size,created,modified,accessed,deleted\n" + "\n".join(",".join(r) for r in ws04_rows[:25]) + "\n### export truncated: write error ###\n"
    c.evidence("EV-008", "WS-ENG-04 file system listing (first export)", "file_listing", first_export, "csv",
               source=f"{CO} IT", source_group="ws04-image", acquired="2026-03-03 18:00", stage="S1", acquired_by=P4,
               original_hash=sha256_bytes(first_export.encode() + b"(original export as hashed at creation)"), tags=["integrity_test"],
               table={"time_column": "accessed"}, summary="The first export of the file listing from P2's workstation.", grade=("C", "4"))
    for eid, title in [("EV-009", "Company organisation chart"), ("EV-010", "Site floor plan description"), ("EV-011", "IT support ticket summary, February")]:
        body = {"EV-009": f"Managing director {W1}. Head of design {P5} manages {P1}, {P2} and {W4}. IT manager {P4} manages contractor {P3}. Office and facilities: {P6}.",
                "EV-010": "Ground floor: lobby (camera CAM-LOBBY), reception, lab. First floor: design office, CAD room (camera CAM-CAD), server room. Car park camera CAM-PARK and site entrance ANPR camera.",
                "EV-011": "Tickets: printer jam x4, password reset x6, CAD licence errors after the 12 February update x9, VPN slow x2."}[eid]
        c.document(eid, title, "document", f"# {title}\n\n{body}", source=CO, source_group="misc-" + eid, acquired="2026-03-04 12:00", stage="S1",
                   noise=eid != "EV-010", summary=title, grade=("B", "2"))
    c.table("EV-012", "All-staff mailbox export index (bulk)", "spreadsheet", ["mailbox", "items", "size_mb"],
            [[f"{g.name().split()[0].lower()}@{DOM}", str(g.randint(800, 9000)), str(g.randint(200, 4000))] for _ in range(40)],
            source=f"{CO} IT (exported unrequested)", source_group="bulk-mail", acquired="2026-03-03 20:00", stage="S1", marking="restricted",
            handling="An index of every staff mailbox, exported without being asked for. Examining all staff mail would be far more than this enquiry needs.",
            summary="Every mailbox in the company.", grade=("B", "2"))
    p1phone = {"device": {"Owner": f"{P1} (personal phone found in desk drawer)", "Note": "Imaged by company IT without the owner's consent or any authority"},
               "messages": [{"app": "SMS", "thread": "unknown", "from": "owner", "to": "unknown", "time": "2026-02-20T19:00:00Z", "text": "(content not reviewed)"}]}
    c.json_item("EV-013", f"Personal phone image: {P1} (taken by company IT)", "phone_extraction", p1phone,
                source=f"{CO} IT", source_group="p1-personal-phone", acquired="2026-03-02 17:00", stage="S1", marking="personal",
                handling="A personal device imaged by the company without consent or authority. It is outside scope and should not be examined.",
                summary="An image of a personal phone left at work.", grade=("C", "4"))

    # ------------------------------------------------------------------ STAGE 2: files and devices
    def listing(owner, ws, extra):
        rows = []
        for name, size in kw_files:
            rows.append([f"\\\\fs01\\projects\\KITTIWAKE\\{name} (mapped P:)", str(size), "2025-10-01T09:00:00Z", MOD_UPDATE, "2026-02-10T10:00:00Z", "no", ""])
        for i in range(60):
            rows.append([f"C:\\Users\\{owner}\\Documents\\misc-{i:03d}.docx", str(g.randint(20, 900) * 1024), iso(t("2025-06-01 09:00") + timedelta(days=g.randint(0, 250))), iso(t("2025-12-01 09:00") + timedelta(days=g.randint(0, 80))), iso(t("2026-01-01 09:00") + timedelta(days=g.randint(0, 55))), "no", ""])
        rows.extend(extra)
        return rows
    lcols = ["path", "size", "created", "modified", "accessed", "deleted", "note"]
    ws07_extra = [[f"E:\\KW_copy\\{n}", str(s), ts("2026-02-19 18:42"), MOD_UPDATE, ts("2026-02-19 18:42"), "no", f"Jump list entry: removable volume serial {SERIAL}"] for n, s in kw_files[:12]]
    ws07_extra += [[f"E:\\KW_test\\{n}", str(s), ts("2026-01-28 17:55"), MOD_UPDATE.replace("2026-02-12T02:14:00Z", "2025-10-01T09:00:00Z"), ts("2026-01-28 17:55"), "no", f"Jump list entry: removable volume serial {SERIAL}"] for n, s in test_files]
    ws07_extra += [[f"C:\\Users\\{U1}\\AppData\\Recent\\KW_copy.lnk", "1024", ts("2026-02-19 18:51"), ts("2026-02-19 18:51"), ts("2026-02-19 18:51"), "no", "Shortcut to E:\\KW_copy (214 items)"]]
    c.table("EV-014", "WS-ENG-07 file system listing", "file_listing", lcols, listing(U1, "WS-ENG-07", ws07_extra),
            table={"time_column": "accessed"}, source=f"Forensic image of WS-ENG-07", source_group="ws07-image", acquired="2026-03-02 15:00", stage="S2",
            acquired_by=P4, summary=f"Files and shortcuts on {P1}'s workstation, with created, modified and accessed times.", grade=("A", "2"))
    ws04_full = []
    for name, size in kw_files:
        ws04_full.append([f"\\\\fs01\\projects\\KITTIWAKE\\{name} (mapped P:)", str(size), "2025-10-01T09:00:00Z", MOD_UPDATE, ts("2026-02-24 21:13"), "no", "Accessed by svc-cadsync session"])
    for i in range(50):
        ws04_full.append([f"C:\\Users\\{U2}\\Documents\\notes-{i:03d}.txt", str(g.randint(1, 90) * 1024), iso(t("2025-08-01 09:00") + timedelta(days=g.randint(0, 200))), iso(t("2026-01-10 09:00") + timedelta(days=g.randint(0, 40))), iso(t("2026-02-01 09:00") + timedelta(days=g.randint(0, 20))), "no", ""])
    ws04_full.append([f"C:\\Users\\{U2}\\Documents\\CV_{sur(P2)}_2026.pdf", "184320", ts("2026-02-19 20:30"), ts("2026-02-20 09:55"), ts("2026-02-20 10:04"), "no", ""])
    c.table("EV-015", "WS-ENG-04 file system listing (re-acquired, verified)", "file_listing", lcols, ws04_full,
            table={"time_column": "accessed"}, source="Re-acquired by the external examiner", source_group="ws04-image", acquired="2026-03-09 15:00",
            acquired_by="External examiner", stage="S2", summary=f"A verified re-export of the listing from {P2}'s workstation.", grade=("A", "2"))
    lt_rows = []
    for n, s in kw_files:
        lt_rows.append([f"C:\\Users\\{U1}\\Documents\\KW_copy\\{n}", str(s), ts("2026-02-20 08:16"), MOD_UPDATE, ts("2026-02-20 08:16"), "yes", "Deleted entry recovered from the file table"])
    for i in range(40):
        lt_rows.append([f"C:\\Users\\{U1}\\Documents\\personal-{i:02d}.pdf", str(g.randint(50, 800) * 1024), iso(t("2025-03-01 09:00") + timedelta(days=g.randint(0, 300))), iso(t("2025-09-01 09:00") + timedelta(days=g.randint(0, 100))), iso(t("2026-01-01 09:00") + timedelta(days=g.randint(0, 40))), "no", ""])
    lt_rows.append([f"C:\\$Recycle.Bin\\KW_copy (folder)", "0", ts("2026-02-20 08:16"), ts("2026-02-26 22:14"), ts("2026-02-26 22:14"), "yes", "Folder deleted 2026-02-26 22:14; recycle bin emptied 22:15"])
    c.table("EV-016", "LT-ENG-07 file system listing, including deleted entries", "file_listing", lcols, lt_rows,
            table={"time_column": "modified"}, source="Forensic image of LT-ENG-07 (returned 27 Feb)", source_group="lt07-image",
            acquired="2026-03-02 16:00", acquired_by=P4, stage="S2", summary=f"Files on {P1}'s laptop, including recovered deleted entries.", grade=("A", "2"))
    usb_cols = ["device_serial", "vendor", "first_connected", "last_connected", "last_removed", "volume_label"]
    c.table("EV-017", "WS-ENG-07 USB device history", "usb_history", usb_cols,
            [[SERIAL, "Kestrel Storage 64GB", ts("2026-01-28 17:52"), ts("2026-02-19 18:40"), ts("2026-02-19 18:52"), "KS64"],
             ["KB-MOUSE-0091", "Generic USB mouse", "2024-05-02T09:00:00Z", ts("2026-02-27 09:00"), "", ""],
             ["CORP-ENC-1182", "Company encrypted drive", "2025-04-11T10:00:00Z", "2025-12-03T14:00:00Z", "2025-12-03T14:40:00Z", "ASHGROVE-ENC"]],
            table={"time_column": "last_connected", "entity_columns": ["device_serial"]}, source="Forensic image of WS-ENG-07 (registry)",
            source_group="ws07-image", acquired="2026-03-02 15:00", stage="S2", summary="Every USB device ever connected to WS-ENG-07.", grade=("A", "2"))
    c.table("EV-018", "LT-ENG-07 USB device history", "usb_history", usb_cols,
            [[SERIAL, "Kestrel Storage 64GB", ts("2026-02-20 08:15"), ts("2026-02-20 08:15"), ts("2026-02-20 08:31"), "KS64"],
             ["PHONE-CHG-22", "Phone (charging only)", "2025-09-12T07:00:00Z", ts("2026-02-25 07:30"), ts("2026-02-25 08:30"), ""]],
            table={"time_column": "last_connected", "entity_columns": ["device_serial"]}, source="Forensic image of LT-ENG-07 (registry)",
            source_group="lt07-image", acquired="2026-03-02 16:00", stage="S2", summary="Every USB device connected to the laptop.", grade=("A", "2"))
    c.table("EV-019", "WS-ENG-04 USB device history", "usb_history", usb_cols,
            [["KB-MOUSE-0077", "Generic USB mouse", "2024-05-02T09:00:00Z", ts("2026-02-27 09:00"), "", ""]],
            source="Forensic image of WS-ENG-04 (registry)", source_group="ws04-image", acquired="2026-03-09 15:00", stage="S2",
            summary="USB devices on WS-ENG-04. Only a mouse.", grade=("A", "2"))
    chg = [["CHG-0398", "2026-02-03 22:00", U4, "Firewall rule review", "No user impact"],
           ["CHG-0412", "2026-02-12 02:00", U3, "CAD suite 9.2 patch deployed to FS01 and all engineering workstations", "The patch rewrites file headers: modified times on all CAD project files will update to the patch time"],
           ["CHG-0420", "2026-02-18 21:30", "adm-" + U3, "Monthly admin account review and patching of FS01", "Routine"],
           ["CHG-0431", "2026-03-03 23:10", U4, "Re-exported WS-ENG-04 listing", "First export file failed to verify (write error). New export taken; examiner to re-acquire and verify."],
           ["CHG-0433", "2026-03-04 09:00", U4, "Disabled svc-cadsync and reset its password", "Containment"]]
    c.table("EV-020", "IT change log", "it_change_log", ["change", "time_utc", "by", "summary", "impact"], chg,
            table={"time_column": "time_utc"}, source=f"{CO} IT", source_group="it-change", acquired="2026-03-04 12:00", stage="S2",
            summary="Planned IT changes and what they affected.", grade=("A", "2"))
    for eid, ws, owner in [("EV-021", "WS-ENG-02", g.name()), ("EV-022", "WS-ENG-05", g.name()), ("EV-023", "WS-ADMIN-01", P3)]:
        rows = [[f"C:\\Users\\{u(owner)}\\Documents\\file-{i:03d}.docx", str(g.randint(20, 900) * 1024), iso(t("2025-06-01 09:00") + timedelta(days=g.randint(0, 250))),
                 MOD_UPDATE if i % 5 == 0 else iso(t("2025-12-01 09:00") + timedelta(days=g.randint(0, 70))), iso(t("2026-02-01 09:00") + timedelta(days=g.randint(0, 25))), "no", ""] for i in range(80)]
        c.table(eid, f"{ws} file system listing", "file_listing", lcols, rows, table={"time_column": "accessed"}, source=f"Forensic image of {ws}",
                source_group="other-images", acquired="2026-03-03 10:00", acquired_by=P4, stage="S2", noise=True, summary=f"Files on {ws}.", grade=("A", "2"))
    srv_personal = [[f"\\\\fs01\\projects\\_design-admin\\{sur(P5)}_photos\\IMG_{i:04d}.jpg", str(g.randint(2000, 6000) * 1024), iso(t("2025-04-01 10:00") + timedelta(days=i)), iso(t("2025-04-01 10:00") + timedelta(days=i)), iso(t("2025-12-01 10:00")), "no", "Personal photo backup"] for i in range(30)]
    srv_personal += [[f"\\\\fs01\\projects\\KITTIWAKE\\{n}", str(s), "2025-10-01T09:00:00Z", MOD_UPDATE, ts("2026-02-24 21:13"), "no", ""] for n, s in kw_files[:20]]
    c.table("EV-024", "FS01 projects share listing (extract)", "file_listing", lcols, srv_personal, table={"time_column": "modified"},
            source="Forensic export of FS01", source_group="fs01-export", acquired="2026-03-03 11:00", acquired_by=P4, stage="S2",
            summary="Part of the file server's projects share.", grade=("A", "2"))

    # ------------------------------------------------------------------ STAGE 3: accounts, logs and email
    srv = []
    for i, (n, s) in enumerate(kw_files):
        srv.append([iso(t("2026-02-19 18:41") + timedelta(seconds=i * 2.6)), U1, "10.1.4.27", f"\\projects\\KITTIWAKE\\{n}", "read"])
    for i, (n, s) in enumerate(kw_files):
        srv.append([iso(t("2026-02-24 21:12") + timedelta(seconds=i * 0.8)), "svc-cadsync", "10.1.4.24", f"\\projects\\KITTIWAKE\\{n}", "read (cloud sync)"])
    for i in range(160):
        when = t("2026-02-01 08:00") + timedelta(minutes=g.randint(0, 27 * 24 * 60))
        who = g.choice([U1, U2, U5, u(W4), "svc-backup", "adm-" + U3])
        srv.append([iso(when), who, g.choice(["10.1.4.27", "10.1.4.24", "10.1.4.21", "10.1.4.30", "10.1.2.5"]), f"\\projects\\{g.choice(['KITTIWAKE', 'GANNET', 'admin', 'templates'])}\\file-{g.randint(1, 400)}", g.choice(["read", "read", "write"])])
    for i in range(18):
        srv.append([iso(t("2026-02-18 21:30") + timedelta(minutes=i * 3)), "adm-" + U3, "10.1.2.5", f"\\admin\\patch-log-{i}", "write"])
    srv.sort()
    c.table("EV-025", "FS01 file server access log, 1 to 28 February", "server_log", ["time_utc", "user", "source_ip", "path", "action"], srv,
            table={"time_column": "time_utc", "entity_columns": ["user", "source_ip"], "description_columns": ["user", "action"]},
            source="FS01 audit log export", source_group="fs01-log", acquired="2026-03-03 12:00", acquired_by=P4, stage="S3",
            metadata={"Retention": "28 days. Entries before 1 February 2026 have rolled over and no longer exist in this log.", "Time zone": "UTC"},
            summary="Every file access on the server in February.", grade=("A", "1"))
    cloud = [[ts("2026-02-24 21:10"), "svc-cadsync", "10.1.4.24 via 198.51.100.14", "sign in", "Client: desktop sync tool"],
             [ts("2026-02-24 21:15"), "svc-cadsync", "10.1.4.24 via 198.51.100.14", "share link created", "/projects/KITTIWAKE, anyone with the link, expires 7 days"],
             [ts("2026-02-25 08:02"), "anonymous (link)", EXT_IP, "share link opened", "214 files downloaded as zip"],
             [ts("2026-02-25 08:03"), "system", "", "alert", "External access to Confidential folder. Alert emailed to it-alerts mailbox."],
             [ts("2026-03-04 09:00"), U4, "198.51.100.14", "share link revoked", ""]]
    for i in range(40):
        cloud.append([iso(t("2026-02-01 03:00") + timedelta(hours=g.randint(0, 27 * 24))), "svc-cadsync", "10.1.2.20 via 198.51.100.14", "sync", "Scheduled CAD sync"])
    for d in ["2026-02-05 11:00", "2026-02-17 15:30"]:
        cloud.append([ts(d), U5, "198.51.100.14", "share link created", "/projects/GANNET/release, manufacturer link approved by head of design"])
    cloud.sort()
    c.table("EV-026", "Cloud storage activity log", "cloud_log", ["time_utc", "account", "ip", "event", "detail"], cloud,
            table={"time_column": "time_utc", "entity_columns": ["account", "ip"], "description_columns": ["event", "detail"]},
            source="Cloud provider admin console export", source_group="cloud-log", acquired="2026-03-03 12:30", acquired_by=P4, stage="S3",
            summary="Sign-ins, syncs and share links on the company cloud account.", grade=("A", "1"))
    c.table("EV-027", "Password audit report", "spreadsheet", ["account", "password_last_set", "shares_hash_with", "note"],
            [["svc-cadsync", "2025-06-30", U1, f"Created by {U1}. Same password hash as {U1}'s own account at audit time."],
             [U1, "2025-06-30", "svc-cadsync", ""], [U2, "2026-01-15", "", ""], ["adm-" + U3, "2026-02-01", "", "Admin account, MFA enforced"],
             [U5, "2025-11-20", "", ""]], source=f"{CO} IT password audit tool", source_group="pw-audit", acquired="2026-03-04 10:00", stage="S3",
            summary="Accounts that share a password.", grade=("A", "1"))
    c.document("EV-028", f"Statement: {P4} (IT manager)", "statement", f"""
# Statement

**Name:** {P4}
**Role:** IT manager

svc-cadsync was set up by {P1} last summer to sync CAD files to the cloud. I asked them to use a strong unique password. I now know it was the same as their own password. {P1} told me in January that they had given the password to {P2} "so jobs could keep running" while {first(P1)} was on leave.

The 12 February patch rewrote the headers of every CAD file, so their modified times all changed to that night. That is normal for that update.

I re-exported the WS-ENG-04 listing on 3 March because the first export had a write error. The first file should not be relied on. I noticed the cloud alert on 2 March. It had gone to a shared mailbox nobody checks.
""", source="Witness", source_group="statement-p4", acquired="2026-03-05 10:00", stage="S3", grade=("B", "2"),
        summary="The IT manager on the service account, the patch and the re-export.")
    c.email("EV-029", f"Email: {P1} to a personal address", headers=[
        ("From", f"<{U1}@{DOM}>"), ("To", f"<{first(P1).lower()}.{sur(P1).lower()}@example.net>"), ("Date", "Wed, 18 Feb 2026 16:20:11 +0000"),
        ("Subject", "spec summary"), ("Message-ID", f"<m1@{DOM}>"), ("X-Attachment", "Kittiwake_spec_summary.pdf (212 KB)")],
        body="(no text)", source=f"{CO} mail server export", source_group="mail", acquired="2026-03-03 13:00", stage="S3",
        summary="A work email to a personal address with an attachment.", grade=("A", "2"))
    c.email("EV-030", f"Email: {P2} to a recruiter at {EXT}", headers=[
        ("From", f"<{U2}@{DOM}>"), ("To", f"<{REC.split()[0].lower()}@harrowgate-marine.example.net>"), ("Date", "Fri, 20 Feb 2026 10:05:40 +0000"),
        ("Subject", "Re: our chat"), ("Message-ID", f"<m2@{DOM}>"), ("X-Attachment", f"CV_{sur(P2)}_2026.pdf (180 KB)")],
        body=f"Hi {first(REC)},\n\nThanks for the call yesterday. CV attached as promised. Happy to help with anything you need to get the ball rolling.\n\n{first(P2)}",
        source=f"{CO} mail server export", source_group="mail", acquired="2026-03-03 13:00", stage="S3", summary=f"{P2} writes to a recruiter at the competitor.", grade=("A", "2"))
    c.email("EV-031", "Email: solicitor's advice on a pre-action letter (privileged)", headers=[
        ("From", "<partner@moorend-law.example.com>"), ("To", f"<{u(W1)}@{DOM}>"), ("Date", "Thu, 05 Mar 2026 18:00:00 +0000"),
        ("Subject", "PRIVILEGED: draft letter to Harrowgate"), ("Message-ID", "<l1@moorend-law.example.com>")],
        body="This email contains legal advice and is privileged.\n\n(The remainder of the email gives the solicitor's view on legal action.)",
        source=f"{CO} mail server export", source_group="mail-legal", acquired="2026-03-06 09:00", stage="S3", marking="privileged",
        handling="Legally privileged. Do not read further, quote or rely on it. Set it aside and tell the case lead.", summary="Legal advice. Privileged.", grade=("B", "3"))
    c.email("EV-032", "Email: cloud provider alert (unread)", headers=[
        ("From", "<alerts@cloudstore.example.net>"), ("To", f"<it-alerts@{DOM}>"), ("Date", "Wed, 25 Feb 2026 08:03:10 +0000"),
        ("Subject", "External access to a Confidential folder"), ("Message-ID", "<a1@cloudstore.example.net>")],
        body=f"A share link to /projects/KITTIWAKE was opened from {EXT_IP} at 08:02 UTC. 214 files were downloaded.",
        source=f"{CO} mail server export", source_group="cloud-alert", acquired="2026-03-03 13:00", stage="S3", summary="The provider's alert, which nobody read.", grade=("A", "1"))
    vpn = [[iso(t("2026-02-01 18:00") + timedelta(hours=g.randint(0, 27 * 24))), g.choice([U5, U4, u(W1)]), g.ip(), "connected"] for _ in range(30)]
    vpn += [[ts("2026-02-28 10:00"), U1, g.ip(), "denied (account disabled)"]]
    vpn.sort()
    c.table("EV-033", "VPN log, February", "server_log", ["time_utc", "user", "source_ip", "result"], vpn, table={"time_column": "time_utc", "entity_columns": ["user"]},
            source="VPN gateway", source_group="vpn", acquired="2026-03-03 12:00", stage="S3", summary="Remote connections.", grade=("A", "1"))
    for eid, title in [("EV-034", "Email: canteen menu"), ("EV-035", "Email: fire drill notice"), ("EV-036", "Email: GANNET release to manufacturer")]:
        c.email(eid, title, headers=[("From", f"<{u(P6)}@{DOM}>"), ("To", f"<all@{DOM}>"), ("Date", "Mon, 16 Feb 2026 09:00:00 +0000"), ("Subject", title.replace("Email: ", ""))],
                body="Routine message.", source=f"{CO} mail server export", source_group="mail", acquired="2026-03-03 13:00", stage="S3", noise=True, summary=title, grade=("A", "2"))
    c.site("linkline", "Linkline", "linkline.test", "business", "#2c4f8a", "Work profiles and businesses")
    c.site("ipreg", "Network Registry Lookup", "netreg.test", "business", "#444444", "Who holds an IP address block")
    c.site("harrowgate", EXT, "harrowgate-marine.test", "business", "#0e4d64", "Subsea engineering")
    c.page(id="PG-001", site="linkline", url=f"https://linkline.test/in/{first(P1).lower()}-{sur(P1).lower()}", kind="profile", title=f"{P1} - Linkline", display_name=P1,
           bio=f"Pressure housing designer. Starting a new role at {EXT} in March!", fields={"Experience": f"{CO} 2020 to 2026; {EXT} from March 2026"},
           search_terms=[P1, first(P1), sur(P1)])
    c.page(id="PG-002", site="ipreg", url=f"https://netreg.test/ip/{EXT_IP}", kind="page", title=f"Lookup: {EXT_IP}",
           fields={"Block": "203.0.113.80/28", "Holder": EXT, "Address": "Harrowgate Business Park", "Type": "Static business connection"},
           body="This record shows who holds the address block. It does not show which person used it.", search_terms=[EXT_IP, "203.0.113", "harrowgate"])
    c.page(id="PG-003", site="harrowgate", url="https://harrowgate-marine.test/news", kind="page", title=f"{EXT} news",
           body=f"We are delighted to welcome senior designer {P1} to our housings team in March, as we accelerate our new compact sensor housing range.",
           search_terms=["harrowgate", "news", sur(P1)])
    c.page(id="PG-004", site="linkline", url=f"https://linkline.test/in/{first(P2).lower()}-{sur(P2).lower()}", kind="profile", title=f"{P2} - Linkline", display_name=P2,
           bio="Design engineer. Open to new opportunities.", fields={"Experience": f"{CO} 2022 to now"}, search_terms=[P2, first(P2), sur(P2)])

    # Requests in stage 3
    c.table("EV-037", "Cloud provider: share link access details (24 to 25 February)", "cloud_log", ["time_utc", "event", "ip", "user_agent", "detail"],
            [[ts("2026-02-24 21:15"), "link created", "198.51.100.14", "Desktop sync tool 4.2 (Windows) on host WS-ENG-04", "by svc-cadsync"],
             [ts("2026-02-25 08:02"), "link opened", EXT_IP, "Browser on Windows, host name HMS-DES-114", "zip download, 214 files, 1.1 GB"],
             [ts("2026-02-25 08:09"), "link opened", EXT_IP, "Browser on Windows, host name HMS-DES-114", "preview only"]],
            table={"time_column": "time_utc", "entity_columns": ["ip"]}, source="Cloud provider, response to data request", source_group="cloud-provider",
            acquired="2026-03-10 14:00", summary="Who opened the share link, with host names.", grade=("A", "1"))
    arch = [[ts("2026-01-28 17:53"), U1, "10.1.4.27", f"\\projects\\KITTIWAKE\\{n}", "read"] for n, _ in test_files]
    arch += [[iso(t("2026-01-26 08:00") + timedelta(minutes=g.randint(0, 5 * 24 * 60))), g.choice([U2, U5, "svc-backup"]), "10.1.4.2" + str(g.randint(1, 9)), f"\\projects\\GANNET\\file-{g.randint(1, 300)}", "read"] for _ in range(40)]
    arch.sort()
    c.table("EV-038", "FS01 access log restored from backup, 26 to 31 January", "server_log", ["time_utc", "user", "source_ip", "path", "action"], arch,
            table={"time_column": "time_utc", "entity_columns": ["user"]}, source="Restored from weekly backup on request", source_group="fs01-backup",
            acquired="2026-03-10 16:00", summary="Server access for one week in January, restored from backup.", grade=("A", "1"))

    # ------------------------------------------------------------------ STAGE 4: physical presence
    door = []
    for d in range(1, 28):
        day = t("2026-02-01 00:00") + timedelta(days=d)
        if day.weekday() < 5:
            for user, card in [(P1, "C-1107"), (P2, "C-1104"), (P5, "C-1101"), (W4, "C-1120"), (P6, "C-1130")]:
                if user == P1 and day.day == 27:
                    pass
                door.append([iso(day.replace(hour=8) + timedelta(minutes=g.randint(0, 50))), card, user, "Main entrance", "in"])
                door.append([iso(day.replace(hour=17) + timedelta(minutes=g.randint(0, 45))), card, user, "Main entrance", "out"])
    door += [[ts("2026-02-19 18:30"), "C-1107", P1, "Main entrance", "in"], [ts("2026-02-19 18:33"), "C-1107", P1, "Design office", "in"], [ts("2026-02-19 19:05"), "C-1107", P1, "Main entrance", "out"],
             [ts("2026-02-24 20:58"), "C-1104", P2, "Main entrance", "in"], [ts("2026-02-24 21:00"), "C-1104", P2, "CAD room", "in"], [ts("2026-02-24 21:38"), "C-1104", P2, "Main entrance", "out"],
             [ts("2026-02-24 19:30"), "C-1120", W4, "Lab", "in"], [ts("2026-02-24 21:50"), "C-1120", W4, "Main entrance", "out"],
             [ts("2026-02-18 21:25"), "C-1300", P3, "Server room", "in"], [ts("2026-02-18 22:30"), "C-1300", P3, "Main entrance", "out"],
             [ts("2026-01-28 17:20"), "C-1107", P1, "Design office", "in"]]
    door.sort()
    c.table("EV-039", "Door access log, February", "door_access", ["time_utc", "card", "holder", "door", "direction"], door,
            table={"time_column": "time_utc", "description_columns": ["holder", "door", "direction"]}, source="Door access system", source_group="door",
            acquired="2026-03-03 14:00", acquired_by=P6, stage="S4", summary="Every badge swipe in February.", grade=("A", "1"))
    anpr = []
    for d in range(1, 28):
        day = t("2026-02-01 00:00") + timedelta(days=d)
        if day.weekday() < 5:
            for plate in [car1, car2, car3]:
                anpr.append([iso(day.replace(hour=8) + timedelta(minutes=g.randint(0, 40))), "Site entrance", plate, "in"])
                anpr.append([iso(day.replace(hour=17) + timedelta(minutes=g.randint(5, 50))), "Site entrance", plate, "out"])
    anpr += [[ts("2026-02-19 18:27"), "Site entrance", car1, "in"], [ts("2026-02-19 19:08"), "Site entrance", car1, "out"],
             [ts("2026-02-24 20:55"), "Site entrance", car2, "in"], [ts("2026-02-24 21:45"), "Site entrance", car2, "out"]]
    anpr.sort()
    c.table("EV-040", "Site entrance ANPR, February", "anpr", ["time_utc", "camera", "plate", "direction"], anpr,
            table={"time_column": "time_utc", "entity_columns": ["plate"]}, source="Site ANPR camera", source_group="site-anpr",
            acquired="2026-03-03 14:00", acquired_by=P6, stage="S4", summary="Vehicles in and out of the site.", grade=("A", "1"))
    c.table("EV-041", "Staff parking permits", "spreadsheet", ["plate", "holder", "permit"], [[car1, P1, "P-07"], [car2, P2, "P-04"], [car3, P5, "P-01"]],
            table={"entity_columns": ["plate"]}, source=f"{CO} facilities", source_group="permits", acquired="2026-03-03 14:00", stage="S4",
            summary="Which car belongs to whom.", grade=("A", "1"))
    cams = {"CAM-LOBBY": 7, "CAM-CAD": 0, "CAM-PARK": 0, "CAM-SERVER": 0}
    camrows = {k: [] for k in cams}
    def cam(name, when, text):
        camrows[name].append([iso(t(when) + timedelta(minutes=cams[name])), text])
    cam("CAM-LOBBY", "2026-02-19 18:30", "Person enters, tall, beard, dark jacket, carrying rucksack")
    cam("CAM-LOBBY", "2026-02-19 19:05", "Same person leaves, rucksack")
    cam("CAM-LOBBY", "2026-02-24 20:58", "Person enters, tall, beard, grey hoodie")
    cam("CAM-LOBBY", "2026-02-24 21:38", "Same person leaves")
    cam("CAM-LOBBY", "2026-02-24 21:50", "Lab technician leaves")
    cam("CAM-CAD", "2026-02-24 21:01", "Person in grey hoodie sits at desk 4")
    cam("CAM-CAD", "2026-02-24 21:36", "Person in grey hoodie leaves desk 4")
    cam("CAM-PARK", "2026-02-19 18:27", f"Car arrives, registration partly visible {car1[:3]}…")
    cam("CAM-PARK", "2026-02-24 20:55", f"Car arrives, registration partly visible {car2[:3]}…")
    cam("CAM-SERVER", "2026-02-18 21:26", "Contractor enters server room with laptop")
    for k in cams:
        for _ in range(25):
            camrows[k].append([iso(t("2026-02-02 07:00") + timedelta(minutes=g.randint(0, 25 * 24 * 60))), g.choice(["Motion", "Cleaner", "Delivery", "Staff passing"])])
        camrows[k].sort()
    c.table("EV-042", "Camera log: CAM-LOBBY", "camera_log", ["device_time", "event"], camrows["CAM-LOBBY"], table={"time_column": "device_time", "description_columns": ["event"]},
            source="CCTV system", source_group="cctv", acquired="2026-03-03 14:30", acquired_by=P6, stage="S4", clock_offset_minutes=7,
            clock_note="Checked against network time on 3 March: the lobby recorder runs 7 minutes fast.", summary="Lobby camera event log.", grade=("A", "2"))
    for eid, k in [("EV-043", "CAM-CAD"), ("EV-044", "CAM-PARK"), ("EV-045", "CAM-SERVER")]:
        c.table(eid, f"Camera log: {k}", "camera_log", ["device_time", "event"], camrows[k], table={"time_column": "device_time", "description_columns": ["event"]},
                source="CCTV system", source_group="cctv", acquired="2026-03-03 14:30", acquired_by=P6, stage="S4", summary=f"{k} event log.", grade=("A", "2"),
                metadata={"Clock check": "Within 10 seconds of network time"})
    c.document("EV-046", f"Statement: {W3} (night security guard)", "statement", f"""
# Statement

**Name:** {W3}
**Role:** Night security, agency staff

On Tuesday 24 February I was doing my rounds at about half nine. I saw one of the engineers in the corridor by the CAD room. Tall, with a beard. I think it was {P1}, the one who was leaving. I've seen them working late before. I didn't speak to them.

I only work nights here twice a week, so I don't know all the staff well.
""", source="Witness", source_group="witness-w3", acquired="2026-03-06 21:00", stage="S4", grade=("C", "3"),
        summary="The guard thinks he saw P1 on the evening of 24 February.")
    c.document("EV-047", f"Statement: {P3} (IT contractor)", "statement", f"""
# Statement

**Name:** {P3}

I do monthly patching and account reviews under the admin account adm-{U3}, always booked in the change log. On 18 February I was in the server room from about half nine to half ten at night doing that. I don't use design files and I have never used svc-cadsync.
""", source="Witness", source_group="statement-p3", acquired="2026-03-06 10:00", stage="S4", grade=("B", "2"), summary="The contractor explains their late admin work.")
    c.table("EV-048", "Visitor book, February", "spreadsheet", ["date", "visitor", "host", "in", "out"],
            [[(t("2026-02-02 00:00") + timedelta(days=g.randint(0, 24))).strftime("%Y-%m-%d"), g.name(), g.choice([P5, P6, W1]), "10:00", "11:30"] for _ in range(12)],
            source=f"{CO} reception", source_group="visitors", acquired="2026-03-03 14:00", stage="S4", noise=True, summary="Visitors signed in.", grade=("B", "2"))

    # ------------------------------------------------------------------ STAGE 5: communications
    def cdr(owner_num, rows):
        return [[w, owner_num, o, cell, ev, str(d)] for w, o, cell, ev, d in rows]
    cols = ["time_utc", "number", "other_party", "cell", "event", "duration_s"]
    p1rows = [("2026-02-03 12:10", m["rec"], "KB-MOOR", "voice out", 1420), ("2026-02-19 18:20", "", "KB-MOOR", "data", 0), ("2026-02-19 19:30", "", "KB-HARBOUR", "data", 0),
              ("2026-02-24 21:00", "", "KB-HARBOUR", "data", 0), ("2026-02-24 21:40", g.mobile(), "KB-HARBOUR", "voice in", 300)]
    p1rows += [(iso(t("2026-02-02 08:00") + timedelta(hours=g.randint(0, 600)))[:16].replace("T", " "), g.mobile(), g.choice(["KB-MOOR", "KB-HARBOUR"]), "voice out", g.randint(20, 400)) for _ in range(30)]
    c.table("EV-049", f"Call records: {m['p1']} ({P1}'s company mobile)", "cdr", cols, sorted(cdr(m["p1"], p1rows)),
            table={"time_column": "time_utc", "entity_columns": ["number", "other_party"]}, source="Company mobile contract records", source_group="cdr-p1",
            acquired="2026-03-05 12:00", stage="S5", summary=f"Calls on {P1}'s company phone.", grade=("A", "1"))
    p2rows = [("2026-02-19 16:30", m["rec"], "KB-MOOR", "voice in", 1260), ("2026-02-24 21:19", m["rec"], "KB-MOOR", "message out (data)", 0),
              ("2026-02-24 21:25", m["rec"], "KB-MOOR", "voice out", 210), ("2026-02-25 08:10", m["rec"], "KB-BRACKEN", "voice out", 95)]
    p2rows += [(iso(t("2026-02-02 08:00") + timedelta(hours=g.randint(0, 600)))[:16].replace("T", " "), g.mobile(), g.choice(["KB-MOOR", "KB-BRACKEN"]), "voice out", g.randint(20, 400)) for _ in range(30)]
    c.table("EV-050", f"Call records: {m['p2']} ({P2}'s company mobile)", "cdr", cols, sorted(cdr(m["p2"], p2rows)),
            table={"time_column": "time_utc", "entity_columns": ["number", "other_party"]}, source="Company mobile contract records", source_group="cdr-p2",
            acquired="2026-03-05 12:00", stage="S5", summary=f"Calls on {P2}'s company phone.", grade=("A", "1"))
    p5rows = [(iso(t("2026-02-02 08:00") + timedelta(hours=g.randint(0, 600)))[:16].replace("T", " "), g.mobile(), "KB-MOOR", "voice out", g.randint(20, 400)) for _ in range(25)]
    c.table("EV-051", f"Call records: {m['p5']} ({P5}'s company mobile)", "cdr", cols, sorted(cdr(m["p5"], p5rows)),
            table={"time_column": "time_utc", "entity_columns": ["number", "other_party"]}, source="Company mobile contract records", source_group="cdr-p5",
            acquired="2026-03-05 12:00", stage="S5", noise=True, summary=f"Calls on {P5}'s company phone.", grade=("A", "1"))
    p2phone = {"device": {"Owner": f"{P2} (company phone)", "Extraction": "Logical extraction, company-owned device, 5 March 2026"},
               "contacts": [{"name": first(REC) + " (Harrowgate)", "number": m["rec"]}, {"name": P1, "number": m["p1"]}],
               "messages": [{"app": "Natter", "thread": first(REC), "from": first(REC), "to": "me", "time": "2026-02-19T17:00:00Z", "text": "Great chatting. If you can show us what you've been working on, it'll really help your case 😉"},
                            {"app": "Natter", "thread": first(REC), "from": "me", "to": first(REC), "time": "2026-02-24T21:19:00Z", "text": "Link's live. Let me know it opens. Expires in a week."},
                            {"app": "Natter", "thread": first(REC), "from": first(REC), "to": "me", "time": "2026-02-25T08:06:00Z", "text": "Got it all. Speak soon."},
                            {"app": "Natter", "thread": P1, "from": P1, "to": "me", "time": "2026-02-27T17:30:00Z", "text": "Last day! Don't let them grind you down. Pint soon."},
                            {"app": "Natter", "thread": P1, "from": "me", "to": P1, "time": "2026-02-27T17:35:00Z", "text": "Good luck at H. Might see you there sooner than you think"}],
               "calls": [{"time": "2026-02-24T21:25:00Z", "number": m["rec"], "direction": "outgoing", "duration_s": 210, "name": first(REC)}]}
    c.json_item("EV-052", f"Phone extraction: {P2}'s company phone", "phone_extraction", p2phone, source="External examiner", source_group="phone-p2",
                acquired="2026-03-05 15:00", stage="S5", summary=f"Messages and calls on {P2}'s company phone.", grade=("A", "1"))
    c.document("EV-053", f"HR record extract: {P2}", "hr_document", f"""
# HR record extract

- November 2025: applied for senior designer role. Not appointed ({P1} kept the senior role; external hire planned after {first(P1)}'s resignation).
- December 2025: informal grievance about the promotion process. Resolved without action.
- No disciplinary history.
""", source=f"{CO} HR", source_group="hr", acquired="2026-03-06 11:00", stage="S5", marking="restricted",
        handling="HR material. Use only what is relevant to the tasking.", summary=f"Relevant HR history for {P2}.", grade=("A", "2"))
    w4phone = {"device": {"Owner": f"{W4} (personal phone)", "Extraction": "Logical extraction with the owner's consent and specific authority"},
               "messages": [{"app": "Natter", "thread": "Partner", "from": "me", "to": "Partner", "time": "2026-02-24T21:07:00Z", "text": f"{first(P2)} is in the CAD room at 9pm on a Tuesday?! Never seen that before"},
                            {"app": "Natter", "thread": "Partner", "from": "Partner", "to": "me", "time": "2026-02-24T21:09:00Z", "text": "Maybe a deadline? Come home soon x"}]}
    c.json_item("EV-054", f"Phone extraction: {W4}'s personal phone (with authority)", "phone_extraction", w4phone, source=f"{W4}, consent and authority",
                source_group="phone-w4", acquired="2026-03-12 11:00", marking="personal", handling="Obtained with consent and specific authority. Use only the relevant message.",
                summary="A witness's message on the evening of 24 February.", grade=("A", "2"))
    c.document("EV-055", f"Statement: {W4} (lab technician)", "statement", f"""
# Statement

**Name:** {W4}

On Tuesday 24 February I worked late in the lab. Around nine I went upstairs and saw {P2} in the CAD room at desk 4. I thought it was odd because they never work late. I sent my partner a message about it at the time. I am willing for that message to be checked.
""", source="Witness", source_group="witness-w4", acquired="2026-03-06 12:00", stage="S5", grade=("B", "2"),
        summary=f"The lab technician saw {P2} in the CAD room on 24 February.")
    c.document("EV-056", f"Statement: {P5} (head of design)", "statement", f"""
# Statement

**Name:** {P5}

I sign off every manufacturer link. I did not approve any share of KITTIWAKE. The two links in February were for GANNET.

The photos on the server are my family pictures. I put them there when my laptop was failing. I know that is against policy.
""", source="Witness", source_group="statement-p5", acquired="2026-03-06 13:00", stage="S5", grade=("B", "2"), summary="The head of design on sign-off and the photos on the server.")

    # Pad stage 5 and 6 with routine material
    for i, title in enumerate(["Expenses claims, February", "Training records", "Canteen supplier invoice", "Fleet insurance note"], start=57):
        c.document(f"EV-0{i}", title, "document", f"# {title}\n\nRoutine record with nothing relevant to the enquiry.", source=CO, source_group=f"misc-{i}",
                   acquired="2026-03-06 09:00", stage="S5", noise=True, summary=title, grade=("B", "2"))
    # Routine material an examiner has to sift. Deliberate noise, about three items per relevant one in places.
    noise_specs = [("S1", "Supplier non-disclosure agreements list"), ("S1", "Insurance schedule"), ("S2", "Laptop loan register"), ("S2", "Software licence report"),
                   ("S2", "Antivirus scan summary"), ("S2", "GANNET project file register"), ("S2", "WS-ENG-01 file system listing (summary)"),
                   ("S2", "WS-ENG-03 file system listing (summary)"), ("S2", "WS-ENG-06 file system listing (summary)"), ("S2", "WS-ENG-08 file system listing (summary)"),
                   ("S3", "Backup job report, February"), ("S3", "Printer usage log"), ("S3", "Email: quarterly all-hands invite"), ("S3", "Email: car park resurfacing"),
                   ("S3", "Email: GANNET supplier query"), ("S3", "Email: IT newsletter"), ("S3", "Email: holiday request reminder"), ("S3", "Email: lab safety audit"),
                   ("S3", "Mail filter rules export"), ("S4", "Door access log, January (summary)"), ("S4", "Meeting room bookings"), ("S4", "Badge issue register"),
                   ("S4", "Cleaning rota"), ("S4", "Fire alarm test log"), ("S5", "Company phone contract summary"), ("S5", "Training attendance"),
                   ("S5", "Staff survey results"), ("S5", "Board minutes extract, January")]
    for n, (st, title) in enumerate(noise_specs, start=62):
        kind = "email" if title.startswith("Email:") else "document"
        if kind == "email":
            c.email(f"EV-0{n}", title, headers=[("From", f"<{u(P6)}@{DOM}>"), ("To", f"<all@{DOM}>"), ("Date", "Tue, 10 Feb 2026 09:30:00 +0000"), ("Subject", title[7:])],
                    body="Routine message. Nothing relevant to the enquiry.", source=f"{CO} mail server export", source_group="mail", acquired="2026-03-03 13:00",
                    stage=st, noise=True, summary=title, grade=("A", "2"))
        else:
            c.document(f"EV-0{n}", title, "document", f"# {title}\n\nRoutine record. Reviewed: nothing relevant to the KITTIWAKE files.",
                       source=CO, source_group=f"noise-{n}", acquired="2026-03-04 12:00", stage=st, noise=True, summary=title, grade=("B", "2"))

    c.document("EV-061", "Case lead note: preparing the attribution", "document", "# Note\n\nKeep three columns in mind: proved, likely, unknown. For each person, say which events they are linked to, how, and how strongly.",
               source="Case lead", source_group="case-lead", acquired="2026-03-12 09:00", stage="S6", noise=True, summary="A note on attribution.", grade=("A", "1"))

    # ------------------------------------------------------------------ requests
    c.request_type("RT-CLOUD", "data", "Cloud provider: share link access details", ["online_account"], "S3", True,
                   "Ask the cloud provider for details of who created and opened links on an account, for a defined period.")
    c.request_type("RT-BACKUP", "data", "IT: restore archived server logs for a period", ["device"], "S3", True,
                   "Ask IT to restore rolled-over server logs from backup for a short, defined period.")
    c.request_type("RT-WPHONE", "authority", "Authority: examine a witness's personal phone (with consent)", ["person"], "S5", False,
                   "Ask for authority to examine a witness's personal phone, with their consent, for a specific purpose.")
    c.request_rule("RR-1", "RT-CLOUD", ["ENT-SVC"], "The cloud provider has supplied the share link access details.", evidence=["EV-037"],
                   must_cover=["2026-02-24", "2026-02-25"], max_days=14,
                   justification=[["share", "link", "kittiwake", "folder"], ["access", "opened", "who", "ip", "download"]], min_groups=2,
                   refuse_broad="Refused. Ask for one account over the days the link existed.",
                   refuse_dates="Refused as framed. Cover the day the link was created and the day it was opened.")
    c.request_rule("RR-2", "RT-BACKUP", ["ENT-WS07"], "IT has restored the file server log for the period requested, filtered to accesses from WS-ENG-07 and the projects share.",
                   evidence=["EV-038"], must_cover=["2026-01-28", "2026-01-28"], max_days=10,
                   justification=[["usb", "test", "january", "28", "earlier"], ["log", "access", "roll", "server", "kittiwake"]], min_groups=2,
                   refuse_broad="Refused. Restoring backups is costly. Keep it to a week at most.",
                   refuse_dates="Refused as framed. The dates do not cover the earlier USB connection.")
    c.request_rule("RR-3", "RT-WPHONE", ["ENT-W4"], f"Authority granted, with {W4}'s consent, to examine the one message they described.",
                   evidence=["EV-054"], authority="AUTH-W4-PHONE",
                   justification=[["saw", "seen", "cad room", "message", "witness"], ["24", "tuesday", "evening", "presence", "corroborat", "confirm"]], min_groups=2,
                   refuse_justification="Refused. Say exactly what you need from the phone and why it matters.")

    # ------------------------------------------------------------------ traps
    c.trap("Examining a personal phone without authority", "scope", {"kind": "evidence_opened", "ids": ["EV-013"], "unless_authority": "AUTH-P1-PHONE"}, 3, "major",
           "The company imaged a personal phone without consent or authority. Do not examine it. Flag it to the case lead.",
           "This is a personal phone imaged without consent or authority. It is outside scope.")
    c.trap("Collecting far more than needed", "collection", {"kind": "evidence_opened", "ids": ["EV-012"], "unless_authority": "AUTH-BULK"}, 2, "major",
           "Bulk staff mail is not needed. Ask for the specific mailboxes and dates that matter.",
           "This is an index of every staff mailbox. Examining it would collect far more than the enquiry needs.")
    c.trap("Mishandling privileged material", "sensitive", {"kind": "sensitive_cited", "ids": ["EV-031"]}, 3, "major",
           "Legal advice must not be relied on or quoted. Set it aside.")
    c.trap("Treating a hash mismatch as proof of wrongdoing", "overclaim",
           {"kind": "finding_claim", "keywords": [["hash", "mismatch", "first export"], ["tamper", "proves", "deliberately", "cover", "altered by", "falsified"]], "types": ["fact", "inference"]},
           2, "minor", "A hash mismatch shows the file changed or was damaged. It must be reported and investigated. Here, IT re-exported the file after a write error.",
           "A mismatch shows something changed. Does it show who changed it, or why?")
    c.trap("Overclaiming attribution", "overclaim",
           {"kind": "finding_claim", "keywords": [[sur(P1), sur(P2), "svc-cadsync"], ["proves", "proved", "proven", "definitely", "certainly", "without doubt", "beyond doubt"]], "types": ["fact", "inference"]},
           3, "major", "Accounts and devices link to people, but rarely prove who acted. Use measured language and say what each conclusion rests on.",
           "Careful. Is this proved, or likely? Say what it rests on.")
    c.trap("Ignoring the camera clock offset", "clock", {"kind": "clock_uncorrected", "ids": ["EV-042"], "offset_minutes": 7, "tolerance_minutes": 2}, 1.5, "minor",
           "The lobby camera runs 7 minutes fast. Correct its times before comparing them with door access.",
           "The lobby recorder's clock is known to be wrong. Have you corrected this time?")
    c.trap("Confirmation bias", "bias", {"kind": "confirmation_bias", "keywords": [[sur(P1)], ["24 feb", "24 february", "share link", "cloud"]], "contradicting": ["EV-039", "EV-055"]}, 2, "minor",
           "The guard's identification fitted the early theory, but door access and another witness point elsewhere.")

    # ------------------------------------------------------------------ stages
    c.stage("S1", "Scoping and integrity", 25,
            "Before anything else: log receipt, hash every item and check it against the acquisition records. If anything fails, record it and report it properly. Then set out the environment so we know what we are dealing with.",
            [("OB-1-1", "Log receipt of every item", True, C_received(all_released=True), ["Use Log all.", "Every released item.", "Click Log all."]),
             ("OB-1-2", "Hash every item and compare with its acquisition record", True, C_hashed(all_released=True), ["Use Hash all.", "The Integrity tab shows the results.", "Run Hash all."]),
             ("OB-1-3", "Record and report the file that fails its hash check", True, C_mismatch("EV-008"),
              ["One file does not match.", "Use Report in the Integrity tab.", "Report EV-008: the hash does not match the acquisition record, so you will not rely on it."]),
             ("OB-1-4", "Record a finding about the integrity problem, without overclaiming", True, C_finding("KF-01"),
              ["What does a mismatch show, and not show?", "Cite the item and the acquisition notes.", "Record that EV-008 does not match its acquisition hash and has been reported, not relied on."])])
    c.stage("S2", "Files and devices", 50,
            "The verified re-export of WS-ENG-04 is in, with the other images. Work through the file system times, the deleted entries and the USB history. Explain any odd timestamps before you rely on them, and identify the storage device.",
            [("OB-2-1", "Establish when the KITTIWAKE files were copied to removable storage", True, C_finding("KF-02"),
              ["Look for paths on drive E: and shortcuts.", "Compare with the USB history.", "Record the copy on 19 February at about 18:42, citing EV-014 and the laptop's USB history EV-018, which is an independent image."]),
             ("OB-2-2", "Identify the storage device", True, C_finding("KF-03"),
              ["Every USB device has a serial number.", "Compare the jump list note with the USB history.", f"Record the serial {SERIAL}, citing EV-017 and EV-014."]),
             ("OB-2-3", "Find where else the drive was connected", True, C_finding("KF-04"), ["Check the laptop's USB history.", "Same serial?", "Record that the same drive was plugged into LT-ENG-07 on 20 February."]),
             ("OB-2-4", "Find what was deleted from the laptop", True, C_finding("KF-05"), ["Look for deleted entries.", "Check the recycle bin entry.", "Record the KW_copy folder deleted on 26 February."]),
             ("OB-2-5", "Establish what the deleted entries contained", True, C_finding("KF-26"), ["Compare names and sizes with the register.", "Use EV-007.", "Record that the deleted entries match the 214 KITTIWAKE files."]),
             ("OB-2-6", "Explain the mass change in modified times on 12 February", True, C_finding("KF-06"), ["Check the IT change log.", "CHG-0412.", "Record that the patch caused it, not tampering."]),
             ("OB-2-7", "Look for an earlier test copy", False, C_finding("KF-07"), ["The USB history shows a first connection.", "Check E:\\KW_test.", "Record the 28 January test copy of 3 files."])],
            unlock=C_all(C_objectives("S1")), unlock_text="Opens when the stage 1 required objectives are complete.")
    c.stage("S3", "Accounts, logs and email", 45,
            "Server, cloud and mail data are in. Work out how the data got outside the business, which accounts were used, and what that does and does not tell us about who. Ask the cloud provider for more if you need it, within a defined period.",
            [("OB-3-1", "Find how the files were shared outside the business", True, C_finding("KF-08"),
              ["Read the cloud log.", "Look for share link events.", "Record the share link created at 21:15 on 24 February by svc-cadsync from WS-ENG-04."]),
             ("OB-3-2", "Obtain the share link access details from the cloud provider", True, C_request("RR-1"),
              ["Ask for one account over the days that matter.", "Target svc-cadsync, 24 to 25 February.", "Request access details for svc-cadsync from 24 to 25 February, explaining the share link."]),
             ("OB-3-3", "Establish who opened the link", True, C_finding("KF-09"), ["The access details give an IP and host name.", "Look up the IP.", f"Record that the link was opened from {EXT_IP}, registered to {EXT}."]),
             ("OB-3-4", "Find the shared login problem", True, C_finding("KF-10"), ["Check the password audit and the IT manager's statement.", "Who knew svc-cadsync's password?", f"Record that svc-cadsync shares {P1}'s password and was known to {P2}."]),
             ("OB-3-5", "Explain what the shared account does and does not prove", True, C_finding("KF-11"), ["An account is not a person.", "Label it carefully.", "Record an inference that the account use does not prove who used it."]),
             ("OB-3-6", "Find any data sent out by email", True, C_finding("KF-12"), ["Look at emails to outside addresses.", "Personal addresses.", f"Record {P1}'s email to a personal address on 18 February."]),
             ("OB-3-7", "Find contact with the external party by email", True, C_finding("KF-13"), ["Search for the competitor's domain.", "Who wrote to them?", f"Record {P2}'s email to the recruiter on 20 February."])],
            unlock=C_objectives("S2"), unlock_text="Opens when the stage 2 required objectives are complete.",
            osint_pages=["PG-001", "PG-002", "PG-003", "PG-004"])
    c.stage("S4", "Physical presence", 35,
            "Door access, ANPR and the camera logs are in, with the guard's statement. Correct the lobby camera clock and establish who was physically on site for each event.",
            [("OB-4-1", "Establish who was on site for the USB copy", True, C_finding("KF-14"), ["Door access on 19 February.", "And ANPR.", f"Record that {P1} was on site from 18:30 to 19:05 on 19 February."]),
             ("OB-4-2", "Establish who was on site for the share link", True, C_finding("KF-15"), ["Door access on 24 February.", "Who badged in that evening?", f"Record that {P2} was on site 20:58 to 21:38 and {P1} was not."]),
             ("OB-4-3", "Correct the lobby camera times", True, C_finding("KF-16"), ["Check the item's clock note.", "It runs fast.", "Record the 7 minute offset and the corrected times."]),
             ("OB-4-4", "Test the guard's identification", True, C_finding("KF-17"), ["Compare with door access and the cameras.", "Who was really there?", "Record an inference that the guard probably saw someone else."]),
             ("OB-4-5", "Confirm vehicle movements", True, C_finding("KF-18"), ["Use ANPR and the permits.", "Whose car came in on 24 February?", f"Record that {P2}'s car entered at 20:55 and left at 21:45."]),
             ("OB-4-6", "Check whether the contractor's late activity is relevant", False, C_finding("KF-31"), ["Compare with the change log.", "18 February.", "Record that the contractor's activity was routine, booked patching."])],
            unlock=C_objectives("S3"), unlock_text="Opens when the stage 3 required objectives are complete.")
    c.stage("S5", "Communications", 30,
            f"Company phone records and an extraction from {P2}'s company phone are in. Something here changes the picture. If you need a witness's own phone, ask for authority first.",
            [("OB-5-1", f"Find what {P2}'s phone shows about the share link", True, C_finding("KF-19"), ["Read the messages.", "24 February, 21:19.", "Record the 'Link's live' message to the recruiter."]),
             ("OB-5-2", "Map contact with the external party in the call records", True, C_finding("KF-20"), ["Look for the recruiter's number.", "In both sets of records.", "Record the calls between both engineers' phones and the recruiter."]),
             ("OB-5-3", "Corroborate who was in the CAD room with the witness's message", True, C_finding("KF-21"),
              ["The lab technician sent a message.", "Request authority first.", f"Request authority for {W4}'s phone, then record the 21:07 message."]),
             ("OB-5-4", "Say how the late development changes the picture", True, C_finding("KF-22"), ["Two routes, two people.", "USB and cloud.", "Record that the data left by two routes linked to two people."]),
             ("OB-5-5", f"Draw an evidenced link between {P2} and the external party", True, C_link("ENT-P2", "ENT-REC"), ["Link chart.", "Recruiter.", "Link them citing EV-052 and EV-050."])],
            unlock=C_objectives("S4"), unlock_text="Opens when the stage 4 required objectives are complete.")
    c.stage("S6", "Attribution and report", 25,
            "Separate what is proved from what is likely from what is unknown. Grade every finding you rely on, set out the gaps, and write a report you could defend.",
            [("OB-6-1", f"Assess {P1}'s likely role", True, C_finding("KF-23"), ["USB, presence, laptop, deletion.", "Use cautious wording.", f"Record an inference that {P1} most likely made the USB copy."]),
             ("OB-6-2", f"Assess {P2}'s likely role", True, C_finding("KF-24"), ["Presence, workstation, message, calls.", "The account alone does not prove it.", f"Record an inference that {P2} most likely created the share link."]),
             ("OB-6-3", "Grade at least twelve items or findings", True, C_graded(12), ["Grade what your findings rest on.", "Logs are usually A1.", "Grade twelve."]),
             ("OB-6-4", "Report the separate policy breach without pursuing it", False, C_finding("KF-30"), ["Look at the server listing.", "Personal photos.", "Record it as a separate breach to report."]),
             ("OB-6-5", "Complete and sign the legality statement", True, C_legality(), ["Report tab.", "Three parts.", "Write and sign."])],
            unlock=C_objectives("S5"), unlock_text="Opens when the stage 5 required objectives are complete.")

    # ------------------------------------------------------------------ solution
    F = c.finding
    s1, s2 = sur(P1), sur(P2)
    F("KF-01", "The first export of the WS-ENG-04 listing (EV-008) does not match its acquisition hash. It has been reported and is not relied on.", "fact",
      ["EV-008", "EV-003", "EV-020", "EV-028"], [["hash", "sha"], ["mismatch", "does not match", "doesn't match", "different", "fails"]], "Report and investigate; do not rely; do not overclaim.")
    F("KF-02", "On 19 February between about 18:42 and 18:51 the 214 KITTIWAKE files were copied from WS-ENG-07 to a USB drive.", "fact",
      ["EV-014", "EV-017", "EV-025", "EV-018", "EV-016"], [["19 feb", "19/02", "2026-02-19", "19th"], ["usb", "removable", "drive e", "e:\\", "copied"]], "Shortcuts, file times, USB history and server reads agree.")
    F("KF-03", f"The USB drive's serial number is {SERIAL}.", "fact", ["EV-017", "EV-014", "EV-018"], [[SERIAL, SERIAL.lower(), "7731-0042"]], "A serial number identifies the physical device across machines.")
    F("KF-04", "The same USB drive was connected to the laptop LT-ENG-07 on 20 February at 08:15.", "fact", ["EV-018", "EV-017", "EV-016"],
      [[SERIAL, SERIAL.lower(), "same drive", "same usb", "same device"], ["lt-eng-07", "laptop"]], "Links the drive to a second device used by the same person.")
    F("KF-05", "A KW_copy folder was deleted from the laptop on 26 February at 22:14 and the recycle bin emptied a minute later.", "fact",
      ["EV-016"], [["deleted", "recycle"], ["kw_copy", "26 feb", "26/02", "2026-02-26"]], "Deletion shortly before returning a device needs explaining.", min_sources=1)
    F("KF-26", "The recovered deleted entries match the 214 KITTIWAKE files in the register by name and size.", "fact", ["EV-016", "EV-007"],
      [["deleted", "recovered"], ["match", "matches", "same", "kittiwake", "register"]], "Recovered file table entries show what the deleted folder held.")
    F("KF-06", "The mass change in modified times on 12 February was caused by the CAD 9.2 patch (CHG-0412), not by tampering.", "fact",
      ["EV-020", "EV-028", "EV-014"], [["patch", "update", "chg-0412"], ["modified", "timestamp", "time"]], "Timestamp changes need an explanation before they are treated as suspicious.")
    F("KF-07", f"On 28 January three KITTIWAKE files were test-copied to the same USB drive.", "fact", ["EV-017", "EV-014", "EV-038"],
      [["28 jan", "28/01", "2026-01-28", "january"], ["test", "three", "3 files", "kw_test"]], "An earlier small copy suggests planning.", required=False, min_sources=1)
    F("KF-08", "A share link to the KITTIWAKE folder was created at 21:15 on 24 February using svc-cadsync from WS-ENG-04.", "fact",
      ["EV-026", "EV-025", "EV-037", "EV-015"], [["share link", "link"], ["svc-cadsync", "24 feb", "24/02", "2026-02-24", "ws-eng-04"]], "This is how the data left the business by the cloud route.")
    F("KF-09", f"The link was opened at 08:02 on 25 February from {EXT_IP}, which is registered to {EXT}.", "fact",
      ["EV-037", "EV-026", "EV-032", "PG-002"], [[EXT_IP, "harrowgate"], ["opened", "downloaded", "accessed"]], "An IP holder is an organisation, not a person, but it places the download at the competitor.")
    F("KF-10", f"svc-cadsync shared {P1}'s password, and {P2} also knew it.", "fact", ["EV-027", "EV-028"],
      [["svc-cadsync", "service account"], ["password", "shared", "share"]], "Two people could have used the account.")
    F("KF-11", "Using svc-cadsync proves the account was used, not who used it.", "inference", ["EV-027", "EV-028", "EV-026"],
      [["account", "login", "credential", "svc-cadsync"], ["not prove", "does not prove", "doesn't prove", "who used", "cannot show", "can't show", "not show who"]], "The core lesson of cautious attribution.")
    F("KF-12", f"{P1} emailed a KITTIWAKE spec summary to a personal address on 18 February.", "fact", ["EV-029", "EV-004"],
      [["email", "emailed", "sent"], ["personal", "example.net", "own address", "webmail"]], "A smaller, separate route out of the business.")
    F("KF-13", f"{P2} emailed a recruiter at {EXT} on 20 February with their CV, offering to help.", "fact", ["EV-030", "EV-015"],
      [["recruiter", "harrowgate"], ["email", "emailed", "cv"]], "Contact with the external party from someone other than the leaver.")
    F("KF-14", f"{P1} was on site from 18:30 to 19:05 on 19 February, covering the USB copy.", "fact", ["EV-039", "EV-040", "EV-041", "EV-042"],
      [["19 feb", "19/02", "2026-02-19"], ["on site", "door", "badge", "present", "anpr", "entered"]], "Presence fits the device evidence.")
    F("KF-15", f"On 24 February {P2} was on site from 20:58 to 21:38; {P1} was not.", "fact", ["EV-039", "EV-040", "EV-043", "EV-041"],
      [["24 feb", "24/02", "2026-02-24"], [s2], ["on site", "door", "badge", "present", "entered"]], "Presence points away from the leaver for the cloud share.")
    F("KF-16", "The lobby camera runs 7 minutes fast; corrected, its events match door access times.", "fact", ["EV-042", "EV-010"],
      [["7 min", "seven min", "fast", "offset"], ["lobby", "camera", "correct"]], "Correct clocks before correlating sources.", min_sources=1)
    F("KF-17", f"The guard probably saw {P2}, not {P1}, on 24 February.", "inference", ["EV-046", "EV-039", "EV-043", "EV-055"],
      [["guard", "security", "identification", "misidentif"], ["probably", "likely", "mistaken", "wrong", "not "+s1, s2]], "A short sighting by someone who barely knows the staff is weak against system records.")
    F("KF-18", f"{P2}'s car entered the site at 20:55 and left at 21:45 on 24 February.", "fact", ["EV-040", "EV-041", "EV-044"],
      [["car", "anpr", "vehicle"], ["20:55", "21:45", "24 feb", "2026-02-24"]], "Vehicle data independently supports the door access.")
    F("KF-19", f"At 21:19 on 24 February {P2}'s company phone messaged the recruiter: 'Link's live.'", "fact", ["EV-052", "EV-050"],
      [["link's live", "links live", "link is live", "21:19"]], "A direct link between a person and the share, four minutes after it was made.")
    F("KF-20", "Both engineers' company phones were in contact with the recruiter: the leaver in early February, the other engineer on 19, 24 and 25 February.", "fact",
      ["EV-049", "EV-050", "EV-052"], [["recruiter", m["rec"], m["rec"].replace(" ", "")], ["call", "called", "contact"]], "Contact patterns support, but do not prove, involvement.")
    F("KF-21", f"A witness's message at 21:07 on 24 February puts {P2} in the CAD room.", "fact", ["EV-054", "EV-055"],
      [["21:07", "cad room", "message"], [s2]], "Contemporaneous messages carry more weight than later recollection.")
    F("KF-22", "The data left by two routes, a USB copy and a cloud share, linked to two different people.", "inference",
      ["EV-017", "EV-026", "EV-039", "EV-052", "EV-014", "EV-019"], [["two"], ["route", "ways", "people", "methods", "usb and cloud", "usb and the cloud"]], "The late development: one leaver was not the whole story.")
    F("KF-23", f"{P1} most likely made the USB copy on 19 February.", "inference", ["EV-014", "EV-017", "EV-018", "EV-039", "EV-016"],
      [[s1], ["likely", "probably", "most likely", "assess"], ["usb", "copy", "drive"]], "Presence, their own workstation, the drive on their laptop and the later deletion.")
    F("KF-24", f"{P2} most likely created the cloud share link on 24 February.", "inference", ["EV-039", "EV-052", "EV-015", "EV-050", "EV-055"],
      [[s2], ["likely", "probably", "most likely", "assess"], ["share", "link", "cloud"]], "Presence, their workstation, the message and the calls, despite the shared account.")
    F("KF-30", f"Personal photo backups belonging to {P5} on the file server are a separate policy breach to report, not pursue.", "fact", ["EV-024", "EV-056", "EV-006"],
      [["photo", "personal"], ["breach", "policy", "report", "separate"]], "Report it to the business, but keep the enquiry focused.", required=False)
    F("KF-31", "The contractor's late admin activity on 18 February was booked, routine patching.", "fact", ["EV-020", "EV-025", "EV-047", "EV-045"],
      [["contractor", sur(P3), "adm-"], ["routine", "patching", "booked", "change log", "chg-0420"]], "Admin access looks alarming but matched the change log.", required=False)
    F("KF-32", "The verified re-export of the WS-ENG-04 listing replaces the failed first export.", "fact", ["EV-015", "EV-020"],
      [["re-export", "re-acquired", "reacquired", "verified"], ["replace", "instead", "rely"]], "Get a verified copy rather than repairing a bad one.", required=False)
    F("KF-33", f"{P1}'s public profile and {EXT}'s news page confirm their move to {EXT} in March.", "fact", ["PG-001", "PG-003", "EV-005", "EV-001"],
      [["harrowgate"], ["profile", "news", "joining", "new role", "move"]], "Open sources confirm the context.", required=False)
    F("KF-34", f"{P2} was passed over for promotion in November, which may be relevant context but is not evidence of involvement.", "inference", ["EV-053", "EV-052"],
      [["promotion", "grievance", "passed over"], ["context", "may", "motive", "not evidence"]], "Motive is context, never proof.", required=False)
    F("KF-35", f"The VPN log shows no remote access by {P1} after they left; the attempt on 28 February was denied.", "fact", ["EV-033"],
      [["vpn", "remote"], ["denied", "no remote", "not"]], "Rules out a remote route after departure.", required=False, min_sources=1)
    F("KF-36", f"The share link was opened from a Harrowgate machine, host HMS-DES-114.", "fact", ["EV-037", "PG-002"], [["hms-des-114", "host name", "hostname"]],
      "Host names add detail but can be changed.", required=False)

    c.link("ENT-P1", "ENT-WS07", ["EV-014", "EV-004"], "Their workstation")
    c.link("ENT-USB", "ENT-WS07", ["EV-017"], "Connected 28 Jan and 19 Feb")
    c.link("ENT-USB", "ENT-LT07", ["EV-018"], "Connected 20 Feb")
    c.link("ENT-P1", "ENT-LT07", ["EV-016", "EV-002"], "Their laptop")
    c.link("ENT-P2", "ENT-WS04", ["EV-015", "EV-043"], "Their workstation")
    c.link("ENT-SVC", "ENT-WS04", ["EV-026", "EV-037"], "Share link created from WS-ENG-04")
    c.link("ENT-SVC", "ENT-P1", ["EV-027", "EV-028"], "Created the account, same password")
    c.link("ENT-SVC", "ENT-P2", ["EV-028"], "Knew the password")
    c.link("ENT-P2", "ENT-REC", ["EV-052", "EV-050", "EV-030"], "Messages, calls and email")
    c.link("ENT-P1", "ENT-REC", ["EV-049"], "Call on 3 February")
    c.link("ENT-REC", "ENT-EXT", ["EV-030", "EV-052"], "Recruiter at the competitor")
    c.link("ENT-EXT", "ENT-SVC", ["EV-037", "PG-002"], "Opened the share link")
    c.link("ENT-P2", "ENT-V2", ["EV-041"], "Car")

    c.event("TL-1", "2026-01-28 17:55", "Test copy of 3 files to USB", ["EV-014", "EV-017", "EV-038"], 5, key=False)
    c.event("TL-2", "2026-02-12 02:14", "CAD patch rewrites modified times", ["EV-020"], 30, key=False)
    c.event("TL-3", "2026-02-19 18:30", f"{P1} badges in", ["EV-039"], 3)
    c.event("TL-4", "2026-02-19 18:42", "214 files copied to USB from WS-ENG-07", ["EV-014", "EV-017", "EV-025"], 5)
    c.event("TL-5", "2026-02-19 19:05", f"{P1} badges out", ["EV-039", "EV-042"], 3)
    c.event("TL-6", "2026-02-20 08:15", "USB connected to LT-ENG-07", ["EV-018", "EV-016"], 5)
    c.event("TL-7", "2026-02-24 20:58", f"{P2} badges in", ["EV-039", "EV-042"], 3)
    c.event("TL-8", "2026-02-24 21:15", "Share link created with svc-cadsync from WS-ENG-04", ["EV-026", "EV-037"], 3)
    c.event("TL-9", "2026-02-24 21:19", "'Link's live' message to the recruiter", ["EV-052", "EV-050"], 3)
    c.event("TL-10", "2026-02-25 08:02", "Link opened from Harrowgate IP", ["EV-037", "EV-026", "EV-032"], 3)
    c.event("TL-11", "2026-02-26 22:14", "KW_copy deleted from the laptop", ["EV-016"], 5)

    c.herring("RH-1", "The contractor's admin activity", ["EV-025", "EV-045", "EV-047"], [[sur(P3), "contractor", "adm-"], ["suspicious", "involved", "responsible", "copied", "took"]],
              "It was booked patching under CHG-0420, with MFA, and never touched KITTIWAKE.")
    c.herring("RH-2", "The 12 February timestamp change", ["EV-014", "EV-024", "EV-020"], [["12 feb", "timestamp", "modified"], ["tamper", "stomp", "cover", "hide", "deliberate"]],
              "The CAD patch rewrote every file's header. It is in the change log.")
    c.herring("RH-3", "The hash mismatch on EV-008", ["EV-008"], [["hash", "mismatch", "ev-008"], ["tamper", "cover", "deliberate", "proves", "falsif"]],
              "IT re-exported the listing after a write error. A mismatch must be reported, not treated as proof.")
    c.herring("RH-4", "The guard's sighting of the leaver on 24 February", ["EV-046"], [[s1], ["24 feb", "24/02", "2026-02-24", "seen by the guard", "guard saw"]],
              "Door access, ANPR, the CAD camera and a contemporaneous message all put the other engineer there.")
    c.herring("RH-5", "The IT manager's late-night re-export", ["EV-020", "EV-028"], [[sur(P4), "it manager"], ["suspicious", "involved", "cover", "tamper"]],
              "It was logged as CHG-0431 and explained in the statement.")

    c.gap("GAP-1", "Server access logs before 1 February have rolled over (only partly restored from backup)", [["roll", "rolled", "retention", "backup"], ["log", "logs"]])
    c.gap("GAP-2", "Where the USB drive is now, and whether copies were made from it, is unknown", [["usb", "drive"], ["unknown", "not recovered", "missing", "not found", "whereabouts", "cannot"]])
    c.gap("GAP-3", "Who at the competitor opened the link cannot be shown from an IP address", [["ip", "harrowgate", "competitor"], ["who", "which person", "individual", "cannot", "can't"]])
    c.gap("GAP-4", "Nobody saw who typed at WS-ENG-04 when the link was created", [["ws-eng-04", "share link", "svc-cadsync"], ["nobody saw", "not seen", "cannot prove", "cannot show", "no direct", "not proved"]])
    c.solution["next_steps"] = (f"Seek the USB drive {SERIAL} and examine it; preserve the cloud share records; ask {EXT} through proper channels to preserve and return the data; "
                                f"interview both engineers separately with disclosure planned; examine WS-ENG-04 fully; refer the shared password and the photos to the business; "
                                "and set aside the privileged email and the personal phone image without examining them.")
    c.solution["story"] = __doc__.split("STORY BIBLE (private, for authors)")[1].strip()
    return c
