# FeeCalc

에스에듀 반포관 수강료 계산기 프런트엔드와 Supabase 저장 구조 파일입니다.

## 구성

- `index.html`: GitHub Pages에 올릴 계산기 프런트엔드
- `supabase/schema.sql`: 저장 기록 테이블과 정책 생성 SQL

## 배포 순서

1. Supabase 프로젝트를 엽니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. `Project Settings > API`에서 아래 값을 확인합니다.
   - Project URL
   - anon public key
4. `index.html` 상단의 아래 값을 채웁니다.
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. 이 저장소를 GitHub에 push 하면 `https://sedubanpo.github.io/feecalc/`에서 사용 가능합니다.

## 저장 구조

- 테이블: `public.fee_calc_records`
- 본문: `payload jsonb`
- 기록 목록: `saved_at desc`

## 주의

- 서버 저장 기능은 Supabase URL과 anon key가 연결되기 전까지 동작하지 않습니다.
- 저장된 기록을 눌렀을 때는 같은 페이지가 새 창으로 열리며 `recordId` 쿼리로 해당 저장본을 불러옵니다.
- 현재 SQL 정책은 기록 목록과 저장을 `anon`에도 열어 둡니다. 학원 내부 전용 운영이 아니라면, 다음 단계에서 접근 제한을 추가하는 것을 권장합니다.
