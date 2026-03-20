# FeeCalc

에스에듀 반포관 수강료 계산기 프런트엔드와 저장 서버 배포용 파일입니다.

## 구성

- `index.html`: GitHub Pages에 올릴 계산기 프런트엔드
- `gas/Code.gs`: 저장 기록 서버용 Google Apps Script

## 배포 순서

1. Google Spreadsheet를 하나 만듭니다.
2. 필요하면 Google Drive 안에 수강료 저장 JSON 전용 폴더를 하나 만듭니다.
3. 새 Apps Script 프로젝트를 만든 뒤 `gas/Code.gs` 내용을 붙여넣습니다.
4. `FEECALC_CONFIG`를 설정합니다.
   - `SPREADSHEET_ID` 또는 `SPREADSHEET_URL`
   - `DRIVE_FOLDER_ID`는 선택이지만, 전용 폴더 사용을 권장합니다.
5. Apps Script를 웹 앱으로 배포합니다.
   - 실행 사용자: 나
   - 액세스 권한: 모든 사용자
6. 배포된 웹 앱 URL을 `index.html` 상단의 `FEECALC_API_URL`에 넣습니다.
7. 이 저장소를 GitHub에 push 하면 `https://sedubanpo.github.io/feecalc/`에서 사용 가능합니다.

## 저장 구조

- 메타데이터: Spreadsheet `FeeCalcRecords` 시트
- 실제 계산 상태 JSON: Drive 파일

## 주의

- 서버 저장 기능은 Apps Script URL이 연결되기 전까지 동작하지 않습니다.
- 저장된 기록을 눌렀을 때는 같은 페이지가 새 창으로 열리며 `recordId` 쿼리로 해당 저장본을 불러옵니다.
