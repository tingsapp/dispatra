import { loadBillingConfig } from '../../lib/billingStorage';
import { formatWeight, formatDistance } from '../../lib/units';
import React, { useState } from 'react';
import { AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { PricingSnapshot } from '../../types/pricing';

/**
 * Renders a PricingSnapshot exactly as the engine produced it: resolved card,
 * method, status, ChargeLines, tax, total, "View calculation", and the
 * internal margin (dispatcher-only). Used by Order creation,
 * and Order details so every surface reads the same numbers.
 */
interface PriceBreakdownProps {
  snapshot: PricingSnapshot;
  /** `card` = white card with dark header (Order estimate). `inline` = flat block inside a drawer. */
  variant?: 'card' | 'inline';
  /** Hide the internal cost/margin block (e.g. shipper-facing previews). */
  showMargin?: boolean;
  headerAction?: React.ReactNode;
  title?: string;
}

const fmt = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
const lower = (s: string) => s.replace(/_/g, ' ').toLowerCase();

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  snapshot,
  variant = 'card',
  showMargin = true,
  headerAction,
  title
}) => {
  const units = loadBillingConfig().general;
  const [showCalculation, setShowCalculation] = useState(false);
  const priced = snapshot.status === 'PRICED';
  const dark = variant === 'card';

  const statusStyle = dark
    ? priced
      ? 'bg-emerald-500/15 text-emerald-300'
      : snapshot.status === 'NEEDS_ATTENTION'
      ? 'bg-amber-500/15 text-amber-300'
      : 'bg-rose-500/15 text-rose-300'
    : priced
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : snapshot.status === 'NEEDS_ATTENTION'
    ? 'bg-amber-50 text-amber-700 border border-amber-200'
    : 'bg-rose-50 text-rose-700 border border-rose-200';

  const header = (
    <div className={dark ? 'p-6 bg-slate-900 text-white' : 'p-4 bg-slate-50 rounded-xl'}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium tracking-wide uppercase ${dark ? 'text-slate-300' : 'text-slate-500'}`}>
          {title ?? (snapshot.stage === 'FINAL' ? 'Final price' : 'Quote estimate')}
        </span>
        {headerAction}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-3xl font-medium tracking-tight ${dark ? '' : 'text-slate-900'}`}>{priced ? `$${snapshot.total.toFixed(2)}` : '—'}</span>
        <span className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{snapshot.currency || 'CAD'}</span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 ${statusStyle}`}>
          {snapshot.stage === 'FINAL' && priced && <Lock className="w-3 h-3" />}
          {snapshot.stage === 'FINAL' && priced ? 'LOCKED' : snapshot.status.replace('_', ' ')}
        </span>
      </div>

      <div className={`mt-3 text-xs space-y-0.5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
        <div className="flex justify-between gap-2">
          <span className={dark ? 'text-slate-400' : 'text-slate-400'}>Rate Card</span>
          <span className={`font-medium text-right truncate ${dark ? 'text-white' : 'text-slate-900'}`}>
            {snapshot.rateCard ? `${snapshot.rateCard.name} · v${snapshot.rateCard.version}` : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Resolved via</span>
          <span className={`font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>{snapshot.rateCard ? lower(snapshot.rateCard.source) : '—'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Method</span>
          <span className={`font-medium ${dark ? 'text-white' : 'text-slate-900'}`}>{snapshot.method ? lower(snapshot.method) : '—'}</span>
        </div>
      </div>

      {snapshot.taxDecision && <p className={`mt-3 text-xs ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{snapshot.taxDecision.description}</p>}
      {snapshot.errors.length > 0 && (
        <div className={`mt-3 rounded-lg px-3 py-2 text-xs space-y-1 ${dark ? 'bg-white/10' : 'bg-amber-50 border border-amber-200'}`}>
          {snapshot.errors.map((e) => (
            <div key={e.code} className={`flex items-start gap-1.5 ${dark ? 'text-amber-200' : 'text-amber-800'}`}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{e.message}</span>
            </div>
          ))}
        </div>
      )}
      {snapshot.warnings.map((w) => (
        <div key={w} className={`mt-2 text-xs ${dark ? 'text-amber-200/90' : 'text-amber-700'}`}>{w}</div>
      ))}
    </div>
  );

  const body = (
    <div className={dark ? 'p-6 space-y-4' : 'pt-4 space-y-4'}>
      {dark && <h5 className="text-xs font-medium text-slate-500 pb-2">Charge Lines</h5>}

      {snapshot.lines.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {snapshot.status === 'NEEDS_ATTENTION' || !snapshot.rateCard
            ? 'No live estimate yet. Complete the route and stop details for a valid shipper to price this order.'
            : 'Nothing priced yet.'}
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          {snapshot.lines.map((l) => (
            <div key={l.key} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`font-medium ${l.amount < 0 ? 'text-emerald-700' : 'text-slate-800'}`}>{l.label}</span>
                {l.detail && <p className="text-xs text-slate-500 break-words">{l.detail}</p>}
              </div>
              <span className={`font-medium whitespace-nowrap ${l.amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{fmt(l.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <span className="font-medium text-slate-700">Subtotal excluding tax</span>
            <span className="font-medium text-slate-900">${snapshot.subtotal.toFixed(2)}</span>
          </div>
          {snapshot.taxExempt ? (
            <div className="flex items-center justify-between text-slate-500">
              <span>Tax exempt shipper</span>
              <span>$0.00</span>
            </div>
          ) : (
            snapshot.taxLines.map((l) => (
              <div key={l.key} className="flex items-center justify-between text-slate-700">
                <span>
                  {l.label} <span className="text-slate-500 text-xs">{l.detail}</span>
                </span>
                <span className="font-medium text-slate-900">${l.amount.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {!!snapshot.roundingAdjustment && <p className="text-xs text-slate-500">Final rounding: {fmt(snapshot.roundingAdjustment)}</p>}
      <div className="pt-4 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">Total</span>
        <span className="text-base font-medium text-slate-900">
          {priced ? `$${snapshot.total.toFixed(2)}` : '—'} {snapshot.currency || 'CAD'}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setShowCalculation((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-medium text-slate-600 hover:text-slate-900 py-1"
      >
        <span>View calculation</span>
        {showCalculation ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {showCalculation && (
        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="font-medium text-slate-700 mb-1.5">Rate Card resolution</div>
            {snapshot.candidates.length === 0 ? (
              <p className="text-slate-500">No cards considered.</p>
            ) : (
              <ul className="space-y-1">
                {snapshot.candidates.map((c) => (
                  <li key={`${c.source}_${c.id}`} className="flex items-center justify-between gap-2">
                    <span className={c.eligible ? 'text-slate-800' : 'text-slate-400 line-through'}>
                      {c.name} <span className="text-slate-400">· {lower(c.source)}</span>
                    </span>
                    <span className={`shrink-0 ${c.id === snapshot.rateCard?.id ? 'text-emerald-700 font-medium' : 'text-slate-400'}`}>
                      {c.id === snapshot.rateCard?.id ? 'selected' : c.reason}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-slate-500">Fuel uses eligible charge lines before contract discounts. Minimums and fixed discounts exclude tax.</p>
          <div className="p-3 rounded-lg bg-slate-50 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
            <span>Billable distance</span><span className="text-right font-mono">{formatDistance(snapshot.inputs.billableKm, units)}</span>
            <span>Duration (cost / hourly contract)</span><span className="text-right font-mono">{snapshot.inputs.estimatedMinutes ?? '—'}</span>
            <span>Chargeable weight</span><span className="text-right font-mono">{formatWeight(snapshot.inputs.chargeableWeightKg, units)}</span>
            <span>Pieces / stops</span><span className="text-right font-mono">{snapshot.inputs.pieces} / {snapshot.inputs.stopCount}</span>
            <span>{snapshot.inputs.serviceCharge == null ? 'Service multiplier' : 'Service charge'}</span><span className="text-right font-mono">{snapshot.inputs.serviceCharge == null ? `×${snapshot.inputs.serviceMultiplier.toFixed(2)}` : `$${snapshot.inputs.serviceCharge.toFixed(2)}`}</span>
            <span>Fuel</span><span className="text-right font-mono">{snapshot.inputs.fuelPercent}% of ${snapshot.inputs.fuelBase.toFixed(2)}</span>
            <span>Wait allowance</span><span className="text-right font-mono">{snapshot.inputs.waitFreeMinutes} free / {snapshot.inputs.waitIncrementMinutes} min blocks</span>
            <span>Tax profile</span><span className="text-right font-mono">{snapshot.taxExempt ? 'exempt' : snapshot.taxProfile?.name ?? '—'}</span>
            <span>Priced</span><span className="text-right font-mono">{new Date(snapshot.pricedAt).toLocaleString()}</span>
            <span>Engine</span><span className="text-right font-mono">{snapshot.engineVersion}</span>
          </div>
        </div>
      )}

      {showMargin && snapshot.cost?.complete === false && priced && <p className="p-3 bg-amber-50 text-amber-900 rounded-lg text-xs">Incomplete cost estimate — missing {snapshot.cost.missingInputs?.join(', ')}. Profit and margin are unavailable.</p>}
      {showMargin && snapshot.cost && snapshot.cost.complete !== false && priced && (
        <div className="p-3 rounded-lg bg-slate-50 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-medium text-slate-700">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-slate-500" />
              Internal margin (not shown to shipper)
            </span>
            <span className="font-medium text-slate-900">
              {snapshot.cost.grossMarginPercent.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Estimated fulfilment cost</span>
            <span className="font-mono">${snapshot.cost.estimatedCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Estimated profit</span>
            <span className="font-mono">${snapshot.cost.grossProfit.toFixed(2)}</span>
          </div>
          <p className="text-slate-500">{snapshot.cost.basis}</p>
          <p className="text-slate-400 pt-1">Deadhead and driver choice affect this cost, never the shipper price.</p>
        </div>
      )}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium tracking-wide uppercase text-slate-500">{title ?? (snapshot.stage === 'FINAL' ? 'Final price' : 'Quote estimate')}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 ${statusStyle}`}>
            {snapshot.stage === 'FINAL' && priced && <Lock className="w-3 h-3" />}
            {snapshot.stage === 'FINAL' && priced ? 'LOCKED' : snapshot.status.replace('_', ' ')}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Rate card: {snapshot.rateCard?.name ?? '—'}</p>
        {snapshot.taxDecision && <p className="mt-1 text-xs text-slate-500">{snapshot.taxDecision.description}</p>}
        {snapshot.errors.map((e) => <p key={e.code} className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{e.message}</p>)}
        {snapshot.warnings.map((w) => <p key={w} className="mt-2 text-xs text-amber-700">{w}</p>)}
        {body}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
      {header}
      {body}
    </div>
  );
};
