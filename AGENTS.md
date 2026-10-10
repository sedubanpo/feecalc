# Fee calculator project preferences

## Durable user design preferences — 2026-09-30

- Do not use short, dark decorative bars on the left edge of cards, list items, sections, or selected states. This includes `border-left` accents and inset side shadows. The user has explicitly rejected this repeated design pattern. Structural calendar grid lines and keyboard focus indicators are allowed.
- Prefer hierarchy through typography, spacing, restrained whole-surface changes, and real brand assets. Avoid repeating strong blue outlines, blocks, and stripes throughout the UI.
- Tuition notices should use the academy logo as a large, subtle translucent watermark without compromising text contrast.
- Recent saved records stay visible on the left on desktop. Use each student's school emblem from account management as a subtle background with a readable school label. Missing emblems must not be replaced with invented school logos.
- Design prototypes are separate from production. Design review alone does not authorize deployment or edits to real student billing records. The user explicitly authorized implementation and operational deployment on 2026-09-30; actual student billing records and intranet source data must still remain unchanged.
- Center the translucent academy watermark in both the tuition notice and the calculation calendar workspace.
- Use blue with + for positive lesson charges/surcharges and red with − for deductions; expected payment is blue. Keep unit rates distinct from transaction amounts.
- Month-over-month subject comparison uses total lesson hours, with a user-controlled visibility toggle. Never infer a missing prior value as zero or compare different students.
- Prefer a compact, carefully spaced header over oversized branding: small logo/title on the left, purpose navigation on the right in the same desktop row. Prototype case controls belong below the header. Do not enlarge logos/headlines as a substitute for design refinement.

- Use the approved prototype’s Noto Sans KR typography with clear contrast; do not declare an unloaded font as the primary face.
- Keep account controls horizontal in the compact header, with no routine login explanation paragraphs. Preserve actual authentication errors.
- On wide notice screens, place image output and message composition beside the document on the right. Keep these tools outside the exported document.

- Notice documents may use up to 1120px width to reduce height. Place lesson variants side by side when space allows, and calendar subject/time horizontally; preserve long times and teacher/status without splitting Korean subject names.
- Use the warm brown rendition of the original academy logo; retain its exact source contour and transparency. Keep financial blue/red semantics.

## Calculator refinements — 2026-09-30

- The app header uses the calculator favicon as its logo. The exported notice and watermarks keep the original warm academy logo.
- Use the loaded Noto Sans KR weights consistently: 400/500 for body and labels, 700 for headings, amounts, and action buttons. Action buttons share the restrained navy palette and rounded geometry.
- Financial adjustment rows use one type selector with a matching SVG icon, description, signed amount, and delete action. Avoid repeating three type buttons on every row. Negative deductions are red; positive amounts display + in blue.
- Progress calendar blank areas and per-date + buttons open temporary lesson entry, with single-date or weekday repetition and a count/amount preview. Temporary lessons live in the calculation draft, are clearly marked, and support removal/undo and saved draft restoration. Never write them into intranet source lessons. Reject student/month mismatches and exclude overlapping occurrences of the same course.

## Progress next-month planning — 2026-09-30

- The next-month dialog shares the draft dialog typography, warm paper surface, restrained navy actions, and mobile sizing.
- Next-month tuition from progress lessons becomes a weekday-fixed draft. Preview and select eligible courses before advancing. Actual-only patterns require three distinct weekly occurrences with known duration/fee. As requested on 2026-10-10, calculated forecast lessons may also seed a reviewed next-month draft without that threshold; label forecast-based candidates. Exclude one-off, makeup, unresolved, and temporary lessons.
- Clicking a calendar lesson opens occurrence editing/deletion, with an amount preview and undo. Progress edits and exclusions are saved only in the calculator draft; the intranet snapshot remains unchanged.

## Financial source imports — 2026-09-30

- Desk receipts and Intranet saved monthly opening balances are read-only sources. Show a review dialog with all items initially unchecked, source month/date, signed amounts, and adjustment total preview; append only explicitly selected rows.
- Receipt imports deduct payments and add refunds. Missing or blocked amounts/identity never become zero-valued imports. Intranet imports prefer directly saved opening balances; if absent, recompute automatic carry using the Intranet monthly billing and Desk receipt model from the September 2026 settlement baseline. Do not use aggregate paid totals or cached computed closing balances. Prior unresolved charges or receipt identity errors block import.
- Preserve source IDs, student/month, fingerprint, and original amount in saved adjustment rows to prevent repeated imports. Re-read selected sources before applying; reject changed source records, login changes, and student/month changes. Keep one-step undo. Never update Desk or Intranet source records.

- Complete Desk settlement corrections (`desk_portal_adjustment`, `수강료 정정`, `PORTAL-ADJ`) are signed net-collection deltas. Import them as separately labeled, unchecked review items; include them once in Intranet net paid/carry. Other non-payment metadata stays excluded.

- Next-month recurrence counts distinct dates per weekday across clock shifts when subject, teacher, lesson type, duration and fee match. Keep separate same-day sessions and different subjects/rates apart; use the latest observed time for the reviewed draft.
