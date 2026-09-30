---
name: 에스에듀 반포관 수강료 계산기
description: 넓은 직원용 월간 달력과 과목·강사별 수강료 안내서
colors:
  primary: "#175a8c"
  charge: "#095eb8"
  deduction: "#bd3340"
  paper: "#fffefa"
  canvas: "#f2f3f1"
  ink: "#18314b"
  muted: "#526777"
  border: "#dce3e2"
  control-border: "#d2dcdf"
  record-surface: "#fff"
  record-dock: "#eaf0ed"
  selected-surface: "#eaf0f4"
  selected-ink: "#204c73"
  math-fill: "#d9e8ff"
  korean-fill: "#daf4e4"
  english-fill: "#fde3e3"
  science-fill: "#ece4ff"
  social-fill: "#faefc9"
typography:
  title:
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.6px"
  headline:
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "21px"
    fontWeight: 700
    letterSpacing: "-0.4px"
  body:
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
  label:
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
  navigation:
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 700
  notice-detail:
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
  total:
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "20px"
    lineHeight: 1.3
rounded:
  control: "7px"
  field: "6px"
  record: "8px"
  lesson: "4px"
  notice-lesson: "3px"
spacing:
  step-1: "4px"
  step-2: "8px"
  step-3: "12px"
  step-4: "16px"
  workspace-gap: "18px"
  paper-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#fff"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  button-secondary:
    backgroundColor: "{colors.record-surface}"
    textColor: "#385567"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  input:
    backgroundColor: "{colors.record-surface}"
    rounded: "{rounded.field}"
    padding: "8px"
  navigation:
    textColor: "{colors.muted}"
    typography: "{typography.navigation}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  navigation-selected:
    backgroundColor: "{colors.selected-surface}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.control}"
  record-card:
    backgroundColor: "{colors.record-surface}"
    rounded: "{rounded.record}"
    padding: "16px 13px"
  lesson:
    rounded: "{rounded.lesson}"
    padding: "7px 6px"
  notice:
    backgroundColor: "{colors.paper}"
    padding: "24px"
---

# Design System: 에스에듀 반포관 수강료 계산기

## Overview

**Creative North Star: "고밀도 업무 문서의 신뢰감"**

고밀도 업무 문서의 신뢰감. 작은 브랜드 서명과 낮은 목적 메뉴 아래에서 직원이 월 전체 수업을 읽고, 날짜별 예외를 조정한다. 밝은 회색 작업 바탕과 따뜻한 종이 표면, 절제된 청색 작업 버튼을 사용하며 정보의 계층은 글자·여백·구분선으로 만든다.

직원 작업 화면은 화면 너비를 활용하고 학부모 안내서는 별도의 문서 폭으로 정리한다. 등록된 학원 로고와 학교 엠블럼, 실제 과목 아이콘을 사용한다. 좌측 장식 띠를 반복하거나 로고·제목을 크게 키우는 표현은 사용자가 명시적으로 거부했다.

**Key Characteristics:**

- 낮은 헤더 왼쪽에 브랜드, 오른쪽에 목적 메뉴를 둔다.
- 최근 저장 기록은 데스크톱 왼쪽에 유지하고 학교명과 등록 엠블럼으로 식별한다.
- 달력에는 같은 날의 독립 수업을 모두 표시하고 선택 조건과 날짜 선택을 구분한다.
- 안내서는 과목·강사별 산출 근거와 전체 월간 달력, 부호 있는 금액을 함께 보여 준다.
- 인트라넷 원본·실제 수업·예상 수업·미확인 금액의 의미를 보존한다.

이 문서는 승인된 revision 7의 운영 구현을 기록한다. 토큰과 치수는 `calendar-workspace.css`의 최종 선언이 기준이며, `calendar-workspace.js`, `calendar-core.js`, `index.html`, `AGENTS.md`, `DESIGN-HANDOFF-2026-09-30.md`의 기능·자산 규칙을 함께 확인했다. 기존 `PRODUCT.md`의 직원 업무·한국어·등록 로고·읽기 전용 원본 원칙을 유지한다. 프로토타입의 초기 큰 헤더, 안내서 금액열 268px, 구형 1120px 저장 폭은 현행 기준이 아니다.

실제 시각 확인 근거는 `.impeccable/review/20260930-production/`의 [desktop.png](.impeccable/review/20260930-production/desktop.png), [mobile.png](.impeccable/review/20260930-production/mobile.png), [user-work.png](.impeccable/review/20260930-production/user-work.png), [history-notice.png](.impeccable/review/20260930-production/history-notice.png), [export.png](.impeccable/review/20260930-production/export.png)다. 합성 계정·익명 사례의 브라우저 화면과 고밀도 PNG를 확인한 범위이며 실제 학부모 스마트폰·메신저 수신 시인성은 미검증이다. 리뷰 완료와 운영 배포 확인은 별도 근거를 따른다.

## Colors

따뜻한 종이색과 청회색 글자 위에 작은 작업 청색, 부호 있는 거래색, 연한 과목 표면을 배치한다. frontmatter가 현행 색값의 기준이다.

### Primary

- **업무 청색 (`primary`)**: 적용·이미지 저장·조회 버튼, 키보드 포커스, 체크 조작에 사용한다. 앱의 작업 청색이며 구형 화면의 `--color-primary`와 구별한다.
- **청구 청색 (`charge`)**: 양수 거래와 예상 납부액에 사용한다.

### Secondary

- **차감 적색 (`deduction`)**: 음수 거래와 전체 휴강 표기에 사용한다. 과목 영어색과 혼동하지 않는다.

### Neutral

- **따뜻한 종이 (`paper`) / 작업 바탕 (`canvas`)**: 안내서·달력 표면과 직원 작업 공간을 나눈다.
- **청회색 먹색 (`ink`) / 보조 글자 (`muted`)**: 본문, 출처·시수·학교명·도움말 계층이다.
- **얕은 구조선 (`border`) / 입력 경계 (`control-border`)**: 행·달력·입력 구조를 구분한다.
- **기록 종이 (`record-surface`) / 기록 바탕 (`record-dock`)**: 최근 기록을 작업 영역에서 구별한다.
- **선택 표면 (`selected-surface`) / 선택 글자 (`selected-ink`)**: 목적 메뉴의 활성 상태를 전체 표면과 굵기로 표현한다.

### Subject surfaces

수학·국어·영어·과학·사회는 각각 `math-fill`, `korean-fill`, `english-fill`, `science-fill`, `social-fill`을 사용한다. 직원 달력의 글자는 수학 `#355c9a`, 국어 `#256544`, 영어 `#8b3e4a`, 과학 `#6d58a8`, 사회 `#765426`이다. 과목명과 아이콘을 함께 표시하므로 색만으로 식별하지 않는다. 기존 설정·단가·모드별 출결 표지는 `index.html`의 의미색을 보존한다.

**The Signed Amount Rule.** 청구 수업액·초과금은 +와 청색, 이월·할인·기납부 등 차감액은 −와 적색으로 표시한다. 예상 납부액은 청색이며 단가는 부호 없는 단위 정보로 남긴다.

## Typography

**Display / Body Font:** Noto Sans KR. 승인 시안과 같은 글꼴을 전체 셸과 안내서에서 사용하며 index.html의 기존 웹폰트 로딩을 재사용한다. 플랫폼 기본 산세리프는 로딩 실패 시 대체 글꼴이다.

브랜드는 작은 서명처럼, 작업 제목은 업무 이름처럼 읽힌다. 본문은 좁은 조건열과 달력에서도 짧은 한국어 레이블을 유지한다.

### Hierarchy

- **Title**: 헤더 제품명은 frontmatter의 title 역할. 학원명은 그 위의 작은 보조 줄(10px, 자간 .5px)이다.
- **Headline**: 작업·안내서 제목은 headline 역할. 모바일 작업 제목은 (18px), 안내서 제목은 (19px)이다.
- **Body / Label**: 직원 기본 본문은 body, 입력·출처·도움말은 label 역할이다. 날짜 상세 제목은 (14px, 700)이다.
- **Notice detail**: 안내서 내역은 notice-detail 역할, 과목 제목은 (12px, 700), 강사·유형·단가는 (11px)이다. 모바일 내역 셀은 (12px), 과목 제목은 (13px)로 바뀐다.
- **Calendar detail**: 직원 수업 하위 줄은 (11px), 모바일은 (9px). 안내서 수업 제목은 (11px), 하위 시간·출결 줄은 (10px, 줄높이 1.45)이다. 출력 시 수업 줄높이는 (1.6)과 아래 여백(1px)을 적용한다.
- **Total**: 예상 납부액은 total 역할을 사용하며 줄바꿈하지 않는다. 금액 입력·소계·할인·조정·합계는 `tabular-nums`, 안내서 금액은 오른쪽 정렬을 유지한다.

## Layout

### 직원 작업 화면

직원 화면은 최대 폭 제한 없이 전체 너비를 사용한다. 데스크톱 헤더는 최소 높이(72px), 안쪽 여백(12px 24px), 영역 간격(22px)이다. 왼쪽 로고는 (38px), 제품명은 title 역할, 오른쪽 목적 메뉴와 직원 계정은 한 줄로 정렬한다. 로그인 폼은 이메일·휴대전화, 비밀번호, 로그인 버튼의 가로 배열이며 로그인 후에는 직원명·로그아웃을 표시한다. 로그인 설명 문구는 제거하고 실제 인증 오류만 상태 영역에 표시한다. 프로토타입의 사례 선택·초기화 도구는 운영 헤더에 넣지 않는다.

기본 열은 최근 기록(230px) / 수업 조건(330px) / 가변 월간 달력이다. 기록 도크는 상단(0)에 sticky, 최대 높이는 `calc(100vh - 72px)`로 내부 스크롤한다. 조건열은 안쪽 여백(18px), 달력 영역은 (22px 24px)이다. 달력과 날짜 상세는 가변 폭 / (220px), 간격(18px)으로 나란히 배치한다.

월간 달력은 `repeat(7, minmax(0,1fr))`이며 기본 날짜 셀 최소 높이(116px)이다. 수업이 많으면 주 행이 내용에 맞춰 자란다. 날짜 제목은 당일 내역을 열고 체크 상자는 다중 날짜를 선택한다. 일괄 적용 도구는 수업 조건 / 시수(85px) / 단가(115px), 간격(12px)이며 아래에 변경 건수·시간·금액 차이와 실행 버튼을 둔다.

### 반응형

| 화면 기준 | 현행 동작 |
| --- | --- |
| 1900px 이상 | 기록 230px / 조건 340px, 날짜 상세 260px, 날짜 최소 높이 135px |
| 1350px 이하 | 기록 210px / 조건 300px, 날짜 상세는 달력 아래, 날짜 최소 높이 112px |
| 1050px 이하 | 기록 190px, 조건과 달력은 오른쪽 영역에서 위아래 배치, 조건은 최대 높이 470px로 스크롤 |
| 760px 이하 | 전체 세로 배치, 목적 메뉴는 둘째 줄 가로 스크롤, 기록은 상단 200px 카드 가로 목록, 조건은 최대 높이 560px, 달력 날짜 최소 높이 100px |

모바일 헤더 로고는 (34px), 제목은 (19px)이다. 글자를 계속 축소해 메뉴를 한 줄에 강제하지 않는다. 모바일 기록과 메뉴의 의도된 가로 스크롤을 페이지 전체의 가로 넘침과 구별한다.

### 학부모 안내서·출력

안내서 작업 영역은 기록 오른쪽 두 열을 사용하고 문서는 최대 폭(1120px), 내부 여백(24px)으로 제한하고 기록 오른쪽부터 정렬한다. 이미지 출력·안내 문자 도구는 문서 오른쪽의 별도 열(260–320px)에 간격(28px)으로 배치한다. 1350px 이하에서는 도구가 문서 아래로 이동한다. 금액·근거 영역(최대 420px)과 전체 월간 달력은 간격(18px)으로 나란히 놓는다. 이 금액열은 최종 CSS 값이며 이전 인계안의 268px보다 우선한다.

세로 배치 옵션과 모바일(760px 이하)에서는 금액 요약 아래 전체 달력이 이어진다. 기본 안내서 달력 셀 최소 높이는 (62px), 세로 옵션은 (88px), 모바일은 최종 미디어 규칙에 따라 (62px)이다. 모바일 문서 여백은 (18px 12px)이다. 같은 날의 모든 표시 수업을 담아 자연스럽게 길어지고 `+N`으로 숨기지 않는다. 사용자가 기존 ‘캘린더 숨김’을 켜면 상세 수업 표시를 생략하는 기존 옵션 의미를 유지한다.

PNG 생성은 CSS 기준 폭(1120px), 배율(2), 렌더 viewport(1440px)를 사용한다. 캡처 시 병렬 배치는 (420px + 가변폭), 세로 옵션·시간표는 한 열로 고정한다. 화면에서 선택한 모바일 폭을 그대로 출력 폭으로 쓰지 않는다. 고밀도 출력은 세로로 길어질 수 있으며 현재 자동 분할 출력은 문서화하지 않는다.

## Elevation & Depth

계산·조건·기록 영역은 그림자보다 전체 표면색과 가는 구조선으로 나뉜다. 기록 카드와 조건 목록에 그림자를 반복하지 않는다. 안내서 종이에만 약한 주변 그림자(`0 8px 24px -15px #66737530`)를 둔다. 달력의 구조선과 키보드 포커스는 허용하며 선택 상태를 왼쪽 장식선으로 바꾸지 않는다.

학원 워터마크는 계산 달력과 안내서 각각의 중심(50% / 50%, `translate(-50%,-50%)`)에 배치한다. 계산 워터마크 폭은 (55%), 안내서 폭은 (70%)·최대 높이(70%), 불투명도는 둘 다 (.045)다. 장식 이미지는 `pointer-events:none`, 빈 alt와 `aria-hidden`을 사용해 읽기와 조작을 방해하지 않는다. 학교 엠블럼은 기록 카드 오른쪽 아래(140px, 불투명도 .065)에 놓고 읽을 수 있는 학교명은 별도로 남긴다.

## Shapes

버튼은 control, 일괄 입력은 field, 기록 카드는 record, 직원 수업은 lesson, 안내서 수업은 notice-lesson 반경을 사용한다. 조건 목록은 개별 카드 대신 가는 아래 구분선으로 연결한다. 안내서는 모서리가 각진 한 장의 종이이며 굵은 상단 띠를 제거했다. 달력은 반경 없는 구조 격자이고 수업 항목만 작게 둥글다. 기존 모드·설정 내부의 형태는 각 기능의 기존 규칙을 유지한다.

## Components

### Buttons and fields

작업·출력 주 버튼은 primary, 보조 버튼은 record-surface, 구조선은 control-border를 사용한다. 일반 작업 버튼 최소 높이는 (38px), 날짜 제목은 (28px), 날짜 상세 작업은 (34px), 기록 조작은 (36px)이다. 구형 문서의 일괄 40px 설명으로 실제 치수를 덮어쓰지 않는다. 일괄 입력·선택은 최소 높이(38px), 안쪽 여백(8px)이다. 학생·월·단가·시수 입력은 레이블과 단위 의미를 유지한다.

새 셸의 버튼은 배경·글자에 (.15s, ease) 전환을 사용한다. 일반 hover는 옅은 회색 표면(`#edf2f4`), 주 버튼은 더 구체적인 청색 선언이 유지된다. 키보드 포커스는 primary 외곽선(2px)과 간격(2px), disabled는 불투명도(.5)·금지 커서다. 눌림의 `scale(.96)`은 `index.html`에서 상속한다. reduced-motion에서는 전환을 제거한다.

### Navigation and condition list

목적 메뉴는 수강료 계산 / 진행·정산 / 수업 이력 / 안내서 / 시간표 / 설정이다. 선형 SVG(17px, stroke 1.75)와 레이블을 함께 사용하고 선택은 `aria-pressed`, 옅은 전체 표면·700 굵기로 표시한다. 목적 메뉴 아래 기존 계산 방식 버튼은 현재 업무에 맞는 항목만 보여 주며 `aria-current`로 상태를 알린다. 조건 제목은 최소 높이(48px), 과목 아이콘·반명과 시수·단가 보조 줄을 사용한다. 펼침 여부는 `aria-expanded`로 전달한다.

### Recent records and real assets

기록은 데스크톱 계산·안내서 전환 동안 왼쪽에 남는다. 카드 안에는 학생·월·계산 방식·금액·저장 시각과 읽을 수 있는 학교명을 둔다. 학생명(18px)과 금액(21px)을 강조하고 카드 전체를 여는 버튼으로 사용한다. 삭제 버튼은 별도 동작이며 기존 이벤트를 보존한다. 새 기록·덮어쓰기·새로고침은 작은 가로 도구로 정리한다. 학생 ID를 우선하고 유일한 이름 매칭만 대체로 사용한다. 카드 모서리는 (8px)이며 내용 버튼 여백은 (16px 13px)이다. 학교 연결이 불확실하거나 등록 엠블럼이 없으면 임의 로고를 만들지 않는다. 로딩 실패는 장식 이미지만 숨기고 텍스트를 유지한다. 선택 카드에는 전체 외곽선(1px)을 사용한다.

등록된 실제 과목 아이콘 5개를 로컬 PNG로 포함하고 원본 주소는 assets/subjects/sources.json에 기록한다. 외부 이미지의 CORS 실패 때문에 아이콘이 사라지는 문제를 방지한다. 아이콘은 직원 화면(13px)과 안내서 달력(9px)에서 과목명 앞에 놓는다. 사탐·사회계열은 사회 자산, 물리·화학·생명·지학은 과학 자산으로 매핑한다. 이미지 실패 시 과목명은 남긴다. 목적 메뉴 SVG와 과목의 등록 이미지 자산을 서로 대체하지 않는다.

### Independent calendar lessons

날짜의 모든 수업을 과목·강사 / 시수 또는 시간 구간·출결 / 부호 있는 금액으로 표시한다. 날짜 제목은 상세, 체크 상자는 날짜 선택, 수업 클릭은 수업 조건 선택이다. 선택 조건은 항목 전체 외곽선(1px), 선택 날짜는 옅은 셀 표면으로 구별한다. 적용·선택 수업 제외·전체 휴강의 변경량을 실행 전에 한 줄로 표시한다. 같은 조건의 별도 회차 추가·회차별 수정·제외와 최대 25회 실행 취소를 제공한다. 날짜별 편집은 요일고정·선택형에서 제공하며 기존 다른 모드의 계산 엔진은 유지한다.

**The Independent Lesson Rule.** 같은 날짜·과목이라도 강사·시수·시간 구간·출결·회차가 다르면 독립 수업으로 남긴다. 과목 필터는 표시만 바꾸며 전체 합계는 바꾸지 않는다.

### Read-only intranet candidates

조회 중·실패·원본 건수·후보 건수를 `role="status"`로 알린다. 전월 후보에는 과목·강사·요일·시수·금액, 근거 날짜, 확인 사유를 함께 표시한다. 보충·결석·일회성 등은 자동 적용 후보에서 제외하고 ‘별도 시간표·학생별 변경 안내와 대조’ 확인 및 후보 선택 후 적용 버튼을 활성화한다. 미확인 금액 후보는 선택하지 못한다. 같은 후보의 반복 적용은 중복 수업을 만들지 않는다. 원본 조회를 확정 청구 변경으로 표현하지 않는다.

**The Context Rule.** 학생·월이 바뀌면 연결 자료를 다시 확인한다. 전월 자료는 같은 학생의 바로 전월로 한정하고, 누락을 0으로 간주하지 않는다. 인트라넷 원본은 읽기 전용이며 미확인 단가·금액은 확인 필요로 표시한다.

### Grouped receipt and image output

요일고정·선택형·이력확인·진행형·첫등록 안내서는 과목·강사별 한 행 안에서 유형·시수·단가·상태가 다른 산식을 나열한다. 열은 과목·강사 / 수업 내역 / 금액이며 이력 집계 단위는 ‘건’이다. 정규 개별 수업의 표시 유형은 승인 시안의 ‘개별’로 줄이고, 저장·단가용 정규 유형 값은 그대로 보존한다. 안내서 시간 구간은 기존 축약 시간 표시 함수를 사용해 분 정보를 유지하며 압축한다. 월간 달력은 과목·강사와 시간·출결을 남기고 매 회차 금액 반복과 편집 선택 외곽선을 생략한다. 예상 수업은 점선 외곽선으로 표시한다. 실제·예상·결석 의미와 확정 원본 금액은 보존하며 내부 메모·원본 대조용 편집 정보는 학부모 안내서에 넣지 않는다. 납부/차액·안내형 등은 기존 산출 표를 유지한다.

이미지 저장·복사·생성 이미지 열기와 안내 문자 생성은 문서 우측 도구 영역에 놓고 생성 상태를 표시한다. 이 도구와 로그인 영역은 출력 이미지에 포함하지 않는다. 폰트 준비와 이미지 load/error를 기다린 후 렌더하며, 생성 중 계산이 바뀌면 재출력을 안내한다. 복사 실패는 파일 저장으로 전환하고 다운로드 제한 시 생성 이미지 열기를 제공한다. 실패해도 입력은 유지한다. 금액 미확인과 학생·월 불일치는 저장·출력 전에 확인하도록 표시한다.

### Optional previous-month hours

전월 대비 시수는 기본 꺼짐이며 사용자 체크 상자로 켠다. 같은 학생의 바로 전월 인트라넷 실제 시수와 현재 계산 수업 또는 실제 이력을 비교한다. 결석예고는 전월 합산에서 제외하고 원본 분할 수업은 시간을 합산한다. 과목별 전월 → 이번 달 시간과 부호 있는 퍼센트(소수 1자리)를 표시한다. 전월 0·현재 양수는 ‘신규’, 둘 다 0은 ‘변동 없음’, 미확인·누락은 ‘비교 자료 없음’이다. 전월에만 있는 과목은 현재 0·−100%로 표시한다. 자료 없는 월 조회는 0시간으로 간주하지 않는다. 비교 출처와 실제/계산 구분을 함께 표시하며 이 옵션은 금액 계산을 바꾸지 않는다.

### Independent timetable and legacy modes

시간표는 준비된 계산 수업을 별도 배치로 가져와 날짜·시작 시각·제외를 조정한다. 원본 수강료와 인트라넷 기록을 수정하지 않는다. 출력은 전체 달력 한 열이며 수강료 금액 표를 숨긴다. 기존 시간표 입력과 구형 저장본은 호환 어댑터로 유지한다. AI예측의 신규 진입·계산은 제거했으며 과거 AI 저장본은 저장 당시 안내서 열람만 제공하고 재계산·덮어쓰기는 허용하지 않는다.

## Do's and Don'ts

### Do:

- Do 작은 브랜드 헤더와 우측 목적 메뉴, 왼쪽 최근 기록의 읽기 순서를 유지한다.
- Do 같은 날 다과목·다강사·분할 수업을 독립 항목으로 표시하고 많은 일정은 세로로 늘린다.
- Do 안내서에 과목·강사별 유형·시수·단가 근거와 전체 월간 달력을 함께 남긴다.
- Do 청구액·초과금은 +파랑, 차감액은 −빨강으로 표시하고 단가에는 단위를 붙인다.
- Do 등록된 브랜드 자산을 사용하고 실패하면 식별 텍스트를 유지한다.
- Do 전월 시수 비교는 사용자가 켜고 같은 학생·바로 전월 자료를 확인한 경우에만 표시한다.
- Do 미확인 금액·조회 실패·출력 실패는 상태 문구와 다음 동작으로 알린다.

### Don't:

- Don't 카드·목록·선택 상태에 짧고 진한 왼쪽 장식 띠나 inset side shadow를 추가한다.
- Don't 직원 달력의 폭을 출력물 폭으로 제한하거나 달력 수업을 +N으로 숨긴다.
- Don't 날짜·과목만 같다는 이유로 독립 수업을 병합하거나 필터된 과목만 합산한다.
- Don't 누락 전월 자료와 미확인 단가를 0으로 표시하거나 서로 다른 학생을 비교한다.
- Don't 인트라넷 원본 금액을 표시 단가로 다시 계산하거나 미확인 후보를 자동 적용한다.
- Don't 프로토타입의 가상 자료·설명 메뉴를 운영 기능으로 기록하거나 실제 메신저 수신 가독성이 검증됐다고 주장한다.

2026-09-30 디테일 보완 검증: `.impeccable/review/20260930-detail/`의 안내서 A/B, wide·mobile, UI·회귀 결과를 기준으로 비교한다. 실제 학부모 메신저 전송 검증은 수행하지 않았다.

2026-09-30 안내서 압축: 원본 로고 형태와 알파를 유지한 SVG 색상 매트릭스로 연브라운을 표시한다. 진행형 제목은 ‘수강료 예상 안내서’, 기준·종료일은 11px 보조 문구다. 유형별 산식은 공간이 허용되면 두 칸으로 배치하며 과목과 시간은 한 줄, 강사·출결은 아래에 표시한다. 긴 분 단위 시간은 다음 줄로 내려도 과목명은 쪼개지 않는다. 소계·거래액은 700 굵기이며 이미지 저장·복사는 같은 크기의 두 열이다. 설정의 안내 문구 탭에서 바우처 설명·예시를 함께 편집한다.

2026-09-30 전월 수업 선택: 직원이 등록 학생을 검색해 연결하면 전월 인트라넷 수업을 읽기 전용으로 자동 조회한다. 같은 과목·강사·유형·시수·회당 금액의 기록은 하나의 수업 조건으로 묶어 요일 선택을 단순화한다. 같은 날짜의 독립 회차는 시각으로 구분하고 각각 남긴다. 두 번 이상 반복되고 같은 요일에 충돌이 없는 요일만 미리 선택하며, 1회 기록과 상충하는 조건은 직원이 직접 고른다. 요일고정은 요일 칩, 선택형은 요일별 날짜 일괄 선택과 개별 날짜 달력을 제공한다. 조회는 계산을 변경하지 않고 `선택한 요일/날짜로 수업 추가` 버튼에서만 반영한다. 누락 단가는 미확인 상태로 남겨 저장 전에 확인하게 한다.
