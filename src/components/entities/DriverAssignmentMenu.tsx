import { DriverAvatar } from '../DriverAvatar';
import type { Driver } from '../../types';
import { User } from 'lucide-react';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';

interface Props {
  drivers: Pick<Driver, 'id' | 'name' | 'avatar' | 'statusLabel' | 'driverNumber'>[];
  /** The shipper's optional driver preference: listed first and labelled. */
  requestedId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (driverId: string) => void;
}

/** Presentation only: assignment eligibility and updates remain with the caller. */
export function DriverAssignmentMenu({ drivers, requestedId, open, onOpenChange, onSelect }: Props) {
  const ordered = requestedId ? [...drivers].sort((a, b) => Number(b.id === requestedId) - Number(a.id === requestedId)) : drivers;
  return <DropdownMenu open={open} onOpenChange={onOpenChange}>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" size="sm"><User aria-hidden="true" />Assign Driver</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <p className="px-3 py-2 text-xs text-app-muted">Select Driver</p>
      {ordered.length ? ordered.map(driver => <DropdownMenuItem key={driver.id} onSelect={() => onSelect(driver.id)}>
        <span className="flex items-center gap-3">
          <DriverAvatar name={driver.name} avatar={driver.avatar} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{driver.name}</span>
            <span className="block text-xs text-app-muted">{driver.driverNumber ?? driver.id} · {driver.statusLabel}{driver.id === requestedId && ' · Requested by shipper'}</span>
          </span>
        </span>
      </DropdownMenuItem>) : <p className="px-3 py-2 text-sm text-app-muted">No drivers available.</p>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
