import { useEffect, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CompanyDetail, type DispatcherAccount } from '../api';
import { Button, CredentialCard, Field, Notice, useOperationKey, type Credentials } from '../ui';
import { PrefixedInput } from '../../components/ui/PrefixedInput';
import { CompanyAccessButton } from './CompanyAccessButton';
import { DispatcherDialog } from './DispatcherDialog';
import { QueryState } from './QueryState';
import { formatWhen, isConflict } from './format';
import { auditKey, companiesKey, companyKey, dispatchersKey } from './queryKeys';

export function CompanyOverviewForm({ company }: { company: CompanyDetail }) {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: dispatchersKey(company.id), queryFn: () => api.dispatchers(company.id) });
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState<Credentials>();
  if (!query.data) return <QueryState query={query} loading="Loading company details…" />;
  const account = query.data.find(row => row.active) ?? query.data[0];
  return <div className="space-y-5">
    <QueryState query={query} loading="Loading company details…" />
    {credentials && <CredentialCard value={credentials} onDismiss={() => setCredentials(undefined)} />}
    <OverviewEditor key={`${company.id}:${account?.id ?? 'none'}`} company={company} account={account} onReload={async () => {
      const [companyResult, accountsResult] = await Promise.all([cache.fetchQuery({ queryKey: companyKey(company.id), queryFn: () => api.company(company.id) }), query.refetch({ throwOnError: true })]);
      return { company: companyResult, dispatcher: accountsResult.data?.find(row => row.active) ?? accountsResult.data?.[0] };
    }} />
    {!account && company.dispatcher_count === 0 && <Button onClick={() => setCreating(true)}>Add dispatcher</Button>}
    {creating && <DispatcherDialog companyId={company.id} onClose={() => setCreating(false)} onSaved={result => {
      setCreating(false);
      if (result.initial_password) setCredentials({ url: `${location.origin}/login`, login: result.login_id, password: result.initial_password });
      [companyKey(company.id), dispatchersKey(company.id), companiesKey(), auditKey(company.id)].forEach(queryKey => cache.invalidateQueries({ queryKey }));
    }} />}
  </div>;
}

type Snapshot = { company: CompanyDetail; dispatcher?: DispatcherAccount | null };
const fields = ({ company, dispatcher }: Snapshot) => ({ name: company.name, phone: company.phone, address: company.address, login: dispatcher?.login_id ?? '',
  displayName: dispatcher?.display_name ?? '', password: '', confirmation: '' });

function OverviewEditor({ company, account, onReload }: {
  company: CompanyDetail; account?: DispatcherAccount; onReload: () => Promise<Snapshot>;
}) {
  const identifierId = useId();
  const [accessBusy, setAccessBusy] = useState(false);
  const cache = useQueryClient();
  const operation = useOperationKey();
  const [baseline, setBaseline] = useState<Snapshot>({ company, dispatcher: account });
  const [draft, setDraft] = useState(() => fields(baseline));
  const [passwordError, setPasswordError] = useState('');
  const original = fields(baseline);
  const dirty = draft.name.trim() !== original.name || draft.phone.trim() !== original.phone || draft.address.trim() !== original.address || draft.login.trim() !== original.login || draft.displayName.trim() !== original.displayName || Boolean(draft.password || draft.confirmation);
  const accept = (snapshot: Snapshot) => { setBaseline(snapshot); setDraft(fields(snapshot)); setPasswordError(''); };
  useEffect(() => {
    if (!dirty && company.version >= baseline.company.version && (account?.version ?? 0) >= (baseline.dispatcher?.version ?? 0)) {
      setBaseline({ company, dispatcher: account }); setDraft(fields({ company, dispatcher: account }));
    }
  }, [company, account, dirty, baseline.company.version, baseline.dispatcher?.version]);
  const body = { version: baseline.company.version, name: draft.name.trim(), active: baseline.company.active,
    ...(draft.phone.trim() !== original.phone || draft.address.trim() !== original.address ? { settings_version: baseline.company.settings_version,
      ...(draft.phone.trim() !== original.phone ? { phone: draft.phone.trim() } : {}),
      ...(draft.address.trim() !== original.address ? { address: draft.address.trim() } : {}) } : {}),
    dispatcher: baseline.dispatcher ? { id: baseline.dispatcher.id, version: baseline.dispatcher.version,
      login_id: draft.login.trim(), display_name: draft.displayName.trim(), ...(draft.password ? { new_password: draft.password } : {}) } : null };
  const save = useMutation({ mutationFn: () => api.updateCompanyOverview(company.id, body, operation(body)), onSuccess: result => {
    accept(result);
    cache.setQueryData(companyKey(company.id), result.company);
    cache.setQueryData<DispatcherAccount[]>(dispatchersKey(company.id), rows => result.dispatcher ? (rows ?? []).map(row => row.id === result.dispatcher!.id ? result.dispatcher! : row) : rows);
    [companiesKey(), auditKey(company.id), dispatchersKey(company.id)].forEach(queryKey => cache.invalidateQueries({ queryKey }));
  } });
  const reload = useMutation({ mutationFn: onReload, onSuccess: snapshot => { accept(snapshot); save.reset(); } });
  const busy = save.isPending || reload.isPending || accessBusy;
  const change = (next: Partial<typeof draft>) => { save.reset(); setPasswordError(''); setDraft(current => ({ ...current, ...next })); };
  const submit = () => {
    if (draft.password !== draft.confirmation) { setPasswordError('Passwords do not match.'); return; }
    if (draft.password && (draft.password.length < 12 || draft.password.length > 128)) { setPasswordError('Use a password between 12 and 128 characters.'); return; }
    save.mutate();
  };
  return <form aria-label="Company overview" className="space-y-5" onSubmit={event => { event.preventDefault(); submit(); }}>
    <fieldset disabled={busy} className="space-y-5">
      <section className="space-y-5" aria-label="Company details">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="app-section-title">Company details</h2><CompanyAccessButton company={company} disabled={dirty || save.isPending || reload.isPending} onBusyChange={setAccessBusy} /></div>
        {company.trial_ends_at && !company.trial_activated_at && <p className="text-sm text-app-muted">{new Date(company.trial_ends_at).getTime() <= Date.now()
          ? 'The 30-day trial has ended. Activate this company to restore access.'
          : `30-day trial ends ${formatWhen(company.trial_ends_at)}.`}</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" maxLength={160} disabled={!account} value={draft.displayName} onChange={event => change({ displayName: event.target.value })} />
          <Field label="Company name" required maxLength={160} value={draft.name} onChange={event => change({ name: event.target.value })} />
          <Field label="Email" type={draft.login === original.login && !draft.login.includes('@') ? 'text' : 'email'} required={Boolean(account)} maxLength={254} disabled={!account} value={draft.login} onChange={event => change({ login: event.target.value.toLowerCase() })} />
          <div className="grid content-start gap-1.5 text-sm text-slate-700"><label htmlFor={identifierId}>Company identifier</label><PrefixedInput id={identifierId} prefix={`${location.origin}/`} value={company.slug} readOnly /></div>
          <Field label="Company phone" type="tel" maxLength={50} value={draft.phone} onChange={event => change({ phone: event.target.value })} />
          <Field label="Company address" maxLength={500} autoComplete="street-address" value={draft.address} onChange={event => change({ address: event.target.value })} />
        </div>
        {account && !account.login_id.includes('@') && <p className="text-xs text-app-muted">This account uses a legacy login ID. Enter an email address to update it.</p>}
        <dl aria-label="Company record dates" className="app-panel grid gap-5 text-sm sm:grid-cols-3">
          <Record label="Last sign-in" value={formatWhen(account?.last_login_at)} /><Record label="Company created" value={formatWhen(company.created_at)} /><Record label="Company updated" value={formatWhen(company.updated_at)} />
        </dl>
      </section>
      {account && <section className="space-y-5 pt-6" aria-label="Change password">
        <h2 className="app-section-title">Change password</h2>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={draft.password} onChange={event => change({ password: event.target.value })} /><Field label="Confirm password" type="password" autoComplete="new-password" maxLength={128} value={draft.confirmation} onChange={event => change({ confirmation: event.target.value })} /></div>
        <p className="text-xs text-app-muted">Leave blank to keep the current password. Changing it signs out the dispatcher on every device.</p>
      </section>}
    </fieldset>
    <Notice error={passwordError ? new Error(passwordError) : reload.error ?? save.error} success={save.isSuccess ? 'Changes saved.' : undefined} />
    {isConflict(save.error) && <Button type="button" variant="outline" disabled={busy} onClick={() => reload.mutate()}>{reload.isPending ? 'Loading…' : 'Reload latest'}</Button>}
    <div className="flex justify-end"><Button disabled={busy || !dirty || !draft.name.trim() || Boolean(account && !draft.login.trim())}>{save.isPending ? 'Saving…' : 'Save changes'}</Button></div>
  </form>;
}

function Record({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 space-y-1"><dt className="text-app-muted">{label}</dt><dd className="break-words">{value}</dd></div>;
}
