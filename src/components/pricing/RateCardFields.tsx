import React from 'react';
import { Discount, DiscountType, PricingMethod } from '../../types/pricing';
import { Select } from '../ui/Select';
export const fieldClass =
  'w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400';
export const labelClass = 'block text-xs font-medium text-slate-700 mb-1.5';
export const hintClass = 'text-[11px] text-slate-500 mt-1';
export const cardClass = 'bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs';
export const checkboxClass =
  'w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer';
export const primaryBtn =
  'flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors';
export const secondaryBtn =
  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs';

export const METHOD_LABELS: Record<PricingMethod, string> = {
  BASE_PLUS_DISTANCE: 'Base + Distance',
  FIXED: 'Fixed per delivery',
  ZONE: 'Zone to zone',
  HOURLY: 'Hourly / dedicated',
  IMPORTED: 'Imported price'
};

/** Numeric input; always a number. */
export const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  hint?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, prefix, suffix, step = 0.01, hint, disabled }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{prefix}</span>}
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className={`${fieldClass} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{suffix}</span>}
    </div>
    {hint && <p className={hintClass}>{hint}</p>}
  </div>
);

/** Numeric input where blank means "inherit"; shows the inherited value as placeholder. */
export const DiscountEditor: React.FC<{ value: Discount; onChange: (d: Discount) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label className={labelClass}>Discount Type</label>
      <Select
        aria-label="Discount type"
        className="w-full"
        value={value.type === 'INHERIT' ? 'NONE' : value.type}
        onValueChange={(v) => onChange({ ...value, type: v as DiscountType, scope: 'TRANSPORT_ONLY' })}
        options={[
          { value: 'NONE', label: 'No discount' },
          { value: 'PERCENT', label: 'Percentage' },
          { value: 'FIXED', label: 'Fixed amount' }
        ]}
      />
    </div>
    <NumberField
      label={value.type === 'FIXED' ? 'Amount (excludes tax)' : 'Percentage'}
      value={value.value}
      onChange={(v) => onChange({ ...value, value: v })}
      prefix={value.type === 'FIXED' ? '$' : undefined}
      suffix={value.type === 'PERCENT' ? '%' : undefined}
      disabled={value.type !== 'PERCENT' && value.type !== 'FIXED'}
      step={0.5}
      hint="Taken off freight, service multiplier, minimum and vehicle surcharge. Fuel, Accessorials, service fee and tax are never discounted."
    />
  </div>
);
