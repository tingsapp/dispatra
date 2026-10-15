import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CompanyDetail } from '../api';
import { Button, Notice, useOperationKey } from '../ui';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { auditKey, companiesKey, companyKey, dispatchersKey } from './queryKeys';

export function CompanyAccessButton({ company, disabled, onBusyChange }: {
  company: CompanyDetail; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const enabled = company.workspace_enabled ?? company.active;
  const cache = useQueryClient();
  const operation = useOperationKey();
  const mutation = useMutation({
    mutationFn: () => api.setCompanyActive(company.id, !enabled, company.version, operation({ active: !enabled, version: company.version })),
    onMutate: () => onBusyChange(true),
    onSettled: () => onBusyChange(false),
    onSuccess: result => {
      cache.setQueryData(companyKey(company.id), result);
      [companiesKey(), auditKey(company.id), dispatchersKey(company.id)].forEach(queryKey => cache.invalidateQueries({ queryKey }));
    },
  });
  const change = async () => {
    mutation.reset();
    const ok = await confirmDialog(enabled
      ? { title: `Suspend ${company.name}?`, message: 'Every dispatcher, shipper and driver is signed out immediately, open driver duty is ended, and nobody can sign in until the company is activated again. Orders and audit history are kept.', confirmLabel: 'Suspend', tone: 'danger' }
      : { title: `Activate ${company.name}?`, message: 'Existing accounts can sign in again with their current passwords. A payment method is required after the free trial. Previous sessions are not restored.', confirmLabel: 'Activate' });
    if (ok) mutation.mutate();
  };
  return <div className="space-y-2">
    <Button type="button" variant={enabled ? 'outline' : 'default'} disabled={disabled || mutation.isPending} title={disabled ? 'Save your changes before changing company access.' : undefined} onClick={change}>{mutation.isPending ? 'Saving…' : enabled ? 'Suspend' : 'Activate'}</Button>
    <Notice error={mutation.error} />
  </div>;
}
