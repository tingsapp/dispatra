import React, { useEffect, useRef, useState } from 'react';
import { formatPhoneInput } from '../../lib/phone';
import { EMAIL_ERROR, isValidEmail } from '../../lib/email';

/** Drop-in `<input>` for every phone and email field: `type="tel"` formats as typed, `type="email"` is validated (blocks native form submit and shows the error once the field is left). */
export function ContactInput({ type, onChange, onBlur, onInvalid, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const value = String(props.value ?? '');
  const invalid = type === 'email' && !props.readOnly && value.trim() !== '' && !isValidEmail(value);
  useEffect(() => { ref.current?.setCustomValidity(invalid ? EMAIL_ERROR : ''); }, [invalid]);
  const input = <input {...props} ref={ref} type={type}
    {...type === 'tel' ? { inputMode: 'tel' as const, autoComplete: props.autoComplete ?? 'tel', placeholder: props.placeholder ?? '(604) 555-0100' } : type === 'email' ? { autoComplete: props.autoComplete ?? 'email', maxLength: props.maxLength ?? 254, 'aria-invalid': invalid && touched || undefined } : {}}
    onChange={e => { if (type === 'tel') e.target.value = formatPhoneInput(e.target.value); onChange?.(e); }}
    onBlur={e => { setTouched(true); onBlur?.(e); }}
    onInvalid={e => { setTouched(true); onInvalid?.(e); }} />;
  return type === 'email' && invalid && touched ? <>{input}<span role="alert" className="mt-1 block text-xs font-normal text-rose-700">{EMAIL_ERROR}</span></> : input;
}
