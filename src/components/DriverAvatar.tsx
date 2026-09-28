import type { ImgHTMLAttributes } from 'react';

interface DriverAvatarProps {
  name: string;
  avatar?: string | null;
  className?: string;
  alt?: string;
  referrerPolicy?: ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
}

/** Shows a supplied photo or a letter avatar for drivers without one. */
export function DriverAvatar({ name, avatar, className = '', alt = name, referrerPolicy }: DriverAvatarProps) {
  if (avatar?.trim()) return <img src={avatar} alt={alt} className={className} referrerPolicy={referrerPolicy} />;
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? 'D';
  return <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
    className={`inline-flex items-center justify-center bg-slate-100 text-slate-700 font-semibold select-none ${className}`}>
    {initial}
  </span>;
}
