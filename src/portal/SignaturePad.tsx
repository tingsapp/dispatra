import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

/** Finger or mouse signature captured on a white canvas and handed back as a base64 PNG. */
export function SignaturePad({ disabled, onSave }: { disabled?: boolean; onSave: (pngBase64: string) => void | Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const reset = () => {
    const element = canvas.current; const context = element?.getContext('2d');
    if (!element || !context) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = element.clientWidth * ratio; element.height = element.clientHeight * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, element.clientWidth, element.clientHeight);
    context.lineWidth = 2.2; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#0f172a';
    setEmpty(true);
  };
  useEffect(reset, []);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const box = event.currentTarget.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top] as const; };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const context = event.currentTarget.getContext('2d'); if (!context) return;
    event.currentTarget.setPointerCapture?.(event.pointerId); drawing.current = true;
    const [x, y] = point(event); context.beginPath(); context.moveTo(x, y); context.lineTo(x + 0.01, y + 0.01); context.stroke(); setEmpty(false);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext('2d'); if (!context) return;
    const [x, y] = point(event); context.lineTo(x, y); context.stroke();
  };
  const end = () => { drawing.current = false; };
  const save = () => { const data = canvas.current?.toDataURL('image/png').split(',')[1]; if (data) void onSave(data); };
  return <div className="space-y-2">
    <canvas ref={canvas} aria-label="Signature pad" role="img" className="h-44 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white"
      onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end} />
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">Ask the recipient to sign above.</p>
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={disabled || empty} onClick={reset}>Clear</Button><Button type="button" disabled={disabled || empty} onClick={save}>Save signature</Button></div></div>
  </div>;
}
