import { useQuery } from '@tanstack/react-query';
import { Package, Truck, UsersRound } from 'lucide-react';
import { api, ApiError } from '../api';
import { Button } from '../ui';
import { ListSummary } from '../../components/layout/ListSummary';
import { Tabs } from '../../components/ui/Tabs';
import { QueryState } from './QueryState';
import { CompanyOverviewForm } from './CompanyOverviewForm';
import { CompanySubscriptionPage } from './CompanySubscriptionPage';
import { auditLabel, formatWhen } from './format';
import { auditKey, companyKey } from './queryKeys';

export function CompanyDetailPage({ id, initialTab, onBack }: { id: string; initialTab?: 'subscription' | 'payment-method'; onBack: () => void }) {
  const query = useQuery({ queryKey: companyKey(id), queryFn: () => api.company(id) });
  if (query.error instanceof ApiError && query.error.status === 404) return <div className="space-y-4 py-10 text-center"><p className="text-sm text-app-muted">This company does not exist or is no longer available.</p><Button variant="outline" onClick={onBack}>Back to companies</Button></div>;
  if (!query.data) return <QueryState query={query} loading="Loading company…" />;
  const company = query.data;
  return <div className="min-w-0 space-y-6">
    <QueryState query={query} loading="Loading company…" />
    <ListSummary label="Company totals" items={[
      { label: 'Total Shippers', value: company.shipper_count, icon: UsersRound },
      { label: 'Total Drivers', value: company.driver_count, icon: Truck },
      { label: 'Total Orders', value: company.order_count, icon: Package },
    ]} />
    <Tabs label="Company administration" initialActiveId={initialTab === 'payment-method' ? 'subscription' : initialTab} items={[
      { id: 'overview', label: 'Overview', content: <CompanyOverviewForm company={company} /> },
      { id: 'subscription', label: 'Subscription & billing', content: <CompanySubscriptionPage company={company} /> },
      { id: 'history', label: 'History', content: <AuditSection id={company.id} /> },
    ]} />
  </div>;
}

function AuditSection({ id }: { id: string }) {
  const query = useQuery({ queryKey: auditKey(id), queryFn: () => api.companyAudit(id) });
  return <section aria-label="Administration history" className="space-y-5">
    <div className="space-y-2"><h2 className="app-section-title">Administration history</h2><p className="text-sm text-app-muted">Company and dispatcher account changes, newest first.</p></div>
    <QueryState query={query} loading="Loading history…" />
    {query.data?.length === 0 && <p className="text-sm text-app-muted">No administration events yet.</p>}
    {!!query.data?.length && <div className="app-table-shell overflow-x-auto"><table className="app-table text-left" aria-label="Administration history">
      <thead><tr><th>When</th><th>Event</th><th>By</th></tr></thead>
      <tbody>{query.data.map(entry => <tr key={entry.id}><td className="whitespace-nowrap text-app-muted">{formatWhen(entry.created_at)}</td><td>{auditLabel(entry.action)}</td><td>{entry.actor_login_id} <span className="text-xs text-app-muted">({entry.actor_role === 'ADMIN' ? 'Platform owner' : entry.actor_role.toLowerCase()})</span></td></tr>)}</tbody>
    </table></div>}
  </section>;
}
