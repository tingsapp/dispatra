import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { DeliveryService, VehicleType, AccessorialItem } from '../../types/simplePricing';
import { PricingOrderInput } from '../../types/pricing';
import { loadBillingConfig } from '../../lib/billingStorage';
import { loadPricingConfig } from '../../lib/pricingStorage';
import { loadCustomers } from '../../lib/customerStorage';
import { calculatePricing, PricingContext } from '../../lib/pricingEngine';
import { createDefaultOrderInput } from '../../lib/orderPricing';
import { OrderPricingForm } from './OrderPricingForm';
import { PriceBreakdown } from './PriceBreakdown';

interface SimpleSimulatorProps {
  services: DeliveryService[];
  vehicles: VehicleType[];
  accessorials: AccessorialItem[];
}

/**
 * Price Simulator: the same OrderPricingForm + calculatePricing() the Order
 * form uses, with nothing persisted.
 */
export const SimpleSimulator: React.FC<SimpleSimulatorProps> = ({ services, vehicles, accessorials }) => {
  const ctx: PricingContext = useMemo(
    () => ({
      billing: loadBillingConfig(),
      catalogue: { services, vehicles, accessorials },
      pricing: loadPricingConfig(),
      customers: loadCustomers()
    }),
    [services, vehicles, accessorials]
  );

  const [order, setOrder] = useState<PricingOrderInput>(() => createDefaultOrderInput(ctx));
  const snapshot = useMemo(() => calculatePricing(order, ctx), [order, ctx]);

  if (!services.some((s) => s.active)) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-8 text-center shadow-2xs">
        <p className="text-sm text-slate-500">No active services. Activate or add one under Services & Accessorials.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7">
        <OrderPricingForm value={order} onChange={setOrder} ctx={ctx} snapshot={snapshot} showOverrides />
      </div>
      <div className="lg:col-span-5 sticky top-6">
        <PriceBreakdown
          snapshot={snapshot}
          targetMarginPercent={ctx.billing.operatingCost.targetGrossMarginPercent}
          headerAction={
            <button
              type="button"
              onClick={() => setOrder(createDefaultOrderInput(ctx))}
              className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          }
        />
      </div>
    </div>
  );
};
