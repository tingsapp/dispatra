import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { BrandMark } from '../components/layout/AppBrand';
import { Button } from '../components/ui/button';
import { companySlugForPath } from '../lib/pageRoutes';

/** Public site entry. Company workspaces live beneath their own slug. */
export function PublicHome() {
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const openWorkspace = (event: FormEvent) => {
    event.preventDefault();
    const value = slug.trim().toLowerCase();
    if (companySlugForPath(`/${value}/`) !== value) {
      setError('Enter the company name used in your workspace address.');
      return;
    }
    window.location.assign(`/${value}/`);
  };
  return <main className="min-h-dvh bg-app-canvas text-app-text">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <a href="/" className="inline-flex items-center gap-2.5 text-lg font-semibold tracking-tight"><BrandMark />Dispatra</a>
      <a href="/admin" className="text-sm text-app-muted underline-offset-4 hover:text-app-text hover:underline">Platform administration</a>
    </header>
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
      <div>
        <p className="text-sm font-medium text-blue-700">AI-powered delivery operations</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Automatic dispatch. Smarter deliveries.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-app-muted">Dispatra is an AI-powered dispatch system that helps your team assign orders automatically and manage drivers, vehicles, and deliveries in one workspace.</p>
      </div>
      <form onSubmit={openWorkspace} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold">Open your workspace</h2>
        <p className="mt-2 text-sm text-app-muted">Enter the company name from your Dispatra web address.</p>
        <label htmlFor="company-slug" className="app-label mt-6 block">Company name</label>
        <div className="mt-2 flex items-center overflow-hidden rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-blue-500">
          <span className="pl-3 text-sm text-slate-500">dispatra.com/</span>
          <input id="company-slug" value={slug} onChange={event => { setSlug(event.target.value); setError(''); }} autoCapitalize="none" autoComplete="organization" spellCheck={false} className="min-w-0 flex-1 px-2 py-2.5 text-sm outline-none" placeholder="your-company" />
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" className="mt-5 w-full">Continue <ArrowRight className="ml-1 size-4" /></Button>
      </form>
    </section>
  </main>;
}
