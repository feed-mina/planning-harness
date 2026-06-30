## 검색 결과: "회의록 → GitHub Issue/Project 자동 동기화"

> `/search-documents` 산출물 · 2026-06-30

### 기존 문서
- [spec.md](../../spec.md) § 요구사항 FR-001~004 — 이 기능의 SSOT
- [CLAUDE.md](../../CLAUDE.md) § /git-project-sync — 스킬 입출력 규약 + 가드레일
- [scripts/README.md](../../scripts/README.md) — 동기화 엔진 사용법(gh/Python 이중 경로)
- [meetings/README.md](../../meetings/README.md) — raw/summary 파이프라인, 원문 비노출 규칙

### 구현 산출물 (Phase 2)
- `scripts/parse_actions.py` — 회의록 `## 할 일` 파서
- `scripts/create_issues.sh` + `scripts/lib.sh` — gh 기반 생성·필드설정
- `scripts/github_sync.py` — Python 보조(REST/GraphQL)

### 참고 repo
- `project_management_with_ai_agent` (KIBA) — 원형: 회의록↔Project 조정 + 사람 승인(Confirmation Policy)
  - `scripts/lib.sh` (노드 ID 런타임 해석), `reconcile.sh` (제안→승인→적용)
- `quali-fit` (KIBA) — 다운스트림 개발 프로젝트 표본(PR 규율, 홈랩 배포)

### 관련 Issues
- (gh 인증됨 — 신규 repo라 아직 이슈 없음. 동기화 실행 시 생성 예정)

### 외부 노트 (NotebookLM 등)
- 해당 없음
