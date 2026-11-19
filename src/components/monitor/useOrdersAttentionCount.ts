import { useQuery } from '@tanstack/react-query';
import { operations } from '../../operations/api';
import { EMAIL_DRAFT_STATUSES } from '../orders/EmailIntake';

/** Global unresolved Orders work; independent of the Monitor's current-day display. */
export function useOrdersAttentionCount(slug: string | null) {
  const count = useQuery({queryKey:['operations',slug,'order-attention-count'],queryFn:()=>operations.orderAttentionCount(slug!),enabled:!!slug,refetchInterval:30_000});
  const drafts = useQuery({queryKey:['operations',slug,'email-intakes','drafts'],queryFn:()=>operations.emailIntakes(slug!,EMAIL_DRAFT_STATUSES),enabled:!!slug});
  const imports = useQuery({queryKey:['operations',slug,'tms-inbox'],queryFn:()=>operations.tmsInbox(slug!),enabled:!!slug,refetchInterval:30_000});
  return {count:(count.data?.count??0)+(drafts.data?.length??0)+(imports.data?.length??0),capped:(drafts.data?.length??0)>=200 || (imports.data?.length??0)>=50};
}
