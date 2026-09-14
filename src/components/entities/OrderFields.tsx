import React from 'react';
import { Order } from '../../types';
import { Customer } from '../../lib/customerStorage';
import { Choice, TextField, TagsField, CheckField, OptionalFields, ReadFields } from './Fields';
import { lifecycleLabel } from '../../domain/validation';
export function OrderFields({ value, onChange, customers }: { value: Partial<Order>; onChange: (v: Partial<Order>) => void; customers: Customer[] }) {
  const patch = (p: Partial<Order>) => onChange({ ...value, ...p });
  const prefs = value.notificationPreferences ?? { sms: false, email: true, tracking: true };
  return <div className="space-y-3">
    <div className="grid sm:grid-cols-2 gap-3"><Choice label="Order type" value={value.orderType ?? 'DELIVERY'} options={['DELIVERY','PICKUP','RETURN','TRANSFER','SERVICE_CALL']} onChange={v => patch({ orderType: v as Order['orderType'] })} /><Choice label="Priority" value={value.priority ?? 'NORMAL'} options={['NORMAL','HIGH','URGENT']} onChange={v => patch({ priority: v as Order['priority'] })} /><TextField label="Reference / PO numbers" value={value.referenceNumbers} onChange={referenceNumbers => patch({ referenceNumbers })} /><TextField label="Commodity description" value={value.commodityDescription} onChange={commodityDescription => patch({ commodityDescription })} /></div>
    <OptionalFields title="Billing, dispatch requirements & communications">
      <Choice label="Bill to" value={value.billingCustomerId ?? ''} options={[{ value: '', label: 'Same as ordering customer' }, ...customers.filter(c => c.status !== 'Inactive' && c.status !== 'On Hold').map(c => ({ value: c.id, label: c.name }))]} onChange={v => patch({ billingCustomerId: v || null })} />
      <TagsField label="Required driver skills" value={value.requiredSkills} onChange={requiredSkills => patch({ requiredSkills })} />
      <TagsField label="Required equipment" value={value.requiredEquipment} onChange={requiredEquipment => patch({ requiredEquipment })} />
      <TextField label="Service area" value={value.serviceAreaId} onChange={serviceAreaId => patch({ serviceAreaId })} />
      <TagsField label="Order tags" value={value.tags} onChange={tags => patch({ tags })} />
      <TextField label="Dispatcher notes (internal)" value={value.dispatcherNotes} onChange={dispatcherNotes => patch({ dispatcherNotes })} />
      <CheckField label="Order SMS updates" value={prefs.sms} onChange={sms => patch({ notificationPreferences: { ...prefs, sms } })} />
      <CheckField label="Order email updates" value={prefs.email} onChange={email => patch({ notificationPreferences: { ...prefs, email } })} />
      <CheckField label="Order public tracking" value={prefs.tracking} onChange={tracking => patch({ notificationPreferences: { ...prefs, tracking } })} />
    </OptionalFields>
  </div>;
}
export function OrderDetails({ order: o }: { order: Order }) {
  return <div className="space-y-3 p-4 bg-white border border-slate-200/90 rounded-xl"><ReadFields values={{ 'Order status': lifecycleLabel(o), 'Priority': o.priority ?? 'NORMAL', 'Type': o.orderType ?? 'DELIVERY', 'References': o.referenceNumbers, 'Commodity': o.commodityDescription, 'Bill to': o.billingCustomerSnapshot?.name || o.customerSnapshot?.name || o.customerName, 'Booking billing email': o.billingCustomerSnapshot?.billingEmail || o.customerSnapshot?.billingEmail, 'Required skills': o.requiredSkills?.join(', '), 'Required equipment': o.requiredEquipment?.join(', '), 'Service area': o.serviceAreaId, 'Tags': o.tags?.join(', '), 'Internal notes': o.dispatcherNotes, 'Version': String(o.version ?? 1), 'Source': o.pricingInput?.source, 'Tracking': o.notificationPreferences?.tracking === false ? 'Disabled' : 'Enabled', 'Rate override reason': o.pricingInput?.overrideReason }} />
    <h4 className="font-semibold text-xs">Items & movements</h4>{o.pricingInput?.packages.map(p => <div key={p.id} className="text-xs border-t border-slate-100 pt-2"><strong>{p.quantity} × {p.description || p.handlingUnit || 'Package'}</strong><p>{p.weightKg} kg each · {p.lengthCm} × {p.widthCm} × {p.heightCm} cm · {(p.quantity * p.lengthCm * p.widthCm * p.heightCm / 1e6).toFixed(3)} m³ total</p><p>{o.pricingInput?.stops.find(s => s.id === p.pickupStopId)?.label || 'Pickup link not set'} → {o.pricingInput?.stops.find(s => s.id === p.deliveryStopId)?.label || 'Delivery link not set'}</p><p>{[p.fragile && 'Fragile', p.stackable && 'Stackable', p.requiresTwoPeople && 'Two people', p.barcode].filter(Boolean).join(' · ')}</p></div>)}</div>;
}
