# UI consistency validation

The UI rules are recorded in AGENTS.md. This change standardizes inline list editing, mobile quantity controls, image previews, category ordering, translated copy, and initial profile preferences. Main-list delete confirmations use the existing accessible dialog component.

## Automated checks

- 68 Vitest tests passed, including preference loading, category hierarchy, and EN/TR translation parity.
- 16 Playwright tests passed: English and Turkish at desktop (1440x900) and mobile (390x844) widths. These use isolated mocked authentication/API data, not live credentials.
- Browser coverage includes image dialogs, quantity and full inline edits, edit failures, initial dark/light preferences, maintenance edits, empty/error states, and category/definition/inventory creation, editing, reload persistence, and deletion.
- Production build and TypeScript checks passed during implementation. Final lightweight validation covers lint/type checks and the affected mobile browser journeys.
- Lint retains four existing warnings (unused directives/import/catch variable).
- On Node 26, run Vitest with `NODE_OPTIONS=--no-experimental-webstorage` so jsdom supplies test storage.

## Live in-app checks

Backend: https://home-inventory-backend-us-459154861005.us-central1.run.app/api/v1

An existing authenticated session was reused in the selected Test Home. Fresh sign-in was not tested.

| Combination | Live coverage |
| --- | --- |
| Turkish desktop | Category, definition, and inventory create/edit/reload/delete flow passed; hierarchical category selection and dark preference verified. |
| Turkish mobile (390x844) | Creation of linked records, visible quantity quick-edit, save/reload persistence, responsive list controls, and cleanup passed. Full category/definition edit journey was not repeated. |
| English desktop | Initial read-only UI inspection; full live journey not run. |
| English mobile | Full live journey not run. |

The user requested light final testing instead of extending the manual matrix. Full live coverage across all four combinations is therefore not claimed; all four combinations have automated mocked coverage.

Fixtures used the unique prefixes `UI-20260921-TR-D` and `UI-20260921-TR-M`. All created inventory items, definitions, and categories were removed. Existing household records were preserved. Saved Turkish/Dark preferences were preserved and the temporary viewport override was reset.

Live inspection uncovered a language preference response containing only a language ID and a quantity update with an omitted empty expiry date. The frontend now resolves language IDs and sends null for an empty expiry date, consistently with the full inline editor. The corrected mobile quantity update was verified against the live backend.
