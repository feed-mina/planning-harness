# planning-harness (기획 하네스)

> 기획자가 명령어 한 줄로 상세기획 산출물을 자동 생성하고, 승인된 기획을 개발 repo 이슈/PR까지 넘기는 규칙·가드레일 기반 AI 기획 루프.
> **진실의 원천(SSOT)** 은 항상 [spec.md](spec.md) 이고, AI 운영 규칙은 [CLAUDE.md](CLAUDE.md) 다.

---

## 무엇인가
일회성 프롬프트가 아니라, **로컬에 고정된 8개 스킬 + 가드레일**로 AI가 일관된 논리로
기획 문서를 만들고 고치게 만든 "하네스(harness)". 산출물은 전부 `outputs/<날짜>/` 에 쌓이고,
위험한 작업(요구사항 분해·테스트 케이스·Git 반영·개발 핸드오프)은 **사람 승인 게이트**를 거친다.

## 설치

### 방법 A — 플러그인으로 설치 (다른 프로젝트에서, 권장)
이 저장소는 Claude Code **마켓플레이스 + 플러그인**이다. 어느 프로젝트에서든 설치해 8개 스킬을 쓴다.
```bash
# 1) 마켓플레이스 추가
claude plugin marketplace add feed-mina/planning-harness

# 2) 플러그인 설치
claude plugin install planning-harness@feed-mina-harness
```
설치하면 `/search-documents` … `/dev-handoff` 8개 스킬이 그 프로젝트에서 뜬다.

**프로젝트별 설정** (GitHub 동기화용): 대상 프로젝트 루트에 `.harness/config.env` 생성
```bash
mkdir -p .harness
HARNESS_PLUGIN_ROOT="$HOME/.claude/plugins/marketplaces/feed-mina-harness"
cp "$HARNESS_PLUGIN_ROOT/templates/harness.config.env" .harness/config.env
# OWNER / PROJECT_NUMBER / REPO 채우기  (우선순위: 환경변수 > .harness/config.env > 플러그인 기본)
```
> 전체 가이드: [PLUGIN.md](PLUGIN.md)

### 방법 B — 저장소를 직접 열기 (개발·dogfooding)
```bash
git clone https://github.com/feed-mina/planning-harness.git
cd planning-harness
# Claude Code(데스크톱 CLI/IDE) 또는 claude.ai 에서 이 폴더를 연다
```
그다음 spec.md 를 실제 기획 내용으로 채우고, 아래 슬래시 커맨드를 부른다.

## 8개 스킬 (`.claude/commands/`)
| 커맨드 | 하는 일 | 산출물 | 승인 |
|---|---|---|---|
| `/search-documents <주제>` | 근거 자료 검색 | `outputs/<날짜>/docs-found.md` | |
| `/split-requirements <기능>` | 요구사항 분해 + 의존성 | `requirements.md` | ⚠️ |
| `/sequence-diagram <로직>` | Mermaid 시퀀스 다이어그램 | `sequence.mermaid` | |
| `/user-flow <시나리오>` | Mermaid 사용자 플로우 | `user-flow.mermaid` | |
| `/logic-check <기능>` | 정상/예외/보안/성능 테스트 케이스 | `logic-check.md` | ⚠️ |
| `/release-note <버전>` | 변경사항 요약 | `release-note.md` | |
| `/git-project-sync <날짜>` | 회의록 할 일 → GitHub Issues + Project | `git-sync.json` | ⚠️ |
| `/dev-handoff <repo> <기능>` | 승인된 기획 → 개발 repo 이슈/@claude PR 트리거 | `dev-handoff.md` | ⚠️ |

⚠️ = 사람 승인 필요. 전형적 체인:
`/search-documents` → `/split-requirements` → `/sequence-diagram`·`/user-flow` → `/logic-check` → `/release-note` → `/git-project-sync` → `/dev-handoff`

## GitHub 연동
- **기본: [gh CLI](https://cli.github.com/)** — `gh auth login` 한 번이면 끝. `/git-project-sync` 가 이슈/Project 를 다룬다.
- **보조: Python REST** — gh 가 없는 환경(일부 CI 등)용. `scripts/` 의 Python 경로는 **Phase 2 산출물**(아래 로드맵).
- **개발 봇 연계** — 개발 repo 에 [templates/github-actions/claude-dev-bot.yml](templates/github-actions/claude-dev-bot.yml) 을 복사하면 모바일 GitHub 댓글 `@claude` 로 이슈를 PR로 넘길 수 있다.

## 회의록 → 추적 파이프라인
```
[웹] 녹음·자막 → 회의록 메이커(GitHub Pages) → YYYY-MM-DD_meeting.md 내려받기
      → meetings/summary/YYYY-MM-DD_meeting.md     (templates/meeting_template.md 포맷)
      → /git-project-sync YYYY-MM-DD  → Issues + Project (dry-run → 승인 → 적용)
      → /dev-handoff <dev-repo> <기능> → 개발 Issue → @claude → PR
```

### 🎙️ 웹 회의록 메이커 (GitHub Pages)
자막(.vtt/.srt/.txt) 파싱 · 브라우저 실시간 녹음(Web Speech) · Clova/외부 STT · Claude AI 요약으로
회의록 Markdown 을 만들어 내려받는다. 출력은 곧 `meetings/summary/` 포맷이라 그대로 `/git-project-sync` 로 연결.
- **URL**: https://feed-mina.github.io/planning-harness/ · 소스: [docs/](docs/README.md)
- 정적 페이지 — 서버 없음. Claude/Clova 는 **사용자 본인 키(브라우저 localStorage)** 로만 호출.
- 배포: `docs/**` 푸시 시 [.github/workflows/pages.yml](.github/workflows/pages.yml) (최초 1회 Settings→Pages→Source="GitHub Actions").

## 폴더 구조
```
planning-harness/
├── CLAUDE.md              ← AI 규칙서 (4대 구성요소 + 스킬 규약)
├── spec.md               ← 진실의 원천 (SSOT)
├── README.md / SETUP.md  ← 이 파일 / 설정 가이드
├── .claude/commands/     ← 8개 스킬 (구현됨)
├── docs/                 ← 웹 회의록 메이커(Pages) + 원격·개발 봇 운영 설계
├── templates/            ← 회의록/설정/개발 repo 템플릿
├── meetings/             ← raw(비공개) / summary
└── outputs/<날짜>/        ← 스킬 산출물
```

## 로드맵
- ✅ **Phase 0–1**: 문서 정리 + 핵심 7개 기획 스킬 구현
- ✅ **Phase 2**: `/git-project-sync` 엔진 — KIBA `lib.sh/board.sh/reconcile.sh` 이식 + Python 보조
- ✅ **Phase 3**: 공통 모듈화 — Claude Code **플러그인** 패키징 → [PLUGIN.md](PLUGIN.md)
- ✅ **Phase 4 스캐폴드**: 리모트·모바일 — GitHub Actions `@claude` 봇 템플릿 + PR 승인 게이트 → [docs/remote-dev-platform.md](docs/remote-dev-platform.md)
- ⬜ **Phase 5**: 다운스트림(quali-fit 형) 프로젝트 관통 테스트

> 다른 프로젝트에 설치: `claude plugin marketplace add feed-mina/planning-harness` → 자세한 건 [PLUGIN.md](PLUGIN.md)

초기 분석 스냅샷: [outputs/repo-analysis-and-plan.md](outputs/repo-analysis-and-plan.md) · 최신 원격/모바일 개발 연계 설계: [docs/remote-dev-platform.md](docs/remote-dev-platform.md)
