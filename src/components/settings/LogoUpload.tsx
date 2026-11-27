import { ImagePlus, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Button } from '../ui/button';
import { labelClass } from './BillingFields';

/** Shared company, shipper and driver image editor; the enclosing profile saves the draft.
 *  `round` shows a cropped circular photo, as driver avatars appear elsewhere; `aside` sits beside the image. */
export function LogoUpload({ value, onChange, label = 'Company Logo', subject = 'company logo', round = false, aside }: {
  value: string; onChange: (value: string) => void; label?: string; subject?: string; round?: boolean; aside?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const readLogo = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { setError('Choose a PNG or JPEG image.'); return; }
    if (file.size > 200 * 1024) { setError('Choose an image up to 200 KB.'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result ?? ''));
    reader.onerror = () => setError('Unable to read this image. Please try again.');
    reader.readAsDataURL(file);
  };
  return <div>
    <p className={labelClass}>{label}</p>
    <div className="flex items-center gap-4">
      <Button type="button" variant="ghost" size="icon" className={`app-company-logo size-16 overflow-hidden bg-slate-100 p-0 hover:bg-slate-200 ${round ? 'app-avatar-upload' : ''}`}
        aria-label={`${value ? 'Change' : 'Upload'} ${subject}`} title={`${value ? 'Change' : 'Upload'} ${subject}`} onClick={() => input.current?.click()}>
        {value ? <img src={value} alt={subject.charAt(0).toUpperCase() + subject.slice(1)} className={`w-full h-full ${round ? 'object-cover' : 'object-contain'}`} /> : <ImagePlus aria-hidden="true" className="size-5 text-slate-400" />}
      </Button>
      <input ref={input} type="file" aria-label={`Choose ${subject}`} accept=".png,.jpg,.jpeg,image/png,image/jpeg" className="hidden"
        onChange={event => { readLogo(event.target.files?.[0]); event.target.value = ''; }} />
      <div className="min-w-0 space-y-2">
        {aside}
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => { setError(null); onChange(''); }} aria-label={`Remove ${subject}`}><X aria-hidden="true" />Remove</Button>}
        <p className="text-xs text-slate-500">PNG or JPEG, up to 200 KB.</p>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      </div>
    </div>
  </div>;
}
