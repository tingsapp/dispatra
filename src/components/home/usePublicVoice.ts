import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../portal/api';

type Connection = {
  peer: RTCPeerConnection;
  audio: HTMLAudioElement;
  stream?: MediaStream;
  channel?: RTCDataChannel;
  endToken?: string;
  timer?: ReturnType<typeof setTimeout>;
};
export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

function release(connection: Connection) {
  clearTimeout(connection.timer);
  connection.stream?.getTracks().forEach(track => track.stop());
  connection.channel?.close();
  connection.peer.close();
  connection.audio.pause();
  connection.audio.srcObject = null;
  if (connection.endToken) void api.endPublicVoice(connection.endToken).catch(() => {});
}

export function usePublicVoice() {
  const current = useRef<Connection | null>(null);
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const stop = useCallback(() => {
    const connection = current.current;
    current.current = null;
    if (connection) release(connection);
    setStatus('idle'); setMuted(false);
  }, []);
  useEffect(() => {
    const leave = () => { stop(); };
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      const connection = current.current;
      current.current = null;
      if (connection) release(connection);
    };
  }, [stop]);

  async function start() {
    if (current.current) return;
    setError(''); setNotice('');
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setError('Voice needs a browser with microphone support and a secure connection. You can still use text chat.');
      return;
    }
    const connection: Connection = { peer: new RTCPeerConnection(), audio: new Audio() };
    current.current = connection;
    setStatus('connecting');
    const fail = (message: string) => {
      if (current.current !== connection) return;
      stop(); setError(message);
    };
    connection.timer = setTimeout(() => fail('Voice could not connect. Please try again or use text chat.'), 35000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (current.current !== connection) { stream.getTracks().forEach(track => track.stop()); return; }
      connection.stream = stream;
      stream.getTracks().forEach(track => connection.peer.addTrack(track, stream));
      connection.audio.autoplay = true;
      connection.peer.ontrack = event => {
        if (current.current !== connection) return;
        connection.audio.srcObject = new MediaStream([event.track]);
        void connection.audio.play().catch(() => fail('Audio playback was blocked. Please start voice again or use text chat.'));
      };
      connection.peer.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(connection.peer.connectionState)) {
          fail('Voice disconnected. Please start again or continue in text chat.');
        }
      };
      const channel = connection.peer.createDataChannel('oai-events');
      connection.channel = channel;
      channel.onopen = () => {
        if (current.current !== connection) return;
        clearTimeout(connection.timer);
        connection.timer = setTimeout(() => {
          if (current.current !== connection) return;
          stop(); setNotice('The five-minute voice session has ended. You can start another or continue in text.');
        }, 300000);
        setStatus('listening');
        channel.send(JSON.stringify({ type: 'response.create' }));
      };
      channel.onclose = () => fail('Voice ended. You can start again or continue in text chat.');
      channel.onmessage = ({ data }: MessageEvent<string>) => {
        if (current.current !== connection) return;
        let event: { type: string };
        try { event = JSON.parse(data) as { type: string }; } catch { return; }
        if (event.type === 'error') fail('Voice is unavailable right now. Please try again or use text chat.');
        else if (event.type === 'input_audio_buffer.speech_started') setStatus('listening');
        else if (event.type === 'response.created') setStatus('thinking');
        else if (event.type === 'output_audio_buffer.started') setStatus('speaking');
        else if (event.type === 'output_audio_buffer.stopped' || event.type === 'output_audio_buffer.cleared') setStatus('listening');
      };
      const offer = await connection.peer.createOffer();
      await connection.peer.setLocalDescription(offer);
      if (current.current !== connection) return;
      const session = await api.startPublicVoice({ sdp: offer.sdp! });
      connection.endToken = session.end_token;
      if (current.current !== connection) { release(connection); return; }
      await connection.peer.setRemoteDescription({ type: 'answer', sdp: session.sdp });
    } catch (cause) {
      const denied = cause instanceof DOMException && ['NotAllowedError', 'PermissionDeniedError'].includes(cause.name);
      fail(denied ? 'Microphone access was denied. Allow it in your browser to use voice, or continue in text.'
        : 'Voice could not start. Check your microphone and connection, or continue in text chat.');
    }
  }
  function toggleMute() {
    const stream = current.current?.stream;
    if (!stream) return;
    stream.getAudioTracks().forEach(track => { track.enabled = muted; });
    setMuted(value => !value);
  }
  return { status, muted, error, notice, start, stop, toggleMute, active: status !== 'idle' };
}
