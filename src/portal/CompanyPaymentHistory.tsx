import { useInfiniteQuery } from '@tanstack/react-query';
import { api, type PaymentTarget } from './api';
import { Button, Notice } from './ui';
import { dateTime } from '../lib/dateTimeFormat';

const labels = { PAID: 'Paid', PENDING: 'Pending', FAILED: 'Failed', REFUNDED: 'Refunded', PARTIALLY_REFUNDED: 'Partially refunded' };
const money = (value: string | number, currency: string) => new Intl.NumberFormat('en-CA', { style: 'currency', currency, currencyDisplay: 'code' }).format(Number(value));

export function CompanyPaymentHistory({ target }: { target: PaymentTarget }) {
  const query = useInfiniteQuery({ queryKey: ['company-payment-history', target.kind, target.kind === 'owner' ? target.id : target.slug],
    queryFn: ({ pageParam }) => api.paymentHistory(target, pageParam), initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.next_cursor ?? undefined });
  const rows = query.data?.pages.flatMap(page => page.items) ?? [];
  const available = query.data?.pages[0]?.available;
  return <section aria-label="Payment history" className="space-y-5">
    <h2 className="app-section-title">Payment history</h2>
    {query.isPending && <p role="status" className="text-sm text-app-muted">Loading payment history…</p>}
    <Notice error={query.error} />
    {query.isError && <Button variant="outline" onClick={() => query.refetch()}>Retry payment history</Button>}
    {available === false && <p className="text-sm text-app-muted">Payment history is currently unavailable.</p>}
    {available && !rows.length && <p className="text-sm text-app-muted">No payments yet.</p>}
    {!!rows.length && <div className="app-table-shell overflow-x-auto"><table className="app-table text-left" aria-label="Payment history">
      <thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id}><td className="whitespace-nowrap">{dateTime(row.created_at)}</td><td className="whitespace-nowrap">{money(row.amount, row.currency)}{Number(row.refunded_amount) > 0 && <span className="mt-1 block text-xs text-app-muted">{money(row.refunded_amount, row.currency)} refunded</span>}</td><td className="whitespace-nowrap">{labels[row.status]}</td><td>{row.receipt_url ? <a href={row.receipt_url} target="_blank" rel="noopener noreferrer" className="text-app-accent underline underline-offset-4" aria-label={`View receipt for ${money(row.amount, row.currency)}`}>View receipt</a> : <span className="text-app-muted">-</span>}</td></tr>)}</tbody>
    </table></div>}
    {query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading…' : 'Load more payments'}</Button>}
  </section>;
}
