import { clockText } from '../../lib/dateTimeFormat';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { confirmDialog } from '../ui/ConfirmDialog';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import { allOperations, operations } from '../../operations/api';
import { api } from '../../portal/api';
import { companySettingsKey } from '../../portal/WorkspaceAccount';
import { defaultServiceId } from '../../lib/orderPricing';
import { catalogFromUi, catalogueFromApi } from '../../operations/pricingAdapters';
import { loadBillingConfig } from '../../lib/billingStorage';
import { loadSimplePricingConfig, saveSimplePricingConfig } from '../../lib/simplePricingStorage';
import { AccessorialItem, DeliveryService, SimplePricingConfig } from '../../types/simplePricing';
import { AccessorialModal } from '../pricing/AccessorialModal';
import { ServiceModal } from '../pricing/ServiceModal';

type Section = 'services' | 'accessorials';
type Item = DeliveryService | AccessorialItem;
const descriptions = {
  services: ['Services', 'Delivery promises and fixed charges added once per order. New orders, and emails that don’t name a service, use the Default.', 'Service'],
  accessorials: ['Accessorials', 'Fragile and DG are charged for each flagged package; other selected charges apply once per order.', 'Accessorial'],
};
const button = 'inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shrink-0';

export function CatalogueSection({ section, onNotification, onChanged }: { section: Section; onNotification?: (message: string) => void; onChanged?: () => void }) {
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const settingsQuery = useQuery({ queryKey: companySettingsKey(slug!), queryFn: () => api.companySettings(slug!), enabled: !!slug && section === 'services' });
  const [config, setConfig] = useState(() => slug ? { services: [], vehicles: [], accessorials: [] } as SimplePricingConfig : loadSimplePricingConfig());
  useEffect(() => { if (slug && catalogQuery.data) { const all = catalogueFromApi(catalogQuery.data, settingsQuery.data?.data.default_service_id); setConfig({ ...all, services: all.services.filter(row => row.active), accessorials: all.accessorials.filter(row => row.active) }); } }, [slug, catalogQuery.data, settingsQuery.data]);
  const [editing, setEditing] = useState<Item | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [billing] = useState(loadBillingConfig);
  const [title, description, singular] = descriptions[section];
  const items = config[section].filter(item => `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()));
  const defaultId = section === 'services' ? defaultServiceId(config.services) : '';
  const commit = (records: Item[]) => {
    const next = { ...loadSimplePricingConfig(), [section]: records } as SimplePricingConfig;
    if (!slug) saveSimplePricingConfig(next);
    setConfig(next);
    onChanged?.();
  };
  const save = async (item: Item) => {
    if (slug) {
      const previous = catalogQuery.data?.find(row => row.id === item.id);
      try {
        if (previous) await operations.updateCatalog(slug, previous, catalogFromUi(item as DeliveryService | AccessorialItem, previous));
        else await operations.createCatalog(slug, section === 'services' ? 'SERVICE' : 'ACCESSORIAL', (item as DeliveryService | AccessorialItem).code, catalogFromUi(item as DeliveryService | AccessorialItem));
        await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'catalog'] });
        onChanged?.(); onNotification?.(`${singular} saved.`);
      } catch (error) { onNotification?.(error instanceof Error ? error.message : `Could not save ${singular.toLowerCase()}.`); if (section === 'accessorials') throw error; }
      return;
    }
    const records: Item[] = loadSimplePricingConfig()[section];
    commit(records.some(record => record.id === item.id) ? records.map(record => record.id === item.id ? item : record) : [...records, item]);
    onNotification?.(`${singular} saved.`);
  };
  const makeDefault = async (item: Item) => {
    if (slug) {
      const settings = settingsQuery.data; if (!settings) return;
      try {
        const saved = await api.saveCompanySettings(slug, { version: settings.version, data: { ...settings.data, default_service_id: item.id } }, crypto.randomUUID());
        queryClient.setQueryData(companySettingsKey(slug), saved); onChanged?.(); onNotification?.(`${item.name} is now the Default service.`);
      } catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not change the Default service.'); }
      return;
    }
    commit(loadSimplePricingConfig().services.map(service => ({ ...service, isDefault: service.id === item.id })));
    onNotification?.(`${item.name} is now the Default service.`);
  };
  const deleteItem = async (item: Item) => {
    if (item.id === defaultId) { onNotification?.('Set another service as Default before deleting this one.'); return; }
    if (!(await confirmDialog({
      title: `Delete ${singular.toLowerCase()} “${item.name}”?`,
      message: 'This removes it from future order choices. Saved order prices stay unchanged, but orders using it may need a replacement before editing or repricing.',
      confirmLabel: `Delete ${singular.toLowerCase()}`,
      tone: 'danger'
    }))) return;
    if (slug) {
      const record = catalogQuery.data?.find(row => row.id === item.id); if (!record) return;
      try { await operations.deleteCatalog(slug, record); await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'catalog'] }); onChanged?.(); onNotification?.(`${item.name} deleted.`); }
      catch (error) { onNotification?.(error instanceof Error ? error.message : `Could not delete ${item.name}.`); }
      return;
    }
    const records = loadSimplePricingConfig()[section];
    if (!records.some(record => record.id === item.id)) return;
    commit(records.filter(record => record.id !== item.id));
    onNotification?.(`${item.name} deleted.`);
  };
  return <section aria-label={title} className="space-y-4">
    {slug && catalogQuery.isPending && <p role="status" className="text-sm text-slate-500">Loading {title.toLowerCase()}…</p>}
    {slug && catalogQuery.error && <p role="alert" className="text-sm text-rose-700">{catalogQuery.error.message}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="app-section-title text-slate-900">{title}</h2><p className="text-xs text-slate-500 mt-1">{description}</p></div><button type="button" onClick={() => setEditing(null)} className={button}><Plus className="w-3.5 h-3.5" />Add {singular}</button></div>
    {section === 'accessorials' && <input aria-label="Search Accessorials" placeholder="Search Accessorials" value={search} onChange={event => setSearch(event.target.value)} className="app-input w-full sm:max-w-xs" />}
    <div className="app-table-shell overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className={`app-table w-full min-w-[620px] text-left text-xs ${section === 'services' ? 'app-services-table' : ''}`}><thead className="bg-slate-50 text-slate-500"><tr>
      <th className="px-4 py-3 font-medium">Name</th>
      <th className="px-4 py-3 font-medium">{section === 'services' ? 'Delivery promise' : 'Rate'}</th>
      <th className="px-4 py-3 font-medium">{section === 'services' ? 'Booking requirements' : 'Applies when'}</th>
      {section === 'services' && <th className="px-4 py-3 font-medium">Additional charge ({billing.quoteSettings.currency})</th>}
      <th className="px-4 py-3 font-medium">Action</th>
    </tr></thead><tbody>{items.map(item => <tr key={item.id} className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-900">{item.name}{item.id === defaultId && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">Default</span>}</td>
      {section === 'services' ? <><td className="px-4 py-3 text-slate-600">{clockText((item as DeliveryService).estimatedTime || 'Not specified')}</td><td className="px-4 py-3 text-slate-500">{(item as DeliveryService).bookingCutoffTime ? `Book by ${(item as DeliveryService).bookingCutoffTime}` : 'No cutoff'} · {(item as DeliveryService).exclusiveVehicle ? 'Exclusive vehicle' : 'Shared vehicle'}</td></> : <>
        <td className="px-4 py-3 text-slate-600">${(item as AccessorialItem).rate.toFixed(2)} <span className="text-slate-400">{item.code === 'FRAGILE' || item.code === 'DG' ? 'per package' : 'per order'}</span></td>
        <td className="px-4 py-3 text-slate-500">{item.code === 'FRAGILE' || item.code === 'DG' ? 'Package checkbox' : 'Selected on order'}</td>
      </>}
      {section === 'services' && <td className="px-4 py-3 text-slate-600 tabular-nums">{(item as DeliveryService).additionalCharge == null ? 'Set charge' : `$${(item as DeliveryService).additionalCharge!.toFixed(2)}`}</td>}
      <td className="px-4 py-3"><div className="inline-flex items-center gap-1">
        {section === 'services' && item.id !== defaultId && <button type="button" aria-label={`Set ${item.name} as default`} title="Set as default" onClick={() => void makeDefault(item)} className="rounded p-1.5 hover:bg-slate-100 text-slate-500"><Star aria-hidden="true" className="h-3.5 w-3.5" /></button>}
        <button type="button" aria-label={`Delete ${item.name}`} title={`Delete ${item.name}`} onClick={() => void deleteItem(item)} className="rounded p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)} className="rounded p-1.5 hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
      </div></td>
    </tr>)}{!items.length && <tr><td colSpan={section === 'accessorials' ? 4 : 5} className="p-6 text-center text-slate-500">{search ? 'No matches. Try a different search.' : `No ${title.toLowerCase()} yet.`}</td></tr>}</tbody></table></div>
    {editing !== undefined && section === 'services' && <ServiceModal isOpen onClose={() => setEditing(undefined)} onSave={save} initialService={editing as DeliveryService | null} />}
    {editing !== undefined && section === 'accessorials' && <AccessorialModal isOpen onClose={() => setEditing(undefined)} onSave={save} initialAccessorial={editing as AccessorialItem | null} />}
  </section>;
}
