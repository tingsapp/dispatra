import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { loadBillingConfig, saveBillingConfig } from '../../lib/billingStorage';
import { loadSimplePricingConfig, saveSimplePricingConfig } from '../../lib/simplePricingStorage';
import { toDisplayDistanceRate } from '../../lib/units';
import { AccessorialItem, DeliveryService, SimplePricingConfig, VehicleType } from '../../types/simplePricing';
import { AccessorialModal } from '../pricing/AccessorialModal';
import { ServiceModal } from '../pricing/ServiceModal';
import { VehicleModal } from '../pricing/VehicleModal';

type Section = 'services' | 'vehicles' | 'accessorials';
type Item = DeliveryService | VehicleType | AccessorialItem;
const descriptions = {
  services: ['Services', 'Delivery promises, booking requirements and default price multipliers.', 'Service'],
  vehicles: ['Vehicle types', 'Capacity, customer surcharge and internal running cost per vehicle class. Manage individual fleet assets in Vehicles.', 'Vehicle type'],
  accessorials: ['Accessorials', 'Rates and application rules for waiting, stairs, helpers, and other delivery requirements.', 'Accessorial'],
};
const button = 'inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shrink-0';

export function CatalogueSection({ section, onNotification, onChanged }: { section: Section; onNotification?: (message: string) => void; onChanged?: () => void }) {
  const [config, setConfig] = useState(loadSimplePricingConfig);
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [billing, setBilling] = useState(loadBillingConfig);
  const [title, description, singular] = descriptions[section];
  const costPerKm = (id: string): number | null => billing.operatingCost.costPerKmByVehicleId[id] ?? null;
  /** Running cost lives with the organization's operating costs; the vehicle form is just where it is edited. */
  const saveVehicle = (vehicle: VehicleType, cost: number | null) => {
    const current = loadBillingConfig();
    const { [vehicle.id]: _previous, ...others } = current.operatingCost.costPerKmByVehicleId;
    const next = { ...current, operatingCost: { ...current.operatingCost, costPerKmByVehicleId: cost == null ? others : { ...others, [vehicle.id]: cost } } };
    saveBillingConfig(next); setBilling(next);
    save(vehicle);
  };
  const items = config[section].filter(item => `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  const commit = (records: Item[]) => {
    const next = { ...loadSimplePricingConfig(), [section]: records } as SimplePricingConfig;
    saveSimplePricingConfig(next);
    setConfig(next);
    onChanged?.();
  };
  const save = (item: Item) => {
    const records: Item[] = loadSimplePricingConfig()[section];
    commit(records.some(record => record.id === item.id) ? records.map(record => record.id === item.id ? item : record) : [...records, item]);
    onNotification?.(`${singular} saved.`);
  };
  const toggle = (item: Item) => {
    commit(loadSimplePricingConfig()[section].map(record => record.id === item.id ? { ...record, active: !record.active } : record));
    onNotification?.(`${item.name} ${item.active ? 'deactivated' : 'activated'}.`);
  };
  return <section aria-label={title} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-900">{title}</h2><p className="text-xs text-slate-500 mt-1">{description}</p></div><button type="button" onClick={() => setEditing(null)} className={button}><Plus className="w-3.5 h-3.5" />Add {singular}</button></div>
    {section === 'accessorials' && <input aria-label="Search Accessorials" placeholder="Search Accessorials" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white" />}
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>
      <th className="px-4 py-3 font-medium">Name</th>
      <th className="px-4 py-3 font-medium">{section === 'services' ? 'Delivery promise' : section === 'vehicles' ? 'Surcharge' : 'Rate'}</th>
      <th className="px-4 py-3 font-medium">{section === 'services' ? 'Booking requirements' : section === 'accessorials' ? 'Applies when' : 'Type limits'}</th>
      {section === 'services' && <th className="px-4 py-3 font-medium">Price multiplier</th>}
      {section === 'vehicles' && <th className="px-4 py-3 font-medium">Cost / {billing.general.distanceUnit}</th>}
      <th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3"><span className="sr-only">Edit</span></th>
    </tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
      {section === 'services' ? <><td className="px-4 py-3 text-slate-600">{(item as DeliveryService).estimatedTime || 'Not specified'}</td><td className="px-4 py-3 text-slate-500">{(item as DeliveryService).bookingCutoffTime ? `Book by ${(item as DeliveryService).bookingCutoffTime}` : 'No cutoff'} · {(item as DeliveryService).exclusiveVehicle ? 'Exclusive vehicle' : 'Shared vehicle'}</td></> : section === 'accessorials' ? <>
        <td className="px-4 py-3 text-slate-600">{(item as AccessorialItem).calculationType.startsWith('PERCENT') ? `${(item as AccessorialItem).rate}%` : `$${(item as AccessorialItem).rate.toFixed(2)}`} <span className="text-slate-400">{(item as AccessorialItem).calculationType.startsWith('PERCENT') ? (item as AccessorialItem).unitLabel.replace(/^%\s*/, '') : (item as AccessorialItem).unitLabel}</span></td>
        <td className="px-4 py-3 text-slate-500">{(item as AccessorialItem).autoRule === 'NONE' ? 'Selected on order' : (item as AccessorialItem).autoRule.toLowerCase().replace(/_/g, ' ')}{(item as AccessorialItem).appliesAt === 'PER_STOP' ? ' · per stop' : ''}</td>
      </> : <><td className="px-4 py-3 text-slate-600">${(item as VehicleType).baseSurcharge.toFixed(2)}</td><td className="px-4 py-3 text-slate-500">{(item as VehicleType).payloadCapacityKg} kg · {(item as VehicleType).palletCapacity} pallets</td></>}
      {section === 'services' && <td className="px-4 py-3 text-slate-600 tabular-nums">{(item as DeliveryService).defaultMultiplier}×</td>}
      {section === 'vehicles' && <td className="px-4 py-3 text-slate-600 tabular-nums">{costPerKm(item.id) == null ? <span className="text-slate-400">default</span> : `$${toDisplayDistanceRate(costPerKm(item.id)!, billing.general).toFixed(2)}`}</td>}
      <td className="px-4 py-3"><button type="button" aria-label={`${item.name}: ${item.active ? 'deactivate' : 'activate'}`} onClick={() => toggle(item)} className={`px-2 py-1 rounded text-[11px] font-medium ${item.active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>{item.active ? 'Active' : 'Inactive'}</button></td>
      <td className="px-4 py-3"><button type="button" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)} className="rounded p-1.5 hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button></td>
    </tr>)}{!items.length && <tr><td colSpan={section === 'accessorials' ? 5 : 6} className="p-6 text-center text-slate-500">{search ? 'No matches. Try a different search.' : `No ${title.toLowerCase()} yet.`}</td></tr>}</tbody></table></div>
    {editing !== undefined && section === 'services' && <ServiceModal isOpen onClose={() => setEditing(undefined)} onSave={save} initialService={editing as DeliveryService | null} />}
    {editing !== undefined && section === 'accessorials' && <AccessorialModal isOpen onClose={() => setEditing(undefined)} onSave={save} initialAccessorial={editing as AccessorialItem | null} />}
    {editing !== undefined && section === 'vehicles' && <VehicleModal isOpen onClose={() => setEditing(undefined)} onSave={saveVehicle} initialVehicle={editing as VehicleType | null} initialCostPerKm={editing ? costPerKm(editing.id) : null} />}
  </section>;
}
