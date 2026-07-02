// 멀티 provider AI 프록시 — 회의 전사 → 회의록 Markdown. 키는 서버 secret.
// 프롬프트는 템플릿(플레이스홀더)로, 마이페이지 커스텀 프롬프트를 그대로 적용.
import type { Env } from "./index";

export interface MeetingMeta {
  transcript: string;
  date: string;
  time?: string;
  attendees?: string;
  subject?: string;
}
export interface AISettings {
  provider: "claude" | "openai" | "gemini";
  model: string;
  promptTemplate?: string | null; // null 이면 DEFAULT_PROMPT_TEMPLATE
}
export interface SummarizeResult {
  markdown: string; provider: string; model: string; inputTokens: number; outputTokens: number;
}

// 마이페이지에서 편집 가능한 기본 프롬프트 템플릿.
// 플레이스홀더: {{date}} {{time}} {{subject}} {{attendees}} {{transcript}}
export const DEFAULT_PROMPT_TEMPLATE = `아래 회의 전사 텍스트를 한국어 회의록 Markdown 으로 정리해줘.
반드시 아래 형식/섹션을 그대로 지켜(설명·코드펜스 없이 Markdown 본문만 출력):

# {{date}} {{time}} 회의 — {{subject}}

## 참석자
{{attendees}}

## 안건
- (핵심 안건들)

## 결정사항 (Decisions)
- (합의/결정된 것)

## 요약
(3~5문장 요약)

## 할 일 (Action Items)
- [ ] <할 일> — @담당자 ~YYYY-MM-DD [priority:High|Medium|Low]

## 참고 / 링크
- (있으면)

규칙:
- 할 일은 반드시 위 라인 형식(" — ", @담당자, ~마감일, [priority:...])을 지켜라. 불명확하면 @담당자 / ~{{date}}.
- 전사에 없는 내용을 지어내지 마라.

[전사 텍스트]
{{transcript}}`;

function attendeesBlock(attendees?: string): string {
  const raw = (attendees || "").trim();
  if (!raw) return "- @담당자1";
  return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
    .map((s) => "- " + (s.startsWith("@") ? s : "@" + s)).join("\n");
}

// 템플릿 렌더 — 플레이스홀더 치환 + 빈 값으로 생긴 잔여물(중복 공백, 라인 끝 " — ") 정리.
export function renderPrompt(template: string, meta: MeetingMeta): string {
  const map: Record<string, string> = {
    date: meta.date || "",
    time: meta.time || "",
    subject: meta.subject || "",
    attendees: attendeesBlock(meta.attendees),
    transcript: meta.transcript || "",
  };
  let out = template.replace(/\{\{\s*(date|time|subject|attendees|transcript)\s*\}\}/g, (_, k) => map[k]);
  // 커스텀 프롬프트에 {{transcript}} 가 없으면 전사를 끝에 붙인다.
  if (!/\{\{\s*transcript\s*\}\}/.test(template) && !out.includes(meta.transcript) && meta.transcript) {
    out += `\n\n[전사 텍스트]\n${meta.transcript}`;
  }
  // 헤더 등에서 빈 time/subject 로 생긴 잔여물 정리
  out = out.replace(/[ \t]{2,}/g, " ").replace(/ — (?=\n|$)/g, "").replace(/—[ \t]*(?=\n|$)/g, "");
  return out;
}

async function callClaude(env: Env, model: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  return { text: (data.content || []).map((b: any) => b.text || "").join("").trim(),
    inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0 };
}
async function callOpenAI(env: Env, model: string, prompt: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  return { text: (data.choices?.[0]?.message?.content || "").trim(),
    inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 };
}
async function callGemini(env: Env, model: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data: any = await res.json();
  return { text: (data.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("").trim(),
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0 };
}

export async function summarize(env: Env, meta: MeetingMeta, settings: AISettings): Promise<SummarizeResult> {
  const prompt = renderPrompt(settings.promptTemplate || DEFAULT_PROMPT_TEMPLATE, meta);
  let out: { text: string; inputTokens: number; outputTokens: number };
  switch (settings.provider) {
    case "claude": out = await callClaude(env, settings.model, prompt); break;
    case "openai": out = await callOpenAI(env, settings.model, prompt); break;
    case "gemini": out = await callGemini(env, settings.model, prompt); break;
    default: throw new Error("알 수 없는 provider: " + settings.provider);
  }
  if (!out.text) throw new Error("빈 응답");
  return { markdown: out.text, provider: settings.provider, model: settings.model,
    inputTokens: out.inputTokens, outputTokens: out.outputTokens };
}
