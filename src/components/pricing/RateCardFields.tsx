import React from 'react';
import { Discount, DiscountType, PricingMethod } from '../../types/pricing';
import { Select } from '../ui/Select';
export const fieldClass = 'app-input disabled:bg-slate-100 disabled:text-slate-400';
export const labelClass = 'app-label';
export const hintClass = 'text-xs text-slate-500 mt-1';
export const cardClass = 'app-panel';
export const checkboxClass =
  'app-checkbox';
export const primaryBtn = 'app-action app-primary';
export const secondaryBtn = 'app-action app-secondary';

export const METHOD_LABELS: Record<PricingMethod, string> = {
  BASE_PLUS_DISTANCE: 'Distance based',
  FIXED: 'Fixed per delivery',
  ZONE: 'Zone to zone',
  HOURLY: 'Hourly',
  IMPORTED: 'Imported price'
};

/** Numeric input; always a number. */
export const NumberField: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number | 'any';
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

/** Shipper discount controls, shared by creation and editing. */
export const DiscountEditor: React.FC<{ value: Discount; onChange: (d: Discount) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label className={labelClass}>Discount Type</label>
      <Select
        aria-label="Discount type"
        className="w-full"
        value={value.type === 'INHERIT' ? 'NONE' : value.type}
        onValueChange={(v) => onChange({ ...value, type: v as DiscountType, value: v === 'NONE' ? 0 : v === 'PERCENT' ? Math.min(100, value.value) : value.value, scope: 'TRANSPORT_ONLY' })}
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
      onChange={(v) => onChange({ ...value, value: value.type === 'PERCENT' ? Math.min(100, v) : v })}
      prefix={value.type === 'FIXED' ? '$' : undefined}
      suffix={value.type === 'PERCENT' ? '%' : undefined}
      disabled={value.type !== 'PERCENT' && value.type !== 'FIXED'}
      step={0.5}
      hint="Taken off freight, service charge, minimum and vehicle surcharge. Fuel, Accessorials, service fee and tax are never discounted."
    />
  </div>
);
