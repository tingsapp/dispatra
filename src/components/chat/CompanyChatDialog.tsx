import { useCompanyChannel } from '../../chat/api';
import { ChatPopup } from './ChatPopup';
import { ChatThread } from './ChatThread';
import { Button } from '../ui/button';

type Target = { slug: string; driverId?: string; shipperId?: string; timeZone?: string };
type Query = ReturnType<typeof useCompanyChannel>;
function CompanyThread({ slug, driverId, shipperId, query, page, timeZone }: Target & { query: Query; page?: boolean }) {
  return query.isPending ? <p role="status" className={page ? 'm-auto text-sm text-app-muted' : undefined}>Loading company conversation…</p>
    : query.error ? <div className={page ? 'm-auto text-center' : undefined}><p role="alert">This company conversation could not be loaded.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>
    : query.data ? <ChatThread key={shipperId ?? driverId} slug={slug} driverId={driverId} shipperId={shipperId} channel={query.data} page={page} timeZone={timeZone} /> : null;
}
/** Embedded company conversation; the host controls when it is visible. */
export function CompanyChatPanel(target: Target) {
  const query = useCompanyChannel(target.slug, target.driverId, target.shipperId);
  return <section aria-label={target.shipperId ? 'Shipper messages' : 'Driver messages'} className="flex min-h-0 flex-col">
    <CompanyThread {...target} query={query} />
  </section>;
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
  return <section aria-label={`Conversation with ${company}`} className="chat-page-full flex min-h-0 w-full flex-1 flex-col">
    <CompanyThread {...target} query={query} page />
  </section>;
}
