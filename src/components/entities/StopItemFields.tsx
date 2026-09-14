import React from 'react';
import { PricingStopInput, PricingPackageInput } from '../../types/pricing';
import { SavedAddress } from '../../domain/operations';
import { Choice, TextField, NumberField, DateField, CheckField, OptionalFields, ReadFields } from './Fields';
export function StopFields({ stop, onChange, addresses, timeZone }: { stop: PricingStopInput; onChange: (p: Partial<PricingStopInput>) => void; addresses: SavedAddress[]; timeZone: string }) {
  return <OptionalFields title="Contact, time window & delivery requirements">
    {!!addresses.length && <Choice label="Use saved location" value="" options={[{ value: '', label: 'Choose location' }, ...addresses.map(a => ({ value: a.id, label: `${a.label || a.type} · ${a.address}` }))]} onChange={id => { const a = addresses.find(a => a.id === id); if (a) onChange({ label: a.address, contactName: a.contactName, contactPhone: a.phone, instructions: a.instructions }); }} />}
    <TextField label="Stop contact / recipient" value={stop.contactName} onChange={contactName => onChange({ contactName })} />
    <TextField label="Stop phone" type="tel" value={stop.contactPhone} onChange={contactPhone => onChange({ contactPhone })} />
    <TextField label="Stop email" type="email" value={stop.contactEmail} onChange={contactEmail => onChange({ contactEmail })} />
    <DateField label="Stop window starts" value={stop.windowStart} onChange={windowStart => onChange({ windowStart })} timeZone={timeZone} />
    <DateField label="Stop window ends" value={stop.windowEnd} onChange={windowEnd => onChange({ windowEnd })} timeZone={timeZone} />
    <NumberField label="Service duration (minutes)" value={stop.handlingMinutes} onChange={handlingMinutes => onChange({ handlingMinutes })} />
    <TextField label="Stop instructions" value={stop.instructions} onChange={instructions => onChange({ instructions })} />
    <TextField label="Access requirements" value={stop.accessRequirements} onChange={accessRequirements => onChange({ accessRequirements })} />
    <TextField label="Stop reference" value={stop.referenceNumber} onChange={referenceNumber => onChange({ referenceNumber })} />
    <Choice label="Proof of delivery" value={stop.podRequirement ?? 'NONE'} options={['NONE','PHOTO','SIGNATURE','PHOTO_AND_SIGNATURE']} onChange={v => onChange({ podRequirement: v as PricingStopInput['podRequirement'] })} />
  </OptionalFields>;
}
export function ItemFields({ item, stops, onChange }: { item: PricingPackageInput; stops: PricingStopInput[]; onChange: (p: Partial<PricingPackageInput>) => void }) {
  return <div className="grid sm:grid-cols-2 gap-3 border-b pb-3 mb-2">
    <TextField label="Item description" value={item.description} onChange={description => onChange({ description })} />
    <Choice label="Handling unit" value={item.handlingUnit ?? 'PACKAGE'} options={['ITEM','BOX','PALLET','TOTE','PACKAGE']} onChange={v => onChange({ handlingUnit: v as PricingPackageInput['handlingUnit'] })} />
    <Choice label="Load at pickup" value={item.pickupStopId ?? ''} options={[{ value: '', label: 'Choose pickup' }, ...stops.filter(s => s.type === 'PICKUP').map(s => ({ value: s.id, label: `${stops.indexOf(s) + 1}. ${s.label || 'Pickup'}` }))]} onChange={pickupStopId => onChange({ pickupStopId })} />
    <Choice label="Unload at delivery" value={item.deliveryStopId ?? ''} options={[{ value: '', label: 'Choose delivery' }, ...stops.filter(s => s.type === 'DROPOFF').map(s => ({ value: s.id, label: `${stops.indexOf(s) + 1}. ${s.label || 'Delivery'}` }))]} onChange={deliveryStopId => onChange({ deliveryStopId })} />
    <OptionalFields title="Handling & reference"><TextField label="Barcode / item reference" value={item.barcode} onChange={barcode => onChange({ barcode })} /><CheckField label="Fragile" value={item.fragile} onChange={fragile => onChange({ fragile })} /><CheckField label="Stackable" value={item.stackable} onChange={stackable => onChange({ stackable })} /><CheckField label="Requires two people" value={item.requiresTwoPeople} onChange={requiresTwoPeople => onChange({ requiresTwoPeople })} /></OptionalFields>
  </div>;
}
export function StopDetails({ stop }: { stop: PricingStopInput }) {
  return <ReadFields values={{ 'Recipient / contact': stop.contactName, 'Phone': stop.contactPhone, 'Email': stop.contactEmail, 'Time window': [stop.windowStart, stop.windowEnd].filter(Boolean).join(' – '), 'Service minutes': stop.handlingMinutes == null ? null : String(stop.handlingMinutes), 'Instructions': stop.instructions, 'Access': stop.accessRequirements, 'POD': stop.podRequirement ?? 'NONE', 'Reference': stop.referenceNumber, 'Stop status': stop.stopStatus ?? 'PENDING' }} />;
}
