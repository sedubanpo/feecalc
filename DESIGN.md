# 에스에듀 반포관 수강료 계산기 디자인 토큰

## 1. Atmosphere / signature

고밀도 업무 문서의 신뢰감. 계산 결과와 상태 구분을 가장 먼저 읽히게 하며, 장식보다 정렬과 대비로 정보를 구분한다. 기존 에스에듀 블루와 기능별 상태색을 유지하고, 새 UI는 필요한 경우에만 추가한다.

## 2. Color

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#F8FAFC` | 작업 영역 배경 |
| `--color-surface` | `#FFFFFF` | 문서 및 입력 표면 |
| `--color-fg` | `#1F2937` | 본문 및 금액 |
| `--color-muted` | `#6B7280` | 보조 정보 |
| `--color-primary` | `#004094` | 에스에듀 기본 강조 |
| `--color-history` | `#16A34A` | 이력 확인 및 과금 확정 |
| `--color-caution` | `#E11D48` | 취소 및 주의 |
| `--color-free` | `#0891B2` | 무상 보충 |
| `--color-border` | `#E5E7EB` | 표와 입력 경계 |
| `--color-ring` | `#16A34A` | 이력 입력 포커스 |

기본 본문과 표면의 대비는 4.5:1 이상을 유지한다.

## 3. Typography

`Arial, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`를 사용한다. 본문은 12px/400/1.5, 보조 정보는 10px/700/1.4, 섹션 제목은 12px/700/1.4, 금액은 16px/800/1.2이며 `tabular-nums`를 사용한다.

## 4. Spacing

기본 단위는 4px이다. `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`를 사용한다. 표 행은 12px 수직 여백, 입력 패널은 12px 안쪽 여백을 기준으로 한다.

## 5. Components

문서 패널은 흰색 표면, 8px 반경, `--color-border` 1px 경계를 사용한다. 상태 표지는 4px 반경, 6px 가로와 2px 세로 여백, 10px 굵은 글꼴을 사용한다. 버튼은 최소 40px 클릭 영역을 유지하고 hover, focus, active 상태를 제공한다. 과금 상태는 녹색, 취소 주의는 장미색, 무상 보충은 청록색으로 고정한다.

## 6. Motion

업무 화면에서는 상태 전환에만 160ms `cubic-bezier(0.2, 0, 0, 1)`을 사용한다. `transform`, `opacity`, `filter`만 전환하며, `prefers-reduced-motion`에서는 전환을 제거한다.

## 7. Depth

기본은 경계선과 표면 명도 차이로 구분한다. 필요한 경우에만 `0 1px 2px rgba(31, 41, 55, 0.06), 0 4px 12px rgba(31, 41, 55, 0.04)`의 얕은 2단 그림자를 사용한다. 무거운 그림자와 카드 중첩은 사용하지 않는다.
