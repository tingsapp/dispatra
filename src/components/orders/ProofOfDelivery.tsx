import { useQuery } from '@tanstack/react-query';
import { operations } from '../../operations/api';
import { formatWhen } from './OrderDossierSections';

export const proofAvailable = (status?: string | null) => status === 'COMPLETED';
export const evidenceUrl = (slug: string, id: string) => `/api/v1/companies/${slug}/evidence/${id}`;

/** Proof of delivery for a completed Order: recipient, signature and photos, shared by the shipper and dispatcher order details. */
export function ProofOfDelivery({ slug, orderId, timeZone }: { slug: string; orderId: string; timeZone: string }) {
  const proof = useQuery({ queryKey: ['delivery-proof', slug, orderId], queryFn: () => operations.deliveryProof(slug, orderId) });
  return <section className="rounded-xl border border-slate-200 p-5 space-y-3 text-sm" aria-label="Proof of delivery">
    <h4 className="app-section-title">Proof of delivery</h4>
    {proof.isPending && <p role="status" className="text-slate-500">Loading proof of delivery…</p>}
    {proof.error && <p role="alert" className="text-red-700">{proof.error instanceof Error ? proof.error.message : 'Could not load proof of delivery.'}</p>}
    {proof.data?.length === 0 && <p className="text-slate-500">No proof of delivery recorded.</p>}
    {proof.data?.map(stop => <div key={stop.stop_id} className="space-y-2 border-t border-slate-100 pt-3 first-of-type:border-0 first-of-type:pt-0">
      <div><p className="font-medium text-slate-900">{stop.address.text}</p><p className="text-xs text-slate-500">Delivered {formatWhen(stop.completed_at, timeZone)}</p></div>
      <p className="text-slate-700">{stop.completed_by_dispatcher ? 'Completed by dispatcher – no proof of delivery' : stop.unattended ? 'Unattended – left at a safe place' : `Received by ${stop.recipient_name || 'recipient'}`}</p>
      {stop.evidence.length > 0 && <div className="flex flex-wrap gap-3">{stop.evidence.map(item => {
        const label = item.kind === 'SIGNATURE' ? 'Signature' : 'Photo';
        return <a key={item.id} href={evidenceUrl(slug, item.id)} target="_blank" rel="noreferrer" title={`Open ${label.toLowerCase()} in full size`} className="group block">
          <img src={evidenceUrl(slug, item.id)} alt={`${label} for ${stop.address.text}`} loading="lazy" className="h-28 w-44 rounded-lg border border-slate-200 bg-white object-contain group-hover:border-slate-400" />
          <span className="mt-1 block text-xs text-slate-500">{label} · {formatWhen(item.captured_at, timeZone)}</span>
        </a>;
      })}</div>}
    </div>)}
  </section>;
}
