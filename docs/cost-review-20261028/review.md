# 수강료 계산기 비용 조회 경로 검토

2026-10-28. 첨부 공통지침과 계산기 검토 프롬프트에 대한 결과다. 문서의 읽기 전용 원칙과 별도로 사용자는 기존 기능을 유지하는 안전한 수정과 배포를 승인했다. 이번 변경은 계산기 프런트엔드의 월별 히스토리 출력 경로에 한정한다.

## 1 조사 범위와 버전

- 계산기: `/Users/anjongseong/Documents/New project/feecalc_repo`, main, 조사 시작 `8d2424a`, origin `sedubanpo/feecalc`. 이번 변경 파일은 monthly-history.js와 tests/monthly-history/browser.cjs. 기존 미추적 디자인·검증 파일은 제외한다.
- 공용 서버: 인접 `sedu-intranet`, main `542fc32`. feecalc.js, feecalcProgress.js, index.js, firebase.json 등을 포함한 기존 미커밋 변경이 많다. 아래 서버 근거는 로컬 작업본이며 운영 버전과 동일하다고 확인하지 않았다. 서버는 수정하지 않는다.
- 호출 대상: fir-lms-prod / asia-northeast3 / feeCalculatorApi. 로컬 firebase.json의 functions codebase는 intranet. 계산기 정적 프런트엔드는 GitHub Pages `/feecalc/`다. Functions 운영 revision·Cloud Run 서비스별 청구 귀속은 확인 불가다.
- 실제 DB 조회·내보내기·운영 학생 저장 없이 코드, 격리 목 테스트, 정적 배포 파일만 확인한다. 서버 배포·설정 변경은 없다.

## 2 호출 경로와 근거

아래 경로는 모두 코드 확인이다. 서버 파일은 sedu-intranet/functions/ 기준, 프런트 파일은 feecalc_repo/ 기준이다. 실제 반환 문서 수와 청구 읽기 수는 운영 계측 없이 확정할 수 없다. 각 API는 feecalc.js:76–98에서 인증 후 users/uid와 userAppAccess/uid 문서를 읽는다. 이는 users 전체 목록 조회가 아니다.

| 우선순위 | 화면과 동작 | 파일과 함수 | 경로와 조회 규모 | 반복 조건 | 개선과 위험 |
|---|---|---|---|---|---|
| 이번 수정 | 월별 히스토리 PDF·이미지 출력 | monthly-history.js:65–88 exportPages | fresh HTTP → feeCalculatorApi → readFeeCalcMonthlyHistory → 아래 월별 자료 | 출력 전 원본 변경 감지 시 기존 load(true)가 동일 자료를 다시 요청 | 검증한 응답을 재사용하고 출력 중단. 재출력 시 다시 서버 검증. 최신 응답이 차단 상태여도 출력 금지 유지 |
| P1 공동 | 학생 선택 후 단건 메모 | feecalc.js:100–112 | feecalc_student_memos → students.limit(5001) → 서버에서 학생·중복 이름·병합 검사 → tuitionStudentMemos/이름키 문서 | 학생별 호출마다 전체 명부. 동시 요청만 프런트에서 공유 | canonical ID와 이름 유일성 색인 계약 필요. 동명이인·개명·병합 오연결 위험 |
| P1 공동 | 데스크 수납 확인과 반영 | financial-sources.js:16–32,60–85; feecalcFinancialSources.js:7–27; feecalcDesk.js:6–18 | 학생명부 + 월 수납 5쿼리 후 학생 연결. tuitionPayments는 sourceMonth와 sourceDueMonth in 쿼리 두 번, Followups·ContactLogs는 monthName in, Mappings는 month ==. 각각 limit5001 | 수업 불러오기 성공 후 자동 조회, 내역 확인은 응답 재사용, 반영 직전 별도 fresh 조회 | ID별 월 조회로 축소하려면 원본 연결 신뢰성과 월 귀속·환불·정정·동명이인 검증을 유지해야 함 |
| P2 공동 | 인트라넷 잔액 | feecalcFinancialSources.js:30–48; feecalcOpeningBalance.js:9–19 | scope + 명부 + 학생 financial 문서. 저장 시작잔액 없으면 readBalanceHistory로 기준월부터 재계산 | 자동 조회와 수동 조회 및 반영 직전. 재계산 기간별 월 자료 조회 | 요청 안 명부·자료 공유 우선. 지속 캐시는 모든 과거 정정의 무효화 계약 필요 |
| P2 공동 | 월별 히스토리 3개월 | monthly-history.js:17–29; feecalcMonthlyHistory.js:14–55 | readFeeCalcMonthlyHistory → memoReader → 명부 + balanceHistory + visible 3개월 progress/payments | 최초 진입, 조회월 변경, 강제 새로고침, 출력 전 검증. 로컬 화면 캐시 60초·최대8키 | 같은 요청의 동일 doc/query는 이미 Promise 공유. 기간은 표시3개월보다 길 수 있음; 연결 기간24개월 초과 차단 |
| P2 공동 | 진행형 수업 조회 | progress-ui.js:58–87; feecalcProgress.js:27–45; carriedFees.js:126–157 | scope·학생 점조회 → 학생월 periods/legacy/fees + drafts(student,month) limit5001, issues(student) limit1001 → 과거 단가 근거 읽기 | 명시적 불러오기·저장본 최신 조회. 선택적으로 지난달 기준도 요청 | 과거 periods/legacy 각 limit241, 학생 drafts limit1001, fees limit241를 읽고 과거월 판정. 단가 상속 근거 없이 단순 잘라내면 안 됨 |
| P3 프런트 후보 | 최근 기록·공유설정·메모 위젯 | index.html:3627–3706,4121–4235 | get_record 캐시 → 게이트웨이 → Supabase RPC. 위젯 최대12개, 설정 복원 최대10개 저장본 탐색 | 초기화와 기록 목록 갱신 등. 완료 응답 캐시 있으나 호출 경로별 비용 존재 | Firestore 학생 대량 조회와 구분. 각 HTTP의 인증 문서 읽기 및 서버 실행 비용은 남음. 동시 get_record 공유는 별도 검증 후 후보 |
| 기존 제한 | 강사 이미지 | auth-client.mjs:62–80 teacherProfiles | Firestore REST sharedIconAssets category PERSON, 필드 select 후 사용자 이미지 필터 | 프로필 로드 | 필드 제한은 전송량 감소이며 문서 읽기 건수 절감으로 계산하지 않음 |

balanceHistory.js:19–45는 학생별 fees/issues, 기준·할인과 월별 periods/legacy/drafts/session 및 월 데스크 자료를 읽는다. 계산기 경로는 persistSnapshots:false로 호출한다. 읽기 조사 중 계산기 예약 동기화·백필·트리거 재진입 경로는 발견하지 못했다. 이 결론을 공용 프로젝트 전체에 확대하지 않는다. 페이지 자동 순회·리스너 중복·포커스 폴링이 이번 핵심 경로의 원인이라는 증거도 없다.

## 3 이미 적용된 최적화와 관측 쿼리 판정

auth-client.mjs:9–26은 인증 세대·UID·정렬한 파라미터 키로 students/memos/progress/payments/opening의 진행 중 요청만 공유하고 완료 후 제거한다. 지속 TTL이 아니며 fresh는 공유를 우회한다. financial-sources.js는 학생·월·로그인 변경 시 자동 조회 응답을 폐기하고, 반영 직전 fingerprint·금액·원본 ID·중복 반영을 검사한다. 캘린더 드래그·금액 계산은 로컬이며 매 편집마다 서버 저장하지 않는다.

| 제공된 쿼리 형태 | 계산기 조사 판정 |
|---|---|
| students LIMIT5001 | 이 앱의 API 호출 경로와 공유 서버 구현 확인. 관측426회/646401읽기의 앱별 귀속은 불가 |
| students LIMIT6001 / PageSize300 | 조사한 계산기 경로에서 확인 불가 |
| lessonLogNotionPages 무제한 | 조사한 계산기 경로에서 확인 불가 |
| deskInquiryMirror 하위 items | 조사한 계산기 경로에서 확인 불가 |
| events PageSize300 | 조사한 계산기 경로에서 확인 불가 |
| studentPermissions / studentPermissionAutoReviews LIMIT6001 | 조사한 계산기 경로에서 확인 불가 |
| users / userProfiles 전체 조회 | 전체 조회는 확인 불가. users/uid 점조회와 혼동 금지 |
| tuitionPayments / tuitionFollowups / tuitionContactLogs | 월 조건의 공유 서버 호출 확인 |
| sharedIconAssets | 프런트 직접 category 조건 조회 확인 |

첨부 문서의 프로젝트 합계 Firestore 읽기93,356,022건/47,505원, 쓰기5,129,020건/7,171원 및 24시간 통계는 사용자 제공 근거다. 독립 운영 로그 확인이나 앱별 비용 배분을 하지 않았다. LIMIT는 최대값이며 실행횟수×LIMIT를 읽기량으로 계산하지 않는다.

## 4 개선안 비교

| 방안 | 권한과 범위 | 기대 효과 | 추가 비용과 최신성 위험 | 검증 및 롤백 |
|---|---|---|---|---|
| 변경 감지 응답 재사용 | 계산기 단독, 이번 적용 | 해당 분기 HTTP 2회→1회, 서버 재계산1회 제거 | 새 쓰기·캐시 서비스 없음. 변경 시 출력 중단 유지 | 목 요청수·출력차단·재출력 검증. 프런트 커밋 revert |
| memoReader를 독립 잔액·진행 RPC에도 적용 | 공용 서버 담당 합의 | 같은 요청 안 동일 조회만 공유, CPU 중복 일부 감소 가능 | 요청 메모리 증가. 쿼리별 실제 중복 먼저 계수 | 권한·원본 fingerprint·오류 전파 동일성, 함수 단위 롤백 |
| canonical ID·정규화 이름 유일성 색인 | 계정 관리·데스크·서버 공동 | 단건 메모에 전체 명부 불필요 | 생성·개명·병합 시 추가 쓰기/저장, 백필 일회성 읽기. 정합성 실패 위험 | 동일 이름·개명·병합·삭제·레거시 키 검증, 전환 전 검토 |
| 학생월 수납 색인 | 데스크·서버 공동 | 월 전체 수납 대신 대상 학생 조회 | ID 불확실·중복 월 귀속·환불 정정 누락 위험, 색인 유지 쓰기 | 원본ID별 결과 대조, 미확인 차단 유지 |
| version 기반 캐시 | 공동, 지금 미적용 | 반복 요청의 DB·계산량 감소 가능 | 모든 수납/수업/단가/할인/병합/과거 잔액 정정이 버전 갱신해야 함. 추가 읽기·쓰기·저장·서버 비용 | revision 변경·실패·권한철회 테스트, fresh 우회 유지 |

## 5 우선순위

1. 이번 프런트의 변경 감지 중복 조회 제거. 영향 범위가 작고 격리 검증 가능하다.
2. 공용 서버의 요청 내부 동일 자료 공유를 계수하고 확대 여부 결정. 월별 히스토리의 기존 memoReader는 보존한다.
3. 메모와 월 수납의 canonical ID 연결 계약을 먼저 확정한 뒤 전체 명부·월 전체 자료 조회를 줄인다. 측정 전 절감률은 확정하지 않는다.

## 6 담당별 계약과 승인 선행 조건

- 계정 관리: 학생 ID의 영속성, 이름 정규화 규칙, 동명이인 canonical 개수, mergedInto 체인·순환·삭제 처리, 생성·개명·병합 시 원자적 색인 갱신 책임을 확정한다.
- 데스크: tuitionStudentMemos 이름키 원본의 개명·병합 이관, 동일 이름 메모 귀속, 학생 ID 미확정 수납의 보류, sourceMonth/sourceDueMonth 중복 및 정정·환불 규칙을 확인한다.
- 공용 서버: canonicalStudentId, identityRevision, sourceRevision, fingerprint, 미확인·권한 오류 계약과 호환 응답을 정한다. 캐시 키에는 권한 주체·학생·월·모델 버전을 포함하고 fresh 검증은 우회 불가로 둔다.
- 승인 선행 조건: 실제 운영 revision 확인, 모든 원본 갱신 경로 목록, 누락 없는 무효화 소유자, 레거시 호환 및 rollback, 목/에뮬레이터 대조 결과. 담당 간 계약이 확정되기 전 shared index.js·서버·원본 데이터는 변경하지 않는다. 이번 프런트 배포 승인은 서버 변경 승인이 아니다.

## 7 검증 계획과 결과

동일 업무 시나리오로 최초 학생 선택→수업 조회→캘린더 수정→수납 확인→반영→히스토리→출력을 비교한다. HTTP 요청, SDK get, 반환 문서, 청구 읽기, 서버시간을 별도 기록한다. 목 테스트는 HTTP 수를 확인하며 실제 Firestore 청구량을 측정하지 않는다.

이번 변경의 회귀 조건: 변경된 원본은 1회 응답으로 화면 갱신, 출력 파일0개, 이전 미리보기 제거, 선택한 표시월 유지, 사용자 재출력 시 추가1회 최신 조회. 인증·학생·월 변경 지연 응답 폐기와 미확인·네트워크 오류 출력 금지도 검사한다. 전체 단위·화면 테스트 결과와 배포 확인은 release.md에 기록한다.

공동 변경 전후에는 동일 학생 수·조회 월 수·업무 흐름을 맞춘 최소24시간 비교가 필요하다. 운영 전체조회나 부하 테스트를 새로 수행하지 않고 기존 지표를 이용한다. 수강료 합계·시간표·출결·상담 최신성, 자료 누락, 동명이인·권한 오류를 대조한다. 청구 반영 지연과 credits를 분리하고 트래픽 차이를 보정한다.

## 8 사용자 결정 사항

이번 안전한 프런트 수정은 승인 범위에서 진행한다. 공용 서버 API 통합, 영속 캐시, 학생·수납 색인 도입은 담당 계약과 측정 후 별도 승인이 필요하다. 원본 확인 후 반영 UX와 확정 직전 최신 조회는 유지한다.

## 9 완료 범위와 한계

조사 경로는 계산기 루트 JS/HTML와 공용 서버 feecalc 계열, balanceHistory, carriedFees다. 운영 Functions 소스 revision, 실행 주체별 로그, Supabase 운영 SQL, 계정 관리와 데스크의 모든 갱신 경로는 이번 조사에서 검증하지 않았다. 기존 서버 작업본을 운영 배포 코드로 단정하지 않는다. 프런트 배포 산출물 동일성과 격리 테스트 결과는 별도 release.md에 남긴다.
