# Visual QA

## Environment

- Browser: 사용자의 실제 Google Chrome 연결
- Surface: `http://localhost:4173/` 정적 production-equivalent serve
- Viewports: 390×844, 768×900, 1280×900
- Evidence: `after-390.png`, `after-768.png`, `after-1280.png`, `rate-controls-390.png`

## Functional results

| Scenario | Result |
| --- | --- |
| 요일고정 시간당 | 2026년 7월 월요일 4회 × 2시간 × 10,000원 = 80,000원 |
| 시간표 시간당 | 붙여넣은 월요일 2시간 수업 4회 × 10,000원 = 80,000원 |
| 첫등록 시간당 | 4주 기준 4회 × 3시간 × 10,000원 = 120,000원 |
| 변동형 시간당 → 회당 | 2시간 × 3회 × 10,000원 = 60,000원, 회당 전환 후 30,000원 |
| 시간표 학생명 | 입력값 `시간표테스트`와 안내서 `dispName`이 일치 |
| 캘린더 숨김 | 요일고정·첫등록·시간표·이력확인에서 수업 뱃지 0개, 제목 `7월 달력` 확인 |

## Responsive and interaction checks

| Width | Horizontal overflow | Record title | Control hit size |
| --- | --- | --- | --- |
| 390px | 없음 | 293×20px, 한 줄 | 기록 버튼·단가 select/input/preset 모두 높이 40px |
| 768px | 없음 | 한 줄 | 통과 |
| 1280px | 없음 | 한 줄 | 기록 버튼 40px 높이 |

## Anti-slop pre-flight

- [x] Visible em-dash 0개.
- [x] 기존 Noto Sans KR 브랜드 서체 유지.
- [x] AI purple/glow, beige/brass, glassmorphism 추가 없음.
- [x] 기존 색상·형태·테마 일관성 유지.
- [x] 실제 로고와 실제 앱 화면 사용, 가짜 스크린샷 없음.
- [x] 기존 한국어 업무 문구 유지, AI 상투어 추가 없음.
- [x] 모션은 명시 속성만 사용하고 reduced-motion 지원.
- [x] `transition: all` 없음.
- [x] DESIGN.md compliance 통과.
- [x] hover/active/focus와 40px 단가 입력 클릭 영역 확인.
- [x] 390/768/1280px 가로 스크롤 없음.

## Verdict

PASS. 요청한 기능과 시각 결함이 실제 Chrome surface에서 재현·수정·검증되었다.
