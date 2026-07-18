# Redesign audit

## Mode

Preserve mode. 기존 에스에듀 블루, 한국어 문구, 9개 업무 탭, 저장·계산·이미지 저장 흐름을 유지하고 요청된 결함만 targeted evolution으로 개선한다.

## Before-state evidence

- 배포 화면: `https://sedubanpo.github.io/feecalc/`
- 캡처: `before-1280.png`
- Chrome 측정: 저장 기록 패널 300px에서 제목 폭 29.27px, 높이 120px으로 글자 단위 줄바꿈 발생.
- 기존 정보 밀도: 8/10, 모션: 1/10, 레이아웃 변화: 3/10.

## Brand tokens

- 기본 강조: `#004094`
- 배경/표면: `#F8FAFC` / `#FFFFFF`
- 본문: `#1F2937`
- 서체: Noto Sans KR 중심의 기존 한국어 UI 스택
- 숫자: 금액 판독을 위해 tabular numerals 필요

## Information architecture and key paths

- 상단 탭: 요일고정, 선택형, 변동형, 안내형, 첫등록, 시간표, 이력확인, AI예측, 납부/차액
- 핵심 경로: 학생명/연월 입력 → 과목·단가 입력 → 안내서 확인 → 이미지 저장 또는 서버 저장
- URL, 탭 이름, 입력 필드 ID, Supabase RPC 계약은 유지한다.

## Preserve

- 안내서의 문서형 구성과 에스에듀 로고
- 고밀도 PC 레이아웃과 탭별 상태색
- 기존 저장본의 계산 기본값: 요일고정·선택형·첫등록·시간표는 회당, 변동형은 시간당
- Supabase 저장·검색·갱신 흐름

## Retire or correct

- 좁은 기록 패널에서 제목과 3개 작업 버튼을 같은 행에 배치한 구조
- 탭별로 분산되어 일부 메뉴에서 빠진 캘린더 숨김 분기
- 이미지 캡처 직전 학생명 동기화가 보장되지 않는 흐름
- 단가의 회당/시간당 의미가 행마다 드러나지 않는 입력 UX
- `transition: all`과 선언되지 않은 기존 디자인 값

## Unavailable and unverified

- Search Console, 분석 이벤트, SEO 순위 데이터는 제공되지 않아 확인하지 못했다. 단일 GitHub Pages 업무 도구이며 URL·메타 제목·탭 라벨을 보존했으므로 본 작업의 성공 기준을 막지 않는다.
