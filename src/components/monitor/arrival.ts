import { createContext, useContext } from 'react';

/** After the flight lands, the map comes alive in layers: stops, then drivers, then routes, then the brief. */
export type ArrivalPhase = 'idle' | 'stops' | 'drivers' | 'routes' | 'done';
export const ARRIVAL_TIMING = { stops: 0, drivers: 500, routes: 950, brief: 1500, done: 2300, briefAutoHide: 9000 } as const;
export const ARRIVAL_ORDER: ArrivalPhase[] = ['stops', 'drivers', 'routes', 'done'];

export const ArrivalContext = createContext<ArrivalPhase>('done');
/** Route lines stay hidden until their turn in the arrival sequence. */
export const useRoutesRevealed = () => { const phase = useContext(ArrivalContext); return phase === 'idle' || phase === 'routes' || phase === 'done'; };
