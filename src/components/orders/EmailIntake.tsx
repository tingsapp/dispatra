import { dateTime } from '../../lib/dateTimeFormat';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../ui/Dialog';
import { Select } from '../ui/Select';
import { Switch } from '../ui/Switch';
import { allOperations, operations, type EmailIntakeStatus, type Mailbox } from '../../operations/api';

/** An Order agent draft handed to the order form; saving it links the new Order to the email. */
export type EmailDraft = { intake: { id: string; version: number }; draft: Record<string, unknown> };

export const EMAIL_STATUS: Record<EmailIntakeStatus, { label: string; tone: string }> = {
  RECEIVED: { label: 'Reading email', tone: 'bg-slate-100 text-slate-700' },
  ORDER_CREATED: { label: 'Order created', tone: 'bg-emerald-50 text-emerald-700' },
  NEEDS_REVIEW: { label: 'Draft', tone: 'bg-slate-100 text-slate-700' },
  UNKNOWN_SENDER: { label: 'Draft', tone: 'bg-slate-100 text-slate-700' },
  NOT_AN_ORDER: { label: 'Not an order', tone: 'bg-slate-100 text-slate-600' },
  FAILED: { label: 'Could not read', tone: 'bg-rose-50 text-rose-700' },
  DISCARDED: { label: 'Discarded', tone: 'bg-slate-100 text-slate-500' },
};
export const EMAIL_ERRORS: Record<string, string> = {
  AI_NOT_CONFIGURED: 'The AI service is not configured on the server.', AI_AUTHENTICATION_FAILED: 'The AI service rejected the server key.',
  AI_RATE_LIMITED: 'The AI service is busy. The agent will try again.', AI_UNAVAILABLE: 'The AI service could not be reached.',
  AI_REQUEST_REJECTED: 'The AI service could not read this email.', AI_INVALID_RESULT: 'The AI returned an unreadable result.', AI_NO_RESULT: 'The AI returned no result.',
  MESSAGE_TOO_LARGE: 'The email is larger than 5 MB and was not read.', NO_SENDER: 'The email has no sender address.',
  PASSWORD_UNREADABLE: 'The saved mailbox password can no longer be read. Enter it again.',
};
/** Emails the agent understood as order requests but could not book yet; anything else never becomes a draft. */
export const EMAIL_DRAFT_STATUSES: EmailIntakeStatus[] = ['NEEDS_REVIEW', 'UNKNOWN_SENDER'];
const OPEN: EmailIntakeStatus[] = ['NEEDS_REVIEW', 'UNKNOWN_SENDER', 'FAILED', 'NOT_AN_ORDER'];
export const emailTime = (value?: string | null) => dateTime(value) || '—';
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const when = emailTime, STATUS = EMAIL_STATUS, ERRORS = EMAIL_ERRORS;

export function EmailStatusBadge({ status }: { status: EmailIntakeStatus }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[status].tone}`}>{STATUS[status].label}</span>;
}

export function IntakeDialog({ slug, id, onClose, onChanged, onNotification, onCompleteDraft, onShowOrder }: {
  slug: string; id: string; onClose: () => void; onChanged: () => void; onNotification: (message: string) => void;
  onCompleteDraft: (draft: EmailDraft) => void; onShowOrder: (orderNumber: string) => void;
}) {
  const detail = useQuery({ queryKey: ['operations', slug, 'email-intakes', id], queryFn: () => operations.emailIntake(slug, id) });
  const shippers = useQuery({ queryKey: ['operations', slug, 'shippers'], queryFn: () => allOperations.shippers(slug) });
  const [shipperId, setShipperId] = useState('');
  const [busy, setBusy] = useState(false);
  const row = detail.data;
  const act = async (label: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try { await run(); onChanged(); await detail.refetch(); onNotification(label); }
    catch (error) { onNotification(message(error, 'Could not update the email.')); }
    finally { setBusy(false); }
  };
  const open = row ? OPEN.includes(row.status) : false;
  return <Dialog size="lg" onClose={onClose}>
    <DialogHeader onClose={onClose} title={row?.subject || 'Order email'} description={row ? `From ${row.from_name ? `${row.from_name} <${row.from_address}>` : row.from_address} · ${when(row.received_at)}` : 'Loading…'} />
    <DialogBody className="space-y-5">
      {detail.error && <p role="alert" className="text-sm text-rose-700">{detail.error.message}</p>}
      {row && <>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <EmailStatusBadge status={row.status} />
          {row.sender_verified ? <span className="inline-flex items-center gap-1 text-emerald-700"><ShieldCheck className="size-4" /> Sender verified</span>
            : <span className="inline-flex items-center gap-1 text-amber-700"><ShieldAlert className="size-4" /> Sender not verified</span>}
          {row.shipper_name && <span className="text-slate-600">· Shipper: <span className="font-medium text-slate-900">{row.shipper_name}</span></span>}
          {row.order_number && <span className="text-slate-600">· Order {row.order_number}</span>}
        </div>
        {row.summary && <p className="text-sm text-slate-700">{row.summary}</p>}
        {row.error_code && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{ERRORS[row.error_code] ?? row.error_code}</p>}
        {row.missing.length > 0 && <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <h3 className="text-sm font-medium text-amber-900">Needed before this can become an Order</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">{row.missing.map(item => <li key={item}>{item}</li>)}</ul>
        </section>}
        {row.status === 'UNKNOWN_SENDER' && <section className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900">Which Shipper sent this?</h3>
          <p className="text-sm text-slate-500">Linking confirms the email is from this Shipper. The Order agent reads it again for them.</p>
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Shipper" value={shipperId} onValueChange={setShipperId} placeholder="Choose a Shipper" className="w-72"
              options={(shippers.data ?? []).filter(s => s.status === 'ACTIVE').map(s => ({ value: s.id, label: s.company_name || s.name }))} />
            <Button type="button" disabled={!shipperId || busy} onClick={() => act('Shipper linked. The Order agent is reading the email again.', () => operations.linkEmailIntakeShipper(slug, row, shipperId))}>Link and read again</Button>
          </div>
        </section>}
        <section>
          <h3 className="text-sm font-medium text-slate-900">Email</h3>
          <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-app-border bg-slate-50 p-3 font-sans text-sm text-slate-700">{row.body || '(empty)'}</pre>
        </section>
      </>}
    </DialogBody>
    {row && <DialogFooter note={row.status === 'NEEDS_REVIEW' ? 'Completing opens the order form with everything the agent found.' : undefined}>
      {open && <Button type="button" variant="outline" disabled={busy} onClick={() => act('Email discarded.', () => operations.discardEmailIntake(slug, row))}>Discard</Button>}
      {(open || row.status === 'DISCARDED') && row.status !== 'UNKNOWN_SENDER' && <Button type="button" variant="outline" disabled={busy} onClick={() => act('The Order agent is reading the email again.', () => operations.retryEmailIntake(slug, row))}>Read again</Button>}
      {open && row.draft && row.shipper_id && <Button type="button" disabled={busy} onClick={() => onCompleteDraft({ intake: { id: row.id, version: row.version }, draft: row.draft! })}>Complete order</Button>}
      {row.status === 'ORDER_CREATED' && row.order_number && <Button type="button" onClick={() => onShowOrder(row.order_number!)}>Show order</Button>}
    </DialogFooter>}
  </Dialog>;
}

/** Mailbox settings (Settings → Mailbox): the one IMAP mailbox the Order agent reads for this company. */
export function MailboxSettings({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const mailboxQuery = useQuery({ queryKey: ['operations', slug, 'mailbox'], queryFn: () => operations.mailbox(slug) });
  if (mailboxQuery.isPending) return <p role="status" className="text-sm text-slate-500">Loading mailbox…</p>;
  if (mailboxQuery.error) return <p role="alert" className="text-sm text-rose-700">{mailboxQuery.error.message}</p>;
  return <div className="space-y-8">
    <MailboxForm key={mailboxQuery.data?.version ?? 0} slug={slug} mailbox={mailboxQuery.data ?? null} onSaved={() => queryClient.invalidateQueries({ queryKey: ['operations', slug, 'mailbox'] })} />
    <UnreadEmails slug={slug} />
  </div>;
}

/** Emails the agent could not read (AI or message errors). They may or may not be orders, so they stay here rather than in Orders. */
function UnreadEmails({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const failed = useQuery({ queryKey: ['operations', slug, 'email-intakes', 'failed'], queryFn: () => operations.emailIntakes(slug, ['FAILED']) });
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  if (!failed.data?.length) return null;
  return <section className="max-w-2xl space-y-2">
    <h3 className="app-section-title text-slate-900">Emails that could not be read</h3>
    <p className="text-sm text-slate-500">Open one to read it again or discard it. Emails that are not order requests are ignored and not listed.</p>
    {notice && <p role="status" className="text-sm text-slate-600">{notice}</p>}
    <ul className="divide-y divide-slate-100 rounded-lg border border-app-border">
      {failed.data.map(row => <li key={row.id}><button type="button" onClick={() => setOpenId(row.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50">
        <span className="min-w-0"><span className="block truncate font-medium text-slate-800">{row.subject || '(no subject)'}</span>
          <span className="block truncate text-xs text-slate-500">{row.from_address} · {ERRORS[row.error_code ?? ''] ?? row.error_code}</span></span>
        <span className="shrink-0 text-xs text-slate-500">{when(row.received_at)}</span>
      </button></li>)}
    </ul>
    {openId && <IntakeDialog slug={slug} id={openId} onClose={() => setOpenId(null)} onNotification={setNotice}
      onChanged={() => queryClient.invalidateQueries({ queryKey: ['operations', slug, 'email-intakes'] })} onCompleteDraft={() => setOpenId(null)} onShowOrder={() => setOpenId(null)} />}
  </section>;
}

/** Known providers fill the servers; Other shows them. Microsoft may refuse app passwords (it expects Microsoft sign-in). */
const PROVIDERS = {
  gmail: { label: 'Gmail', host: 'imap.gmail.com', port: 993, smtp_host: 'smtp.gmail.com', smtp_port: 465, help: 'For Gmail, turn on 2-Step Verification and IMAP, then create an app password.' },
  icloud: { label: 'iCloud', host: 'imap.mail.me.com', port: 993, smtp_host: 'smtp.mail.me.com', smtp_port: 587, help: 'For iCloud, create an app-specific password in your Apple Account.' },
  yahoo: { label: 'Yahoo', host: 'imap.mail.yahoo.com', port: 993, smtp_host: 'smtp.mail.yahoo.com', smtp_port: 465, help: 'For Yahoo, create an app password in Account security.' },
  zoho: { label: 'Zoho', host: 'imap.zoho.com', port: 993, smtp_host: 'smtp.zoho.com', smtp_port: 465, help: 'For Zoho, turn on IMAP access, then create an app password.' },
  outlook: { label: 'Outlook / Microsoft 365', host: 'outlook.office365.com', port: 993, smtp_host: 'smtp.office365.com', smtp_port: 587, help: 'Microsoft may not allow app passwords. If the test fails, use another mailbox.' },
} as const;
type Provider = keyof typeof PROVIDERS | 'other';
const providerOf = (host: string): Provider => (Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).find(key => PROVIDERS[key].host === host.trim().toLowerCase()) ?? 'other';

/** Most providers pair imap.<domain> with smtp.<domain>. */
const outgoingHost = (host: string) => host.trim().toLowerCase().startsWith('imap.') ? `smtp.${host.trim().slice(5)}` : host.trim();

function MailboxForm({ slug, mailbox, onSaved }: { slug: string; mailbox: Mailbox | null; onSaved: () => void }) {
  const [form, setForm] = useState({ host: mailbox?.host ?? 'imap.gmail.com', port: String(mailbox?.port ?? 993), username: mailbox?.username ?? '', password: '',
    folder: mailbox?.folder ?? 'INBOX', enabled: mailbox?.enabled ?? true, smtp_host: mailbox?.smtp_host ?? 'smtp.gmail.com', smtp_port: String(mailbox?.smtp_port ?? 465) });
  const [provider, setProvider] = useState<Provider>(() => providerOf(mailbox?.host ?? 'imap.gmail.com'));
  const choose = (value: string) => { const next = value as Provider; setProvider(next); setResult(null);
    if (next !== 'other') { const p = PROVIDERS[next]; setForm(f => ({ ...f, host: p.host, port: String(p.port), smtp_host: p.smtp_host, smtp_port: String(p.smtp_port) })); } };
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The outgoing server follows the IMAP server until it is edited.
  const set = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => { const value = event.target.value;
    setForm(f => ({ ...f, [field]: value, ...(field === 'host' && f.smtp_host === outgoingHost(f.host) ? { smtp_host: outgoingHost(value) } : {}) })); setResult(null); };
  const connection = () => ({ host: form.host.trim(), port: Number(form.port) || 993, username: form.username.trim(), password: form.password || null, folder: form.folder.trim() || 'INBOX',
    smtp_host: form.smtp_host.trim() || null, smtp_port: Number(form.smtp_port) || 465 });
  const test = async () => {
    setBusy(true);
    try { const outcome = await operations.testMailbox(slug, connection()); setResult(outcome.ok ? { ok: true, text: 'Connected. Dispatra can read and send from this mailbox.' } : { ok: false, text: outcome.error ?? 'Could not connect.' }); }
    catch (error) { setResult({ ok: false, text: message(error, 'Could not connect.') }); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await operations.saveMailbox(slug, { ...connection(), enabled: form.enabled, version: mailbox?.version ?? null });
      setResult({ ok: true, text: 'Mailbox saved. New emails are read about once a minute.' }); onSaved();
    } catch (error) { setResult({ ok: false, text: message(error, 'Could not save the mailbox.') }); }
    finally { setBusy(false); }
  };
  return <form onSubmit={save} className="max-w-2xl space-y-5">
    <div>
      <h3 className="app-section-title text-slate-900">Mailbox</h3>
      <p className="mt-1 text-sm text-slate-500">The Order agent reads new emails sent to this mailbox and turns them into Orders. Dispatra also sends your quotes and delivery notifications from this address.</p>
      {mailbox && (mailbox.last_error
        ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Dispatra cannot read {mailbox.username}. {ERRORS[mailbox.last_error] ?? 'Check the settings and app password.'}</p>
        : <p className="mt-3 text-sm text-slate-600">{mailbox.enabled ? <>Last checked {when(mailbox.last_polled_at)}</> : <>Reading new emails is paused.</>}</p>)}
    </div>
    <fieldset disabled={busy} className="space-y-4">
      <div><span className="app-label">Email provider</span>
        <Select aria-label="Email provider" value={provider} onValueChange={choose} className="w-full"
          options={[...(Object.keys(PROVIDERS) as (keyof typeof PROVIDERS)[]).map(key => ({ value: key, label: PROVIDERS[key].label })), { value: 'other', label: 'Other' }]} /></div>
      {provider === 'other' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2"><span className="app-label">IMAP server</span><input className="app-input w-full" required value={form.host} onChange={set('host')} /></label>
        <label className="block"><span className="app-label">IMAP port</span><input className="app-input w-full" required inputMode="numeric" value={form.port} onChange={set('port')} /></label>
        <label className="block sm:col-span-2"><span className="app-label">SMTP server</span><input className="app-input w-full" required value={form.smtp_host} onChange={set('smtp_host')} /></label>
        <label className="block"><span className="app-label">SMTP port</span><input className="app-input w-full" required inputMode="numeric" value={form.smtp_port} onChange={set('smtp_port')} /></label>
      </div>}
      <label className="block"><span className="app-label">Email address / username</span><input className="app-input w-full" required autoComplete="off" value={form.username} onChange={set('username')} /></label>
      <label className="block"><span className="app-label">App password</span>
        <input className="app-input w-full" type="password" autoComplete="new-password" required={!mailbox} placeholder={mailbox ? 'Saved — leave blank to keep it' : ''} value={form.password} onChange={set('password')} />
        <span className="mt-1 block text-xs text-slate-500">{provider === 'other' ? 'Use an app password if your provider offers one.' : PROVIDERS[provider].help}</span></label>
      <label className="flex items-center gap-2 text-sm text-slate-700"><Switch checked={form.enabled} onCheckedChange={enabled => setForm(f => ({ ...f, enabled }))} /> Read new emails automatically</label>
    </fieldset>
    {result && <p role={result.ok ? 'status' : 'alert'} className={`text-sm ${result.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{result.text}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="outline" disabled={busy || !form.host || !form.username || (!mailbox && !form.password)} onClick={test}>Test connection</Button>
      <Button type="submit" disabled={busy}>{mailbox ? 'Save mailbox' : 'Connect mailbox'}</Button>
    </div>
  </form>;
}
