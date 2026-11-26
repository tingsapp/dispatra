import { evidenceUrl } from '../orders/ProofOfDelivery';
import { PhotoThumbnails } from '../ui/PhotoViewer';
import type { NeedsAttentionItem } from '../../types';

/** Photos a driver attached to a stop report; each opens full size in the photo viewer. Clicks never reach the row behind it. */
export function IssuePhotos({ slug, item, compact = false }: { slug?: string; item: NeedsAttentionItem; compact?: boolean }) {
  const photos = item.photoIds ?? [];
  if (!slug || !photos.length) return null;
  if (compact) return <p className="text-xs text-slate-500">{photos.length} report photo{photos.length === 1 ? '' : 's'}</p>;
  return <div onClick={event => event.stopPropagation()}>
    <PhotoThumbnails thumbClassName="h-20 w-28 rounded-lg border border-slate-200 bg-white object-cover" photos={photos.map((id, index) => ({ src: evidenceUrl(slug, id), alt: `Report photo ${index + 1} for ${item.jobNumber}`, caption: `${item.jobNumber} · ${item.statusLabel}` }))} />
  </div>;
}
