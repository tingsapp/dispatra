import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { operations } from '../../operations/api';

export const activityKey = (slug: string) => ['operations', slug, 'activity'] as const;

export function useActivityPresence() {
  const [visible, setVisible] = useState(!document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const visibility = () => setVisible(!document.hidden);
    const motion = () => setReducedMotion(media?.matches ?? false);
    document.addEventListener('visibilitychange', visibility);
    media?.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); media?.removeEventListener('change', motion); };
  }, []);
  return { visible, reducedMotion };
}

export function useCompanyActivity(slug: string, live: boolean) {
  return useQuery({ queryKey: [...activityKey(slug), 'latest'], queryFn: () => operations.activity(slug), enabled: live,
    refetchInterval: live ? 5_000 : false, refetchIntervalInBackground: false, refetchOnWindowFocus: live });
}
