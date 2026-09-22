import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { createIntroGlobe, type IntroPhase } from './introGlobe';
import './mapIntro.css';
import { INTRO_TIMING } from './introTiming';

export function MapIntro({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const globe = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<IntroPhase>('loading');
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    if (!globe.current) return;
    try { return createIntroGlobe(globe.current, setPhase, onFinish); }
    catch { onFinish(); }
  }, [onFinish]);
  useEffect(() => {
    if (phase !== 'arrived' || !ready) return;
    setRevealing(true);
    const timer = window.setTimeout(onFinish, INTRO_TIMING.reveal);
    return () => window.clearTimeout(timer);
  }, [phase, ready, onFinish]);

  return <section className={`map-intro ${revealing ? 'map-intro-reveal' : ''}`} aria-label="Map introduction" data-phase={phase}
    style={{ '--intro-flight-duration': `${INTRO_TIMING.orbit + INTRO_TIMING.approach + INTRO_TIMING.descent + INTRO_TIMING.settle}ms`, '--intro-reveal-duration': `${INTRO_TIMING.reveal}ms` } as CSSProperties}>
    <div className="map-intro-stars" aria-hidden="true" />
    <div ref={globe} className="map-intro-globe" aria-hidden="true" inert />
    <div className="map-intro-vignette" aria-hidden="true" />
    <div className="map-intro-heading">
      <span className="map-intro-eyebrow">DISPATRA</span>
      <p>{phase === 'loading' || phase === 'orbit' ? 'A world in motion.' : 'A closer view.'}</p>
    </div>
    <div className={`map-intro-destination ${phase === 'loading' || phase === 'orbit' ? 'map-intro-destination-loading' : ''}`}>
      <span className="map-intro-coordinate">49.2827° N &nbsp; 123.1207° W</span>
      <h2>Vancouver</h2>
      <p>British Columbia, Canada</p>
      <div className="map-intro-progress" aria-hidden="true"><span className={phase !== 'loading' ? 'map-intro-progress-moving' : ''} /></div>
    </div>
    <p className="sr-only" role="status">Opening your Vancouver map. You can skip the introduction.</p>
    <button type="button" className="map-intro-skip" onClick={onFinish}>Skip intro <ArrowRight size={15} aria-hidden="true" /></button>
    <span className="map-intro-attribution">Imagery © Esri · Maxar · Earthstar Geographics</span>
  </section>;
}
