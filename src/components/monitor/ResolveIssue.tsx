import { useState } from 'react';
import { Button } from '../ui/button';
import type { NeedsAttentionItem } from '../../types';

export type ResolveIssueHandler = (item: NeedsAttentionItem, resolution: string) => Promise<void>;

/** Resolve control for a reported issue: a short note of what was done, then save. Clicks never reach the row behind it. */
export function ResolveIssue({ item, onResolve }: { item: NeedsAttentionItem; onResolve?: ResolveIssueHandler }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  if (!item.issue || !onResolve) return null;
  const save = async () => {
    setError('');
    try { await onResolve(item, note.trim()); setOpen(false); setNote(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not resolve this issue. Try again.'); }
  };
  if (!open) return <Button type="button" size="xs" variant="outline" onClick={event => { event.stopPropagation(); setOpen(true); }}>Resolve</Button>;
  return <form aria-label={`Resolve issue on ${item.jobNumber}`} className="w-full space-y-2" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
    onSubmit={event => { event.preventDefault(); if (note.trim().length >= 3) return save(); }}>
    <textarea aria-label="What was done?" placeholder="What was done? For example: Customer rescheduled, driver returned the parcel." rows={2} maxLength={2000} value={note}
      onChange={event => setNote(event.target.value)} className="app-input w-full resize-none text-xs" autoFocus />
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    <div className="flex gap-2">
      <Button type="submit" size="xs" disabled={note.trim().length < 3}>Mark resolved</Button>
      <Button type="button" size="xs" variant="outline" onClick={() => { setOpen(false); setError(''); }}>Cancel</Button>
    </div>
  </form>;
}
