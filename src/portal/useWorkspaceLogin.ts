import { useMutation } from '@tanstack/react-query';
import { accountWorkspace, rememberWorkspaceEntry, workspacePortals, type WorkspaceRole } from '../lib/workspaceEntry';
import { api } from './api';

interface WorkspaceCredentials {
  workspace: string;
  role: WorkspaceRole;
  login: string;
  password: string;
}

/** Public sign-in uses the existing tenant-scoped API and the returned account's destination. */
export function useWorkspaceLogin(clearPassword: () => void) {
  return useMutation({
    gcTime: 0,
    mutationFn: async ({ workspace, role, login, password }: WorkspaceCredentials) => {
      const account = await api.login({ organization: workspace, portal: workspacePortals[role], login_id: login.trim().toLowerCase(), password });
      const destination = accountWorkspace(account);
      if (!destination || account.role === 'ADMIN') throw new Error('Unable to open this workspace. Please try signing in again.');
      return destination;
    },
    onSuccess: (destination, { workspace, role }) => {
      clearPassword();
      rememberWorkspaceEntry(workspace, role);
      window.location.replace(destination);
    },
  });
}
