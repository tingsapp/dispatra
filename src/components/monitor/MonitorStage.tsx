import type { ReactNode } from 'react';
import { MapIntro } from './MapIntro';
import { MonitorBrief, MonitorBriefData } from './MonitorBrief';
import { ArrivalContext } from './arrival';
import { useMonitorIntro } from './useMonitorIntro';

/** The live map remains mounted at its normal camera beneath a disposable visual intro. */
export function MonitorStage({ children, ready, skipIntro, brief }: { children: ReactNode; ready: boolean; skipIntro: boolean; brief?: MonitorBriefData }) {
  const { playing, finish, content, intro, arrival, brief: showBrief, dismissBrief } = useMonitorIntro(skipIntro);

  return <ArrivalContext.Provider value={arrival}>
    <div ref={content} className="absolute inset-0 z-0 outline-none" tabIndex={-1} aria-label="Monitor map" inert={playing} aria-hidden={playing || undefined} data-arrival={arrival === 'idle' || arrival === 'done' ? undefined : arrival}>
      {children}
    </div>
    {showBrief && brief && <MonitorBrief data={brief} onClose={dismissBrief} />}
    {playing && <div ref={intro}><MapIntro ready={ready} onFinish={finish} /></div>}
  </ArrivalContext.Provider>;
}
