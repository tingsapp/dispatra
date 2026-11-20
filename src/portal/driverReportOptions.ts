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
export type DriverReportSelection = DriverReportReason | '';

export function driverIssueKind(reason: DriverReportReason, stopKind: string): IssueKind {
  if (reason === 'VEHICLE_PROBLEM') return 'VEHICLE';
  if (reason === 'UNSAFE') return 'UNSAFE';
  if (reason === 'ACCESS_BLOCKED') return 'WRONG_ADDRESS';
  if (reason === 'RECIPIENT_UNAVAILABLE') return stopKind === 'PICKUP' ? 'FAILED_PICKUP' : 'FAILED_DELIVERY';
  return 'OTHER';
}

export function driverIssueDescription(reason: DriverReportReason, details: string): string {
  const choice = driverReportChoices.find(option => option.value === reason);
  if (!choice) throw new Error('Choose what is happening before sending the report.');
  return `${choice.label}${details.trim() ? `: ${details.trim()}` : ''}`;
}
