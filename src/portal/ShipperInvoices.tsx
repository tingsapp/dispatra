import { useQuery } from '@tanstack/react-query';
import { allOperations } from '../operations/api';
import { Notice } from './ui';
const money = (value: number | string) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value));
export function ShipperInvoices({ slug }: { slug: string }) {
  const invoices = useQuery({ queryKey: ['shipper-invoices', slug], queryFn: () => allOperations.invoices(slug) });
  return <div className="space-y-4">
    <Notice error={invoices.error} />
    {invoices.isPending && <p role="status" className="text-sm text-app-muted">Loading invoices…</p>}
    <div className="app-table-shell overflow-x-auto">
      <table className="app-table text-left" aria-label="Invoices">
        <thead><tr><th>Invoice</th><th>Issued</th><th>Total</th><th>Action</th></tr></thead>
        <tbody>{invoices.data?.map(invoice => <tr key={invoice.id}>
          <td>{invoice.number}</td><td>{new Date(invoice.created_at).toLocaleDateString('en-CA')}</td><td>{money(invoice.total)}</td>
          <td><a className="text-app-text hover:underline underline-offset-4" href={`/api/v1/companies/${slug}/invoices/${invoice.id}/document`} target="_blank" rel="noreferrer">View invoice</a></td>
        </tr>)}</tbody>
      </table>
    </div>
    {invoices.data?.length === 0 && <p className="py-8 text-center text-sm text-app-muted">No invoices yet.</p>}
  </div>;
}
