# FeeCalc

에스에듀 반포관 수강료 계산기입니다. 계산·안내서·이미지 및 파일 내보내기는 브라우저에서 동작하고, 서버 기록은 기존 직원 계정으로 로그인한 후 사용합니다.

## 인증과 권한

- Firebase 프로젝트: `fir-lms-prod`
- 직원 인증: 기존 이메일 또는 전화번호 아이디, 비밀번호
- 서버 권한: `users/{uid}.status === ACTIVE`, 역할 `ADMIN`·`MANAGER`·`STAFF`, `userAppAccess/{uid}.apps.deskPortal === true`
- 매 요청마다 토큰 만료·폐기와 현재 직원 권한을 확인합니다.
- 새 직원 계정이나 학생 계정을 생성하지 않습니다.
- 공유 접속 코드와 공개 페이지 값을 사용한 기록 접근은 폐기했습니다. Git 과거 버전에 남은 코드는 권한이 아닙니다.

## 연결 구조

`auth-client.mjs` → Firebase `feeCalculatorApi` → Supabase 계산기 RPC

서버 구현은 `../sedu-intranet/functions/feecalc.js`와 `feecalcFirebase.js`에 있습니다. Firebase Secret Manager의 `FEECALC_SUPABASE_SERVICE_ROLE_KEY`를 서버에서만 사용합니다. 서버 키를 HTML, 브라우저 저장소, URL, Git 또는 검증 로그에 넣지 않습니다.

Supabase의 `fee_calc_records`와 `fee_calc_private_settings`는 RLS를 유지하고, 공개·일반 인증 역할의 직접 접근과 계산기 RPC 실행을 금지합니다. `service_role`만 기존 8개 RPC를 실행합니다. 이 프로젝트의 다른 서비스 테이블과 정책은 변경하지 않습니다.

## 기존 운영 시스템 반영 순서

1. `../sedu-intranet`에서 서버용 Secret Manager 값을 준비하고 `functions:intranet:feeCalculatorApi`만 배포합니다.
2. `index.html`과 `auth-client.mjs`를 GitHub Pages에 반영합니다.
3. Supabase SQL Editor에서 `supabase/secure_gateway.sql`을 실행합니다. 기록 삭제·변환 없이 함수 실행 권한과 인증 검사를 바꾸며 반복 실행 가능합니다.
4. `supabase/verify_gateway.sql`로 공개·일반 인증 역할의 실행 권한이 모두 false인지 확인합니다.
5. 직원 로그인·기록 열기와 비로그인 요청의 거부를 확인합니다. 구버전 탭에는 새로고침이 필요합니다.

신규 DB에는 `supabase/schema.sql`을 사용합니다. `search_records_patch.sql`도 서버 전용 권한을 유지합니다. 인증 문제를 임시로 해결하기 위해 공개 역할 권한이나 공유 코드를 복구하지 않습니다.

## 향후 데이터 이관

기존 이관 결과를 중복 수집하지 않습니다. 추가 이관은 관리자 인증 경로 또는 관리자가 제공한 내보내기 파일을 사용하고 대상 월·학생 범위와 건수를 먼저 정합니다. 소스 페이지에서 접근 코드나 키를 추출해 비공개 기록을 수집하는 방식은 사용하지 않습니다. 운영 데이터 자체를 테스트 로그·스크린샷·공개 저장소에 담지 않습니다.

## 검증

## UI / 학생 연결 (2026-09-07)

`fee-ui.js`는 기존 계산 엔진의 입력·저장 연결을 확장하며 `fee-ui.css`는 요청된 단가·조정·문서 헤더 변경을 담당합니다. 배포 시 두 파일도 함께 올립니다.

- 직원 인증 게이트웨이의 `feecalc_students`는 계정 관리의 `students` 명부에서 ID·이름·학교·학년만 반환합니다. 동명이인은 후보를 선택하고 임시 이름은 서버 저장할 수 없습니다. 서버도 매 저장마다 ID/이름을 검증합니다.
- `feecalc_student_memos`는 데스크 포털의 `tuitionStudentMemos`를 읽기 전용으로 조회합니다. 이름 기반 메모 원본이 동명이인에게 모호하면 조회를 거부합니다. 메모는 안내 이미지에 포함하지 않습니다. 기존 계산기 메모 원본은 보존하지만 작성 UI는 제거합니다.
- 공통 설정 `rateLibrary`는 `{type, unit, amount}` 배열입니다. 유형 없는 예전 단가는 `기타 / 회당`으로 보존합니다. 단가 저장은 명시적 버튼을 통해 하며 학생 기록 저장의 부수효과로 갱신하지 않습니다.
- 예전 서버 기록은 읽을 수 있습니다. 저장 시 현재 명부와 연결되며 `studentId`가 추가됩니다. JSON 저장/불러오기 UI는 제거했습니다.
- 이월·초과금 행의 `kind`는 `carry / extra / other`; 이전 행은 `other`로 읽어 기존 텍스트와 부호를 보존합니다.

`node tests/fee-ui.cjs`는 Playwright와 설치된 Chrome을 사용합니다. 모든 학생·메모·저장 API를 가상 응답으로 대체하며 운영 데이터를 쓰지 않습니다.

- `node --test tests/auth*.mjs`: 모의 인증·세션·오류·동시 요청 검증
- `node --test ../sedu-intranet/tests/feecalc.test.mjs`: 서버 인증·권한·RPC 허용 목록 검증
- `node tests/database-access.mjs`: PGlite 로컬 PostgreSQL에서 가상 기록으로 권한·반복 적용·기록 보존 검증. 기본 모듈 경로는 `/tmp/feecalc-sql-test/node_modules/@electric-sql/pglite/dist/index.js`, 다른 설치 위치는 `PGLITE_MODULE`로 지정합니다. 이 검증은 pg_trgm 인덱스만 생략하며 운영 DB에 연결하지 않습니다.
