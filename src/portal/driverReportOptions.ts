import { useQuery } from '@tanstack/react-query';
import { operations } from '../operations/api';
import type { components } from './schema';

export type ReasonChoice = components['schemas']['ReasonChoice'];

/** The company's active stop report reasons (GET /driver/report-reasons), the same list the driver app shows. */
export const useReportReasons = (slug: string) => useQuery({ queryKey: ['driver-report-reasons', slug], queryFn: () => operations.reportReasons(slug), staleTime: 5 * 60_000 });

export const reasonsForStop = (choices: readonly ReasonChoice[], stopKind: string) => choices.filter(choice => choice.stops === 'BOTH' || choice.stops === stopKind);

export const toggleReason = (selected: string[], reason: string) =>
  selected.includes(reason) ? selected.filter(value => value !== reason) : [...selected, reason];

/** What still blocks a report under the company's rules; the web portal has no report camera, so photo reasons need the app. */
export function driverReportProblem(selected: string[], details: string, choices: readonly ReasonChoice[]): string | null {
  if (!selected.length) return 'Choose what is happening.';
  for (const choice of choices.filter(option => selected.includes(option.value))) {
    if (choice.photo_required) return `${choice.label} needs a photo. Report it from the driver app.`;
    if (choice.notes_required && details.trim().length < 3) return `Describe the issue when choosing ${choice.label}.`;
  }
  if (details.trim().length > 1900) return 'Shorten the details before sending.';
  return null;
}

export const notesRequired = (selected: string[], choices: readonly ReasonChoice[]) => choices.some(choice => selected.includes(choice.value) && choice.notes_required);
