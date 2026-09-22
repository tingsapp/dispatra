import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { RateCardZones } from '../../src/components/pricing/RateCardZones';
import { ConfirmDialogHost, confirmDialog } from '../../src/components/ui/ConfirmDialog';
import { ZoneMatrixEditor } from '../../src/components/pricing/ZoneMatrixEditor';
import { Zone, ZoneRate } from '../../src/types/pricing';
import { zoneRateIssue } from '../../src/lib/zoneWeightBands';
import { Button } from '../../src/components/ui/button';

function Preview() {
  const [zones, setZones] = useState<Zone[]>([
    { id: 'z1', name: 'Zone 1', code: 'Z1', postalCodes: ['1101', '1223', '233435', '988'] },
    { id: 'z2', name: 'Zone 2', code: 'Z2', postalCodes: ['4545', '54545', '9988'] },
  ]);
  const [rates, setRates] = useState<ZoneRate[]>([
    { id: '11', originZoneId: 'z1', destinationZoneId: 'z1', serviceId: null, amount: 30, weightBands: [{ id: 'a', maxWeightKg: 500, amount: 30 }] },
    { id: '12', originZoneId: 'z1', destinationZoneId: 'z2', serviceId: null, amount: 40, weightBands: [{ id: 'b', maxWeightKg: 100, amount: 25 }, { id: 'c', maxWeightKg: 500, amount: 40 }, { id: 'd', maxWeightKg: 1000, amount: 65 }] },
    { id: '21', originZoneId: 'z2', destinationZoneId: 'z1', serviceId: null, amount: 30, weightBands: [{ id: 'e', maxWeightKg: 500, amount: 30 }] },
    { id: '22', originZoneId: 'z2', destinationZoneId: 'z2', serviceId: null, amount: 20, weightBands: [{ id: 'f', maxWeightKg: 500, amount: 20 }] },
  ]);
  const [message, setMessage] = useState('');
  return <main className="app-page min-h-screen"><div className="mx-auto max-w-5xl px-4 py-8 space-y-5">
    <div><p className="text-xs text-slate-500">Dispatra · Interactive UI preview</p><h1 className="mt-1 text-2xl font-semibold">Zone to zone rates</h1><p className="text-xs text-slate-500 mt-2">Sample prices for review. Changes here do not change your saved rate cards.</p></div>
    <ConfirmDialogHost /><div className="app-rate-card-details space-y-5">
      <RateCardZones zones={zones}
        addZone={() => { const id = crypto.randomUUID(); setZones([...zones, { id, name: `Zone ${zones.length + 1}`, code: '', postalCodes: [] }]); return id; }}
        patchZone={(id, changes) => setZones(zones.map(zone => zone.id === id ? { ...zone, ...changes } : zone))}
        deleteZone={async id => {
          if (!(await confirmDialog({ title: 'Remove preview zone?', message: 'Remove this preview zone and its prices?', confirmLabel: 'Remove zone', tone: 'danger' }))) return false;
          setZones(zones.filter(zone => zone.id !== id)); setRates(rates.filter(rate => rate.originZoneId !== id && rate.destinationZoneId !== id)); return true;
        }} />
      <ZoneMatrixEditor zones={zones} rates={rates} onChange={setRates} currency="CAD" units={{ weightUnit: 'kg', distanceUnit: 'km', dimensionUnit: 'cm' }} />
    </div>
    <div className="flex flex-wrap justify-end items-center gap-3"><p role="status" className="text-sm text-slate-600">{message}</p><Button onClick={() => setMessage(rates.map(zoneRateIssue).find(Boolean) ?? 'Preview checked. Your saved rate cards are unchanged.')}>Check preview</Button></div>
  </div></main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
