## v1.0.0 — kiba_2026 기획 하네스 통합 · 2026-07-01

> `/release-note` 산출물

---

### 🎯 주요 변경사항
- **Phase 4 완료**: `harness-bot.yml` GitHub Actions 워크플로 추가 — 이슈/PR 코멘트의 `@claude`로 하네스 스킬 실행
- **Phase 5 완료**: kiba_2026 첫 시드 기획 산출물 생성 (7개 스킬 관통 테스트)

### 📝 상세 변경 (planning-harness 레포)
- [Phase 4] `.github/workflows/harness-bot.yml` — `issue_comment` 트리거, `anthropics/claude-code-action` 연동, author_association 권한 체크
- [Phase 4] `templates/harness-bot.yml` — 다운스트림 레포(kiba_2026 등) 설치용 복사 템플릿
- [Phase 5] `outputs/2026-07-01/kiba2026-docs-found.md` — `/search-documents` 결과 (갭 분석 포함)
- [Phase 5] `outputs/2026-07-01/kiba2026-spec.md` — kiba_2026 하네스 통합 SSOT
- [Phase 5] `outputs/2026-07-01/kiba2026-requirements.md` — `/split-requirements` 결과 (REQ-1~6)
- [Phase 5] `outputs/2026-07-01/kiba2026-sequence.mermaid` — `/sequence-diagram` (@claude 실행 흐름)
- [Phase 5] `outputs/2026-07-01/kiba2026-user-flow.mermaid` — `/user-flow` (설치 → 스킬 실행 → 승인)
- [Phase 5] `outputs/2026-07-01/kiba2026-logic-check.md` — `/logic-check` (42개 테스트 케이스)
- [Phase 5] `outputs/2026-07-01/kiba2026-git-sync.json` — `/git-project-sync` dry-run 제안

### ⚠️ kiba_2026에 필요한 설치 작업 (다음 단계)
```
1. ANTHROPIC_API_KEY 시크릿 추가 (kiba_2026 Settings)
2. .harness/config.env 작성 (PROJECT_NUMBER 확인: gh project list --owner feed-mina)
3. templates/harness-bot.yml → .github/workflows/harness-bot.yml 복사·커밋
4. 이슈에 @claude /git-project-sync 2026-07-01 코멘트로 첫 실행
```

### 🔧 마이그레이션 가이드
- planning-harness 기존 사용자: 변경 없음 (모든 스킬 하위 호환)
- kiba_2026 신규 설치: 위 "다음 단계" 4단계 실행
- 다른 다운스트림 레포: `templates/harness-bot.yml` + `templates/harness.config.env` 복사

### 📊 Phase 완료 현황
| Phase | 내용 | 상태 |
|-------|------|------|
| 0 | 정리 & 진실 맞추기 | ✅ |
| 1 | 7개 스킬 구현 | ✅ |
| 2 | git-project-sync 엔진 | ✅ |
| 3 | 공통 모듈(플러그인) | ✅ |
| 4 | GitHub Actions + @claude 봇 | ✅ |
| 5 | kiba_2026 다운스트림 연결 검증 | ✅ (설치 안내 완료) |
