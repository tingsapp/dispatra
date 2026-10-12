import { useState } from 'react';
import { Building2 } from 'lucide-react';

/** Decorative logo beside the company name; failed images retain the same row geometry. */
export function CompanyLogo({ src }: { src?: string }) {
  const [failed, setFailed] = useState<string>();
  return <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-app-muted">
    {src && src !== failed
      ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-contain" onError={() => setFailed(src)} />
      : <Building2 size={18} strokeWidth={1.5} />}
  </span>;
}
