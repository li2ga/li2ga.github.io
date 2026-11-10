"use strict";

(() => {
  let language = "en";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const mediaControllers = [];
  const portraitImage = document.querySelector('.portrait img');

  // Load full-resolution figures close to the viewport, rather than screens ahead.
  const deferredImages = document.querySelectorAll('img[data-src]');
  function loadFigure(image) {
    image.src = image.dataset.src;
    delete image.dataset.src;
  }
  if ('IntersectionObserver' in window) {
    const figureObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        loadFigure(entry.target);
        figureObserver.unobserve(entry.target);
      });
    }, { rootMargin: '200px 0px' });
    deferredImages.forEach(image => figureObserver.observe(image));
  } else deferredImages.forEach(loadFigure);

  const entrance = document.querySelector('.site-entrance');
  if (entrance && document.documentElement.classList.contains('intro-pending')) {
    let entranceTimer = 0;
    function finishEntrance() {
      clearTimeout(entranceTimer);
      document.documentElement.classList.remove('intro-pending');
      entrance.remove();
      document.removeEventListener('visibilitychange', finishWhenHidden);
      reducedMotion.removeEventListener('change', finishOnReducedMotion);
    }
    function finishWhenHidden() { if (document.hidden) finishEntrance(); }
    function finishOnReducedMotion() { if (reducedMotion.matches) finishEntrance(); }
    if (new URLSearchParams(location.search).get('intro') !== 'preview') {
      try { localStorage.setItem('jia-li-intro-seen', '1'); } catch (_) { /* The page remains readable without storage. */ }
    }
    entranceTimer = setTimeout(finishEntrance, 1800);
    document.addEventListener('visibilitychange', finishWhenHidden);
    reducedMotion.addEventListener('change', finishOnReducedMotion);
  } else if (entrance) entrance.remove();

  // Ease pointer depth separately from CSS floating; stop requesting frames once settled.
  const atmosphere = document.querySelector(".page-atmosphere");
  const meteorSky = document.querySelector('.sky-meteors');
  function syncMeteorSky() {
    meteorSky?.classList.toggle('is-active', !document.hidden && !reducedMotion.matches);
  }
  document.addEventListener('visibilitychange', syncMeteorSky);
  reducedMotion.addEventListener('change', syncMeteorSky);
  syncMeteorSky();
  const widePointer = window.matchMedia("(min-width: 1041px) and (pointer: fine)");
  let atmosphereFrame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerTime = 0;
  function followPointer(time) {
    const elapsed = pointerTime ? Math.min(64, time - pointerTime) : 16;
    pointerTime = time;
    const easing = 1 - Math.exp(-elapsed / 95);
    pointerX += (pointerTargetX - pointerX) * easing;
    pointerY += (pointerTargetY - pointerY) * easing;
    const settled = Math.abs(pointerTargetX - pointerX) < .02 && Math.abs(pointerTargetY - pointerY) < .02;
    if (settled) { pointerX = pointerTargetX; pointerY = pointerTargetY; }
    atmosphere.style.setProperty('--trace-x', `${pointerX.toFixed(2)}px`);
    atmosphere.style.setProperty('--trace-y', `${pointerY.toFixed(2)}px`);
    atmosphereFrame = settled ? 0 : requestAnimationFrame(followPointer);
  }
  function easeAtmosphere() {
    if (atmosphereFrame || !atmosphere) return;
    pointerTime = 0;
    atmosphereFrame = requestAnimationFrame(followPointer);
  }
  function resetAtmosphere() {
    pointerTargetX = pointerTargetY = 0;
    if (!atmosphere) return;
    if (document.hidden || reducedMotion.matches || !widePointer.matches) {
      cancelAnimationFrame(atmosphereFrame);
      atmosphereFrame = 0;
      pointerX = pointerY = 0;
      atmosphere.style.removeProperty('--trace-x');
      atmosphere.style.removeProperty('--trace-y');
    } else easeAtmosphere();
  }
  if (atmosphere) {
    document.addEventListener("pointermove", event => {
      if (reducedMotion.matches || !widePointer.matches || event.pointerType === "touch") return;
      pointerTargetX = Math.max(-12, Math.min(12, (event.clientX / innerWidth - .5) * 24));
      pointerTargetY = Math.max(-9, Math.min(9, (event.clientY / innerHeight - .5) * 18));
      easeAtmosphere();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", resetAtmosphere);
    document.addEventListener("visibilitychange", () => { if (document.hidden) resetAtmosphere(); });
    reducedMotion.addEventListener("change", resetAtmosphere);
    widePointer.addEventListener("change", resetAtmosphere);
  }

  const backgroundSwitch = document.querySelector(".background-switch");
  const backgroundScenes = ["trajectory", "ziwei-cinematic", "ganzhi-cinematic", "lotus"];
  const availableBackgrounds = [...backgroundScenes, "lotus-still", "lotus-classic"];
  const wideBackground = window.matchMedia("(min-width: 1041px)");
  const autoBackgroundButton = document.querySelector('[data-background="auto"]');
  let backgroundChoice = "trajectory";
  let backgroundVisibility = "clear";
  let backgroundTimer = 0;
  const lotusScene = atmosphere?.querySelector('[data-background-scene="lotus"]');
  const lotusOptions = document.querySelector('.lotus-options');
  const lotusToggle = document.querySelector('[data-lotus-toggle]');
  const lotusButtons = [...document.querySelectorAll('button[data-lotus-stage]')];
  const lotusStageCount = lotusButtons.length;
  const lotusStatus = document.querySelector('[data-lotus-status]');
  const lotusRetry = document.querySelector('[data-lotus-retry]');
  const lotusLoads = new Map();
  const lotusQueue = [];
  let lotusLoading = 0;
  const lotusProfiles = {
    fixed: { offsets: [0, 4, 2, 6], holds: [5600, 8300, 6500, 9700] },
    page: { offsets: [0, 1, 3, 5], holds: [4300, 6100, 7600, 5200] }
  };
  const lotusStageHolds = [1, 1.18, .91, 1.11, 1.26, 1.14, .95, 1.22, 1.24, 1.18];
  const lotusItems = [...(lotusScene?.querySelectorAll('[data-lotus-instance]') || [])].map((element, index) => ({
    element, index, stage: null, desiredStage: null, pending: false, error: false,
    timer: 0, dueAt: 0, remaining: null, request: 0
  }));
  let lotusStage = 0;
  let lotusPaused = false;
  let lotusLayout = null;
  let backgroundUserInitiated = false;
  let portraitHeadStartElapsed = false;
  try {
    lotusPaused = localStorage.getItem('jia-li-lotus-paused') === '1';
    const stage = Number(localStorage.getItem('jia-li-lotus-stage'));
    if (lotusPaused && Number.isInteger(stage) && stage >= 0 && stage < lotusStageCount) lotusStage = stage;
    if (lotusPaused) {
      const stages = JSON.parse(localStorage.getItem('jia-li-lotus-stages') || 'null');
      const valid = Array.isArray(stages) && stages.length === lotusItems.length
        && stages.every(value => Number.isInteger(value) && value >= 0 && value < lotusStageCount);
      lotusItems.forEach(item => { item.desiredStage = valid ? stages[item.index] : lotusStage; });
    }
  } catch (_) { /* A first visit starts with the initial blue flame. */ }
  if (lotusPaused) lotusItems.forEach(item => { item.desiredStage ??= lotusStage; });
  function visibleLotusItems() {
    return lotusItems.filter(item => lotusLayout === 'page' || item.index < 2);
  }
  function saveLotusPlayback(stage = null) {
    if (new URLSearchParams(location.search).has('lotus')) {
      const url = new URL(location.href);
      url.searchParams.delete('lotus');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    try {
      localStorage.setItem('jia-li-lotus-paused', lotusPaused ? '1' : '0');
      localStorage.setItem('jia-li-lotus-stage', String(stage ?? lotusStage));
      localStorage.setItem('jia-li-lotus-stages', JSON.stringify(lotusItems.map(item => stage ?? item.stage ?? item.desiredStage)));
    } catch (_) { /* Motion and manual selection remain usable without storage. */ }
  }
  function updateLotusLabels() {
    if (!lotusToggle) return;
    lotusToggle.disabled = reducedMotion.matches;
    lotusToggle.setAttribute('aria-pressed', String(lotusPaused || reducedMotion.matches));
    lotusToggle.textContent = language === 'zh'
      ? (lotusPaused || reducedMotion.matches ? '播放演变' : '暂停演变')
      : (lotusPaused || reducedMotion.matches ? 'Play evolution' : 'Pause evolution');
    lotusToggle.title = reducedMotion.matches
      ? (language === 'zh' ? '系统已启用减少动态效果，可手动选择形态' : 'Reduced motion is enabled; select a stage manually') : '';
    const items = visibleLotusItems();
    const pending = items.some(item => item.pending);
    const failed = items.some(item => item.error);
    const started = items.some(item => item.stage !== null);
    if (lotusStatus) {
      lotusStatus.hidden = !pending && !failed && started;
      lotusStatus.textContent = failed
        ? (language === 'zh' ? '部分火莲加载失败，可重试。' : 'Some lotuses could not load. Try again.')
        : (language === 'zh' ? '正在加载火莲…' : 'Loading lotus…');
    }
    if (lotusRetry) lotusRetry.hidden = !failed;
    lotusButtons.forEach(button => button.setAttribute('aria-busy', String(items.some(item => item.pending && Number(button.dataset.lotusStage) === item.desiredStage))));
  }
  function showLotusStage(stage) {
    lotusStage = stage;
    if (lotusScene) lotusScene.dataset.lotusStage = String(stage);
    lotusButtons.forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.lotusStage) === stage));
    });
  }
  function pumpLotusQueue() {
    // Keep one automatic decoration in flight while the original portrait loads.
    const limit = portraitImage && !portraitImage.complete && !backgroundUserInitiated ? 1 : 2;
    while (lotusLoading + atmosphere.querySelectorAll('[data-art-loading]').length < limit && lotusQueue.length) lotusQueue.shift().start();
  }
  function decodeLotusImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.fetchPriority = 'low';
      const deadline = setTimeout(() => { image.onload = image.onerror = null; reject(new Error('Lotus load timed out')); }, 20000);
      image.onerror = () => { clearTimeout(deadline); reject(new Error('Lotus image unavailable')); };
      image.onload = async () => {
        try {
          await image.decode();
          clearTimeout(deadline);
          resolve(image);
        } catch (error) { clearTimeout(deadline); reject(error); }
      };
      image.src = source;
    });
  }
  function loadLotusStage(stage, priority = false) {
    if (lotusLoads.has(stage)) {
      const queued = lotusQueue.findIndex(job => job.stage === stage);
      if (priority && queued > 0) lotusQueue.unshift(lotusQueue.splice(queued, 1)[0]);
      return lotusLoads.get(stage);
    }
    const loading = new Promise((resolve, reject) => {
      const job = {
        stage,
        start() {
          lotusLoading++;
          const source = lotusButtons[stage].dataset.lotusSrc;
          decodeLotusImage(source).then(image => {
            lotusScene.querySelectorAll(`[data-lotus-frame="${stage}"]`).forEach(frame => {
              frame.style.backgroundImage = `url("${source}")`;
            });
            resolve(image);
          }, reject).finally(() => { lotusLoading--; pumpLotusQueue(); syncImagery(); });
        }
      };
      if (priority) lotusQueue.unshift(job);
      else lotusQueue.push(job);
    }).catch(error => { lotusLoads.delete(stage); throw error; });
    lotusLoads.set(stage, loading);
    pumpLotusQueue();
    return loading;
  }
  function pauseLotusTimer(item) {
    if (!item.timer) return;
    clearTimeout(item.timer);
    item.timer = 0;
    item.remaining = Math.max(0, item.dueAt - performance.now());
  }
  function requestLotusStage(item, stage, priority = false) {
    pauseLotusTimer(item);
    item.remaining = null;
    item.desiredStage = stage;
    item.pending = true;
    item.error = false;
    item.element.dataset.lotusPending = 'true';
    delete item.element.dataset.lotusError;
    const request = ++item.request;
    loadLotusStage(stage, priority).then(image => {
      if (request !== item.request) return;
      item.pending = false;
      item.stage = stage;
      item.element.dataset.lotusStage = String(stage);
      item.element.dataset.lotusReady = 'true';
      window.JiaArtLoops?.lotus(item.element, stage, image);
      delete item.element.dataset.lotusPending;
      lotusScene.classList.add('lotus-ready');
      if (item.index === 0) showLotusStage(stage);
      syncLotusMotion();
    }).catch(() => {
      if (request !== item.request) return;
      item.pending = false;
      item.error = true;
      delete item.element.dataset.lotusPending;
      item.element.dataset.lotusError = 'true';
      syncLotusMotion();
    });
  }
  function configureLotusLayout(layout) {
    if (lotusLayout === layout) return;
    lotusLayout = layout;
    const profile = lotusProfiles[layout];
    lotusItems.forEach(item => {
      pauseLotusTimer(item);
      item.remaining = null;
      if (item.stage === null && !lotusPaused) {
        const target = (lotusStage + profile.offsets[item.index]) % lotusStageCount;
        if (item.desiredStage !== target) {
          item.request++;
          item.pending = false;
          item.error = false;
          delete item.element.dataset.lotusPending;
          delete item.element.dataset.lotusError;
        }
        item.desiredStage = target;
      }
    });
  }
  function syncLotusMotion() {
    if (!lotusScene || !atmosphere) return;
    const active = atmosphere.dataset.backgroundCurrent === 'lotus';
    if (lotusOptions) lotusOptions.hidden = !active;
    const visible = active && wideBackground.matches && !document.hidden;
    const items = visibleLotusItems();
    const canLoad = visible && (backgroundUserInitiated || portraitHeadStartElapsed || !portraitImage || portraitImage.complete);
    const profile = lotusProfiles[lotusLayout || 'fixed'];
    lotusItems.forEach(item => {
      const inLayout = items.includes(item);
      if (canLoad && inLayout && !item.pending && !item.error && item.stage !== item.desiredStage) {
        requestLotusStage(item, item.desiredStage, true);
      }
      const playing = visible && inLayout && !lotusPaused && !reducedMotion.matches && !item.pending && !item.error && item.stage !== null;
      item.element.classList.toggle('lotus-is-playing', playing);
      if (!playing) pauseLotusTimer(item);
      else if (!item.timer) {
        const interval = Math.round(profile.holds[item.index] * lotusStageHolds[item.stage]);
        const delay = item.remaining ?? interval;
        item.element.dataset.lotusInterval = String(interval);
        item.dueAt = performance.now() + delay;
        item.timer = setTimeout(() => {
          item.timer = 0;
          item.remaining = null;
          requestLotusStage(item, (item.stage + 1) % lotusStageCount);
          syncLotusMotion();
        }, delay);
      }
    });
    const playingItems = items.filter(item => item.timer);
    lotusScene.classList.toggle('lotus-is-playing', playingItems.length > 0);
    updateLotusLabels();
    if (playingItems.length && !items.some(item => item.pending) && (!portraitImage || portraitImage.complete)) {
      // Warm only the next imminent change, using the shared two-download queue.
      const soonest = playingItems.reduce((first, item) => item.dueAt < first.dueAt ? item : first);
      loadLotusStage((soonest.stage + 1) % lotusStageCount).catch(() => {});
    }
  }
  function updateImageryStatus() {
    const options = document.querySelector('[data-imagery-options]');
    const scene = atmosphere?.querySelector('.imagery-scene[data-active], .has-raster-art[data-active]');
    if (options) options.hidden = !scene;
    if (!scene) return;
    const images = [...scene.querySelectorAll('img[data-imagery-src]')];
    const failed = images.some(image => image.hasAttribute('data-art-error'));
    const pending = images.some(image => !image.hasAttribute('data-art-ready') && !image.hasAttribute('data-art-error'));
    const status = document.querySelector('[data-imagery-status]');
    if (status) {
      status.hidden = !failed && !pending;
      status.textContent = failed
        ? (language === 'zh' ? '部分形象尚未加载，可重试。' : 'Some artwork could not load. You can retry.')
        : (language === 'zh' ? '正在加载形象…' : 'Loading artwork…');
    }
    const retry = document.querySelector('[data-imagery-retry]');
    if (retry) retry.hidden = !failed;
  }
  function syncImagery() {
    updateImageryStatus();
    const scene = atmosphere?.querySelector('.imagery-scene[data-active], .has-raster-art[data-active]');
    if (!scene || document.hidden || !wideBackground.matches) return;
    if (!backgroundUserInitiated && portraitImage && !portraitImage.complete) return;
    let running = lotusLoading + atmosphere.querySelectorAll('[data-art-loading]').length;
    for (const image of scene.querySelectorAll('img[data-imagery-src]')) {
      if (running >= 2) break;
      if (image.hasAttribute('data-art-ready') || image.hasAttribute('data-art-loading') || image.hasAttribute('data-art-error')) continue;
      running++;
      image.setAttribute('data-art-loading', '');
      let settled = false;
      let deadline = 0;
      function finish(success) {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        image.onload = image.onerror = null;
        image.removeAttribute('data-art-loading');
        image.setAttribute(success ? 'data-art-ready' : 'data-art-error', '');
        if (success) window.JiaArtLoops?.imagery(image);
        pumpLotusQueue();
        syncImagery();
      }
      image.onload = async () => {
        try { await image.decode(); finish(true); }
        catch (_) { finish(false); }
      };
      image.onerror = () => finish(false);
      deadline = setTimeout(() => finish(false), 45000);
      image.src = image.dataset.imagerySrc;
    }
  }
  function updateBackgroundLabels() {
    updateLotusLabels();
    updateImageryStatus();
    const motionOptions = document.querySelector('[data-art-motion-options]');
    if (motionOptions) motionOptions.hidden = !['lotus','ziwei-cinematic','ganzhi-cinematic'].includes(atmosphere?.dataset.backgroundCurrent);
    if (!autoBackgroundButton) return;
    autoBackgroundButton.disabled = reducedMotion.matches;
    autoBackgroundButton.title = reducedMotion.matches
      ? (language === "zh" ? "系统已启用减少动态效果" : "Reduced motion is enabled") : "";
  }
  function showBackground(scene) {
    if (!atmosphere) return;
    atmosphere.dataset.backgroundCurrent = scene;
    atmosphere.querySelectorAll("[data-background-scene]").forEach(layer => {
      layer.toggleAttribute("data-active", layer.dataset.backgroundScene === scene);
    });
  }
  function syncBackgroundMotion() {
    clearTimeout(backgroundTimer);
    backgroundTimer = 0;
    if (!atmosphere) return;
    const moving = !document.hidden && wideBackground.matches && !reducedMotion.matches;
    atmosphere.classList.toggle("is-moving", moving);
    updateBackgroundLabels();
    syncLotusMotion();
    syncImagery();
    if (moving && backgroundChoice === "auto") {
      backgroundTimer = setTimeout(() => {
        const next = (backgroundScenes.indexOf(atmosphere.dataset.backgroundCurrent) + 1) % backgroundScenes.length;
        showBackground(backgroundScenes[next]);
        syncBackgroundMotion();
      }, 30000);
    }
  }
  function saveBackgroundPreferences() {
    if (!atmosphere) return;
    try {
      localStorage.setItem("jia-li-background", backgroundChoice);
      localStorage.setItem("jia-li-background-layout", atmosphere.dataset.backgroundLayout);
      localStorage.setItem("jia-li-background-visibility", backgroundVisibility);
    } catch (_) { /* Keep the controls usable without storage. */ }
    // A shared comparison URL should not override a later manual choice on reload.
    try {
      const url = new URL(location.href);
      if (url.searchParams.has("background") || url.searchParams.has("placement") || url.searchParams.has("visibility")) {
        url.searchParams.delete("background");
        url.searchParams.delete("placement");
        url.searchParams.delete("visibility");
        history.replaceState(null, "", url.href);
      }
    } catch (_) { /* Static-file previews also work without history access. */ }
  }
  function chooseBackground(choice, save = true) {
    if (save) backgroundUserInitiated = true;
    if (choice === 'ziwei') choice = 'ziwei-cinematic';
    if (choice === 'ganzhi') choice = 'ganzhi-cinematic';
    backgroundChoice = availableBackgrounds.includes(choice) || choice === "auto" ? choice : "trajectory";
    if (atmosphere) atmosphere.dataset.backgroundChoice = backgroundChoice;
    showBackground(backgroundChoice === "auto" ? "lotus" : backgroundChoice);
    document.querySelectorAll("[data-background]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.background === backgroundChoice));
    });
    syncBackgroundMotion();
    if (save) saveBackgroundPreferences();
  }
  function chooseBackgroundLayout(layout, save = true) {
    const placement = layout === "page" ? "page" : "fixed";
    if (atmosphere) atmosphere.dataset.backgroundLayout = placement;
    configureLotusLayout(placement);
    document.querySelectorAll("button[data-background-layout]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.backgroundLayout === placement));
    });
    resetAtmosphere();
    syncLotusMotion();
    if (save) saveBackgroundPreferences();
  }
  function chooseBackgroundVisibility(visibility, save = true) {
    backgroundVisibility = visibility === "subtle" ? "subtle" : "clear";
    if (atmosphere) atmosphere.dataset.backgroundVisibility = backgroundVisibility;
    document.querySelectorAll("button[data-background-visibility]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.backgroundVisibility === backgroundVisibility));
    });
    if (save) saveBackgroundPreferences();
  }
  function chooseArtMotion(value, save = true) {
    const motion = value === 'still' ? 'still' : 'loop';
    if (atmosphere) atmosphere.dataset.artMotion = motion;
    document.querySelectorAll('button[data-art-motion]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.artMotion === motion));
    });
    if (save) {
      try { localStorage.setItem('jia-li-art-motion',motion); } catch (_) { /* Switching remains available. */ }
      const url = new URL(location.href);
      if (url.searchParams.has('artmotion')) {
        url.searchParams.delete('artmotion');
        history.replaceState(null,'',url.pathname+url.search+url.hash);
      }
    }
    window.JiaArtLoops?.wake();
  }
  if (atmosphere && backgroundSwitch) {
    showLotusStage(lotusStage);
    let savedBackground = "trajectory";
    let savedPlacement = "fixed";
    let savedVisibility = "clear";
    let savedArtMotion = "loop";
    try {
      savedBackground = localStorage.getItem("jia-li-background") || savedBackground;
      savedPlacement = localStorage.getItem("jia-li-background-layout") || savedPlacement;
      savedVisibility = localStorage.getItem("jia-li-background-visibility") || savedVisibility;
      savedArtMotion = localStorage.getItem('jia-li-art-motion') || savedArtMotion;
    } catch (_) { /* Use the original design by default. */ }
    const comparison = new URLSearchParams(location.search);
    const requestedLotus = lotusButtons.find(button => button.dataset.lotusName === comparison.get('lotus'));
    if (requestedLotus) {
      lotusPaused = true;
      lotusStage = Number(requestedLotus.dataset.lotusStage);
      lotusItems.forEach(item => { item.desiredStage = lotusStage; });
      backgroundUserInitiated = true;
      showLotusStage(lotusStage);
    }
    chooseArtMotion(comparison.get('artmotion') || savedArtMotion, false);
    chooseBackgroundVisibility(comparison.get("visibility") || savedVisibility, false);
    chooseBackgroundLayout(comparison.get("placement") || savedPlacement, false);
    chooseBackground(comparison.get("background") || savedBackground, false);
    backgroundSwitch.hidden = false;
    document.querySelectorAll("[data-background]").forEach(button => {
      button.addEventListener("click", () => chooseBackground(button.dataset.background));
    });
    document.querySelectorAll("button[data-background-layout]").forEach(button => {
      button.addEventListener("click", () => chooseBackgroundLayout(button.dataset.backgroundLayout));
    });
    document.querySelectorAll("button[data-background-visibility]").forEach(button => {
      button.addEventListener("click", () => chooseBackgroundVisibility(button.dataset.backgroundVisibility));
    });
    document.querySelectorAll('button[data-art-motion]').forEach(button => {
      button.addEventListener('click',() => chooseArtMotion(button.dataset.artMotion));
    });
    lotusButtons.forEach(button => {
      button.addEventListener('click', () => {
        backgroundUserInitiated = true;
        lotusPaused = true;
        const stage = Number(button.dataset.lotusStage);
        lotusItems.forEach(item => {
          pauseLotusTimer(item);
          item.request++;
          item.pending = false;
          item.error = false;
          item.remaining = null;
          item.desiredStage = stage;
          delete item.element.dataset.lotusPending;
          delete item.element.dataset.lotusError;
        });
        saveLotusPlayback(stage);
        syncLotusMotion();
      });
    });
    lotusRetry?.addEventListener('click', () => {
      backgroundUserInitiated = true;
      visibleLotusItems().filter(item => item.error).forEach(item => requestLotusStage(item, item.desiredStage, true));
      syncLotusMotion();
    });
    document.querySelector('[data-imagery-retry]')?.addEventListener('click', () => {
      atmosphere.querySelectorAll('.atmosphere-theme[data-active] [data-art-error]').forEach(image => image.removeAttribute('data-art-error'));
      syncImagery();
    });
    lotusToggle?.addEventListener('click', () => {
      backgroundUserInitiated = true;
      lotusPaused = !lotusPaused;
      if (!lotusPaused) visibleLotusItems().filter(item => item.error).forEach(item => requestLotusStage(item, item.desiredStage, true));
      saveLotusPlayback();
      syncLotusMotion();
    });
    portraitImage?.addEventListener('load', syncBackgroundMotion);
    portraitImage?.addEventListener('error', syncBackgroundMotion);
    // Give the portrait a head start, without making a stalled photo block lotus.
    setTimeout(() => {
      portraitHeadStartElapsed = true;
      syncLotusMotion();
    }, 1200);
    document.addEventListener("visibilitychange", syncBackgroundMotion);
    wideBackground.addEventListener("change", syncBackgroundMotion);
    reducedMotion.addEventListener("change", syncBackgroundMotion);
    document.addEventListener("click", event => {
      if (!backgroundSwitch.contains(event.target)) backgroundSwitch.open = false;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && backgroundSwitch.open) {
        backgroundSwitch.open = false;
        backgroundSwitch.querySelector("summary").focus({ preventScroll: true });
      }
    });
  }

  function updateCopyLabels() {
    const labels = language === "zh"
      ? { ready: "复制引用", copied: "已复制", failed: "请选中上方文本复制" }
      : { ready: "Copy citation", copied: "Copied", failed: "Select the citation above to copy" };
    document.querySelectorAll(".copy-citation").forEach(button => {
      button.textContent = labels[button.dataset.copyState || "ready"];
    });
  }

  function setLanguage(next) {
    language = next === "zh" ? "zh" : "en";
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-lang]").forEach(el => { el.hidden = el.dataset.lang !== language; });
    document.querySelectorAll("[data-set-lang]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.setLang === language));
    });
    document.querySelectorAll("[data-label-en]").forEach(el => {
      el.setAttribute("aria-label", el.dataset[language === "zh" ? "labelZh" : "labelEn"]);
    });
    document.querySelectorAll("[data-alt-en]").forEach(el => {
      el.alt = el.dataset[language === "zh" ? "altZh" : "altEn"];
    });
    document.getElementById("celebration-status").textContent = "";
    updateCopyLabels();
    updateBackgroundLabels();
    mediaControllers.forEach(controller => controller.updateLabel());
    try { localStorage.setItem("jia-li-language", language); } catch (_) { /* Keep static-file support. */ }
  }

  document.querySelectorAll("[data-set-lang]").forEach(button => {
    button.addEventListener("click", () => setLanguage(button.dataset.setLang));
  });

  const nameFontSwitch = document.querySelector('.name-font-switch');
  function setNameFont(value, save = true) {
    const font = value === 'original' ? 'original' : 'classic';
    document.documentElement.dataset.nameFont = font;
    document.querySelectorAll('button[data-name-font]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.nameFont === font));
    });
    if (save) {
      try { localStorage.setItem('jia-li-name-font', font); } catch (_) { /* Keep switching available without storage. */ }
      const url = new URL(location.href);
      if (url.searchParams.has('namefont')) {
        url.searchParams.delete('namefont');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    }
  }
  document.querySelectorAll('button[data-name-font]').forEach(button => {
    button.addEventListener('click', () => setNameFont(button.dataset.nameFont));
  });
  if (nameFontSwitch) {
    setNameFont(document.documentElement.dataset.nameFont, false);
    nameFontSwitch.hidden = false;
    document.addEventListener('click', event => {
      if (!nameFontSwitch.contains(event.target)) nameFontSwitch.open = false;
    });
    nameFontSwitch.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        nameFontSwitch.open = false;
        nameFontSwitch.querySelector('summary').focus({ preventScroll: true });
      }
    });
  }

  function setPortraitStyle(next) {
    const style = next === "planet" ? "planet" : "stars";
    document.querySelectorAll("[data-portrait-decoration]").forEach(decoration => {
      decoration.hidden = decoration.dataset.portraitDecoration !== style;
    });
    document.querySelectorAll("[data-portrait-style]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.portraitStyle === style));
    });
    try { localStorage.setItem("jia-li-portrait-style", style); } catch (_) { /* Keep switching available when storage is disabled. */ }
  }

  document.querySelectorAll("[data-portrait-style]").forEach(button => {
    button.addEventListener("click", () => setPortraitStyle(button.dataset.portraitStyle));
  });

  document.querySelectorAll(".copy-citation").forEach(button => {
    if (!navigator.clipboard || !window.isSecureContext) return;
    button.hidden = false;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.closest(".citation-body").querySelector("code").textContent);
        button.dataset.copyState = "copied";
      } catch (_) {
        button.dataset.copyState = "failed";
      }
      updateCopyLabels();
    });
  });

  document.querySelectorAll(".paper").forEach(paper => {
    const video = paper.querySelector("video");
    if (!video) return;
    const media = paper.querySelector(".paper-media");
    const button = paper.querySelector(".demo-toggle");
    let hovering = false;
    let pinned = false;
    let suppressed = false;
    let version = 0;
    function updateLabel() {
      const playing = !video.paused;
      button.setAttribute("aria-pressed", String(playing));
      button.textContent = language === "zh" ? (playing ? "暂停演示" : "播放演示") : (playing ? "Pause demo" : "Play demo");
    }
    async function sync() {
      const thisVersion = ++version;
      const desired = !document.hidden && !suppressed && (pinned || (hovering && !reducedMotion.matches));
      if (!desired) {
        video.pause();
        media.classList.remove("demo-active");
        updateLabel();
        return;
      }
      try {
        await video.play();
        if (thisVersion === version && !video.paused) media.classList.add("demo-active");
      } catch (_) {
        media.classList.remove("demo-active");
      }
      updateLabel();
    }
    media.addEventListener("pointerenter", event => {
      if (event.pointerType === "touch") return;
      hovering = true; suppressed = false; sync();
    });
    media.addEventListener("pointerleave", () => { hovering = false; suppressed = false; sync(); });
    media.addEventListener("focusin", () => { hovering = true; suppressed = false; sync(); });
    media.addEventListener("focusout", event => {
      if (!media.contains(event.relatedTarget)) { hovering = false; sync(); }
    });
    button.addEventListener("click", () => {
      if (!video.paused) { pinned = false; suppressed = true; }
      else { pinned = true; suppressed = false; }
      sync();
    });
    video.addEventListener("pause", updateLabel);
    video.addEventListener("play", updateLabel);
    video.addEventListener("error", () => {
      media.classList.remove("demo-active");
      button.textContent = language === "zh" ? "演示暂不可用" : "Demo unavailable";
      button.disabled = true;
    });
    const controller = { sync, updateLabel };
    mediaControllers.push(controller);
  });
  document.addEventListener("visibilitychange", () => mediaControllers.forEach(controller => controller.sync()));
  reducedMotion.addEventListener("change", () => mediaControllers.forEach(controller => controller.sync()));

  const layer = document.getElementById("effect-layer");
  const emoji = [
    // 历代站标独立保存，避免换 favicon 时把点击图案一起替换。
    { image: "assets/icons/lotus-pink-gold-transparent.svg" },
    { image: "assets/icons/jl-square.svg" },
    // 原来的 15 个全部保留。
    "✨", "🤖", "🥳", "⚡", "🌾", "💧", "🔥", "🤩", "🌈", "🚀", "🥇", "🏆", "💎", "🌌", "🪐",
    // 星星、流星与闪光。
    "⭐", "🌟", "💫", "🌠", "☄️",
    // 扑克牌的四种花色。
    "♠️", "♥️", "♣️", "♦️",
    // 雪花、水晶球与思考。
    "❄️", "🔮", "🤔",
    // 月亮、月相与月亮表情。
    "🌙", "🌕",
    // 暂停使用的黑色、部分暗面及表情月亮：["🌑", "🌒", "🌓", "🌔", "🌖", "🌗", "🌘", "🌚", "🌝", "🌛", "🌜"]。
    // 学业。
    "🎓",
    // 十二生肖：鼠、牛、虎、兔、龙、蛇、马、羊、猴、鸡、狗、猪。
    // "🐀", "🐂", "🐅", "🐇", "🐉", "🐍", "🐎", "🐐", "🐒", "🐓", "🐕", "🐖",
    // 积极、开心与鼓励。
    "😀", "😃", "😄", "😁", "😊", "🥰", "🤗", "😎", "💪", "👏", "🙌", "👍", "🍀", "🌻",
    // 奶酪与参考主页标签图标中的星光圆月。
    "🧀", { image: "assets/effects/sparkling-moon.png" },
    // 探索、星光与温暖的小物。
    "🛸", "🌞", "🔭", "🪄", "🫧", "🍪", "🍯", "🦋"
  ];
  // 备选（尚未启用）：["✨", "🤖", "🦾", "🌱", "🪐", "🚀"]
  let emojiIndex = 0;
  const clickIconSources = new Map(Array.from(document.getElementById('click-icon-library')?.content.querySelectorAll('img') || [], image => [image.dataset.particleSrc, image.src]));
  function animateParticle(element, frames, options) {
    layer.appendChild(element);
    element.animate(frames, options).finished.then(() => element.remove()).catch(() => element.remove());
  }
  document.addEventListener("pointerup", event => {
    if (event.button !== 0 || reducedMotion.matches || event.target.closest("[data-celebrate]") || window.getSelection().toString()) return;
    if (layer.childElementCount > 45) return;
    const symbol = emoji[emojiIndex++ % emoji.length];
    const item = document.createElement(typeof symbol === "string" ? "span" : "img");
    item.className = "click-emoji";
    if (typeof symbol === "string") item.textContent = symbol;
    else { item.src = clickIconSources.get(symbol.image) || symbol.image; item.dataset.particleSrc = symbol.image; item.alt = ""; item.width = 22; item.height = 22; }
    item.style.left = `${Math.max(12, Math.min(innerWidth - 25, event.clientX - 8))}px`;
    item.style.top = `${event.clientY - 16}px`;
    animateParticle(item, [{ transform: "translateY(0) scale(1.2)", opacity: 1 }, { transform: "translateY(-65px) scale(1.4)", opacity: 0 }], { duration: 1100, easing: "ease-out" });
  });
  document.querySelectorAll("[data-celebrate]").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById("celebration-status").textContent = language === "zh" ? "庆祝 UFO 技术报告发布！" : "Celebrating the UFO technical report release!";
      if (reducedMotion.matches || layer.childElementCount > 50) return;
      const rect = button.getBoundingClientRect();
      const colors = ["#ff6a00", "#ed3d67", "#1e88c8", "#f2bf20", "#4a9b46"];
      for (let i = 0; i < 35; i++) {
        const item = document.createElement("span");
        item.className = "confetti-piece";
        item.style.left = `${rect.left + rect.width / 2}px`;
        item.style.top = `${rect.top}px`;
        item.style.background = colors[i % colors.length];
        const x = (Math.random() - 0.5) * 390;
        const y = 90 + Math.random() * 130;
        animateParticle(item, [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${x * 0.6}px,-90px) rotate(180deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${x}px,${y}px) rotate(${360 + i * 15}deg)`, opacity: 0 }
        ], { duration: 1500 + Math.random() * 450, easing: "cubic-bezier(.15,.5,.5,1)" });
      }
    });
  });

  let saved = "en";
  try { saved = localStorage.getItem("jia-li-language") || "en"; } catch (_) { /* Keep the default. */ }
  setLanguage(saved);
  document.querySelector(".language-switch").hidden = false;
  let savedPortraitStyle = "stars";
  try { savedPortraitStyle = localStorage.getItem("jia-li-portrait-style") || "stars"; } catch (_) { /* Keep the original decoration. */ }
  setPortraitStyle(savedPortraitStyle);
  document.querySelectorAll(".portrait-style-switch").forEach(control => { control.hidden = false; });
})();
