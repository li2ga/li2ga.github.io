import {createLotus, PRELUDE} from './scene.js';

const entrance = document.querySelector('.site-entrance');
const canvas = entrance?.querySelector('.entrance-lotus-canvas');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
if (canvas && entrance.isConnected && document.documentElement.classList.contains('intro-pending') && !reduce.matches) {
  let scene, frame = 0, stopped = false;
  const timeline = entrance.getAnimations().find(a => a.animationName === 'entrance-clear');
  const time = () => Number(timeline?.currentTime || 0) / 1000;
  function stop() {
    if (stopped) return; stopped = true; cancelAnimationFrame(frame);
    scene?.dispose(); entrance.classList.remove('lotus-rendered');
    entrance.removeEventListener('entrance:finish', stop);
    canvas.removeEventListener('webglcontextlost', lost);
    window.removeEventListener('pagehide', stop);
    document.removeEventListener('visibilitychange', hidden);
    reduce.removeEventListener('change', changed);
  }
  function hidden() { if (document.hidden) stop(); }
  function changed() { if (reduce.matches) stop(); }
  function lost(event) { event.preventDefault(); stop(); }
  function tick() {
    if (stopped) return;
    if (!entrance.isConnected || !document.documentElement.classList.contains('intro-pending') || time() >= PRELUDE) { stop(); return; }
    scene.pose(time()); frame = requestAnimationFrame(tick);
  }
  try {
    if (time() < PRELUDE - 1 && !document.hidden) {
      scene = createLotus(canvas);
      entrance.addEventListener('entrance:finish', stop);
      canvas.addEventListener('webglcontextlost', lost);
      window.addEventListener('pagehide', stop);
      document.addEventListener('visibilitychange', hidden);
      reduce.addEventListener('change', changed);
      scene.pose(time()); entrance.classList.add('lotus-rendered'); tick();
    }
  } catch (error) {
    if (new URLSearchParams(location.search).get('intro') === 'preview') console.error(error);
    stop(); /* The inline SVG runs on the same timeline without WebGL. */
  }
}
