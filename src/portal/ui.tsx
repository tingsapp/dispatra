import React, { useId, useRef, useState } from 'react';
import { AddressAutocomplete } from '../components/ui/AddressAutocomplete';
import { Button } from '../components/ui/button';
export { Button };
export function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700">{label}<input {...props} className="app-input font-normal" /></label>;
}
export function AddressField({ label, value, onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { label: string; value: string; onChange: (address: string) => void }) {
  const id = useId();
  return <div className="grid gap-1.5 text-sm font-medium text-slate-700"><label htmlFor={id}>{label}</label><AddressAutocomplete {...props} id={id} value={value} onChange={onChange} className="app-input font-normal" /></div>;
}
export function Notice({ error, success }: { error?: unknown; success?: string }) {
  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error instanceof Error ? error.message : 'Unable to complete this request.'}</p>;
  return success ? <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p> : null;
}
export function Card({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  return <section className="app-panel"><h2 className="app-section-title text-app-text">{title}</h2>{description && <p className="mt-1 text-sm text-app-muted">{description}</p>}<div className="mt-6">{children}</div></section>;
}
export function useOperationKey() {
  const current = useRef({ payload: '', key: '' });
  return (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    if (current.current.payload !== serialized) current.current = { payload: serialized, key: crypto.randomUUID() };
    return current.current.key;
  };
}
export type Credentials = { url: string; login: string; password: string };
export function CredentialCard({ value, onDismiss }: { value: Credentials; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<unknown>();
  const text = `Login: ${value.url}\nLogin ID: ${value.login}\nPassword: ${value.password}`;
  return <Card title="Login details ready" description="Share these details directly with the account holder. The password is shown here only until you dismiss this card.">
    <div className="space-y-4"><label className="grid gap-2 text-sm">Login details<textarea aria-label="Login details" readOnly value={text} rows={4} className="app-input w-full font-mono" /></label>
    <Notice error={error} success={copied ? 'Login details copied.' : undefined} /><div className="flex gap-3"><Button onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { setError(new Error('Copy was unavailable. Select and copy the login details above.')); } }}>Copy login details</Button><Button variant="outline" onClick={onDismiss}>Done</Button></div></div>
  </Card>;
}
