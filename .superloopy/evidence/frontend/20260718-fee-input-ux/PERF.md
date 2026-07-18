# Performance and compliance

## Design-system compliance

- Result: PASS
- Base spacing: 4px
- Declared colors: 95
- Undeclared colors: 0
- Off-scale spacing: 0
- Artifact: `ds-compliance.json`

## Runtime smoke check

- Inline JavaScript parse: PASS
- Static feature assertions: PASS
- `git diff --check`: PASS
- 실제 Chrome 콘솔에서 페이지 소스 오류 없음. 관찰된 오류는 Chrome 확장 자체의 `tabs:outgoing.message.ready` 메시지뿐이며 페이지 URL에서 발생한 오류는 아니다.

## Lighthouse

실제 배포 URL `https://sedubanpo.github.io/feecalc/`을 대상으로 모바일·데스크톱 각각 3회 측정하고 중앙값을 사용했다.

| Profile | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Mobile median | 63 | 100 | 100 | 100 |
| Desktop median | 88 | 100 | 100 | 100 |

- Mobile runs: performance 63 / 64 / 62, 나머지 세 범주는 모두 100.
- Desktop runs: performance 85 / 88 / 88, 나머지 세 범주는 모두 100.
- 접근성 개선 전 배포본은 74점이었으며, 랜드마크·폼 이름·이미지 대체문구/크기·제목 순서·색 대비를 바로잡아 100점으로 개선했다.
- 모바일 성능의 주요 잔여 비용은 기존 Tailwind CDN 런타임, Supabase/html2canvas 외부 스크립트, 외부 폰트·이미지의 렌더 차단 및 캐시 정책이다. 이를 제거하려면 단일 HTML 배포를 정적 빌드 파이프라인으로 바꾸는 별도 범위가 필요하므로 이번 정확성·입력 안정성 작업에서는 유지했다.
- Artifacts: `lighthouse-mobile-1.json` ~ `lighthouse-mobile-3.json`, `lighthouse-desktop-1.json` ~ `lighthouse-desktop-3.json`.
