import { Button } from '../../ui/button';
import { useRef, useState } from 'react';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../ui/Dialog';
import { PasswordInput } from '../../ui/PasswordInput';
import { useEntityDialog } from '../../entities/useEntityDialog';
import { connectors, type Connector } from '../../../integrations/connectors';

export function ConnectorDialog({ slug, connector, onClose, onSaved, navigate = (url: string) => window.location.assign(url) }: {
  slug: string; connector: Connector; onClose: () => void; onSaved: () => void; navigate?: (url: string) => void;
}) {
  const defaults: Record<string, string> = { 'rose-rocket': 'https://network.roserocket.com', cartoncloud: 'https://api.cartoncloud.com' };
  const [values, setValues] = useState<Record<string, string>>(() => defaults[connector.id] ? { base_url: defaults[connector.id] } : {});
  const [testedAccount, setTestedAccount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef<{ payload: string; key: string } | null>(null);
  const close = () => { if (!pending) { setValues({}); onClose(); } };
  useEntityDialog(true, close, `Connect ${connector.name}`);
  const test = async () => {
    setPending(true); setError(''); setTestedAccount('');
    try {
      const result = await connectors.test(slug, connector.id, { version: connector.version, credentials: values });
      setTestedAccount(result.account);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connection test failed. Try again.'); }
    finally { setPending(false); }
  };
  const connect = async () => {
    const body = { version: connector.version, credentials: connector.auth === 'oauth' ? {} : values };
    const payload = JSON.stringify(body);
    if (operation.current?.payload !== payload) operation.current = { payload, key: crypto.randomUUID() };
    setPending(true); setError('');
    try {
      const result = await connectors.connect(slug, connector.id, body, operation.current.key);
      setValues({}); operation.current = null;
      if (result.authorization_url) { navigate(result.authorization_url); return; }
      if (result.connector.status !== 'CONNECTED') throw new Error('Connection verification has not succeeded. Please try again.');
      onSaved(); onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not connect. Try again.'); }
    finally { setPending(false); }
  };
  return <Dialog size="form" onClose={close}>
    <DialogHeader title={`Connect ${connector.name}`} onClose={close} closeDisabled={pending} />
    <DialogBody>
      {connector.auth === 'oauth' && connector.ready ? <p className="text-sm text-app-muted">Continue to {connector.name} to sign in and approve access. Dispatra verifies the account before showing Connected.</p>
          : <div className="space-y-4">
            <p className="text-sm text-app-muted">{connector.credential_fields.length ? `Enter your ${connector.name} connection details. Dispatra must verify account access before showing Connected.` : `The ${connector.name} connection method is awaiting configuration.`}</p>
            {connector.credential_fields.map(field => <label key={field.key} className="block space-y-1.5 text-sm">
              <span>{field.label}</span>
              {field.secret ? <PasswordInput className="app-input w-full" label={field.label} aria-label={field.label} value={values[field.key] ?? ''} disabled={pending} autoComplete="off"
                onChange={event => { setValues(current => ({ ...current, [field.key]: event.target.value })); setTestedAccount(''); setError(''); }} />
                : <input className="app-input w-full" aria-label={field.label} value={values[field.key] ?? ''} disabled={pending} autoComplete="off"
                  onChange={event => { setValues(current => ({ ...current, [field.key]: event.target.value })); setTestedAccount(''); setError(''); }} />}
            </label>)}
          </div>}
      {connector.id === 'samsara' && <p className="mt-4 text-sm text-app-muted">Create a Samsara API token with Read Org Information under Setup &amp; Administration. Account verification does not enable fleet imports.</p>}
      {testedAccount && <p role="status" className="mt-4 text-sm text-emerald-700">Token verified for {testedAccount}. Select Connect to save the connection.</p>}
      {!connector.ready && <p role="status" className="mt-4 text-sm text-app-muted">Connection testing is unavailable until Dispatra has a configured provider adapter. Entering credentials alone will not connect the account.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}
    </DialogBody>
    <DialogFooter>
      {connector.id === 'samsara' && connector.ready && <Button type="button" variant="outline" onClick={test} disabled={pending || !values.api_key}>
        {pending ? 'Checking…' : 'Test connection'}
      </Button>}
      <Button type="button" onClick={connect} disabled={!connector.ready || pending || (connector.id === 'samsara' && !testedAccount) || (connector.auth !== 'oauth' && connector.credential_fields.some(field => !values[field.key]))}>
        {pending ? (connector.auth === 'oauth' ? 'Connecting…' : 'Testing connection…') : !connector.ready ? 'Test connection' : connector.id === 'samsara' ? 'Connect' : connector.auth === 'oauth' ? `Continue to ${connector.name}` : 'Test connection & connect'}
      </Button>
    </DialogFooter>
  </Dialog>;
}
