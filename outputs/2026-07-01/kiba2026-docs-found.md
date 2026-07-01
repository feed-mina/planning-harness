## 검색 결과: "kiba_2026 기획 하네스 통합 — @claude 봇 + git-project-sync"

> `/search-documents` 산출물 · 2026-07-01 · planning-harness → kiba_2026 첫 시드 기획

---

### 기존 문서

| 문서 | 위치 | 관련 내용 |
|------|------|----------|
| `PLANNING_HARNESS.md` | kiba_2026 루트 | 하네스 4단계 완료 기준·Phase 계획 전체 |
| `planning-harness/spec.md` | kiba_2026/planning-harness/ | 빈 SSOT 템플릿 (아직 내용 없음) |
| `planning-harness/CLAUDE.md` | kiba_2026/planning-harness/ | 7개 스킬 규칙서 |
| `planning-harness/SETUP.md` | kiba_2026/planning-harness/ | gh CLI 설치 가이드 |
| `.github/workflows/publish-planning-harness.yml` | kiba_2026 | kiba_2026/planning-harness/ → feed-mina/planning-harness 자동 동기화 |
| `.github/workflows/add-to-project.yml` | kiba_2026 | 이슈 → Project 보드 자동 추가 (PAT 필요) |
| `.github/workflows/todo-reflect.yml` | kiba_2026 | Todo/*.md → GitHub Issues 멱등 생성/갱신 |
| `KIBA 자동화 홈.md` | kiba_2026 | 전체 자동화 파이프라인 요약 |

### 관련 GitHub Issues

| 이슈 | 제목 | 상태 |
|------|------|------|
| #42 | 3개 입력 엑셀 기반 원가계산서 생성기 | open (구현 95% 완료) |
| #10 | KIBA Pages 및 GitHub Issue 운영 후속 작업 | open |
| #4 | [문서 관리] 견적서 파일 자동 정리 및 이메일 요청 연동 | open |

### planning-harness 플러그인 현황

| 컴포넌트 | 상태 | 경로 |
|---------|------|------|
| 7개 스킬 (슬래시 커맨드) | ✅ 완료 | `.claude/commands/*.md` |
| 동기화 엔진 (sh/py) | ✅ 완료 | `scripts/` |
| 플러그인 매니페스트 | ✅ 완료 | `.claude-plugin/plugin.json` |
| harness-bot 워크플로 | ✅ 완료 (Phase 4) | `.github/workflows/harness-bot.yml` |
| kiba_2026 .harness/config.env | ❌ 없음 | kiba_2026/.harness/config.env |
| kiba_2026 harness-bot 워크플로 | ❌ 없음 | kiba_2026/.github/workflows/harness-bot.yml |

### 핵심 갭 (Gap)

1. **`kiba_2026/planning-harness/` 커맨드 디렉토리 비어있음** — `.claude/commands/` 가 없어 스킬 동작 안 함
2. **`.harness/config.env` 없음** — OWNER/PROJECT_NUMBER/REPO 미설정 → `git-project-sync` 실행 불가
3. **harness-bot.yml 없음** — `@claude` 코멘트 트리거 없음

### 차용 패턴 (KIBA 원형)

- `project_management_with_ai_agent` — gh CLI 기반 이슈/Project 동기화 (검증 완료)
- 기존 `add-to-project.yml` — PAT 기반, 하네스 봇과 공존 가능
- 기존 `todo-reflect.yml` — Todo/*.md → Issues, 하네스 회의록 파이프라인과 분리 유지
