import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { AccessorialAutoRule, AccessorialCalcType, AccessorialItem } from '../../types/simplePricing';
import { Select } from '../ui/Select';

interface AccessorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (accessorial: AccessorialItem) => void;
  initialAccessorial?: AccessorialItem | null;
}

const fieldClass =
  'w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400';
const labelClass = 'block text-xs font-medium text-slate-700 mb-1';
const hintClass = 'text-[11px] text-slate-500 mt-1';
const checkboxClass =
  'w-4 h-4 rounded border-slate-300 accent-slate-900 focus:ring-2 focus:ring-slate-900/20 cursor-pointer';

export const CALC_TYPE_OPTIONS: { value: AccessorialCalcType; label: string; unit: string; hint: string }[] = [
  { value: 'FLAT', label: 'Flat fee', unit: 'flat fee', hint: 'One charge per order (or per stop).' },
  { value: 'PER_UNIT', label: 'Per unit / quantity', unit: 'per unit', hint: 'Quantity beyond the free allowance × rate.' },
  { value: 'PER_MINUTE', label: 'Per minute (waiting)', unit: 'per minute', hint: 'Wait beyond the allowance, rounded up to the increment.' },
  { value: 'PER_HOUR', label: 'Per hour (labour)', unit: 'per hour', hint: 'Hours × rate. Helpers, crews.' },
  { value: 'PERCENT_OF_FREIGHT', label: '% of freight', unit: '% of freight', hint: 'Percentage of the service freight amount.' },
  { value: 'PERCENT_OF_DECLARED_VALUE', label: '% of declared value', unit: '% of declared value', hint: 'Insurance on the declared cargo value.' }
];

const AUTO_RULE_OPTIONS: { value: AccessorialAutoRule; label: string }[] = [
  { value: 'NONE', label: 'Manual — dispatcher adds it' },
  { value: 'AFTER_HOURS', label: 'Auto — service outside 08:00–18:00' },
  { value: 'WEEKEND', label: 'Auto — Saturday or Sunday' },
  { value: 'RESIDENTIAL_STOP', label: 'Auto — any residential stop' }
];

const isPercent = (t: AccessorialCalcType) => t.startsWith('PERCENT');

/** Optional numeric field: blank = null (inherit / no limit). */
const OptionalNumber: React.FC<{
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  hint?: string;
  step?: number;
}> = ({ label, value, onChange, placeholder, prefix, suffix, hint, step = 1 }) => (
  <div>
    <label className={labelClass}>{label}</label>
    <div className="relative">
      {prefix && <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">{prefix}</span>}
      <input
        type="number"
        min={0}
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0))}
        className={`${fieldClass} ${prefix ? 'pl-6' : ''} ${suffix ? 'pr-12' : ''}`}
      />
      {suffix && (
        <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 pointer-events-none">{suffix}</span>
      )}
    </div>
    {hint && <p className={hintClass}>{hint}</p>}
  </div>
);

export const AccessorialModal: React.FC<AccessorialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAccessorial
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [calculationType, setCalculationType] = useState<AccessorialCalcType>('FLAT');
  const [rate, setRate] = useState<number>(15);
  const [unitLabel, setUnitLabel] = useState('flat fee');
  const [freeAllowance, setFreeAllowance] = useState<number | null>(null);
  const [incrementMinutes, setIncrementMinutes] = useState<number | null>(null);
  const [minimumCharge, setMinimumCharge] = useState<number | null>(null);
  const [maximumCharge, setMaximumCharge] = useState<number | null>(null);
  const [appliesAt, setAppliesAt] = useState<'ORDER' | 'PER_STOP'>('ORDER');
  const [fuelEligible, setFuelEligible] = useState(false);
  const [taxable, setTaxable] = useState(true);
  const [autoRule, setAutoRule] = useState<AccessorialAutoRule>('NONE');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialAccessorial) {
      setName(initialAccessorial.name);
      setCode(initialAccessorial.code);
      setDescription(initialAccessorial.description);
      setCalculationType(initialAccessorial.calculationType);
      setRate(initialAccessorial.rate);
      setUnitLabel(initialAccessorial.unitLabel);
      setFreeAllowance(initialAccessorial.freeAllowance);
      setIncrementMinutes(initialAccessorial.incrementMinutes);
      setMinimumCharge(initialAccessorial.minimumCharge);
      setMaximumCharge(initialAccessorial.maximumCharge);
      setAppliesAt(initialAccessorial.appliesAt);
      setFuelEligible(initialAccessorial.fuelEligible);
      setTaxable(initialAccessorial.taxable);
      setAutoRule(initialAccessorial.autoRule);
      setActive(initialAccessorial.active);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setCalculationType('FLAT');
      setRate(15);
      setUnitLabel('flat fee');
      setFreeAllowance(null);
      setIncrementMinutes(null);
      setMinimumCharge(null);
      setMaximumCharge(null);
      setAppliesAt('ORDER');
      setFuelEligible(false);
      setTaxable(true);
      setAutoRule('NONE');
      setActive(true);
    }
  }, [initialAccessorial, isOpen]);

  if (!isOpen) return null;

  const handleTypeChange = (type: AccessorialCalcType) => {
    setCalculationType(type);
    const opt = CALC_TYPE_OPTIONS.find((o) => o.value === type);
    if (opt) setUnitLabel(opt.unit);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      id: initialAccessorial?.id || `acc_${Date.now()}`,
      code: (code.trim() || name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_')).slice(0, 24),
      name: name.trim(),
      description: description.trim(),
      calculationType,
      rate: Math.max(0, Number(rate) || 0),
      unitLabel: unitLabel.trim() || 'per unit',
      freeAllowance,
      incrementMinutes,
      minimumCharge,
      maximumCharge,
      appliesAt,
      fuelEligible,
      taxable,
      autoRule,
      active
    });
    onClose();
  };

  const typeOpt = CALC_TYPE_OPTIONS.find((o) => o.value === calculationType);

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {initialAccessorial ? 'Edit Accessorial' : 'Add New Accessorial'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              A configurable charge with its own calculation, allowance, limits, and tax/fuel treatment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Stair Carry, Waiting Time, Elevator"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass}>Code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="STAIRS"
                className={`${fieldClass} font-mono`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Calculation</label>
              <Select
                aria-label="Calculation type"
                className="w-full"
                value={calculationType}
                onValueChange={(v) => handleTypeChange(v as AccessorialCalcType)}
                options={CALC_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
              {typeOpt && <p className={hintClass}>{typeOpt.hint}</p>}
            </div>

            <div>
              <label className={labelClass}>
                Rate <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                {!isPercent(calculationType) && (
                  <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">$</span>
                )}
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  required
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  className={`${fieldClass} ${isPercent(calculationType) ? 'pr-8' : 'pl-6'}`}
                />
                {isPercent(calculationType) && (
                  <span className="absolute right-2.5 top-2.5 text-xs text-slate-400">%</span>
                )}
              </div>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                placeholder="unit label shown on quotes"
                className={`${fieldClass} mt-1.5 text-xs`}
              />
            </div>
          </div>

          {(calculationType === 'PER_UNIT' || calculationType === 'PER_MINUTE') && (
            <div className="grid grid-cols-2 gap-3">
              <OptionalNumber
                label="Free allowance"
                value={freeAllowance}
                onChange={setFreeAllowance}
                placeholder={calculationType === 'PER_MINUTE' ? 'Org default' : '0'}
                suffix={calculationType === 'PER_MINUTE' ? 'min' : 'units'}
                hint={
                  calculationType === 'PER_MINUTE'
                    ? 'Blank inherits the organization wait-free default.'
                    : 'Quantity included before charging starts.'
                }
              />
              {calculationType === 'PER_MINUTE' && (
                <OptionalNumber
                  label="Billing increment"
                  value={incrementMinutes}
                  onChange={setIncrementMinutes}
                  placeholder="Org default"
                  suffix="min"
                  hint="Blank inherits the organization wait increment."
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <OptionalNumber
              label="Minimum charge"
              value={minimumCharge}
              onChange={setMinimumCharge}
              placeholder="None"
              prefix="$"
              step={0.5}
            />
            <OptionalNumber
              label="Maximum charge"
              value={maximumCharge}
              onChange={setMaximumCharge}
              placeholder="No cap"
              prefix="$"
              step={0.5}
            />
            <div>
              <label className={labelClass}>Applies</label>
              <Select
                aria-label="Applies at"
                className="w-full"
                value={appliesAt}
                onValueChange={(v) => setAppliesAt(v as 'ORDER' | 'PER_STOP')}
                options={[
                  { value: 'ORDER', label: 'Once per order' },
                  { value: 'PER_STOP', label: 'Per stop' }
                ]}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Automatic rule</label>
            <Select
              aria-label="Automatic rule"
              className="w-full"
              value={autoRule}
              onValueChange={(v) => setAutoRule(v as AccessorialAutoRule)}
              options={AUTO_RULE_OPTIONS}
            />
          </div>

          <div>
            <label className={labelClass}>Description / conditions</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Billed per flight of stairs navigated at pickup or delivery site."
              className={`${fieldClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200/80">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={fuelEligible} onChange={(e) => setFuelEligible(e.target.checked)} className={checkboxClass} />
              Fuel-eligible
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} className={checkboxClass} />
              Taxable
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className={checkboxClass} />
              Active
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              {initialAccessorial ? 'Save Changes' : 'Create Accessorial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
