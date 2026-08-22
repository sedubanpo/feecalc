# QA report

## Automated checks

- Inline script compilation: pass (`new Function`)
- Whitespace/error check: pass (`git diff --check`)
- Browser console: no application errors; only the pre-existing Tailwind CDN production warning

## Browser scenarios

| Scenario | Expected | Result |
| --- | --- | --- |
| Select four dates, then cutoff at day 15 | Dates 16 and 20 stop billing | Count changed 4 → 2 |
| August cutoff at day 15 | Days 16–31 globally excluded | 16 excluded days |
| Change cutoff from day 15 to day 20 | Previous cutoff exclusions are replaced | Count changed 2 → 4; 11 excluded days |
| Clear all exclusions | Selected subject dates return | Count returned 2 → 4 |
| Two adjustment rows | Itemized receipt + combined total | -325,000 + 50,000 = -275,000 |
| Menu sweep | Shared adjustment visible except payment | Pass across 9 menus; payment uses grid adjustments |
| Stored state surface | Legacy hidden total remains synchronized | -275000 |

## Visual evidence

- `qa-select-viewport.png`: selection cutoff controls and excluded-day summary
- `qa-adjustments-viewport.png`: compact labeled multi-adjustment editor
