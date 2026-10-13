# Historical tuition correction — 2026-10-13

The FeeCalc API read published historical lessons without applying saved corrections or deletions. A stale historical price therefore overrode the intended recurring price in current imports and their forecasts.

The isolated API patch applies savedBillingLessons to historical published lessons before selecting recurring-price evidence. Only previously published lesson IDs participate; new unpublished drafts remain excluded. Student-scoped draft reads run alongside period reads and enforce a 1,000-row cap. Existing rate-unit, override, discount and billing rules are unchanged.

Read-only reproduction with the reported student's existing October data:
- Two-hour English session: old deployed source 200,000; candidate 100,000.
- Actual monthly subtotal: 1,123,750 → 1,023,750, matching the supplied Intranet display.
- October 13, 20 and 27 English forecasts: 100,000 each.
- All forecast subtotal: 2,293,750 → 1,993,750.

Validation:
- 4 new regressions pass: saved correction and forecast, genuine hourly rate, deleted donor, excluded unpublished donor. The old deployed source fails the correction and deletion cases.
- 34 focused backend tests pass against the isolated release.
- 66 frontend unit tests pass.

Deployment is restricted to fir-lms-prod / asia-northeast3 / feeCalculatorApi. The release starts from freshly downloaded production source, changes only carriedFees.js plus a minimal single-function export entrypoint, and retains the generated billing engine and earlier discount DTO. The exact patch and synthetic regression are stored beside this report. No student, payment, attendance or saved production record is changed.

Re-run the synthetic regression with API_ROOT pointing at the deployed function source directory:

    API_ROOT=/path/to/functions node --test API-CARRY-2026-10-13.test.mjs

Existing browser snapshots keep their imported values until “인트라넷 수업 불러오기” is used again.

Deployment completed successfully on 2026-10-13. Freshly downloaded deployed source matches the candidate carriedFees.js byte-for-byte; feecalcProgress.js and feecalcBilling.generated.js match their pre-deployment versions. Read-only replay against that deployed source confirms the amounts above, and all 4 new regressions pass against it.
