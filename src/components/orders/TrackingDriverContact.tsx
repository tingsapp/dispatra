import { MessageSquare } from 'lucide-react';
import { DriverAvatar } from '../DriverAvatar';
import { Button } from '../ui/button';
import { formatPhone } from '../../lib/phone';
import type { Tracking } from './trackingPresentation';

/** Contact details come only from the selected order's authorized tracking view. */
export function TrackingDriverContact({ driver }: { driver: NonNullable<Tracking['driver']> }) {
  const name = driver.name || driver.first_name;
  const phone = driver.phone?.trim();
  return <section aria-label="Assigned driver" className="flex items-start gap-3">
    <DriverAvatar name={name} avatar={driver.avatar_url} alt={`${name}'s avatar`} referrerPolicy="no-referrer"
      className="size-10 shrink-0 rounded-full object-cover" />
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm font-medium text-app-text">{name}</p>
      <div className="mt-0.5 flex items-center gap-2">
        {phone ? <a href={`tel:${phone}`} aria-label={`Call ${name}`} className="min-w-0 truncate text-[11px] text-app-muted">{formatPhone(phone)}</a>
          : <p className="text-[11px] text-app-muted">Phone unavailable</p>}
        {phone ? <Button asChild variant="outline" size="icon-sm"><a href={`sms:${phone}`} aria-label={`Message ${name}`} title={`Message ${name}`}>
          <MessageSquare aria-hidden="true" />
        </a></Button> : <Button variant="outline" size="icon-sm" disabled aria-label={`Message ${name}: phone unavailable`} title="Phone unavailable">
          <MessageSquare aria-hidden="true" />
        </Button>}
      </div>
    </div>
  </section>;
}
