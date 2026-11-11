# Synthetic data rules

All data in Investafiction is fictional. These rules stop any real person, number or place being matched by accident. The generators in `tools/invtools/gen.py` follow them, and `python -m invtools check` scans every text file for anything outside the reserved ranges.

| Kind | Rule |
|---|---|
| Mobile numbers | Only 07700 900000 to 07700 900999, the range set aside for TV and drama |
| Landlines | Only 020 7946 0000 to 020 7946 0999 |
| Email addresses | Only example.com, example.net, example.org, or domains ending .test, .invalid or .example |
| Web addresses | Only domains ending .test, .invalid or .example |
| IP addresses | Only the documentation ranges 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24. Private internal ranges such as 10.0.0.0/8 are also allowed for company networks |
| Vehicle registrations | Invented strings with a hyphen, which no current UK format uses |
| Banking | A fictional bank and sort codes in the 99 block |
| Names | Random combinations from the generator, checked against a guard list |
| Images | Drawn as SVG for the pack, with the licence in the manifest. No real faces and no photos of real places |
| Maps | The invented town of Kestrel Bay. No real streets |
| Content | No graphic detail. The missing person case never shows harm |
| Resemblance | Case ideas must be original and must not resemble real incidents |

## Review checklist

Tick every line before a case is added to a pack.

- [ ] The safety scan passes with no errors.
- [ ] Every phone number, email, web address, IP address and registration came from the generator or the ranges above.
- [ ] No name matches a public figure. Search any name you typed by hand.
- [ ] No real business, brand or organisation is named.
- [ ] Every image was drawn for the pack, has no real face, and has its licence recorded.
- [ ] The map and places are fictional.
- [ ] There is no graphic violence, harm to anyone, or sexual content.
- [ ] Sensitive themes, such as a missing person, are handled with care.
- [ ] The story does not resemble a real, reported incident.
- [ ] The legal and procedural rules in the case are labelled as simplified teaching rules.
