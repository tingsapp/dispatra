import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { PrefixedInput } from '../ui/PrefixedInput';

interface WorkspaceInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hideLabel?: boolean;
}

/** Company name after a fixed, non-editable public domain prefix. */
export const WorkspaceInput = forwardRef<HTMLInputElement, WorkspaceInputProps>(function WorkspaceInput({ hideLabel, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <div className="min-w-0 flex-1">
    <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'app-label'}>Company workspace</label>
    <PrefixedInput ref={ref} id={inputId} prefix="dispatra.com/" autoCapitalize="none" autoComplete="organization" spellCheck={false} maxLength={63}
      placeholder="company-name" {...props} />
  </div>;
});
