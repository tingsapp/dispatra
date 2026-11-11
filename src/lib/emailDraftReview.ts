import type { PricingStopInput } from '../types/pricing';

/** Present legacy email-intake review messages in the same language as new drafts. */
export function reviewMessage(message: string): string {
  const incomplete = /^Stop ([12]): complete address with street, city, province and postal code$/i.exec(message);
  if (incomplete) return `${incomplete[1] === '1' ? 'Pickup' : 'Delivery'} address is incomplete. Add street, city, province and postal code.`;
  const unverified = /^Stop ([12]): address could not be verified on the map$/i.exec(message);
  if (unverified) return `${unverified[1] === '1' ? 'Pickup' : 'Delivery'} address could not be verified on the map. Choose a complete suggested address or add its postal code.`;
  return message;
}

/** A matched company Shipper is sufficient; legacy mailbox-authentication notes are diagnostic only. */
export function reviewMessages(messages: string[], shipperId: string | null | undefined): string[] {
  return messages
    .filter(message => !shipperId || !message.startsWith('Sender verification:'))
    .map(reviewMessage);
}

/** A unique pricing-zone match proves that a complete postal address is usable for this order, even when a prior intake geocode attempt timed out. */
export function actionableReviewMessages(messages: string[], shipperId: string | null | undefined, stops: Pick<PricingStopInput, 'type' | 'zoneId'>[]): string[] {
  return reviewMessages(messages, shipperId).filter(message => {
    const match = /^(Pickup|Delivery) address could not be verified on the map\./.exec(message);
    if (!match) return true;
    const type = match[1] === 'Pickup' ? 'PICKUP' : 'DROPOFF';
    return !stops.some(stop => stop.type === type && stop.zoneId);
  });
}
