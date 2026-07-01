# kiba_2026 기획 하네스 통합 — 진실의 원천 (Spec)

> **이 문서는 기획 루프의 단일 정보원(SSOT)입니다.**
> 진실의 원천: [planning-harness/spec.md](../../spec.md)
> 작성일: 2026-07-01 · 담당자: @feed-mina

---

## 📌 기본 정보

- **프로젝트명**: kiba_2026
- **기능명**: 기획 하네스 통합 — `@claude` 봇 + `/git-project-sync` 연결
- **버전**: v1.0.0
- **작성일**: 2026-07-01
- **최종 검증일**: 2026-07-01
- **담당자**: @feed-mina

---

## 🎯 목표 (Purpose)

### 비즈니스 목표
kiba_2026 레포에 planning-harness 플러그인을 설치해, 이슈·PR 코멘트에 `@claude /스킬명`만 입력하면
상세기획 산출물(요구사항·시퀀스·테스트케이스)이 자동 생성되고 GitHub Issues/Project 와 동기화된다.

### 사용자 목표
기획자(@feed-mina)가 GitHub 앱(모바일 포함) 에서 코멘트 한 줄로 기획 루프를 시작하고,
변경사항은 PR 로 제출돼 리뷰 후 반영된다.

### 성공 지표
- [ ] `@claude /search-documents` → `outputs/2026-07-01/docs-found.md` 생성 (PR 확인)
- [ ] `@claude /git-project-sync 2026-07-01` → kiba_2026 Issues 생성 + Project 추가 (dry-run 후 승인)
- [ ] 기존 `todo-reflect.yml` / `add-to-project.yml` 과 충돌 없음

---

## 👥 대상 사용자 (Users)

**페르소나 1: 기획자 (@feed-mina)**
- 특성: 회의 주재, 기획·이슈 관리 담당. GitHub 앱 + 데스크톱 병행.
- 목표: 코멘트 한 줄로 기획 산출물 생성 + 이슈 동기화.
- 제약: 실수로 이슈/Project 를 삭제하거나 덮어쓰는 상황을 극히 두려워함 → dry-run + 승인 필수.

**페르소나 2: AI 에이전트 (@claude 봇)**
- 특성: `anthropics/claude-code-action` Actions 런너.
- 목표: 요청 코멘트를 파싱해 하네스 스킬 실행 → PR 생성.
- 제약: CLAUDE.md 가드레일 준수. 승인 없는 쓰기 금지.

---

## 📋 요구사항 (Requirements)

### 기능 요구사항 (Functional)

#### FR-001: 플러그인 설치 (harness 파일 복사)
- **설명**: `feed-mina/planning-harness` 의 `.claude/commands/`, `scripts/`, `templates/` 를 kiba_2026 에 설치.
- **입력**: planning-harness 플러그인 최신 버전.
- **처리**: `publish-planning-harness.yml` 역방향 — 또는 `claude plugin install`.
- **출력**: `kiba_2026/planning-harness/.claude/commands/*.md` 7개 파일.
- **우선순위**: 필수
- **예외**:
  - 기존 파일 존재: 덮어쓰기 전 diff 확인

#### FR-002: `.harness/config.env` 설정
- **설명**: kiba_2026 고유 OWNER/PROJECT_NUMBER/REPO 설정.
- **입력**: `templates/harness.config.env` 템플릿.
- **처리**: OWNER=feed-mina, PROJECT_NUMBER=<kiba 프로젝트 번호>, REPO=kiba_2026 으로 채움.
- **출력**: `kiba_2026/.harness/config.env`.
- **우선순위**: 필수
- **예외**:
  - PROJECT_NUMBER 모름: `gh project list --owner feed-mina` 로 확인

#### FR-003: harness-bot 워크플로 설치
- **설명**: `templates/harness-bot.yml` → `kiba_2026/.github/workflows/harness-bot.yml` 복사.
- **입력**: `ANTHROPIC_API_KEY` 시크릿 (kiba_2026 Settings).
- **처리**: 기존 `add-to-project.yml` 과 병행 동작 확인.
- **출력**: `kiba_2026/.github/workflows/harness-bot.yml` 활성화.
- **우선순위**: 필수

#### FR-004: 첫 `/git-project-sync` 관통 테스트
- **설명**: 회의록 or 이슈 코멘트에서 `@claude /git-project-sync 2026-07-01` 실행.
- **처리**: dry-run → 제안 목록 출력 → 승인 → 이슈 생성 + Project 추가.
- **출력**: `outputs/2026-07-01/git-sync.json`, kiba_2026 GitHub Issues 1건+.
- **우선순위**: 필수

### 비기능 요구사항 (Non-Functional)

#### NFR-001: 기존 자동화 공존
- **요구사항**: `todo-reflect.yml` / `add-to-project.yml` 과 트리거 충돌 없음.
- **측정**: 기존 파이프라인 정상 동작 확인.

#### NFR-002: 보안
- **요구사항**: `ANTHROPIC_API_KEY`, `GH_PAT` 시크릿이 로그에 노출되지 않음.
- **구현**: Actions 시크릿 마스킹 기본 적용.

---

## 🏗️ 아키텍처 (Architecture)

```
이슈/PR 코멘트 (@claude /스킬명 args)
        ↓
harness-bot.yml (issue_comment 트리거)
        ↓
anthropics/claude-code-action
        ↓ (CLAUDE.md 컨텍스트 + .claude/commands/ 스킬)
스킬 실행 (parse → generate → propose)
        ↓
PR 생성 (outputs/<날짜>/*.md, *.mermaid, *.json)
        ↓
기획자 리뷰 → Merge
        ↓ (선택: /git-project-sync --yes)
GitHub Issues + Project V2 (kiba_2026)
```

### 주요 컴포넌트
- **harness-bot.yml**: 트리거 워크플로
- **claude-code-action**: AI 실행 엔진
- **CLAUDE.md**: 가드레일 + 스킬 정의
- **.harness/config.env**: kiba_2026 고유 설정
- **scripts/**: gh CLI 동기화 엔진

---

## 🔄 사용자 흐름 (User Flows)

### 흐름 1: @claude 봇으로 스킬 실행

**선행 조건**: harness-bot.yml 활성화, ANTHROPIC_API_KEY 시크릿 설정

**정상 흐름**:
1. 기획자는 이슈 코멘트에 `@claude /split-requirements "FR-001: 엑셀 파싱"` 입력
2. harness-bot.yml 이 트리거됨
3. claude-code-action 이 CLAUDE.md + 스킬 파일 읽어 실행
4. `outputs/2026-07-01/requirements.md` 생성 + PR 제출
5. 기획자는 PR 리뷰 후 Merge

**예외 흐름**:
- ANTHROPIC_API_KEY 없음 → Actions 실패 + 시크릿 설정 안내
- 권한 없는 사용자 코멘트 → job skip (author_association 조건)

### 흐름 2: /git-project-sync 관통 테스트

**정상 흐름**:
1. `@claude /git-project-sync 2026-07-01`
2. 봇이 `meetings/summary/2026-07-01_meeting.md` 파싱 (또는 코멘트 내 할 일 직접 파싱)
3. dry-run 제안 목록 → PR 코멘트로 출력
4. 기획자 "전체 승인" 댓글 → `--yes` 실행
5. Issues 생성 + Project 추가 + git-sync.json 저장

---

## 📅 마일스톤 (Milestones)

### Phase 1: 설치 (반나절)
- **기간**: 2026-07-01
- **산출물**: FR-001~003 완료 (파일 복사 + config + 워크플로)
- **완료 기준**: harness-bot.yml 이 kiba_2026 에 활성화

### Phase 2: 관통 테스트 (반나절)
- **기간**: 2026-07-01
- **산출물**: FR-004 — `/git-project-sync` 1회 성공
- **완료 기준**: git-sync.json + kiba_2026 Issues 생성 확인

---

## ⚠️ 위험 & 제약

| 위험 | 영향 | 확률 | 대응 |
|------|------|------|------|
| PROJECT_NUMBER 불명확 | 높음 | 중간 | `gh project list` 런타임 해석 |
| publish-planning-harness.yml 충돌 | 중간 | 낮음 | 워크플로 트리거 경로 분리 |
| ANTHROPIC_API_KEY 없음 | 높음 | 낮음 | 시크릿 사전 설정 가이드 |

---

## 📝 변경 로그

| 날짜 | 작성자 | 변경 내용 | 버전 |
|------|--------|----------|------|
| 2026-07-01 | @feed-mina (harness) | 첫 시드 기획 SSOT 작성 | v1.0.0 |

---

## ✅ 검증 체크리스트

- [x] 모든 요구사항이 명확한가?
- [x] 아키텍처가 요구사항을 만족하는가?
- [x] 테스트 기준이 완전한가?
- [x] 보안 요구사항이 포함되었는가?
- [x] 기존 자동화(todo-reflect, add-to-project)와 충돌 없음?
- [ ] 팀이 이 스펙을 이해하고 동의하는가? — 승인 대기
