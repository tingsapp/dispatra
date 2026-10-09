import type { Order } from '../types';
import type { PricingOrderInput } from '../types/pricing';

const SOURCE_LABELS: Record<PricingOrderInput['source'], string> = {
  DISPATCHER: 'Dispatcher created',
  SHIPPER_PORTAL: 'Shipper created',
  EMAIL: 'Email',
  IMPORT: 'External TMS',
};

/** Use the saved creation source; older prototype records kept it in pricing input. */
export function orderOrigin(order: Pick<Order, 'creationSource' | 'externalReference' | 'pricingInput'>) {
  const source = order.creationSource ?? order.pricingInput?.source;
  const label = source && Object.hasOwn(SOURCE_LABELS, source)
    ? SOURCE_LABELS[source as PricingOrderInput['source']] : 'Not recorded';
  const reference = (order.externalReference ?? order.pricingInput?.externalReference)?.trim();
  return { label, tmsReference: source === 'IMPORT' ? reference || 'Not provided' : null };
}
