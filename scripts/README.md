# scripts/ — git-project-sync 엔진

`/git-project-sync` 스킬이 호출하는 실행 엔진. **gh CLI 기본 + Python 보조** 두 경로.
KIBA `project_management_with_ai_agent` 의 gh 패턴을 이식·일반화했다.

## 설정
[config.env](config.env) 하나만 바꾸면 어느 프로젝트에서도 동작한다 (공통 모듈화의 핵심):
```
OWNER, PROJECT_NUMBER, REPO, PROJECT_TITLE, DEFAULT_LABELS
```

## 공통 원칙
- **dry-run 기본** — 모든 쓰기 스크립트는 제안만 출력. `--yes` 를 붙여야 실제 반영.
- **멱등 / 중복 방지** — 같은 제목 이슈가 있으면 건너뜀.
- **노드 ID 하드코딩 금지** — Project/필드/옵션 ID 는 이름에서 런타임 해석([lib.sh](lib.sh)).
- **회의록 원문 비노출** — 이슈 본문에 요약 항목만, raw 트랜스크립트는 절대 안 올림.

## 파일
| 파일 | 역할 |
|---|---|
| `config.env` | 대상 owner/project/repo 설정 |
| `lib.sh` | 공통 헬퍼 (`project_id`/`field_id`/`option_id`/`item_id`/`set_field`) |
| `board.sh` | 현재 보드 출력 (Status/Priority) |
| `reconcile.sh` | 한 항목의 Status/Priority 변경 (제안→승인→적용) |
| `parse_actions.py` | 회의록 `## 할 일` 파싱 (gh·Python 경로 공유) |
| `create_issues.sh` | (gh 경로) 회의록 → Issues + Project 추가 |
| `github_sync.py` | (Python 보조) gh 없는 환경용, stdlib REST/GraphQL |

## 사용법 (gh 경로 — 권장)
```bash
gh auth login && gh auth refresh -s project,read:project   # 최초 1회

bash scripts/board.sh                                       # 현재 보드 보기
bash scripts/create_issues.sh 2026-06-30                    # dry-run 제안
bash scripts/create_issues.sh 2026-06-30 --yes             # 승인 후 적용
bash scripts/reconcile.sh "결제 검증" --status "In Progress" --yes
```

## 사용법 (Python 보조 — gh 불가 환경)
```bash
export GITHUB_TOKEN=ghp_xxx          # repo + project 스코프
python scripts/github_sync.py 2026-06-30          # dry-run
python scripts/github_sync.py 2026-06-30 --yes    # 적용
```

## 회의록 할 일 형식
```
## 할 일
- [ ] <할 일> — @담당자 ~YYYY-MM-DD [priority:High|Medium|Low]
```
`@담당자`·`~마감`·`[priority:…]` 는 모두 선택. `- [x]` (완료)는 기본 제외.
