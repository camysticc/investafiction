"""Case 2: The Last Signal. OSINT and missing person enquiry, intermediate.

STORY BIBLE (private, for authors)

The missing adult (MP), 29, works at Fernlea Garden Centre and rows at the
Kestrel Bay Rowing Club. Money worries and a draining break-up with an
ex-partner (POI-1) have worn them down. For six weeks MP has spent Tuesday
evenings getting a friend's family cabin ready at Heronmere Lodges (cabin
7, owned by POI-3's family). Nobody else knew. On Thursday 5 March MP
scheduled a Sunday post so friends would not worry, and on 4 March deleted
a post about "my little escape".

On Friday 6 March MP finished work at 17:30, bought fuel at 18:05, left home
with a holdall at 19:40 (the neighbour's doorbell clock runs 3 minutes
fast), passed the Harbour Road camera at 19:52 and the Quarry Road camera
northbound at 20:31. At 20:14 MP messaged a friend (POI-2): "Going off grid
for a bit." The phone last registered on the Heronmere cell at 22:40 and
has been off since. On Saturday at 10:12 MP paid by card at Heronmere Farm
Shop. MP is safe and chose to go. This is a welfare enquiry, not a crime.

POI-1 says he was at home all Friday evening. ANPR shows his van going
north on Quarry Road at 22:10 and returning at 23:20. He went to find MP to
argue about money owed, failed to find the cabin and drove home. He also
uses a second, unregistered number, which appears in his own marketplace
listing, and called MP from it on Thursday and Friday.

Red herrings: a Bayboard user with the same handle (an unrelated person in
another town); an old marina photo tagged Saltings Park from last summer; a
friend's Saturday brunch post that was scheduled days earlier; a heated
rowing club argument about crew selection; a white van outside MP's home
that was a courier.
"""
from datetime import timedelta

from invtools import art
from invtools.casekit import (C_all, C_captured, C_finding, C_graded, C_legality, C_link, C_objectives, C_received,
                              C_request, C_timeline, C_hashed, Case)
from invtools.gen import Gen, iso, t

SEED = 2202


def make_case() -> Case:
    g = Gen(SEED)
    c = Case(id="the-last-signal", title="The Last Signal", version="1.0.0", specialty="OSINT and missing person enquiry",
             difficulty="Intermediate", minutes=150, seed=SEED,
             summary="An adult has not been seen for five days. Build a pattern of life from their digital footprint, "
                     "phone and movements, test what people say, and recommend where enquiries should focus first.")
    MP, P1, P2, P3, P4 = g.name(), g.name(), g.name(), g.name(), g.name()
    W1, W2, W3, W4 = g.name(), g.name(), g.name(), g.name()
    UNREL = g.name()
    sur = lambda n: n.split(" ", 1)[1]
    first = lambda n: n.split(" ", 1)[0]
    handle = (first(MP)[:5] + "_" + sur(MP)[0] + "x").lower()
    MP_mob, P1_mob, P2_mob, P3_mob, P4_mob, W1_mob, PX = (g.mobile() for _ in range(7))
    MP_car, P1_van, COURIER = g.plate(), g.plate(), g.plate()
    other_plates = [g.plate() for _ in range(60)]
    CO = "Fernlea Garden Centre"
    CLUB = "Kestrel Bay Rowing Club"

    c.brief = f"""
# The Last Signal

**{MP}**, aged 29, has not been seen or heard from since the evening of **Friday 6 March 2026**. Their parent, {W1}, reported them missing on Tuesday 10 March after several days without a reply to messages and calls.

{first(MP)} lives alone in Brackenfield, Kestrel Bay, works at {CO} and is a member of {CLUB}. Their car has not been seen at home since Friday.

This is being handled as a **welfare concern**, not a crime, unless the evidence says otherwise. You are the analyst supporting the case lead. Your job is to build a pattern of life, establish the last confirmed contact, work out who was in touch with {first(MP)}, test what people say against the data, and recommend where enquiries should focus first.

Work within your authority. Public pages are open to you. Private material needs specific authority. Collect only what the enquiry needs, and handle the people in this case with care.

*All people, places, platforms and data in this case are fictional.*
"""
    c.intake = {
        "tasking": f"Support the missing person enquiry for {MP}: build a timeline and pattern of life, establish the last confirmed contact, "
                   "assess the welfare risk, identify contacts, and recommend priority locations for enquiries.",
        "scope": [f"Material about {MP} supplied by family, friends, the employer and the club",
                  f"Public online material about {MP} and the people who were in contact with them",
                  "Requests for communications and location data that are necessary and proportionate"],
        "out_of_scope": ["Private online material without specific authority", "Detailed information about people not connected to the enquiry, including witnesses' families",
                         "Any criminal investigation unless the evidence points to one"],
        "authorities": [{"id": "AUTH-BASE", "label": "Missing person enquiry", "covers": "Examination of supplied material and public online sources"}],
        "constraints": ["Do not contact anyone online.", "Do not use false identities.", "Capture online material properly before relying on it."],
        "clock_start": "2026-03-11T09:00:00Z",
        "case_lead": "Detective Sergeant, Missing Persons Unit",
        "osint_access": "public_and_authorised",
        "subjects": ["ENT-MP"],
    }
    E = c.entity
    E("ENT-MP", "person", MP, role="Missing person", identifiers=[handle], attributes={"age": "29", "home": "Brackenfield"})
    E("ENT-P1", "person", P1, role="Ex-partner")
    E("ENT-P2", "person", P2, role="Friend and colleague")
    E("ENT-P3", "person", P3, role="Friend from the rowing club")
    E("ENT-P4", "person", P4, role="Rowing club member")
    E("ENT-W1", "person", W1, role="Parent (reported missing)")
    E("ENT-W2", "person", W2, role="Garden centre manager")
    E("ENT-W3", "person", W3, role="Neighbour")
    E("ENT-W4", "person", W4, role="Rowing club captain")
    E("ENT-ORG1", "organisation", CO, role="Workplace")
    E("ENT-ORG2", "organisation", CLUB, role="Social club")
    E("ENT-PH-MP", "phone", MP_mob, identifiers=[MP_mob])
    E("ENT-PH-P1", "phone", P1_mob, identifiers=[P1_mob])
    E("ENT-PH-P2", "phone", P2_mob, identifiers=[P2_mob])
    E("ENT-PH-P3", "phone", P3_mob, identifiers=[P3_mob])
    E("ENT-PH-X", "phone", f"{PX} (unregistered)", identifiers=[PX], hidden_until="S3")
    E("ENT-V-MP", "vehicle", f"Car {MP_car}", identifiers=[MP_car])
    E("ENT-V-P1", "vehicle", f"Van {P1_van}", identifiers=[P1_van], hidden_until="S3")
    E("ENT-OA-MP-CHIRP", "online_account", f"@{handle} on Chirp", identifiers=[handle])
    E("ENT-OA-MP-SNAP", "online_account", f"@{handle} on Snapfolio")
    E("ENT-OA-P3-SNAP", "online_account", f"Snapfolio account of {P3}")
    E("ENT-OA-P1-CHIRP", "online_account", f"Chirp account of {P1}")
    E("ENT-ADDR-CABIN", "address", "Heronmere Lodges, cabin 7", hidden_until="S5")

    # ------------------------------------------------------------------ map
    L = lambda id, label, kind, x, y, **kw: dict(id=id, label=label, kind=kind, x=x, y=y, **kw)
    locs = [L("LOC-CAM-1", "Camera 1 High Street", "camera", 3000, 2600), L("LOC-CAM-2", "Camera 2 Harbour Road", "camera", 3150, 3000),
            L("LOC-CAM-3", "Camera 3 Ring Road east", "camera", 4700, 2300), L("LOC-CAM-4", "Camera 4 Moor Lane", "camera", 5000, 2000),
            L("LOC-CAM-5", "Camera 5 Quarry Road north", "camera", 2350, 1150), L("LOC-CAM-6", "Camera 6 Marina", "camera", 4100, 3450),
            L("LOC-KB-CENTRAL", "Cell KB-CENTRAL", "cell_site", 3100, 2500, radius=900), L("LOC-KB-HARBOUR", "Cell KB-HARBOUR", "cell_site", 3300, 3300, radius=700),
            L("LOC-KB-MOOR", "Cell KB-MOOR", "cell_site", 5200, 1600, radius=1000), L("LOC-KB-NORTH", "Cell KB-NORTH", "cell_site", 2500, 1500, radius=900),
            L("LOC-KB-HERON", "Cell KB-HERON", "cell_site", 1500, 600, radius=800), L("LOC-KB-BRACKEN", "Cell KB-BRACKEN", "cell_site", 4100, 3000, radius=700),
            L("LOC-HOME", "MP home", "address", 4150, 3050), L("LOC-WORK", CO, "address", 4600, 2450),
            L("LOC-P1-HOME", "Ex-partner's home", "address", 2700, 3150, stage="S4"), L("LOC-CLUB", CLUB, "address", 3600, 3420),
            L("LOC-FUEL", "Harbour Fuel", "point", 3200, 2850), L("LOC-FARM", "Heronmere Farm Shop", "point", 1900, 900),
            L("LOC-TOWER", "Gullstone water tower", "point", 2550, 760), L("LOC-CABIN", "Heronmere Lodges cabin 7", "address", 1300, 520, stage="S5")]
    c.map = art.kestrel_bay_map(locs)

    # ------------------------------------------------------------------ STAGE 1
    c.document("EV-001", "Missing person report", "document", f"""
# Missing person report

| Field | Detail |
|---|---|
| Name | {MP} |
| Age | 29 |
| Reported by | {W1} (parent), Tuesday 10 March 2026, 18:20 |
| Last seen | Friday 6 March 2026, evening, leaving home in Brackenfield |
| Vehicle | Small blue hatchback, registration {MP_car} |
| Mobile | {MP_mob} (switched off since the weekend) |
| Work | {CO}, Monday to Friday |
| Health | No known physical health concerns. Recently stressed and tired, according to family. |
| Out of character? | Yes for not replying for days. Not unusual to go quiet for a day. |

## Initial risk factors noted by the call handler

- Has gone several days without contact, which family say is unusual.
- Recent break-up and money worries mentioned by the parent.
- No known threats, no history of going missing, no known plans to travel abroad.
- Took the car and, according to a neighbour, a holdall.
""", source="Call handler, missing person report", source_group="report", acquired="2026-03-10 18:40", stage="S1",
        summary="The original report with the first risk factors.", grade=("B", "2"))
    c.document("EV-002", f"Statement: {W1} (parent)", "statement", f"""
# Statement

**Name:** {W1}
**Relationship:** Parent

{first(MP)} is a kind, private person. We speak most days. The last message I had from {first(MP)} was on Friday afternoon at about four, saying they were tired and looking forward to the weekend.

On Monday {P2}, a friend from work, rang me. {first(P2)} said {first(MP)} had sent a message on Friday evening, about quarter past eight, saying they were "going off grid for a bit" and asking {first(P2)} to tell me they were okay. I did not know anything about this. It is not like {first(MP)} to go away without telling me.

{first(MP)} split up with {P1} at Christmas. It was not a nice break-up. There was an argument about money that {first(P1)} says {first(MP)} owes. I do not know of any threats.

{first(MP)}'s close friends are {P2} from work and {P3} from the rowing club. They use Chirp and Snapfolio. I do not know their passwords.
""", source="Witness", source_group="witness-w1", acquired="2026-03-10 19:30", stage="S1", grade=("B", "2"),
        summary="The parent's account, including what a friend told them about a Friday message.")
    c.document("EV-003", f"Statement: {W3} (neighbour)", "statement", f"""
# Statement

**Name:** {W3}
**Relationship:** Neighbour, lives opposite

On Friday evening, I think about half seven or just after, I saw {first(MP)} come out of the house with a big holdall and put it in the boot of the blue car, then drive off. They seemed in a hurry but not upset.

Around the same time there was a white van parked a couple of doors down. I did not see the driver properly. I have never seen it before.

I have a doorbell camera. I have given the officer the log from that evening.
""", source="Witness", source_group="witness-w3", acquired="2026-03-11 08:30", stage="S1", grade=("C", "2"),
        summary="The neighbour saw MP leave with a holdall, and noticed a white van.")
    rota = [[d, "08:30-17:30" if wd < 5 else "", "Tills and plants"] for d, wd in
            [((t("2026-02-23 00:00") + timedelta(days=i)).strftime("%Y-%m-%d"), (t("2026-02-23 00:00") + timedelta(days=i)).weekday()) for i in range(19)]]
    c.table("EV-004", f"{CO} staff rota for {MP}", "rota", ["date", "shift", "role"], rota, table={"time_column": "date"},
            source=CO, source_group="workplace", acquired="2026-03-11 08:45", stage="S1", summary="Shifts over the last three weeks.", grade=("B", "2"))
    till = []
    for i in range(19):
        d = t("2026-02-23 08:25") + timedelta(days=i)
        if d.weekday() < 5 and d < t("2026-03-07 00:00"):
            till.append([iso(d + timedelta(minutes=g.randint(0, 8))), "TILL-2", first(MP).lower(), "log on"])
            till.append([iso(d.replace(hour=17, minute=20) + timedelta(minutes=g.randint(0, 9))), "TILL-2", first(MP).lower(), "log off"])
    c.table("EV-005", f"{CO} till log-ins", "login_log", ["time_utc", "till", "user", "event"], till, table={"time_column": "time_utc"},
            source=CO, source_group="workplace-till", acquired="2026-03-11 08:45", stage="S1", summary="When MP logged on and off the till.", grade=("A", "1"))
    c.document("EV-006", "Vehicle keeper record", "document", f"""
# Vehicle keeper record (fictional registry)

| Registration | {MP_car} |
|---|---|
| Make and colour | Small hatchback, blue |
| Keeper | {MP} |
| Address | Brackenfield, Kestrel Bay |
| Insurance | Valid |
| Markers | None |
""", source="Vehicle registry", source_group="registry", acquired="2026-03-11 09:00", stage="S1", grade=("A", "1"),
        summary="Confirms the car registered to MP.")
    c.document("EV-007", "Missing person risk grading guide (training version)", "document", """
# Risk grading for missing person enquiries (simplified training version)

This is a teaching summary, not official guidance.

- **High risk.** The risk of serious harm appears very likely. Immediate action is needed.
- **Medium risk.** The risk of harm is likely, but not serious or imminent. Active enquiries are needed.
- **Low risk.** The risk of harm is possible but minimal.

Things that raise risk: threats, vulnerability, behaviour that is very out of character, signs of crime, no money or transport, poor weather.

Things that lower risk: a planned departure, a message saying the person is safe, access to money and transport, signs of normal activity.

Review the grading every time new information arrives. State the reasons for the grade.
""", source="Training material", source_group="guidance", acquired="2026-03-11 09:00", stage="S1", grade=("A", "1"),
        summary="How to grade welfare risk, in simplified form.")
    c.document("EV-008", f"Statement: {W2} (garden centre manager)", "statement", f"""
# Statement

**Name:** {W2}
**Role:** Manager, {CO}

{first(MP)} worked on Friday 6 March until half five. They seemed quiet. They asked me on Thursday if they could take some of their holiday at short notice. I said we would talk about it on Monday. They did not come in on Monday.

{first(MP)} is reliable. They are friends with {P2}, who also works here.
""", source="Witness", source_group="witness-w2", acquired="2026-03-11 09:10", stage="S1", grade=("B", "2"),
        summary="The manager on the last shift and a request for short-notice leave.")
    c.image("EV-009", "Photograph supplied by family (placeholder)", art.silhouette(), source=f"{W1}", source_group="family",
            acquired="2026-03-10 19:30", stage="S1", noise=True, summary="The family's photo. Shown as a silhouette in this pack.",
            metadata={"Note": "Real faces are never used in Investafiction packs."}, grade=("B", "2"))
    p2_phone = {
        "device": {"Owner": P2, "Number": P2_mob, "Model": "Generic smartphone", "Extraction": "Logical extraction with the owner's written consent, 10 March 2026",
                   "Examiner": "Digital media investigator", "Time zone setting": "UTC"},
        "contacts": [{"name": MP, "number": MP_mob}, {"name": W2, "number": g.mobile()}, {"name": P3, "number": P3_mob}, {"name": "Mum", "number": g.mobile()}],
        "messages": [
            {"app": "Natter", "thread": MP, "from": MP, "to": "owner", "time": "2026-03-04T19:12:00Z", "text": "Tuesday was lovely. Quiet. Needed that."},
            {"app": "Natter", "thread": MP, "from": "owner", "to": MP, "time": "2026-03-04T19:20:00Z", "text": "Good. You never tell me where you go on Tuesdays 👀"},
            {"app": "Natter", "thread": MP, "from": MP, "to": "owner", "time": "2026-03-04T19:21:00Z", "text": "Everyone needs their secrets"},
            {"app": "Natter", "thread": MP, "from": MP, "to": "owner", "time": "2026-03-05T22:02:00Z", "text": f"{first(P1)} keeps ringing about the money. I can't do this anymore. I need some space."},
            {"app": "Natter", "thread": MP, "from": "owner", "to": MP, "time": "2026-03-05T22:05:00Z", "text": "Block him. Do you want to come round?"},
            {"app": "Natter", "thread": MP, "from": MP, "to": "owner", "time": "2026-03-05T22:09:00Z", "text": "I blocked him. He'll find another way. I'm fine, just tired"},
            {"app": "Natter", "thread": MP, "from": MP, "to": "owner", "time": "2026-03-06T20:14:00Z", "text": "Going off grid for a bit. Don't worry. Tell mum I'm ok if she asks x"},
            {"app": "Natter", "thread": MP, "from": "owner", "to": MP, "time": "2026-03-06T20:40:00Z", "text": "Where are you going?? Text me when you get there"},
            {"app": "Natter", "thread": MP, "from": "owner", "to": MP, "time": "2026-03-07T11:03:00Z", "text": "Hello?"},
            {"app": "Natter", "thread": MP, "from": "owner", "to": MP, "time": "2026-03-09T08:15:00Z", "text": "Please just let me know you're ok"},
            {"app": "SMS", "thread": "Mum", "from": "Mum", "to": "owner", "time": "2026-03-06T17:30:00Z", "text": "Tea on Sunday?"},
            {"app": "Natter", "thread": P3, "from": "owner", "to": P3, "time": "2026-03-09T08:20:00Z", "text": f"Have you heard from {first(MP)}?"},
            {"app": "Natter", "thread": P3, "from": P3, "to": "owner", "time": "2026-03-09T12:44:00Z", "text": "I'm sure they're fine. Try not to worry"},
        ],
        "calls": [{"time": "2026-03-07T11:05:00Z", "number": MP_mob, "direction": "outgoing", "duration_s": 0, "name": MP},
                  {"time": "2026-03-09T08:16:00Z", "number": MP_mob, "direction": "outgoing", "duration_s": 0, "name": MP}],
    }
    c.json_item("EV-010", f"Phone extraction: {P2}'s phone (consent)", "phone_extraction", p2_phone, source=f"{P2}, voluntary",
                source_group="phone-p2", acquired="2026-03-10 16:00", stage="S1", grade=("A", "2"),
                summary="Messages between the friend and MP, including the Friday evening message.")
    db_rows = [["2026-03-06 19:38:41", "motion", "front path"], ["2026-03-06 19:43:05", "motion", "person carrying bag to car"],
               ["2026-03-06 19:43:52", "motion", "vehicle leaving"], ["2026-03-06 19:36:10", "motion", "van passing"],
               ["2026-03-06 19:39:30", "motion", "van passing"], ["2026-03-06 21:12:44", "motion", "cat"], ["2026-03-07 07:58:02", "motion", "post delivery"]]
    db_rows.sort()
    c.table("EV-011", f"Doorbell camera log: {W3}'s door", "camera_log", ["device_time", "event", "label"], db_rows,
            table={"time_column": "device_time", "description_columns": ["label"]}, source=W3, source_group="doorbell-w3",
            acquired="2026-03-11 08:30", stage="S1", clock_offset_minutes=3,
            clock_note="The officer checked the device against a known clock: it runs 3 minutes fast.",
            summary="Motion events from the neighbour's doorbell camera.", grade=("A", "2"))
    for eid, title, body in [
        ("EV-012", f"{CO} staff newsletter, March", "Spring planting starts next week. The café is closed for refit on 16 to 18 March. Well done to the tills team for the best February on record."),
        ("EV-013", "Weather summary, 6 to 10 March", "Dry and mild on Friday, light rain Saturday, clear and cold Sunday to Tuesday. No severe weather warnings."),
        ("EV-014", "Bus timetable change notice", "From 2 March the number 4 bus no longer runs past Quarry Road after 19:00."),
        ("EV-015", f"{CLUB} fixture list", "Monday and Thursday evening training. Regatta on 21 March. Crew lists posted on the noticeboard."),
    ]:
        c.document(eid, title, "document", f"# {title}\n\n{body}", source="Supplied with the report", source_group="misc-" + eid,
                   acquired="2026-03-11 09:00", stage="S1", noise=True, summary=title, grade=("B", "2"))
    c.table("EV-016", "Residents list for the whole street (supplied unasked)", "spreadsheet", ["house", "name", "phone", "notes"],
            [[str(i), g.name(), g.mobile(), g.choice(["", "elderly", "two children", "works nights", ""])] for i in range(1, 25)],
            source=f"{W3}, unrequested", source_group="neighbour-list", acquired="2026-03-11 08:30", stage="S1", marking="personal",
            handling="The neighbour handed over a list of everyone in the street. It is not needed for this enquiry. Personal data about people with no connection should not be examined.",
            summary="Names and numbers of every household in the street.", grade=("C", "3"))

    # ------------------------------------------------------------------ STAGE 2: digital footprint
    c.document("EV-017", f"Statement: {W4} (rowing club captain)", "statement", f"""
# Statement

**Name:** {W4}
**Role:** Captain, {CLUB}

{first(MP)} trains on Mondays and Thursdays. They missed Monday 9 March without telling anyone, which is unusual.

There was a row in the club group chat last week between {first(MP)} and {P4} about who gets the stroke seat in the regatta crew. It got heated. {first(P4)} can be hot-headed but I would be very surprised if it meant anything more.

{first(MP)} is close to {P3}. They often travel to regattas together.
""", source="Witness", source_group="witness-w4", acquired="2026-03-11 10:00", stage="S2", grade=("B", "3"),
        summary="The club captain on training, a group chat argument and close friends.")
    chat = [["2026-03-03 20:41", P4, "Stroke seat should be on times, not on who the captain likes."],
            ["2026-03-03 20:43", MP, "My times are better than yours and you know it"],
            ["2026-03-03 20:44", P4, "Some people think they own the boat"],
            ["2026-03-03 20:47", W4, "Enough. Crew list goes up Thursday. Train hard."],
            ["2026-03-03 20:50", P4, "Fine. Sorry for the rant."],
            ["2026-03-05 21:10", W4, "Crew list is up. Well done all."],
            ["2026-03-05 21:16", P4, f"Congrats {first(MP)} 👏"]]
    c.table("EV-018", f"{CLUB} group chat export (3 to 5 March)", "spreadsheet", ["time_utc", "from", "message"], chat,
            table={"time_column": "time_utc"}, source=W4, source_group="club-chat", acquired="2026-03-11 10:00", stage="S2",
            summary="The rowing club group chat, including the argument.", grade=("B", "2"))
    c.document("EV-019", "Online accounts known to the family", "document", f"""
# Online accounts named by {W1}

- Chirp: **@{handle}**
- Snapfolio: **@{handle}**
- {first(MP)} does not use any other social media "as far as I know".
- Email: {first(MP).lower()}.{sur(MP).lower()}@example.net
""", source=W1, source_group="witness-w1", acquired="2026-03-11 10:15", stage="S2", grade=("B", "2"),
        summary="The handles the family know about.")
    c.document("EV-020", f"{CLUB} newsletter", "document", "# Club news\n\nNew boat shed lights fitted. Subs are due by the end of March. The quiz night raised £410.",
               source=CLUB, source_group="club-news", acquired="2026-03-11 10:00", stage="S2", noise=True, summary="Club newsletter.", grade=("B", "2"))
    c.table("EV-021", f"{CO} customer complaints log", "spreadsheet", ["date", "issue", "resolved"],
            [[(t("2026-02-01 00:00") + timedelta(days=g.randint(0, 35))).strftime("%Y-%m-%d"), g.choice(["Dead plant", "Long queue", "Wrong price", "Parking"]), g.choice(["Yes", "No"])] for _ in range(14)],
            source=CO, source_group="workplace-complaints", acquired="2026-03-11 09:00", stage="S2", noise=True, summary="Customer complaints.", grade=("B", "2"))

    # Simulated web
    c.site("chirp", "Chirp", "chirp.test", "social", "#1d7a8c", "Say it short")
    c.site("snapfolio", "Snapfolio", "snapfolio.test", "photo", "#b8456b", "Your life in pictures")
    c.site("linkline", "Linkline", "linkline.test", "business", "#2c4f8a", "Work profiles and businesses")
    c.site("bayboard", "Bayboard", "bayboard.test", "community", "#7a5a1f", "Kestrel Bay's community board and marketplace")
    c.site("lodges", "Heronmere Lodges", "heronmere-lodges.test", "business", "#3f5b3a", "Woodland cabins")
    c.site("baynews", "Bay Gazette", "bay-gazette.test", "news", "#6b1f1f", "Local news")
    img = lambda path, svg, meta=None: c.osint_image(path, svg, meta)
    img("osint/cabin-view.svg", art.cabin_view(), {"Note": "Metadata stripped by Snapfolio on upload"})
    img("osint/marina.svg", art.marina_view(), {"Note": "Metadata stripped by Snapfolio on upload"})
    img("osint/tower-road.svg", art.tower_road_view(), {"Camera": "Mirrorless camera", "Taken": "2025-10-12 15:40", "Location tag": "Lodge Track, Heronmere"})
    img("osint/p3-cabin.svg", art.cabin_view(sign=False, dusk=True), {"Note": "Metadata stripped by Snapfolio on upload"})
    img("osint/avatar-mp.svg", art.silhouette("#4c7a6b"))
    img("osint/avatar-p1.svg", art.silhouette("#6b5a4c", "#1f1a17"))
    img("osint/avatar-p3.svg", art.silhouette("#7a4c6b", "#3a2a1a"))
    img("osint/landscape.svg", art.landscape("Saltings at dawn"))
    P = c.page
    P(id="PG-001", site="chirp", url=f"https://chirp.test/{handle}", kind="profile", title=f"{MP} (@{handle})", handle=handle, display_name=MP,
      avatar="osint/avatar-mp.svg", bio="Plants, rowing, tea. Kestrel Bay.", fields={"Joined": "2019", "Location": "Kestrel Bay"},
      posts=[{"id": "c1", "time": "2026-03-08T10:00:00Z", "text": "Sunday reset. Coffee, plants, quiet. ☕🌿 (posted via Chirp Scheduler)", "scheduled": True, "likes": 9},
             {"id": "c2", "time": "2026-03-05T20:31:00Z", "text": "Long week. Need trees.", "likes": 4, "comments": [{"by": P3, "text": "Soon x"}]},
             {"id": "c3", "time": "2026-03-01T12:10:00Z", "text": "Regatta crew training is brutal and I love it", "likes": 12},
             {"id": "c4", "time": "2026-02-14T18:00:00Z", "text": "Treat yourself kindly today.", "likes": 21}],
      links=["PG-002"], search_terms=[MP, handle, first(MP), sur(MP), "kestrel bay"])
    P(id="PG-002", site="snapfolio", url=f"https://snapfolio.test/@{handle}", kind="profile", title=f"{MP} on Snapfolio", handle=handle, display_name=MP,
      avatar="osint/avatar-mp.svg", bio="Little moments 🌿", fields={"Posts": "34", "Followers": "212"},
      posts=[{"id": "s1", "time": "2026-02-24T19:05:00Z", "text": "Tuesday ritual 🌲", "image": "osint/cabin-view.svg", "likes": 18, "comments": [{"by": P3, "text": "Best view going"}, {"by": P2, "text": "WHERE is this"}]},
             {"id": "s2", "time": "2026-02-10T19:20:00Z", "text": "Same place, same peace", "likes": 15},
             {"id": "s3", "time": "2025-07-19T14:00:00Z", "text": "Summer at the marina ⛵", "image": "osint/marina.svg", "location_tag": "Saltings Park, Kestrel Bay", "likes": 40}],
      snapshots=[{"captured": "2026-03-03T23:00:00Z", "note": "Archived copy. Shows a post deleted on 4 March.",
                  "posts": [{"id": "s0", "time": "2026-03-02T20:00:00Z", "text": "Counting down to my little escape. Nobody will find me there 😌 #heronmere", "likes": 3},
                            {"id": "s1", "time": "2026-02-24T19:05:00Z", "text": "Tuesday ritual 🌲", "image": "osint/cabin-view.svg", "likes": 17}]}],
      links=["PG-001"], search_terms=[MP, handle, first(MP), sur(MP)])
    P(id="PG-003", site="linkline", url=f"https://linkline.test/in/{first(MP).lower()}-{sur(MP).lower()}", kind="profile", title=f"{MP} - Linkline", display_name=MP,
      bio=f"Plant care and retail at {CO}.", fields={"Experience": f"{CO}, 2021 to now", "Education": "Horticulture diploma"},
      search_terms=[MP, first(MP), sur(MP), "fernlea"])
    P(id="PG-004", site="bayboard", url="https://bayboard.test/t/missing-appeal", kind="page", title=f"Please share: have you seen {first(MP)}?",
      body=f"Posted by {W1}, 10 March. {first(MP)} has not been seen since Friday evening. Blue hatchback {MP_car}. Please contact the police if you have seen them.",
      posts=[{"id": "b1", "time": "2026-03-10T21:00:00Z", "text": "Shared. Hope they're found safe.", "likes": 6},
             {"id": "b2", "time": "2026-03-10T21:30:00Z", "text": "Think I saw a blue car like that at the Saturday market? Not sure.", "likes": 1},
             {"id": "b3", "time": "2026-03-11T07:10:00Z", "text": "Sending love to the family", "likes": 8}],
      search_terms=[MP, first(MP), "missing", MP_car])
    P(id="PG-005", site="chirp", url=f"https://chirp.test/{first(P1).lower()}{sur(P1).lower()[:3]}", kind="profile", title=f"{P1} on Chirp",
      handle=f"{first(P1).lower()}{sur(P1).lower()[:3]}", display_name=P1, avatar="osint/avatar-p1.svg", bio="Vans, football, more football.",
      posts=[{"id": "p1", "time": "2026-03-06T21:00:00Z", "text": "Quiet night in, football on 📺", "likes": 2},
             {"id": "p2", "time": "2026-03-04T17:00:00Z", "text": "Some people need to learn to pay back what they owe.", "likes": 0},
             {"id": "p3", "time": "2026-02-20T12:00:00Z", "text": "Van's running sweet after the service.", "likes": 3}],
      search_terms=[P1, first(P1), sur(P1)])
    P(id="PG-006", site="bayboard", url="https://bayboard.test/m/roof-rack", kind="page", title="For sale: van roof rack, good condition",
      body=f"Fits most small vans. £40 or near offer. Collection from the Old Harbour area. Call or text **{PX}**. Seller: {first(P1)} {sur(P1)[0]}.",
      fields={"Posted": "2026-02-27", "Category": "Vehicles and parts"}, search_terms=["roof rack", "van", PX, first(P1), PX.replace(" ", "")])
    P(id="PG-007", site="snapfolio", url=f"https://snapfolio.test/@{first(P3).lower()}.{sur(P3).lower()}", kind="profile", title=f"{P3} on Snapfolio",
      handle=f"{first(P3).lower()}.{sur(P3).lower()}", display_name=P3, avatar="osint/avatar-p3.svg", private=True, bio="Rower. Family cabin weekends.",
      posts=[{"id": "q1", "time": "2026-03-07T18:30:00Z", "text": "Lent the cabin to someone who needed some quiet. Look after yourself x", "image": "osint/p3-cabin.svg", "likes": 5},
             {"id": "q2", "time": "2025-09-14T16:00:00Z", "text": "Cabin 7 sunsets never get old. Heronmere magic.", "image": "osint/p3-cabin.svg", "likes": 30}],
      search_terms=[P3, first(P3), sur(P3)])
    P(id="PG-008", site="chirp", url=f"https://chirp.test/{first(P3).lower()}_rows", kind="profile", title=f"{P3} (@{first(P3).lower()}_rows)",
      handle=f"{first(P3).lower()}_rows", display_name=P3, avatar="osint/avatar-p3.svg", bio="Rowing. Coffee. Quiet weekends.",
      posts=[{"id": "r1", "time": "2026-03-01T09:00:00Z", "text": "Early outing on the river. Glassy water.", "likes": 7}],
      snapshots=[{"captured": "2025-06-01T12:00:00Z", "note": "Archived copy of the profile from last summer.", "bio": "Rowing. Coffee. Our family's cabin at Heronmere Lodges (no. 7) is free for summer lets, DM me."}],
      search_terms=[P3, first(P3), sur(P3)])
    P(id="PG-009", site="chirp", url=f"https://chirp.test/{first(P4).lower()}rows", kind="profile", title=f"{P4} on Chirp", handle=f"{first(P4).lower()}rows",
      display_name=P4, bio="Stroke side forever.", posts=[{"id": "x1", "time": "2026-03-03T21:00:00Z", "text": "Some people think they own the boat. Rant over.", "likes": 1},
                                                         {"id": "x2", "time": "2026-03-07T09:00:00Z", "text": "Regatta prep. Two weeks to go.", "likes": 4}],
      search_terms=[P4, first(P4), sur(P4)])
    P(id="PG-010", site="snapfolio", url=f"https://snapfolio.test/@{first(P2).lower()}{sur(P2).lower()[:2]}", kind="profile", title=f"{P2} on Snapfolio",
      handle=f"{first(P2).lower()}{sur(P2).lower()[:2]}", display_name=P2, bio="Plants and people.",
      posts=[{"id": "y1", "time": "2026-03-07T11:00:00Z", "text": f"Brunch with my favourite people 💛 @{handle} (posted via scheduler, drafted Wednesday)", "scheduled": True, "likes": 11},
             {"id": "y2", "time": "2026-02-28T13:00:00Z", "text": "Repotting day.", "likes": 5}],
      search_terms=[P2, first(P2), sur(P2)])
    P(id="PG-011", site="bayboard", url=f"https://bayboard.test/u/{handle}", kind="profile", title=f"@{handle} on Bayboard", handle=handle,
      display_name=f"{UNREL.split()[0]} K.", bio="Cat sitting and dog walking in Moorend Vale (not Kestrel Bay). 12 years' experience.",
      fields={"Member since": "2018", "Area": "Moorend Vale, 40 miles north"},
      posts=[{"id": "u1", "time": "2026-03-08T15:00:00Z", "text": "Available for cat sitting over Easter in Moorend Vale.", "likes": 2}],
      search_terms=[handle, "cat sitting"])
    P(id="PG-012", site="snapfolio", url=f"https://snapfolio.test/@{first(MP).lower()}.paints", kind="profile", title=f"{first(MP)} paints", display_name=f"{first(MP)} {g.name().split()[1]}",
      bio="Watercolours. Coastal towns.", posts=[{"id": "z1", "time": "2026-03-06T19:00:00Z", "text": "New harbour sketch.", "image": "osint/landscape.svg"}],
      search_terms=[first(MP), "paints"])
    P(id="PG-013", site="linkline", url="https://linkline.test/company/fernlea-garden-centre", kind="page", title=f"{CO}",
      body=f"Family-run garden centre in Fernlea, Kestrel Bay. Staff include {W2} (manager), {P2} and {MP}.", search_terms=["fernlea", "garden centre", CO])
    P(id="PG-014", site="lodges", url="https://heronmere-lodges.test/", kind="page", title="Heronmere Lodges: woodland cabins",
      body="Nine private cabins in Heronmere Woods, reached by Lodge Track off Quarry Road. Cabins 5 to 9 face east, with views across the woods to the old **Gullstone water tower**. Cabins are privately owned. The entrance sign reads *Residents only*.\n\nNearest shop: Heronmere Farm Shop, Heron Lane.",
      links=["PG-015"], search_terms=["heronmere", "lodges", "cabins", "gullstone", "heronmere woods"])
    P(id="PG-015", site="bayboard", url="https://bayboard.test/t/heronmere-residents", kind="page", title="Heronmere Lodges residents' board",
      posts=[{"id": "h1", "time": "2026-03-07T08:15:00Z", "text": "Anyone else hear a van revving at the top gate on Friday night, around 10? Drove round twice then went.", "likes": 3},
             {"id": "h2", "time": "2026-03-07T09:00:00Z", "text": "Heard it too. Didn't see the number plate.", "likes": 1},
             {"id": "h3", "time": "2026-03-05T12:00:00Z", "text": "Gate code changes next month.", "likes": 0}],
      search_terms=["heronmere", "residents", "lodges"])
    P(id="PG-016", site="baynews", url="https://bay-gazette.test/2024/water-tower", kind="page", title="Old water tower gets a new coat",
      body="The disused water tower at Gullstone Quarry has been repainted, with GULLSTONE in large red letters for the first time since the 1970s. It can be seen for miles across Heronmere Woods.",
      search_terms=["gullstone", "water tower", "tower"])
    P(id="PG-017", site="snapfolio", url="https://snapfolio.test/@kestrel_lens", kind="profile", title="Kestrel Lens (landscape photographer)", display_name="Kestrel Lens",
      bio="Landscapes around the bay.", posts=[{"id": "k1", "time": "2025-10-12T16:00:00Z", "text": "The Gullstone tower from Lodge Track, Heronmere.", "image": "osint/tower-road.svg", "location_tag": "Lodge Track, Heronmere", "likes": 77}],
      search_terms=["gullstone", "heronmere", "water tower", "lodge track"])
    P(id="PG-018", site="chirp", url=f"https://chirp.test/{sur(W3).lower()}_family", kind="profile", title=f"A relative of {W3}", display_name=f"{g.name().split()[0]} {sur(W3)}",
      bio="Dad, gardener, darts.", posts=[{"id": "w1", "time": "2026-03-07T20:00:00Z", "text": "Darts night at the Anchor. Lost again.", "likes": 2}],
      search_terms=[sur(W3)])
    P(id="PG-019", site="chirp", url=f"https://chirp.test/{handle}_art", kind="profile", title=f"@{handle}_art", display_name="Pixel art",
      bio="Pixel art commissions. Not affiliated with anyone.", search_terms=[handle, handle + "_art"])
    P(id="PG-020", site="bayboard", url="https://bayboard.test/t/lost-dog", kind="page", title="Lost dog near Saltings Park",
      body="Brown spaniel, answers to Biscuit. Found safe on Sunday, thank you all!", search_terms=["saltings", "dog"])

    # ------------------------------------------------------------------ STAGE 3: phone and movement
    anpr = []
    def read(time, cam, plate, direction):
        anpr.append([time, f"LOC-CAM-{cam}", plate, direction, str(g.randint(88, 99))])
    read("2026-03-06 19:52:10", 2, MP_car, "southbound")
    read("2026-03-06 20:31:44", 5, MP_car, "northbound")
    read("2026-03-06 21:58:02", 1, P1_van, "westbound")
    read("2026-03-06 22:10:37", 5, P1_van, "northbound")
    read("2026-03-06 23:20:15", 5, P1_van, "southbound")
    read("2026-03-06 23:34:50", 1, P1_van, "eastbound")
    read("2026-03-06 19:31:20", 3, COURIER, "southbound")
    read("2026-03-06 19:47:02", 3, COURIER, "northbound")
    for _ in range(170):
        when = t("2026-03-06 17:00") + timedelta(minutes=g.randint(0, 22 * 60))
        read(when.strftime("%Y-%m-%d %H:%M:%S"), g.randint(1, 6), g.choice(other_plates), g.choice(["northbound", "southbound", "eastbound", "westbound"]))
    anpr.sort()
    c.table("EV-022", "ANPR reads, six cameras, 6 to 7 March", "anpr", ["time_utc", "camera", "plate", "direction", "confidence"], anpr,
            table={"time_column": "time_utc", "location_column": "camera", "entity_columns": ["plate"], "description_columns": ["plate", "direction"]},
            source="ANPR system", source_group="anpr", acquired="2026-03-11 13:00", stage="S3",
            summary="Every plate read by the six town cameras from Friday afternoon to Saturday afternoon.", grade=("A", "1"),
            metadata={"Time zone": "UTC", "Clock check": "All six cameras checked against network time, no offset"})
    c.table("EV-023", "ANPR camera register", "spreadsheet", ["camera", "road", "covers"],
            [["LOC-CAM-1", "High Street", "both directions"], ["LOC-CAM-2", "Harbour Road", "both directions"], ["LOC-CAM-3", "Ring Road east", "both directions"],
             ["LOC-CAM-4", "Moor Lane", "both directions"], ["LOC-CAM-5", "Quarry Road north of the ring road. The only road to Heronmere Woods.", "both directions"],
             ["LOC-CAM-6", "Marina Drive", "both directions"]], source="ANPR system", source_group="anpr-register", acquired="2026-03-11 13:00", stage="S3",
            summary="Where each camera is.", grade=("A", "1"))
    bank = []
    bal = 418.20
    cur = t("2026-01-20 00:00")
    while cur < t("2026-03-11 00:00"):
        d = cur.strftime("%Y-%m-%d")
        if cur.weekday() == 1 and cur > t("2026-01-26 00:00"):
            amt = g.money(6, 14)
            bal = round(bal - amt, 2)
            bank.append([d + " 18:" + str(g.randint(10, 40)), "HERONMERE FS HERON LN", f"{amt:.2f}", "", f"{bal:.2f}"])
        if g.chance(0.5):
            amt = g.money(3, 30)
            bal = round(bal - amt, 2)
            bank.append([d + f" {g.randint(8, 19):02d}:{g.randint(0, 59):02d}", g.choice(["KB COOP", "TEA ROOM", "GARDEN CTR STAFF CANTEEN", "KB PHARMACY"]), f"{amt:.2f}", "", f"{bal:.2f}"])
        if cur.day == 27:
            bal = round(bal + 1412.55, 2)
            bank.append([d + " 06:00", f"SALARY {CO.upper()}", "", "1412.55", f"{bal:.2f}"])
        cur += timedelta(days=1)
    for when, desc, amt in [("2026-03-06 18:05", "HARBOUR FUEL KESTREL BAY", 38.40), ("2026-03-07 10:12", "HERONMERE FS HERON LN", 23.65)]:
        bal = round(bal - amt, 2)
        bank.append([when, desc, f"{amt:.2f}", "", f"{bal:.2f}"])
    bank.sort()
    c.table("EV-024", f"Bank card transactions: {MP}", "bank_statement", ["time_utc", "merchant", "paid_out", "paid_in", "balance"], bank,
            table={"time_column": "time_utc", "description_columns": ["merchant"]}, source="Bank, under the missing person welfare protocol",
            source_group="bank-mp", acquired="2026-03-11 14:00", stage="S3", summary="Card spending over the last seven weeks.", grade=("A", "1"))
    tablet_loc = []
    for wk in range(6):
        d = t("2026-01-27 18:20") + timedelta(days=7 * wk)
        for k, (x, y) in enumerate([(4150, 3050), (3200, 2850), (2600, 1900), (2350, 1150), (1900, 900), (1310, 520), (1305, 515), (1312, 522)]):
            tablet_loc.append([iso(d + timedelta(minutes=k * 9 + (40 if k >= 6 else 0))), str(x + g.randint(-15, 15)), str(y + g.randint(-15, 15)), str(g.choice([8, 12, 20])), "gps"])
        tablet_loc.append([iso(d + timedelta(hours=3, minutes=20)), "4150", "3050", "10", "gps"])
    fri = [("2026-03-06 17:31", 4600, 2450), ("2026-03-06 18:04", 3200, 2850), ("2026-03-06 18:30", 4150, 3050), ("2026-03-06 19:45", 4100, 3060),
           ("2026-03-06 19:52", 3150, 3000), ("2026-03-06 20:14", 2600, 1900), ("2026-03-06 20:32", 2350, 1150), ("2026-03-06 20:48", 1900, 900),
           ("2026-03-06 21:05", 1310, 520), ("2026-03-06 22:38", 1305, 518)]
    for when, x, y in fri:
        tablet_loc.append([iso(t(when)), str(x), str(y), "10", "gps"])
    for d in range(10):
        day = t("2026-02-23 08:20") + timedelta(days=d)
        if day.weekday() < 5 and day < t("2026-03-06 00:00"):
            tablet_loc.append([iso(day), "4150", "3050", "10", "gps"])
            tablet_loc.append([iso(day + timedelta(minutes=25)), "4600", "2450", "15", "gps"])
            if day.weekday() in (0, 3):
                tablet_loc.append([iso(day.replace(hour=18, minute=45)), "3600", "3420", "12", "gps"])
    tablet_loc.sort()
    tablet = {
        "device": {"Owner": MP, "Device": "Tablet left at home, signed in to the same cloud account as the phone",
                   "Extraction": "Logical extraction with family consent, 11 March 2026", "Last cloud sync": "2026-03-06T22:38:00Z",
                   "Note": "Messages and photos sync from the phone while it has signal."},
        "contacts": [{"name": P2, "number": P2_mob}, {"name": P3, "number": P3_mob}, {"name": "Mum", "number": W1_mob},
                     {"name": f"{first(P1)} (blocked)", "number": P1_mob, "note": "Blocked 5 March"}],
        "messages": [
            {"app": "Natter", "thread": P3, "from": P3, "to": "me", "time": "2026-03-05T21:40:00Z", "text": "You sure you're ok? Stay as long as you need. Key's where it always is."},
            {"app": "Natter", "thread": P3, "from": "me", "to": P3, "time": "2026-03-05T21:44:00Z", "text": "Thank you. I just need to switch off for a while. Don't tell anyone where, please x"},
            {"app": "Natter", "thread": P3, "from": P3, "to": "me", "time": "2026-03-05T21:45:00Z", "text": "Promise. Shop's open 9 till 5 on Saturdays x"},
            {"app": "Natter", "thread": P2, "from": "me", "to": P2, "time": "2026-03-06T20:14:00Z", "text": "Going off grid for a bit. Don't worry. Tell mum I'm ok if she asks x"},
            {"app": "SMS", "thread": P1_mob, "from": P1_mob, "to": "me", "time": "2026-03-05T17:02:00Z", "text": "We need to talk about the money. I'm not letting this go."},
            {"app": "SMS", "thread": PX, "from": PX, "to": "me", "time": "2026-03-06T21:31:00Z", "text": "Answer your phone. You can't hide."},
            {"app": "Snapfolio DM", "thread": P2, "from": P2, "to": "me", "time": "2026-03-04T12:00:00Z", "text": "Brunch Saturday? I'll schedule the post now so I don't forget lol"},
            {"app": "Snapfolio DM", "thread": P2, "from": "me", "to": P2, "time": "2026-03-04T12:30:00Z", "text": "Might not make it, sorry x"},
            {"app": "Chirp", "thread": "Scheduler", "from": "Chirp", "to": "me", "time": "2026-03-05T21:30:00Z", "text": "Your post 'Sunday reset. Coffee, plants, quiet.' is scheduled for Sunday 8 March, 10:00."},
        ],
        "calls": [{"time": "2026-03-05T16:58:00Z", "number": P1_mob, "direction": "missed", "duration_s": 0, "name": first(P1)},
                  {"time": "2026-03-05T19:22:00Z", "number": PX, "direction": "missed", "duration_s": 0},
                  {"time": "2026-03-06T21:28:00Z", "number": PX, "direction": "missed", "duration_s": 0},
                  {"time": "2026-03-06T16:01:00Z", "number": W1_mob, "direction": "outgoing", "duration_s": 312, "name": "Mum"}],
        "media": [{"file": "IMG_2041.jpg", "time": "2026-02-24T19:02:00Z", "caption": "GPS 1310, 515 (Heronmere Woods). Same image as the 'Tuesday ritual' post."},
                  {"file": "IMG_2063.jpg", "time": "2026-03-03T19:40:00Z", "caption": "GPS 1308, 521. Cabin interior, freshly painted."},
                  {"file": "IMG_2071.jpg", "time": "2026-03-06T21:10:00Z", "caption": "GPS 1306, 519. Dark photo of a cabin door, number 7 visible."}],
        "apps": [{"name": "Chirp", "account": f"@{handle}"}, {"name": "Snapfolio", "account": f"@{handle}"}, {"name": "Natter", "account": MP_mob}],
    }
    c.json_item("EV-025", f"Tablet extraction: {MP}'s tablet (family consent)", "phone_extraction", tablet, source=f"{W1}, consent",
                source_group="tablet-mp", acquired="2026-03-11 14:30", stage="S3", grade=("A", "2"),
                summary="Synced messages, calls, photos and app data from MP's tablet, up to the last sync on Friday night.")
    c.table("EV-026", f"Cloud location history export: {MP}", "location_history", ["time_utc", "x", "y", "accuracy_m", "source"], tablet_loc,
            table={"time_column": "time_utc", "x_column": "x", "y_column": "y", "map_entity": "ENT-MP"}, source="Cloud account via tablet, family consent",
            source_group="tablet-mp", acquired="2026-03-11 14:30", stage="S3", summary="Six weeks of GPS points from the phone, synced to the cloud account.", grade=("A", "2"))
    for eid, title, body in [("EV-027", "Hospital admissions check", "Kestrel Bay General and the minor injuries unit were checked on 10 and 11 March. No admission or attendance under the name, date of birth or description."),
                             ("EV-028", "Taxi firms check", "Three local taxi firms checked their bookings for 6 to 8 March. No booking to or from the home address, or under the name or number."),
                             ("EV-029", "Bus CCTV check", "Number 4 and 7 bus CCTV for Friday evening reviewed. No sighting matching the description."),
                             ("EV-030", "Marina car park ticket log", "Pay and display tickets for 6 to 8 March reviewed. The car's registration does not appear.")]:
        c.document(eid, title, "document", f"# {title}\n\n{body}\n\nResult: negative.", source="Enquiry team", source_group="enquiries-" + eid,
                   acquired="2026-03-11 12:00", stage="S3", noise=True, summary=f"{title}: no trace.", grade=("A", "2"))

    # Request: network records for MP's phone
    net = []
    net_events = [("2026-03-06 16:01", "LOC-KB-CENTRAL", "voice out", W1_mob), ("2026-03-06 17:35", "LOC-KB-BRACKEN", "data", ""),
                  ("2026-03-06 18:05", "LOC-KB-CENTRAL", "data", ""), ("2026-03-06 19:44", "LOC-KB-BRACKEN", "data", ""),
                  ("2026-03-06 19:53", "LOC-KB-HARBOUR", "data", ""), ("2026-03-06 20:14", "LOC-KB-NORTH", "message out (data)", ""),
                  ("2026-03-06 20:33", "LOC-KB-NORTH", "data", ""), ("2026-03-06 21:06", "LOC-KB-HERON", "data", ""),
                  ("2026-03-06 21:28", "LOC-KB-HERON", "voice in (missed)", PX), ("2026-03-06 21:31", "LOC-KB-HERON", "sms in", PX),
                  ("2026-03-06 22:40", "LOC-KB-HERON", "network detach (switched off)", ""),
                  ("2026-03-05 16:58", "LOC-KB-CENTRAL", "voice in (missed)", P1_mob), ("2026-03-05 17:02", "LOC-KB-CENTRAL", "sms in", P1_mob),
                  ("2026-03-05 19:22", "LOC-KB-BRACKEN", "voice in (missed)", PX), ("2026-03-05 22:02", "LOC-KB-BRACKEN", "message out (data)", ""),
                  ("2026-03-05 08:31", "LOC-KB-BRACKEN", "data", ""), ("2026-03-05 12:40", "LOC-KB-CENTRAL", "data", "")]
    for when, cell, ev, other in sorted(net_events):
        net.append([when, MP_mob, other, cell, ev])
    c.table("EV-031", f"Network records for {MP_mob} (calls, messages and cell sites)", "cdr", ["time_utc", "number", "other_party", "cell", "event"], net,
            table={"time_column": "time_utc", "location_column": "cell", "entity_columns": ["number", "other_party"], "map_entity": "ENT-PH-MP", "description_columns": ["event"]},
            source="Mobile network operator", source_group="network-mp", acquired="2026-03-11 16:00",
            summary="Calls, messages, data sessions and cell sites for MP's phone.", grade=("A", "1"))

    # ------------------------------------------------------------------ STAGE 4: people and accounts
    c.document("EV-032", f"Statement: {P1} (ex-partner)", "statement", f"""
# Statement

**Name:** {P1}

I split up with {first(MP)} at Christmas. They owe me about six hundred pounds for the holiday we never went on. I have asked for it back, that's all.

On Friday 6 March I was at home all evening watching the football. I did not go out. I have not seen {first(MP)} since January.

I only have one phone, {P1_mob}. I drive a white van for work.
""", source="Witness (person of interest)", source_group="statement-p1", acquired="2026-03-12 10:00", stage="S4", grade=("C", "4"),
        summary="The ex-partner's account of Friday evening.")
    c.document("EV-033", f"Statement: {P3} (friend)", "statement", f"""
# Statement

**Name:** {P3}

{first(MP)} is one of my closest friends. We row together. The last time I saw them was at training on Thursday 5 March. They seemed tired and fed up about {first(P1)} and money.

I don't know where {first(MP)} is. I'm sure they're okay. They're an adult and sometimes people need some space.
""", source="Witness", source_group="statement-p3", acquired="2026-03-12 11:00", stage="S4", grade=("C", "3"),
        summary="The close friend's account. Short, and careful.")
    c.document("EV-034", f"Statement: {P4} (club member)", "statement", f"""
# Statement

**Name:** {P4}

The argument was about the stroke seat for the regatta. I lost my temper in the group chat and I apologised the same night. When the crew list went up on Thursday I congratulated {first(MP)}.

On Friday evening I was at my sister's birthday meal in town from seven until late. Lots of people saw me.
""", source="Witness", source_group="statement-p4", acquired="2026-03-12 11:30", stage="S4", grade=("B", "2"),
        summary="The club member explains the argument.")
    c.document("EV-035", f"Statement: {P2} (friend and colleague)", "statement", f"""
# Statement

**Name:** {P2}

{first(MP)} sent me a message on Friday at 20:14 saying they were going off grid. I gave the police my phone to copy the messages. I told {first(MP)}'s mum on Monday.

On Saturday I posted a brunch photo and tagged {first(MP)}, but I had scheduled it on Wednesday. {first(MP)} didn't come. I didn't think about how it might look.

{first(MP)} goes somewhere every Tuesday evening but would never say where.
""", source="Witness", source_group="statement-p2", acquired="2026-03-12 12:00", stage="S4", grade=("B", "2"),
        summary="The friend on the last message and a scheduled brunch post.")
    c.document("EV-036", f"Vehicle keeper record: {P1_van}", "document", f"# Vehicle keeper record\n\n| Registration | {P1_van} |\n|---|---|\n| Type | Small van, white |\n| Keeper | {P1} |\n| Address | Old Harbour, Kestrel Bay |",
               source="Vehicle registry", source_group="registry", acquired="2026-03-12 09:00", stage="S4", grade=("A", "1"),
               summary="Confirms the ex-partner's van.")
    c.document("EV-037", "Courier delivery record, 6 March", "document", f"""
# Delivery record

| Time | Address | Vehicle | Driver | Result |
|---|---|---|---|---|
| 19:33 | No. 9, Brackenfield | {COURIER} (white van) | Courier route 14 | Delivered to neighbour |
| 19:41 | No. 22, Brackenfield | {COURIER} | Courier route 14 | Delivered |
""", source="Courier company", source_group="courier", acquired="2026-03-12 09:30", stage="S4", grade=("A", "2"),
        summary="Parcel deliveries in MP's street on Friday evening.")
    c.document("EV-038", "Statement: Heronmere Farm Shop owner", "statement", """
# Statement

**Role:** Owner, Heronmere Farm Shop, Heron Lane

On Saturday 7 March, a little after ten in the morning, a customer bought bread, milk, eggs and firelighters and paid by card. They looked tired but were polite and chatted about the weather. I think they've been in on Tuesday evenings a few times recently. I didn't ask their name.
""", source="Witness", source_group="witness-farmshop", acquired="2026-03-12 13:00", stage="S4", grade=("B", "2"),
        summary="The farm shop owner remembers a Saturday morning customer.")
    for eid, title in [("EV-039", "Rowing club boat shed sign-in sheet"), ("EV-040", "Garden centre CCTV retention note"),
                       ("EV-044", "Ferry terminal passenger check"), ("EV-045", "Hotels and hostels check"),
                       ("EV-046", "Train station CCTV check"), ("EV-047", "Library public computer log")]:
        c.document(eid, title, "document", f"# {title}\n\nNothing relevant for 6 to 8 March.", source="Enquiry team", source_group="misc-" + eid,
                   acquired="2026-03-12 09:00", stage="S4", noise=True, summary=title, grade=("B", "2"))
    pxcdr = []
    for when, other, cell, ev in [("2026-03-05 19:22", MP_mob, "LOC-KB-HARBOUR", "voice out (unanswered)"), ("2026-03-06 21:28", MP_mob, "LOC-KB-NORTH", "voice out (unanswered)"),
                                  ("2026-03-06 21:31", MP_mob, "LOC-KB-NORTH", "sms out"), ("2026-03-06 22:12", "", "LOC-KB-NORTH", "data"),
                                  ("2026-03-06 22:50", "", "LOC-KB-HERON", "data"), ("2026-03-06 23:36", "", "LOC-KB-HARBOUR", "data"),
                                  ("2026-03-04 09:10", g.mobile(), "LOC-KB-HARBOUR", "voice out")]:
        pxcdr.append([when, PX, other, cell, ev])
    pxcdr.sort()
    c.table("EV-041", f"Network records for {PX} (unregistered)", "cdr", ["time_utc", "number", "other_party", "cell", "event"], pxcdr,
            table={"time_column": "time_utc", "location_column": "cell", "entity_columns": ["number", "other_party"], "map_entity": "ENT-PH-X", "description_columns": ["event"]},
            source="Mobile network operator", source_group="network-px", acquired="2026-03-12 15:00",
            summary="The unregistered number's activity on Thursday and Friday.", grade=("A", "1"),
            metadata={"Subscriber": "Pay as you go, no registered user"})

    # ------------------------------------------------------------------ STAGE 5
    c.table("EV-042", "Heronmere Lodges owners list", "spreadsheet", ["cabin", "owner", "notes"],
            [["1", g.name(), ""], ["2", g.name(), "Holiday let"], ["3", g.name(), ""], ["4", g.name(), "For sale"], ["5", g.name(), ""],
             ["6", g.name(), ""], ["7", f"{sur(P3)} family ({P3} and parents)", "Used by family and friends"], ["8", g.name(), ""], ["9", g.name(), "Holiday let"]],
            source="Heronmere Lodges management company", source_group="lodges-mgmt", acquired="2026-03-13 09:00", stage="S5",
            summary="Who owns each cabin at Heronmere Lodges.", grade=("A", "1"))
    c.document("EV-043", "Search team briefing template", "document", "# Briefing template\n\nLocation · Access route · Hazards · Welfare considerations · Contact plan · Who to inform",
               source="Missing persons unit", source_group="template", acquired="2026-03-13 09:00", stage="S5", noise=True, summary="A blank template.", grade=("B", "2"))

    # ------------------------------------------------------------------ requests
    c.request_type("RT-PROFILE", "authority", "Authority: view a private online profile", ["online_account"], "S2", False,
                   "Ask for authority to view a private profile through a lawful, authorised route. Explain why it is necessary for the person's welfare.")
    c.request_type("RT-NET", "data", "Network: call, message and cell site records for a number", ["phone"], "S3", True,
                   "Ask a network operator for one number's records over a short, justified period.")
    c.request_rule("RR-1", "RT-PROFILE", ["ENT-OA-P3-SNAP"], f"Authority granted to view {P3}'s private Snapfolio profile for this welfare enquiry.",
                   authority="AUTH-P3-PROFILE", osint_pages=["PG-007"],
                   justification=[["welfare", "safety", "risk", "vulnerable", "concern", "missing"], ["friend", "close", "cabin", "heronmere", "comment", "contact", "connection", "tuesday"]],
                   min_groups=2, refuse_broad="Refused. Authority is given for one named profile with a clear reason, not for every account.",
                   refuse_justification="Refused. Explain why this person's private profile is necessary for the missing person's welfare, and what links them.")
    c.request_rule("RR-2", "RT-PROFILE", ["ENT-OA-P1-CHIRP"], f"Authority granted for repeated, focused review of {P1}'s public Chirp profile.",
                   authority="AUTH-P1-REVIEW",
                   justification=[["ex-partner", "ex partner", "alibi", "person of interest", "money", "threat", "pay back"], ["review", "repeated", "monitor", "check", "necessary", "welfare"]],
                   min_groups=2, refuse_justification="Refused. Repeated viewing of one person's profile needs a clear reason linked to the enquiry.")
    c.request_rule("RR-3", "RT-NET", ["ENT-PH-MP"], "The network has supplied call, message and cell site records for the dates requested.",
                   evidence=["EV-031"], must_cover=["2026-03-05", "2026-03-06"], max_days=14,
                   justification=[["welfare", "missing", "risk", "safety", "last"], ["location", "contact", "calls", "movement", "cell", "where"]], min_groups=2,
                   refuse_broad="Refused. Keep the request to the days around the disappearance.",
                   refuse_dates="Refused as framed. The dates should cover Thursday and Friday, when the last contacts happened.")
    c.request_rule("RR-4", "RT-NET", ["ENT-PH-X"], f"The network has supplied records for {PX} for the dates requested.",
                   evidence=["EV-041"], must_cover=["2026-03-05", "2026-03-06"], max_days=7,
                   justification=[["called", "calls", "contact", "message", "texted", "sms"], ["unknown", "unregistered", "listing", "bayboard", "ex-partner", "roof rack", "second"]], min_groups=2,
                   refuse_broad="Refused. Seven days at most for an unregistered number.",
                   refuse_dates="Refused as framed. Cover the Thursday and Friday contacts.")

    # ------------------------------------------------------------------ traps
    c.trap("Getting in by deception", "deception", {"kind": "persona_access", "pages": ["PG-007"], "unless_authority": "AUTH-P3-PROFILE-PERSONA"}, 4, "serious",
           "Using a false persona to get into a private profile is deception and is not authorised here. Ask for authority through the request form instead.",
           "You are not authorised to use a persona account. This would be deception, even with good intentions.")
    c.trap("Repeated viewing without authority", "scope", {"kind": "excess_views", "pages": ["PG-005"], "max_views": 4, "unless_authority": "AUTH-P1-REVIEW"}, 1.5, "minor",
           "Repeated, focused viewing of one person's profile starts to look like surveillance. Get authority and record why it is necessary.",
           "You have looked at this person's profile several times. Repeated, focused viewing needs authority.")
    c.trap("Collecting about people outside scope", "collection", {"kind": "capture_page", "pages": ["PG-018"]}, 2, "major",
           "The neighbour's relative has nothing to do with the enquiry. Do not collect their material.",
           "This person is a witness's relative with no connection to the enquiry.")
    c.trap("Working outside scope", "scope", {"kind": "evidence_opened", "ids": ["EV-016"], "unless_authority": "AUTH-NONE"}, 2, "major",
           "The street list holds personal data about people with no connection to the case. Leave it unopened and return it.",
           "This list holds personal data about everyone in the street. It is outside the scope of the enquiry.")
    c.trap("Capture not preserved", "capture", {"kind": "poor_capture"}, 1, "minor",
           "A screenshot without capture time, address and hash cannot show what was on the page. Capture properly.")
    c.trap("Naming someone as responsible without evidence", "overclaim",
           {"kind": "finding_claim", "keywords": [[sur(P1), sur(P4), "ex-partner", "ex partner", "club member"], ["harmed", "responsible for", "abducted", "hurt", "attacked", "killed", "took her", "took them", "kidnap"]], "types": ["fact", "inference"]},
           3, "major", "Nothing shows anyone harmed the missing person. A failed alibi raises questions; it does not prove harm.",
           "Careful. Do you have evidence that this person harmed the missing person, or only that their account does not add up?")
    c.trap("Confirmation bias", "bias", {"kind": "confirmation_bias", "keywords": [["scheduled", "sunday"], ["alive", "active", "posted", "safe", "proof"]], "contradicting": ["EV-025"]}, 1.5, "minor",
           "The Sunday post looked like proof of life, but it was scheduled on Thursday. Check how a post was made before relying on it.")

    # ------------------------------------------------------------------ stages
    c.stage("S1", "Initial enquiry and risk", 20,
            f"Thanks for picking this up. {first(MP)} has been missing five days. Start a timeline from what we have, work out the last confirmed contact and how we know it, and give me a welfare risk grade with reasons.",
            [("OB-1-1", "Log receipt of every item", True, C_received(all_released=True), ["Use Log all.", "Every released item needs receipt logged.", "Click Log all in the evidence list."]),
             ("OB-1-2", "Start a timeline with at least four events", True, C_timeline(4), ["Use the statements, rota and doorbell log.", "Add the end of the last shift, leaving home and the last message.", "Add four events, each citing its source."]),
             ("OB-1-3", "Establish the last confirmed contact and how it is confirmed", True, C_finding("KF-01"),
              ["Who heard from them last, and when?", "The friend's phone extraction and the parent's statement.", "Record that the last confirmed contact was the 20:14 message on Friday, citing EV-010 and EV-002."]),
             ("OB-1-4", "Establish when and how they left home", True, C_finding("KF-02"),
              ["The neighbour saw them leave.", "Check the doorbell log, and its clock.", "Record that they left by car with a holdall at about 19:40, citing EV-003 and EV-011."]),
             ("OB-1-5", "Grade the welfare risk, with reasons", True, C_finding("KF-03"),
              ["Use the risk guide.", "A planned departure and a message lower the risk, but this is out of character.", "Record an inference that the risk is medium, citing EV-007, EV-010 and EV-001."]),
             ("OB-1-6", "Correct the doorbell camera time", False, C_finding("KF-21"), ["Check the item's clock note.", "The device runs fast.", "Record that 19:43 on the device is 19:40 true time."])])
    c.stage("S2", "Digital footprint", 45,
            "Now the online footprint. Find their genuine accounts, weed out the false matches, capture what matters and look for anything that tells us where they might be. If you need to see private material, ask for authority. Do not go in through the back door.",
            [("OB-2-1", "Identify the missing person's genuine accounts", True, C_finding("KF-04"),
              ["Start with the handles the family gave.", "Search the handle and compare the profiles.", "Record that @handle on Chirp and Snapfolio belong to them, citing EV-019 and a captured profile."]),
             ("OB-2-2", "Rule out a false username match", True, C_finding("KF-05"),
              ["Search the handle across sites.", "Read the Bayboard profile carefully.", "Record that the Bayboard account is an unrelated person, citing the captured page and EV-019."]),
             ("OB-2-3", "Capture both of the missing person's profiles", True, C_captured("PG-001", "PG-002"),
              ["A page only counts once it is captured.", "Use Capture page, not Quick screenshot.", "Capture PG-001 and PG-002."]),
             ("OB-2-4", "Work out where the 'Tuesday ritual' photo was taken", True, C_finding("KF-06"),
              ["Look at what is in the picture: the sign and the tower.", "Search for the tower's name and the lodges.", "Record that it was taken at Heronmere Lodges, citing the captured Snapfolio page and the lodges site or a photographer's post."]),
             ("OB-2-5", "Get authority to view the close friend's private profile", True, C_request("RR-1"),
              ["Private profiles need authority.", "Whose private profile might matter, and why?", f"Request authority for {P3}'s Snapfolio, explaining the welfare concern and the close connection."]),
             ("OB-2-6", "Check whether the Sunday post shows they were active", False, C_finding("KF-17"),
              ["Look closely at how the post was made.", "The post text and the tablet extraction later both help.", "Record that the Sunday post was scheduled and is not proof of life."])],
            unlock=C_objectives("S1"), unlock_text="Opens when the stage 1 required objectives are complete.",
            osint_pages=[f"PG-0{n:02d}" for n in range(1, 21) if n != 7])
    c.stage("S3", "Phone and movement", 40,
            "The tablet left at home has been extracted, and the ANPR and bank data are in. If you need the phone's network records, request them, keeping to the days that matter. Plot the movements and reconstruct the pattern of life.",
            [("OB-3-1", "Obtain the missing person's network records with a justified request", True, C_request("RR-3"),
              ["Network data needs a request.", "Target their number, and the Thursday and Friday.", "Request records for their number from 5 to 6 or 7 March, explaining the welfare concern and the need for location."]),
             ("OB-3-2", "Show that the car's movements match the phone's location", True, C_finding("KF-08"),
              ["Compare ANPR reads with the location history.", "Use the map's time slider around 19:50 to 20:35.", "Record that the car was read at cameras 2 and 5 while the phone moved the same way, citing EV-022 and EV-026."]),
             ("OB-3-3", "Find the regular visit nobody mentioned", True, C_finding("KF-09"),
              ["Look at the location history for patterns.", "Which evening, and where?", "Record the Tuesday evening visits to Heronmere, citing EV-026 and EV-024."]),
             ("OB-3-4", "Establish when and where the phone was last on the network", True, C_finding("KF-11"),
              ["The network records show each cell.", "Look for the last event.", "Record the 22:40 detach on KB-HERON, citing EV-031 and EV-025 or EV-026."]),
             ("OB-3-5", "Find what the deleted post reveals", True, C_finding("KF-07"),
              ["Check the archive snapshots.", "Compare with the tablet messages.", "Record the deleted 'little escape' post, citing the captured archive of PG-002 and EV-025."])],
            unlock=C_objectives("S2"), unlock_text="Opens when the stage 2 required objectives are complete.")
    c.stage("S4", "People and accounts", 25,
            "Statements from the ex-partner and friends are in. Test their accounts against the data, deal with anything that conflicts, and draw who was in touch with whom.",
            [("OB-4-1", "Test the ex-partner's alibi", True, C_finding("KF-10"),
              ["Compare his statement with ANPR.", "Look for his van's plate.", "Record that ANPR puts his van north on Quarry Road at 22:10, against his statement, citing EV-032, EV-022 and EV-036."]),
             ("OB-4-2", "Find activity after Friday night", True, C_finding("KF-12"),
              ["Look at the bank data and new statements.", "Saturday morning.", "Record the 10:12 Saturday payment at the farm shop, citing EV-024 and EV-038."]),
             ("OB-4-3", "Link the missing person to the friend who may know where they are", True, C_link("ENT-MP", "ENT-P3"),
              ["Use the link chart.", "Who offered somewhere to stay?", f"Link the missing person to {P3}, citing EV-025."]),
             ("OB-4-4", "Identify who uses the unregistered number", False, C_finding("KF-18"),
              ["The number called on Thursday and Friday.", "Search the number online.", f"Record that the number is in {first(P1)}'s marketplace listing, citing the captured page and EV-025 or EV-041."]),
             ("OB-4-5", "Explain the white van the neighbour saw", False, C_finding("KF-20"),
              ["Who else was in the street?", "Check the courier record.", "Record that it was a courier delivery, citing EV-037 and EV-003."])],
            unlock=C_objectives("S3"), unlock_text="Opens when the stage 3 required objectives are complete.")
    c.stage("S5", "Location assessment and handover", 20,
            "Bring it together. Where are they most likely to be, how confident are you, and what should the team do first? Keep it focused on welfare. Complete the legality statement and the handover report.",
            [("OB-5-1", "Establish who owns the cabin", True, C_finding("KF-13"),
              ["The owners list has arrived.", "Which cabin is in the photos?", f"Record that cabin 7 belongs to the {sur(P3)} family, citing EV-042 and the archived Chirp profile or the private Snapfolio."]),
             ("OB-5-2", "Assess what the close friend is likely to know", True, C_finding("KF-14"),
              ["Compare the friend's statement with the messages.", "What did they leave out?", f"Record an inference that {first(P3)} probably knows where they are, citing EV-033 and EV-025."]),
             ("OB-5-3", "Give your assessment of the most likely location", True, C_finding("KF-15"),
              ["Pull together the photo, location history, ANPR, cell site and the Saturday payment.", "Label it as an inference.", "Record that Heronmere Lodges, cabin 7, is the most likely location and the first priority."]),
             ("OB-5-4", "Assess whether the departure looks voluntary", True, C_finding("KF-16"),
              ["What did the messages and planning show?", "Message, holdall, leave request, deleted post.", "Record an inference that the departure appears planned and voluntary."]),
             ("OB-5-5", "Grade at least eight items or findings", True, C_graded(8), ["Grade your key sources.", "Network and ANPR data are usually A1.", "Grade eight."]),
             ("OB-5-6", "Complete and sign the legality statement", True, C_legality(), ["Open the report tab.", "Fill in all three parts.", "Write each part and sign."])],
            unlock=C_objectives("S4"), unlock_text="Opens when the stage 4 required objectives are complete.")

    # ------------------------------------------------------------------ solution
    F = c.finding
    s1, s3 = sur(P1), sur(P3)
    F("KF-01", "The last confirmed contact was a message to a friend at 20:14 on Friday 6 March, confirmed by the friend's phone and other sources.", "fact",
      ["EV-010", "EV-002", "EV-025", "EV-031", "EV-035"], [["20:14", "quarter past eight", "8:14", "last"], ["message", "messaged", "natter", "text"]],
      "Two independent sources at first (the friend's phone and what the parent was told), later confirmed by the tablet and network records.")
    F("KF-02", "They left home by car with a holdall at about 19:40 on Friday.", "fact", ["EV-003", "EV-011", "EV-022"],
      [["left", "leaving", "drove", "departed"], ["19:4", "7:40", "half seven", "car", "holdall"]], "The neighbour and the doorbell log agree once the clock is corrected.")
    F("KF-03", "The welfare risk is medium: the absence is out of character, but the departure looks planned and they sent a message saying they were okay.", "inference",
      ["EV-007", "EV-010", "EV-001", "EV-002", "EV-008"], [["medium"], ["risk"]], "Planning, a message and transport lower the risk; five days of silence and recent stress raise it.")
    F("KF-04", f"Their genuine accounts are @{handle} on Chirp and on Snapfolio.", "fact", ["EV-019", "PG-001", "PG-002"],
      [[handle], ["chirp", "snapfolio"]], "The family's list and the content of the profiles match.")
    F("KF-05", "The Bayboard account with the same handle belongs to an unrelated person in another town.", "fact", ["PG-011", "EV-019", "PG-002"],
      [["bayboard", "cat sitting", "moorend vale"], ["unrelated", "different person", "not them", "not the missing", "false match", "someone else", "another person", "not her", "not his"]],
      "Matching handles prove nothing on their own. Content, location and history all differ.")
    F("KF-06", "The 'Tuesday ritual' photo was taken at Heronmere Lodges, looking east towards the Gullstone water tower.", "fact",
      ["PG-002", "PG-014", "PG-017", "PG-016", "EV-025"], [["heronmere"], ["photo", "picture", "image", "taken", "view"]],
      "The sign and the lettered tower match the lodges' own description and a photographer's tagged post.")
    F("KF-07", "A post deleted on 4 March, seen in an archived copy, talks about a planned 'little escape' to Heronmere.", "fact",
      ["PG-002", "EV-025"], [["deleted", "archive", "archived"], ["escape", "heronmere", "nobody will find"]],
      "Preserved copies show what someone chose to remove, which can matter as much as what they kept.")
    F("KF-08", "The car's ANPR reads at Harbour Road (19:52) and Quarry Road northbound (20:31) match the phone's location history.", "fact",
      ["EV-022", "EV-026", "EV-031"], [["anpr", "camera", "car", "read"], ["match", "matches", "consistent", "same", "agree", "corroborat"]],
      "Two independent systems put the car and the phone on the same route at the same times.")
    F("KF-09", "For six weeks they visited Heronmere Woods every Tuesday evening, which nobody mentioned.", "fact",
      ["EV-026", "EV-024", "PG-002", "EV-038", "EV-035"], [["tuesday", "weekly", "every week", "regular"], ["heronmere"]],
      "A routine place that friends and family did not know about is a strong lead for where someone might go.")
    F("KF-10", f"{P1}'s alibi fails: he said he was home all evening, but ANPR shows his van going north on Quarry Road at 22:10 and returning at 23:20.", "fact",
      ["EV-022", "EV-032", "EV-036", "EV-023"], [["alibi", "said he was", "statement", "claimed", "home all"], ["anpr", "camera", "van"]],
      "His account does not match the data. That raises questions; it does not show what he did.")
    F("KF-11", "The phone last connected to the network at 22:40 on Friday through the KB-HERON cell, then was switched off.", "fact",
      ["EV-031", "EV-025", "EV-026"], [["22:40", "22:38", "last"], ["heron", "cell", "mast", "network", "switched off", "detach"]],
      "The last network event puts the phone in the Heronmere area.")
    F("KF-12", "On Saturday 7 March at 10:12 they paid by card at Heronmere Farm Shop, the morning after they left.", "fact",
      ["EV-024", "EV-038"], [["saturday", "10:12", "7 march"], ["farm shop", "heronmere fs", "card", "payment", "paid"]],
      "Activity after the disappearance is the most recent sign of life and points to the same area.")
    F("KF-13", f"Cabin 7 at Heronmere Lodges belongs to the {s3} family.", "fact", ["EV-042", "PG-008", "PG-007"],
      [["cabin 7", "cabin seven", "no. 7"], [s3, "friend's family", "family cabin", "owned"]], "Ownership links the friend directly to the most likely location.")
    F("KF-14", f"{P3} probably knows where they are: they offered somewhere to stay but did not mention it in their statement.", "inference",
      ["EV-033", "EV-025", "PG-007"], [[s3, first(P3)], ["know", "knows", "aware", "did not mention", "didn't mention", "left out"]],
      "A careful, short statement that omits a known offer of a place to stay is worth following up gently.")
    F("KF-15", "The most likely location is Heronmere Lodges, cabin 7, and it should be the first priority for welfare enquiries.", "inference",
      ["EV-026", "EV-022", "EV-031", "EV-024", "EV-042", "PG-014", "EV-025"], [["heronmere", "cabin 7"], ["likely", "most likely", "probably", "priority", "first"]],
      "Several independent strands point to the same place. The phone has been off since Friday, so this is an assessment, not a certainty.")
    F("KF-16", "The departure appears planned and voluntary, with no evidence of harm or third-party involvement.", "inference",
      ["EV-010", "EV-025", "EV-008", "PG-002", "EV-003"], [["voluntar", "planned", "chose", "own choice", "by choice"], ["leave", "left", "departure", "went", "go"]],
      "A message, a holdall, a leave request and a deleted post all show planning.")
    F("KF-17", "The Sunday post was scheduled on Thursday, so it is not evidence they were active on Sunday.", "fact",
      ["PG-001", "EV-025"], [["schedul"], ["not", "isn't", "no proof", "false impression", "does not show", "doesn't show"]],
      "Scheduled posts can create a false impression of recent activity.", required=False, min_sources=1)
    F("KF-18", f"The unregistered number {PX} is used by {P1}: it appears in his own marketplace listing.", "fact",
      ["PG-006", "EV-041", "EV-025"], [[PX, PX.replace(" ", ""), "unregistered", "second number"], [s1, "ex-partner", "ex partner", "his"]],
      "A pivot from a phone number to a public listing links an anonymous number to a person.", required=False)
    F("KF-19", "The unregistered number called and texted them on Thursday and Friday evening, including 'You can't hide' at 21:31.", "fact",
      ["EV-025", "EV-031", "EV-041"], [["can't hide", "21:31", "texted", "called"], [PX, PX.replace(" ", ""), "unregistered"]],
      "Contact from a hidden number after being blocked adds to the welfare picture.", required=False)
    F("KF-20", "The white van in the street was a courier making deliveries, not connected to the disappearance.", "fact",
      ["EV-037", "EV-003", "EV-011"], [["courier", "delivery", "parcel"], ["van"]], "Unexplained vehicles are worth checking, and most have ordinary explanations.", required=False)
    F("KF-21", "The doorbell camera runs 3 minutes fast, so the 19:43 event was at 19:40 true time.", "fact",
      ["EV-011"], [["3 min", "three min", "fast", "offset"], ["19:40", "corrected", "true time"]], "Device clocks drift. Correct before comparing sources.", required=False, min_sources=1)
    F("KF-22", "A residents' post about a van at the lodges' top gate around 22:00 on Friday fits the ex-partner's van on ANPR.", "inference",
      ["PG-015", "EV-022"], [["van"], ["gate", "residents", "revving"]], "Open source chatter can corroborate other data, but it is weak on its own.", required=False)

    c.link("ENT-MP", "ENT-P2", ["EV-010", "EV-025"], "Friend who received the last message")
    c.link("ENT-MP", "ENT-P3", ["EV-025", "PG-007"], "Offered somewhere to stay")
    c.link("ENT-MP", "ENT-V-MP", ["EV-006", "EV-022"], "Keeper and driver of the car")
    c.link("ENT-P1", "ENT-V-P1", ["EV-036", "EV-032"], "Keeper of the van")
    c.link("ENT-P1", "ENT-PH-X", ["PG-006"], "Number in his listing")
    c.link("ENT-PH-X", "ENT-PH-MP", ["EV-041", "EV-031", "EV-025"], "Calls and texts on Thursday and Friday")
    c.link("ENT-P3", "ENT-ADDR-CABIN", ["EV-042", "PG-008"], "Family cabin")

    c.event("TL-1", "2026-03-06 17:28", "Logs off the till at the end of the last shift", ["EV-005", "EV-004"], 30)
    c.event("TL-2", "2026-03-06 18:05", "Buys fuel at Harbour Fuel", ["EV-024", "EV-026"], 15)
    c.event("TL-3", "2026-03-06 19:40", "Leaves home by car with a holdall", ["EV-011", "EV-003"], 6)
    c.event("TL-4", "2026-03-06 19:52", "Car read by ANPR on Harbour Road", ["EV-022"], 5)
    c.event("TL-5", "2026-03-06 20:14", "Last confirmed contact: message to a friend", ["EV-010", "EV-025", "EV-031"], 5)
    c.event("TL-6", "2026-03-06 20:31", "Car read northbound on Quarry Road", ["EV-022"], 5)
    c.event("TL-7", "2026-03-06 22:10", "Ex-partner's van read northbound on Quarry Road", ["EV-022"], 5)
    c.event("TL-8", "2026-03-06 22:40", "Phone's last network event, KB-HERON", ["EV-031", "EV-025", "EV-026"], 5)
    c.event("TL-9", "2026-03-07 10:12", "Card payment at Heronmere Farm Shop", ["EV-024", "EV-038"], 10)
    c.event("TL-10", "2026-03-08 10:00", "Scheduled Sunday post appears", ["PG-001", "EV-025"], 30, key=False)

    c.herring("RH-1", "The Bayboard account with the same handle", ["PG-011"], [["bayboard", "cat sitting", "moorend vale"], ["is their account", "is her account", "is his account", "belongs to the missing", "shows they", "they posted", "she posted", "he posted"]],
              "It belongs to an unrelated person 40 miles away. A matching handle proves nothing.")
    c.herring("RH-2", "The old marina photo tagged Saltings Park", ["PG-002"], [["saltings", "marina"], ["last seen", "went to", "may be at", "recently", "location"]],
              "The photo is from July 2025. Location tags on old posts are not current locations.")
    c.herring("RH-3", "The friend's Saturday brunch post", ["PG-010"], [["brunch"], ["saturday", "seen", "was with", "were with", "attended"]],
              "The post was scheduled on Wednesday. The missing person did not go.")
    c.herring("RH-4", "The rowing club argument", ["EV-018", "PG-009", "EV-034", "EV-017"], [[sur(P4), "argument", "row ", "club member"], ["responsible", "involved", "threat", "suspect", "motive"]],
              "It was about a crew seat, was apologised for the same night, and the member has an alibi.")
    c.herring("RH-5", "The white van outside the home", ["EV-003", "EV-011"], [["white van"], ["took", "abduct", "picked", "involved", "suspicious", "followed"]],
              "It was a courier making deliveries at 19:33 and 19:41.")

    c.gap("GAP-1", "There is no confirmed sighting or activity after 10:12 on Saturday", [["saturday", "since"], ["no", "unknown", "not known", "no confirmed", "nothing"]])
    c.gap("GAP-2", "Why the ex-partner drove towards Heronmere, and whether he met them, is unknown", [[s1, "ex-partner", "ex partner", "van"], ["unknown", "not known", "unclear", "cannot say", "can't say", "why"]])
    c.gap("GAP-3", "The phone has been off since Friday night, so the current location cannot be confirmed", [["phone", "switched off", "off since"], ["cannot", "can't", "not confirm", "unconfirmed", "unknown"]])
    c.solution["next_steps"] = (f"Arrange an immediate, low-key welfare visit to Heronmere Lodges cabin 7; speak gently to {P3} first, as they are likely to know more; "
                                f"review the risk grade once there is contact; speak to {P1} about his movements on Friday night and the unregistered number; "
                                "keep the family informed without sharing the location until the person's wishes are known.")

    # ------------------------------------------------------------------ statements (comparison tool)
    m = first(MP)
    A = c.statement("EV-002", W1, "Parent", "2026-03-10", [
        (f"The last message I had from {m} was on Friday afternoon at about four.", {"time": "2026-03-06 16:00", "entities": ["ENT-MP"]}),
        (f"{P2} told me {m} messaged on Friday at about quarter past eight saying they were going off grid for a bit.", {"time": "2026-03-06 20:15", "entities": ["ENT-P2", "ENT-MP"]}),
        (f"It is not like {m} to go away without telling me.", {"entities": ["ENT-MP"]}),
        (f"{m} split up with {P1} at Christmas, and there was an argument about money.", {"entities": ["ENT-MP", "ENT-P1"]}),
        (f"{m}'s close friends are {P2} from work and {P3} from the rowing club.", {"entities": ["ENT-P2", "ENT-P3"]}),
    ])
    B = c.statement("EV-003", W3, "Neighbour", "2026-03-11", [
        (f"At about half seven or just after, I saw {m} put a big holdall in the blue car and drive off.", {"time": "2026-03-06 19:35", "place": "LOC-HOME", "entities": ["ENT-MP", "ENT-V-MP"]}),
        "They seemed in a hurry but not upset.",
        ("Around the same time a white van I had never seen before was parked a couple of doors down.", {"time": "2026-03-06 19:35", "place": "LOC-HOME"}),
    ])
    Cm = c.statement("EV-008", W2, "Garden centre manager", "2026-03-11", [
        (f"{m} worked on Friday 6 March until half five.", {"time": "2026-03-06 17:30", "place": "LOC-WORK", "entities": ["ENT-MP"]}),
        (f"On Thursday {m} asked if they could take some holiday at short notice.", {"entities": ["ENT-MP"]}),
        (f"{m} is reliable.", {"entities": ["ENT-MP"]}),
    ])
    D = c.statement("EV-017", W4, "Rowing club captain", "2026-03-11", [
        (f"{m} trains on Mondays and Thursdays and missed Monday 9 March without telling anyone.", {"entities": ["ENT-MP"]}),
        (f"Last week there was a heated row in the club group chat between {m} and {P4} about the stroke seat.", {"entities": ["ENT-MP", "ENT-P4"]}),
        (f"{first(P4)} can be hot-headed, but I would be very surprised if it meant anything more.", {"entities": ["ENT-P4"]}),
        (f"{m} is close to {P3}.", {"entities": ["ENT-MP", "ENT-P3"]}),
    ])
    E_ = c.statement("EV-032", P1, "Ex-partner", "2026-03-12", [
        (f"{m} owes me about six hundred pounds for a holiday we never went on.", {"entities": ["ENT-P1", "ENT-MP"]}),
        ("On Friday 6 March I was at home all evening watching the football. I did not go out.", {"time": "2026-03-06 19:00", "place": "LOC-P1-HOME", "entities": ["ENT-P1"]}),
        (f"I have not seen {m} since January.", {"entities": ["ENT-P1", "ENT-MP"]}),
        ("I only have one phone.", {"entities": ["ENT-P1", "ENT-PH-P1"]}),
        ("I drive a white van for work.", {"entities": ["ENT-P1", "ENT-V-P1"]}),
    ])
    F_ = c.statement("EV-033", P3, "Friend", "2026-03-12", [
        (f"The last time I saw {m} was at training on Thursday 5 March.", {"time": "2026-03-05 19:00", "place": "LOC-CLUB", "entities": ["ENT-P3", "ENT-MP"]}),
        (f"They seemed tired and fed up about {first(P1)} and money.", {"entities": ["ENT-P1"]}),
        (f"I don't know where {m} is.", {"entities": ["ENT-P3"]}),
    ])
    G_ = c.statement("EV-034", P4, "Rowing club member", "2026-03-12", [
        ("I lost my temper in the group chat and apologised the same night.", {"entities": ["ENT-P4"]}),
        (f"When the crew list went up on Thursday I congratulated {m}.", {"entities": ["ENT-P4", "ENT-MP"]}),
        ("On Friday evening I was at my sister's birthday meal in town from seven until late.", {"time": "2026-03-06 19:00", "entities": ["ENT-P4"]}),
    ])
    H_ = c.statement("EV-035", P2, "Friend and colleague", "2026-03-12", [
        (f"{m} messaged me on Friday at 20:14 saying they were going off grid.", {"time": "2026-03-06 20:14", "entities": ["ENT-P2", "ENT-MP"]}),
        (f"On Saturday I posted a brunch photo tagging {m}, but I had scheduled it on Wednesday.", {"entities": ["ENT-P2"]}),
        (f"{m} goes somewhere every Tuesday evening but would never say where.", {"entities": ["ENT-MP"]}),
    ])
    I_ = c.statement("EV-038", "Heronmere Farm Shop owner", "Shop owner", "2026-03-12", [
        ("On Saturday 7 March, a little after ten, a customer bought bread, milk, eggs and firelighters and paid by card.", {"time": "2026-03-07 10:05", "place": "LOC-FARM"}),
        ("They looked tired but were polite.", {}),
        ("I think they've been in on Tuesday evenings a few times recently.", {"place": "LOC-FARM"}),
    ])
    c.check(f"{A}.2", "agrees", "The parent's second-hand account and the friend's own statement give the same message at about the same time.", other=f"{H_}.1")
    c.check(f"{H_}.1", "supported", "The friend's phone extraction and the network records show the message at 20:14.", evidence=["EV-010", "EV-031"])
    c.check(f"{A}.1", "supported", "The network records show contact with the parent's number at 16:01. It was a call, not a message: an ordinary slip.", evidence=["EV-031"])
    c.check(f"{B}.1", "supported", "The doorbell camera, corrected for its fast clock, shows the departure at 19:40, and ANPR reads the car at 19:52.", evidence=["EV-011", "EV-022"])
    c.check(f"{B}.3", "supported", "The courier delivery record explains the white van: deliveries at 19:33 and 19:41.", evidence=["EV-037"])
    c.check(f"{Cm}.1", "supported", "The till log shows the last log-off at about 17:28 on Friday.", evidence=["EV-005", "EV-004"])
    c.check(f"{D}.2", "supported", "The group chat export shows the argument and the apology the same evening.", evidence=["EV-018"])
    c.check(f"{G_}.1", "supported", "The chat shows 'Sorry for the rant' at 20:50 on 3 March.", evidence=["EV-018"])
    c.check(f"{A}.4", "agrees", "The ex-partner confirms the money dispute in his own words.", other=f"{E_}.1")
    c.check(f"{D}.4", "agrees", "The parent and the club captain both name the same close friend.", other=f"{A}.5")
    c.check(f"{E_}.2", "contradicted", "ANPR reads his van going north on Quarry Road at 22:10 and back at 23:20. His account does not match the data. That raises questions; it does not show what he did.", evidence=["EV-022", "EV-036"])
    c.check(f"{E_}.4", "contradicted", "An unregistered number appears in his own marketplace listing and called the missing person.", evidence=["PG-006", "EV-041"])
    c.check(f"{H_}.3", "agrees", "The farm shop owner independently remembers a customer on Tuesday evenings.", other=f"{I_}.3")
    c.check(f"{H_}.3", "supported", "The location history shows Tuesday evening trips to Heronmere for six weeks.", evidence=["EV-026"])
    c.check(f"{I_}.1", "supported", "The card payment at Heronmere Farm Shop is at 10:12 on Saturday.", evidence=["EV-024"])
    c.trap("Mistaking a difference for a lie", "statements",
           {"kind": "lie_claim", "keywords": [["lie", "lied", "lying", "liar", "untruthful", "dishonest", "false statement", "made up", "fabricat", "deliberately misled", "covering up", "covering for"]],
            "contradicting": ["EV-022", "PG-006", "EV-041"]},
           2, "minor",
           "A short or careful statement, or a detail that differs from the records, is not proof that someone lied. Note the difference and what would test it. Only say someone gave a false account where evidence directly contradicts what they said.",
           "Careful. What evidence shows this person knew the truth and said otherwise? A gap in a statement is a reason to ask, not a finding of dishonesty.")

    # ------------------------------------------------------------------ skill areas and suggested route
    for f in c.solution["findings"]:
        f["skill"] = {"KF-04": "osint", "KF-05": "osint", "KF-06": "osint", "KF-07": "osint", "KF-13": "osint", "KF-17": "osint",
                      "KF-18": "osint", "KF-22": "osint", "KF-21": "evidence", "KF-03": "reporting", "KF-15": "reporting",
                      "KF-16": "reporting"}.get(f["id"], "analysis")
    c.route("S1", "Fix the last contact and the departure time", "Use the friend's phone and the doorbell log, correcting the camera's fast clock, then grade the risk with reasons.")
    c.route("S2", "Confirm which accounts are really theirs", "Rule out the same-named Bayboard user before reading anything into it, and capture every page you rely on.")
    c.route("S2", "Check how posts were made", "The Sunday post was scheduled on Thursday, so it is not proof of activity on Sunday.")
    c.route("S3", "Line up ANPR, cell sites and location history", "All three point north towards Heronmere on Friday evening.")
    c.route("S4", "Compare the statements with the data", "Test each account against ANPR, the chat export and the courier record. The ex-partner's alibi fails; the white van has an ordinary explanation.")
    c.route("S4", "Treat the close friend's short statement with care", "It leaves out an offer of a place to stay. That is a reason to ask, not proof of dishonesty.")
    c.route("S5", "Hand over a prioritised location", "Recommend cabin 7 first, as an assessment with its reasons, not a certainty.")
    c.solution["story"] = __doc__.split("STORY BIBLE (private, for authors)")[1].strip()
    return c
