"use strict";

(() => {
  const endpoint = "https://jia-li-website-analytics.yrweexnfqa.chatgpt.site";
  const live = ["https://huster-lishuangjia.github.io", "https://li2ga.github.io"].includes(location.origin);
  const status = document.querySelector("[data-stat-status]");
  const map = document.querySelector("[data-visitor-map]");
  const refreshInterval = 15000;
  let refreshing = false;
  let recording = null;
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
      const result = await fetch(endpoint + "/api/summary", { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!result.ok) throw new Error("unavailable");
      const data = await result.json();
      for (const key of ["pageviews", "visitors"]) {
        if (!Number.isSafeInteger(data[key]) || data[key] < 0) throw new Error("invalid total");
        document.querySelectorAll('[data-stat="' + key + '"]').forEach(el => { el.textContent = data[key].toLocaleString(); });
      }
      if (status) status.dataset.state = "ready";
    } catch (_) { if (status) status.dataset.state = "unavailable"; }
  }
  function refreshMap() {
    if (!map) return Promise.resolve();
    return new Promise(resolve => {
      const next = new Image();
      const timeout = setTimeout(finish, 8000);
      function finish() {
        clearTimeout(timeout);
        next.onload = null;
        next.onerror = null;
        resolve();
      }
      next.onload = () => {
        map.src = next.src;
        map.hidden = false;
        finish();
      };
      // Keep the last successful map if a refresh fails; the next cycle retries.
      next.onerror = finish;
      next.src = endpoint + "/map.svg?updated=" + Date.now();
    });
  }
  async function refreshStatistics() {
    if (!live || refreshing || document.visibilityState !== "visible") return;
    refreshing = true;
    try { await Promise.all([totals(), refreshMap()]); }
    finally { refreshing = false; }
  }
  async function count() {
    if (!live || optedOut || privacySignal || document.visibilityState !== "visible") return;
    if (!recording) {
      recording = fetch(endpoint + "/api/track", {
        method: "POST", credentials: "omit", keepalive: true, signal: AbortSignal.timeout(8000),
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ id: crypto.randomUUID(), visitor: identifier(localStorage, "jia-li-visitor"), session: identifier(sessionStorage, "jia-li-visit-session"), path: location.pathname, referrer: document.referrer, language: navigator.language, registration: registrationToken() }),
      }).catch(() => { /* Statistics must never interrupt the homepage. */ });
    }
    return recording;
  }
  async function activate() {
    if (document.visibilityState !== "visible") return;
    await count();
    void refreshStatistics();
  }
  if (live) {
    document.addEventListener("visibilitychange", activate);
    window.addEventListener("focus", activate);
    window.addEventListener("pageshow", activate);
    window.addEventListener("online", () => { void refreshStatistics(); });
    setInterval(() => { void refreshStatistics(); }, refreshInterval);
    void activate();
  } else {
    void totals();
  }
})();
