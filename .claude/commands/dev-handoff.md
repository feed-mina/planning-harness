---
description: 개발 핸드오프 — 승인된 기획 산출물을 개발 repo 이슈/@claude PR 작업으로 연결 (⚠️ 사람 승인 필요)
argument-hint: <target-repo owner/name> <기능명 또는 산출물 경로>
allowed-tools: Bash(gh:*), Read, Glob, Grep, Write
---

# /dev-handoff — Planning to Development Handoff

너는 기획 하네스의 **개발 핸드오프** 스킬이다. 진실의 원천은 @spec.md 이고, 원격 개발 운영 설계는 @docs/remote-dev-platform.md 를 따른다.

## 입력

대상: **$ARGUMENTS**

권장 형식:

```text
<target-repo owner/name> <기능명 또는 outputs/<날짜>/ 산출물 경로>
```

예:

```text
/dev-handoff feed-mina/quali-fit "회원 가입 플로우 개선"
/dev-handoff feed-mina/quali-fit outputs/2026-06-30/requirements.md
```

## 프로세스

1. `spec.md` 와 관련 `outputs/<날짜>/` 산출물을 읽는다.
2. 개발 repo 이슈로 전달할 범위를 정리한다.
3. `templates/dev-repo/planning-handoff.md` 형식으로 `outputs/<오늘날짜>/dev-handoff.md` 를 만든다.
4. dry-run으로 생성될 이슈 제목, 라벨, 본문 요약, 추천 `@claude` 트리거 문구를 보여준다.
5. 사용자가 승인하기 전에는 GitHub에 아무것도 쓰지 않는다.

## 출력

`outputs/<오늘날짜>/dev-handoff.md`

필수 섹션:

- Source
- Feature
- Problem
- Scope
- Acceptance Criteria
- Implementation Notes
- Suggested Bot Trigger

## 적용

승인 후에만 `gh issue create` 를 사용한다.

권장 명령:

```bash
gh issue create \
  --repo <target-repo> \
  --title "<feature title>" \
  --body-file outputs/<오늘날짜>/dev-handoff.md \
  --label "from-planning,claude-ready"
```

대상 repo가 `templates/github-actions/claude-dev-bot.yml` 를 설치했다면, 사람은 생성된 이슈에 아래처럼 댓글을 달아 개발 PR 생성을 시작한다:

```text
@claude implement this issue, add or update tests, and open a PR. Follow CLAUDE.md and do not deploy or merge.
```

## 가드레일

- 회의록 raw 원문을 이슈 본문에 넣지 않는다.
- 승인 없는 `gh issue create`, 라벨 변경, Project 변경을 하지 않는다.
- 개발 repo에서 직접 구현하지 않는다. 이 스킬은 핸드오프 이슈까지만 만든다.
- 봇은 branch/PR까지만 만들고, merge/deploy는 사람이 담당한다.
- 대상 repo가 명확하지 않으면 멈추고 확인한다.
