// 회의록 만들기 — 자막 파싱 + 실시간 녹음 + 서버 프록시 AI 요약(+자동 다운로드).
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const el = {
    recStart: $("btnRecStart"), recStop: $("btnRecStop"), timer: $("timer"), recDot: $("recDot"),
    speechSupport: $("speechSupport"), dropzone: $("dropzone"), fileInput: $("fileInput"),
    transcript: $("transcript"), date: $("meetingDate"), time: $("meetingTime"),
    attendees: $("attendees"), subject: $("subject"),
    curProvider: $("curProvider"), curModel: $("curModel"), ai: $("btnAI"), genStatus: $("genStatus"),
    resultPanel: $("resultPanel"), markdown: $("markdown"), mdPreview: $("mdPreview"),
    tabPreview: $("tabPreview"), tabEdit: $("tabEdit"),
    download: $("btnDownload"), copy: $("btnCopy"), fname: $("fname"),
  };
  const todayISO = () => new Date().toISOString().slice(0, 10);
  el.date.value = todayISO();
  const status = (msg, err) => { el.genStatus.textContent = msg; el.genStatus.classList.toggle("danger", !!err); };

  // 현재 provider/model 은 서버(마이페이지) 설정을 따른다. 기본 gemini.
  const PROVIDER_LABEL = { gemini: "Gemini (Google)", claude: "Claude (Anthropic)", openai: "codex (OpenAI)" };
  fetch("/api/settings").then((r) => r.json()).then((s) => {
    if (el.curProvider) el.curProvider.textContent = PROVIDER_LABEL[s.provider] || s.provider;
    if (el.curModel) el.curModel.textContent = s.model;
  }).catch(() => {});

  // ---- 자막 파싱 ----
  function parseSubtitle(text, name) {
    if ((name || "").toLowerCase().endsWith(".txt")) return cleanup(text.split(/\r?\n/));
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || /^WEBVTT/i.test(line) || /^NOTE\b/i.test(line) || /-->/.test(line)
        || /^\d+$/.test(line) || /^(STYLE|REGION)\b/i.test(line)) continue;
      let t = line.replace(/<v\s+([^>]+)>/gi, "$1: ").replace(/<\/v>/gi, "").replace(/<[^>]+>/g, "").trim();
      if (t) out.push(t);
    }
    return cleanup(out);
  }
  function cleanup(arr) {
    const out = []; let prev = "";
    for (const l of arr) { const t = l.trim(); if (t && t !== prev) { out.push(t); prev = t; } }
    return out.join("\n");
  }
  el.dropzone.addEventListener("click", () => el.fileInput.click());
  el.dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") el.fileInput.click(); });
  ["dragover", "dragenter"].forEach((ev) => el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => el.dropzone.addEventListener(ev, () => el.dropzone.classList.remove("drag")));
  el.dropzone.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  el.fileInput.addEventListener("change", (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  async function handleFile(file) {
    const name = file.name.toLowerCase();
    if (/\.(vtt|srt|txt)$/.test(name) || file.type.startsWith("text")) {
      el.transcript.value = parseSubtitle(await file.text(), name);
      status(`📄 '${file.name}' 자막을 불러왔습니다.`);
    } else {
      status(`🎧 오디오 전사(STT 프록시)는 준비 중입니다. 자막(.vtt/.srt) 또는 실시간 녹음을 이용하세요.`, true);
    }
  }

  // ---- Web Speech 실시간 녹음 ----
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = null, recording = false, tSec = 0, tInt = null;
  if (!SR) { el.recStart.disabled = true; status("이 브라우저는 실시간 음성인식 미지원(Chrome/Edge 권장). 자막 파일은 사용 가능."); }
  const fmt = (s) => `${String((s / 60) | 0).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  el.recStart.addEventListener("click", () => {
    if (!SR || recording) return;
    recog = new SR(); recog.lang = "ko-KR"; recog.continuous = true; recog.interimResults = true;
    let finals = el.transcript.value ? el.transcript.value + "\n" : "";
    recog.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]; if (r.isFinal) finals += r[0].transcript.trim() + "\n"; else interim += r[0].transcript;
      }
      el.transcript.value = finals + interim;
    };
    recog.onerror = (e) => status("음성인식 오류: " + e.error, true);
    recog.onend = () => { if (recording) recog.start(); };
    recording = true; recog.start(); tSec = 0; el.timer.textContent = "00:00";
    tInt = setInterval(() => { el.timer.textContent = fmt(++tSec); }, 1000);
    el.recStart.disabled = true; el.recStop.disabled = false; el.recDot.hidden = false;
    status("🎙️ 녹음 중…");
  });
  el.recStop.addEventListener("click", () => {
    recording = false; if (recog) recog.stop(); clearInterval(tInt);
    el.recStart.disabled = false; el.recStop.disabled = true; el.recDot.hidden = true;
    status("⏹️ 녹음 종료. AI 요약을 누르세요.");
  });

  // ---- 미리보기 렌더 ----
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function renderMarkdown(md) {
    const lines = esc(md).split(/\r?\n/); let html = "", inList = false, cls = "";
    const close = () => { if (inList) { html += "</ul>"; inList = false; } };
    const open = (c) => { if (!inList || cls !== c) { close(); html += `<ul${c ? ` class="${c}"` : ""}>`; inList = true; cls = c; } };
    for (const raw of lines) {
      const line = raw.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
      let m;
      if (/^#\s+/.test(line)) { close(); html += `<div class="mp-h1">${line.replace(/^#\s+/, "")}</div>`; }
      else if (/^##\s+/.test(line)) { close(); html += `<div class="mp-h2">${line.replace(/^##\s+/, "")}</div>`; }
      else if (/^###\s+/.test(line)) { close(); html += `<h4>${line.replace(/^###\s+/, "")}</h4>`; }
      else if ((m = line.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
        open("mp-tasks"); const done = m[1].toLowerCase() === "x";
        html += `<li class="${done ? "done" : ""}"><input type="checkbox" disabled ${done ? "checked" : ""}><span>${m[2]}</span></li>`;
      } else if ((m = line.match(/^[-*]\s+(.*)$/))) { open(""); html += `<li>${m[1]}</li>`; }
      else if (line.trim() === "") { close(); }
      else { close(); html += `<p>${line}</p>`; }
    }
    close(); return html;
  }
  const updatePreview = () => { el.mdPreview.innerHTML = renderMarkdown(el.markdown.value); };
  function setView(edit) {
    el.markdown.hidden = !edit; el.mdPreview.hidden = edit;
    el.tabEdit.classList.toggle("active", edit); el.tabPreview.classList.toggle("active", !edit);
    if (!edit) updatePreview();
  }
  el.tabEdit.addEventListener("click", () => setView(true));
  el.tabPreview.addEventListener("click", () => setView(false));
  el.markdown.addEventListener("input", updatePreview);

  function download() {
    const blob = new Blob([el.markdown.value], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${el.date.value || todayISO()}_meeting.md`;
    a.click(); URL.revokeObjectURL(a.href);
  }
  function showResult(md) {
    el.markdown.value = md.trim() + "\n";
    el.resultPanel.hidden = false;
    el.fname.textContent = `${el.date.value || todayISO()}_meeting.md`;
    setView(false);
    if (window.__revealGitIssue) window.__revealGitIssue();
    el.resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  el.download.addEventListener("click", download);
  el.copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(el.markdown.value); status("📋 복사했습니다."); }
    catch { status("복사 실패 — 직접 선택해 복사하세요.", true); }
  });

  // ---- AI 요약 (서버 프록시) + 자동 다운로드 ----
  el.ai.addEventListener("click", async () => {
    const transcript = el.transcript.value.trim();
    if (!transcript) { status("먼저 자막을 불러오거나 녹음하세요.", true); return; }
    if (!el.date.value) { status("회의 날짜는 필수입니다.", true); el.date.focus(); return; }
    el.ai.disabled = true; status("🤖 AI 요약 중…");
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript, date: el.date.value, time: el.time.value,
          attendees: el.attendees.value, subject: el.subject.value,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showResult(data.markdown);
      download(); // 요청: AI 요약 시 자동 다운로드
      if (window.refreshUsage) window.refreshUsage();
      const cost = data.cost_krw != null ? ` · 이번 요약 ${data.cost_krw.toFixed(2)}원` : "";
      const saved = data.saved ? " · ☁️ 이력 저장됨(마이페이지)" : "";
      status(`✅ 회의록 생성·다운로드 완료 (${data.provider}/${data.model})${cost}${saved}`);
    } catch (err) {
      status("❌ 실패: " + err.message, true);
    } finally {
      el.ai.disabled = false;
    }
  });

  // ---- GitHub 이슈로 만들기 (로그인 시) ----
  const gitEl = {
    box: $("gitIssueBox"), guest: $("gitIssueGuest"),
    repo: $("issRepo"), project: $("issProject"), assignee: $("issAssignee"),
    make: $("btnMakeIssues"), status: $("issStatus"), result: $("issResult"), count: $("issTaskCount"),
  };
  let gitReady = false;

  // 클라이언트 측 할 일 개수(서버 parseActionItems 와 동일 규칙의 근사치)
  function countActionItems(md) {
    const lines = md.split(/\r?\n/); let inSection = false, n = 0;
    for (const line of lines) {
      if (/^#{1,6}\s+.*할\s*일/.test(line)) { inSection = true; continue; }
      if (inSection && /^#{1,6}\s+/.test(line)) break;
      if (!inSection) continue;
      const m = line.match(/^\s*[-*]\s*\[[ xX]?\]\s*(.+?)\s*$/);
      if (m && m[1].trim() && !/^<.*>$/.test(m[1].trim())) n++;
    }
    return n;
  }

  function fillSel(sel, items, valueOf, labelOf, selected) {
    const head = sel.querySelector('option[value=""]');
    sel.innerHTML = "";
    if (head) sel.appendChild(head);
    for (const it of items) {
      const o = document.createElement("option");
      o.value = valueOf(it); o.textContent = labelOf(it);
      sel.appendChild(o);
    }
    if (selected) sel.value = selected;
  }

  async function loadAssignees(repo) {
    fillSel(gitEl.assignee, [], () => "", () => "");
    if (!repo) return;
    try {
      const d = await fetch("/api/git/assignees?repo=" + encodeURIComponent(repo)).then((r) => r.json());
      if (d.assignees) fillSel(gitEl.assignee, d.assignees, (a) => a.login, (a) => "@" + a.login);
    } catch {}
  }

  async function initGitIssue() {
    let me;
    try { me = await fetch("/api/me").then((r) => r.json()); } catch { return; }
    if (!me.loggedIn) { gitEl.guest.hidden = false; return; }
    // 박스는 결과 생성(showResult) 후 __revealGitIssue 로 노출.
    try {
      const [rp, pj, df] = await Promise.all([
        fetch("/api/git/repos").then((r) => r.json()),
        fetch("/api/git/projects").then((r) => r.json()),
        fetch("/api/git/defaults").then((r) => r.json()),
      ]);
      if (rp.relogin || rp.error) {
        gitEl.guest.hidden = false;
        gitEl.guest.innerHTML = 'GitHub 이슈 생성 권한이 없습니다. <a href="/api/auth/logout">로그아웃</a> 후 다시 로그인하세요.';
        return;
      }
      fillSel(gitEl.repo, rp.repos || [], (r) => r.full_name, (r) => r.full_name + (r.private ? " 🔒" : ""), df.default_repo);
      fillSel(gitEl.project, pj.projects || [], (p) => p.id, (p) => `${p.title} (#${p.number})`, df.default_project_id);
      if (df.default_repo) await loadAssignees(df.default_repo);
      gitEl.repo.addEventListener("change", () => loadAssignees(gitEl.repo.value));
      gitEl.make.addEventListener("click", makeIssues);
      gitReady = true;
    } catch (e) {
      gitEl.guest.hidden = false;
      gitEl.guest.textContent = "git 목록 불러오기 실패: " + e.message;
    }
  }

  window.__revealGitIssue = () => {
    if (!gitReady) return;
    gitEl.box.hidden = false;
    gitEl.count.textContent = String(countActionItems(el.markdown.value));
    gitEl.result.innerHTML = "";
  };

  async function makeIssues() {
    const repo = gitEl.repo.value;
    if (!repo) { gitEl.status.textContent = "대상 repo 를 선택하세요."; gitEl.status.classList.add("danger"); return; }
    gitEl.status.textContent = "이슈 생성 중…"; gitEl.status.classList.remove("danger");
    gitEl.make.disabled = true; gitEl.result.innerHTML = "";
    const subject = (el.subject.value || "").trim();
    const meetingTitle = `${el.date.value || todayISO()}${subject ? " " + subject : ""} 회의`;
    try {
      const res = await fetch("/api/git/issues", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo, assignee: gitEl.assignee.value || undefined, projectId: gitEl.project.value || undefined,
          markdown: el.markdown.value, meetingTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      gitEl.status.textContent = `✅ ${data.count}건 생성${data.from_action_items ? " (할 일 기준)" : " (회의록 요약 1건)"}`;
      gitEl.result.innerHTML = (data.created || [])
        .map((c) => `<li><a href="${c.url}" target="_blank" rel="noopener">#${c.number}</a> ${c.title.replace(/</g, "&lt;")}</li>`).join("");
    } catch (err) {
      gitEl.status.textContent = "❌ " + err.message; gitEl.status.classList.add("danger");
    } finally {
      gitEl.make.disabled = false;
    }
  }

  initGitIssue();
})();
