"use strict";

(() => {
  const endpoint = "https://jia-li-website-analytics.yrweexnfqa.chatgpt.site";
  const live = ["https://huster-lishuangjia.github.io", "https://li2ga.github.io"].includes(location.origin);
  const status = document.querySelector("[data-stat-status]");
  let recorded = false;
  let optedOut = false;
  try { optedOut = localStorage.getItem("jia-li-no-analytics") === "1"; } catch (_) { /* Storage may be disabled. */ }
  const privacySignal = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  // Only a deliberate return from the voluntary form can attach future visits.
  const registration = new URLSearchParams(location.hash.slice(1)).get("visitor-link");
  if (live && /^[a-f0-9]{64}$/.test(registration || "")) {
    if (!optedOut && !privacySignal) {
      try {
        if (localStorage.getItem("jia-li-registration") !== registration) {
          localStorage.removeItem("jia-li-visitor");
          sessionStorage.removeItem("jia-li-visit-session");
        }
        localStorage.setItem("jia-li-registration", registration);
      } catch (_) { /* Remain anonymous without storage. */ }
    }
    history.replaceState(null, "", location.pathname + location.search);
  }
  function registrationToken() {
    try { return localStorage.getItem("jia-li-registration") || ""; } catch (_) { return ""; }
  }

  function identifier(storage, key) {
    try {
      let id = storage.getItem(key);
      if (!/^[a-f0-9-]{36}$/i.test(id || "")) { id = crypto.randomUUID(); storage.setItem(key, id); }
      return id;
    } catch (_) { return crypto.randomUUID(); }
  }
  async function totals() {
    if (!live) { if (status) status.dataset.state = "preview"; return; }
    try {
      const result = await fetch(endpoint + "/api/summary", { credentials: "omit", signal: AbortSignal.timeout(8000) });
      if (!result.ok) throw new Error("unavailable");
      const data = await result.json();
      for (const key of ["pageviews", "visitors"]) {
        if (!Number.isSafeInteger(data[key]) || data[key] < 0) throw new Error("invalid total");
        document.querySelectorAll('[data-stat="' + key + '"]').forEach(el => { el.textContent = data[key].toLocaleString(); });
      }
      if (status) status.dataset.state = "ready";
    } catch (_) { if (status) status.dataset.state = "unavailable"; }
  }
  async function count() {
    if (!live || optedOut || privacySignal || recorded || document.visibilityState !== "visible") return;
    recorded = true;
    try {
      await fetch(endpoint + "/api/track", {
        method: "POST", credentials: "omit", keepalive: true, signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ id: crypto.randomUUID(), visitor: identifier(localStorage, "jia-li-visitor"), session: identifier(sessionStorage, "jia-li-visit-session"), path: location.pathname, referrer: document.referrer, language: navigator.language, registration: registrationToken() }),
      });
    } catch (_) { /* Statistics must never interrupt the homepage. */ }
    void totals();
  }
  document.addEventListener("visibilitychange", () => { void count(); });
  const map = document.querySelector("[data-visitor-map]");
  if (map && live) {
    map.addEventListener("error", () => { map.hidden = true; });
    map.src = endpoint + "/map.svg";
  }
  void totals();
  void count();
})();
