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
      initGit();
    });
  }).catch(() => { $("guest").hidden = false; });

  // ---- 기본 git 대상(repo/Project) ----
  function fillSelect(sel, items, valueOf, labelOf, selectedVal) {
    const opts = ['<option value="">(선택 안 함)</option>']
      .concat(items.map((it) => `<option value="${valueOf(it)}">${labelOf(it)}</option>`));
    sel.innerHTML = opts.join("");
    if (selectedVal) sel.value = selectedVal;
  }

  async function initGit() {
    const gs = $("gitStatus");
    $("btnSaveGit").addEventListener("click", saveGit);
    $("btnReloadGit").addEventListener("click", () => loadGitLists(true));
    // 저장된 기본값 먼저 반영(목록 로딩 실패해도 값은 보이도록)
    let defaults = { default_repo: "", default_project_id: "", default_project_title: "" };
    try { defaults = await fetch("/api/git/defaults").then((r) => r.json()); } catch {}
    if (defaults.default_repo) $("gitRepo").innerHTML = `<option value="${defaults.default_repo}">${defaults.default_repo}</option>`;
    if (defaults.default_project_id) $("gitProject").innerHTML = `<option value="${defaults.default_project_id}">${defaults.default_project_title || defaults.default_project_id}</option>`;
    window.__gitDefaults = defaults;
    loadGitLists(false);

    async function loadGitLists(force) {
      gs.textContent = "목록 불러오는 중…"; gs.classList.remove("danger");
      try {
        const [rp, pj] = await Promise.all([
          fetch("/api/git/repos").then((r) => r.json()),
          fetch("/api/git/projects").then((r) => r.json()),
        ]);
        if (rp.relogin || pj.relogin || rp.error || pj.error) {
          gs.textContent = "GitHub 권한이 없습니다. 로그아웃 후 다시 로그인하세요.";
          gs.classList.add("danger"); return;
        }
        fillSelect($("gitRepo"), rp.repos || [], (r) => r.full_name, (r) => r.full_name + (r.private ? " 🔒" : ""), window.__gitDefaults.default_repo);
        fillSelect($("gitProject"), pj.projects || [], (p) => p.id, (p) => `${p.title} (#${p.number})`, window.__gitDefaults.default_project_id);
        gs.textContent = force ? "목록 갱신됨." : "";
      } catch (e) {
        gs.textContent = "목록 불러오기 실패: " + e.message; gs.classList.add("danger");
      }
    }
  }

  async function saveGit() {
    const gs = $("gitStatus");
    gs.textContent = "저장 중…"; gs.classList.remove("danger");
    const projSel = $("gitProject");
    const body = {
      default_repo: $("gitRepo").value || null,
      default_project_id: projSel.value || null,
      default_project_title: projSel.value ? projSel.options[projSel.selectedIndex].text : null,
    };
    try {
      const res = await fetch("/api/git/defaults", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.__gitDefaults = data;
      gs.textContent = `✅ 저장됨 (${data.default_repo || "repo 없음"}${data.default_project_title ? " · " + data.default_project_title : ""})`;
    } catch (err) {
      gs.textContent = "❌ " + err.message; gs.classList.add("danger");
    }
  }

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
