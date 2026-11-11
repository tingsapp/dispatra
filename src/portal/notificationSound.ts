export type NotificationTone = 'normal' | 'attention';

type AudioContextConstructor = new () => AudioContext;

let context: AudioContext | undefined;

function audioContext() {
  if (typeof window === 'undefined') return undefined;
  const BrowserAudioContext = window.AudioContext || (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!BrowserAudioContext) return undefined;
  context ??= new BrowserAudioContext();
  return context;
}

/** Browsers require one user gesture before background notification sounds can play. */
export function enableNotificationSound() {
  const audio = audioContext();
  if (audio?.state === 'suspended') void audio.resume().catch(() => undefined);
}

/** A short, two-note chime for routine updates and a sharper three-note alert for attention items. */
export function playNotificationSound(tone: NotificationTone) {
  const audio = audioContext();
  if (!audio) return;
  const start = audio.currentTime;
  const notes = tone === 'attention' ? [740, 590, 740] : [660, 880];
  const spacing = tone === 'attention' ? 0.13 : 0.11;
  const length = tone === 'attention' ? 0.1 : 0.09;

  try {
    void audio.resume().catch(() => undefined);
    for (const [index, frequency] of notes.entries()) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = start + index * spacing;
      oscillator.type = tone === 'attention' ? 'square' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(tone === 'attention' ? 0.07 : 0.055, at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(at);
      oscillator.stop(at + length + 0.01);
    }
  } catch {
    // Browsers can block sound before a user gesture; the visual notification remains available.
  }
}

export function notificationTone(severity: 'INFO' | 'WARNING' | 'CRITICAL'): NotificationTone {
  return severity === 'INFO' ? 'normal' : 'attention';
}
