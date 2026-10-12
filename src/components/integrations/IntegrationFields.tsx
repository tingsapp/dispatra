import { Copy, Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '../ui/button';
import { confirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../../portal/ui';
import { webhookSecret } from '../../integrations/preview';

export { Field };
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFeedback(''); setFailed(false); }, [value]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setFeedback(`${label} copied.`); setFailed(false); }
    catch { setFeedback('Clipboard unavailable. Check browser permissions and try again.'); setFailed(true); }
  };
  return <div className="shrink-0">
    <Button type="button" variant="outline" size="sm" disabled={!value} onClick={copy} aria-label={`Copy ${label}`}><Copy aria-hidden="true" />Copy</Button>
    {feedback && <p role={failed ? 'alert' : 'status'} className={`mt-1 max-w-44 text-xs ${failed ? 'text-rose-700' : 'text-app-muted'}`}>{feedback}</p>}
  </div>;
}

/** Entered credentials never enter saved state or browser storage. A saved credential cannot be revealed or copied. */
export function SecretField({ label, value, saved, onChange, generate = false }: {
  label: string; value: string; saved: boolean; onChange: (value: string) => void; generate?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const replace = async () => {
    if ((saved || value) && !(await confirmDialog({ title: `Replace ${label.toLowerCase()}?`, message: 'After you save, the other system must use the new secret.', confirmLabel: 'Replace secret' }))) return;
    setVisible(false); onChange(webhookSecret());
  };
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
    <div className="flex flex-wrap items-start gap-2">
      <div className="relative min-w-0 flex-1 basis-48">
        <input id={id} autoComplete="off" spellCheck={false} type={visible ? 'text' : 'password'} value={value}
          placeholder={saved ? 'Saved' : ''} maxLength={500}
          onChange={event => onChange(event.target.value)} className="app-input w-full min-w-0 pr-11 font-normal" />
        <button type="button" disabled={!value} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}
          onClick={() => setVisible(current => !current)}
          className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-app-muted hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50">
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {generate && <CopyButton value={value} label={label.toLowerCase()} />}
      {generate && <Button type="button" variant="outline" size="sm" onClick={replace}>{saved || value ? 'Replace secret' : 'Generate secret'}</Button>}
    </div>
    <p className="text-xs text-app-muted">{saved && !value ? 'Saved. Enter a new value to replace it.' : 'Hidden after saving.'}</p>
  </div>;
}
