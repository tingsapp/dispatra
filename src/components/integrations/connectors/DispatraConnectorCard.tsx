import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BrandMark } from '../../layout/AppBrand';
import { api, type Account } from '../../../portal/api';
import { companySettingsKey, useWorkspaceAccount } from '../../../portal/WorkspaceAccount';
import { Notice, useOperationKey } from '../../../portal/ui';
import { TMS_INTEGRATION_LABEL } from '../../../lib/workspaceEntry';

/** Company-owned workspace preference; connecting a vendor remains a separate action. */
export function DispatraConnectorCard() {
  const workspace = useWorkspaceAccount();
  const cache = useQueryClient();
  const key = useOperationKey();
  const mutation = useMutation({
    mutationFn: async (checked: boolean) => {
      if (!workspace) throw new Error('Company settings are not available.');
      const slug = workspace.account.organization!.slug;
      const payload = { version: workspace.settings.version, data: { ...workspace.settings.data, tms_workspace: !checked } };
      return api.saveCompanySettings(slug, payload, key(payload));
    },
    onSuccess: saved => {
      const slug = workspace!.account.organization!.slug;
      cache.setQueryData(companySettingsKey(slug), saved);
      cache.setQueryData<Account>(['account'], account => account?.role === 'DISPATCHER' && account.organization?.slug === slug
        ? { ...account, tms_workspace: saved.data.tms_workspace } : account);
      void cache.invalidateQueries({ queryKey: ['operations', slug, 'settings'] });
      void cache.invalidateQueries({ queryKey: ['operations', slug, 'rates'] });
    },
  });
  return <article aria-label="Dispatra" className="min-w-0 rounded-xl bg-white px-3 py-4 transition-colors hover:bg-app-hover">
    <div className="flex items-center gap-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-hover"><BrandMark /></div>
      <div className="min-w-0 flex-1"><h3 className="text-base font-medium text-app-text">Dispatra</h3>
        <p className="relative mt-1 text-xs text-app-muted">
          <span className={mutation.isPending ? 'invisible' : ''}>Checked: use Dispatra TMS. Unchecked: connect an External TMS.</span>
          {mutation.isPending && <span role="status" className="absolute inset-0">Switching workspace…</span>}
        </p>
      </div>
      <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-app-hover">
        <input type="checkbox" data-workspace-mode-toggle className="app-checkbox" checked={workspace ? !workspace.settings.data.tms_workspace : false}
          disabled={!workspace || mutation.isPending} onChange={event => mutation.mutate(event.target.checked)} />
        <span className="sr-only">{TMS_INTEGRATION_LABEL}</span>
      </label>
    </div>
    <Notice error={mutation.error} />
  </article>;
}
