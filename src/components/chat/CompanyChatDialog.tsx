import { useCompanyChannel } from '../../chat/api';
import { ChatPopup } from './ChatPopup';
import { ChatThread } from './ChatThread';
import { Button } from '../ui/button';

type Target = { slug: string; driverId?: string; shipperId?: string };
type Query = ReturnType<typeof useCompanyChannel>;
function CompanyThread({ slug, driverId, shipperId, query }: Target & { query: Query }) {
  return query.isPending ? <p role="status">Loading company conversation…</p>
    : query.error ? <div><p role="alert">This company conversation could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
    : query.data ? <ChatThread key={shipperId ?? driverId} slug={slug} driverId={driverId} shipperId={shipperId} channel={query.data} /> : null;
}
export function CompanyChatDialog({ slug, driverId, shipperId, onClose }: Target & { onClose: () => void }) {
  const query = useCompanyChannel(slug, driverId, shipperId);
  return <ChatPopup slug={slug} channel={query.data} onClose={onClose}>
    <CompanyThread slug={slug} driverId={driverId} shipperId={shipperId} query={query} />
  </ChatPopup>;
}
/** Sidebar Chat always opens one ongoing company conversation, with no Order or driver picker. */
export function CompanyChatPage({ company, ...target }: Target & { company: string }) {
  const query = useCompanyChannel(target.slug, target.driverId, target.shipperId);
  return <section aria-label="Company conversation" data-page-width="reading" className="flex w-full flex-col gap-4">
    <h2 className="app-section-title">{company}</h2><CompanyThread {...target} query={query} />
  </section>;
}
