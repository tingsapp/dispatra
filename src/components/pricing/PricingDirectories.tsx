import { Plus, Trash2 } from 'lucide-react';
import { zoneCode } from '../../lib/pricingStorage';
import { PricingConfig, Zone } from '../../types/pricing';
import { cardClass, fieldClass, primaryBtn } from './RateCardFields';
import { ZoneMatrixEditor } from './ZoneMatrixEditor';
interface Props {
  config: PricingConfig;
  persist: (next: PricingConfig) => void; addZone: () => void; patchZone: (id: string, changes: Partial<Zone>) => void; deleteZone: (id: string) => void;
}
export function PricingDirectories(props: Props) {
  const { config, persist, addZone, patchZone, deleteZone } = props;
  return <>
    <div className="space-y-5">
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Zones</h3>
            <p className="text-xs text-slate-500 mt-0.5">Service areas used by zone-to-zone Rate Cards. Stops are assigned a zone at order entry.</p>
          </div>
          <button type="button" onClick={addZone} className={primaryBtn}>
            <Plus className="w-3.5 h-3.5" />
            <span>Add Zone</span>
          </button>
        </div>
        <div className="space-y-2">
          {config.zones.map((z) => (
            <div key={z.id} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
              <input type="text" value={z.name} onChange={(e) => patchZone(z.id, { name: e.target.value, code: zoneCode(e.target.value) })} className={fieldClass} aria-label="Zone name" />
              <input type="text" value={z.description} onChange={(e) => patchZone(z.id, { description: e.target.value })} className={fieldClass} placeholder="Description" aria-label="Zone description" />
              <button type="button" onClick={() => deleteZone(z.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete zone">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="text-sm font-semibold text-slate-900">Standard zone prices</h3>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">
          Starting prices copied onto every new zone-to-zone rate card; each card then keeps its own grid. Changing these does not change existing cards.
        </p>
        <ZoneMatrixEditor rates={config.zoneRates} zones={config.zones} onChange={zoneRates => persist({ ...config, zoneRates })} />
      </div>
    </div>
  </>;
}
