# Notice and lesson status verification — 2026-10-16

- Added persisted calendar-only teacher visibility control. Detail-table teacher names remain visible.
- Enlarged notice academy logo and name; checked desktop and mobile rendering.
- Temporary lesson selector includes source, calculated, and manually entered lessons.
- Occurrence editing preserves attendance kinds in progress, fixed-weekday and selected-date drafts. Absence notice and free makeup cost zero; priced makeup accepts a per-occurrence amount.
- Changes affect calculator drafts, not intranet source records.

Validation: 68 Node unit tests passed, including status persistence and waived/priced amounts. Four browser scenarios passed with synthetic gateway data: existing temporary course selection, actual absence/priced makeup, forecast/temporary absence restoration, notice teacher visibility and persistence. No browser page errors. Desktop/mobile screenshots inspected. Browser fixture never writes student records.

Commands: `node --test tests/*.test.cjs`; `node tests/status-notice.browser.cjs` with Playwright available via NODE_PATH. Set TEST_URL to run the same synthetic browser checks against deployed assets.
