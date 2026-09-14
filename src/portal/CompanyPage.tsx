import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, generatePassword, OrganizationInput } from './api';
import { Button, Field, Card, Notice, CredentialCard, Credentials, useOperationKey } from './ui';
export function CompanyPage() {
  const cache = useQueryClient();
  const operation = useOperationKey();
  const [showForm, setShowForm] = useState(false);
  const [credentials, setCredentials] = useState<Credentials>();
  const [form, setForm] = useState<OrganizationInput>({ name:'', slug:'', admin_login:'', password:generatePassword() });
  const query = useInfiniteQuery({ queryKey: ['organizations'], queryFn: ({ pageParam }) => api.organizations(pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: last => last.length === 50 ? last[last.length-1].id : undefined });
  const mutation = useMutation({ mutationFn: (submitted: OrganizationInput) => api.createOrganization(submitted, operation(submitted)), onSuccess: (org, submitted) => {
    setCredentials({ url: `${location.origin}/${org.slug}/dispatch`, login: submitted.admin_login, password: submitted.password }); setShowForm(false); setForm({ name:'',slug:'',admin_login:'',password:generatePassword() }); cache.invalidateQueries({ queryKey: ['organizations'] });
  } });
  return <div className="space-y-6">{credentials && <CredentialCard value={credentials} onDismiss={() => setCredentials(undefined)} />}
    <Card title="Dispatch companies" description="Create a workspace and its first administrator."><div className="flex justify-end"><Button onClick={() => { setShowForm(!showForm); mutation.reset(); }}>{showForm ? 'Close form' : 'Add company'}</Button></div>
      {showForm && <form className="mt-6 space-y-5 border-t border-slate-100 pt-6" onSubmit={e => { e.preventDefault(); mutation.mutate(form); }}><div className="grid gap-5 sm:grid-cols-2"><Field label="Company name" required maxLength={160} value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} /><Field label="Company identifier" required minLength={2} maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="acme" value={form.slug} onChange={e => setForm({ ...form, slug:e.target.value.toLowerCase() })} /><Field label="Administrator login ID" required minLength={3} maxLength={100} autoComplete="off" value={form.admin_login} onChange={e => setForm({ ...form, admin_login:e.target.value.toLowerCase() })} /><Field label="Initial password" required minLength={12} maxLength={128} type="text" autoComplete="off" value={form.password} onChange={e => setForm({ ...form, password:e.target.value })} /></div><p className="text-xs text-slate-500">Workspace address: /{form.slug || 'company'}/dispatch</p><Notice error={mutation.error} /><Button disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : 'Create company'}</Button></form>}
      <Notice error={query.error} />{query.isPending && <p role="status">Loading companies…</p>}{query.isError && <Button variant="outline" onClick={() => query.refetch()}>Try again</Button>}
      <ul className="mt-5 divide-y divide-slate-100">{query.data?.pages.flat().map(org => <li key={org.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{org.name}</p><p className="text-sm text-slate-500">/{org.slug} · {org.active ? 'Active' : 'Inactive'}</p></div><a className="text-sm font-medium text-blue-600" href={`/${org.slug}/dispatch`}>Open dispatch portal →</a></li>)}</ul>{query.data?.pages[0].length === 0 && <p className="py-8 text-center text-sm text-slate-500">No companies yet. Add your first dispatch company.</p>}{query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load more</Button>}
    </Card></div>;
}
