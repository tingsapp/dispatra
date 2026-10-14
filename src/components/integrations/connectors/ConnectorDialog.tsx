import { Button } from '../../ui/button';
import { useRef, useState } from 'react';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../ui/Dialog';
import { PasswordInput } from '../../ui/PasswordInput';
import { useEntityDialog } from '../../entities/useEntityDialog';
import { connectors, type Connector } from '../../../integrations/connectors';

export function ConnectorDialog({ slug, connector, onClose, onSaved, navigate = (url: string) => window.location.assign(url) }: {
  slug: string; connector: Connector; onClose: () => void; onSaved: () => void; navigate?: (url: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef<{ payload: string; key: string } | null>(null);
  const close = () => { if (!pending) { setValues({}); onClose(); } };
  useEntityDialog(true, close, `Connect ${connector.name}`);
  const connect = async () => {
    const body = { version: connector.version, credentials: values };
    const payload = JSON.stringify(body);
    if (operation.current?.payload !== payload) operation.current = { payload, key: crypto.randomUUID() };
    setPending(true); setError('');
    try {
      const result = await connectors.connect(slug, connector.id, body, operation.current.key);
      setValues({}); operation.current = null;
      if (result.authorization_url) { navigate(result.authorization_url); return; }
      onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not connect. Try again.'); }
    finally { setPending(false); }
  };
  return <Dialog size="form" onClose={close}>
    <DialogHeader title={`Connect ${connector.name}`} onClose={close} closeDisabled={pending} />
    <DialogBody>
      {!connector.ready ? <p className="text-sm text-app-muted">This connector needs activation by Dispatra before you can connect your account.</p>
        : connector.auth === 'oauth' ? <p className="text-sm text-app-muted">Continue to {connector.name} to sign in and approve the connection.</p>
          : <div className="space-y-4">
            <p className="text-sm text-app-muted">Enter your {connector.name} connection details. Your credentials are saved securely.</p>
            {connector.credential_fields.map(field => <label key={field.key} className="block space-y-1.5 text-sm">
              <span>{field.label}</span>
              {field.secret ? <PasswordInput className="app-input w-full" label={field.label} aria-label={field.label} value={values[field.key] ?? ''} disabled={pending} autoComplete="off"
                onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} />
                : <input className="app-input w-full" aria-label={field.label} value={values[field.key] ?? ''} disabled={pending} autoComplete="off"
                  onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))} />}
            </label>)}
          </div>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
    </DialogBody>
    <DialogFooter>
      <Button type="button" variant="outline" onClick={close} disabled={pending}>Close</Button>
      {connector.ready && <Button type="button"  onClick={connect} disabled={pending || (connector.auth !== 'oauth' && connector.credential_fields.some(field => !values[field.key]))}>
        {pending ? 'Connecting…' : connector.auth === 'oauth' ? `Continue to ${connector.name}` : 'Connect'}
      </Button>}
    </DialogFooter>
  </Dialog>;
}
