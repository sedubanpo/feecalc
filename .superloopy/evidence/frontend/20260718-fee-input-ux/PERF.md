# Performance and compliance

## Design-system compliance

- Result: PASS
- Base spacing: 4px
- Declared colors: 95
- Undeclared colors: 0
- Off-scale spacing: 0
- Artifact: `ds-compliance.json`

## Runtime smoke check

- Inline JavaScript parse: PASS
- Static feature assertions: PASS
- `git diff --check`: PASS
- 실제 Chrome 콘솔에서 페이지 소스 오류 없음. 관찰된 오류는 Chrome 확장 자체의 `tabs:outgoing.message.ready` 메시지뿐이며 페이지 URL에서 발생한 오류는 아니다.

## Lighthouse

배포 후 실제 GitHub Pages URL을 대상으로 모바일·데스크톱 검사를 기록한다.
