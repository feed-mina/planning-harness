# app/ — 회의록 메이커 Cloudflare 앱 (Epic #3, M1)

회의록 메이커를 **Cloudflare Workers(Static Assets) + D1 + R2** 위에 올린 멀티페이지 앱.
LLM 키는 **서버 secret**에 두고, 사용자는 provider만 선택한다. (기존 `docs/` 정적 버전을 대체 예정)

## 구성
```
app/
├── wrangler.jsonc         # 바인딩(Assets/D1/R2) + vars
├── migrations/0001_init.sql
├── src/
│   ├── index.ts           # 라우터 (/api/* 만 Worker, 나머지 정적)
│   ├── ai.ts              # 멀티 provider 프록시 (claude/openai/gemini) + 토큰 usage
│   ├── usage.ts           # 토큰→원 환산, D1 기록, 일 한도(500원)
│   └── jwt.ts             # 서명 쿠키(JWT) 세션
└── public/                # 정적 멀티페이지
    ├── index.html         # 대시보드
    ├── feature/           # 회의록 만들기 (키 UI 없음, provider 선택)
    ├── stats/             # 사용량 통계
    ├── mypage/            # 마이페이지 (로그인 게이트)
    └── assets/            # styles.css, common.js, feature.js
```

## API
| 라우트 | 설명 |
|---|---|
| `POST /api/ai/summarize` | `{transcript,date,time,attendees,subject}` → 회의록 Markdown + usage + 비용. **provider/model/프롬프트는 서버(사용자 설정)에서 결정, 기본 Gemini.** 일 한도 초과 시 429 |
| `GET /api/settings` | 현재 provider·model·custom_prompt(+기본 프롬프트 템플릿) |
| `PUT /api/settings` | provider·model·custom_prompt 저장 (**로그인 필요**) |
| `GET /api/usage` | 오늘 사용 비용/한도/잔여 |
| `GET /api/usage/series?days=14` | 일자별 비용/토큰 + provider별 비용 (통계 차트) |
| `GET /api/me` | 세션(로그인 여부) |
| `GET /api/auth/github` · `/callback` · `/logout` | GitHub OAuth 로그인/콜백/로그아웃 |
| `GET /api/health` | 헬스체크 |

### AI provider·모델·프롬프트
- **선택은 마이페이지에서만.** 기능 페이지는 서버 설정을 따르고, 안 바꾸면 **Gemini(gemini-2.5-pro)**.
- **커스텀 프롬프트**: 마이페이지에서 편집. 플레이스홀더 `{{date}} {{time}} {{subject}} {{attendees}} {{transcript}}`.
  기본 템플릿은 `src/ai.ts` 의 `DEFAULT_PROMPT_TEMPLATE`. 비우고 저장하면 기본으로 복귀.

### GitHub OAuth 설정 (마이페이지 로그인)
1. GitHub → Settings → Developer settings → **OAuth Apps → New**.
   - Homepage: `<APP_BASE_URL>`  ·  **Authorization callback URL: `<APP_BASE_URL>/api/auth/callback`**
2. `wrangler.jsonc` 의 `vars.GITHUB_OAUTH_CLIENT_ID` 와 `vars.APP_BASE_URL` 채우기.
3. `wrangler secret put GITHUB_OAUTH_CLIENT_SECRET`, `wrangler secret put JWT_SECRET`.

## 배포 준비물 — 어디서 받나
| 항목 | 발급처 | 비고 |
|---|---|---|
| Cloudflare 계정 + Wrangler | https://dash.cloudflare.com (가입) → `npx wrangler login` | 무료 플랜 가능 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → **API Keys** | Claude |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | codex(OpenAI) |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey (Google AI Studio) | Gemini · 무료 티어 있음 |
| `JWT_SECRET` | 직접 생성: `openssl rand -base64 32` | 세션 서명용 랜덤값 |
| GitHub OAuth (CLIENT_ID/SECRET) | https://github.com/settings/developers → **New OAuth App** | 콜백 `<APP_BASE_URL>/api/auth/callback` |

> 키가 없는 provider는 그 provider만 실패하고 나머지는 동작. Gemini만 있어도 기본 사용 가능.

## 배포 (최초 1회)
```bash
cd app
npm install

# 1) D1 생성 → 출력된 database_id 를 wrangler.jsonc 에 반영
npx wrangler d1 create harness-meeting-db
npx wrangler d1 migrations apply harness-meeting-db --remote

# 2) R2 버킷
npx wrangler r2 bucket create harness-meetings

# 3) Secrets (provider 키 + 세션 + OAuth)
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put JWT_SECRET               # 임의 긴 랜덤 문자열
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET   # (M2)

# 4) 배포
npx wrangler deploy
```
로컬 개발: `npx wrangler dev` (로컬 D1은 `--local` 마이그레이션 필요).

## 비용/쿼터
- `vars.DAILY_LIMIT_KRW`(기본 500) — 사용자/일 한도. 초과 시 `/api/ai/summarize` 가 429.
- 단가표는 `src/usage.ts` 의 `PRICE_KRW_PER_1M` — **실제 공시 단가로 조정**(현재는 근사치).

## 마일스톤 (Epic #3)
- **M1 (현재)**: 프록시 + 기능 페이지(#2 흡수) + D1 사용량/쿼터 ✅ 스캐폴드
- M2: GitHub OAuth + 마이페이지 게이트  ·  M3: R2 회의록 저장/이력
- M4: 통계 차트(경량 라이브러리)  ·  M5: git 연동(repo/project/assignee 선택)

## 알려진 미완 (M1 스캐폴드)
- `/api/auth/github`(OAuth) 미구현 → 현재는 익명 쿠키(`aid`)로 사용량 집계.
- 오디오 파일 STT 프록시 미구현(자막·실시간 녹음은 동작).
- 단가표·모델 목록은 배포 시점 기준으로 확인/조정 필요.
