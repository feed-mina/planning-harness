// 통계 — 오늘 요약 + Chart.js(경량 CDN) 일자별 비용 막대 + provider 도넛.
(() => {
  "use strict";
  const PURPLE = "#7c5cff";
  const PROVIDER_COLOR = { gemini: "#16a34a", claude: "#7c5cff", openai: "#ef8a8a" };

  // 오늘 요약
  fetch("/api/usage").then((r) => r.json()).then((d) => {
    document.getElementById("todayCost").textContent = Math.round(d.used_krw) + "원";
    document.getElementById("remain").textContent = Math.round(d.remaining_krw) + "원";
  }).catch(() => {});

  // 시계열 → 차트
  fetch("/api/usage/series?days=14").then((r) => r.json()).then((s) => {
    if (typeof Chart === "undefined") return; // 라이브러리 로드 실패 시 무시
    renderDaily(s.days || []);
    renderProviders(s.providers || []);
  }).catch(() => {});

  function renderDaily(days) {
    const total = days.reduce((a, d) => a + d.cost, 0);
    if (!total) { document.getElementById("dailyEmpty").hidden = false; return; }
    new Chart(document.getElementById("dailyChart"), {
      type: "bar",
      data: {
        labels: days.map((d) => d.day.slice(5)), // MM-DD
        datasets: [{ label: "비용(원)", data: days.map((d) => Math.round(d.cost * 100) / 100),
          backgroundColor: PURPLE, borderRadius: 6 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + "원" } } } },
    });
  }

  function renderProviders(providers) {
    const nonzero = providers.filter((p) => p.cost > 0);
    if (!nonzero.length) { document.getElementById("provEmpty").hidden = false; return; }
    new Chart(document.getElementById("providerChart"), {
      type: "doughnut",
      data: {
        labels: nonzero.map((p) => p.provider),
        datasets: [{ data: nonzero.map((p) => Math.round(p.cost * 100) / 100),
          backgroundColor: nonzero.map((p) => PROVIDER_COLOR[p.provider] || "#b9a9f2") }],
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } },
    });
  }
})();
