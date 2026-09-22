import { fromDisplayWeight, fromDisplayWeightRate, toDisplayWeight, toDisplayWeightRate, Units } from '../../lib/units';

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  units: Units;
  label: string;
  labelWithUnit?: boolean;
  className?: string;
  placeholder?: string;
  min?: number;
  invalid?: boolean;
  describedBy?: string;
  rate?: boolean;
  required?: boolean;
}

/** Company units control entry; stored weights and rates remain kg and currency/kg. */
export function WeightInput({ value, onChange, units, label, labelWithUnit = false, className = 'app-input',
  placeholder, min = 0, invalid, describedBy, rate = false, required = false }: Props) {
  const display = rate ? toDisplayWeightRate : toDisplayWeight;
  const canonical = rate ? fromDisplayWeightRate : fromDisplayWeight;
  return <input type="number" min={display(min, units)} step="any" required={required} className={className} placeholder={placeholder}
      aria-label={labelWithUnit ? `${label} (${units.weightUnit})` : label} aria-invalid={invalid} aria-describedby={describedBy}
      value={value == null ? '' : Number(display(value, units).toFixed(6))}
      onChange={event => onChange(event.target.value === '' ? null : canonical(Number(event.target.value), units))} />;
}
