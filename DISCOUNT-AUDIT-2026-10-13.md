# Intranet discount visibility — 2026-10-13

The API returned discounted charges but omitted their provenance, making the calculator’s separate 0% adjustment appear to mean no discount was applied.

The progress DTO now includes exact base/final/percent/special-rate evidence, without private reasons. Merged lessons retain evidence from all fragments; waived attendance remains zero while normal forecasts retain their own evidence. This is a display change: source tuition and rounding are unchanged.

Calendar amounts, daily detail, progress lesson lists, grouped notices, prior-month notices and progress messages display the applied discount. Notice totals explain that it is already included; calculator discount is labeled separately. Local amount or duration edits clear source evidence. Older snapshots remain compatible and acquire evidence on refresh. Manual tuition with no source evidence is never reverse-calculated or labeled by guessing a student’s rate.

Validation:
- 66 frontend unit tests passed.
- 34 focused backend tests passed; 16 progress API tests also passed against the isolated live-source release.
- 32 existing browser regression scenarios passed.
- New desktop and 390px mobile browser flows passed: 18 × 59,063 = 1,063,134; base 18 × 84,375 = 1,518,750; separate 10% calculator adjustment gives 956,821. Saved draft restore and genuine PNG generation were exercised with synthetic data. Clipboard write was captured in the browser, not sent to the OS clipboard.
- Exported PNG inspected for text wrapping and teacher names.

Deployment uses the freshly downloaded production function source, replacing only feecalcProgress.js and using a minimal export entrypoint for feeCalculatorApi. Other dirty local intranet changes and billing engine bundle are excluded. Exact API patch is stored beside this report. No student, payment, attendance or saved production record was written.
