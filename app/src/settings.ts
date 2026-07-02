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
