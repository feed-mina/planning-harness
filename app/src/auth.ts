// GitHub OAuth (Authorization Code) — 마이페이지 로그인.
// 필요: var GITHUB_OAUTH_CLIENT_ID, secret GITHUB_OAUTH_CLIENT_SECRET, secret JWT_SECRET.
// GitHub OAuth App 콜백 URL: <APP_BASE_URL>/api/auth/callback
import type { Env } from "./index";
import { signJWT, sessionCookie, parseCookies } from "./jwt";
import { encryptToken } from "./crypto";

// 로그인/이슈 생성/Project 반영에 필요한 스코프.
const OAUTH_SCOPE = "read:user repo project";

const redirect = (loc: string, cookie?: string) => {
  const h = new Headers({ location: loc });
  if (cookie) h.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers: h });
};

export function startGithubLogin(request: Request, env: Env): Response {
  if (!env.GITHUB_OAUTH_CLIENT_ID) return new Response("GITHUB_OAUTH_CLIENT_ID 미설정", { status: 500 });
  const state = crypto.randomUUID();
  const redirectUri = `${env.APP_BASE_URL}/api/auth/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", OAUTH_SCOPE);
  url.searchParams.set("state", state);
  const stateCookie = `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
  return redirect(url.toString(), stateCookie);
}

export async function handleGithubCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(request.headers.get("cookie"));
  if (!code || !state || state !== cookies.oauth_state)
    return new Response("OAuth state 검증 실패", { status: 400 });

  // 1) code → access_token
  const tokRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${env.APP_BASE_URL}/api/auth/callback`,
    }),
  });
  const tok: any = await tokRes.json();
  if (!tok.access_token) return new Response("토큰 교환 실패", { status: 400 });

  // 2) 사용자 조회
  const userRes = await fetch("https://api.github.com/user", {
    headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/vnd.github+json", "user-agent": "harness-meeting-app" },
  });
  const gh: any = await userRes.json();
  if (!gh.id) return new Response("사용자 조회 실패", { status: 400 });

  const userId = `gh:${gh.id}`;
  // 액세스 토큰은 암호화 저장 — 이후 이슈/Project API 호출에 사용(M5).
  const encToken = env.JWT_SECRET ? await encryptToken(tok.access_token, env.JWT_SECRET) : null;
  const scope = typeof tok.scope === "string" ? tok.scope : OAUTH_SCOPE;
  await env.DB.prepare(
    `INSERT INTO users (id, github_login, github_id, gh_token, gh_scope, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET github_login=excluded.github_login, gh_token=excluded.gh_token, gh_scope=excluded.gh_scope`
  ).bind(userId, gh.login, gh.id, encToken, scope, new Date().toISOString()).run();

  // 3) 세션 발급
  const jwt = await signJWT({ sub: userId, login: gh.login }, env.JWT_SECRET);
  const clearState = "oauth_state=; Path=/; Max-Age=0";
  const h = new Headers({ location: "/mypage/" });
  h.append("set-cookie", sessionCookie(jwt));
  h.append("set-cookie", clearState);
  return new Response(null, { status: 302, headers: h });
}

export function logout(): Response {
  return redirect("/", "sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}
