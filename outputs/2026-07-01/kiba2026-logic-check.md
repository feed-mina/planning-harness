## 예외·테스트 케이스: "kiba_2026 기획 하네스 통합"

> `/logic-check` 산출물 · 2026-07-01 · ⚠️ 사람 승인 필요
> 진실의 원천: [kiba2026-spec.md](kiba2026-spec.md)

---

### 정상 케이스 (Happy Path)

- [ ] **TC-001**: `.harness/config.env` 에 모든 필드 입력 → `create_issues.sh` dry-run 성공 (이슈 0건 중복)
- [ ] **TC-002**: `@claude /git-project-sync 2026-07-01` → dry-run 제안 목록 PR 생성 → 승인 → 이슈 1건+ 생성 + Project 추가
- [ ] **TC-003**: `@claude /search-documents kiba_2026` → `docs-found.md` PR 생성
- [ ] **TC-004**: 기존 `todo-reflect.yml` 동시 트리거 → 두 워크플로 독립 실행, 충돌 없음

---

### 경계값 (Boundary)

- [ ] **TC-010**: 회의록 `## 할 일` 항목 0건 → "할 일 없음" 출력, 이슈 생성 없음
- [ ] **TC-011**: 같은 회의록으로 `/git-project-sync` 2회 실행 → 2회차 모두 `skipped`, 중복 생성 없음 (멱등성)
- [ ] **TC-012**: `PROJECT_NUMBER` 가 실제 없는 번호 → `gh project list` 로 런타임 탐색, 경고 후 중단

---

### 예외 케이스 (Error Cases)

- [ ] **TC-020**: `ANTHROPIC_API_KEY` 시크릿 없음 → Actions job 실패 + 설정 안내 코멘트
- [ ] **TC-021**: `author_association` 이 `NONE` (외부인) → job skip (if 조건 불충족)
- [ ] **TC-022**: `GH_PAT` 에 project 스코프 없음 → `gh project item-add` 실패 → 경고 후 이슈만 생성
- [ ] **TC-023**: `.harness/config.env` 없음 → `scripts/config.env` 기본값 사용, OWNER/REPO 불일치 시 경고
- [ ] **TC-024**: `meetings/summary/2026-07-01_meeting.md` 없음 → "파일 없음" 메시지, 할 일 없음 처리
- [ ] **TC-025**: `## 할 일` 항목에 `@담당자` 누락 → assignee 빈 값으로 이슈 생성 (허용)
- [ ] **TC-026**: 이슈 제목에 특수문자(`"`, `` ` ``, `|`) → gh CLI JSON 이스케이프 처리, 생성 성공

---

### 보안 테스트 (Security)

- [ ] **TC-030**: Actions 로그에 `ANTHROPIC_API_KEY` 노출 없음 (마스킹 확인)
- [ ] **TC-031**: Actions 로그에 `GH_PAT` 노출 없음
- [ ] **TC-032**: 회의록 원문(`meetings/raw/`)이 이슈 본문에 게시되지 않음
- [ ] **TC-033**: 외부 collaborator 의 `@claude` 코멘트 → job 미실행 (author_association 검사)

---

### 기존 자동화 공존 테스트 (NFR-001)

- [ ] **TC-040**: `Todo/*.md` push → `todo-reflect.yml` 정상 실행 (harness-bot 미트리거)
- [ ] **TC-041**: 이슈 opened → `add-to-project.yml` 정상 실행 (harness-bot 미트리거)
- [ ] **TC-042**: `planning-harness/**` push → `publish-planning-harness.yml` 정상 실행

---

### spec.md 검증 매핑

| spec 요구사항 | 커버된 TC | 결과 |
|-------------|---------|------|
| FR-001 플러그인 설치 | TC-001 | ✓ |
| FR-002 config.env | TC-012, TC-023 | ✓ |
| FR-003 harness-bot | TC-020, TC-021 | ✓ |
| FR-004 관통 테스트 | TC-001~004 | ✓ |
| NFR-001 공존 | TC-040~042 | ✓ |
| NFR-002 보안 | TC-030~033 | ✓ |
| 멱등성 | TC-011 | ✓ |
| 회의록 원문 비노출 | TC-032 | ✓ |

---

**⚠️ 승인 요청** — 테스트 케이스 확인 후 "승인" 또는 "수정" 알려주세요:
- [ ] 비즈니스 규칙(공존·보안·멱등) 모두 커버됐는가?
- [ ] 누락된 예외 상황이 있는가?
