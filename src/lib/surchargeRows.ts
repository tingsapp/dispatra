import { ChargeGroupKey, ChargeLine, PricingSnapshot, RateCard } from '../types/pricing';

const afterLast = (lines: ChargeLine[], groups: ChargeGroupKey[]) => {
  const index = lines.map(line => groups.includes(line.group)).lastIndexOf(true);
  return index < 0 ? lines.length : index + 1;
};
const zero = (key: string, group: ChargeGroupKey, label: string, detail: string): ChargeLine => ({ key, group, label, detail, amount: 0, fuelEligible: false, taxable: false });

/** Display only: when the card applies a surcharge but the order produced no line for it, list it at $0.00 so a preview always shows both surcharges the card charges. */
export function withSurchargeRows(snapshot: PricingSnapshot, card: Pick<RateCard, 'pricingMethod' | 'applyFuelSurcharge' | 'applyVehicleSurcharge'> | undefined, fuelPercent: number, requiredVehicle?: string | null): PricingSnapshot {
  if (!card || card.pricingMethod === 'IMPORTED' || snapshot.status !== 'PRICED') return snapshot;
  const lines = [...snapshot.lines];
  if (card.applyVehicleSurcharge && !lines.some(line => line.group === 'VEHICLE'))
    lines.splice(afterLast(lines, ['FREIGHT', 'SERVICE']), 0, zero('vehicle-none', 'VEHICLE', 'Vehicle Surcharge', requiredVehicle ? `${requiredVehicle} (no surcharge)` : 'Any vehicle'));
  if (card.applyFuelSurcharge && !lines.some(line => line.group === 'FUEL'))
    lines.splice(afterLast(lines, ['FREIGHT', 'SERVICE', 'VEHICLE', 'ACCESSORIAL', 'COMPANY_CHARGE']), 0, zero('fuel-none', 'FUEL', 'Fuel Surcharge', fuelPercent > 0 ? `${fuelPercent}% of $0.00` : 'Company fuel rate is 0%'));
  return { ...snapshot, lines };
}
