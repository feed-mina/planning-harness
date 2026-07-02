// 기획 하네스 회의록 앱 — Cloudflare Worker 진입점.
// /api/* 만 이 Worker 가 처리(run_worker_first), 나머지는 Static Assets.
import { summarize, type MeetingMeta } from "./ai";
import { checkQuota, logUsage, getDailyCost, getSeries, today } from "./usage";
import { getEffectiveSettings, settingsForApi, saveSettings, isLoggedIn } from "./settings";
import { startGithubLogin, handleGithubCallback, logout } from "./auth";
import { verifyJWT, parseCookies } from "./jwt";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  R2: R2Bucket;
  DAILY_LIMIT_KRW: string;
  GITHUB_OAUTH_CLIENT_ID: string;
  APP_BASE_URL: string;
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  JWT_SECRET: string;
}

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), { ...init, headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) } });

async function identify(request: Request, env: Env): Promise<{ userId: string; setCookie?: string; login?: string }> {
  const cookies = parseCookies(request.headers.get("cookie"));
  if (cookies.sid && env.JWT_SECRET) {
    const p = await verifyJWT(cookies.sid, env.JWT_SECRET);
    if (p?.sub) return { userId: String(p.sub), login: p.login };
  }
  if (cookies.aid) return { userId: `anon:${cookies.aid}` };
  const aid = crypto.randomUUID();
  return { userId: `anon:${aid}`, setCookie: `aid=${aid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000` };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);

    // 인증(리다이렉트 응답)
    if (path === "/api/auth/github") return startGithubLogin(request, env);
    if (path === "/api/auth/callback") return handleGithubCallback(request, env);
    if (path === "/api/auth/logout") return logout();

    try {
      if (path === "/api/health") return json({ ok: true, time: new Date().toISOString() });

      const { userId, setCookie, login } = await identify(request, env);
      const withCookie = (r: Response) => { if (setCookie) r.headers.append("set-cookie", setCookie); return r; };

      if (path === "/api/me" && request.method === "GET")
        return withCookie(json({ userId, login: login ?? null, loggedIn: isLoggedIn(userId) }));

      if (path === "/api/usage" && request.method === "GET") {
        const used = await getDailyCost(env, userId, today());
        const limit = Number(env.DAILY_LIMIT_KRW || "500");
        return withCookie(json({ day: today(), used_krw: used, limit_krw: limit, remaining_krw: Math.max(0, limit - used) }));
      }

      if (path === "/api/usage/series" && request.method === "GET") {
        const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 14));
        return withCookie(json(await getSeries(env, userId, days)));
      }

      // 설정(provider/model/커스텀 프롬프트)
      if (path === "/api/settings" && request.method === "GET")
        return withCookie(json(await settingsForApi(env, userId)));
      if (path === "/api/settings" && request.method === "PUT") {
        if (!isLoggedIn(userId)) return withCookie(json({ error: "로그인이 필요합니다." }, { status: 401 }));
        const body = (await request.json()) as any;
        await saveSettings(env, userId, body);
        return withCookie(json(await settingsForApi(env, userId)));
      }

      // AI 요약 — provider/model/프롬프트는 서버(사용자 설정)에서 결정. 기본 gemini.
      if (path === "/api/ai/summarize" && request.method === "POST") {
        const body = (await request.json()) as Partial<MeetingMeta>;
        if (!body.transcript?.trim()) return withCookie(json({ error: "전사 텍스트가 비어 있습니다." }, { status: 400 }));
        if (!body.date) return withCookie(json({ error: "회의 날짜는 필수입니다." }, { status: 400 }));

        const q = await checkQuota(env, userId);
        if (!q.allowed)
          return withCookie(json({ error: `오늘 사용 한도(${q.limit}원)를 초과했습니다.`, used_krw: q.used, limit_krw: q.limit }, { status: 429 }));

        const settings = await getEffectiveSettings(env, userId);
        const meta: MeetingMeta = {
          transcript: body.transcript, date: body.date, time: body.time, attendees: body.attendees, subject: body.subject,
        };
        const result = await summarize(env, meta, settings);
        const cost = await logUsage(env, userId, result.provider, result.model, result.inputTokens, result.outputTokens);
        return withCookie(json({
          markdown: result.markdown, provider: result.provider, model: result.model,
          usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
          cost_krw: cost, day_used_krw: q.used + cost, limit_krw: q.limit,
        }));
      }

      return json({ error: "not found" }, { status: 404 });
    } catch (err: any) {
      return json({ error: err?.message || "server error" }, { status: 500 });
    }
  },
};
