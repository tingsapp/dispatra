import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type OperationalIncident, type TechnicalIssue } from '../api';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { agentKeys } from './queryKeys';

export function useAgentReportActions(accountId: string) {
  const cache = useQueryClient();
  const refresh = () => { void cache.invalidateQueries({ queryKey: agentKeys }); void cache.invalidateQueries({ queryKey: ['platform', 'notifications', accountId] }); };
  const repair = useMutation({ mutationFn: ({ row, approve }: { row: TechnicalIssue; approve: boolean }) => api.decideTechnicalReport(row, approve, crypto.randomUUID()), onSettled: refresh });
  const acknowledge = useMutation({ mutationFn: (row: OperationalIncident) => api.acknowledgeOperationalIssue(row), onSuccess: refresh });
  const decide = async (row: TechnicalIssue, approve: boolean) => {
    repair.reset();
    if (await confirmDialog(approve ? {
      title: `Approve repair for ${row.company_name ?? 'the platform'}?`,
      message: row.action === 'RETRY_ORDER_AGENT' ? 'The Technical agent will requeue the saved email through normal booking validation. Processing may use the AI provider.'
        : 'The Technical agent will retry the mailbox connection with the saved settings. Incoming emails continue through the normal Order agent workflow.', confirmLabel: 'Approve repair',
    } : { title: 'Dismiss this report?', message: 'This marks the current report as reviewed. A new occurrence or changed task can produce a fresh report.', confirmLabel: 'Dismiss report' })) repair.mutate({ row, approve });
  };
  return { pending: repair.isPending || acknowledge.isPending, error: repair.error ?? acknowledge.error, decide, acknowledge: acknowledge.mutate };
}
