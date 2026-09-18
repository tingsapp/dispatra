import React from 'react';
export const fieldClass =
  'w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';
export const labelClass = 'block text-xs font-medium text-slate-700 mb-1.5';
export const hintClass = 'text-[11px] text-slate-500 mt-1';
export const cardClass = 'bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs';
export const checkboxClass =
  'w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer';

/** Small labelled numeric field with an optional prefix/suffix adornment. */
export const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  hint?: string;
}> = ({ label, value, onChange, prefix, suffix, step = 0.01, min = 0, hint }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="number"
        step={step}
        min={min}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={`${fieldClass} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
    {hint && <p className={hintClass}>{hint}</p>}
  </div>
);

