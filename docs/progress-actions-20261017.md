# Progress calendar actions — 2026-10-17

Implemented calculator-only date bulk deletion, direct occurrence deletion, drag/drop movement within the current month, and future weekday repetition through month end. Atomic bulk actions use the existing undo and saved draft model. Movement preserves actual/forecast classification with an explicit movedDate edit; source records remain immutable. Duplicate overlapping course times are rejected/skipped.

Unresolved price/time entries appear in the right panel. Recommendations use an earlier matching course and duration, display their source date, and require manual confirmation/input. No guessed amount is automatically charged.

Notice explanations list actual lesson count × per-occurrence amount, adjustment descriptions, and the signed actual-only balance after calculator discount and adjustments. Future estimates are excluded from this balance; missing amounts/times block a numeric balance explanation. This is a calculator reconciliation, not a claim that imported opening balances were caused by current-month lessons.

Verification: 69 unit tests pass. Five browser scenarios pass with synthetic authentication/service data. The new scenario exercises actual dragTo, repeat and delete buttons, undo, recommendations, and a known 87,500 − 100,000 = 12,500 carry case. Existing status, persistence and notice visibility scenarios remain passing. No real student records are written.
