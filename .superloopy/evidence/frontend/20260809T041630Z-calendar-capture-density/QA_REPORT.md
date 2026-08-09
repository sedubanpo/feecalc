# QA Report

## 기능 검증

- `renderCommonReceiptCalendar()`와 `renderCalendarEventPill()`을 실제 페이지 iframe에서 호출했다.
- 익명 표본 47건 중 1:1 수업 21건 모두 작은 인라인 표지로 렌더링됐다.
- 날짜 셀의 `scrollHeight > clientHeight` 검사는 0건이었다.
- html2canvas 복제 문서에 `capture-mode`를 적용해 캡처 전용 줄높이와 아래쪽 여백을 확인했다.
- 캡처 대상 폭을 1120px로 변경한 뒤 두 번의 animation frame을 기다려 레이아웃 안정화를 확인했다.

## 정적 검증

- `git diff --check`: PASS
- 인라인 JavaScript parse check: PASS (1 script)
- `transition: all` / `transition-all`: 신규 사용 없음
- 금액 표시는 기존 tabular/monospace 정렬 체계를 유지함

## 회귀 위험

- 계산 및 저장 데이터 구조는 변경하지 않았다.
- 이력확인 전용 `historyCompact` 캘린더 렌더링은 기존 분기를 유지했다.
- 캘린더 숨김 분기는 `renderCalendarEventPill()`에 진입하지 않으므로 동작 영향이 없다.
