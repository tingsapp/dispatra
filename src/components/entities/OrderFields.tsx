import { loadBillingConfig } from '../../lib/billingStorage';
import { formatWeight, formatDimension } from '../../lib/units';
import React from 'react';
import { Order } from '../../types';
import { ReadFields } from './Fields';
import { lifecycleLabel } from '../../domain/validation';
export function OrderDetails({ order: o }: { order: Order }) {
  const units = loadBillingConfig().general;
  return <div className="app-panel space-y-3"><ReadFields values={{ 'Order status': lifecycleLabel(o), 'Priority': o.priority ?? 'NORMAL', 'Type': o.orderType ?? 'DELIVERY', 'References': o.referenceNumbers, 'Commodity': o.commodityDescription, 'Bill to': o.billingCustomerSnapshot?.name || o.customerSnapshot?.name || o.customerName, 'Booking billing email': o.billingCustomerSnapshot?.billingEmail || o.customerSnapshot?.billingEmail, 'Required skills': o.requiredSkills?.join(', '), 'Required equipment': o.requiredEquipment?.join(', '), 'Service area': o.serviceAreaId, 'Tags': o.tags?.join(', '), 'Internal notes': o.dispatcherNotes, 'Version': String(o.version ?? 1), 'Source': o.pricingInput?.source, 'Tracking': o.notificationPreferences?.tracking === false ? 'Disabled' : 'Enabled' }} />
    <h4 className="app-section-title">Items & movements</h4>{o.pricingInput?.packages.map(p => <div key={p.id} className="text-xs pt-2"><strong>{p.quantity} × {p.description || p.handlingUnit || 'Package'}</strong><p>{formatWeight(p.weightKg, units)} each · {formatDimension(p.lengthCm, units)} × {formatDimension(p.widthCm, units)} × {formatDimension(p.heightCm, units)} · {(p.quantity * p.lengthCm * p.widthCm * p.heightCm / 1e6).toFixed(3)} m³ total</p><p>{o.pricingInput?.stops.find(s => s.id === p.pickupStopId)?.label || 'Pickup link not set'} → {o.pricingInput?.stops.find(s => s.id === p.deliveryStopId)?.label || 'Delivery link not set'}</p><p>{[p.fragile && 'Fragile', p.stackable && 'Stackable', p.requiresTwoPeople && 'Two people', p.barcode].filter(Boolean).join(' · ')}</p></div>)}</div>;
}
