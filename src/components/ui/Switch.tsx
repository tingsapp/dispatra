import type { ComponentProps } from 'react';

type SwitchProps = Omit<ComponentProps<'button'>, 'onChange' | 'onClick' | 'children'> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Shared switch geometry and motion for dispatch, preferences and map layers. */
export function Switch({ checked, onCheckedChange, className = '', ...props }: SwitchProps) {
  return <button {...props} type="button" role="switch" aria-checked={checked}
    className={`app-switch ${className}`} onClick={() => onCheckedChange(!checked)}>
    <span aria-hidden="true" />
  </button>;
}
