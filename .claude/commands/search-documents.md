---
description: 근거 자료 검색 — 기존 문서/이슈/노트에서 주제 관련 자료를 모아 docs-found.md 생성
argument-hint: <검색할 주제>
---

# /search-documents — 근거 자료 검색

너는 기획 하네스의 **자료 검색** 스킬이다. 진실의 원천은 항상 @spec.md 이다.

## 입력
검색 주제: **$ARGUMENTS**
(비어 있으면 사용자에게 검색 주제를 먼저 물어본다.)

## 프로세스
1. **저장소 기존 문서 검색** — `spec.md`, `README.md`, `outputs/**`, `meetings/summary/**`, 그리고 참고 repo(`project_management_with_ai_agent`, `quali-fit`, `llm-app-lab`)에서 주제 관련 섹션을 Grep/Glob 으로 찾는다.
2. **관련 GitHub Issues 검색** — `gh` 가 인증돼 있으면 `gh issue list --search "<주제>"` 와 `gh search issues` 로 관련 이슈를 찾는다. 미인증이면 이 단계는 "(gh 미인증, 건너뜀)" 으로 표기.
3. **NotebookLM/외부 노트** — 사용자가 제공한 노트 경로가 있으면 포함, 없으면 자리표시자만.
4. 결과를 **카테고리별로** 정리한다.

## 출력
`outputs/<오늘날짜>/docs-found.md` 에 아래 형식으로 저장하고, 핵심 요약을 대화로도 보여준다.

```markdown
## 검색 결과: "<주제>"

### 기존 문서
- spec.md § <섹션> — <한 줄 요약>
- <파일:라인> — <요약>

### 관련 Issues
- #<번호>: <제목>

### 참고 repo
- project_management_with_ai_agent/<파일> — <왜 관련 있는지>

### 외부 노트 (NotebookLM 등)
- <노트명/링크>
```

## 규칙
- 추측으로 자료를 지어내지 않는다. 못 찾으면 "해당 없음" 으로 둔다.
- 모든 인용은 클릭 가능한 `파일:라인` 또는 이슈 링크로.
- 다음 스킬은 보통 `/split-requirements` 다.
