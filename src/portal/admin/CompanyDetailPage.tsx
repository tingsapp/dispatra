import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, KeyRound, Truck, UsersRound } from 'lucide-react';
import { api, ApiError, type CompanyDetail } from '../api';
import { Button, Card, Field, Notice, useOperationKey } from '../ui';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { ListSummary } from '../../components/layout/ListSummary';
import { QueryState, StatusBadge } from './QueryState';
import { DispatchersSection } from './DispatchersSection';
import { auditLabel, formatWhen, isConflict } from './format';
import { auditKey, companiesKey, companyKey, dispatchersKey } from './queryKeys';

export function CompanyDetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useQuery({ queryKey: companyKey(id), queryFn: () => api.company(id) });
  if (query.error instanceof ApiError && query.error.status === 404) return <div className="space-y-4 py-10 text-center"><p className="text-sm text-app-muted">This company does not exist or is no longer available.</p><Button variant="outline" onClick={onBack}>Back to companies</Button></div>;
  if (!query.data) return <QueryState query={query} loading="Loading company…" />;
  const company = query.data;
  return <div className="space-y-8">
    <QueryState query={query} loading="Loading company…" />
    <div className="flex flex-wrap items-center gap-3 text-sm text-app-muted"><StatusBadge active={company.active} inactiveLabel="Suspended" /><span>/{company.slug}/</span><span>Created {formatWhen(company.created_at)}</span><span>Updated {formatWhen(company.updated_at)}</span></div>
    <ListSummary label="Company access summary" items={[
      { label: 'Active dispatchers', value: company.active_dispatcher_count, icon: CircleCheck, description: `${company.dispatcher_count} total` },
      { label: 'Shipper accounts', value: company.shipper_account_count, icon: UsersRound },
      { label: 'Driver accounts', value: company.driver_account_count, icon: Truck },
      { label: 'Signed-in sessions', value: company.active_session_count, icon: KeyRound },
    ]} />
    <IdentityForm key={company.version} company={company} onReload={() => query.refetch()} />
    <StatusSection company={company} onReload={() => query.refetch()} />
    <DispatchersSection company={company} />
    <AuditSection id={company.id} />
  </div>;
}

function useCompanyUpdated(id: string) {
  const cache = useQueryClient();
  return (company: CompanyDetail) => {
    cache.setQueryData(companyKey(id), company);
    cache.invalidateQueries({ queryKey: auditKey(id) });
    cache.invalidateQueries({ queryKey: companiesKey() });
  };
}

function Conflict({ error, onReload }: { error: unknown; onReload: () => void }) {
  if (!error) return null;
  return <div className="space-y-2"><Notice error={error} />{isConflict(error) && <Button type="button" size="sm" variant="outline" onClick={onReload}>Reload latest</Button>}</div>;
}

function IdentityForm({ company, onReload }: { company: CompanyDetail; onReload: () => void }) {
  const operation = useOperationKey();
  const updated = useCompanyUpdated(company.id);
  const [name, setName] = useState(company.name);
  const body = { version: company.version, name: name.trim() };
  const mutation = useMutation({ mutationFn: () => api.updateCompany(company.id, body, operation(body)), onSuccess: updated });
  return <Card title="Company details" description="The company identifier is part of every workspace URL and login, so it cannot be changed.">
    <form className="max-w-xl space-y-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
      <Field label="Company name" required maxLength={160} value={name} onChange={e => { mutation.reset(); setName(e.target.value); }} />
      <Field label="Company identifier" readOnly value={company.slug} />
      <Conflict error={mutation.error} onReload={onReload} />
      <Button disabled={mutation.isPending || !name.trim() || name.trim() === company.name}>{mutation.isPending ? 'Saving…' : 'Save details'}</Button>
    </form>
  </Card>;
}

function StatusSection({ company, onReload }: { company: CompanyDetail; onReload: () => void }) {
  const operation = useOperationKey();
  const updated = useCompanyUpdated(company.id);
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: (active: boolean) => api.setCompanyActive(company.id, active, company.version, operation({ id: company.id, active, version: company.version })),
    onSuccess: result => { updated(result); cache.invalidateQueries({ queryKey: dispatchersKey(company.id) }); },
  });
  const change = async () => {
    const suspend = company.active;
    const ok = await confirmDialog(suspend
      ? { title: `Suspend ${company.name}?`, message: 'Every dispatcher, shipper and driver is signed out immediately, open driver duty is ended, and nobody can sign in until the company is activated again. Orders and audit history are kept.', confirmLabel: 'Suspend company', tone: 'danger' }
      : { title: `Activate ${company.name}?`, message: 'Existing accounts can sign in again with their current passwords. Sessions ended by the suspension are not restored.', confirmLabel: 'Activate company' });
    if (ok) mutation.mutate(!suspend);
  };
  return <Card title="Company access" description={company.active ? 'The workspace is active. Suspending it blocks all company sign-ins without deleting any records.' : 'The workspace is suspended. No company account can sign in, and historical records are preserved.'}>
    <div className="space-y-3"><Conflict error={mutation.error} onReload={onReload} />
      <Button variant={company.active ? 'destructive' : 'default'} disabled={mutation.isPending} onClick={change}>{mutation.isPending ? 'Saving…' : company.active ? 'Suspend company' : 'Activate company'}</Button></div>
  </Card>;
}

function AuditSection({ id }: { id: string }) {
  const query = useQuery({ queryKey: auditKey(id), queryFn: () => api.companyAudit(id) });
  return <Card title="Administration history" description="Company and dispatcher account changes, newest first.">
    <QueryState query={query} loading="Loading history…" />
    {query.data?.length === 0 && <p className="text-sm text-app-muted">No administration events yet.</p>}
    {!!query.data?.length && <div className="app-table-shell overflow-x-auto"><table className="app-table text-left" aria-label="Administration history">
      <thead><tr><th>When</th><th>Event</th><th>By</th></tr></thead>
      <tbody>{query.data.map(entry => <tr key={entry.id}><td className="whitespace-nowrap text-app-muted">{formatWhen(entry.created_at)}</td><td>{auditLabel(entry.action)}</td><td>{entry.actor_login_id} <span className="text-xs text-app-muted">({entry.actor_role === 'ADMIN' ? 'Platform owner' : entry.actor_role.toLowerCase()})</span></td></tr>)}</tbody>
    </table></div>}
  </Card>;
}
