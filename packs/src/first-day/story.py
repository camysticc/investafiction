"""Academy practice case: First Day. A lost parcel, about twenty minutes.

STORY BIBLE (private, for authors)

Pebble & Pine Ltd is a two-person online craft shop in Kestrel Bay. On
Monday 2 February 2026 it packs order 4471, a hand-made wall clock worth
£180, for a customer at 41 Linnet Close, Brackenfield. The courier collects
it on Tuesday morning and marks it delivered at 15:42 on the handheld,
whose clock runs 5 minutes fast, so the true time is 15:37.

The driver swapped the digits and left the parcel at number 14, which also
has a blue door. The driver honestly believes he delivered to 41. The
customer was at home all afternoon and her doorbell camera saw nobody. The
resident at number 14 posted on Bayboard that evening about a parcel left
for someone else.

Nothing criminal happened. The point of the case is method: log and hash
everything, report the first tracking export that fails its hash, correct
the handheld's clock, ask the courier for the delivery photo with a short,
justified request, compare the two statements fairly, capture the public
post properly, and write a short cited report.

Red herring: a different business with the same name in Saltmarsh.
Trap: a staff member's personal diary that was sent over by mistake.
"""
from invtools import art
from invtools.casekit import (C_all, C_captured, C_finding, C_graded, C_hashed, C_legality, C_link, C_mismatch,
                              C_objectives, C_received, C_request, C_timeline, Case)
from invtools.common import sha256_bytes
from invtools.gen import Gen, csv_text

SEED = 4404


def make_case() -> Case:
    g = Gen(SEED)
    c = Case(id="first-day", title="First Day", version="1.0.0", specialty="Academy practice case",
             difficulty="Training", minutes=20, seed=SEED,
             summary="Your first case at the desk. A parcel marked as delivered never arrived. Work out where it went, "
                     "and practise every habit a careful analyst needs.")
    CUST, DRV, N14, OWNER, STAFF = g.name(), g.name(), g.name(), g.name(), g.name()
    first = lambda n: n.split(" ", 1)[0]
    CO = "Pebble & Pine Ltd"
    COURIER = "Swiftbay Couriers"

    c.brief = f"""
# First Day

Welcome to your first case. **{CO}** is a small online craft shop in Kestrel Bay run by {OWNER}.

On Wednesday 4 February 2026 a customer, {CUST}, emailed to say that her order, a hand-made wall clock, never arrived. The courier's tracking says it was delivered on Tuesday afternoon. The shop wants to know what happened before it decides whether to send a replacement.

Your job is to work out where the parcel most likely went, show how you know, and say what is still unknown. Nobody is accused of anything. This is a short practice case, so take your time and try every tool.

*All people, businesses, places and data in this case are fictional.*
"""
    c.intake = {
        "tasking": f"Establish what happened to order 4471 from {CO} after it left the shop, and recommend what the shop should do next.",
        "scope": [f"Order, packing and email records supplied by {CO}", f"Tracking and delivery records from {COURIER}",
                  "Public online posts about the parcel", "Statements from the customer and the driver"],
        "out_of_scope": ["Personal notes and devices of shop staff", "Anyone's private online accounts",
                         "Information about neighbours that has nothing to do with the parcel"],
        "authorities": [{"id": "AUTH-BASE", "label": "Shop's request for a review", "covers": "Examination of supplied records and public pages"}],
        "constraints": ["Work on copies. Hash every item before relying on it.", "Report integrity problems; do not try to fix them.",
                        "Do not contact anyone online.", "Capture online pages properly before relying on them."],
        "clock_start": "2026-02-05T09:00:00Z",
        "case_lead": "Shop owner",
        "osint_access": "public_only",
        "subjects": ["ENT-PARCEL"],
    }
    E = c.entity
    E("ENT-ORG1", "organisation", CO, role="Seller")
    E("ENT-ORG2", "organisation", COURIER, role="Courier")
    E("ENT-CUST", "person", CUST, role="Customer", attributes={"address": "41 Linnet Close"})
    E("ENT-DRV", "person", DRV, role="Courier driver", identifiers=["route 9"])
    E("ENT-OWN", "person", OWNER, role="Shop owner")
    E("ENT-N14", "person", N14, role="Resident, 14 Linnet Close", hidden_until="S2")
    E("ENT-PARCEL", "device", "Parcel for order 4471 (tracking SB-4471-09)", identifiers=["SB-4471-09", "4471"])
    E("ENT-ADDR41", "address", "41 Linnet Close")
    E("ENT-ADDR14", "address", "14 Linnet Close", hidden_until="S2")

    L = lambda id, label, kind, x, y, **kw: dict(id=id, label=label, kind=kind, x=x, y=y, **kw)
    c.map = art.kestrel_bay_map([
        L("LOC-SHOP", CO, "address", 3100, 2700), L("LOC-DEPOT", f"{COURIER} depot", "address", 5200, 1300),
        L("LOC-41", "41 Linnet Close", "address", 4320, 2860), L("LOC-14", "14 Linnet Close", "address", 4240, 2930, stage="S2"),
    ])

    # ------------------------------------------------------------------ STAGE 1
    c.email("EV-001", "Email: customer says the parcel never arrived", headers=[
        ("From", f"<{first(CUST).lower()}@mail.example.com>"), ("To", "<orders@pebbleandpine.example.com>"),
        ("Date", "Wed, 04 Feb 2026 09:15:00 +0000"), ("Subject", "Order 4471 not received")],
        body=f"Hello, tracking says my clock was delivered yesterday at 15:42 but nothing came. I was home all afternoon. Could you look into it please? Thanks, {first(CUST)}",
        source=CO, source_group="shop-email", acquired="2026-02-05 08:30", stage="S1", grade=("B", "2"),
        summary="The customer's complaint.")
    c.table("EV-002", "Order record 4471", "spreadsheet", ["order", "customer", "address", "item", "value", "placed"],
            [["4471", CUST, "41 Linnet Close, Brackenfield", "Hand-made wall clock (oak)", "180.00", "2026-02-01 19:22"]],
            source=f"{CO} shop system", source_group="shop-orders", acquired="2026-02-05 08:30", stage="S1", grade=("A", "1"),
            summary="What was ordered and where it was to go.")
    c.table("EV-003", "Packing log, 2 February", "spreadsheet", ["time_utc", "order", "packed_by", "weight_kg", "label"],
            [["2026-02-02 15:40", "4468", STAFF, "0.4", "SB-4468-02"], ["2026-02-02 16:10", "4471", STAFF, "2.1", "SB-4471-09"],
             ["2026-02-02 16:25", "4472", STAFF, "0.7", "SB-4472-11"]],
            table={"time_column": "time_utc"}, source=f"{CO} shop system", source_group="shop-orders", acquired="2026-02-05 08:30", stage="S1",
            grade=("A", "2"), summary="Parcels packed on Monday.")
    label = ('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">'
             '<rect width="420" height="260" fill="#fffdf6" stroke="#333" stroke-width="3"/>'
             f'<text x="20" y="40" font-family="Arial" font-size="20" font-weight="bold">{COURIER.upper()}</text>'
             '<text x="20" y="70" font-family="Arial" font-size="14">Tracking: SB-4471-09   Weight: 2.1 kg</text>'
             '<line x1="20" y1="85" x2="400" y2="85" stroke="#333"/>'
             f'<text x="20" y="120" font-family="Arial" font-size="18">{CUST}</text>'
             '<text x="20" y="150" font-family="Arial" font-size="26" font-weight="bold">41 Linnet Close</text>'
             '<text x="20" y="180" font-family="Arial" font-size="18">Brackenfield, Kestrel Bay</text>'
             '<rect x="20" y="200" width="380" height="40" fill="#222"/>'
             '<text x="30" y="226" font-family="monospace" font-size="16" fill="#fff">|||| || ||| | |||| || | ||| SB447109</text></svg>')
    c.image("EV-004", "Photo of the shipping label (shop copy)", label, source=f"{CO}", source_group="shop-photo",
            acquired="2026-02-05 08:35", stage="S1", grade=("A", "2"),
            metadata={"Camera": "Shop tablet", "Taken": "2026-02-02 16:11", "Note": "The shop photographs every label before collection."},
            summary="The label as printed: 41 Linnet Close.")
    track = [["2026-02-03 09:35", "SB-4471-09", "Collected from sender", "Pebble & Pine Ltd"],
             ["2026-02-03 10:20", "SB-4471-09", "Arrived at depot", "Moorend depot"],
             ["2026-02-03 11:10", "SB-4471-09", "Out for delivery", "Route 9"],
             ["2026-02-03 15:42", "SB-4471-09", "Delivered, left at front door", "Linnet Close"]]
    c.table("EV-005", "Courier tracking export (verified copy)", "spreadsheet", ["device_time", "tracking", "event", "where"], track,
            table={"time_column": "device_time", "description_columns": ["event", "where"]}, source=COURIER, source_group="courier-system",
            acquired="2026-02-05 08:40", stage="S1", clock_offset_minutes=5,
            clock_note="Times come from the driver's handheld, which the courier says runs 5 minutes fast. Subtract 5 minutes for true time.",
            grade=("A", "2"), summary="Every scan of the parcel, in handheld time.")
    first_copy = csv_text(["device_time", "tracking", "event", "where"], track[:2]) + "### export interrupted ###\n"
    c.evidence("EV-012", "Courier tracking export (first copy, emailed)", "spreadsheet", first_copy, "csv",
               source=COURIER, source_group="courier-system", acquired="2026-02-05 08:20", stage="S1",
               original_hash=sha256_bytes(first_copy.encode() + b"(as hashed when sent)"), tags=["integrity_test"],
               table={"time_column": "device_time"}, grade=("C", "3"),
               summary="An earlier copy of the tracking export sent by email. The courier later sent a verified copy.")
    c.document("EV-007", f"Statement: {CUST} (customer)", "statement", f"""
# Statement

**Name:** {CUST}
**Role:** Customer
**Taken by:** Shop owner, by phone, 5 February 2026

I live alone at 41 Linnet Close. On Tuesday 3 February I was at home all afternoon, from about one until after five, working at the kitchen table by the front window.

Nobody knocked and nothing was left on the step. I checked when the tracking said it had been delivered.

My front door is blue. I have a doorbell camera and I am happy for the shop to see its log.
""", source="Witness", source_group="witness-cust", acquired="2026-02-05 09:00", stage="S1", grade=("B", "2"),
        summary="The customer's account of Tuesday afternoon.")
    c.document("EV-009", "Staff rota, February", "rota", f"# Rota\n\n| Day | {OWNER} | {STAFF} |\n|---|---|---|\n| Mon | In | In |\n| Tue | In | Off |\n| Wed | In | In |",
               source=CO, source_group="shop-hr", acquired="2026-02-05 08:30", stage="S1", noise=True, grade=("B", "2"), summary="Who works which day.")
    c.document("EV-010", "Supplier invoice: oak blanks", "invoice", "# Invoice\n\nTwenty oak clock blanks, £140.00. Paid.",
               source=CO, source_group="shop-accounts", acquired="2026-02-05 08:30", stage="S1", noise=True, grade=("B", "2"), summary="Materials invoice.")
    c.document("EV-011", f"Personal diary pages: {STAFF}", "document", "# Diary\n\nPersonal notes that were scanned with the packing records by mistake.",
               source=CO, source_group="shop-personal", acquired="2026-02-05 08:30", stage="S1", marking="personal",
               handling="A staff member's personal diary, sent by mistake. It is outside the scope of the tasking.",
               grade=("C", "3"), summary="A staff member's personal pages, sent by mistake.")

    # ------------------------------------------------------------------ STAGE 2
    c.document("EV-008", f"Statement: {DRV} (courier driver)", "statement", f"""
# Statement

**Name:** {DRV}
**Role:** Driver, {COURIER}, route 9
**Taken by:** {COURIER} supervisor, 5 February 2026

I delivered the parcel for Linnet Close on Tuesday afternoon, at about twenty to four.

The house number was 41. It has a blue door. I knocked, nobody answered, so I left it on the step and took a photo, like we always do.

I did about ninety drops that day. Linnet Close is a new street on my route.
""", source="Witness", source_group="witness-drv", acquired="2026-02-05 11:00", stage="S2", grade=("B", "3"),
        summary="The driver's account of the delivery.")
    db = [["2026-02-03 12:58", "motion", "Front path"], ["2026-02-03 13:02", "door open", "Resident"],
          ["2026-02-03 17:20", "motion", "Front path"], ["2026-02-03 17:21", "door open", "Resident"]]
    c.table("EV-013", "Doorbell camera log, 41 Linnet Close", "camera_log", ["device_time", "event", "label"], db,
            table={"time_column": "device_time", "description_columns": ["event", "label"]}, source=CUST, source_group="doorbell-41",
            acquired="2026-02-05 12:00", stage="S2", grade=("A", "2"), metadata={"Clock check": "Within 30 seconds of network time"},
            summary="Every event on the customer's doorbell camera on Tuesday.")
    photo = ('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">'
             '<rect width="400" height="300" fill="#cfd8dc"/><rect x="120" y="40" width="160" height="240" fill="#2f5d9e"/>'
             '<rect x="140" y="60" width="120" height="90" fill="#244a80"/><circle cx="255" cy="170" r="6" fill="#d4af37"/>'
             '<rect x="170" y="10" width="60" height="26" fill="#fff" stroke="#333"/><text x="185" y="30" font-family="Arial" font-size="20">14</text>'
             '<rect x="150" y="235" width="100" height="50" fill="#b08a5a" stroke="#6d5436"/><text x="160" y="265" font-family="Arial" font-size="11">SB-4471-09</text></svg>')
    c.image("EV-006", "Courier delivery photo with GPS record", photo, source=COURIER, source_group="courier-photo",
            acquired="2026-02-05 14:00",
            metadata={"Taken (handheld)": "2026-02-03 15:42", "GPS": "Linnet Close, nearest address 14", "Accuracy": "6 m", "Device": "Route 9 handheld"},
            grade=("A", "2"), summary="The photo the driver took when leaving the parcel. The door number reads 14.")

    # ------------------------------------------------------------------ OSINT
    c.site("bayboard", "Bayboard", "bayboard.test", "community", "#7a5a1f", "Kestrel Bay's community board and marketplace")
    c.site("linkline", "Linkline", "linkline.test", "business", "#2c4f8a", "Work profiles and businesses")
    c.osint_image("osint/avatar-n14.svg", art.silhouette("#6b7a4c"))
    c.page(id="PG-001", site="bayboard", url="https://bayboard.test/brackenfield/posts/8812", kind="post",
           title="Brackenfield: parcel left at the wrong house?", handle="linnet14", display_name=N14, avatar="osint/avatar-n14.svg",
           body=f"Found a big box on my step this afternoon (Tuesday) addressed to someone else in Linnet Close. Courier must have mixed up the numbers. I'm at no. 14. Message me if it's yours!",
           posts=[{"id": "b1", "time": "2026-02-03T18:47:00Z", "text": "Found a big box on my step this afternoon addressed to someone else in Linnet Close. I'm at no. 14.", "likes": 3}],
           search_terms=["linnet close", "parcel", "brackenfield", "wrong house", "box", "4471", "courier"])
    c.page(id="PG-002", site="linkline", url="https://linkline.test/company/pebble-and-pine-saltmarsh", kind="profile",
           title="Pebble and Pine Garden Design (Saltmarsh)", handle="pebble-and-pine-saltmarsh", display_name="Pebble and Pine Garden Design",
           bio="Landscape gardening in Saltmarsh since 2011. Not an online shop.", fields={"Location": "Saltmarsh", "Founded": "2011"},
           search_terms=["pebble and pine", "pebble & pine", "pebble"])
    c.page(id="PG-003", site="linkline", url="https://linkline.test/company/pebble-pine-kestrel-bay", kind="profile",
           title="Pebble & Pine Ltd (Kestrel Bay)", handle="pebble-pine-kestrel-bay", display_name=CO,
           bio="Hand-made clocks and homeware, sold online. Kestrel Bay.", fields={"Location": "Kestrel Bay", "Owner": OWNER},
           search_terms=["pebble and pine", "pebble & pine", "pebble", "clock"])

    # ------------------------------------------------------------------ requests and traps
    c.request_type("RT-PHOTO", "data", "Courier: delivery photo and GPS for one parcel", ["device"], "S2", False,
                   "Ask the courier for the photo and GPS record taken when a parcel was delivered.")
    c.request_rule("RR-1", "RT-PHOTO", ["ENT-PARCEL"], f"{COURIER} has sent the delivery photo and GPS record for SB-4471-09.",
                   evidence=["EV-006"],
                   justification=[["delivered", "delivery", "missing", "not received", "never arrived", "lost"], ["photo", "gps", "where", "address", "location", "proof"]],
                   min_groups=2, refuse_justification="Refused. Say why you need the photo: what does it help you find out?")
    c.trap("Working outside scope", "scope", {"kind": "evidence_opened", "ids": ["EV-011"], "unless_authority": "AUTH-NONE"}, 2, "major",
           "The staff member's diary was sent by mistake and has nothing to do with the parcel. Leave it closed and tell the case lead.",
           "This is a staff member's personal diary that was sent by mistake. It is outside your scope.")
    c.trap("Ignoring a fast clock", "clock", {"kind": "clock_uncorrected", "ids": ["EV-005"], "offset_minutes": 5, "tolerance_minutes": 2}, 1, "minor",
           "The courier's handheld runs 5 minutes fast. Correct the time before you compare it with other sources.",
           "Check the clock note on this item before you use its times.")
    c.trap("Mistaking a difference for a lie", "statements",
           {"kind": "lie_claim", "keywords": [["lie", "lied", "lying", "liar", "untruthful", "dishonest", "false statement", "made up", "covering up"]]},
           1, "minor",
           "The driver honestly believes he delivered to 41. A mistake is not a lie. Note the difference and what resolves it.",
           "Careful. Does the evidence show the driver knew the truth and said otherwise, or did he simply make a mistake?")

    # ------------------------------------------------------------------ stages
    c.stage("S1", "Receive and check", 8,
            "Welcome to your first case. Start the right way: log receipt of every item, check each one's hash, and report anything that fails. Then put the key times on a timeline.",
            [("OB-1-1", "Log receipt of every item", True, C_received(all_released=True),
              ["Every item needs its receipt logged before you open it.", "Use Log all in the evidence list.", "Press Log all at the top of the evidence list."]),
             ("OB-1-2", "Check the hash of every item", True, C_hashed(all_released=True),
              ["A hash is a fingerprint that shows a file has not changed.", "Use Hash all in the evidence list or the Integrity tab.", "Press Hash all."]),
             ("OB-1-3", "Report the item that fails its hash check", True, C_mismatch("EV-012"),
              ["One item's fingerprint does not match.", "The Integrity tab lists any mismatch.", "Report the problem with EV-012. Do not try to fix it."]),
             ("OB-1-4", "Add three events to the timeline", True, C_timeline(3),
              ["Use the timeline button on a table row.", "Packing, collection and delivery are good starts.", "Add three events, each citing its item."]),
             ("OB-1-5", "Grade two sources", False, C_graded(2),
              ["Grading says how far you trust a source and its content.", "Use the grade control in the viewer.", "Grade the order record A1 and the tracking export A2."])])
    c.stage("S2", "Find the parcel", 12,
            "Good work. The driver's statement and the customer's doorbell log are in. Ask the courier for the delivery photo if you need it, compare the two statements, check public posts, and tell me where the parcel most likely is.",
            [("OB-2-1", "Get the delivery photo with a justified request", True, C_request("RR-1"),
              ["Requests need a target and a reason.", "Ask the courier about the parcel itself.", "Request the delivery photo for the parcel and say it is needed to see where it was left."]),
             ("OB-2-2", "Record where the photo shows the parcel was left", True, C_finding("KF-03"),
              ["Open the photo and its metadata.", "Look at the door number and the GPS.", "Record that the photo and GPS show number 14, citing EV-006."]),
             ("OB-2-3", "Link the parcel to the address where it was left", True, C_link("ENT-PARCEL", "ENT-ADDR14"),
              ["Use the link chart.", "Which address does the evidence point to?", "Link the parcel to 14 Linnet Close, citing EV-006."]),
             ("OB-2-4", "Capture the public post about the parcel", False, C_captured("PG-001"),
              ["Search the web browser for the street name.", "Use Capture, not a screenshot.", "Search 'Linnet Close parcel' and capture PG-001."]),
             ("OB-2-5", "Give your assessment of where the parcel most likely is", True, C_finding("KF-04"),
              ["Bring the photo, the doorbell log and the post together.", "Use cautious wording and label it an inference.", "Record that it was most likely left at number 14 by mistake."]),
             ("OB-2-6", "Sign the legality, necessity and proportionality statement", True, C_legality(),
              ["Open the Report tab.", "Write a sentence for each part.", "Fill in all three parts and sign."])],
            unlock=C_objectives("S1"), unlock_text="Opens when the required stage 1 objectives are complete.", osint_pages=["PG-001", "PG-002", "PG-003"])

    # ------------------------------------------------------------------ solution
    c.finding("KF-01", "The courier marked the parcel delivered at 15:37 true time; the handheld shows 15:42 because it runs 5 minutes fast.", "fact",
              ["EV-005", "EV-008"], [["15:37", "5 min", "five min", "fast", "corrected"]], "Correcting device clocks keeps the timeline honest.",
              min_sources=1, skill="evidence")
    c.finding("KF-02", "The order record and the label both show 41 Linnet Close, so the shop addressed the parcel correctly.", "fact",
              ["EV-002", "EV-004"], [["41"], ["label", "order", "address"]], "The mistake did not happen at the shop.", required=False, skill="analysis")
    c.finding("KF-03", "The delivery photo and its GPS record show the parcel was left at number 14, not 41.", "fact",
              ["EV-006"], [["14"], ["photo", "gps", "door", "left"]], "The photo is the courier's own record of where the parcel went.", min_sources=1, skill="analysis")
    c.finding("KF-04", "The parcel was most likely left at 14 Linnet Close by mistake, with the house number's digits swapped.", "inference",
              ["EV-006", "EV-013", "PG-001", "EV-002"], [["14"], ["likely", "probably", "most likely", "mistake", "swapped", "mixed up"]],
              "Several independent sources agree. It is still an inference until someone checks with number 14.", skill="reporting")
    c.finding("KF-05", "The customer's doorbell camera recorded nobody at the door between 13:02 and 17:20 on Tuesday.", "fact",
              ["EV-013", "EV-007"], [["doorbell", "camera"], ["nobody", "no one", "no motion", "no visitor", "nothing"]],
              "Independent data supports the customer's account.", required=False, min_sources=1, skill="analysis")
    c.finding("KF-06", "A resident of number 14 posted on Bayboard that evening about a parcel for someone else on their step.", "fact",
              ["PG-001"], [["bayboard", "post", "posted"], ["14", "wrong house", "someone else"]],
              "Public posts can confirm what records suggest, once captured properly.", required=False, min_sources=1, skill="osint")
    c.finding("KF-07", "Pebble and Pine Garden Design in Saltmarsh is a different business with a similar name.", "fact",
              ["PG-002", "PG-003"], [["saltmarsh", "garden"], ["different", "not the same", "unrelated", "similar"]],
              "Same name, different business: always rule out false matches.", required=False, min_sources=1, skill="osint")
    c.link("ENT-PARCEL", "ENT-ADDR14", ["EV-006", "PG-001"], "Left here by the driver")
    c.link("ENT-PARCEL", "ENT-ADDR41", ["EV-002", "EV-004"], "Addressed here")
    c.link("ENT-N14", "ENT-ADDR14", ["PG-001"], "Lives here")
    c.link("ENT-DRV", "ENT-PARCEL", ["EV-005", "EV-008"], "Delivered it")
    c.event("TL-0", "2026-02-04 09:15", "Customer reports the parcel missing", ["EV-001"], 30, key=False)
    c.event("TL-1", "2026-02-02 16:10", "Parcel packed and labelled", ["EV-003", "EV-004"], 15)
    c.event("TL-2", "2026-02-03 09:30", "Collected by the courier (true time)", ["EV-005"], 10)
    c.event("TL-3", "2026-02-03 15:37", "Marked delivered and left at a front door (true time)", ["EV-005", "EV-006"], 3)
    c.event("TL-4", "2026-02-03 18:47", "Number 14 posts about a parcel for someone else", ["PG-001"], 15, key=False)
    c.herring("RH-1", "The Saltmarsh business with a similar name", ["PG-002"], [["saltmarsh", "garden design"], ["involved", "responsible", "sent", "same"]],
              "It is a landscape gardener in another town with nothing to do with the order.")
    c.gap("GAP-1", "Nobody has yet confirmed that number 14 still has the parcel",
          [["14"], ["confirm", "check", "unknown", "not known", "still has", "not yet", "ask"]])

    S1 = c.statement("EV-007", CUST, "Customer", "2026-02-05", [
        ("I live alone at 41 Linnet Close.", {"place": "LOC-41", "entities": ["ENT-CUST", "ENT-ADDR41"]}),
        ("On Tuesday I was at home all afternoon, from about one until after five.", {"time": "2026-02-03 13:00", "place": "LOC-41", "entities": ["ENT-CUST"]}),
        ("Nobody knocked and nothing was left on the step.", {}),
        ("My front door is blue.", {}),
    ])
    S2 = c.statement("EV-008", DRV, "Courier driver", "2026-02-05", [
        ("I delivered the parcel for Linnet Close at about twenty to four.", {"time": "2026-02-03 15:40", "entities": ["ENT-DRV", "ENT-PARCEL"]}),
        ("The house number was 41. It has a blue door.", {"place": "LOC-41", "entities": ["ENT-ADDR41"]}),
        ("I knocked, nobody answered, so I left it on the step and took a photo.", {}),
        ("Linnet Close is a new street on my route, and I did about ninety drops that day.", {}),
    ])
    c.check(f"{S1}.3", "conflicts", "The customer says nobody came; the driver says he knocked at 41. One of them is mistaken, and the photo shows which. Neither needs to be lying.", other=f"{S2}.3")
    c.check(f"{S1}.3", "supported", "The doorbell camera recorded nobody between 13:02 and 17:20.", evidence=["EV-013"])
    c.check(f"{S2}.1", "supported", "The tracking export, corrected for the fast handheld, gives 15:37.", evidence=["EV-005"])
    c.check(f"{S2}.2", "contradicted", "The delivery photo and GPS show number 14. The driver mixed up the digits on a new street.", evidence=["EV-006"])
    c.check(f"{S1}.4", "agrees", "Both mention a blue door. Number 14's door in the photo is blue too, which helps explain the mix-up.", other=f"{S2}.2")
    c.route("S1", "Log, hash, report", "Log all, Hash all, then report the one item that fails its check.")
    c.route("S1", "Correct the handheld clock", "The tracking times are 5 minutes fast. Correct them before adding them to the timeline.")
    c.route("S2", "Ask for the delivery photo", "One narrow request, with a reason, gets the photo and its GPS.")
    c.route("S2", "Compare the statements", "Customer and driver disagree. The photo resolves it: an honest mix-up of 41 and 14.")
    c.route("S2", "Capture the post and write it up", "Capture PG-001 properly, then record your assessment as an inference with its sources.")
    c.solution["next_steps"] = ("Ask the resident at number 14 to pass the parcel to the customer, or arrange collection; tell the courier so the driver's "
                                "route notes can be corrected; and send the customer an update with an apology.")
    c.solution["story"] = __doc__.split("STORY BIBLE (private, for authors)")[1].strip()
    return c
