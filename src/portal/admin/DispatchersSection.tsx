import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut, MoreHorizontal, Pencil, Plus, Power } from 'lucide-react';
import { api, type CompanyDetail, type DispatcherAccount, type DispatcherCredential } from '../api';
import { Button, Card, CredentialCard, Notice, type Credentials } from '../ui';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/DropdownMenu';
import { QueryState, StatusBadge } from './QueryState';
import { DispatcherDialog } from './DispatcherDialog';
import { formatWhen, isConflict } from './format';
import { auditKey, companiesKey, companyKey, dispatchersKey } from './queryKeys';

type Action = 'activate' | 'deactivate' | 'reset-password' | 'revoke';
const label = (account: DispatcherAccount) => account.display_name ? `${account.display_name} (${account.login_id})` : account.login_id;

export function DispatchersSection({ company }: { company: CompanyDetail }) {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: dispatchersKey(company.id), queryFn: () => api.dispatchers(company.id) });
  const [editing, setEditing] = useState<DispatcherAccount | 'new'>();
  const [credentials, setCredentials] = useState<Credentials>();
  const refresh = () => [dispatchersKey(company.id), companyKey(company.id), auditKey(company.id), companiesKey()].forEach(queryKey => cache.invalidateQueries({ queryKey }));
  const reveal = (result: DispatcherCredential) => { if (result.initial_password) setCredentials({ url: `${location.origin}/${company.slug}/`, login: result.login_id, password: result.initial_password }); };
  const action = useMutation({
    // Each confirmed action is a new command; its key is not reused for a later, separate confirmation.
    mutationFn: ({ account, kind }: { account: DispatcherAccount; kind: Action }): Promise<DispatcherAccount | DispatcherCredential | { revoked: number }> => kind === 'revoke'
      ? api.revokeDispatcherSessions(company.id, account.id, crypto.randomUUID())
      : api.dispatcherCommand(company.id, account.id, kind, account.version, crypto.randomUUID()),
    onSuccess: (result, { kind }) => { if (kind === 'reset-password') reveal(result as DispatcherCredential); refresh(); },
  });
  const run = async (account: DispatcherAccount, kind: Action) => {
    const name = label(account);
    const prompts = {
      'reset-password': { title: 'Reset password?', message: `A new password is generated for ${name} and shown once. Their current sessions are signed out.`, confirmLabel: 'Reset password' },
      revoke: { title: 'Sign out all sessions?', message: `${name} is signed out on every device. Their password does not change.`, confirmLabel: 'Sign out sessions' },
      deactivate: { title: 'Deactivate dispatcher?', message: `${name} is signed out and can no longer sign in. Their past actions and audit history are kept.`, confirmLabel: 'Deactivate', tone: 'danger' as const },
      activate: { title: 'Activate dispatcher?', message: `${name} can sign in again with their current password.`, confirmLabel: 'Activate' },
    };
    action.reset();
    if (await confirmDialog(prompts[kind])) action.mutate({ account, kind });
  };
  const rows = query.data ?? [];
  const lastActive = rows.filter(row => row.active).length <= 1;
  return <Card title="Dispatcher accounts" description="Dispatchers administer this company's workspace. At least one must stay active.">
    <div className="space-y-4">
      {credentials && <CredentialCard value={credentials} onDismiss={() => setCredentials(undefined)} />}
      <div className="flex justify-end"><Button onClick={() => { action.reset(); setEditing('new'); }}><Plus size={16} />Add dispatcher</Button></div>
      <QueryState query={query} loading="Loading dispatchers…" />
      {action.error && <div className="space-y-2"><Notice error={action.error} />{isConflict(action.error) && <Button size="sm" variant="outline" onClick={() => { action.reset(); refresh(); }}>Reload latest</Button>}</div>}
      {action.isSuccess && action.variables?.kind === 'revoke' && <Notice success={`Signed out ${'revoked' in action.data ? action.data.revoked : 0} session(s).`} />}
      {query.data && rows.length === 0 && <p className="text-sm text-app-muted">No dispatcher accounts. Add one so the company can sign in.</p>}
      {rows.length > 0 && <div className="app-table-shell overflow-x-auto"><table className="app-table text-left" aria-label="Dispatcher accounts">
        <thead><tr><th>Login ID</th><th>Name</th><th>Status</th><th>Created</th><th>Last sign-in</th><th>Sessions</th><th>Action</th></tr></thead>
        <tbody>{rows.map(account => <tr key={account.id}>
          <td className="font-medium">{account.login_id}</td>
          <td>{account.display_name || <span className="text-app-muted">—</span>}</td>
          <td><StatusBadge active={account.active} inactiveLabel="Deactivated" /></td>
          <td className="whitespace-nowrap text-app-muted">{formatWhen(account.created_at)}</td>
          <td className="whitespace-nowrap text-app-muted">{formatWhen(account.last_login_at)}</td>
          <td>{account.active_session_count}</td>
          <td><DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild><button type="button" className="app-icon-button" aria-label={`Actions for ${account.login_id}`} disabled={action.isPending}><MoreHorizontal size={16} /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label={`Actions for ${account.login_id}`}>
              <DropdownMenuItem icon={Pencil} onSelect={() => { action.reset(); setEditing(account); }}>Edit</DropdownMenuItem>
              <DropdownMenuItem icon={KeyRound} onSelect={() => run(account, 'reset-password')}>Reset password</DropdownMenuItem>
              <DropdownMenuItem icon={LogOut} disabled={!account.active_session_count} onSelect={() => run(account, 'revoke')}>Sign out sessions</DropdownMenuItem>
              {account.active
                ? <DropdownMenuItem icon={Power} disabled={lastActive} onSelect={() => run(account, 'deactivate')}>{lastActive ? 'Deactivate (last active)' : 'Deactivate'}</DropdownMenuItem>
                : <DropdownMenuItem icon={Power} onSelect={() => run(account, 'activate')}>Activate</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu></td>
        </tr>)}</tbody>
      </table></div>}
    </div>
    {editing && <DispatcherDialog companyId={company.id} account={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)}
      onSaved={result => { setEditing(undefined); if ('initial_password' in result) reveal(result as DispatcherCredential); refresh(); }} />}
  </Card>;
}
