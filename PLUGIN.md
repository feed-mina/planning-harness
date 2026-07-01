# 기획 하네스 — 공통 모듈(플러그인) 설치 가이드

planning-harness 를 **Claude Code 플러그인**으로 다른 개발 프로젝트에 설치해, 8개 기획/핸드오프 스킬과
회의록→GitHub 동기화 엔진, 개발 repo `@claude` 봇 템플릿을 그대로 가져다 쓴다. 이 저장소 자체가 **마켓플레이스 + 플러그인**이다.

---

## 구성
```
.claude-plugin/
├── plugin.json        ← 플러그인 매니페스트 (commands = ./.claude/commands 재사용)
└── marketplace.json   ← 이 repo 를 마켓플레이스로 노출 (plugin source ".")
.claude/commands/      ← 8개 스킬 (플러그인 커맨드 본체)
scripts/               ← 동기화 엔진 (${CLAUDE_PLUGIN_ROOT}/scripts 로 참조)
templates/             ← spec/회의록/프로젝트설정 템플릿
docs/                  ← 웹 회의록 메이커(GitHub Pages) + 원격·개발 봇 운영 설계
```

## 설치 (다른 프로젝트에서)
```bash
# 1) 마켓플레이스 추가 (GitHub repo)
claude plugin marketplace add feed-mina/planning-harness

# 2) 플러그인 설치
claude plugin install planning-harness@feed-mina-harness

# (로컬 경로로 개발 설치도 가능)
claude plugin marketplace add /path/to/planning-harness
```
설치하면 `/search-documents` … `/dev-handoff` 8개 스킬이 어느 프로젝트에서든 뜬다.
(UI 에는 `planning-harness:git-project-sync` 처럼 네임스페이스로 표시될 수 있다.)

## 프로젝트별 설정 (핵심)
플러그인 본체는 건드리지 않는다. **대상 프로젝트 루트에 `.harness/config.env`** 를 만든다:
```bash
mkdir -p .harness
# 플러그인의 템플릿을 복사해 값 채우기
HARNESS_PLUGIN_ROOT="$HOME/.claude/plugins/marketplaces/feed-mina-harness"
cp "$HARNESS_PLUGIN_ROOT/templates/harness.config.env" .harness/config.env
$EDITOR .harness/config.env     # OWNER / PROJECT_NUMBER / REPO …
```
설정 우선순위: **환경변수 > 프로젝트 `.harness/config.env` > 플러그인 기본 `scripts/config.env`**.
(환경변수 override 예: `OWNER=acme PROJECT_NUMBER=7 /git-project-sync 2026-07-01`)

## 사용
```bash
gh auth login && gh auth refresh -s project,read:project   # 최초 1회
/git-project-sync 2026-07-01     # 회의록 → 이슈/Project (dry-run → 승인 → --yes)
/dev-handoff owner/dev-repo "승인된 기능"  # 기획 산출물 → 개발 repo 이슈/@claude PR 트리거
```
스킬 산출물은 그 프로젝트의 `outputs/<날짜>/` 에 쌓인다. `spec.md` 가 없으면
`templates/spec_template.md` 를 복사해 SSOT 로 채운다.

## 개발 repo 봇 템플릿
개발 프로젝트가 모바일/원격 `@claude` 트리거를 받게 하려면 아래 템플릿을 복사한다:

```bash
mkdir -p .github/workflows
HARNESS_PLUGIN_ROOT="$HOME/.claude/plugins/marketplaces/feed-mina-harness"
cp "$HARNESS_PLUGIN_ROOT/templates/github-actions/claude-dev-bot.yml" .github/workflows/claude-dev-bot.yml
cp "$HARNESS_PLUGIN_ROOT/templates/dev-repo/CLAUDE.md" CLAUDE.md
```

그 뒤 repo secret 에 `ANTHROPIC_API_KEY` 또는 `CLAUDE_CODE_OAUTH_TOKEN` 을 설정한다. 전체 운영 설계는
[docs/remote-dev-platform.md](docs/remote-dev-platform.md) 를 따른다.

## 검증/업데이트
```bash
claude plugin validate .claude-plugin/plugin.json  # 플러그인 manifest 검증
claude plugin validate .                 # 마켓플레이스 manifest 검증
claude plugin marketplace update         # 마켓플레이스 갱신
```

## 설계 메모
- `commands` 매니페스트 키가 `./.claude/commands/` 를 가리켜 **로컬 dogfooding 과 플러그인 배포가 한 소스**를 공유(중복 없음).
- 스크립트는 `${CLAUDE_PLUGIN_ROOT}/scripts` 로 자기 위치를 찾고, 설정만 프로젝트별로 분리.
- 모든 쓰기는 dry-run→승인→`--yes`. 회의록 원문 비노출. → [CLAUDE.md](CLAUDE.md) 가드레일.
