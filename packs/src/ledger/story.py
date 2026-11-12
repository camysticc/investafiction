"""Case 1: The Ledger. Financial crime, beginner, about two hours.

STORY BIBLE (private, for authors)

A regional wholesale business, Calder Vale Wholesale Ltd, finds about
eight months of cash shortfalls. The accounts payable supervisor (P1) opens
a sole trader bank account in the name "Northgate Packaging Supplies" on
3 July 2025, using a false applicant name but their own personal mobile as
the contact number. On 4 July a look-alike email introduces the "new
trading division" of a genuine supplier, Northgate Packaging Ltd. P1 sets
up the supplier record alone on 7 July, skipping the two-person check.

From 8 July 2025 to 20 February 2026, sixteen invoices from the fake
supplier are approved under the finance manager's (P2) login, always from
P1's workstation WS-AP-03 using fast user switching. Every amount sits just
under the 5,000 pound approval limit. Six approvals happen while P2 is on
leave. The money is moved on from the receiving account to P1's personal
account, with some cash withdrawals that cannot be traced further.

Alongside this, the junior accounts clerk (P4) pays five small "customer
refunds" into their own account. The refund log has no matching entries.

The finance system exports approval times in Pacific time (the vendor's
default), so the first approval looks like 7 July when it was 8 July UTC.

Red herrings: the genuine supplier with a similar name; the warehouse
supervisor's late logins (covering night shifts); a large shelving
payment that was properly countersigned; a duplicate invoice that was a
clerical slip and was credited back.
"""
from datetime import timedelta

from invtools.casekit import (C_all, C_finding, C_graded, C_legality, C_link, C_objectives, C_received,
                              C_request, C_timeline, C_hashed, Case)
from invtools.gen import Gen, csv_text, iso, t

SEED = 1101
LIMIT = 5000


def make_case() -> Case:
    g = Gen(SEED)
    c = Case(id="the-ledger", title="The Ledger", version="1.0.0", specialty="Financial crime",
             difficulty="Beginner", minutes=120, seed=SEED,
             summary="Cash is going missing from a wholesale business. Follow the money, read the documents, "
                     "and work out who was behind the supplier payments, and how sure you can be.")

    # ------------------------------------------------------------------ cast
    P1, P2, P3, P4 = g.name(), g.name(), g.name(), g.name()
    W1, W2, W3, D1 = g.name(), g.name(), g.name(), g.name()
    sur = lambda n: n.split(" ", 1)[1]
    first = lambda n: n.split(" ", 1)[0]
    user = lambda n: (n[0] + "." + sur(n)).lower()
    P1_user, P2_user, P3_user, P4_user = user(P1), user(P2), user(P3), user(P4)
    P1_work, P1_personal, P2_mob, P3_mob, P4_mob = g.mobile(), g.mobile(), g.mobile(), g.mobile(), g.mobile()
    W1_mob, W2_mob, W3_mob = g.mobile(), g.mobile(), g.mobile()
    bank_line = "020 7946 0555"
    acc_cvw = ("99-41-07", "40118263")
    acc_fake = ("99-73-15", "81530927")
    acc_genuine = ("99-26-44", "20774195")
    acc_refunds = ("99-41-07", "40118271")
    acc_p4 = ("99-58-90", "66103482")
    acc_p1 = ("99-62-31", "73920144")
    acc_w1 = ("99-19-02", "55087316")
    CO = "Calder Vale Wholesale Ltd"
    FAKE = "Northgate Packaging Supplies"
    REAL = "Northgate Packaging Ltd"
    BANK = "Saltmarsh Bank plc"

    c.brief = f"""
# The Ledger

**Calder Vale Wholesale Ltd** supplies catering and cleaning goods to businesses across the Kestrel Bay area. It employs about sixty people.

At the end of February 2026 the head of finance, {W1}, ran a cash reconciliation ahead of the year end and found a gap of nearly eighty thousand pounds that the stock figures could not explain. An internal review traced most of the gap to supplier payments made between July 2025 and February 2026.

The business has reported the matter and asked for an analyst to examine the material it holds. You are that analyst. You have been given the finance records, some staff documents, and access to the company's systems logs as exported by its IT team.

Your job is to work out what happened, show how you know, and say clearly what you cannot prove. Work methodically: log what you receive, check its integrity, keep to your scope, and back every finding with evidence.

*All people, businesses, places and data in this case are fictional.*
"""
    c.intake = {
        "tasking": f"Establish whether supplier payments made by {CO} between July 2025 and February 2026 were fraudulent, "
                   "identify how the payments were made and approved, and assess who is likely to be responsible.",
        "scope": [f"Business records of {CO}: bank statements, finance system exports, invoices, emails and policy documents",
                  "Staff rota, contact list and IT logs supplied by the company",
                  "Requests to third parties for data that is necessary and proportionate to the tasking"],
        "out_of_scope": ["Personal financial records of any individual, unless specific authority is granted",
                         "Any matter not connected to the supplier payments"],
        "authorities": [{"id": "AUTH-BASE", "label": "Company consent and tasking",
                         "covers": "Examination of all material supplied by the company for this enquiry"}],
        "constraints": ["Work on copies. Originals stay sealed.", "Do not contact staff directly. The case lead handles interviews.",
                        "Personal data about staff should only be used where it is relevant to the tasking."],
        "clock_start": "2026-03-09T09:00:00Z",
        "case_lead": "Detective Inspector, Economic Crime Unit",
        "osint_access": "public_only",
        "subjects": ["ENT-ORG2"],
    }

    # ------------------------------------------------------------------ entities
    E = c.entity
    E("ENT-ORG1", "organisation", CO, role="Victim organisation")
    E("ENT-ORG2", "organisation", FAKE, role="Receiving business")
    E("ENT-ORG3", "organisation", REAL, role="Genuine supplier")
    E("ENT-ORG4", "organisation", "Brackwell Shelving Systems", role="Contractor")
    E("ENT-P1", "person", P1, role="Accounts payable supervisor", identifiers=[P1_user], attributes={"workstation": "WS-AP-03"})
    E("ENT-P2", "person", P2, role="Finance manager", identifiers=[P2_user], attributes={"workstation": "WS-FM-01"})
    E("ENT-P3", "person", P3, role="Warehouse supervisor", identifiers=[P3_user])
    E("ENT-P4", "person", P4, role="Junior accounts clerk", identifiers=[P4_user])
    E("ENT-W1", "person", W1, role="Head of finance (witness)")
    E("ENT-W2", "person", W2, role="Office manager (witness)")
    E("ENT-W3", "person", W3, role="IT administrator (witness)")
    E("ENT-D1", "person", D1, role="Managing director")
    E("ENT-ACC1", "account", f"{CO} current account", identifiers=[acc_cvw[1]], attributes={"sort code": acc_cvw[0]})
    E("ENT-ACC2", "account", f"{FAKE} account", identifiers=[acc_fake[1]], attributes={"sort code": acc_fake[0]})
    E("ENT-ACC3", "account", f"{REAL} account", identifiers=[acc_genuine[1]], attributes={"sort code": acc_genuine[0]})
    E("ENT-ACC4", "account", f"{CO} refunds account", identifiers=[acc_refunds[1]], attributes={"sort code": acc_refunds[0]})
    E("ENT-ACC5", "account", "Personal account ending 3482", identifiers=[acc_p4[1]], attributes={"sort code": acc_p4[0]}, hidden_until="S4")
    E("ENT-ACC6", "account", "Personal account ending 0144", identifiers=[acc_p1[1]], attributes={"sort code": acc_p1[0]}, hidden_until="S3")
    E("ENT-PH1", "phone", f"{P1_work} (work mobile)", identifiers=[P1_work], hidden_until="S4")
    E("ENT-PH2", "phone", P1_personal, identifiers=[P1_personal], hidden_until="S3")
    E("ENT-PH3", "phone", f"{bank_line} (bank business line)", identifiers=[bank_line], hidden_until="S4")
    E("ENT-DEV1", "device", "Workstation WS-AP-03", identifiers=["WS-AP-03"])
    E("ENT-DEV2", "device", "Workstation WS-FM-01", identifiers=["WS-FM-01"])
    E("ENT-DEV3", "device", "Warehouse terminal WH-01", identifiers=["WH-01"])

    # ------------------------------------------------------------------ money
    fake_dates = ["2025-07-08", "2025-07-29", "2025-08-14", "2025-08-20", "2025-09-09", "2025-09-30", "2025-10-28",
                  "2025-10-29", "2025-11-11", "2025-11-25", "2025-12-09", "2025-12-23", "2025-12-30", "2026-01-20",
                  "2026-02-03", "2026-02-20"]
    fake_amounts = [4860.00, 4915.50, 4790.00, 4955.20, 4880.00, 4932.75, 4810.40, 4968.00, 4875.00, 4899.99,
                    4940.10, 4825.00, 4985.60, 4870.25, 4915.00, 4950.80]
    fake_total = round(sum(fake_amounts), 2)
    leave = [(t("2025-08-11 00:00"), t("2025-08-22 23:59")), (t("2025-10-27 00:00"), t("2025-10-31 23:59")),
             (t("2025-12-22 00:00"), t("2026-01-02 23:59"))]
    on_leave = lambda d: any(a <= t(d + " 12:00") <= b for a, b in leave)
    assert sum(on_leave(d) for d in fake_dates) == 6
    fake_invoices = [f"NPS-{1041 + i * 7}" for i in range(16)]
    approval_times = []  # true UTC
    for i, d in enumerate(fake_dates):
        base = t(d + " 06:40") if i == 0 else t(d + " 07:05") + timedelta(minutes=g.randint(0, 50))
        approval_times.append(base)

    suppliers = [("Ferncombe Paper Co", ("99-30-11", "11928374")), ("Lowe Hygiene Supplies", ("99-12-80", "34019287")),
                 ("Oakdale Foods", ("99-55-21", "88123450")), ("Thornwick Chemicals", ("99-47-03", "51920338")),
                 ("Rookfield Haulage", ("99-61-77", "70239914")), ("Ivymere Catering Equipment", ("99-08-45", "29450117"))]
    rows = []
    cur = t("2025-07-01 00:00")
    end = t("2026-02-28 00:00")
    bal = 182_440.15
    events = []
    while cur <= end:
        d = cur.strftime("%Y-%m-%d")
        if cur.weekday() < 5:
            # customer receipts
            for _ in range(g.randint(1, 3)):
                events.append((d, f"BACS CREDIT CUSTOMER {g.randint(1000, 9999)}", "", "", 0.0, g.money(900, 14500)))
            if cur.weekday() == 1:  # Tuesday supplier run
                for name, acc in g.sample(suppliers, 3):
                    events.append((d, f"FP {name.upper()}", acc[0], acc[1], g.money(600, 4980), 0.0))
            if cur.weekday() == 3 and g.chance(0.6):
                amt = g.money(1800, 4700) if g.chance(0.7) else g.money(5200, 8900)
                events.append((d, f"FP {REAL.upper()}", acc_genuine[0], acc_genuine[1], amt, 0.0))
        if cur.day == 28:
            events.append((d, "PAYROLL BATCH", "", "", g.money(96000, 99000), 0.0))
            events.append((d, "HMRC PAYE", "", "", g.money(23000, 25000), 0.0))
        if cur.day == 2:
            events.append((d, "DD KESTREL BAY ENERGY", "", "", g.money(2100, 3600), 0.0))
        cur += timedelta(days=1)
    for dd, amt, inv in zip(fake_dates, fake_amounts, fake_invoices):
        events.append((dd, f"FP {FAKE.upper()} {inv}", acc_fake[0], acc_fake[1], amt, 0.0))
    events.append(("2025-10-15", "FP BRACKWELL SHELVING SYSTEMS", "99-38-62", "47710583", 18400.00, 0.0))
    events.append(("2025-09-18", f"FP {REAL.upper()} INV-2209", acc_genuine[0], acc_genuine[1], 3120.40, 0.0))
    events.append(("2025-09-25", f"FP {REAL.upper()} INV-2209", acc_genuine[0], acc_genuine[1], 3120.40, 0.0))
    events.append(("2025-10-09", f"CREDIT {REAL.upper()} CREDIT NOTE CN-0311", acc_genuine[0], acc_genuine[1], 0.0, 3120.40))
    events.sort(key=lambda e: e[0])
    stmt_rows = []
    for dd, desc, sc, an, out, inn in events:
        bal = round(bal - out + inn, 2)
        stmt_rows.append([dd, desc, acc_cvw[1], sc, an, f"{out:.2f}" if out else "", f"{inn:.2f}" if inn else "", f"{bal:.2f}"])
    cols = ["date", "description", "account", "counterparty_sort_code", "counterparty_account", "paid_out", "paid_in", "balance"]
    tab = {"time_column": "date", "entity_columns": ["account", "counterparty_account"], "description_columns": ["description"]}

    def period(a, b):
        return [r for r in stmt_rows if a <= r[0] <= b]

    # ------------------------------------------------------------------ STAGE 1
    c.document("EV-001", "Internal review summary", "document", f"""
# Internal review: unexplained cash shortfall

**Prepared by:** {W1}, Head of Finance
**Date:** 27 February 2026
**Status:** Internal, prepared for the board and for the police referral

## What we found

The year-end cash reconciliation shows a shortfall of about **£79,000** against expected balances. Stock counts and debtor balances do not explain it.

Most of the gap appears to sit in supplier payments from the main current account between **July 2025 and February 2026**. Several payments went to a supplier called *{FAKE}*. Nobody in purchasing recognises any goods from this supplier.

## What we have not done

We have not spoken to any member of staff about this. We have not changed any user access, so as not to alert anyone. The finance system and email exports were taken by our IT administrator, {W3}, on 2 March 2026.

## Request

We ask that an analyst examines the records and gives an independent view of what happened and who may be involved.
""", source=f"{CO} finance team", source_group="cvw-internal", acquired="2026-03-02 14:00", stage="S1",
        summary="The head of finance's summary of the shortfall and why supplier payments are suspected.", grade=("B", "3"))

    c.document("EV-002", "Finance policy: payment approvals and new suppliers", "document", f"""
# Finance policy FP-04: Payment approvals

Version 3.1, approved by the board, January 2024.

## 1. Approval limits

1.1 Any single supplier payment up to **£5,000** may be approved by the finance manager acting alone.

1.2 Any payment **over £5,000** must also be countersigned by a director in the finance system before release.

1.3 Approvers must use their own login. Logins must never be shared.

## 2. New suppliers

2.1 A new supplier record may only be activated after a **two-person check**: one member of the accounts team creates the record and a second, more senior person checks the bank details by phoning the supplier on a number taken from an independent source.

2.2 Any request to change a supplier's bank details must be checked in the same way.

## 3. Refunds

3.1 Customer refunds must be logged in the sales system before payment, with the customer's own account details.
""", source=f"{CO} policy library", source_group="cvw-policy", acquired="2026-03-02 14:10", stage="S1",
        summary="The approval limit (5,000 pounds) and the two-person check for new suppliers.", grade=("A", "1"))

    for eid, title, a, b in [("EV-003", "Current account statements, July to September 2025", "2025-07-01", "2025-09-30"),
                             ("EV-004", "Current account statements, October to December 2025", "2025-10-01", "2025-12-31"),
                             ("EV-005", "Current account statements, January and February 2026", "2026-01-01", "2026-02-28")]:
        c.table(eid, title, "bank_statement", cols, period(a, b), table=tab, source=BANK, source_group="bank-cvw",
                acquired="2026-03-03 11:00", acquired_by="Case officer", stage="S1",
                summary=f"Bank statement lines for the {CO} current account.", grade=("A", "1"),
                metadata={"Account": f"{acc_cvw[0]} {acc_cvw[1]}", "Bank": BANK, "Format": "Bank CSV export"})

    sup_rows = [["SUP-0012", "Ferncombe Paper Co", suppliers[0][1][0], suppliers[0][1][1], "2019-03-11", "Active", "W2 checked"],
                ["SUP-0019", "Lowe Hygiene Supplies", suppliers[1][1][0], suppliers[1][1][1], "2018-06-02", "Active", "checked"],
                ["SUP-0023", REAL, acc_genuine[0], acc_genuine[1], "2016-01-20", "Active", "checked"],
                ["SUP-0031", "Oakdale Foods", suppliers[2][1][0], suppliers[2][1][1], "2020-09-14", "Active", "checked"],
                ["SUP-0034", "Thornwick Chemicals", suppliers[3][1][0], suppliers[3][1][1], "2021-02-03", "Active", "checked"],
                ["SUP-0040", "Rookfield Haulage", suppliers[4][1][0], suppliers[4][1][1], "2022-11-29", "Active", "checked"],
                ["SUP-0044", "Ivymere Catering Equipment", suppliers[5][1][0], suppliers[5][1][1], "2023-05-17", "Active", "checked"],
                ["SUP-0051", "Brackwell Shelving Systems", "99-38-62", "47710583", "2025-09-01", "Active", "checked"],
                ["SUP-0052", FAKE, acc_fake[0], acc_fake[1], "2025-07-07", "Active", ""]]
    c.table("EV-006", "Supplier master list", "spreadsheet",
            ["supplier_id", "name", "sort_code", "account", "created", "status", "two_person_check"], sup_rows,
            table={"entity_columns": ["account"]}, source=f"{CO} finance system", source_group="cvw-finance",
            acquired="2026-03-02 14:30", stage="S1", grade=("B", "2"),
            summary="Every supplier on the finance system with its bank details and set-up check.")

    c.document("EV-007", f"Witness statement: {W1}, head of finance", "statement", f"""
# Witness statement

**Name:** {W1}
**Role:** Head of Finance, {CO}
**Taken by:** Case officer, 3 March 2026

I have worked at {CO} for six years. I manage the finance team, which includes the finance manager, {P2}, the accounts payable supervisor, {P1}, and a junior clerk, {P4}.

At the end of February I prepared the year-end cash reconciliation and found a gap of nearly eighty thousand pounds. I looked through the supplier payments and saw a supplier I did not recognise, {FAKE}. I know {REAL} well because they have supplied us for years. I assumed at first it was part of the same firm.

All supplier payments up to five thousand pounds are approved by {P2}. Anything over that needs a director to countersign. I believe the payments to {FAKE} started in the summer. I cannot be more exact than that from memory.

{P2} is careful and has never given me any cause for concern. {P1} has been with us for four years and runs the day to day supplier work. I do not know of any money worries in the team.

I have not discussed this with anyone in the team.
""", source="Witness", source_group="witness-w1", acquired="2026-03-03 10:00", stage="S1", grade=("B", "3"),
        summary="The head of finance explains the shortfall and the approval process.")

    w1_rows = []
    d = t("2025-11-01 00:00")
    wb = 2310.44
    for i in range(24):
        amt = g.money(8, 140)
        wb = round(wb - amt, 2)
        w1_rows.append([(d + timedelta(days=i * 2)).strftime("%Y-%m-%d"), g.choice(["CARD GROCER", "CARD FUEL", "DD PHONE", "CARD CAFE", "CARD PHARMACY"]), f"{amt:.2f}", "", f"{wb:.2f}"])
    c.table("EV-008", f"Personal current account statement: {W1}", "bank_statement",
            ["date", "description", "paid_out", "paid_in", "balance"], w1_rows,
            table={"time_column": "date"}, source=f"Supplied in error with the company bank pack", source_group="bank-personal-w1",
            acquired="2026-03-03 11:00", stage="S1", marking="personal",
            handling="This statement belongs to a witness. It was included in the bank pack by mistake. It is outside the scope of the tasking.",
            summary="A witness's personal statement that arrived in the bank pack by mistake.", grade=("A", "1"))

    c.document("EV-009", "Management accounts summary, January 2026", "document", f"""
# Management accounts: January 2026

| Line | Month | Year to date |
|---|---|---|
| Sales | £612,400 | £5,104,900 |
| Cost of sales | £433,100 | £3,611,700 |
| Gross margin | 29.3% | 29.2% |
| Overheads | £151,800 | £1,248,300 |
| Operating profit | £27,500 | £244,900 |

Notes: Margin in line with budget. Fuel costs up 4% on last year. The new shelving in bay 3 was installed in October and is depreciated over ten years.
""", source=f"{CO} finance team", source_group="cvw-mgmt", acquired="2026-03-02 14:40", stage="S1", noise=True,
        summary="Monthly profit and loss summary.", grade=("B", "2"))

    sales_rows = [[f"SO-{50000 + i}", (t("2026-01-02 09:00") + timedelta(hours=g.randint(0, 900))).strftime("%Y-%m-%d"),
                   f"CUST-{g.randint(1000, 1400)}", f"{g.money(200, 9000):.2f}", g.choice(["Paid", "Paid", "Open"])] for i in range(40)]
    c.table("EV-010", "Sales ledger extract, January 2026", "spreadsheet", ["order", "date", "customer", "value", "status"],
            sales_rows, table={"time_column": "date"}, source=f"{CO} sales system", source_group="cvw-sales",
            acquired="2026-03-02 14:45", stage="S1", noise=True, summary="Customer orders for January.", grade=("B", "2"))

    c.document("EV-011", "Insurance renewal letter", "document", """
# Commercial insurance renewal

Your combined commercial policy renews on 1 April 2026. The premium has risen by 6 per cent due to a general market increase. Your fidelity guarantee cover (staff dishonesty) is limited to £50,000 per claim and requires notification within 30 days of discovery.

Please confirm the renewal by 20 March 2026.
""", source="Insurance broker", source_group="insurer", acquired="2026-03-02 15:00", stage="S1", noise=True,
        summary="Policy renewal letter, mentions fidelity cover.", grade=("B", "2"))

    # ------------------------------------------------------------------ STAGE 2
    appr_rows = []
    approvals = []
    for i, (inv, amt, when) in enumerate(zip(fake_invoices, fake_amounts, approval_times)):
        approvals.append((when, inv, FAKE, acc_fake[1], amt, P2_user, "WS-AP-03", ""))
    cur = t("2025-07-02 09:30")
    while cur < t("2026-02-27 00:00"):
        if cur.weekday() == 1:
            for name, acc in g.sample(suppliers, 2):
                approvals.append((cur + timedelta(minutes=g.randint(0, 300)), f"{name.split()[0][:3].upper()}-{g.randint(2000, 9999)}",
                                  name, acc[1], g.money(600, 4980), P2_user, "WS-FM-01", ""))
        cur += timedelta(days=1)
    approvals.append((t("2025-10-14 10:20"), "BSS-0091", "Brackwell Shelving Systems", "47710583", 18400.00, P2_user, "WS-FM-01", D1))
    approvals.append((t("2025-09-17 11:02"), "INV-2209", REAL, acc_genuine[1], 3120.40, P2_user, "WS-FM-01", ""))
    approvals.append((t("2025-09-24 10:41"), "INV-2209", REAL, acc_genuine[1], 3120.40, P2_user, "WS-FM-01", ""))
    approvals.sort()
    for when, inv, sup, acc, amt, who, ws, cs in approvals:
        pt = when - timedelta(hours=7 if t("2025-03-09 10:00") < when < t("2025-11-02 09:00") else 8)
        appr_rows.append([inv, sup, acc, f"{amt:.2f}", who, pt.strftime("%Y-%m-%d %H:%M"), ws, cs])
    c.table("EV-012", "Finance system approvals export", "spreadsheet",
            ["invoice", "supplier", "supplier_account", "amount", "approved_by", "approved_at", "workstation", "countersigned_by"],
            appr_rows, table={"time_column": "approved_at", "entity_columns": ["supplier_account", "approved_by", "workstation"],
                              "description_columns": ["invoice", "supplier"]},
            source=f"{CO} finance system (cloud hosted)", source_group="cvw-finance", acquired="2026-03-02 14:30", stage="S2",
            metadata={"Exported by": W3, "Export tool": "LedgerCloud reports v12", "Time zone": "America/Los_Angeles (vendor default, not changed)",
                      "Rows": str(len(appr_rows))},
            summary="Every invoice approval in the period, with who approved it and from which workstation.", grade=("B", "2"))

    gen_rows = [[r[0], r[1].replace("FP ", ""), r[5]] for r in stmt_rows if REAL.upper() in r[1] and r[5]]
    c.table("EV-013", f"Statement of account from {REAL}", "spreadsheet", ["date", "reference", "amount_received"], gen_rows,
            table={"time_column": "date"}, source=REAL, source_group="genuine-supplier", acquired="2026-03-05 09:00", stage="S2",
            summary=f"The genuine supplier's own record of what it received from {CO}.", grade=("B", "2"),
            metadata={"Note": "Supplied by the genuine supplier's credit controller at the case lead's request"})

    c.document("EV-014", f"New supplier form: {FAKE}", "document", f"""
# New supplier set-up form

| Field | Entry |
|---|---|
| Supplier name | {FAKE} |
| Trading address | Unit 4, Harbour Mailbox Centre, Kestrel Bay |
| Contact email | np.supplies.accounts@mailbox.test |
| Contact phone | (blank) |
| Sort code | {acc_fake[0]} |
| Account number | {acc_fake[1]} |
| Goods supplied | Packaging, pallet wrap, cartons |
| Created by | {P1_user} |
| Created on | 07/07/2025 16:52 |
| Checked by | (blank) |
| Check method | (blank) |
| Activated | 07/07/2025 16:58 |

System note: record activated without second approver (override used by {P1_user}).
""", source=f"{CO} finance system", source_group="cvw-finance", acquired="2026-03-02 14:30", stage="S2", grade=("B", "2"),
        summary="The supplier record for the receiving business, and who created it.")

    run_rows = []
    for i, dd in enumerate(fake_dates):
        run_rows.append([dd, f"RUN-{300 + i}", P1_user, "3" if i % 2 else "4", "Released"])
    c.table("EV-015", "Payment run log", "spreadsheet", ["date", "run", "prepared_by", "payments", "status"], run_rows,
            table={"time_column": "date"}, source=f"{CO} finance system", source_group="cvw-finance", acquired="2026-03-02 14:30",
            stage="S2", summary="Who prepared each payment run that included a payment to the receiving business.", grade=("B", "2"))

    c.document("EV-016", "Brackwell Shelving Systems: quote, order and approval", "document", f"""
# Bay 3 shelving: purchase file

**Quote:** Brackwell Shelving Systems, 2 September 2025, £18,400 including installation.
**Board minute:** 9 September 2025, item 6: replacement of bay 3 racking approved. Proposed by {D1}.
**Purchase order:** PO-7781, raised 10 September 2025.
**Invoice:** BSS-0091, 13 October 2025, £18,400.
**Approval:** approved by {P2_user} on 14 October 2025 and countersigned by {D1} (director) the same day.
**Delivery note:** signed by {P3}, warehouse supervisor, 17 October 2025.
""", source=f"{CO} purchasing", source_group="cvw-purchasing", acquired="2026-03-02 15:10", stage="S2", grade=("B", "2"),
        summary="The paperwork behind the single largest payment in the period.")

    c.document("EV-017", f"Duplicate invoice INV-2209 and credit note", "document", f"""
# INV-2209 query

On 26 September 2025, {P4} noticed that invoice INV-2209 from {REAL} for £3,120.40 had been paid twice, on 18 and 25 September.

Email from {P4} to {REAL} credit control, 26 September 2025:

> Hi, we have paid INV-2209 twice by mistake. The invoice was keyed in again when the paper copy arrived after the emailed copy. Could you please issue a credit note? Thanks.

Reply, 8 October 2025: credit note CN-0311 for £3,120.40 issued, refunded by bank transfer.

Note added by {P2}: process changed so paper copies are stamped COPY on arrival.
""", source=f"{CO} accounts team", source_group="cvw-accounts", acquired="2026-03-02 15:10", stage="S2", grade=("B", "2"),
        summary="How a duplicate payment to the genuine supplier was found and refunded.")

    petty = [[(t("2025-07-03 00:00") + timedelta(days=9 * i)).strftime("%Y-%m-%d"), g.choice(["Milk and tea", "Postage", "Window cleaner", "Car park", "Batteries"]), f"{g.money(3, 45):.2f}", g.choice([W2, P4])] for i in range(25)]
    c.table("EV-018", "Petty cash book", "spreadsheet", ["date", "item", "amount", "by"], petty, table={"time_column": "date"},
            source=f"{CO} office", source_group="cvw-office", acquired="2026-03-02 15:20", stage="S2", noise=True,
            summary="Small office purchases.", grade=("B", "2"))
    fuel = [[(t("2025-07-05 00:00") + timedelta(days=6 * i)).strftime("%Y-%m-%d"), g.choice(["VQ7-2KX", "ZX4-9QJ", "QJ1-5ZZ"]), f"{g.money(40, 95):.2f}", g.choice(["Kestrel Bay", "Harrowgate Road", "Moorend"])] for i in range(30)]
    c.table("EV-019", "Fuel card statement", "spreadsheet", ["date", "vehicle", "amount", "site"], fuel, table={"time_column": "date"},
            source="Fuel card provider", source_group="fuelcard", acquired="2026-03-02 15:20", stage="S2", noise=True,
            summary="Delivery van fuel purchases.", grade=("B", "2"))
    writeoff = [[f"SKU-{g.randint(10000, 99999)}", g.choice(["Damaged in transit", "Out of date", "Count difference"]), str(g.randint(1, 40)), f"{g.money(5, 300):.2f}"] for _ in range(18)]
    c.table("EV-020", "Stock write-off report, Q4 2025", "spreadsheet", ["sku", "reason", "units", "value"], writeoff,
            source=f"{CO} warehouse system", source_group="cvw-warehouse", acquired="2026-03-02 15:30", stage="S2", noise=True,
            summary="Stock written off in the last quarter.", grade=("B", "2"))

    # Simulated web: the business register
    c.site("register", "Business Register Search", "business-register.test", "business", "#2b5c8a", "Public register of companies and sole traders")
    c.page(id="PG-001", site="register", url="https://business-register.test/company/04417293", kind="page",
           title=f"{REAL} - company 04417293", fields={"Status": "Active", "Incorporated": "14 January 2009",
                                                     "Registered office": "Moorend Industrial Estate, Kestrel Bay",
                                                     "Nature of business": "Manufacture of packaging", "Trading names": "None registered",
                                                     "Website": "northgatepackaging.example.com"},
           body="Accounts filed to 31 March 2025. No other trading names or divisions are registered for this company.",
           search_terms=["northgate", "northgate packaging", "04417293", "packaging"])
    c.page(id="PG-002", site="register", url="https://business-register.test/search?q=northgate+packaging+supplies", kind="listing",
           title="Search results: Northgate Packaging Supplies",
           body=f"No company or registered business name matches **{FAKE}**.\n\nSimilar names: {REAL} (04417293, active); Northgate Pallets Ltd (dissolved 2017).",
           links=["PG-001", "PG-003"], search_terms=["northgate packaging supplies", "northgate supplies", "nps"])
    c.page(id="PG-003", site="register", url="https://business-register.test/company/09983120", kind="page",
           title="Northgate Pallets Ltd - company 09983120 (dissolved)",
           fields={"Status": "Dissolved", "Incorporated": "2 May 2011", "Dissolved": "8 August 2017"},
           body="This company was dissolved in 2017. It has no connection to the businesses in this case.",
           search_terms=["northgate pallets", "northgate"])

    # ------------------------------------------------------------------ STAGE 3
    inv_meta_times = [t(d + " 15:30") - timedelta(days=2) + timedelta(minutes=g.randint(0, 120)) for d in fake_dates]
    for k, idx in enumerate([0, 3, 9, 14]):
        eid = f"EV-0{21 + k}"
        inv, amt, d = fake_invoices[idx], fake_amounts[idx], fake_dates[idx]
        created = inv_meta_times[idx]
        c.document(eid, f"Invoice {inv} from {FAKE}", "invoice", f"""
# INVOICE {inv}

**{FAKE}**
Unit 4, Harbour Mailbox Centre, Kestrel Bay
np.supplies.accounts@mailbox.test

**Bill to:** {CO}, Accounts Payable

| Description | Qty | Unit | Total |
|---|---|---|---|
| Pallet stretch wrap, 500mm | {g.randint(40, 80)} | rolls | |
| Double wall cartons, assorted | {g.randint(300, 600)} | units | |
| Void fill and tape | 1 | lot | |
| **Total due** | | | **£{amt:,.2f}** |

Payment terms: 14 days. Bank: sort code {acc_fake[0]}, account {acc_fake[1]}.
No VAT number shown.
""", source=f"{CO} accounts payable invoice store", source_group="invoices-nps", acquired="2026-03-02 14:50", stage="S3",
            metadata={"Author": P1_user, "Creator": "Writer 7.4", "Producer": "PDFMaker 6.2",
                      "CreateDate": iso(created), "ModDate": iso(created + timedelta(minutes=3)),
                      "Computer name": "WS-AP-03", "Pages": "1"},
            summary="One of the invoices paid to the receiving business, with its document metadata.", grade=("B", "2"))
    c.document("EV-025", f"Invoice INV-2290 from {REAL}", "invoice", f"""
# INVOICE INV-2290

**{REAL}**, Moorend Industrial Estate, Kestrel Bay. Company 04417293. VAT GB 000 1234 56

| Description | Qty | Total |
|---|---|---|
| Printed cartons, 2 colour | 1,200 | £2,640.00 |
| Delivery | 1 | £85.00 |
| VAT at 20% | | £545.00 |
| **Total** | | **£3,270.00** |

Bank: sort code {acc_genuine[0]}, account {acc_genuine[1]}.
""", source=f"{CO} accounts payable invoice store", source_group="invoices-genuine", acquired="2026-03-02 14:50", stage="S3",
        metadata={"Author": "credit.control", "Creator": "InvoiceCloud", "Producer": "InvoiceCloud PDF service",
                  "CreateDate": "2025-11-03T09:12:44Z", "Pages": "1"},
        summary="A genuine invoice from the real supplier, for comparison.", grade=("B", "2"))

    c.email("EV-026", "Email: introducing Northgate Packaging Supplies", headers=[
        ("Return-Path", "<bounce-7731@mailbox.test>"),
        ("Received", "from relay.mailbox.test (relay.mailbox.test [203.0.113.45]) by mx.calder-vale.example.com; Fri, 04 Jul 2025 10:12:09 +0100"),
        ("Authentication-Results", "mx.calder-vale.example.com; spf=softfail smtp.mailfrom=mailbox.test; dkim=none"),
        ("From", f"\"Northgate Packaging Accounts\" <accounts@northgate-packaging.example.net>"),
        ("Reply-To", "<np.supplies.accounts@mailbox.test>"),
        ("To", f"<{P1_user}@calder-vale.example.com>"),
        ("Date", "Fri, 04 Jul 2025 10:12:03 +0100"),
        ("Subject", "Our new supplies division"),
        ("Message-ID", "<20250704091203.4471@relay.mailbox.test>"),
    ], body=f"""Dear accounts team,

As a valued customer of {REAL}, we are pleased to tell you that consumable packaging will now be invoiced by our new division, {FAKE}.

Please set us up as a new supplier using the bank details on our first invoice, which will follow shortly.

Kind regards
Accounts, {FAKE}""", source=f"{CO} email export", source_group="cvw-email", acquired="2026-03-02 15:00", stage="S3",
        metadata={"Mailbox": f"{P1_user}@calder-vale.example.com", "Folder": "Inbox", "Forwarded": "No"},
        summary="The email that introduced the receiving business.", grade=("C", "2"))

    c.email("EV-027", f"Email: {P1} to {P2}, cover while on leave", headers=[
        ("From", f"<{P1_user}@calder-vale.example.com>"), ("To", f"<{P2_user}@calder-vale.example.com>"),
        ("Date", "Fri, 08 Aug 2025 16:40:12 +0100"), ("Subject", "Re: cover while I'm away"),
        ("Message-ID", "<a8812@calder-vale.example.com>")],
        body=f"""Hi {first(P2)},

No problem, I'll keep the supplier runs ticking over while you're off. Anything over the limit I'll leave for when you're back or ask {first(D1)}.

Have a great holiday.
{first(P1)}

> On 8 Aug 2025, {P2} wrote:
> I'm off from Monday for two weeks. I won't have my laptop. Please hold anything that needs my approval.""",
        source=f"{CO} email export", source_group="cvw-email", acquired="2026-03-02 15:00", stage="S3",
        summary="An exchange about who would cover approvals during leave.", grade=("C", "2"))

    c.email("EV-028", f"Email: {REAL} credit control confirms no new division", headers=[
        ("From", "<credit.control@northgatepackaging.example.com>"), ("To", "<case.officer@police.example.com>"),
        ("Date", "Wed, 04 Mar 2026 11:20:00 +0000"), ("Subject", "Re: query about Northgate Packaging Supplies"),
        ("Message-ID", "<cc-5512@northgatepackaging.example.com>")],
        body=f"""Hello,

Thank you for your query. {REAL} has no division, subsidiary or trading name called {FAKE}. We have never used the domain northgate-packaging.example.net. Our only email domain is northgatepackaging.example.com.

Our bank details have not changed since 2016.

Credit Control, {REAL}""", source=REAL, source_group="genuine-supplier", acquired="2026-03-04 11:20", stage="S3",
        summary="The genuine supplier says it has no such division.", grade=("B", "2"))

    c.email("EV-029", "Email: legal advice on recovery options (privileged)", headers=[
        ("From", "<partner@harbourlaw.example.com>"), ("To", f"<{W1.split()[0].lower()}@calder-vale.example.com>"),
        ("Date", "Thu, 05 Mar 2026 17:02:00 +0000"), ("Subject", "PRIVILEGED AND CONFIDENTIAL: recovery options"),
        ("Message-ID", "<hl-9921@harbourlaw.example.com>")],
        body="""This email contains legal advice and is subject to legal professional privilege.

Our view on the prospects of recovery from the insurer and from any individual found responsible is set out below. Please do not forward this email...

(The remainder of this email sets out the solicitor's advice.)""",
        source=f"{CO} email export", source_group="cvw-email-legal", acquired="2026-03-06 09:00", stage="S3", marking="privileged",
        handling="Legally privileged. Included in the export by mistake. Do not rely on or quote it. Flag it to the case lead.",
        summary="Legal advice to the company. Privileged material.", grade=("B", "3"))

    assets = [["IT-0103", "WS-AP-03", P1_user, "Accounts office, desk 3", "Windows 11", "Writer 7.4; PDFMaker 6.2; LedgerCloud client", "2025-05-12"],
              ["IT-0101", "WS-FM-01", P2_user, "Finance manager office", "Windows 11", "LedgerCloud client", "2025-05-12"],
              ["IT-0104", "WS-AP-04", P4_user, "Accounts office, desk 4", "Windows 11", "LedgerCloud client", "2025-05-12"],
              ["IT-0110", "WS-HF-01", W1.split()[0][0].lower() + "." + sur(W1).lower(), "Head of finance office", "Windows 11", "LedgerCloud client", "2025-05-12"],
              ["IT-0201", "WH-01", "shared", "Warehouse office", "Windows 10", "Warehouse system", "2025-05-14"],
              ["IT-0310", "LT-FM-01", P2_user, "Laptop, returned to IT store 2024", "Windows 10", "none", "2024-11-02"]]
    c.table("EV-030", "IT asset register", "spreadsheet", ["asset", "device", "assigned_user", "location", "os", "software", "last_audit"],
            assets, table={"entity_columns": ["device", "assigned_user"]}, source=f"{CO} IT", source_group="cvw-it",
            acquired="2026-03-02 16:00", stage="S3", summary="Which device is assigned to which user.", grade=("B", "2"))
    c.email("EV-031", "Email: summer staff barbecue", headers=[("From", f"<{W2.split()[0].lower()}@calder-vale.example.com>"), ("To", "<all-staff@calder-vale.example.com>"), ("Date", "Mon, 14 Jul 2025 09:00:00 +0100"), ("Subject", "Summer barbecue Friday 25th")],
            body="Hi all, the barbecue is on Friday 25 July from 4pm in the yard. Please let me know about dietary needs by Wednesday.", source=f"{CO} email export", source_group="cvw-email", acquired="2026-03-02 15:00", stage="S3", noise=True, summary="Staff social email.", grade=("C", "2"))
    c.email("EV-032", "Email: delivery slot change", headers=[("From", "<bookings@rookfield-haulage.example.com>"), ("To", f"<{P3_user}@calder-vale.example.com>"), ("Date", "Tue, 21 Oct 2025 13:30:00 +0100"), ("Subject", "Thursday delivery slot")],
            body="Your Thursday 07:00 slot has moved to 06:30 due to roadworks on the ring road.", source=f"{CO} email export", source_group="cvw-email", acquired="2026-03-02 15:00", stage="S3", noise=True, summary="A haulier changes a delivery time.", grade=("C", "2"))

    # Bank response (request RR-1)
    c.document("EV-033", f"{BANK}: account opening details for {FAKE}", "response", f"""
# Response to data request

**From:** {BANK}, Financial Crime Disclosure Team
**Account:** {FAKE}, sort code {acc_fake[0]}, account {acc_fake[1]}

## Account opening

| Field | Detail |
|---|---|
| Account type | Sole trader business account (online application) |
| Application received | 02/07/2025 21:14 |
| Account opened | 03/07/2025 |
| Applicant name | R. Northgate |
| Date of birth given | 11/04/1984 |
| Address given | Unit 4, Harbour Mailbox Centre, Kestrel Bay (a mail forwarding service) |
| Contact mobile | {P1_personal} |
| Contact email | np.supplies.accounts@mailbox.test |
| Identity check | Document image uploaded. Electronic check returned "refer". Account opened on manual review. |
| Device IP at application | 198.51.100.77 |

The bank has no further identity information for the applicant.
""", source=BANK, source_group="bank-saltmarsh", acquired="2026-03-10 15:00",
        summary="Who opened the receiving account, when, and with what contact details.", grade=("A", "2"))
    acc2_rows = []
    ab = 0.0
    out_i = 0
    for dd, amt in zip(fake_dates, fake_amounts):
        ab = round(ab + amt, 2)
        acc2_rows.append([dd, f"FP {CO.upper()}", acc_cvw[1], f"{amt:.2f}", "", f"{ab:.2f}"])
        d2 = (t(dd + " 00:00") + timedelta(days=1)).strftime("%Y-%m-%d")
        move = round(amt * (0.85 if out_i % 3 else 0.7), 2)
        ab = round(ab - move, 2)
        acc2_rows.append([d2, f"TFR {first(P1)[0]} {sur(P1).upper()}", acc_p1[1], "", f"{move:.2f}", f"{ab:.2f}"])
        if out_i % 3 == 0:
            cash = round(min(ab, 500.0), 2)
            ab = round(ab - cash, 2)
            acc2_rows.append([d2, "ATM KESTREL BAY HIGH ST", "", "", f"{cash:.2f}", f"{ab:.2f}"])
        out_i += 1
    c.table("EV-034", f"{BANK}: statement for {FAKE} account", "bank_statement",
            ["date", "description", "counterparty_account", "paid_in", "paid_out", "balance"], acc2_rows,
            table={"time_column": "date", "entity_columns": ["counterparty_account"], "description_columns": ["description"]},
            source=BANK, source_group="bank-saltmarsh", acquired="2026-03-10 15:00",
            summary="Money in and out of the receiving account.", grade=("A", "1"),
            metadata={"Account": f"{acc_fake[0]} {acc_fake[1]}"})

    # ------------------------------------------------------------------ STAGE 4
    rota_rows = []
    d = t("2025-07-07 00:00")
    while d < t("2026-02-28 00:00"):
        wk = d.strftime("%Y-%m-%d")
        p2 = "Leave" if any(a <= d + timedelta(days=2) <= b for a, b in leave) else "In"
        p3 = "Nights (cover)" if d.month in (9, 11, 12, 1) and d.day < 15 else "Days"
        rota_rows.append([wk, "In", p2, p3, "In", "In"])
        d += timedelta(days=7)
    c.table("EV-035", "Staff rota and leave calendar", "rota", ["week_commencing", P1, P2, P3, P4, W2], rota_rows,
            table={"time_column": "week_commencing"}, source=f"{CO} office manager", source_group="cvw-hr",
            acquired="2026-03-02 15:40", stage="S4", summary="Who was in, on leave or on nights each week.", grade=("B", "2"))

    log_rows = []
    for when, inv, *_ in approvals:
        if inv in fake_invoices:
            log_rows.append([iso(when - timedelta(minutes=6)), P1_user, "WS-AP-03", "logon", "10.20.1.33"])
            log_rows.append([iso(when - timedelta(minutes=2)), P2_user, "WS-AP-03", "switch user logon", "10.20.1.33"])
            log_rows.append([iso(when), P2_user, "WS-AP-03", "LedgerCloud approval session", "10.20.1.33"])
            log_rows.append([iso(when + timedelta(minutes=3)), P1_user, "WS-AP-03", "switch user return", "10.20.1.33"])
    cur = t("2025-07-01 08:00")
    while cur < t("2026-02-28 00:00"):
        if cur.weekday() < 5:
            log_rows.append([iso(cur + timedelta(minutes=g.randint(0, 40))), P1_user, "WS-AP-03", "logon", "10.20.1.33"])
            if not any(a <= cur <= b for a, b in leave):
                log_rows.append([iso(cur + timedelta(minutes=g.randint(20, 70))), P2_user, "WS-FM-01", "logon", "10.20.1.31"])
            log_rows.append([iso(cur + timedelta(minutes=g.randint(10, 60))), P4_user, "WS-AP-04", "logon", "10.20.1.34"])
        if cur.month in (9, 11, 12, 1) and cur.day < 15 and cur.weekday() < 5:
            log_rows.append([iso(cur + timedelta(hours=14, minutes=g.randint(0, 200))), P3_user, "WH-01", "logon", "10.20.2.10"])
        cur += timedelta(days=1)
    log_rows.sort()
    c.table("EV-036", "Network login log (UTC)", "login_log", ["time_utc", "user", "workstation", "event", "ip"], log_rows,
            table={"time_column": "time_utc", "entity_columns": ["user", "workstation"]}, source=f"{CO} IT (domain controller export)",
            source_group="cvw-it-logs", acquired="2026-03-02 16:10", stage="S4",
            summary="Every logon on company workstations, in UTC.", grade=("A", "2"),
            metadata={"Time zone": "UTC", "Exported by": W3})

    contact_rows = [[P1, "Accounts payable supervisor", "214", P1_work, P1_personal], [P2, "Finance manager", "210", P2_mob, ""],
                    [P3, "Warehouse supervisor", "301", P3_mob, ""], [P4, "Junior accounts clerk", "215", P4_mob, ""],
                    [W1, "Head of finance", "200", W1_mob, ""], [W2, "Office manager", "100", W2_mob, ""], [W3, "IT administrator", "120", W3_mob, ""]]
    c.table("EV-037", "Staff contact list", "spreadsheet", ["name", "role", "extension", "work_mobile", "personal_mobile_emergency"],
            contact_rows, table={"entity_columns": ["work_mobile", "personal_mobile_emergency"]}, source=f"{CO} office manager",
            source_group="cvw-hr", acquired="2026-03-02 15:40", stage="S4", summary="Staff phone numbers, including personal numbers given for emergencies.", grade=("B", "2"))

    c.document("EV-038", f"Witness statement: {W2}, office manager", "statement", f"""
# Witness statement

**Name:** {W2}
**Role:** Office manager
**Taken by:** Case officer, 5 March 2026

I keep the staff rota and the leave calendar. Leave is booked through me.

{P2} took two weeks off in August, a week at the end of October and the Christmas fortnight. When {first(P2)} is on leave, nobody else can approve payments unless a director logs in. That is my understanding.

{P2} does not take a laptop home. {first(P2)} handed the old one back to IT a while ago.

{P3} works in the warehouse. Over the autumn and winter {first(P3)} covered a lot of night shifts because we were short staffed, but only in the winter months. I have seen {first(P3)} using the warehouse terminal late at night to book in deliveries.

{P1} is usually first in. I often see {first(P1)} at their desk before eight o'clock.

I keep the contact list. Staff give a personal number for emergencies if they want to.
""", source="Witness", source_group="witness-w2", acquired="2026-03-05 10:00", stage="S4", grade=("B", "3"),
        summary="The office manager on leave, night shifts and who is in early.")

    c.document("EV-039", f"Witness statement: {W3}, IT administrator", "statement", f"""
# Witness statement

**Name:** {W3}
**Role:** IT administrator
**Taken by:** Case officer, 5 March 2026

I took the exports from the finance system, email and the domain controller on 2 March 2026 and handed them to the case officer on sealed media.

Each user has their own login. The finance PCs have fast user switching turned on. That means a second person can log on to a PC without the first person logging off, and switch back afterwards.

The finance system lets an approval be made from any company workstation, as long as the user's own password is entered. There is no second factor. I have reminded staff more than once not to write passwords down. I once found a password on a sticky note under a keyboard in the accounts office. I cannot remember whose desk it was.

The finance system is hosted by the vendor in the United States. Its reports use the vendor's own time zone unless you change the setting. I did not change it when I exported the data.

{P2}'s old laptop, LT-FM-01, was returned in November 2024 and has been in the IT store since. It has not been used.
""", source="Witness", source_group="witness-w3", acquired="2026-03-05 11:00", stage="S4", grade=("B", "2"),
        summary="The IT administrator on logins, fast user switching and the export time zone.")

    refunds = []
    rb = 4210.00
    legit_refunds = []
    cur = t("2025-07-10 00:00")
    while cur < t("2026-02-25 00:00"):
        if g.chance(0.18):
            amt = g.money(30, 400)
            cust = f"CUST-{g.randint(1000, 1400)}"
            sc, an = g.account()
            legit_refunds.append((cur.strftime("%Y-%m-%d"), cust, an, amt))
        cur += timedelta(days=1)
    bad_refunds = [("2025-08-27", "CUST-1187", 186.40), ("2025-10-08", "CUST-1033", 214.90), ("2025-11-19", "CUST-1290", 197.15),
                   ("2026-01-14", "CUST-1102", 238.00), ("2026-02-11", "CUST-1251", 205.75)]
    allref = [(d, cu, an, a, True) for d, cu, an, a in legit_refunds] + [(d, cu, acc_p4[1], a, False) for d, cu, a in bad_refunds]
    allref.sort()
    for d, cu, an, a, ok in allref:
        rb = round(rb - a, 2)
        refunds.append([d, f"REFUND {cu}", acc_refunds[1], an, f"{a:.2f}", f"{rb:.2f}"])
    c.table("EV-040", "Refunds account statements, July 2025 to February 2026", "bank_statement",
            ["date", "description", "account", "counterparty_account", "paid_out", "balance"], refunds,
            table={"time_column": "date", "entity_columns": ["account", "counterparty_account"], "description_columns": ["description"]},
            source=BANK, source_group="bank-cvw", acquired="2026-03-03 11:00", stage="S4",
            summary="Payments out of the refunds account.", grade=("A", "1"))
    log = [[d, cu, an, f"{a:.2f}", g.choice(["Damaged goods", "Short delivery", "Price error"]), P4_user] for d, cu, an, a in legit_refunds]
    c.table("EV-041", "Customer refund log (sales system)", "spreadsheet", ["date", "customer", "refund_account", "amount", "reason", "logged_by"],
            log, table={"time_column": "date"}, source=f"{CO} sales system", source_group="cvw-sales", acquired="2026-03-02 14:45",
            stage="S4", summary="Refunds logged before payment, as the policy requires.", grade=("B", "2"))

    nights = [[(t("2025-09-01 00:00") + timedelta(days=i)).strftime("%Y-%m-%d"), P3, "22:00-06:00", g.choice(["Rookfield Haulage", "Oakdale Foods", "Lowe Hygiene"]), str(g.randint(4, 22))]
              for i in range(0, 130, 3) if (t("2025-09-01 00:00") + timedelta(days=i)).month in (9, 11, 12, 1)]
    c.table("EV-042", "Warehouse night deliveries log", "spreadsheet", ["date", "supervisor", "shift", "haulier", "pallets"], nights,
            table={"time_column": "date"}, source=f"{CO} warehouse system", source_group="cvw-warehouse", acquired="2026-03-02 15:30",
            stage="S4", summary="Deliveries booked in during night shifts.", grade=("B", "2"))

    payroll = [[P1, acc_p1[0], acc_p1[1]], [P2, "99-20-18", "31847760"], [P3, "99-33-71", "90215538"], [P4, acc_p4[0], acc_p4[1]],
               [W1, acc_w1[0], acc_w1[1]], [W2, "99-77-02", "18420693"], [W3, "99-14-58", "62037741"]]
    c.table("EV-043", "Payroll bank details report", "spreadsheet", ["employee", "sort_code", "account"], payroll,
            table={"entity_columns": ["account"]}, source=f"{CO} payroll", source_group="cvw-payroll", acquired="2026-03-06 10:00",
            stage="S4", handling="Contains staff bank details. Use only the entries relevant to the tasking.",
            summary="Bank details held for staff salary payments.", grade=("A", "2"))

    # Requests in stage 4
    cdr = []
    for when, other, dur in [("2025-07-01 12:31", bank_line, 412), ("2025-07-02 20:58", bank_line, 960), ("2025-07-03 08:15", bank_line, 545),
                             ("2025-07-07 17:20", P4_mob, 64)]:
        cdr.append([when, P1_personal, other, str(dur), "voice", "KB-CELL-12"])
    cur = t("2025-06-20 08:00")
    others = [g.mobile() for _ in range(6)]
    while cur < t("2025-07-20 00:00"):
        for _ in range(g.randint(0, 3)):
            cdr.append([(cur + timedelta(minutes=g.randint(0, 720))).strftime("%Y-%m-%d %H:%M"), P1_personal, g.choice(others), str(g.randint(5, 900)), g.choice(["voice", "sms"]), g.choice(["KB-CELL-12", "KB-CELL-07"])])
        cur += timedelta(days=1)
    cdr.sort()
    c.table("EV-044", f"Call records for {P1_personal}", "cdr", ["time_utc", "from", "to", "duration_s", "type", "cell"], cdr,
            table={"time_column": "time_utc", "entity_columns": ["from", "to"]}, source="Mobile network operator", source_group="network-cdr",
            acquired="2026-03-12 10:00", summary="Calls and texts from the number given on the bank application.", grade=("A", "2"))
    p4rows = []
    pb = 640.12
    for d, cu, a in bad_refunds:
        pb = round(pb + a, 2)
        p4rows.append([d, f"FP {CO.upper()} REFUND {cu}", f"{a:.2f}", "", f"{pb:.2f}"])
        p4rows.append([(t(d + " 00:00") + timedelta(days=2)).strftime("%Y-%m-%d"), "CARD ONLINE RETAIL", "", f"{g.money(40, 150):.2f}", f"{pb:.2f}"])
    c.table("EV-045", f"Personal account statement extract: account ending 3482", "bank_statement",
            ["date", "description", "paid_in", "paid_out", "balance"], p4rows, table={"time_column": "date"},
            source="Personal account bank, under authority", source_group="bank-personal-p4", acquired="2026-03-12 14:00",
            marking="personal", handling="Obtained under specific authority. Use only for the refund enquiry.",
            summary="Credits from the company refunds account into a personal account.", grade=("A", "1"))

    # ------------------------------------------------------------------ requests
    c.request_type("RT-BANK", "data", "Bank: account holder and opening details", ["account"], "S3", True,
                   "Ask a bank for who opened an account, when, and the statement for a date range.")
    c.request_type("RT-CDR", "data", "Network: call records for a number", ["phone"], "S4", True,
                   "Ask a network operator for call and text records for one number over a date range.")
    c.request_type("RT-PERS", "authority", "Authority: examine a person's own bank account", ["person"], "S4", False,
                   "Ask the case lead for authority to obtain one person's personal bank records.")
    c.request_rule("RR-1", "RT-BANK", ["ENT-ACC2"],
                   "The bank has supplied the account opening details and statement for the receiving account.",
                   evidence=["EV-033", "EV-034"], must_cover=["2025-07-08", "2026-02-20"], max_days=400,
                   justification=[["payment", "paid", "invoice", "transfer"], ["fraud", "false", "fake", "suspicious", "limit", "approval", "not genuine", "no goods"]],
                   min_groups=2,
                   refuse_broad="Refused. The bank will not provide every account. Name the receiving account and the period of the payments.",
                   refuse_dates="Refused as framed. Your dates do not cover the whole period of the payments to this account.",
                   refuse_justification="Refused. Explain why this account matters: link it to the payments you have found.")
    c.request_rule("RR-2", "RT-CDR", ["ENT-PH2"],
                   "The network has supplied call records for the number for the dates you asked.",
                   evidence=["EV-044"], must_cover=["2025-07-02", "2025-07-03"], max_days=60,
                   justification=[["bank", "account", "opening", "opened", "application"], ["contact", "number", "mobile", "phone"]],
                   min_groups=2,
                   refuse_broad="Refused. Call records are intrusive. Keep the window to the days around the account opening.",
                   refuse_dates="Refused as framed. The window does not cover the days when the account was applied for and opened.")
    c.request_rule("RR-3", "RT-PERS", ["ENT-P4"],
                   "Authority granted to obtain the relevant extract of the personal account that received refund payments.",
                   evidence=["EV-045"], authority="AUTH-P4-ACCOUNT",
                   justification=[["refund"], ["account", "paid", "payment"], ["log", "not logged", "no record", "missing", "payroll", "matches"]],
                   min_groups=2,
                   refuse_justification="Refused. Show why this person's own account is relevant: what links them to the payments?")

    # ------------------------------------------------------------------ traps
    c.trap("Working outside scope", "scope", {"kind": "evidence_opened", "ids": ["EV-008"], "unless_authority": "AUTH-W1-ACCOUNT"}, 3, "major",
           "The witness's personal statement arrived by mistake and is outside your tasking. Leave it unopened, note it in the log and tell the case lead so it can be returned.",
           "This is a witness's personal bank statement that was supplied in error. It is outside your scope. Opening it is a procedural error.")
    c.trap("Ignoring a time zone", "clock", {"kind": "clock_uncorrected", "ids": ["EV-012"], "offset_minutes": -420, "tolerance_minutes": 20}, 1.5, "minor",
           "The approvals export uses the vendor's Pacific time zone. Convert to UTC before building the timeline, or your dates will be wrong.",
           "Check the time zone of this export before you use its times. Look at the item's metadata.")
    c.trap("Overclaiming: the approver set up the scheme", "overclaim",
           {"kind": "finding_claim", "keywords": [[sur(P2), "finance manager"], ["set up", "created", "organised", "ran the scheme", "behind the", "responsible for the fraud", "committed", "stole"]], "types": ["fact", "inference"]},
           3, "major", "The approvals were made under the finance manager's login, but six were made while they were on leave and all came from another person's workstation. A login proves an account was used, not who used it.",
           "Careful. The approvals carry this person's login, but is that the same as proving they set up the scheme?")
    c.trap("Confirmation bias", "bias",
           {"kind": "confirmation_bias", "keywords": [[sur(P2), "finance manager"], ["approv"]], "contradicting": ["EV-035", "EV-038"]}, 2, "minor",
           "You relied on the approvals log without checking the rota or the office manager's statement, which show the approver was away for some of them.")
    c.trap("Mishandling privileged material", "sensitive", {"kind": "sensitive_cited", "ids": ["EV-029"]}, 3, "major",
           "Legally privileged advice must not be quoted or relied on. It should be set aside and flagged to the case lead.")

    # ------------------------------------------------------------------ stages
    c.stage("S1", "Triage and first look", 20,
            f"Welcome. The material from {CO} is in your evidence list. Start by logging receipt of everything and checking it, then take a first look at the bank statements. Tell me which payments look wrong and why.",
            [("OB-1-1", "Log receipt of every item in the evidence list", True, C_received(all_released=True),
              ["Each item needs its receipt logged before you examine it.", "Use Log receipt in the evidence list, or Log all.", "Select every item in the evidence list and log receipt."]),
             ("OB-1-2", "Check the hash of every item you have received", False, C_hashed(all_released=True),
              ["The integrity checker compares files with their acquisition hash.", "Open the Integrity tab or use Hash all in the evidence list.", "Run Hash all on the released items."]),
             ("OB-1-3", "Record a finding about the pattern in the suspicious payments", True, C_finding("KF-01"),
              ["Look at the size of the payments to the unfamiliar supplier.", f"Compare those amounts with the policy in EV-002.", f"Every payment to {FAKE} is just under £{LIMIT:,}. Record that as a finding citing a statement and the policy."]),
             ("OB-1-4", "Grade at least three sources", False, C_graded(3),
              ["Grading shows how far you trust a source and its content.", "Use the grade control in the evidence viewer.", "Grade three items, for example A1 for bank statements."])])
    c.stage("S2", "Follow the money", 40,
            f"Good start. I have added the finance system exports and the genuine supplier's own statement. Work out whether {FAKE} is really part of {REAL}, how many payments it received, and build a first timeline.",
            [("OB-2-1", f"Establish whether {FAKE} is the same business as {REAL}", True, C_finding("KF-02"),
              ["Compare the bank details of the two suppliers.", "The supplier master list, the genuine supplier's statement and the business register all help.", f"Record a finding that {FAKE} is a different business with a similar name, citing EV-006 and EV-013 or a captured register page."]),
             ("OB-2-2", "Count the payments made to the receiving business", True, C_finding("KF-09"),
              ["Filter the statements for the receiving business.", "Search for its name across the statements and the approvals export.", "There are sixteen payments. Record the count, citing a statement and the approvals export."]),
             ("OB-2-3", "Build a timeline with at least five events", True, C_timeline(5),
              ["Use Add to timeline from a table row, or add events by hand.", "Start with the supplier set-up and the first and last payments.", "Add five events, each citing the item it came from."]),
             ("OB-2-4", "Check the time zone of the approvals export", False, C_finding("KF-14"),
              ["Not every system records times in UTC.", "Look at the metadata of the approvals export and compare with the login log later.", "The export is in Pacific time. Record a finding that the first approval was really on 8 July UTC."])],
            unlock=C_objectives("S1"), unlock_text="Opens when the required stage 1 objectives are complete.", osint_pages=["PG-001", "PG-002", "PG-003"])
    c.stage("S3", "Documents and emails", 35,
            "Now look at the invoices and emails. Check what the documents' metadata tells you, and look closely at the email that introduced the new supplier. If you need information from the bank, make a request, but keep it focused.",
            [("OB-3-1", "Find what the invoice metadata reveals", True, C_finding("KF-04"),
              ["Open an invoice from the receiving business and look at the metadata panel.", "Compare the author and computer name with the IT asset register.", "The invoices were authored on WS-AP-03 by the AP supervisor's user. Cite two invoices or an invoice and the asset register."]),
             ("OB-3-2", "Find the problem with the introduction email", True, C_finding("KF-05"),
              ["Open the email headers panel.", "Compare the From address with the Reply-To address.", "Record that the Reply-To does not match the sender, citing EV-026 and the genuine supplier's reply EV-028."]),
             ("OB-3-3", "Obtain the account opening details from the bank with a justified request", True, C_request("RR-1"),
              ["Requests must name a specific target and period.", "Choose the receiving account and cover every payment date.", "Request bank details for the receiving account from 2025-07-08 to 2026-02-20 and explain the payments are suspected to be false."]),
             ("OB-3-4", "Establish when the receiving account was opened", True, C_finding("KF-03"),
              ["The bank response gives the opening date.", "Compare it with the first payment.", "Record that the account was opened on 3 July 2025, five days before the first payment, citing EV-033 and a statement."])],
            unlock=C_objectives("S2"), unlock_text="Opens when the required stage 2 objectives are complete.")
    c.stage("S4", "People and the wider picture", 20,
            "The rota, login logs and contact list are in. Test who could have made the approvals, look for any link between the receiving business and the staff, and draw it on the link chart. Keep an eye out for anything else that does not look right.",
            [("OB-4-1", "Test the approvals against the leave calendar", True, C_finding("KF-06"),
              ["Compare approval dates with the rota.", "Some approvals happened during the finance manager's leave.", "Record that six approvals were made while the finance manager was on leave, citing the rota and the approvals export."]),
             ("OB-4-2", "Identify where the approvals were made from", True, C_finding("KF-07"),
              ["The approvals export and the login log both name a workstation.", "Which workstation is that, and who is it assigned to?", "Record that every approval to the receiving business came from WS-AP-03, citing the login log and the asset register."]),
             ("OB-4-3", "Find the contact detail the receiving business shares with a member of staff", True, C_finding("KF-08"),
              ["Compare the bank's contact number with the staff contact list.", "Look at the personal numbers column.", "Record that the mobile on the bank application is the AP supervisor's personal number, citing EV-033 and EV-037."]),
             ("OB-4-4", "Draw an evidenced link between the receiving account and the person it connects to", True, C_link("ENT-ACC2", "ENT-P1"),
              ["Use the link chart.", "Which person do the bank's contact details point to?", "Link the receiving account to the AP supervisor, citing EV-033 and EV-037."]),
             ("OB-4-5", "Use call records to test contact with the bank around the opening date", True, C_finding("KF-10"),
              ["Make a narrow call records request.", "Target the number on the bank application for the days around the opening.", "Request records for that number from 2025-07-01 to 2025-07-04, then record the calls to the bank's business line."]),
             ("OB-4-6", "Look for a second, smaller scheme", False, C_finding("KF-13"),
              ["Not all the missing money went through supplier payments.", "Compare the refunds account with the refund log.", "Five refunds went to one account that is not in the refund log. Record it."])],
            unlock=C_objectives("S3"), unlock_text="Opens when the required stage 3 objectives are complete.")
    c.stage("S5", "Assessment and report", 15,
            "Time to bring it together. Separate what is proved from what is likely, grade your findings, say what you cannot answer, complete the legality statement and write the report.",
            [("OB-5-1", "Assess whether the approver's login proves who approved the payments", True, C_finding("KF-11"),
              ["Think about fast user switching and the leave dates.", "A login shows an account was used. Does it show who used it?", "Record an inference that the finance manager's login was probably used by someone else, citing the rota and the login log."]),
             ("OB-5-2", "Give your assessment of who is most likely responsible, and why", True, C_finding("KF-12"),
              ["Bring together the device, the contact number and the onward payments.", "Use cautious wording and label it an inference.", "Record that the AP supervisor is most likely responsible, citing at least two independent sources."]),
             ("OB-5-3", "Grade at least six items or findings", True, C_graded(6),
              ["Grade the items your key findings rest on.", "Bank records are usually A1 or A2. Witness statements are usually lower.", "Grade six items or findings."]),
             ("OB-5-4", "Complete and sign the legality, necessity and proportionality statement", True, C_legality(),
              ["Open the report tab.", "Write a sentence or more for each of the three parts.", "Fill in legality, necessity and proportionality, then sign."])],
            unlock=C_objectives("S4"), unlock_text="Opens when the required stage 4 objectives are complete.")

    # ------------------------------------------------------------------ solution
    P1s, P2s, P4s = sur(P1), sur(P2), sur(P4)
    F = c.finding
    F("KF-01", f"Every payment to {FAKE} sits just under the £5,000 single approval limit.", "fact", ["EV-003", "EV-004", "EV-005", "EV-002", "EV-012", "EV-007"],
      [["under", "below", "just", "less than"], ["5,000", "5000", "limit", "threshold"]],
      "Amounts between £4,790 and £4,986 keep each payment below the level that would need a director's countersignature.")
    F("KF-02", f"{FAKE} is a different business from the genuine supplier {REAL}, using a similar name and its own bank account.", "fact",
      ["EV-006", "EV-013", "EV-028", "PG-001", "PG-002"], [["similar", "different", "not the same", "not part", "look-alike", "lookalike", "separate", "no connection", "not connected"], ["name", "supplier", "business", "account"]],
      "The supplier list shows different bank details, the genuine supplier's own statement has none of these payments, and the register has no such business.")
    F("KF-03", "The receiving account was opened on 3 July 2025, five days before the first payment on 8 July.", "fact", ["EV-033", "EV-003", "EV-034"],
      [["opened", "opening"], ["days", "before", "shortly", "five", "3 july", "03/07", "2025-07-03"]],
      "An account opened just before a stream of payments starts is a strong sign it was set up to receive them.")
    F("KF-04", "The invoices from the receiving business share the same author and were created on workstation WS-AP-03.", "fact",
      ["EV-021", "EV-022", "EV-023", "EV-024", "EV-030"], [["author", "creator", "created", "metadata"], ["WS-AP-03", "workstation", "same computer", "same device", "ap-03"]],
      "Document metadata shows the invoices were written inside the business, on the AP supervisor's computer, not by an outside supplier.")
    F("KF-05", "The introduction email has a Reply-To address that does not match its sender, and came from a look-alike domain.", "fact", ["EV-026", "EV-028"],
      [["reply-to", "reply to", "replyto"], ["match", "different", "not the same", "mismatch", "differs"]],
      "Replies went to a mailbox the sender controlled, not to the domain shown in the From line.")
    F("KF-06", "Six approvals to the receiving business were made while the finance manager was on leave.", "fact", ["EV-012", "EV-035", "EV-038", "EV-027"],
      [["leave", "holiday", "absent", "away", "off"], ["approv"]],
      "The named approver could not have been at work for these approvals, so someone else must have used the login.")
    F("KF-07", "Every approval to the receiving business was made from workstation WS-AP-03, which is assigned to the accounts payable supervisor.", "fact",
      ["EV-012", "EV-036", "EV-030"], [["WS-AP-03", "ap-03", "workstation"], ["approv", "login", "logged", "session"]],
      "The finance manager normally approves from WS-FM-01. These approvals all used fast user switching on another person's computer.")
    F("KF-08", "The contact mobile on the bank application is the accounts payable supervisor's personal number.", "fact", ["EV-033", "EV-037"],
      [["mobile", "phone", "number", "contact"], ["same", "matches", "match", "share", "belongs", "is the"]],
      "A single shared contact detail ties the receiving account to a member of staff.")
    F("KF-09", f"{FAKE} received sixteen payments between July 2025 and February 2026, totalling £{fake_total:,.2f}.", "fact",
      ["EV-003", "EV-004", "EV-005", "EV-012", "EV-034"], [["16", "sixteen"], ["payment"]],
      "Quantifying the loss is a key output for the case lead and the business.")
    F("KF-10", "The number on the bank application called the bank's business line on 1, 2 and 3 July 2025, around the time the account was applied for and opened.", "fact",
      ["EV-044", "EV-033"], [["call", "rang", "phoned"], ["bank", "business line", "0555"]],
      "Call records corroborate the bank's account opening timeline with the same number.")
    F("KF-11", "The finance manager's login was probably used by someone else for the approvals, so the login alone does not show who approved them.", "inference",
      ["EV-035", "EV-036", "EV-039", "EV-038", "EV-012"], [["login", "credentials", "account", "password", "user"], ["someone else", "another", "not prove", "doesn't prove", "does not prove", "misused", "used by", "not the finance manager", "other person"]],
      "Leave dates, the workstation and fast user switching all point away from the named approver.")
    F("KF-12", "On the evidence, the accounts payable supervisor is most likely responsible for the main scheme.", "inference",
      ["EV-033", "EV-037", "EV-030", "EV-036", "EV-034", "EV-043", "EV-014", "EV-021", "EV-015"],
      [[P1s, "accounts payable supervisor", "ap supervisor", "payable supervisor"], ["likely", "probably", "most likely", "indicates", "suggests", "points to", "assess"]],
      "Several independent strands point the same way, but the case is still an inference: nobody saw who sat at WS-AP-03.")
    F("KF-13", f"A second, smaller scheme sent five refunds totalling £1,042.20 to a personal account not in the refund log.", "fact",
      ["EV-040", "EV-041", "EV-045", "EV-043"], [["refund"], ["five", "5", "personal", "not logged", "not in the", "no record", "missing", P4s, "clerk"]],
      "The refund log has no entries for these five payments, and the receiving account belongs to the junior clerk.", required=False)
    F("KF-14", "The approvals export uses Pacific time, so the first approval was at 06:40 UTC on 8 July 2025, not on 7 July.", "fact",
      ["EV-012", "EV-036", "EV-039"], [["pacific", "pdt", "pst", "utc-7", "utc-07", "time zone", "timezone", "los angeles"]],
      "Reading the export at face value puts the start of the scheme a day early.", required=False, min_sources=1)
    F("KF-15", "Most of the money paid into the receiving account was moved on to a personal account in the accounts payable supervisor's name.", "fact",
      ["EV-034", "EV-043"], [["transfer", "moved", "onward", "out of", "sent on", "tfr"], [P1s, "supervisor", "0144", "personal account"]],
      "Following the money one step further shows who benefited.", required=False)
    F("KF-16", "The introduction email used a look-alike domain, northgate-packaging.example.net, which the genuine supplier has never used.", "fact",
      ["EV-026", "EV-028", "PG-001"], [["domain", "look-alike", "lookalike", "example.net", "similar address", "hyphen"]],
      "Look-alike domains are a common way to borrow a real business's trust.", required=False)

    c.link("ENT-ACC1", "ENT-ACC2", ["EV-003", "EV-004", "EV-005", "EV-034"], "Sixteen payments from the company to the receiving account")
    c.link("ENT-ORG2", "ENT-ACC2", ["EV-006", "EV-033"], "The receiving business's bank account")
    c.link("ENT-PH2", "ENT-ACC2", ["EV-033"], "Contact mobile on the bank application")
    c.link("ENT-PH2", "ENT-P1", ["EV-037"], "Personal number in the staff contact list")
    c.link("ENT-ACC2", "ENT-P1", ["EV-033", "EV-037", "EV-034", "EV-043"], "Contact detail and onward transfers")
    c.link("ENT-DEV1", "ENT-P1", ["EV-030"], "Assigned workstation")
    c.link("ENT-ACC2", "ENT-ACC6", ["EV-034"], "Onward transfers")
    c.link("ENT-ACC6", "ENT-P1", ["EV-043"], "Payroll account")

    c.event("TL-1", "2025-07-02 21:14", "Online application for the receiving account", ["EV-033"], tolerance_minutes=60)
    c.event("TL-2", "2025-07-03 08:15", "Call from the application number to the bank's business line", ["EV-044"], tolerance_minutes=30)
    c.event("TL-3", "2025-07-04 09:12", "Introduction email from the look-alike domain arrives", ["EV-026"], tolerance_minutes=90)
    c.event("TL-4", "2025-07-07 15:52", "Supplier record created and activated without a second check", ["EV-014", "EV-006"], tolerance_minutes=720)
    c.event("TL-5", "2025-07-08 06:40", "First approval to the receiving business, from WS-AP-03", ["EV-012", "EV-036"], tolerance_minutes=20)
    c.event("TL-6", "2025-07-08 12:00", "First payment to the receiving business", ["EV-003", "EV-034"], tolerance_minutes=720)
    c.event("TL-7", f"{fake_dates[2]} 12:00", "First approval while the finance manager was on leave", ["EV-012", "EV-036", "EV-035"], tolerance_minutes=720)
    c.event("TL-8", "2026-02-20 12:00", "Last payment to the receiving business", ["EV-005", "EV-034"], tolerance_minutes=720)
    c.event("TL-9", "2026-02-27 12:00", "Internal review completed", ["EV-001"], tolerance_minutes=1440, key=False)

    c.herring("RH-1", f"The genuine supplier, {REAL}", ["EV-013", "EV-003", "EV-004", "EV-005", "EV-025", "PG-001"],
              [[REAL, "genuine supplier"], ["fraud", "fake", "false", "bogus", "suspicious", "involved"]],
              "Payments to the genuine supplier match its own statement and invoices. The similar name is the point of the scheme, not a sign the real firm is involved.")
    c.herring("RH-2", f"The warehouse supervisor's late logins", ["EV-036", "EV-042", "EV-038"],
              [[sur(P3), "warehouse supervisor", "WH-01"], ["suspicious", "involved", "responsible", "fraud", "unusual"]],
              "The late logins match night shifts booked in the delivery log and the office manager's account.")
    c.herring("RH-3", "The £18,400 shelving payment", ["EV-016", "EV-004", "EV-012"],
              [["18,400", "18400", "shelving", "brackwell"], ["suspicious", "fraud", "irregular", "improper", "unexplained"]],
              "It went through a board decision, a purchase order, a director's countersignature and a signed delivery note.")
    c.herring("RH-4", "The duplicate payment of INV-2209", ["EV-017", "EV-003", "EV-012"],
              [["duplicate", "2209", "paid twice"], ["fraud", "deliberate", "scheme", "dishonest"]],
              "It was a keying mistake, spotted by a clerk and refunded by credit note within three weeks.")

    c.gap("GAP-1", "Nobody can say from the records who was physically at WS-AP-03 when the approvals were made",
          [["cannot", "can't", "unable", "no evidence", "not possible", "not known", "no cctv", "unknown"], ["who", "physically", "person", "sat", "seated", "at the workstation", "at the desk"]])
    c.gap("GAP-2", "Where the cash withdrawals went cannot be traced",
          [["cash", "withdraw", "atm"], ["unknown", "cannot", "can't", "not known", "unclear", "untraced", "not traced"]])
    c.gap("GAP-3", "The identity document used to open the account has not been examined",
          [["identity", "id document", "applicant", "r. northgate", "r northgate"], ["not", "unknown", "unverified", "false", "examine"]])

    c.solution["next_steps"] = (
        "Ask the bank for the identity document image and application IP records; check the mail forwarding service's customer records; "
        "secure WS-AP-03 for forensic examination before any interview; review whether the finance manager's password was written down; "
        "refer the refund payments separately; and recommend that the business switches off fast user switching and adds a second factor to approvals.")

    # ------------------------------------------------------------------ statements (comparison tool)
    S1 = c.statement("EV-007", W1, "Head of finance", "2026-03-03", [
        (f"The finance team is {P2} (finance manager), {P1} (accounts payable supervisor) and {P4} (junior clerk).", {"entities": ["ENT-P2", "ENT-P1", "ENT-P4"]}),
        "At the end of February the year-end cash reconciliation showed a gap of nearly eighty thousand pounds.",
        (f"I assumed at first that {FAKE} was part of {REAL}.", {"entities": ["ENT-ORG2", "ENT-ORG3"]}),
        (f"Supplier payments up to five thousand pounds are approved by {P2}; anything over needs a director to countersign.", {"entities": ["ENT-P2"]}),
        (f"I believe the payments to {FAKE} started in the summer.", {"entities": ["ENT-ORG2"]}),
        (f"{P2} is careful and has never given me cause for concern.", {"entities": ["ENT-P2"]}),
        "I have not discussed this with anyone in the team.",
    ])
    S2 = c.statement("EV-038", W2, "Office manager", "2026-03-05", [
        "I keep the staff rota and the leave calendar. Leave is booked through me.",
        (f"{P2} took two weeks off in August, a week at the end of October and the Christmas fortnight.", {"entities": ["ENT-P2"]}),
        (f"When {first(P2)} is on leave, nobody else can approve payments unless a director logs in.", {"entities": ["ENT-P2"]}),
        (f"{P2} does not take a laptop home and handed the old one back to IT.", {"entities": ["ENT-P2"]}),
        (f"{P3} covered night shifts, but only in the winter months.", {"entities": ["ENT-P3"]}),
        (f"I have seen {first(P3)} using the warehouse terminal late at night to book in deliveries.", {"entities": ["ENT-P3", "ENT-DEV3"]}),
        (f"{P1} is usually first in; I often see {first(P1)} at their desk before eight o'clock.", {"entities": ["ENT-P1"]}),
        "Staff give a personal number for emergencies if they want to.",
    ])
    S3 = c.statement("EV-039", W3, "IT administrator", "2026-03-05", [
        ("I took the exports from the finance system, email and domain controller on 2 March 2026 and handed them over on sealed media.", {"time": "2026-03-02 16:00"}),
        "The finance PCs have fast user switching turned on, so a second person can log on without the first logging off.",
        "An approval can be made from any company workstation as long as the user's own password is entered. There is no second factor.",
        "I once found a password on a sticky note under a keyboard in the accounts office, but cannot remember whose desk it was.",
        "The finance system's reports use the vendor's own time zone, and I did not change it when I exported the data.",
        (f"{P2}'s old laptop, LT-FM-01, was returned in November 2024 and has not been used since.", {"entities": ["ENT-P2"]}),
    ])
    c.check(f"{S1}.3", "contradicted", f"The genuine supplier's credit control says it has no new division, and the supplier list shows different bank details. The head of finance's assumption was understandable but wrong.", evidence=["EV-028", "EV-006", "PG-002"])
    c.check(f"{S1}.4", "supported", "The finance policy sets the same single approval limit and countersignature rule.", evidence=["EV-002"])
    c.check(f"{S1}.5", "supported", "The first payment to the receiving business is on 8 July 2025, which is summer.", evidence=["EV-003", "EV-034"])
    c.check(f"{S2}.2", "supported", "The leave calendar shows the same three periods of leave.", evidence=["EV-035"])
    c.check(f"{S2}.3", "conflicts", "The office manager believes nobody else can approve during leave. The IT administrator explains that anyone at any workstation can approve with the user's password. This is a difference in knowledge, not a lie.", other=f"{S3}.3")
    c.check(f"{S2}.3", "contradicted", "Six approvals under the finance manager's login were made during leave, so other people clearly could approve.", evidence=["EV-012", "EV-035"])
    c.check(f"{S2}.4", "agrees", "Both witnesses say the finance manager's old laptop went back to IT.", other=f"{S3}.6")
    c.check(f"{S2}.5", "contradicted", "The night deliveries log and the rota show nights in September as well as the winter months. It is a small slip of memory that does not change her account of the late logins.", evidence=["EV-042", "EV-035"])
    c.check(f"{S2}.6", "supported", "The login log shows evening logons on the warehouse terminal during the night shift months.", evidence=["EV-036", "EV-042"])
    c.check(f"{S3}.2", "supported", "The login log shows 'switch user logon' and 'switch user return' events on WS-AP-03 around each approval.", evidence=["EV-036"])
    c.check(f"{S3}.5", "supported", "The approvals export's metadata names the vendor's Pacific time zone.", evidence=["EV-012"])
    c.trap("Mistaking a difference for a lie", "statements",
           {"kind": "lie_claim", "keywords": [["lie", "lied", "lying", "liar", "untruthful", "dishonest", "false statement", "made up", "fabricat", "deliberately misled", "covering up"]]},
           2, "minor",
           "Witnesses misremember dates and details all the time. A difference between a statement and the records, or between two statements, is something to note and explain, not proof that someone lied. Only say a person lied if evidence shows they knew the truth and said otherwise.",
           "Careful. Does the evidence show this person knew the truth and chose to say otherwise, or could it be a gap in memory or knowledge?")

    # ------------------------------------------------------------------ skill areas and suggested route
    for f in c.solution["findings"]:
        f["skill"] = {"KF-02": "osint", "KF-16": "osint", "KF-14": "evidence", "KF-04": "evidence",
                      "KF-11": "reporting", "KF-12": "reporting"}.get(f["id"], "analysis")
    c.route("S1", "Log receipt and hash everything first", "Before opening anything, log receipt of all items and run Hash all, so the chain of custody has no gaps.")
    c.route("S1", "Read the policy, then the statements", "The approval limit in EV-002 explains why every payment sits just under five thousand pounds.")
    c.route("S2", "Compare supplier bank details", "Put the supplier list beside the genuine supplier's own statement. The bank details differ.")
    c.route("S2", "Check the export's time zone", "The approvals export is in Pacific time. Convert before building the timeline.")
    c.route("S3", "Read invoice metadata and email headers", "The invoices were written on WS-AP-03, and the introduction email's Reply-To does not match its sender.")
    c.route("S3", "Make one narrow bank request", "Ask only for the receiving account, covering the payment dates, with a clear reason.")
    c.route("S4", "Test the login against the rota", "Six approvals happened during leave, all from WS-AP-03 with fast user switching.")
    c.route("S4", "Compare the statements side by side", "The office manager's belief about approvals conflicts with the IT administrator's account. Note it, do not call it a lie.")
    c.route("S5", "Label the conclusion as an inference", "Write who is most likely responsible, cite independent sources, and say what cannot be proved.")
    c.solution["story"] = __doc__.split("STORY BIBLE (private, for authors)")[1].strip()
    return c
