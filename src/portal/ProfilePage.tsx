import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, Profile, ProfileInput } from './api';
import { Field, Button, Card, Notice, useOperationKey } from './ui';
export function CustomerProfile({ slug }: { slug: string }) {
  const query = useQuery({ queryKey: ['profile', slug], queryFn: () => api.profile(slug) });
  if (query.isPending) return <p role="status">Loading your profile…</p>;
  if (query.error) return <div><Notice error={query.error} /><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  return <ProfileForm key={query.data.id} slug={slug} profile={query.data} />;
}
function ProfileForm({ slug, profile }: { slug: string; profile: Profile }) {
  const client = useQueryClient();
  const operation = useOperationKey();
  const [form, setForm] = useState<ProfileInput>({ contact_name: profile.contact_name, email: profile.email, phone: profile.phone, address: profile.address, version: profile.version });
  const [saved, setSaved] = useState(false);
  useEffect(() => { setForm({ contact_name: profile.contact_name, email: profile.email, phone: profile.phone, address: profile.address, version: profile.version }); }, [profile]);
  const mutation = useMutation({ mutationFn: () => api.updateProfile(slug, form, operation(form)), onSuccess: data => { setForm({ ...form, version: data.version }); setSaved(true); client.setQueryData(['profile', slug], data); } });
  return <Card title={profile.name} description={`Customer ${profile.number} · Complete your contact information so your dispatch company can reach you.`}><form className="space-y-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
    <div className="grid gap-5 sm:grid-cols-2">{(['contact_name','email','phone','address'] as const).map(field => <Field key={field} label={{ contact_name:'Contact name', email:'Contact email', phone:'Phone', address:'Address' }[field]} type={field === 'email' ? 'email' : 'text'} maxLength={field === 'address' ? 500 : field === 'phone' ? 50 : field === 'email' ? 254 : 160} value={form[field] ?? ''} onChange={e => { setSaved(false); setForm({ ...form, [field]: e.target.value }); }} />)}</div>
    <Notice error={mutation.error} success={saved ? 'Profile saved.' : undefined} /><div className="flex gap-3"><Button disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save profile'}</Button>{mutation.error && <Button type="button" variant="outline" onClick={() => client.invalidateQueries({ queryKey: ['profile',slug] })}>Reload profile</Button>}</div>
    <p className="text-xs text-slate-500">Contact your dispatch company to change your business name or account terms.</p></form></Card>;
}
