import { useEffect, useRef } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import type { VoiceStatus } from './usePublicVoice';

type Props = {
  status: VoiceStatus;
  muted: boolean;
  onMute: () => void;
  onEnd: () => void;
};

export function VoiceWaveIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true" data-voice-icon="true">
    <rect x="3" y="9" width="2.5" height="6" rx="1.25" />
    <rect x="7" y="5.5" width="2.5" height="13" rx="1.25" />
    <rect x="11" y="3" width="2.5" height="18" rx="1.25" />
    <rect x="15" y="6.5" width="2.5" height="11" rx="1.25" />
    <rect x="19" y="9.5" width="2.5" height="5" rx="1.25" />
  </svg>;
}

export function PublicVoicePanel({ status, muted, onMute, onEnd }: Props) {
  const endButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { endButton.current?.focus({ preventScroll: true }); }, []);
  const label = status === 'connecting' ? 'Connecting…' : muted ? 'Microphone muted' : status === 'speaking' ? 'Dispatra is speaking…' : status === 'thinking' ? 'Thinking…' : 'Listening…';
  return <section onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onEnd(); } }} className="public-voice-session" aria-label="Voice conversation" data-state={status} data-muted={muted}>
    <div className="public-voice-orb" aria-hidden="true"><span /><span /><span /></div>
    <h2 className="public-voice-name">Dispatra</h2>
    <p role="status" className="public-voice-status">{label}</p>
    <div className="public-voice-controls">
      <button type="button" className="public-voice-control" onClick={onMute} disabled={status === 'connecting'} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={muted} title={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff size={21} strokeWidth={1.6} aria-hidden="true" /> : <Mic size={21} strokeWidth={1.6} aria-hidden="true" />}</button>
      <button ref={endButton} type="button" className="public-voice-control public-voice-end" onClick={onEnd} aria-label="End voice" title="End voice"><X size={23} strokeWidth={1.6} aria-hidden="true" /></button>
    </div>
    <p className="public-voice-note">Voice chats are separate from text<span aria-hidden="true"> · </span><span>Up to 5 minutes</span></p>
  </section>;
}
