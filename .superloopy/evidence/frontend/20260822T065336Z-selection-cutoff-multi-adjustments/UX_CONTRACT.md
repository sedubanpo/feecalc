# UX contract

## Selection cutoff

- `과목 날짜` keeps calendar clicks scoped to the active subject.
- `전체 제외` makes calendar clicks apply to every selected subject.
- `선택일까지 계산` excludes cutoff + 1 through the last day of the month.
- Global exclusions reduce selected counts, tuition totals, and receipt calendar events together.
- `전체 제외 해제` restores all selected subject dates without deleting them.

## Multiple adjustments

- Each row has a label, signed amount, and 40px delete control.
- Negative values are carryovers; positive values are overages.
- Rows are itemized in the receipt and message; two or more rows show a combined adjustment total.
- Calculator state v6 stores `adjustmentItems`; legacy `adjustment` and `aiAdjustment` values migrate to one labeled row.
- The shared editor is used by auto, select, manual, guide, first, timetable, history, and AI. Payment keeps its existing labeled adjustment grid rows.
