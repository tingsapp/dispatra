import { Trash2 } from 'lucide-react';
import { loadBillingConfig } from '../../lib/billingStorage';
import { formatWeight, toDisplayDistanceRate } from '../../lib/units';
import { VehicleAsset } from '../../lib/vehicleStorage';
import { Driver } from '../../types';
import { VehicleType } from '../../types/simplePricing';

export function VehicleTable({ vehicles, drivers, vehicleTypes, onDetails, onDelete }: { vehicles: VehicleAsset[]; drivers: Driver[]; vehicleTypes: VehicleType[]; onDetails: (vehicle: VehicleAsset) => void; onDelete?: (vehicle: VehicleAsset) => void }) {
  const billing = loadBillingConfig();
  const units = billing.general;
  return <div className="app-table-shell overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
    <table aria-label="Vehicles" className="app-table w-full min-w-[900px] border-collapse text-left">
      <thead><tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-medium text-slate-600">
        {['ID', 'Plate', 'Type', 'Surcharge', 'Type limits', `Cost / ${units.distanceUnit}`, 'Status', 'Capacity', 'Assigned driver', 'Equipment', 'Actions'].map(label => <th key={label} scope="col" className={`px-4 py-3 ${label === 'Actions' ? 'text-right' : ''}`}>{label}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
        {vehicles.map(vehicle => {
          const type = vehicleTypes.find(item => item.id === vehicle.vehicleTypeId);
          const costPerKm = type ? billing.operatingCost.costPerKmByVehicleId[type.id] : undefined;
          const inactive = vehicle.recordStatus === 'INACTIVE';
          const status = inactive ? 'Inactive' : vehicle.availability?.replaceAll('_', ' ') || vehicle.statusLabel;
          const tone = inactive ? 'bg-slate-100 text-slate-600 border-slate-200' : vehicle.availability === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : vehicle.availability === 'IN_USE' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200';
          const equipment = [...new Set([...(vehicle.equipment ?? []), ...(vehicle.hasLiftgate ? ['Liftgate'] : []), ...(vehicle.hasReefer ? ['Reefer'] : [])])];
          return <tr key={vehicle.id} onClick={() => onDetails(vehicle)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
            <td className="px-4 py-3.5"><div className="font-medium text-slate-900">{vehicle.vehicleNumber ?? vehicle.unitNumber}</div><div className="mt-0.5 text-xs text-slate-500">{vehicle.year || '—'}</div></td>
            <td className="px-4 py-3.5 whitespace-nowrap">{vehicle.plateNumber}</td>
            <td className="px-4 py-3.5">{type?.name || vehicle.category}</td>
            <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">{type ? `$${type.baseSurcharge.toFixed(2)}` : '—'}</td>
            <td className="px-4 py-3.5 whitespace-nowrap">{type ? `${formatWeight(type.payloadCapacityKg, units)} · ${type.palletCapacity} pallets` : '—'}</td>
            <td className="px-4 py-3.5 whitespace-nowrap tabular-nums">{!type ? '—' : costPerKm == null ? <span className="text-slate-400">default</span> : `$${toDisplayDistanceRate(costPerKm, units).toFixed(2)}`}</td>
            <td className="px-4 py-3.5 whitespace-nowrap"><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span></td>
            <td className="px-4 py-3.5 whitespace-nowrap"><div>{formatWeight(vehicle.payloadCapacityKg, units)}</div><div className="mt-0.5 text-xs text-slate-500">{vehicle.palletCapacity} pallets{vehicle.cargoVolumeM3 != null ? ` · ${vehicle.cargoVolumeM3} m³` : ''}{vehicle.maxStops != null ? ` · ${vehicle.maxStops} stops max` : ''}</div></td>
            <td className="px-4 py-3.5">{drivers.find(driver => driver.id === vehicle.currentDriverId)?.name || vehicle.currentDriverName || 'Unassigned'}</td>
            <td className="px-4 py-3.5 max-w-52"><span className="block truncate" title={equipment.join(', ')}>{equipment.join(', ') || 'None recorded'}</span></td>
            <td className="px-4 py-3.5 text-right whitespace-nowrap"><button type="button" aria-label={`Details for ${vehicle.unitNumber}`} onClick={event => { event.stopPropagation(); onDetails(vehicle); }} className="rounded-md px-2 py-1.5 font-medium text-slate-700 hover:bg-slate-100">Details</button>{onDelete && <button type="button" aria-label={`Delete ${vehicle.unitNumber}`} title="Delete vehicle" onClick={event => { event.stopPropagation(); onDelete(vehicle); }} className="ml-1 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
