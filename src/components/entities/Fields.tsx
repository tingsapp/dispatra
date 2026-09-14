import React from 'react';
import { Select } from '../ui/Select';
import { DateTimePicker } from '../ui/DateTimePicker';
import { splitTags } from '../../domain/validation';
export const fieldClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-slate-400';
export function TextField({ label, value, onChange, type = 'text', required = false }: { label: string; value?: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return <label className="block text-xs text-slate-600 space-y-1"><span>{label}</span><input className={fieldClass} type={type} value={value ?? ''} required={required} onChange={e => onChange(e.target.value)} /></label>;
}
export function NumberField({ label, value, onChange, step = 'any' }: { label: string; value?: number; onChange: (v: number | undefined) => void; step?: string }) {
  return <label className="block text-xs text-slate-600 space-y-1"><span>{label}</span><input className={fieldClass} type="number" min="0" step={step} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></label>;
}
export function Choice({ label, value, options, onChange }: { label: string; value?: string; options: string[] | { value: string; label: string }[]; onChange: (v: string) => void }) {
  return <div className="text-xs text-slate-600 space-y-1"><span>{label}</span><Select aria-label={label} value={value ?? ''} options={options.map(x => typeof x === 'string' ? { value: x, label: x.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) } : x)} onValueChange={onChange} className="w-full" /></div>;
}
export function TagsField({ label, value, onChange }: { label: string; value?: string[]; onChange: (v: string[]) => void }) {
  // Keep delimiters while typing; normalize on blur so a trailing comma is usable.
  return <label className="block text-xs text-slate-600 space-y-1"><span>{label} (comma separated)</span><input key={(value ?? []).join('|')} className={fieldClass} defaultValue={(value ?? []).join(', ')} onBlur={e => onChange(splitTags(e.target.value))} /></label>;
}
export function CheckField({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="accent-slate-900" />{label}</label>;
}
export function DateField({ label, value, onChange, timeZone = 'America/Vancouver' }: { label: string; value?: string | null; onChange: (v: string) => void; timeZone?: string }) {
  return <div className="text-xs text-slate-600 space-y-1"><span>{label}</span><DateTimePicker aria-label={label} value={value ?? ''} onValueChange={onChange} timeZone={timeZone} /></div>;
}
export function OptionalFields({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="border-t border-slate-200 pt-3 space-y-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">{title}</summary><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div></details>;
}
export function ReadFields({ values }: { values: Record<string, React.ReactNode> }) {
  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">{Object.entries(values).map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="text-slate-900 break-words mt-1">{value || 'Not set'}</dd></div>)}</dl>;
}
