import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEntityDialog } from '../entities/useEntityDialog';

export type ViewerPhoto = { src: string; alt: string; caption?: string };

/** A photo at full size over a dark backdrop, above any open dialog. Escape, the x or a click outside the photo
 * closes it; arrows (buttons or keys) step through the set. Rendered at the page root so a parent dialog's
 * transform cannot offset it. */
export function PhotoViewer({ photos, index, onIndex, onClose }: { photos: ViewerPhoto[]; index: number; onIndex: (index: number) => void; onClose: () => void }) {
  const photo = photos[index];
  const many = photos.length > 1;
  const step = (by: number) => onIndex((index + by + photos.length) % photos.length);
  useEntityDialog(true, onClose, photo?.caption ?? photo?.alt ?? 'Photo');
  useEffect(() => {
    if (!many) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  });
  if (!photo) return null;
  const round = 'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white';
  return createPortal(<div data-entity-dialog className="fixed inset-0 z-[80] flex flex-col bg-black/95"
    onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }} onClick={event => event.stopPropagation()}>
    <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 text-sm text-white/80" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <p className="min-w-0 truncate">{many && <span className="mr-2 font-medium text-white">{index + 1} / {photos.length}</span>}{photo.caption}</p>
      <button type="button" aria-label="Close photo" className={round} onClick={onClose}><X className="h-5 w-5" /></button>
    </div>
    <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <img src={photo.src} alt={photo.alt} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
      {many && <>
        <button type="button" aria-label="Previous photo" className={`${round} absolute left-3 top-1/2 -translate-y-1/2`} onClick={() => step(-1)}><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" aria-label="Next photo" className={`${round} absolute right-3 top-1/2 -translate-y-1/2`} onClick={() => step(1)}><ChevronRight className="h-5 w-5" /></button>
      </>}
    </div>
  </div>, document.body);
}

/** Thumbnails that open in the PhotoViewer instead of a new tab. */
export function PhotoThumbnails({ photos, className, thumbClassName, children }: {
  photos: ViewerPhoto[]; className?: string; thumbClassName: string;
  /** Optional caption under each thumbnail. */
  children?: (photo: ViewerPhoto, index: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return <>
    <div className={className ?? 'flex flex-wrap gap-2'}>
      {photos.map((photo, index) => <button key={photo.src} type="button" aria-label={`View ${photo.alt}`} title="View photo"
        className="group block rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-app-accent)]"
        onClick={event => { event.stopPropagation(); setOpen(index); }}>
        <img src={photo.src} alt={photo.alt} loading="lazy" className={`${thumbClassName} cursor-zoom-in transition group-hover:border-slate-400 group-hover:brightness-95`} />
        {children?.(photo, index)}
      </button>)}
    </div>
    {open !== null && <PhotoViewer photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
  </>;
}
