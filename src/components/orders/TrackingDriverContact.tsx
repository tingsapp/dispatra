import { MessageSquare } from 'lucide-react';
import { DriverAvatar } from '../DriverAvatar';
import { Button } from '../ui/button';
import { formatPhone } from '../../lib/phone';
import type { Tracking } from './trackingPresentation';

/** Contact details come only from the selected order's authorized tracking view; Message opens the order's in-app chat with the driver. */
export function TrackingDriverContact({ driver, onMessage }: { driver: NonNullable<Tracking['driver']>; onMessage?: () => void }) {
  const name = driver.name || driver.first_name;
  const phone = driver.phone?.trim();
  return <section aria-label="Assigned driver" className="flex items-center gap-3">
    <DriverAvatar name={name} avatar={driver.avatar_url} alt={`${name}'s avatar`} referrerPolicy="no-referrer"
      className="size-10 shrink-0 rounded-full object-cover" />
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-medium text-app-text">{name}</p>
      {phone ? <a href={`tel:${phone}`} aria-label={`Call ${name}`} className="mt-0.5 block truncate text-[11px] text-app-muted">{formatPhone(phone)}</a>
        : <p className="mt-0.5 text-[11px] text-app-muted">Phone unavailable</p>}
    </div>
    {onMessage && <Button type="button" variant="outline" size="icon-sm" onClick={onMessage} aria-label={`Message ${name}`} title={`Message ${name}`}>
      <MessageSquare aria-hidden="true" />
    </Button>}
  </section>;
}
