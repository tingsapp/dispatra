import React from 'react';
import { Select } from '../ui/Select';
import { DateTimePicker } from '../ui/DateTimePicker';
import { splitTags } from '../../domain/validation';
export const fieldClass = 'app-input';
const Hint = ({ children }: { children?: React.ReactNode }) => children ? <span className="mt-1 block text-xs text-slate-500">{children}</span> : null;
export function TextField({ label, value, onChange, type = 'text', required = false, placeholder, hint, className }: { label: string; value?: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; hint?: React.ReactNode; className?: string }) {
  return <label className={`block ${className ?? ''}`}><span className="app-label">{label}</span><input className={`${fieldClass} w-full`} type={type} value={value ?? ''} required={required} placeholder={placeholder} onChange={e => onChange(e.target.value)} /><Hint>{hint}</Hint></label>;
}
export function NumberField({ label, value, onChange, step = 'any', hint, className }: { label: string; value?: number; onChange: (v: number | undefined) => void; step?: string; hint?: React.ReactNode; className?: string }) {
  return <label className={`block ${className ?? ''}`}><span className="app-label">{label}</span><input className={`${fieldClass} w-full`} type="number" min="0" step={step} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))} /><Hint>{hint}</Hint></label>;
}
export function Choice({ label, value, options, onChange, required = false, hint, className }: { label: string; value?: string; options: string[] | { value: string; label: string }[]; onChange: (v: string) => void; required?: boolean; hint?: React.ReactNode; className?: string }) {
  return <div className={className}><span className="app-label">{label}{required ? ' *' : ''}</span><Select aria-label={label} aria-required={required || undefined} value={value ?? ''} options={options.map(x => typeof x === 'string' ? { value: x, label: x.toLowerCase().replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()) } : x)} onValueChange={onChange} className="w-full" /><Hint>{hint}</Hint></div>;
}
export function TagsField({ label, value, onChange, placeholder, hint, className }: { label: string; value?: string[]; onChange: (v: string[]) => void; placeholder?: string; hint?: React.ReactNode; className?: string }) {
  // Keep delimiters while typing; normalize on blur so a trailing comma is usable.
  return <label className={`block ${className ?? ''}`}><span className="app-label">{label} (comma separated)</span><input key={(value ?? []).join('|')} className={`${fieldClass} w-full`} defaultValue={(value ?? []).join(', ')} placeholder={placeholder} onBlur={e => onChange(splitTags(e.target.value))} /><Hint>{hint}</Hint></label>;
}
/** Titled group of fields inside a form dialog. */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h4 className="app-section-title">{title}</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">{children}</div></section>;
}
export function CheckField({ label, value, onChange }: { label: string; value?: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} className="accent-slate-900" />{label}</label>;
}
export function DateField({ label, value, onChange, timeZone = 'America/Vancouver' }: { label: string; value?: string | null; onChange: (v: string) => void; timeZone?: string }) {
  return <div><span className="app-label">{label}</span><DateTimePicker aria-label={label} value={value ?? ''} onValueChange={onChange} timeZone={timeZone} /></div>;
}
export function OptionalFields({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="pt-3 space-y-3"><summary className="cursor-pointer text-xs font-medium text-slate-700">{title}</summary><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div></details>;
}
export function ReadFields({ values }: { values: Record<string, React.ReactNode> }) {
  return <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">{Object.entries(values).map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="text-slate-900 break-words mt-1">{value || 'Not set'}</dd></div>)}</dl>;
}
