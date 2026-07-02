// 토큰 사용량 → 원(KRW) 환산, D1 기록, 일 한도 체크.
import type { Env } from "./index";

// 1M 토큰당 원(KRW) 근사 단가. ⚠️ 실제 공시 단가로 조정하세요(요금은 수시 변동).
// { provider: { model: { in, out } } }. 모델 미매칭 시 provider 의 "_default" 사용.
const PRICE_KRW_PER_1M: Record<string, Record<string, { in: number; out: number }>> = {
  claude: {
    "claude-sonnet-4-6": { in: 4200, out: 21000 },
    "claude-opus-4-8": { in: 21000, out: 105000 },
    "claude-haiku-4-5-20251001": { in: 1400, out: 7000 },
    _default: { in: 4200, out: 21000 },
  },
  openai: {
    "gpt-5": { in: 4200, out: 21000 },
    "gpt-5-mini": { in: 700, out: 2800 },
    _default: { in: 4200, out: 21000 },
  },
  gemini: {
    "gemini-2.5-pro": { in: 3500, out: 14000 },
    "gemini-2.5-flash": { in: 500, out: 2000 },
    _default: { in: 3500, out: 14000 },
  },
};

export function computeCostKRW(provider: string, model: string, inTok: number, outTok: number): number {
  const p = PRICE_KRW_PER_1M[provider] || {};
  const rate = p[model] || p._default || { in: 0, out: 0 };
  return (inTok * rate.in + outTok * rate.out) / 1_000_000;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getDailyCost(env: Env, userId: string, day: string): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COALESCE(SUM(cost_krw),0) AS total FROM usage_events WHERE user_id=? AND day=?"
  ).bind(userId, day).first<{ total: number }>();
  return row?.total ?? 0;
}

export interface QuotaState { allowed: boolean; used: number; limit: number; }

export async function checkQuota(env: Env, userId: string): Promise<QuotaState> {
  const limit = Number(env.DAILY_LIMIT_KRW || "500");
  const used = await getDailyCost(env, userId, today());
  return { allowed: used < limit, used, limit };
}

// 최근 N일 사용량 시계열 — 일자별 비용/토큰 + provider별 비용 (통계 차트용).
export async function getSeries(env: Env, userId: string, days = 14) {
  const dayList: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayList.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const since = dayList[0];
  const { results } = await env.DB.prepare(
    `SELECT day, provider, SUM(cost_krw) AS cost, SUM(input_tokens + output_tokens) AS tokens
     FROM usage_events WHERE user_id=? AND day>=? GROUP BY day, provider ORDER BY day`
  ).bind(userId, since).all<{ day: string; provider: string; cost: number; tokens: number }>();

  const byDay: Record<string, { cost: number; tokens: number }> = {};
  for (const d of dayList) byDay[d] = { cost: 0, tokens: 0 };
  const byProvider: Record<string, number> = {};
  for (const r of results || []) {
    if (byDay[r.day]) { byDay[r.day].cost += r.cost; byDay[r.day].tokens += r.tokens; }
    byProvider[r.provider] = (byProvider[r.provider] || 0) + r.cost;
  }
  return {
    days: dayList.map((d) => ({ day: d, cost: byDay[d].cost, tokens: byDay[d].tokens })),
    providers: Object.entries(byProvider).map(([provider, cost]) => ({ provider, cost })),
  };
}

export async function logUsage(
  env: Env, userId: string, provider: string, model: string, inTok: number, outTok: number
): Promise<number> {
  const cost = computeCostKRW(provider, model, inTok, outTok);
  await env.DB.prepare(
    `INSERT INTO usage_events (user_id, day, provider, model, input_tokens, output_tokens, cost_krw, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(userId, today(), provider, model, inTok, outTok, cost, new Date().toISOString()).run();
  return cost;
}
