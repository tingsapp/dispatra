import { VehicleAsset } from '../../lib/vehicleStorage';
import { Driver } from '../../types';
import { VehicleType } from '../../types/simplePricing';

export function VehicleTable({ vehicles, drivers, vehicleTypes, onDetails }: { vehicles: VehicleAsset[]; drivers: Driver[]; vehicleTypes: VehicleType[]; onDetails: (vehicle: VehicleAsset) => void }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
    <table aria-label="Vehicles" className="w-full min-w-[900px] border-collapse text-left">
      <thead><tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {['Vehicle', 'Plate', 'Type', 'Status', 'Capacity', 'Assigned driver', 'Equipment', 'Actions'].map(label => <th key={label} scope="col" className={`px-4 py-3 ${label === 'Actions' ? 'text-right' : ''}`}>{label}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
        {vehicles.map(vehicle => {
          const inactive = vehicle.recordStatus === 'INACTIVE';
          const status = inactive ? 'Inactive' : vehicle.availability?.replaceAll('_', ' ') || vehicle.statusLabel;
          const tone = inactive ? 'bg-slate-100 text-slate-600 border-slate-200' : vehicle.availability === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : vehicle.availability === 'IN_USE' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200';
          const equipment = [...new Set([...(vehicle.equipment ?? []), ...(vehicle.hasLiftgate ? ['Liftgate'] : []), ...(vehicle.hasReefer ? ['Reefer'] : [])])];
          return <tr key={vehicle.id} onClick={() => onDetails(vehicle)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
            <td className="px-4 py-3.5"><div className="font-semibold text-slate-900">{vehicle.unitNumber}</div><div className="mt-0.5 text-[11px] text-slate-500">{vehicle.makeModel} {vehicle.year || ''}</div></td>
            <td className="px-4 py-3.5 whitespace-nowrap">{vehicle.plateNumber}</td>
            <td className="px-4 py-3.5">{vehicleTypes.find(type => type.id === vehicle.vehicleTypeId)?.name || vehicle.category}</td>
            <td className="px-4 py-3.5 whitespace-nowrap"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span></td>
            <td className="px-4 py-3.5 whitespace-nowrap"><div>{vehicle.payloadCapacityKg.toLocaleString()} kg</div><div className="mt-0.5 text-[11px] text-slate-500">{vehicle.palletCapacity} pallets{vehicle.cargoVolumeM3 != null ? ` · ${vehicle.cargoVolumeM3} m³` : ''}</div></td>
            <td className="px-4 py-3.5">{drivers.find(driver => driver.id === vehicle.currentDriverId)?.name || vehicle.currentDriverName || 'Unassigned'}</td>
            <td className="px-4 py-3.5 max-w-52"><span className="block truncate" title={equipment.join(', ')}>{equipment.join(', ') || 'None recorded'}</span></td>
            <td className="px-4 py-3.5 text-right"><button type="button" aria-label={`Details for ${vehicle.unitNumber}`} onClick={event => { event.stopPropagation(); onDetails(vehicle); }} className="rounded-md px-2 py-1.5 font-medium text-blue-700 hover:bg-blue-50">Details</button></td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}
