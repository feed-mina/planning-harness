// 대시보드 — 최근 회의록(최대 5건). 로그인 시 목록, 아니면 로그인 유도.
(() => {
  "use strict";
  const box = document.getElementById("recentMeetings");
  if (!box) return;
  fetch("/api/me").then((r) => r.json()).then((me) => {
    if (!me.loggedIn) {
      box.innerHTML = '<p class="hint">로그인하면 최근 회의록이 여기에 표시됩니다. <a href="/api/auth/github">GitHub 로그인</a></p>';
      return;
    }
    return fetch("/api/meetings?limit=5").then((r) => r.json()).then((d) => {
      if (d.error) { box.innerHTML = `<p class="hint danger">${d.error}</p>`; return; }
      window.renderMeetingList(box, d.meetings);
    });
  }).catch(() => { box.innerHTML = '<p class="hint danger">불러오기 실패</p>'; });
})();
