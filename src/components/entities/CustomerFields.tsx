import React from 'react';
import { Customer } from '../../lib/customerStorage';
import { loadSimplePricingConfig } from '../../lib/simplePricingStorage';
import { Button } from '../ui/button';
import { TimePicker } from '../ui/TimePicker';
import { Choice, TextField, TagsField, CheckField, OptionalFields, ReadFields } from './Fields';
export function CustomerFields({ value: c, onChange }: { value: Partial<Customer>; onChange: (p: Partial<Customer>) => void }) {
  const patch = (p: Partial<Customer>) => onChange({ ...c, ...p });
  const prefs = c.communicationPreferences ?? { sms: false, email: true, tracking: true };
  return <div className="space-y-4">
    <OptionalFields title="Saved locations & delivery defaults">
      <Choice label="Customer type" value={c.customerType ?? 'BUSINESS'} options={['BUSINESS','INDIVIDUAL']} onChange={v => patch({ customerType: v as Customer['customerType'] })} />
      <TextField label="Legal name" value={c.legalName} onChange={legalName => patch({ legalName })} />
      <Choice label="Default service" value={c.defaultServiceId ?? ''} options={[{ value: '', label: 'Organization default' }, ...loadSimplePricingConfig().services.filter(s => s.active).map(s => ({ value: s.id, label: s.name }))]} onChange={defaultServiceId => patch({ defaultServiceId })} />
      <Choice label="Payment terms" value={c.paymentTerms ?? 'INHERIT'} options={['INHERIT','COD','NET7','NET15','NET30','NET60']} onChange={v => patch({ paymentTerms: v as Customer['paymentTerms'] })} />
      <div className="text-xs text-slate-600 space-y-1"><span>Default window starts</span><TimePicker aria-label="Default window starts" value={c.defaultWindowStart ?? ''} onValueChange={defaultWindowStart => patch({ defaultWindowStart })} /></div>
      <div className="text-xs text-slate-600 space-y-1"><span>Default window ends</span><TimePicker aria-label="Default window ends" value={c.defaultWindowEnd ?? ''} onValueChange={defaultWindowEnd => patch({ defaultWindowEnd })} /></div>
      <TextField label="Delivery instructions" value={c.instructions} onChange={instructions => patch({ instructions })} />
      <TextField label="External reference" value={c.externalReference} onChange={externalReference => patch({ externalReference })} />
      <TagsField label="Customer tags" value={c.tags} onChange={tags => patch({ tags })} />
      <div className="sm:col-span-2 space-y-3">{(c.addresses ?? []).map((a, i) => { const update = (p: Partial<typeof a>) => patch({ addresses: c.addresses!.map(x => x.id === a.id ? { ...x, ...p } : x) }); return <fieldset key={a.id} className="border rounded-lg p-3 grid sm:grid-cols-2 gap-3"><legend className="text-xs">Saved location {i + 1}</legend><TextField label="Location name" value={a.label} onChange={label => update({ label })} /><Choice label="Location purpose" value={a.type} options={['PICKUP','DELIVERY','BILLING','DEPOT']} onChange={v => update({ type: v as typeof a.type })} /><TextField label="Saved address" value={a.address} required onChange={address => update({ address })} /><TextField label="Location contact" value={a.contactName} onChange={contactName => update({ contactName })} /><TextField label="Location phone" value={a.phone} onChange={phone => update({ phone })} /><TextField label="Location instructions" value={a.instructions} onChange={instructions => update({ instructions })} /><Button type="button" size="sm" variant="ghost" onClick={() => patch({ addresses: c.addresses!.filter(x => x.id !== a.id) })}>Remove location</Button></fieldset>; })}<Button type="button" size="sm" variant="outline" onClick={() => patch({ addresses: [...(c.addresses ?? []), { id: crypto.randomUUID(), type: 'DELIVERY', label: '', address: '' }] })}>Add saved location</Button></div>
    </OptionalFields>
    <OptionalFields title="Communication preferences">
      <CheckField label="SMS updates" value={prefs.sms} onChange={sms => patch({ communicationPreferences: { ...prefs, sms } })} />
      <CheckField label="Email updates" value={prefs.email} onChange={email => patch({ communicationPreferences: { ...prefs, email } })} />
      <CheckField label="Public tracking" value={prefs.tracking} onChange={tracking => patch({ communicationPreferences: { ...prefs, tracking } })} />
      <p className="text-xs text-slate-500">Saved booking defaults. V1 language: English. Currency follows organization pricing.</p>
    </OptionalFields>
  </div>;
}
export function CustomerDetails({ customer: c }: { customer: Customer }) {
  return <div className="space-y-3 p-4 border rounded-xl"><ReadFields values={{ 'Legal name': c.legalName, 'Customer type': c.customerType, 'Payment terms': c.paymentTerms ?? 'INHERIT', 'Default window': [c.defaultWindowStart, c.defaultWindowEnd].filter(Boolean).join(' – '), 'Default service': loadSimplePricingConfig().services.find(s => s.id === c.defaultServiceId)?.name, 'Instructions': c.instructions, 'Tags': c.tags?.join(', '), 'External reference': c.externalReference, 'Communications': c.communicationPreferences ? Object.entries(c.communicationPreferences).filter(([,v]) => v).map(([k]) => k).join(', ') || 'None' : 'Organization defaults' }} />{c.addresses?.map(a => <div key={a.id} className="border-t pt-2 text-xs"><strong>{a.label || a.type} · {a.type}</strong><p>{a.address}</p><p>{a.contactName} {a.phone}</p><p>{a.instructions}</p></div>)}</div>;
}
