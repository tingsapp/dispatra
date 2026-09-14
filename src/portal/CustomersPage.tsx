import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Customer, CustomerInput, generatePassword } from './api';
import { Field, Button, Card, Notice, CredentialCard, Credentials, useOperationKey } from './ui';
const empty = (): CustomerInput => ({ name:'', number:'', login_id:'', password:generatePassword(), contact_name:'', email:'', phone:'', address:'' });
export function AccountCustomers({ slug }: { slug: string }) {
  const cache = useQueryClient();
  const operation = useOperationKey();
  const [form, setForm] = useState<CustomerInput>(empty);
  const [showForm, setShowForm] = useState(false);
  const [credentials, setCredentials] = useState<Credentials>();
  const [reset, setReset] = useState<Customer>();
  const query = useInfiniteQuery({ queryKey: ['customers',slug], queryFn: ({ pageParam }) => api.customers(slug,pageParam), initialPageParam: undefined as string | undefined, getNextPageParam: last => last.length === 50 ? last[last.length-1].id : undefined });
  const share = (login: string, password: string) => setCredentials({ url:`${location.origin}/${slug}/customer`, login, password });
  const create = useMutation({ mutationFn: (submitted: CustomerInput) => api.createCustomer(slug,submitted,operation(submitted)), onSuccess: (_, submitted) => { share(submitted.login_id,submitted.password); setForm(empty()); setShowForm(false); cache.invalidateQueries({ queryKey:['customers',slug] }); } });
  const resetPassword = useMutation({ mutationFn: async (customer: Customer) => { const password = generatePassword(); await api.resetPassword(slug,customer.id,password); return { login:customer.login_id,password }; }, onSuccess: details => { share(details.login,details.password); setReset(undefined); } });
  return <div className="space-y-6">{credentials && <CredentialCard value={credentials} onDismiss={() => setCredentials(undefined)} />}
    <Card title="Customers" description="Create customer accounts and share their portal login details."><div className="flex justify-end"><Button onClick={() => { setShowForm(!showForm); create.reset(); }}>{showForm ? 'Close form' : 'Add customer'}</Button></div>
      {showForm && <form className="mt-6 space-y-5 border-t border-slate-100 pt-6" onSubmit={e => { e.preventDefault(); create.mutate(form); }}><div className="grid gap-5 sm:grid-cols-2">{([
        ['name','Customer name',true,160],['number','Customer number',true,50],['contact_name','Contact name',false,160],['email','Contact email',false,254],['phone','Phone',false,50],['address','Address',false,500],['login_id','Login ID',true,100],['password','Initial password',true,128]
      ] as const).map(([field,label,required,maxLength]) => <Field key={field} label={label} required={required} maxLength={maxLength} minLength={field === 'password' ? 12 : field === 'login_id' ? 3 : undefined} autoComplete="off" type={field === 'email' ? 'email' : 'text'} value={form[field] ?? ''} onChange={e => setForm({ ...form,[field]: field === 'login_id' ? e.target.value.toLowerCase() : e.target.value })} />)}</div>
      <p className="text-xs text-slate-500">Customers can complete missing contact details after login. Changing their password is optional.</p><Notice error={create.error} /><Button disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create customer'}</Button></form>}
      {reset && <div className="my-5 rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="text-sm">Reset the password for <strong>{reset.name}</strong>? Existing sessions will be signed out.</p><div className="mt-3 flex gap-3"><Button disabled={resetPassword.isPending} onClick={() => resetPassword.mutate(reset)}>Confirm reset</Button><Button variant="outline" disabled={resetPassword.isPending} onClick={() => setReset(undefined)}>Cancel</Button></div><Notice error={resetPassword.error} /></div>}
      <Notice error={query.error} />{query.isPending && <p role="status">Loading customers…</p>}{query.isError && <Button variant="outline" onClick={() => query.refetch()}>Try again</Button>}
      <ul className="mt-5 divide-y divide-slate-100">{query.data?.pages.flat().map(c => <li key={c.id} className="flex flex-wrap justify-between gap-4 py-5"><div className="min-w-0"><p className="font-medium">{c.name} <span className="ml-2 text-xs font-normal text-slate-500">{c.number}</span></p><p className="mt-1 text-sm text-slate-500">{c.contact_name || 'Contact name missing'} · {c.email || 'Email missing'}</p><p className="text-sm text-slate-500">{c.phone} {c.address}</p><p className="mt-2 text-xs text-slate-500">Login ID: {c.login_id}</p></div><Button variant="outline" onClick={() => { resetPassword.reset(); setReset(c); }}>Reset password</Button></li>)}</ul>
      {query.data?.pages[0].length === 0 && <p className="py-8 text-center text-sm text-slate-500">No customers yet. Create an account to provide portal access.</p>}{query.hasNextPage && <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Load more</Button>}
    </Card></div>;
}
