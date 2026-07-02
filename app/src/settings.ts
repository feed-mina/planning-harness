// 사용자 설정(provider/model/커스텀 프롬프트). 마이페이지에서 저장, summarize 가 적용.
import type { Env } from "./index";
import { DEFAULT_PROMPT_TEMPLATE, type AISettings } from "./ai";

// 기본값 — 마이페이지에서 바꾸지 않는 이상 Gemini.
export const DEFAULTS = { provider: "gemini" as const, model: "gemini-2.5-pro" };

const VALID_PROVIDERS = ["gemini", "claude", "openai"];

export function isLoggedIn(userId: string): boolean {
  return !userId.startsWith("anon:");
}

// summarize 에 쓸 유효 설정 — 로그인 사용자는 저장값, 아니면 기본(gemini).
export async function getEffectiveSettings(env: Env, userId: string): Promise<AISettings> {
  if (isLoggedIn(userId)) {
    const row = await env.DB.prepare(
      "SELECT default_provider, default_model, custom_prompt FROM settings WHERE user_id=?"
    ).bind(userId).first<{ default_provider?: string; default_model?: string; custom_prompt?: string }>();
    if (row) {
      const provider = (VALID_PROVIDERS.includes(row.default_provider || "") ? row.default_provider : DEFAULTS.provider) as AISettings["provider"];
      return { provider, model: row.default_model || DEFAULTS.model, promptTemplate: row.custom_prompt || null };
    }
  }
  return { provider: DEFAULTS.provider, model: DEFAULTS.model, promptTemplate: null };
}

// 마이페이지 표시용 — 유효 설정 + 기본 프롬프트 템플릿(편집 출발점).
export async function settingsForApi(env: Env, userId: string) {
  const eff = await getEffectiveSettings(env, userId);
  return {
    loggedIn: isLoggedIn(userId),
    provider: eff.provider,
    model: eff.model,
    custom_prompt: eff.promptTemplate,          // null 이면 기본 사용 중
    default_prompt: DEFAULT_PROMPT_TEMPLATE,     // 편집 출발점
  };
}

// 마이페이지 "기본 git 대상" 표시용.
export async function gitDefaultsForApi(env: Env, userId: string) {
  if (!isLoggedIn(userId)) return { default_repo: null, default_project_id: null, default_project_title: null };
  const row = await env.DB.prepare(
    "SELECT default_repo, default_project_id, default_project_title FROM settings WHERE user_id=?"
  ).bind(userId).first<{ default_repo?: string; default_project_id?: string; default_project_title?: string }>();
  return {
    default_repo: row?.default_repo || null,
    default_project_id: row?.default_project_id || null,
    default_project_title: row?.default_project_title || null,
  };
}

// git 컬럼만 갱신(AI 설정 컬럼은 건드리지 않음).
export async function saveGitDefaults(
  env: Env, userId: string,
  body: { default_repo?: string | null; default_project_id?: string | null; default_project_title?: string | null }
): Promise<void> {
  const repo = body.default_repo && /^[\w.-]+\/[\w.-]+$/.test(body.default_repo) ? body.default_repo : null;
  const projId = body.default_project_id ? String(body.default_project_id).slice(0, 100) : null;
  const projTitle = body.default_project_title ? String(body.default_project_title).slice(0, 200) : null;
  await env.DB.prepare(
    `INSERT INTO settings (user_id, default_repo, default_project_id, default_project_title, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       default_repo=excluded.default_repo,
       default_project_id=excluded.default_project_id,
       default_project_title=excluded.default_project_title,
       updated_at=excluded.updated_at`
  ).bind(userId, repo, projId, projTitle, new Date().toISOString()).run();
}

export async function saveSettings(
  env: Env, userId: string,
  body: { provider?: string; model?: string; custom_prompt?: string | null }
): Promise<void> {
  const provider = VALID_PROVIDERS.includes(body.provider || "") ? body.provider! : DEFAULTS.provider;
  const model = (body.model || DEFAULTS.model).slice(0, 100);
  // 커스텀 프롬프트: 빈 문자열/공백이면 null(기본으로 복귀)
  const cp = body.custom_prompt && body.custom_prompt.trim() ? body.custom_prompt.slice(0, 8000) : null;
  await env.DB.prepare(
    `INSERT INTO settings (user_id, default_provider, default_model, custom_prompt, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       default_provider=excluded.default_provider,
       default_model=excluded.default_model,
       custom_prompt=excluded.custom_prompt,
       updated_at=excluded.updated_at`
  ).bind(userId, provider, model, cp, new Date().toISOString()).run();
}
