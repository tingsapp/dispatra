import { Map as GlobeMap, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { INTRO_TIMING } from './introTiming';
import { INTRO_APPROACH_DURATION, introCameraAt } from './introFlight';
import { INTRO_STYLE } from './introStyle';

setWorkerUrl(workerUrl);

export type IntroPhase = 'loading' | 'orbit' | 'approach' | 'descent' | 'settling' | 'arrived';

/** Owns only the temporary globe; it never receives the operational map's controller. */
export function createIntroGlobe(container: HTMLDivElement, onPhase: (phase: IntroPhase) => void, onFailure: () => void) {
  const map = new GlobeMap({
    container, style: INTRO_STYLE,
    ...introCameraAt(0), minZoom: -3,
    interactive: false,
    attributionControl: false, canvasContextAttributes: { antialias: true },
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    cancelPendingTileRequestsWhileZooming: false,
    fadeDuration: 200,
  });
  let stopped = false;
  let frame = 0;
  let phase: IntroPhase = 'loading';
  const start = () => {
    if (stopped) return;
    const started = performance.now();
    const update = (now: number) => {
      if (stopped) return;
      const elapsed = now - started;
      const flightEnd = INTRO_APPROACH_DURATION + INTRO_TIMING.descent;
      const next: IntroPhase = elapsed < INTRO_TIMING.orbit ? 'orbit'
        : elapsed < INTRO_APPROACH_DURATION ? 'approach'
        : elapsed < flightEnd ? 'descent'
        : elapsed < flightEnd + INTRO_TIMING.settle ? 'settling' : 'arrived';
      map.jumpTo(introCameraAt(elapsed));
      if (next !== phase) {
        phase = next;
        onPhase(phase);
        if (phase === 'approach' || phase === 'descent') {
          map.setPaintProperty('intro-destination', 'circle-opacity', 1);
          map.setPaintProperty('intro-destination', 'circle-stroke-opacity', 0.25);
        }
        if (phase === 'settling' || phase === 'arrived') {
          map.setPaintProperty('intro-destination', 'circle-opacity', 0);
          map.setPaintProperty('intro-destination', 'circle-stroke-opacity', 0);
        }
      }
      if (phase !== 'arrived') frame = requestAnimationFrame(update);
    };
    update(started);
  };
  // Start with the local style, without waiting for any remote satellite tiles.
  map.once('style.load', start);
  map.on('error', onFailure);
  const canvas = map.getCanvas();
  canvas.addEventListener('webglcontextlost', onFailure);
  const resize = new ResizeObserver(() => { if (!stopped) map.resize(); });
  resize.observe(container);
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    map.off('style.load', start);
    resize.disconnect();
    canvas.removeEventListener('webglcontextlost', onFailure);
    map.off('error', onFailure);
    map.remove();
  };
}
