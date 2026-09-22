import { MONITOR_CAMERA } from './mapScene';
import { descentEasing, INTRO_TIMING } from './introTiming';

export const INTRO_START = { longitude: 134, latitude: MONITOR_CAMERA.latitude, zoom: -0.8 };
export const INTRO_APPROACH_ZOOM = 2;
export const INTRO_APPROACH_DURATION = INTRO_TIMING.orbit + INTRO_TIMING.approach;

/** Rotate only east/west: fixed latitude and north-up orientation prevent globe tumbling. */
export function introCameraAt(elapsed: number) {
  const approach = Math.min(1, Math.max(0, elapsed / INTRO_APPROACH_DURATION));
  const rotation = descentEasing(approach);
  const descent = Math.min(1, Math.max(0, (elapsed - INTRO_APPROACH_DURATION) / INTRO_TIMING.descent));
  return {
    center: [
      INTRO_START.longitude + (MONITOR_CAMERA.longitude + 360 - INTRO_START.longitude) * rotation,
      MONITOR_CAMERA.latitude,
    ] as [number, number],
    zoom: approach < 1
      ? INTRO_START.zoom + (INTRO_APPROACH_ZOOM - INTRO_START.zoom) * approach
      : INTRO_APPROACH_ZOOM + (MONITOR_CAMERA.zoom - INTRO_APPROACH_ZOOM) * descentEasing(descent),
    bearing: MONITOR_CAMERA.bearing,
    pitch: MONITOR_CAMERA.pitch,
  };
}
