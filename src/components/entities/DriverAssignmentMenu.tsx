import { useState } from 'react';
import { usePendingAction } from '../ui/usePendingAction';
import { DriverAvatar } from '../DriverAvatar';
import type { Driver } from '../../types';
import { User } from 'lucide-react';
import { Button } from '../ui/button';
import { FloatingPanel } from '../ui/FloatingPanel';
import { MenuItem, MenuList } from '../ui/Menu';
import { SearchInput } from '../ui/SearchInput';

interface Props {
  drivers: Pick<Driver, 'id' | 'name' | 'avatar' | 'statusLabel' | 'driverNumber' | 'crewSize'>[];
  /** The shipper's optional driver preference: listed first and labelled. */
  requestedId?: string | null;
  requiredId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolve `false` when the assignment did not save so the popup stays open for another choice. */
  onSelect: (driverId: string) => unknown;
}

const SEARCH_MIN_DRIVERS = 6;

/** Presentation only: assignment eligibility and updates remain with the caller. */
export function DriverAssignmentMenu({ drivers, requestedId, requiredId, open, onOpenChange, onSelect }: Props) {
  const action = usePendingAction();
  const [search, setSearch] = useState('');
  const ordered = requestedId ? [...drivers].sort((a, b) => Number(b.id === requestedId) - Number(a.id === requestedId)) : drivers;
  const term = search.trim().toLowerCase();
  const visible = term ? ordered.filter(driver => [driver.name, driver.driverNumber, driver.id, driver.statusLabel].some(value => value?.toLowerCase().includes(term))) : ordered;
  const changeOpen = (next: boolean) => { if (!next) setSearch(''); onOpenChange(next); };
  const select = (driverId: string) => void action.run(async () => { if (await onSelect(driverId) !== false) changeOpen(false); }, driverId);
  return <FloatingPanel open={open} onOpenChange={changeOpen} label="Assign driver" size="rich" dismissible={!action.pending}
    trigger={<Button type="button" variant="outline" size="sm"><User aria-hidden="true" />Assign Driver</Button>}>
    <p className="px-3 py-2 text-xs text-app-muted">Select driver{drivers.length ? ` · ${drivers.length}` : ''}</p>
    {drivers.length >= SEARCH_MIN_DRIVERS && <div className="px-1.5 pb-1.5"><SearchInput value={search} onChange={setSearch} placeholder="Search drivers..." aria-label="Search drivers"
      inputProps={{ onKeyDown: event => { if (event.key !== 'ArrowDown') return; event.preventDefault(); event.currentTarget.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('[data-menu-item]:not(:disabled)')?.focus(); } }} /></div>}
    {visible.length ? <MenuList>{visible.map(driver => <MenuItem key={driver.id} loading={action.pendingKey === driver.id} disabled={action.pending || (!!requiredId && driver.id !== requiredId)} onClick={() => select(driver.id)}>
      <span className="flex items-center gap-3">
        <DriverAvatar name={driver.name} avatar={driver.avatar} alt="" className="size-8 shrink-0 rounded-full object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{driver.name}</span>
          <span className="block text-xs text-app-muted">{driver.driverNumber ?? driver.id} · {driver.statusLabel}{(driver.crewSize ?? 1) >= 2 && ' · With helper'}{driver.id === requestedId && ' · Requested by shipper'}</span>
        </span>
      </span>
    </MenuItem>)}</MenuList> : <p className="px-3 py-2 text-sm text-app-muted">{drivers.length ? 'No drivers match your search.' : 'No drivers available.'}</p>}
  </FloatingPanel>;
}
