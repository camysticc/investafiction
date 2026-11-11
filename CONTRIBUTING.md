# Contributing

Thank you for wanting to help. The most useful contributions are new cases, playtest notes and bug reports.

## Writing a case

1. Read the [authoring guide](docs/AUTHORING.md) and the [synthetic data rules](docs/SYNTHETIC_DATA.md).
2. Create your case with `PYTHONPATH=tools python -m invtools new your-case`.
3. Build it and make sure the validator, solvability check and safety scan all pass.
4. Play it yourself, then have someone else play it, and note the time per stage.
5. Open a pull request with the story script (not the built `.invcase` file), the review checklist ticked, and your timing notes.

## Code changes

- Keep each change on its own branch and open a pull request.
- Run the tests before opening it: `cargo test` in `core/`, `pytest tests/python` with `PYTHONPATH=tools`, and `npm run typecheck` in `app/`.
- Changes to the pack format need a schema change in `schemas/`, matching changes in the Rust types and the Python validator, and a note on how older packs are handled.

## Writing style

Use British spelling. Keep wording plain and clear. Never describe the app's rules as real procedure or legal advice.

## Contributor statement

By submitting a contribution you agree that:

- it is your own work, or you have the right to submit it;
- it is licensed under the same terms as the part of the project it changes (PolyForm Noncommercial 1.0.0 for code, CC BY-NC-SA 4.0 for cases and documentation); and
- the project owner may also license your contribution under other terms in future, including commercial terms.

The last point keeps the option to relicense the project later. If you are not comfortable with it, please say so in your pull request before it is merged.

## Conduct

Be kind and constructive. Never put real people, real personal data or real incidents into a case.
