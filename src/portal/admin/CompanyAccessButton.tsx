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
      ? { title: `Suspend ${company.name}?`, message: 'Everyone is signed out and driver duty ends. No one can sign in until it’s activated again. Data is kept.', confirmLabel: 'Suspend', tone: 'danger' }
      : { title: `Activate ${company.name}?`, message: 'Accounts can sign in again with their passwords. A card is needed after the free trial.', confirmLabel: 'Activate' });
    if (ok) mutation.mutate();
  };
  return <div className="space-y-2">
    <Button loading={mutation.isPending} type="button" variant={enabled ? 'outline' : 'default'} disabled={disabled || mutation.isPending} title={disabled ? 'Save your changes before changing company access.' : undefined} onClick={change}>{mutation.isPending ? 'Saving…' : enabled ? 'Suspend' : 'Activate'}</Button>
    <Notice error={mutation.error} />
  </div>;
}
