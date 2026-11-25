import { evidenceUrl } from '../orders/ProofOfDelivery';
import type { NeedsAttentionItem } from '../../types';

/** Photos a driver attached to a stop report; each opens full size. Clicks never reach the row behind it. */
export function IssuePhotos({ slug, item, compact = false }: { slug?: string; item: NeedsAttentionItem; compact?: boolean }) {
  const photos = item.photoIds ?? [];
  if (!slug || !photos.length) return null;
  if (compact) return <p className="text-xs text-slate-500">{photos.length} report photo{photos.length === 1 ? '' : 's'}</p>;
  return <div className="flex flex-wrap gap-2" onClick={event => event.stopPropagation()}>
    {photos.map((id, index) => <a key={id} href={evidenceUrl(slug, id)} target="_blank" rel="noreferrer" title="Open photo in full size" className="block">
      <img src={evidenceUrl(slug, id)} alt={`Report photo ${index + 1} for ${item.jobNumber}`} loading="lazy" className="h-20 w-28 rounded-lg border border-slate-200 bg-white object-cover hover:border-slate-400" />
    </a>)}
  </div>;
}
