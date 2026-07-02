// 마이페이지 — 로그인 게이트 + AI 설정(provider/model/커스텀 프롬프트) 편집·저장.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const MODELS = {
    gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
    claude: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
    openai: ["gpt-5", "gpt-5-mini"],
  };
  let defaultPrompt = "";

  function fillModels(provider, selected) {
    const sel = $("model");
    sel.innerHTML = (MODELS[provider] || []).map((m) => `<option value="${m}">${m}</option>`).join("");
    if (selected) {
      if (!MODELS[provider].includes(selected)) sel.insertAdjacentHTML("afterbegin", `<option value="${selected}">${selected}</option>`);
      sel.value = selected;
    }
  }

  fetch("/api/me").then((r) => r.json()).then((me) => {
    $(me.loggedIn ? "member" : "guest").hidden = false;
    if (!me.loggedIn) return;
    $("login").textContent = "@" + (me.login || "me");
    return fetch("/api/settings").then((r) => r.json()).then((s) => {
      defaultPrompt = s.default_prompt || "";
      $("provider").value = s.provider || "gemini";
      fillModels($("provider").value, s.model);
      $("prompt").value = s.custom_prompt || defaultPrompt;  // 커스텀 없으면 기본 템플릿을 편집 출발점으로
      $("provider").addEventListener("change", () => fillModels($("provider").value));
      $("btnResetPrompt").addEventListener("click", () => { $("prompt").value = defaultPrompt; });
      $("btnSaveSettings").addEventListener("click", save);
    });
  }).catch(() => { $("guest").hidden = false; });

  async function save() {
    const status = $("saveStatus");
    status.textContent = "저장 중…"; status.classList.remove("danger");
    const prompt = $("prompt").value.trim();
    const body = {
      provider: $("provider").value,
      model: $("model").value,
      // 기본 템플릿과 동일하면 커스텀 저장 안 함(null → 기본 사용)
      custom_prompt: prompt && prompt !== defaultPrompt.trim() ? prompt : null,
    };
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      status.textContent = `✅ 저장됨 (${data.provider}/${data.model}${data.custom_prompt ? ", 커스텀 프롬프트" : ", 기본 프롬프트"})`;
    } catch (err) {
      status.textContent = "❌ " + err.message; status.classList.add("danger");
    }
  }
})();
