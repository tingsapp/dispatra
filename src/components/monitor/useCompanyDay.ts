import { useEffect, useState } from 'react';
import { companyDay } from './todaysPlanData';

/** Company-local YYYY-MM-DD, refreshed each minute and on focus so Monitor rolls over at midnight. */
export function useCompanyDay(timeZone: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    const refresh = () => setNow(new Date());
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return { now, day: companyDay(now, timeZone) };
}
