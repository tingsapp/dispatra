import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const TONES = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-blue-50 text-blue-700',
} as const;

/** Compact metadata inside Monitor menus; status text stays readable on one line. */
export function MonitorBadge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: keyof typeof TONES }) {
  return <span {...props} className={cn('app-map-badge', TONES[tone], className)} />;
}
