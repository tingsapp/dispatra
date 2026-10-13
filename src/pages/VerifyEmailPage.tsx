import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PublicHeader } from '../components/home/PublicPageLayout';
import { Field, Button, Notice, useOperationKey } from '../portal/ui';
import { api } from '../portal/api';
import { accountWorkspace } from '../lib/workspaceEntry';

export default function VerifyEmailPage() {
  const [cache] = useState(() => new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false,gcTime:0}}}));
  return <QueryClientProvider client={cache}><EmailVerificationForm /></QueryClientProvider>;
}

export function EmailVerificationForm() {
  const cache = useQueryClient();
  const [code, setCode] = useState('');
  const [observed, setObserved] = useState(Date.now());
  const keyFor = useOperationKey(), resendKey = useOperationKey();
  const status = useQuery({queryKey:['email-verification'], queryFn:api.verification,
    refetchInterval:query => ['PENDING','SENDING'].includes(query.state.data?.delivery_status ?? '') ? 5000 : false});
  useEffect(() => {const timer=window.setInterval(()=>setObserved(Date.now()),1000);return ()=>window.clearInterval(timer);},[]);
  const confirmation = useMutation({mutationFn:()=>api.verifyEmail(code,keyFor(code)),onSuccess:account=>{setCode('');location.replace(accountWorkspace(account) ?? '/login');}});
  const resend = useMutation({mutationFn:()=>api.resendVerification(resendKey(status.data?.expires_at)),onSuccess:data=>{setCode('');confirmation.reset();cache.setQueryData(['email-verification'],data);}});
  const busy = confirmation.isPending || resend.isPending;
  const remaining = status.data ? Math.max(0,Math.ceil((new Date(status.data.resend_at).getTime()-observed)/1000)) : 0;
  const expired = status.data && new Date(status.data.expires_at).getTime()<=observed;
  const delivery = status.data?.delivery_status;
  return <div className="flex min-h-dvh flex-col bg-app-canvas text-app-text"><PublicHeader />
    <main className="flex flex-1 items-center justify-center px-6 py-10"><section className="w-full max-w-sm">
      <h1 className="text-center text-2xl font-medium tracking-tight">Verify your email</h1>
      <p className="mt-3 text-center text-sm leading-6 text-app-muted">Confirm your email before accessing your workspace. Your 30-day trial starts after verification.</p>
      {status.isPending && <p role="status" className="mt-6 text-center text-sm">Loading verification…</p>}
      <Notice error={status.error} />
      {status.data && <>
        <p className="mt-6 break-words text-center text-sm">Enter the six-digit code for <strong>{status.data.email}</strong>.</p>
        <p role="status" className="mt-2 text-center text-xs text-app-muted">{delivery==='FAILED' ? 'Email delivery failed. Request another code below.' : delivery==='UNKNOWN' ? 'Delivery could not be confirmed. Check your inbox or request another code.' : ['PENDING','SENDING'].includes(delivery ?? '') ? 'Sending your verification email…' : 'Check your inbox and spam folder. The code expires after 10 minutes.'}</p>
        <form className="mt-6 space-y-4" onSubmit={event=>{event.preventDefault();if(!busy&&!expired)confirmation.mutate();}}>
          <Field label="Verification code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} disabled={busy} onChange={event=>{setCode(event.target.value.replace(/[^0-9]/g,''));confirmation.reset();}} />
          <Notice error={confirmation.error ?? resend.error} />
          {expired && <p role="alert" className="text-sm text-red-700">Your code expired. Request a new code.</p>}
          <Button className="w-full" disabled={busy || !!expired}>{confirmation.isPending?'Verifying…':'Verify email'}</Button>
        </form>
        <div className="mt-5 text-center"><Button type="button" variant="ghost" disabled={busy || remaining>0} onClick={()=>resend.mutate()}>{resend.isPending?'Sending…':remaining>0?`Resend code in ${remaining}s`:'Resend code'}</Button></div>
      </>}
      {status.error && <Button type="button" variant="outline" className="mt-5" onClick={()=>status.refetch()}>Try again</Button>}
      <p className="mt-6 text-center text-xs text-app-muted">Using a different account? <a href="/login" className="underline underline-offset-4">Sign in</a></p>
    </section></main>
  </div>;
}
