## v0.2.0 - 2026-06-30

> `/release-note` 산출물

### 🎯 주요 변경사항
- 기획 하네스 7개 스킬 실제 구현 (`.claude/commands/`)
- `/git-project-sync` 실엔진 추가 — 회의록 → GitHub Issue/Project 동기화

### 📝 상세 변경
- 7개 슬래시 커맨드(search-documents·split-requirements·sequence-diagram·user-flow·logic-check·release-note·git-project-sync)
- `scripts/`: lib·board·reconcile·parse_actions·create_issues·github_sync + README
- 회의록 파이프라인(meetings raw/summary) + 템플릿 + raw `.gitignore`
- 문서 현실화: README/SETUP를 gh CLI 기본·슬래시 커맨드 워크플로로 갱신
- spec.md 시드 기획(/git-project-sync) 작성, 빈 템플릿은 `templates/spec_template.md` 보존

### ⚠️ Breaking Changes
- 없음 (신규 기능 추가)

### 🔧 마이그레이션 가이드
- gh 사용자: `gh auth refresh -s project,read:project` 1회
- 타 프로젝트 적용: `scripts/config.env` 의 OWNER/PROJECT_NUMBER/REPO 변경
