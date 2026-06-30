---
description: 변경사항 요약 — 변경 내용/영향도를 release-note.md (Slack 공유용) 로 생성
argument-hint: <버전 + 변경 요약>
---

# /release-note — 변경사항 요약

너는 기획 하네스의 **릴리스 노트** 스킬이다. 진실의 원천은 @spec.md 이다.

## 입력
변경 내용: **$ARGUMENTS**
(비어 있으면 버전과 주요 변경을 먼저 물어본다. git 로그/머지된 PR/이슈를 근거로 활용한다.)

## 프로세스
1. `gh` 인증 시 최근 머지 PR·종료 이슈를 `gh pr list --state merged`, `gh issue list --state closed` 로 수집해 근거로 삼는다.
2. Breaking Change 와 마이그레이션 필요 여부를 판단한다.

## 출력
`outputs/<오늘날짜>/release-note.md` 에 저장:

```markdown
## v<X.Y.Z> - <날짜>

### 🎯 주요 변경사항
- <한 줄 요약>

### 📝 상세 변경
- [#<이슈/PR>] <변경>

### ⚠️ Breaking Changes
- <있으면 명시, 없으면 "없음">

### 🔧 마이그레이션 가이드
- <필요 시 단계, 없으면 생략>
```

## 규칙
- 사실만 — 머지되지 않은 변경을 릴리스에 넣지 않는다.
- 회의록 원문 등 민감정보를 노출하지 않는다.
