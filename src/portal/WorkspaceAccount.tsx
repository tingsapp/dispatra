import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Account } from './api';
import { Button, Notice } from './ui';
import type { components } from './schema';
import { setServerCompanySettings } from '../lib/serverCompanySettings';
export type SettingsView = components['schemas']['SettingsView'];
export const companySettingsKey = (slug: string) => ['company-settings', slug] as const;
const Context = createContext<{ account: Account; settings: SettingsView; reload: () => Promise<SettingsView> } | null>(null);
export const useWorkspaceAccount = () => useContext(Context);
export function WorkspaceAccount({ account, children }: { account: Account; children: React.ReactNode }) {
  const slug = account.organization!.slug;
  const query = useQuery({ queryKey: companySettingsKey(slug), queryFn: () => api.companySettings(slug) });
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    if (query.data) { setServerCompanySettings(slug, query.data.data); setReady(true); }
  }, [slug, query.data]);
  useLayoutEffect(() => () => setServerCompanySettings(slug, null), [slug]);
  if (query.isError && !query.data) return <main className="mx-auto max-w-lg space-y-4 p-10"><Notice error={query.error} /><Button onClick={() => query.refetch()}>Retry company settings</Button></main>;
  if (!ready || !query.data) return <p role="status" className="p-10">Loading company settings…</p>;
  return <Context.Provider value={{ account, settings: query.data, reload: async () => {
    const result = await query.refetch();
    if (result.error || !result.data) throw result.error ?? new Error('Unable to reload settings.');
    return result.data;
  } }}>{children}</Context.Provider>;
}
