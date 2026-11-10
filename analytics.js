"use strict";

(() => {
  const endpoint = "https://jia-li-website-analytics.yrweexnfqa.chatgpt.site";
  const live = ["https://huster-lishuangjia.github.io", "https://li2ga.github.io"].includes(location.origin);
  const status = document.querySelector("[data-stat-status]");
  const map = document.querySelector("[data-visitor-map]");
  const refreshInterval = 15000;
  const guestDialog = document.querySelector('[data-guest-fallback]');
  let refreshing = false;
  let recording = null;
  let visit = null, visitDone = false, retryAt = 0, retryTimer = 0, failures = 0;
  let serviceReady = false, liveTotalsReady = false, shownAt = 0;
  let snapshotLoad = null, snapshotReadAt = 0;
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

  function identifier(kind, key) {
    try {
      const storage = window[kind];
      let id = storage.getItem(key);
      if (!/^[a-f0-9-]{36}$/i.test(id || "")) { id = crypto.randomUUID(); storage.setItem(key, id); }
      return id;
    } catch (_) { return crypto.randomUUID(); }
  }
  function cachedLabel() {
    const label = document.querySelector('[data-cache-time]');
    if (!label || !shownAt) return;
    const language = document.documentElement.lang.startsWith('zh') ? 'zh-CN' : 'en';
    label.textContent = new Intl.DateTimeFormat(language, { month:'short',day:'numeric',hour:'2-digit',minute:'2-digit' }).format(shownAt);
    label.dateTime = new Date(shownAt).toISOString();
    if (status) status.title = (language === 'zh-CN' ? '最近一次成功同步：' : 'Last successful sync: ') + new Date(shownAt).toLocaleString(language);
  }
  function showTotals(data, timestamp, isLive) {
    if (!data || !['pageviews','visitors'].every(k => Number.isSafeInteger(data[k]) && data[k] >= 0)) throw new Error('invalid totals');
    if (!isLive && (liveTotalsReady || timestamp < shownAt)) return;
    for (const key of ['pageviews','visitors']) document.querySelectorAll('[data-stat="'+key+'"]').forEach(el => { el.textContent=data[key].toLocaleString(); });
    shownAt=timestamp;
    if (status) status.dataset.state=isLive?'ready':'cached';
    cachedLabel();
  }
  function snapshot() {
    if (!status && !map) return Promise.resolve();
    if (snapshotLoad && Date.now()-snapshotReadAt<60000) return snapshotLoad;
    snapshotReadAt=Date.now();
    snapshotLoad=(async()=>{
      try {
        const result=await fetch('assets/analytics/summary.json',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});
        if (!result.ok) throw new Error('snapshot unavailable');
        const cached=await result.json(),at=Date.parse(cached.generated_at);
        if (!Number.isFinite(at)||at>Date.now()+300000||cached.source!==endpoint) throw new Error('invalid snapshot');
        showTotals(cached.data,at,false);
        if (map && map.dataset.source!=='live') {
          map.src='assets/analytics/visitor-map.svg?at='+encodeURIComponent(cached.generated_at);
          map.hidden=false;map.dataset.source='snapshot';
        }
      } catch (_) { if (!shownAt && status && !liveTotalsReady) status.dataset.state='unavailable'; }
    })();
    return snapshotLoad;
  }
  async function totals() {
    if (!live) { if (status) status.dataset.state = "preview"; return; }
    try {
      const result = await fetch(endpoint + "/api/summary", { credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!result.ok) throw new Error("unavailable");
      const data = await result.json();
      showTotals(data,Date.now(),true);serviceReady=true;liveTotalsReady=true;
    } catch (_) {
      serviceReady=false;liveTotalsReady=false;
      if (shownAt && status) {status.dataset.state='cached';cachedLabel();}
      await snapshot();
    }
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
        map.dataset.source = 'live';
        finish();
      };
      // Keep the last successful map if a refresh fails; the next cycle retries.
      next.onerror = () => {void snapshot();finish();};
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
    if (!live || optedOut || privacySignal || visitDone || document.visibilityState !== "visible" || Date.now()<retryAt) return;
    if (recording) return recording;
    // Reuse the visit ID after network failures or a lost acknowledgement.
    visit ??= {id:crypto.randomUUID(),visitor:identifier('localStorage','jia-li-visitor'),session:identifier('sessionStorage','jia-li-visit-session'),path:location.pathname,referrer:document.referrer,language:navigator.language,registration:registrationToken()};
    recording=(async()=>{
      try {
        const result=await fetch(endpoint+'/api/track',{
          method:'POST',credentials:'omit',keepalive:true,signal:AbortSignal.timeout(8000),
          headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(visit)
        });
        if (result.status>=400 && result.status<500 && ![403,408,429].includes(result.status)) {visitDone=true;return;}
        if (!result.ok) throw new Error('recording unavailable');
        const ack=await result.json();
        if (typeof ack.recorded!=='boolean' && ack.skipped!==true) throw new Error('invalid acknowledgement');
        visitDone=true;clearTimeout(retryTimer);
      } catch (_) {
        const delay=[2000,10000,30000,60000][Math.min(failures++,3)];
        retryAt=Date.now()+delay;clearTimeout(retryTimer);retryTimer=setTimeout(()=>{void count();},delay);
      }
    })().finally(()=>{recording=null;});
    return recording;
  }
  async function activate() {
    if (document.visibilityState !== "visible") return;
    void count();void refreshStatistics();
  }
  document.querySelectorAll('[data-guest-entry]').forEach(link=>link.addEventListener('click',event=>{
    if(serviceReady||!guestDialog?.showModal||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();guestDialog.showModal();
  }));
  guestDialog?.querySelector('[data-dialog-close]')?.addEventListener('click',()=>guestDialog.close());
  guestDialog?.addEventListener('click',event=>{if(event.target===guestDialog)guestDialog.close();});
  document.querySelector('[data-copy-contact]')?.addEventListener('click',async event=>{
    const button=event.currentTarget;
    try{await navigator.clipboard.writeText(button.dataset.copyContact);button.dataset.copied='true';}
    catch(_){/* The visible mail address remains selectable. */}
  });
  new MutationObserver(cachedLabel).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if (live) {
    document.addEventListener("visibilitychange", activate);
    window.addEventListener("focus", activate);
    window.addEventListener("pageshow", activate);
    window.addEventListener("online", () => { retryAt=0;activate(); });
    setInterval(activate, refreshInterval);
    void snapshot();
    void activate();
  } else {
    void totals();
  }
})();
