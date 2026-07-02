// M5 git 연동 — 회의록 → GitHub 이슈/Project(V2). 토큰은 users.gh_token(암호화)에서 복호화.
import type { Env } from "./index";
import { decryptToken } from "./crypto";

const GH = "https://api.github.com";
const ghHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  accept: "application/vnd.github+json",
  "user-agent": "harness-meeting-app",
});

// 저장된 OAuth 토큰 복호화. 없으면 null(재로그인 필요).
export async function getUserToken(env: Env, userId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT gh_token FROM users WHERE id=?")
    .bind(userId).first<{ gh_token?: string }>();
  if (!row?.gh_token) return null;
  return decryptToken(row.gh_token, env.JWT_SECRET);
}

// 이슈를 만들 수 있는(push 권한) repo 목록.
export async function listRepos(token: string) {
  const res = await fetch(
    `${GH}/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`,
    { headers: ghHeaders(token) }
  );
  if (!res.ok) throw new Error(`repos ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any[];
  return data
    .filter((r) => r.permissions?.push)
    .map((r) => ({ full_name: r.full_name, private: !!r.private }));
}

// repo 담당(assignee) 후보.
export async function listAssignees(token: string, owner: string, repo: string) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/assignees?per_page=100`, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`assignees ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any[];
  return data.map((u) => ({ login: u.login, avatar_url: u.avatar_url }));
}

// 로그인 사용자가 소유한 Projects V2.
export async function listProjects(token: string) {
  const query = `query { viewer { projectsV2(first: 50) { nodes { id title number } } } }`;
  const res = await fetch(`${GH}/graphql`, {
    method: "POST",
    headers: { ...ghHeaders(token), "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`projects ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  if (data.errors) throw new Error(`projects: ${data.errors[0]?.message}`);
  return (data.data?.viewer?.projectsV2?.nodes || []).map((p: any) => ({ id: p.id, title: p.title, number: p.number }));
}

export async function createIssue(
  token: string, owner: string, repo: string, title: string, body: string, assignees?: string[]
) {
  const res = await fetch(`${GH}/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { ...ghHeaders(token), "content-type": "application/json" },
    body: JSON.stringify({ title, body, assignees: assignees?.length ? assignees : undefined }),
  });
  if (!res.ok) throw new Error(`issue ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  return { number: data.number as number, url: data.html_url as string, node_id: data.node_id as string };
}

// 생성한 이슈를 Project V2 에 카드로 추가.
export async function addToProject(token: string, projectId: string, contentId: string): Promise<void> {
  const query = `mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item { id } } }`;
  const res = await fetch(`${GH}/graphql`, {
    method: "POST",
    headers: { ...ghHeaders(token), "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { p: projectId, c: contentId } }),
  });
  if (!res.ok) throw new Error(`addToProject ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as any;
  if (data.errors) throw new Error(`addToProject: ${data.errors[0]?.message}`);
}

export interface ActionItem { title: string; assignee?: string; due?: string; priority?: string; raw: string; }

// 회의록 Markdown 의 "## 할 일 (Action Items)" 섹션을 파싱.
// 라인 형식: - [ ] <할 일> — @담당자 ~YYYY-MM-DD [priority:High|Medium|Low]
export function parseActionItems(markdown: string): ActionItem[] {
  const lines = markdown.split(/\r?\n/);
  const items: ActionItem[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^#{1,6}\s+.*할\s*일/.test(line)) { inSection = true; continue; }
    if (inSection && /^#{1,6}\s+/.test(line)) break; // 다음 헤더에서 종료
    if (!inSection) continue;
    const m = line.match(/^\s*[-*]\s*\[[ xX]?\]\s*(.+?)\s*$/);
    if (!m) continue;
    const raw = m[1].trim();
    if (!raw || /^<.*>$/.test(raw)) continue; // 빈 자리표시자(<할 일>) 스킵
    const assignee = (raw.match(/@([\w-]+)/) || [])[1];
    const due = (raw.match(/~(\d{4}-\d{2}-\d{2})/) || [])[1];
    const priority = (raw.match(/\[priority:\s*(High|Medium|Low)\]/i) || [])[1];
    const title = raw.split(/\s+—\s+/)[0].replace(/\s+/g, " ").trim();
    if (title) items.push({ title, assignee, due, priority, raw });
  }
  return items;
}
