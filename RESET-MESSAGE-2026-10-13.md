# New calculation and discount message — 2026-10-13

Progress messages omit the calculator discount line when the discount amount is zero. Genuine imported discount evidence and nonzero calculator discounts remain visible.

The basic new-calculation flow already emptied adjustment rows and their hidden total in the reproduced cases. The reset now additionally refreshes the adjustment summary immediately and closes any active financial-source review, invalidating pending imports. This prevents an old in-flight carry import from repopulating a new draft, including when the same student and month are selected again. The existing next-month option to retain adjustments remains unchanged.

Validation: 66 unit tests pass. Six browser scenarios pass using synthetic data: new calculation from auto, progress, payment and guide modes; delayed carry import followed by reset and same-student reselection; no-discount and actual-discount messages. No browser errors. No production student records are written.

Reproduce browser checks with Playwright installed:

    node tests/reset-message.browser.cjs

Set TEST_URL to check a deployed page with the same synthetic authentication and service responses.
