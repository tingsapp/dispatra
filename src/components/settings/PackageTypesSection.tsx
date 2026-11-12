import { ActionButton } from '../ui/button';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { confirmDialog } from '../ui/ConfirmDialog';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import { allOperations, operations } from '../../operations/api';
import { catalogueFromApi, packageTypeToCatalog } from '../../operations/pricingAdapters';
import { loadBillingConfig } from '../../lib/billingStorage';
import { toDisplayDimension, toDisplayWeight } from '../../lib/units';
import { PackageType } from '../../types/simplePricing';
import { PackageTypeModal } from '../pricing/PackageTypeModal';

const typeCode = (name: string) => `${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'PACKAGE'}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

/** Company Package Types (API workspaces only). Order forms offer the active ones; deleting keeps saved orders unchanged. */
export function PackageTypesSection({ onNotification, onChanged }: { onNotification?: (message: string) => void; onChanged?: () => void }) {
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const [editing, setEditing] = useState<PackageType | null | undefined>(undefined);
  const [units] = useState(() => loadBillingConfig().general);
  const types = (catalogueFromApi(catalogQuery.data ?? []).packageTypes ?? []).filter(type => type.active);
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'catalog'] }); onChanged?.(); };
  const save = async (type: PackageType) => {
    if (!slug) return;
    try {
      const previous = catalogQuery.data?.find(row => row.id === type.id);
      if (previous) await operations.updateCatalog(slug, previous, packageTypeToCatalog(type, previous));
      else await operations.createCatalog(slug, 'PACKAGE_TYPE', typeCode(type.name), packageTypeToCatalog(type));
      await refresh(); setEditing(undefined); onNotification?.('Package type saved.');
    } catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not save package type.'); }
  };
  const remove = async (type: PackageType) => {
    if (!slug || !(await confirmDialog({ title: `Delete package type “${type.name}”?`, message: 'It will no longer be offered on new packages. Saved orders keep it.', confirmLabel: 'Delete package type', tone: 'danger' }))) return;
    const record = catalogQuery.data?.find(row => row.id === type.id); if (!record) return;
    try { await operations.deleteCatalog(slug, record); await refresh(); onNotification?.(`${type.name} deleted.`); }
    catch (error) { onNotification?.(error instanceof Error ? error.message : `Could not delete ${type.name}.`); }
  };
  const size = (type: PackageType) => type.lengthCm == null || type.widthCm == null || type.heightCm == null ? '-'
    : [type.lengthCm, type.widthCm, type.heightCm].map(cm => Number(toDisplayDimension(cm, units).toFixed(1))).join(' × ');
  return <section aria-label="Package types" className="space-y-4">
    {catalogQuery.isPending && <p role="status" className="text-sm text-slate-500">Loading package types…</p>}
    {catalogQuery.error && <p role="alert" className="text-sm text-rose-700">{catalogQuery.error.message}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="app-section-title text-slate-900">Package types</h2><p className="text-xs text-slate-500 mt-1">What is being sent, chosen for each package on an order. Defaults fill in its size and weight; package types do not change the price.</p></div>
      <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shrink-0"><Plus className="w-3.5 h-3.5" />Add Package Type</button></div>
    <div className="app-table-shell overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="app-table w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>
      <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Description</th><th className="px-4 py-3 font-medium">Default weight ({units.weightUnit})</th>
      <th className="px-4 py-3 font-medium">Default L × W × H ({units.dimensionUnit})</th><th className="px-4 py-3 font-medium">Action</th>
    </tr></thead><tbody>{types.map(type => <tr key={type.id} className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-900">{type.name}</td>
      <td className="px-4 py-3 text-slate-600">{type.description || '-'}</td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">{type.defaultWeightKg == null ? '-' : Number(toDisplayWeight(type.defaultWeightKg, units).toFixed(2))}</td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">{size(type)}</td>
      <td className="px-4 py-3"><div className="inline-flex items-center gap-1">
        <ActionButton type="button" aria-label={`Delete ${type.name}`} title={`Delete ${type.name}`} onClick={() => remove(type)} className="rounded p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></ActionButton>
        <button type="button" aria-label={`Edit ${type.name}`} onClick={() => setEditing(type)} className="rounded p-1.5 hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
      </div></td>
    </tr>)}{!types.length && !catalogQuery.isPending && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No package types yet.</td></tr>}</tbody></table></div>
    {editing !== undefined && <PackageTypeModal initialType={editing} onClose={() => setEditing(undefined)} onSave={save} />}
  </section>;
}
