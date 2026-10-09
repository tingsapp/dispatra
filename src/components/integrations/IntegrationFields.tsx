import { Copy, Eye, EyeOff } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '../ui/button';
import { confirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../../portal/ui';
import { testSecret } from '../../integrations/preview';

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

/** Entered credentials never enter saved preview state. A saved credential cannot be revealed or copied. */
export function PreviewSecret({ label, value, saved, onChange, generate = false }: {
  label: string; value: string; saved: boolean; onChange: (value: string) => void; generate?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const replace = async () => {
    if ((saved || value) && !(await confirmDialog({ title: `Replace ${label.toLowerCase()}?`, message: 'This replaces the test secret in this preview only. No live connection will change.', confirmLabel: 'Replace test secret' }))) return;
    setVisible(false); onChange(testSecret('webhook'));
  };
  return <div className="space-y-2">
    <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
    <div className="flex flex-wrap items-start gap-2">
      <input id={id} autoComplete="off" spellCheck={false} type={visible ? 'text' : 'password'} value={value}
        placeholder={saved ? 'Saved test credential' : 'Test values only'} maxLength={500}
        onChange={event => onChange(event.target.value)} className="app-input min-w-0 flex-1 basis-48 font-normal" />
      <Button type="button" variant="outline" size="sm" disabled={!value} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{visible ? 'Hide' : 'Show'}
      </Button>
      {generate && <CopyButton value={value} label={label.toLowerCase()} />}
      {generate && <Button type="button" variant="outline" size="sm" onClick={replace}>{saved || value ? 'Replace secret' : 'Generate test secret'}</Button>}
    </div>
    <p className="text-xs text-app-muted">{saved && !value ? 'Test credential recorded. Its value was cleared; enter a replacement to change it.' : 'Use test values only. This value is cleared when you save and is never stored.'}</p>
  </div>;
}
