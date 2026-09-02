# Behavioral QA — 당일취소를 출석으로

- Target: local production-equivalent static build at `http://127.0.0.1:4173/`
- Browser: Codex in-app Chromium browser on macOS, pointer input, Korean locale
- Build owner: browser DOM (`index.html`)
- Result: pass

## Acceptance results

| Journey | Fixture | Result |
| --- | --- | --- |
| 이력확인 | 당일취소 1건 + 출석 1건, 각 62,500원 | 체크 전 내역서에 `당일취소`, 체크 후 `출석`; 달력의 `취소` 제거 및 `출석` 표시; 총액 125,000원 불변 |
| AI예측 | 당일취소 1건 + 출석 1건 | 체크 전 5행/312,500원, 체크 후 10행/625,000원; 당일취소 날짜가 확정 수업으로 포함되고 이후 같은 요일 예측에 반영 |
| 납부/차액 | 항목명에 `당일취소`가 포함된 62,500원 수업 | 체크 후 안내서만 `출석`으로 변경; 편집 입력 원문은 `당일취소` 그대로 유지; 금액 62,500원 불변 |
| 오류 회귀 | 세 메뉴 전환 및 체크 전후 렌더링 | 브라우저 콘솔 오류 0건 |
| 저장 경계 | 체크 상태 직렬화/복원 코드 | `collectCalculatorState()`의 `sameDayCancelAsAttendance`와 `applyCalculatorState()`의 세 모드 복원 경로 확인 |

## UX delta and adjacent risk

- Primary user/task: 데스크 실무자가 과금된 당일취소를 학부모 안내 기준에 맞춰 출석으로 일괄 취급한다.
- Invariant: 체크 여부와 관계없이 이력확인·납부/차액의 기존 금액은 바뀌지 않는다. AI예측은 체크할 때만 해당 건을 패턴 데이터에 포함한다.
- Adjacent regression risk: 원본 편집 데이터가 체크 토글로 덮어써지는 문제. 납부/차액은 표시 단계에서만 정규화해 원본을 보존했다.
- Recovery: 체크를 해제하면 즉시 원래 당일취소 표시와 AI 제외 규칙으로 되돌아간다.

## Limitations

- 실운영 Supabase 저장은 사용자 기록에 영향을 줄 수 있어 테스트하지 않았다. 직렬화와 복원 경로는 코드 수준에서 검증했다.
- Safari/Firefox는 프로젝트에 명시된 지원 범위가 없어 이번 좁은 변경에서 검증하지 않았다.
