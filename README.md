# FeeCalc

에스에듀 반포관 수강료 계산기 프런트엔드와 Supabase 저장 구조 파일입니다.

## 구성

- `index.html`: GitHub Pages에 올릴 계산기 프런트엔드
- `supabase/schema.sql`: 저장 기록 테이블과 정책 생성 SQL

## 배포 순서

1. Supabase 프로젝트를 엽니다.
2. SQL Editor에서 `supabase/schema.sql`을 실행합니다.
3. 같은 SQL Editor에서 접속 코드를 1회 설정합니다.

```sql
select public.set_fee_calc_access_code('원하는-기록-접속코드');
```

4. `Project Settings > API`에서 아래 값을 확인합니다.
   - Project URL
   - Publishable key
5. `index.html` 상단의 아래 값을 채웁니다.
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
6. 이 저장소를 GitHub에 push 하면 `https://sedubanpo.github.io/feecalc/`에서 사용 가능합니다.

## 저장 구조

- 테이블: `public.fee_calc_records`
- 비공개 설정: `public.fee_calc_private_settings`
- 본문: `payload jsonb`
- 기록 목록: `saved_at desc`
- 직접 테이블 접근은 막고, RPC 함수만 허용합니다.
  - `public.feecalc_save_record(...)`
  - `public.feecalc_list_records(...)`
  - `public.feecalc_get_record(...)`

## 주의

- 서버 저장 기능은 Supabase URL과 publishable key가 연결되기 전까지 동작하지 않습니다.
- 브라우저에서는 `기록 접속 코드`를 입력해야 저장/목록/불러오기가 동작합니다.
- 저장된 기록을 눌렀을 때는 같은 페이지가 새 창으로 열리며 `recordId` 쿼리로 해당 저장본을 불러옵니다.
- 현재 구조는 같은 Supabase 프로젝트를 써도 직접 테이블 접근을 막고, 접속 코드가 맞는 RPC 호출만 허용하는 방식입니다.
- 더 강한 보안이 필요하면 다음 단계에서 Supabase Auth 또는 Edge Function으로 확장할 수 있습니다.
