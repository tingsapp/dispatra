import type { Driver } from '../../types';
import { CompanyChatDialog } from './CompanyChatDialog';

/** Company/driver chat stays available independently of assigned orders. */
export function DriverChatDialog({ slug, driver, onClose }: { slug: string; driver: Driver; onClose: () => void }) {
  return <CompanyChatDialog slug={slug} driverId={driver.id} onClose={onClose} />;
}
