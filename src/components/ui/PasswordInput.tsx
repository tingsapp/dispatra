import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Password entry with a local, keyboard-accessible visibility toggle. */
export function PasswordInput({ label = 'password', containerClassName = '', className = '', type: _type, ...props }:
  InputHTMLAttributes<HTMLInputElement> & { label?: string; containerClassName?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { if (props.value === '') setVisible(false); }, [props.value]);
  return <span className={`relative block min-w-0 ${containerClassName}`}>
    <input {...props} type={visible ? 'text' : 'password'} className={`app-password-input ${className}`}
      autoCapitalize="none" autoCorrect="off" spellCheck={false} />
    <button type="button" disabled={props.disabled} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      aria-pressed={visible} onMouseDown={event => event.preventDefault()} onClick={() => setVisible(current => !current)}
      className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-app-muted hover:bg-app-hover hover:text-app-text disabled:opacity-50">
      {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  </span>;
}
