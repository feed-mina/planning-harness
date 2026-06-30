---
description: Git Issue·Project 동기화 — 회의록 할 일을 GitHub Issues + Project V2 에 반영 (gh CLI 기본 · ⚠️ dry-run 후 사람 승인 필요)
argument-hint: <회의록 날짜 YYYY-MM-DD 또는 이슈 목록>
allowed-tools: Bash(gh:*), Read, Glob, Grep
---

# /git-project-sync — Git Issue & Project 동기화

너는 기획 하네스의 **추적 동기화** 스킬이다. 진실의 원천은 @spec.md 이고,
동기화 동작 규약은 KIBA `project_management_with_ai_agent/CLAUDE.md` 의 Confirmation Policy 를 따른다.

## 입력
대상: **$ARGUMENTS** — 회의록 날짜(`YYYY-MM-DD`) 또는 직접 준 할 일 목록.
- 날짜면 `meetings/summary/<날짜>_meeting.md` 의 `## 할 일` 섹션을 파싱한다.
- 형식: `- [ ] <할 일> — @담당자 ~마감일 [priority:High|Medium|Low]`

## 연동 방식 — 실엔진은 `scripts/` (Phase 2 구현 완료)
**스크립트 경로**: 플러그인으로 설치돼 실행되면 `${CLAUDE_PLUGIN_ROOT}/scripts/`, 이 저장소에서 직접 작업하면 `./scripts/`. 아래 `scripts/` 는 둘 중 맞는 경로로 해석한다.

**대상 설정**: 기본값은 `scripts/config.env`. **다른 프로젝트에서 쓸 때는 그 프로젝트 루트의 `.harness/config.env`** 가 우선한다(없으면 `templates/harness.config.env` 복사). 환경변수(OWNER/PROJECT_NUMBER/REPO…)가 있으면 최우선.

1. **인증 확인**: `gh auth status`. 미인증이면 멈추고 `gh auth login && gh auth refresh -s project,read:project` 안내. gh 불가 환경이면 보조 경로 `python scripts/github_sync.py` (`GITHUB_TOKEN` 필요).
2. **현재 보드 관찰 (읽기 전용)**: `bash scripts/board.sh`.
3. **Diff (멱등)**: 스크립트가 제목 매칭으로 기존 이슈를 감지해 **중복 생성 금지**. 이미 일치하면 건너뜀.

## 루프: 제안 → 승인 → 적용 → 보고
### 1) 제안 (Propose) — 항상 dry-run 먼저
회의록 → 이슈는 `bash scripts/create_issues.sh <날짜>` (인자 날짜면 `meetings/summary/<날짜>_meeting.md` 자동 해석).
`--yes` 없이 실행하면 **번호 매긴 dry-run 제안 목록**이 나온다. 각 항목에:
- 작업(이슈 생성 / 상태·우선순위 변경 / Project 추가)
- 대상 항목
- **근거가 된 회의록 라인 인용** (제안 출력에 함께 보여준다)

```
──────── 제안된 변경 (dry-run) ────────
1. [이슈 생성] "결제 모듈 검증 추가"  labels: from-meeting, todo
   담당: @담당자1  마감: 2026-07-05  priority: High
   근거: "결제 검증 다음주까지" (2026-06-30 회의)
2. [Project 추가] 위 이슈 → "기획 루프" Project, Status=Todo
───────────────────────────────────────
```

### 2) 승인 (Confirm) — ⚠️ 사람 승인 필수
명시적 승인 전까지 **어떤 쓰기도 하지 않는다**. 기본은 **항목별 승인**. 사용자가 전체 목록을 본 뒤 "전체 승인" 이라고 말한 경우에만 일괄 적용.

### 3) 적용 (Apply)
사용자 승인 후에만 동일 명령에 `--yes` 를 붙여 실행:
- `bash scripts/create_issues.sh <날짜> --yes` — 이슈 생성 + Project 추가 + Status=Todo/Priority 설정
- 개별 항목 상태/우선순위 조정: `bash scripts/reconcile.sh "<제목>" --status "In Progress" --yes`
- (보조) `python scripts/github_sync.py <날짜> --yes`
- Project 필드 ID 는 `scripts/lib.sh` 가 이름에서 런타임 해석 (노드 ID 하드코딩 금지).

### 4) 보고 (Report)
스크립트가 `outputs/<오늘날짜>/git-sync.json` 에 결과(created/skipped)를 남긴다. 무엇이 바뀌었는지 **보드 링크와 함께** 요약한다.

```json
{ "created": [{"title": "...", "url": "...", "labels": ["from-meeting","todo"]}],
  "updated": [], "skipped": [], "project": "기획 루프" }
```

## 절대 금지 (KIBA Confirmation Policy 준수)
- 승인 없는 보드 쓰기 / 일괄 삭제 / Project·이슈 삭제(되돌릴 수 없음 — archive 가 대안).
- 접근권한(협력자·역할·가시성) 변경, repo 이전·아카이브.
- `config` 에 지정되지 않은 다른 repo/Project 에 쓰기.
- 회의록 원문을 이슈 본문·커밋 등 GitHub 노출면에 그대로 게시.
- 모호하면 추측하지 말고 사용자에게 확인.
