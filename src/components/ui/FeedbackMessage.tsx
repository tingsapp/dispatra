import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FeedbackTone } from './popupFeedback';

const TONES: Record<FeedbackTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  error: { icon: XCircle, className: 'border-red-200 bg-red-50 text-red-700' },
  warning: { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  info: { icon: Info, className: 'border-slate-200 bg-slate-50 text-slate-700' },
};

/** Compact, colour-coded result of an action; errors interrupt screen readers, the rest are polite.
 *  `announce={false}` inside an existing live region, so the message is read once. */
export function FeedbackMessage({ message, tone = 'info', onDismiss, className, announce = true }: { message: string; tone?: FeedbackTone; onDismiss?: () => void; className?: string; announce?: boolean }) {
  const { icon: Icon, className: colors } = TONES[tone];
  const live = announce ? { role: tone === 'error' ? 'alert' : 'status', 'aria-live': tone === 'error' ? 'assertive' as const : 'polite' as const, 'aria-atomic': true } : {};
  return <div {...live} data-tone={tone}
    className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-[18px]', colors, className)}>
    <Icon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
    <span className="min-w-0 flex-1">{message}</span>
    {onDismiss && <button type="button" aria-label="Dismiss message" onClick={onDismiss} className="-mr-1 shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"><X className="size-3.5" /></button>}
  </div>;
}
