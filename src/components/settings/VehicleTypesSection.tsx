import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { confirmDialog } from '../ui/ConfirmDialog';
import { companySlugForCurrentPath } from '../../lib/pageRoutes';
import { allOperations, operations } from '../../operations/api';
import { catalogToVehicleType, vehicleTypeToCatalog } from '../../operations/adapters';
import { loadBillingConfig } from '../../lib/billingStorage';
import { loadSimplePricingConfig, saveSimplePricingConfig } from '../../lib/simplePricingStorage';
import { toDisplayDimension, toDisplayWeight } from '../../lib/units';
import { VehicleType } from '../../types/simplePricing';
import { VehicleTypeModal } from '../pricing/VehicleTypeModal';
import { listedVehicleTypes } from '../../lib/vehicleTypes';

const typeCode = (name: string) => `${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'VEHICLE'}_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export function VehicleTypesSection({ onNotification, onChanged }: { onNotification?: (message: string) => void; onChanged?: () => void }) {
  const slug = companySlugForCurrentPath();
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: ['operations', slug, 'catalog'], queryFn: () => allOperations.catalog(slug!), enabled: !!slug });
  const [local, setLocal] = useState(() => slug ? [] : loadSimplePricingConfig().vehicles);
  const [editing, setEditing] = useState<VehicleType | null | undefined>(undefined);
  const [units] = useState(() => loadBillingConfig().general);
  const all = slug ? (catalogQuery.data ?? []).filter(row => row.kind === 'VEHICLE_TYPE').map(catalogToVehicleType) : local;
  const types = listedVehicleTypes(all);
  const commit = (vehicles: VehicleType[]) => { saveSimplePricingConfig({ ...loadSimplePricingConfig(), vehicles }); setLocal(vehicles); onChanged?.(); };
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ['operations', slug, 'catalog'] }); onChanged?.(); };
  const save = async (type: VehicleType) => {
    try {
      if (slug) {
        const previous = catalogQuery.data?.find(row => row.id === type.id);
        if (previous) await operations.updateCatalog(slug, previous, vehicleTypeToCatalog(type, previous));
        else await operations.createCatalog(slug, 'VEHICLE_TYPE', typeCode(type.name), vehicleTypeToCatalog(type));
        await refresh();
      } else {
        const records = loadSimplePricingConfig().vehicles;
        commit(records.some(record => record.id === type.id) ? records.map(record => record.id === type.id ? type : record) : [...records, type]);
      }
      setEditing(undefined); onNotification?.('Vehicle type saved.');
    } catch (error) { onNotification?.(error instanceof Error ? error.message : 'Could not save vehicle type.'); }
  };
  const remove = async (type: VehicleType) => {
    if (!(await confirmDialog({ title: `Delete vehicle type “${type.name}”?`, message: 'It will no longer be offered when registering or editing vehicles. Vehicles already registered with it keep their details.', confirmLabel: 'Delete vehicle type', tone: 'danger' }))) return;
    try {
      if (slug) {
        const record = catalogQuery.data?.find(row => row.id === type.id); if (!record) return;
        await operations.deleteCatalog(slug, record); await refresh();
      } else commit(loadSimplePricingConfig().vehicles.map(record => record.id === type.id ? { ...record, active: false } : record));
      onNotification?.(`${type.name} deleted.`);
    } catch (error) { onNotification?.(error instanceof Error ? error.message : `Could not delete ${type.name}.`); }
  };
  const dimension = (cm?: number) => cm == null ? '—' : Number(toDisplayDimension(cm, units).toFixed(1)).toString();
  return <section aria-label="Vehicle types" className="space-y-4">
    {slug && catalogQuery.isPending && <p role="status" className="text-sm text-slate-500">Loading vehicle types…</p>}
    {slug && catalogQuery.error && <p role="alert" className="text-sm text-rose-700">{catalogQuery.error.message}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="app-section-title text-slate-900">Vehicle types</h2><p className="text-xs text-slate-500 mt-1">Offered when registering or editing a vehicle.</p></div>
      <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shrink-0"><Plus className="w-3.5 h-3.5" />Add Vehicle Type</button></div>
    <div className="app-table-shell overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="app-table w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr>
      <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Max payload ({units.weightUnit})</th><th className="px-4 py-3 font-medium">Pallet capacity</th>
      <th className="px-4 py-3 font-medium">Cargo L × W × H ({units.dimensionUnit})</th><th className="px-4 py-3 font-medium">Surcharge</th><th className="px-4 py-3 font-medium">Action</th>
    </tr></thead><tbody>{types.map(type => <tr key={type.id} className="border-t border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-900">{type.name}</td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">{Number(toDisplayWeight(type.payloadCapacityKg, units).toFixed(1)).toLocaleString('en-CA')}</td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">{type.palletCapacity}</td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">{dimension(type.cargoLengthCm)} × {dimension(type.cargoWidthCm)} × {dimension(type.cargoHeightCm)}</td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">${type.baseSurcharge.toFixed(2)}</td>
      <td className="px-4 py-3"><div className="inline-flex items-center gap-1">
        <button type="button" aria-label={`Delete ${type.name}`} title={`Delete ${type.name}`} onClick={() => void remove(type)} className="rounded p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 aria-hidden="true" className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label={`Edit ${type.name}`} onClick={() => setEditing(type)} className="rounded p-1.5 hover:bg-slate-100 text-slate-500"><Pencil className="w-3.5 h-3.5" /></button>
      </div></td>
    </tr>)}{!types.length && !(slug && catalogQuery.isPending) && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No vehicle types yet.</td></tr>}</tbody></table></div>
    {editing !== undefined && <VehicleTypeModal initialVehicle={editing} onClose={() => setEditing(undefined)} onSave={type => void save(type)} />}
  </section>;
}
