import { useEffect, useState } from 'react';

type Reply = { content: string };

/** Reveal only the newest reply; retain the complete response in conversation history. */
export function usePublicChatTyping(reply: Reply | undefined) {
  const [reveal, setReveal] = useState<{ reply?: Reply; count: number }>({ count: 0 });
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!reply) return;
    const characters = Array.from(reply.content);
    if (reducedMotion) { setReveal({ reply, count: characters.length }); return; }
    let frame: number;
    let start: number | undefined;
    let previous = 0;
    const duration = Math.min(6000, characters.length * 10);
    function tick(time: number) {
      start ??= time;
      const count = Math.min(characters.length, Math.max(1, Math.floor((time - start) / Math.max(1, duration) * characters.length)));
      if (count !== previous) { previous = count; setReveal({ reply, count }); }
      if (count < characters.length) frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reply, reducedMotion]);
  const characters = Array.from(reply?.content ?? '');
  const count = reducedMotion ? characters.length : reveal.reply === reply ? reveal.count : 0;
  return { text: characters.slice(0, count).join(''), isTyping: Boolean(reply) && count < characters.length };
}
