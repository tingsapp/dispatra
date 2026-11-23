import type { components } from './schema';

type Choice = components['schemas']['Choice'];
type IssueKind = components['schemas']['IssueInput']['kind'];

export const driverReportChoices = [
  { value: 'ITEMS_NOT_READY', label: 'Items not ready' },
  { value: 'WAITING_FOR_STAFF', label: 'Waiting for staff' },
  { value: 'ACCESS_BLOCKED', label: 'Access blocked' },
  { value: 'HANDLING_IN_PROGRESS', label: 'Loading or unloading' },
  { value: 'VEHICLE_PROBLEM', label: 'Vehicle problem' },
  { value: 'TRAFFIC', label: 'Traffic delay' },
  { value: 'RECIPIENT_UNAVAILABLE', label: 'Recipient unavailable' },
  { value: 'NEED_HELPER', label: 'Need handling assistance' },
  { value: 'DAMAGED_ITEM', label: 'Item damaged' },
  { value: 'UNSAFE', label: 'Unsafe situation' },
  { value: 'OTHER', label: 'Another issue' },
] as const satisfies readonly Choice[];

export type DriverReportReason = (typeof driverReportChoices)[number]['value'];

function driverIssueKind(reason: DriverReportReason, stopKind: string): IssueKind {
  if (reason === 'VEHICLE_PROBLEM') return 'VEHICLE';
  if (reason === 'UNSAFE') return 'UNSAFE';
  if (reason === 'ACCESS_BLOCKED') return 'WRONG_ADDRESS';
  if (reason === 'RECIPIENT_UNAVAILABLE') return stopKind === 'PICKUP' ? 'FAILED_PICKUP' : 'FAILED_DELIVERY';
  return 'OTHER';
}

// Same priority as the driver app: one report keeps every reason under its most operational category.
const kindPriority: IssueKind[] = ['UNSAFE', 'VEHICLE', 'WRONG_ADDRESS', 'SHORT_LOAD', 'FAILED_PICKUP', 'FAILED_DELIVERY', 'OTHER'];

export const toggleReason = (selected: DriverReportReason[], reason: DriverReportReason) =>
  selected.includes(reason) ? selected.filter(value => value !== reason) : [...selected, reason];

export const driverReportReady = (selected: DriverReportReason[], details: string) =>
  selected.length > 0 && (!selected.includes('OTHER') || details.trim().length >= 3);

/** One stop issue for every selected reason, in the shape the driver app sends. */
export function driverIssueReport(selected: DriverReportReason[], stopKind: string, details: string): { kind: IssueKind; description: string } {
  const choices = driverReportChoices.filter(option => selected.includes(option.value));
  const notes = details.trim();
  if (!choices.length) throw new Error('Choose what is happening before sending the report.');
  if (selected.includes('OTHER') && notes.length < 3) throw new Error('Describe the other issue.');
  const description = `${choices.map(option => option.label).join('; ')}${notes ? `\n\n${notes}` : ''}`;
  if (description.length > 2000) throw new Error('Shorten the details before sending.');
  const kinds = choices.map(option => driverIssueKind(option.value, stopKind));
  return { kind: kindPriority.find(kind => kinds.includes(kind))!, description };
}
