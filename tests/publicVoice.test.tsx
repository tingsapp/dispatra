import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import React from 'react';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/ask-dispatra', pretendToBeVisual: true });
for (const name of ['window','document','navigator','HTMLElement','Element','Node','location','history','DOMException']) Object.defineProperty(globalThis,name,{configurable:true,writable:true,value:dom.window[name as keyof Window]});
window.scrollTo = () => {};
const { render, screen, cleanup, fireEvent, waitFor, act } = await import('@testing-library/react');
const { PublicChatAssistant } = await import('../src/components/home/PublicChatAssistant');
const { api } = await import('../src/portal/api');
const original = { ...api };
let stopped = 0;
let peer: FakePeer;
let microphone: { enabled: boolean; stop: () => void };
let ended: string[] = [];
let requested = 0;
let getMic: () => Promise<MediaStream>;
class FakePeer {
  connectionState = 'new';
  onconnectionstatechange?: () => void;
  channel = { readyState: 'open', onopen: undefined as (() => void) | undefined, onclose: undefined as (() => void) | undefined, onmessage: undefined as ((e: {data: string}) => void) | undefined, close() {}, send() {} };
  constructor() { peer = this; }
  addTrack() {}
  createDataChannel() { return this.channel; }
  async createOffer() { return { sdp: 'v=0\r\no=test\r\n' }; }
  async setLocalDescription() {}
  async setRemoteDescription() { this.channel.onopen?.(); }
  close() { this.connectionState = 'closed'; this.onconnectionstatechange?.(); }
}
Object.defineProperty(globalThis, 'RTCPeerConnection', { configurable: true, value: FakePeer });
Object.defineProperty(globalThis, 'Audio', { configurable: true, value: class { autoplay = false; srcObject = null; pause() {} async play() {} } });
Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => getMic() } });
function setup() {
  stopped = 0; ended = []; requested = 0;
  microphone = { enabled: true, stop: () => { stopped++; } };
  getMic = async () => ({ getTracks: () => [microphone], getAudioTracks: () => [microphone] }) as unknown as MediaStream;
  api.startPublicVoice = async () => { requested++; return { sdp: 'answer', max_seconds: 300, end_token: 'signed-call' }; };
  api.endPublicVoice = async token => { ended.push(token); return undefined as never; };
}
afterEach(() => { cleanup(); Object.assign(api, original); });

test('voice connects, mutes, ends and restores text without saving a transcript', async () => {
  setup(); render(<PublicChatAssistant />);
  fireEvent.click(screen.getByRole('button', { name: 'Start voice chat' }));
  await screen.findByText('Listening…');
  assert.equal(requested, 1);
  assert.equal(screen.getByRole('textbox').hasAttribute('disabled'), true);
  fireEvent.click(screen.getByRole('button', { name: 'Mute microphone' }));
  assert.equal(microphone.enabled, false);
  fireEvent.click(screen.getByRole('button', { name: 'Unmute microphone' }));
  assert.equal(microphone.enabled, true);
  act(() => peer.channel.onmessage?.({ data: JSON.stringify({ type: 'output_audio_buffer.started' }) }));
  assert.ok(screen.getByText('Dispatra is speaking…'));
  fireEvent.click(screen.getByRole('button', { name: 'End voice' }));
  assert.equal(stopped, 1);
  assert.deepEqual(ended, ['signed-call']);
  assert.equal(screen.getByRole('textbox').hasAttribute('disabled'), false);
});

test('permission denial and handshake failure clean up and keep text usable', async () => {
  setup(); getMic = async () => { throw new DOMException('denied', 'NotAllowedError'); };
  const view = render(<PublicChatAssistant />);
  fireEvent.click(screen.getByRole('button', { name: 'Start voice chat' }));
  assert.match((await screen.findByRole('alert')).textContent!, /Microphone access was denied/);
  assert.equal(requested, 0); view.unmount();
  setup(); api.startPublicVoice = async () => { throw new Error('private provider detail'); };
  render(<PublicChatAssistant />); fireEvent.click(screen.getByRole('button', { name: 'Start voice chat' }));
  assert.match((await screen.findByRole('alert')).textContent!, /Voice could not start/);
  assert.equal(stopped, 1);
  assert.equal(screen.getByRole('textbox').hasAttribute('disabled'), false);
});

test('ending while permission or handshake is pending closes late resources', async () => {
  setup(); let grant!: (value: MediaStream) => void;
  getMic = () => new Promise(resolve => { grant = resolve; });
  render(<PublicChatAssistant />); fireEvent.click(screen.getByRole('button', { name: 'Start voice chat' }));
  fireEvent.click(screen.getByRole('button', { name: 'End voice' }));
  await act(async () => grant({ getTracks: () => [microphone] } as unknown as MediaStream));
  assert.equal(stopped, 1); assert.equal(requested, 0); cleanup();
  setup(); let finish!: (value: Awaited<ReturnType<typeof api.startPublicVoice>>) => void;
  api.startPublicVoice = () => { requested++; return new Promise(resolve => { finish = resolve; }); };
  render(<PublicChatAssistant />); fireEvent.click(screen.getByRole('button', { name: 'Start voice chat' }));
  await waitFor(() => assert.equal(requested, 1));
  fireEvent.click(screen.getByRole('button', { name: 'End voice' }));
  await act(async () => finish({ sdp: 'answer', max_seconds: 300, end_token: 'late-call' }));
  assert.deepEqual(ended, ['late-call']);
});

test('navigation and dropped connections release the microphone', async () => {
  setup(); const view = render(<PublicChatAssistant />);
  fireEvent.click(screen.getByRole('button', { name: 'Start voice chat' })); await screen.findByText('Listening…');
  view.unmount(); assert.equal(stopped, 1); assert.deepEqual(ended, ['signed-call']);
  setup(); render(<PublicChatAssistant />);
  fireEvent.click(screen.getByRole('button', { name: 'Start voice chat' })); await screen.findByText('Listening…');
  act(() => { peer.connectionState = 'failed'; peer.onconnectionstatechange?.(); });
  assert.equal(stopped, 1);
  assert.match(screen.getByRole('alert').textContent!, /Voice disconnected/);
});
