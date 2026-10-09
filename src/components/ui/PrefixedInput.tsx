import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

interface PrefixedInputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix: string;
}

/** One shared field surface with a fixed prefix and an editable native input. */
export const PrefixedInput = forwardRef<HTMLInputElement, PrefixedInputProps>(function PrefixedInput({ prefix, className, ...props }, ref) {
  return <div className="app-input app-input-group" aria-invalid={props['aria-invalid']}>
    <span className="app-input-prefix" aria-hidden="true">{prefix}</span>
    <input {...props} ref={ref} className={cn('app-input-group-control', className)} />
  </div>;
});
