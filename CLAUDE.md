# CLAUDE.md

Rules are in `AGENTS.md`; this file is the code map. Adopted pricing/tax requirements: `pricing-rules.md`, `automatic-tax.md`.

## Commands

```sh
npm run dev          # Vite on :3000, proxies /api to 127.0.0.1:8000 (override with API_PROXY_TARGET)
npm run lint         # tsc --noEmit (no ESLint)
npm test             # node:test over the files listed in package.json "test"; append new test files there
npm run build        # a bundle-size advisory is expected
npm run generate:api # src/portal/schema.d.ts from ../api/openapi.json
node --import tsx --test-name-pattern="minimum charge" tests/pricing.test.ts   # one test
```

`tests/*.e2e.mjs` (the `test:*` scripts) need a running API and browser.

## Entry point

`src/Root.tsx` routes by path: public pages (`/`, `/plans`, `/about`, `/help`, `/docs/integrations`, `/contact`, `/terms`, `/privacy`); `/prototype*` → `src/App.tsx` behind a local login, on browser stores; everything else → `src/portal/PortalApp.tsx` (`parsePortal`: `/admin`, `/{slug}/…` dispatcher workspace, `/{slug}/shipper`, `/{slug}/driver`). The dispatcher workspace renders the same `App` with API data through `src/operations/` and `src/portal/api.ts` (`openapi-fetch` + TanStack Query). Page paths live in `src/lib/pageRoutes.ts`.

## Domain layer (`src/lib`, `src/domain`)

- `pricingEngine.ts` (`resolveRateCard`, `calculatePricing`; bump `PRICING_ENGINE_VERSION` when output semantics change) and `orderPricing.ts` (`loadPricingContext`, `priceOrder`, `createDefaultOrderInput`). Price previews go through `orderPricing`, never the engine ad hoc.
- `billingEngine.ts`, `destinationTax*.ts`, `taxAddress.ts`: rounding, distance, fuel surcharge, dated GST/HST rules.
- `organizationWorkflows.ts`: `validateBooking`, `validateBookingSchedule`, `validateAssignment`.
- `units.ts`: storage is km/kg/cm; convert only at display with `toDisplay*`/`fromDisplay*`.
- `src/domain/operations.ts`: `OrderLifecycle` and audit interfaces mirroring the API.
- `*Storage.ts` modules own a versioned key, `INITIAL_*` defaults, `load`/`save`/`reset` and in-loader migrations; persisted quote snapshots are never rewritten.
- Settings sections are in `src/components/settings/`; `useSettingsGuard` dispatches `SETTINGS_NAVIGATION_EVENT` so unsaved drafts can cancel navigation.

## Conventions

- Component tests bootstrap jsdom at the top of the file and `await import` components afterwards; copy the preamble from `tests/entityForms.test.ts`.
- `@/` resolves to the repo root, not `src/`; imports are relative in practice.
- Dense style: single-line JSX, compact literals, minimal comments. Match it.
