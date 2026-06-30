# planning-harness (기획 하네스)

> 기획자가 명령어 한 줄로 상세기획 산출물을 자동 생성하는, 규칙·가드레일이 박힌 AI 기획 루프.
> **진실의 원천(SSOT)** 은 항상 [spec.md](spec.md) 이고, AI 운영 규칙은 [CLAUDE.md](CLAUDE.md) 다.

---

## 무엇인가
일회성 프롬프트가 아니라, **로컬에 고정된 7개 스킬 + 가드레일**로 AI가 일관된 논리로
기획 문서를 만들고 고치게 만든 "하네스(harness)". 산출물은 전부 `outputs/<날짜>/` 에 쌓이고,
위험한 작업(요구사항 분해·테스트 케이스·Git 반영)은 **사람 승인 게이트**를 거친다.

## 빠른 시작
```bash
git clone https://github.com/feed-mina/planning-harness.git
cd planning-harness
# Claude Code(데스크톱 CLI/IDE) 또는 claude.ai 에서 이 폴더를 연다
```
그다음 spec.md 를 실제 기획 내용으로 채우고, 아래 슬래시 커맨드를 부른다.

## 7개 스킬 (`.claude/commands/`)
| 커맨드 | 하는 일 | 산출물 | 승인 |
|---|---|---|---|
| `/search-documents <주제>` | 근거 자료 검색 | `outputs/<날짜>/docs-found.md` | |
| `/split-requirements <기능>` | 요구사항 분해 + 의존성 | `requirements.md` | ⚠️ |
| `/sequence-diagram <로직>` | Mermaid 시퀀스 다이어그램 | `sequence.mermaid` | |
| `/user-flow <시나리오>` | Mermaid 사용자 플로우 | `user-flow.mermaid` | |
| `/logic-check <기능>` | 정상/예외/보안/성능 테스트 케이스 | `logic-check.md` | ⚠️ |
| `/release-note <버전>` | 변경사항 요약 | `release-note.md` | |
| `/git-project-sync <날짜>` | 회의록 할 일 → GitHub Issues + Project | `git-sync.json` | ⚠️ |

⚠️ = 사람 승인 필요. 전형적 체인:
`/search-documents` → `/split-requirements` → `/sequence-diagram`·`/user-flow` → `/logic-check` → `/release-note` → `/git-project-sync`

## GitHub 연동
- **기본: [gh CLI](https://cli.github.com/)** — `gh auth login` 한 번이면 끝. `/git-project-sync` 가 이슈/Project 를 다룬다.
- **보조: Python REST** — gh 가 없는 환경(일부 CI 등)용. `scripts/` 의 Python 경로는 **Phase 2 산출물**(아래 로드맵).

## 회의록 → 추적 파이프라인
```
녹음 → STT → meetings/raw/YYYY-MM-DD_meeting.txt  (git 추적 안 함)
      → meetings/summary/YYYY-MM-DD_meeting.md     (templates/meeting_template.md 기반)
      → /git-project-sync YYYY-MM-DD  → Issues + Project (dry-run → 승인 → 적용)
```

## 폴더 구조
```
planning-harness/
├── CLAUDE.md              ← AI 규칙서 (4대 구성요소 + 스킬 규약)
├── spec.md               ← 진실의 원천 (SSOT)
├── README.md / SETUP.md  ← 이 파일 / 설정 가이드
├── .claude/commands/     ← 7개 스킬 (구현됨)
├── templates/            ← meeting_template.md
├── meetings/             ← raw(비공개) / summary
└── outputs/<날짜>/        ← 스킬 산출물
```

## 로드맵
- ✅ **Phase 0–1**: 문서 정리 + 7개 스킬 구현
- ✅ **Phase 2**: `/git-project-sync` 엔진 — KIBA `lib.sh/board.sh/reconcile.sh` 이식 + Python 보조
- ✅ **Phase 3**: 공통 모듈화 — Claude Code **플러그인** 패키징 → [PLUGIN.md](PLUGIN.md)
- ⬜ **Phase 4**: 리모트·모바일 — GitHub Actions `@claude` 봇 + PR 승인 게이트
- ⬜ **Phase 5**: 다운스트림(quali-fit 형) 프로젝트 관통 테스트

> 다른 프로젝트에 설치: `claude plugin marketplace add feed-mina/planning-harness` → 자세한 건 [PLUGIN.md](PLUGIN.md)

자세한 분석·플랜: [outputs/repo-analysis-and-plan.md](outputs/repo-analysis-and-plan.md)
