// 공통: 네비 렌더 + 로그인 상태 + 오늘 사용량 pill.
(() => {
  const page = document.body.dataset.page || "";
  const tabs = [
    { id: "dashboard", href: "/", label: "대시보드" },
    { id: "feature", href: "/feature/", label: "회의록 만들기" },
    { id: "stats", href: "/stats/", label: "통계" },
    { id: "mypage", href: "/mypage/", label: "마이페이지" },
  ];
  const nav = document.createElement("nav");
  nav.className = "nav";
  nav.innerHTML =
    `<div class="nav-in">
       <a class="brand" href="/">🎙️ 회의록 메이커</a>
       ${tabs.map(t => `<a class="tab ${t.id === page ? "active" : ""}" href="${t.href}">${t.label}</a>`).join("")}
       <span class="spacer"></span>
       <span class="who" id="whoami">…</span>
     </div>`;
  document.body.prepend(nav);

  // 로그인 상태
  fetch("/api/me").then(r => r.json()).then(d => {
    const who = document.getElementById("whoami");
    if (d.loggedIn) who.innerHTML = `@${d.login || "me"} · <a href="/api/auth/logout">로그아웃</a>`;
    else who.innerHTML = `<a href="/api/auth/github">GitHub 로그인</a>`;
  }).catch(() => {});

  // 오늘 사용량 pill (요소가 있으면 채움)
  window.refreshUsage = () => fetch("/api/usage").then(r => r.json()).then(d => {
    document.querySelectorAll("[data-usage]").forEach(el => {
      el.textContent = `오늘 ${Math.round(d.used_krw)}원 / ${d.limit_krw}원 (남음 ${Math.round(d.remaining_krw)}원)`;
    });
  }).catch(() => {});
  window.refreshUsage();

  // ---- 회의록 이력(M3) 공통 헬퍼: 대시보드·마이페이지에서 재사용 ----
  window.downloadMeeting = async (id, fallbackName) => {
    const r = await fetch("/api/meetings/" + encodeURIComponent(id));
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "불러오기 실패");
    const blob = new Blob([d.markdown], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${d.date || fallbackName || "meeting"}_meeting.md`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  window.renderMeetingList = (container, meetings) => {
    if (!meetings || !meetings.length) {
      container.innerHTML = '<p class="hint">아직 저장된 회의록이 없습니다. <a href="/feature/">회의록 만들기</a>에서 생성하면 자동 저장됩니다.</p>';
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "meeting-list";
    for (const m of meetings) {
      const when = (m.date || (m.created_at || "").slice(0, 10)) || "";
      const li = document.createElement("li");
      li.innerHTML = `<span class="mt-title"></span><span class="mt-date">${when}</span>` +
        `<button class="btn btn-ghost btn-small" data-dl="${m.id}">⬇ .md</button>`;
      li.querySelector(".mt-title").textContent = m.title || "회의록";
      ul.appendChild(li);
    }
    container.innerHTML = "";
    container.appendChild(ul);
    ul.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dl]");
      if (!btn) return;
      btn.disabled = true; const t = btn.textContent; btn.textContent = "…";
      window.downloadMeeting(btn.dataset.dl).catch(() => {}).finally(() => { btn.disabled = false; btn.textContent = t; });
    });
  };
})();
