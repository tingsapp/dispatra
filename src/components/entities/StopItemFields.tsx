import React from 'react';
import { PricingStopInput } from '../../types/pricing';
import { ReadFields } from './Fields';
export function StopDetails({ stop }: { stop: PricingStopInput }) {
  return <ReadFields values={{ 'Recipient / contact': stop.contactName, 'Phone': stop.contactPhone, 'Email': stop.contactEmail, 'Time window': [stop.windowStart, stop.windowEnd].filter(Boolean).join(' – '), 'Service minutes': stop.handlingMinutes == null ? null : String(stop.handlingMinutes), 'Instructions': stop.instructions, 'Access': stop.accessRequirements, 'POD': stop.podRequirement ?? 'NONE', 'Reference': stop.referenceNumber, 'Stop status': stop.stopStatus ?? 'PENDING' }} />;
}
