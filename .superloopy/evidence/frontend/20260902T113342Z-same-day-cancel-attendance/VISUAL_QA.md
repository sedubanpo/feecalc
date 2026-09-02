# Visual QA — 당일취소를 출석으로

- Surface: 내부 업무용 DOM Web
- State: 이력확인·납부/차액 옵션 활성화
- Viewport: 기본 Codex in-app browser viewport
- Browser/OS/input: Chromium / macOS / pointer
- Reference: 기존 기능별 입력 카드와 체크박스 패턴
- Actual artifacts: `history-option.png`, `payment-option.png`
- Result: pass

## Review

| Claim | Observation | Result |
| --- | --- | --- |
| 세 메뉴에서 옵션을 쉽게 찾을 수 있다 | 각 Access 입력창 바로 아래, 분석 버튼 바로 위에 배치됐다. | Pass |
| 기존 디자인 체계를 유지한다 | 이력은 emerald, AI는 indigo, 납부/차액은 fuchsia의 기존 탭 강조색을 옅은 배경으로 재사용했다. | Pass |
| 조작 영역과 설명이 잘리지 않는다 | 체크 행은 최소 40px 높이이며 제목과 설명이 두 줄로 정상 표시된다. | Pass |
| 결과 문서의 상태가 명확하다 | 이력 내역서와 달력에 `출석`이 직접 표시되고 당일취소/취소 표기는 남지 않는다. | Pass |

## Limitation

실제 운영 데이터 전체 길이와 모든 창 너비를 대상으로 한 시각 회귀는 수행하지 않았다. 변경 요소는 기존 입력 카드 폭 안에서 줄바꿈되며 기능 접근성은 유지된다.
