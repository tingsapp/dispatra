import { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className="app-page-header page-content shrink-0">
    <div className="min-w-0 flex-1 basis-56">
      <h1 className="app-page-title">{title}</h1>
      <p className="mt-2 text-base leading-6 text-app-muted">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}
