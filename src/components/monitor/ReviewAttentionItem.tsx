import { ChevronRight } from 'lucide-react';
import { MonitorBadge } from './MonitorBadge';

export interface ReviewAttentionProps {
  reviewCount?: number;
  reviewCapped?: boolean;
  reviewPending?: boolean;
  reviewFailed?: boolean;
  onOpenReview?: () => void;
}

export function hasReviewAttention({ reviewCount = 0, reviewPending, reviewFailed }: ReviewAttentionProps) {
  return reviewCount > 0 || !!reviewPending || !!reviewFailed;
}

/** The same unresolved-request entry in both Needs Attention lists. */
export function ReviewAttentionItem(props: ReviewAttentionProps) {
  const { reviewCount = 0, reviewCapped, reviewPending, reviewFailed, onOpenReview } = props;
  if (!hasReviewAttention(props)) return null;
  return <button type="button" aria-haspopup="dialog" onClick={onOpenReview}
    className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-app-accent">
    <span className="min-w-0 flex-1 space-y-1">
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Incomplete requests</span>
        {!!reviewCount && <MonitorBadge tone="warning">{reviewCount}{reviewCapped ? '+' : ''} need review</MonitorBadge>}
      </span>
      <span className="block text-xs text-slate-600">Missing or invalid details must be reviewed before dispatch.</span>
      {(reviewPending || reviewFailed) && <span role="status" className="block text-xs text-amber-800">{reviewFailed ? 'Some requests could not be loaded. Open review to try again.' : 'Checking incoming requests…'}</span>}
      <span className="block text-xs font-medium text-amber-800">Review requests</span>
    </span>
    <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-slate-400" />
  </button>;
}
