import { MessageSquare, Phone } from 'lucide-react';
import { phoneHref } from '../../lib/phone';

/** One contact action pair for maps and profiles. Messaging never depends on a phone number. */
export function PersonContactActions({ name, phone, onMessage, messageUnavailable = 'In-app chat is available in a company workspace.', labelled = false }: {
  name: string; phone?: string | null; onMessage?: () => void; messageUnavailable?: string; labelled?: boolean;
}) {
  const href = phoneHref(phone);
  const action = labelled ? 'app-action app-secondary flex-1' : 'inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50';
  const disabled = `${action} disabled:cursor-not-allowed disabled:opacity-40`;
  const call = <><Phone className="size-3.5" aria-hidden="true" />{labelled && <span>Call</span>}</>;
  return <div className={`flex items-center gap-1.5 ${labelled ? 'flex-1' : 'shrink-0'}`}>
    {href ? <a href={href} className={action} aria-label={`Call ${name}`} title={`Call ${name}`}>{call}</a>
      : <button type="button" disabled className={disabled} aria-label={`Call ${name}`} title="Phone number unavailable">{call}</button>}
    <button type="button" onClick={onMessage} disabled={!onMessage} className={disabled} aria-label={`Message ${name}`} title={onMessage ? `Message ${name}` : messageUnavailable}>
      <MessageSquare className="size-3.5" aria-hidden="true" />{labelled && <span>Message</span>}
    </button>
  </div>;
}
