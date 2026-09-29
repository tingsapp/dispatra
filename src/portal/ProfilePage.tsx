import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AddressField, Field, Button, Card, Notice } from './ui';
import type { SelectedAddress } from '../components/ui/AddressAutocomplete';
import { operations, type Shipper } from '../operations/api';
import { canadianAddress } from '../operations/adapters';

export function CustomerProfile({ slug }: { slug: string }) {
  const query = useQuery({ queryKey: ['shipper-profile', slug], queryFn: () => operations.ownShipper(slug) });
  if (query.isPending) return <p role="status">Loading your profile…</p>;
  if (query.error) return <div><Notice error={query.error} /><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>;
  return <ProfileForm key={query.data.id} slug={slug} profile={query.data} />;
}
function ProfileForm({ slug, profile }: { slug: string; profile: Shipper }) {
  const client = useQueryClient();
  const [form, setForm] = useState({ contact_name: profile.name, email: profile.email, phone: profile.phone, address: profile.warehouse.text });
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress>();
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: () => operations.updateOwnShipper(slug, { version: profile.version, contact_name: form.contact_name.trim(), phone: form.phone.trim(), warehouse: canadianAddress(form.address, profile.warehouse, selectedAddress) }),
    onSuccess: data => { setSaved(true); client.setQueryData(['shipper-profile', slug], data); client.invalidateQueries({ queryKey: ['operations', slug, 'shippers'] }); },
  });
  return <Card plain title="Contact details" description={`${profile.name} · ${profile.number}`}><form className="space-y-5" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Contact name" maxLength={160} required value={form.contact_name} onChange={e => { setSaved(false); setForm(current => ({ ...current, contact_name: e.target.value })); }} />
      <Field label="Contact email" type="email" maxLength={254} readOnly value={form.email} />
      <Field label="Phone" maxLength={50} value={form.phone} onChange={e => { setSaved(false); setForm(current => ({ ...current, phone: e.target.value })); }} />
      <AddressField label="Address" maxLength={500} value={form.address} onChange={(address, selected) => { setSaved(false); setSelectedAddress(selected); setForm(current => ({ ...current, address })); }} />
    </div>
    <Notice error={mutation.error} success={saved ? 'Profile saved.' : undefined} /><div className="flex gap-3"><Button disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save profile'}</Button>{mutation.error && <Button type="button" variant="outline" onClick={() => client.invalidateQueries({ queryKey: ['shipper-profile',slug] })}>Reload profile</Button>}</div>
    <p className="text-xs text-slate-500">Contact your dispatch company to change your business name, login email, or account terms.</p></form></Card>;
}
