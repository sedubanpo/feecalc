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

- `node --test tests/auth*.mjs`: 모의 인증·세션·오류·동시 요청 검증
- `node --test ../sedu-intranet/tests/feecalc.test.mjs`: 서버 인증·권한·RPC 허용 목록 검증
- `node tests/database-access.mjs`: PGlite 로컬 PostgreSQL에서 가상 기록으로 권한·반복 적용·기록 보존 검증. 기본 모듈 경로는 `/tmp/feecalc-sql-test/node_modules/@electric-sql/pglite/dist/index.js`, 다른 설치 위치는 `PGLITE_MODULE`로 지정합니다. 이 검증은 pg_trgm 인덱스만 생략하며 운영 DB에 연결하지 않습니다.
