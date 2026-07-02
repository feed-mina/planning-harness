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
})();
