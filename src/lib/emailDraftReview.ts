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
