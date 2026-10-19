import { useCompanyChannel } from '../../chat/api';
import { ChatPopup } from './ChatPopup';
import { ChatThread } from './ChatThread';
import { Button } from '../ui/button';

export function CompanyChatDialog({ slug, driverId, onClose }: { slug: string; driverId: string; onClose: () => void }) {
  const query = useCompanyChannel(slug, driverId);
  return <ChatPopup company onClose={onClose}>
    {query.isPending ? <p role="status">Loading company conversation…</p>
      : query.error ? <div><p role="alert">This company conversation could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
      : <ChatThread key={driverId} slug={slug} driverId={driverId} channel={query.data} />}
  </ChatPopup>;
}
