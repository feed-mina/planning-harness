# 기획 하네스 - 진실의 원천 (Spec)

> **이 문서는 기획 루프의 단일 정보원(SSOT)입니다.**
> 모든 상세기획 산출물(요구사항, 플로우, 시퀀스, 테스트)의 기준이 됩니다.
> 빈 템플릿 원본은 [templates/spec_template.md](templates/spec_template.md) 에 보존돼 있습니다.

---

## 📌 기본 정보

- **프로젝트명**: planning-harness
- **기능명**: 회의록 → GitHub Issue/Project 자동 동기화 (`/git-project-sync`)
- **버전**: v0.2.0
- **작성일**: 2026-06-30
- **최종 검증일**: 2026-06-30
- **담당자**: @feed-mina

---

## 🎯 목표 (Purpose)

### 비즈니스 목표
회의에서 합의된 "할 일"이 트래커에 반영되지 않아 누락되는 문제를 없앤다. 회의록 요약 한 장에서
GitHub Issues + Project V2 까지를 **사람 승인 게이트**를 거쳐 자동 동기화한다.

### 사용자 목표
기획자가 회의록만 정리하면, 수작업 이슈 생성 없이 추적 보드가 최신 상태가 된다. 위험한 쓰기는
항상 본인이 승인한 뒤에만 일어난다.

### 성공 지표
- [ ] 회의록 1건의 할 일 → 이슈/프로젝트 반영까지 수작업 0회 (승인 클릭 제외)
- [ ] 중복 이슈 생성 0건 (멱등성)
- [ ] 승인 없이 발생한 보드 쓰기 0건

---

## 👥 대상 사용자 (Users)

**페르소나 1: 기획자**
- 특성: 회의 주재, 상세기획 담당. GitHub 사용하나 CLI 는 가볍게.
- 목표: 회의 결과를 빠르고 정확하게 추적 보드에 반영.
- 제약: 잘못된 자동 생성/삭제를 두려워함 → 승인 게이트 필수.

**페르소나 2: 개발 담당자**
- 특성: 이슈/Project 로 작업 수령.
- 목표: 명확한 제목·담당·마감·우선순위가 달린 이슈.
- 제약: 회의록 원문(민감정보)이 이슈에 노출되면 안 됨.

---

## 📋 요구사항 (Requirements)

### 기능 요구사항 (Functional)

#### FR-001: 회의록 할 일 파싱
- **설명**: `meetings/summary/<날짜>_meeting.md` 의 `## 할 일` 섹션을 구조화 항목으로 파싱.
- **입력**: 마크다운 파일 경로 또는 `YYYY-MM-DD`.
- **처리**: `- [ ] <할 일> — @담당자 ~YYYY-MM-DD [priority:High|Medium|Low]` 라인 추출. `- [x]`(완료) 기본 제외.
- **출력**: `{title, assignee, due, priority}` 목록 (JSON/TSV).
- **우선순위**: 필수
- **예외**:
  - 섹션/항목 없음: 빈 목록 + "할 일 없음" 안내
  - 메타(@/~/priority) 누락: 빈 값으로 허용

#### FR-002: 이슈 생성 + Project 추가 (멱등)
- **설명**: 각 할 일을 GitHub Issue 로 만들고 Project V2 에 추가, Status=Todo·Priority 설정.
- **입력**: FR-001 파싱 결과 + `scripts/config.env`.
- **처리**: 제목 일치 이슈가 이미 있으면 건너뜀. 라벨 `from-meeting,todo`. 노드 ID 는 런타임 해석.
- **출력**: 생성/건너뜀 결과 → `outputs/<날짜>/git-sync.json`.
- **우선순위**: 필수
- **예외**:
  - 중복 제목: 건너뜀(skipped)
  - 필드/옵션(Status/Priority) 부재: 경고 후 건너뜀(관용)

#### FR-003: 사람 승인 게이트 (dry-run 기본)
- **설명**: 모든 쓰기는 dry-run 제안 → 명시적 승인 → `--yes` 적용.
- **처리**: 기본 실행은 제안 목록만 출력(쓰기 없음). 각 제안에 근거 회의록 라인 표시.
- **우선순위**: 필수

#### FR-004: gh 기본 / Python 보조 이중 경로
- **설명**: gh CLI 가 기본, 없는 환경은 `GITHUB_TOKEN` 기반 stdlib 스크립트로 동일 동작.
- **우선순위**: 선택(보조 경로)

### 비기능 요구사항 (Non-Functional)

#### NFR-001: 성능
- **요구사항**: 할 일 20건 동기화 < 30초 (네트워크 제외 로컬 처리 < 2초)
- **측정 방법**: 20건 fixture dry-run 시간 측정

#### NFR-002: 보안
- **요구사항**: 회의록 원문을 GitHub 노출면(이슈 본문/커밋)에 게시 금지. `meetings/raw/` 는 커밋 금지.
- **구현 방식**: 이슈 본문엔 요약 항목만. `.gitignore` 로 raw 보호.
- **인증/인가**: gh OAuth(project 스코프) 또는 `GITHUB_TOKEN`(repo+project).

#### NFR-003: 멱등성/확장성
- **재실행**: 같은 회의록 재실행 시 추가 생성 0건.
- **이식성**: `config.env` 만 바꾸면 타 프로젝트 동작.

---

## 🏗️ 아키텍처 (Architecture)

```
회의록(summary.md) → parse_actions.py → [할 일 목록]
        → create_issues.sh (gh)  ─┐
        → github_sync.py (REST)  ─┴→ GitHub Issues → Project V2 (Status/Priority)
        → outputs/<날짜>/git-sync.json (리포트)
```

### 주요 컴포넌트
- **parse_actions.py**: 회의록 파서 (gh·Python 경로 공유)
- **create_issues.sh / lib.sh**: gh 기반 생성·필드설정, 노드 ID 런타임 해석
- **github_sync.py**: Python 보조 (urllib REST/GraphQL)
- **config.env**: 대상 owner/project/repo

---

## 🔄 사용자 흐름 (User Flows)

### 흐름 1: 회의록 동기화 (정상)
**선행 조건**: gh 인증됨, `meetings/summary/<날짜>_meeting.md` 존재
**정상 흐름**:
1. 사용자는 `/git-project-sync <날짜>` 실행
2. 시스템은 할 일을 파싱해 **dry-run 제안 목록**(근거 라인 포함) 출력
3. 사용자는 목록 검토 후 승인
4. 시스템은 `--yes` 로 이슈 생성 + Project 추가 + 리포트 저장
**예외 흐름**:
- 미인증 → `gh auth login` 안내 후 중단
- 중복 제목 → 해당 항목 건너뜀

---

## 📊 데이터 구조 (Data Model)

#### Entity: ActionItem (파싱 결과)
```
{ "title": "string (필수)", "assignee": "string", "due": "YYYY-MM-DD", "priority": "High|Medium|Low|''" }
```

#### Entity: SyncReport (`git-sync.json`)
```
{ "project": "string", "created": [{"title","url"}], "skipped": ["title"] }
```

### 상태 전이
```
파싱 → 제안(dry-run) → 승인 → 적용 → 보고
                  └─ 거절 → 종료(쓰기 없음)
```

---

## 🔐 보안 & 권한 (Security & Permissions)

### 인증
- **방식**: gh OAuth(project 스코프) 또는 `GITHUB_TOKEN`
- **재발급**: `gh auth refresh -s project,read:project`

### 인가
| 역할 | FR-001 파싱 | FR-002 생성 | FR-003 승인 |
|------|------|------|------|
| 기획자 | ✓ | ✓(승인 후) | ✓ |
| 에이전트 | ✓ | ✗(승인 전) | ✗ |

### 데이터 보호
- **전송**: HTTPS (api.github.com)
- **저장**: raw 회의록 git 제외
- **PII 정책**: 회의록 원문 비노출

---

## 🧪 테스트 기준 (Testing Criteria)

### 정상 케이스
- [ ] TC-001: 할 일 2건 회의록 → 제안 2건 출력
- [ ] TC-002: 승인 후 --yes → 이슈 2건 생성 + Project 추가

### 경계값
- [ ] TC-010: 할 일 0건 → "할 일 없음", 쓰기 없음
- [ ] TC-011: 메타 전부 누락된 할 일 → 빈 값으로 생성

### 예외 케이스
- [ ] TC-020: 중복 제목 → skipped 처리, 추가 생성 없음
- [ ] TC-021: gh 미인증 → 안내 후 중단
- [ ] TC-022: Priority 옵션 부재 → 경고 후 건너뜀

### 보안 테스트
- [ ] TC-030: 회의록 원문이 이슈 본문/커밋에 없음
- [ ] TC-031: `meetings/raw/` 가 git 추적에서 제외됨
- [ ] TC-032: 제목 내 특수문자/인젝션 문자열 → 안전 처리

### 성능 테스트
- [ ] TC-040: 할 일 20건 파싱 < 2초

---

## 📅 마일스톤 (Milestones)

### Phase 2: git-project-sync 엔진 ✅
- **기간**: 2026-06-30
- **산출물**: scripts/(lib·board·reconcile·parse_actions·create_issues·github_sync)
- **완료 기준**: dry-run→승인→적용 루프, 멱등성, 이중 경로

### Phase 3: 공통 모듈(플러그인)화
- **산출물**: Claude Code 플러그인 패키지

---

## ⚠️ 위험 & 제약 (Risks & Constraints)

| 위험 | 영향 | 확률 | 대응 |
|------|------|------|------|
| 승인 없는 자동 쓰기 | 높음 | 낮음 | dry-run 기본 + --yes 게이트 |
| 회의록 원문 노출 | 높음 | 중간 | 본문 요약화 + raw gitignore |
| 노드 ID 변경 | 중간 | 중간 | 이름→ID 런타임 해석 |

### 제약
- **기술**: gh project 스코프 또는 토큰 필요
- **조직**: config.env 지정 외 repo/Project 쓰기 금지

---

## 📝 변경 로그 (Changelog)

| 날짜 | 작성자 | 변경 내용 | 버전 |
|------|--------|----------|------|
| 2026-06-30 | @feed-mina | 시드 기획: /git-project-sync 명세 | v0.2.0 |

---

## ✅ 검증 체크리스트 (Validation Checklist)

- [x] 모든 요구사항이 명확한가?
- [x] 아키텍처가 요구사항을 만족하는가?
- [x] 테스트 기준이 완전한가?
- [x] 보안 요구사항이 포함되었는가?
- [x] 성능 목표가 현실적인가?
- [ ] 팀이 이 스펙을 이해하고 동의하는가? — 승인 대기

---

## 📚 참고 자료 (References)

- [CLAUDE.md](CLAUDE.md) — 하네스 규칙서
- [scripts/README.md](scripts/README.md) — 동기화 엔진
- KIBA `project_management_with_ai_agent` — 원형 패턴
