import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface WorkspaceInputProps extends InputHTMLAttributes<HTMLInputElement> {
  hideLabel?: boolean;
}

/** Company name after a fixed, non-editable public domain prefix. */
export const WorkspaceInput = forwardRef<HTMLInputElement, WorkspaceInputProps>(function WorkspaceInput({ hideLabel, id, ...props }, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <div className="min-w-0 flex-1">
    <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'mb-2 block text-sm font-medium'}>Company workspace</label>
    <div className={`flex h-12 items-center overflow-hidden rounded-xl border bg-white focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 ${props['aria-invalid'] ? 'border-rose-600' : 'border-app-border'}`}>
      <span className="flex h-full shrink-0 items-center border-r border-app-border bg-slate-50 pl-3 pr-2 text-sm text-slate-400" aria-hidden="true">dispatra.com/</span>
      <input ref={ref} id={inputId} autoCapitalize="none" autoComplete="organization" spellCheck={false} maxLength={63}
        placeholder="company-name" {...props} className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-app-text outline-none placeholder:text-slate-400 sm:text-sm" />
    </div>
  </div>;
});
