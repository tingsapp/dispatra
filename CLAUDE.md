# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required reading

`AGENTS.md` holds the binding product, architecture, UX and security rules for this repo — read it first. `spec.md` is the normative contract; `state.md` is the verified implementation log (newest entries at the top). Update `state.md` only when implementation evidence changes. `pricing-rules.md` and `automatic-tax.md` record the adopted pricing/tax requirements.

## Commands

```sh
npm run dev          # Vite on :3000, proxies /api -> http://127.0.0.1:8000 (override with API_PROXY_TARGET)
npm run lint         # tsc --noEmit (there is no ESLint; this is the only lint step)
npm test             # runs every tests/*.test.ts file sequentially
npm run build        # vite build (a bundle-size advisory is expected)
npm run generate:api # regenerate src/portal/schema.d.ts from ../api/openapi.json
npm run test:portal  # Playwright browser journey against a live API (needs E2E_* env, see README)
```

Run a single test file (the test runner is `node:test`, no vitest/jest):

```sh
node --import tsx tests/pricing.test.ts
```

Filter to one test by name:

```sh
node --import tsx --test-name-pattern="minimum charge" tests/pricing.test.ts
```

New test files must be appended to the `test` script in `package.json` — nothing discovers them automatically.

## Two apps behind one entry point

`src/Root.tsx` picks the app by `location.pathname`:

- `/` and `/prototype*` → `src/App.tsx`, the **local dispatch prototype**. No router; navigation is a `activeTab` string. All data is static mocks (`src/data/mockData.ts`) persisted to `localStorage` under `dispatra_*` keys by the `src/lib/*Storage.ts` modules.
- Everything else (`/platform`, `/{slug}/dispatch`, `/{slug}/customer[/settings]`) → `src/portal/PortalApp.tsx`, the **authenticated portal**. Routes are parsed by `parsePortal`; server state goes through `src/portal/api.ts` (`openapi-fetch` typed by the generated `schema.d.ts`) and TanStack Query. It must never import from the prototype or read its localStorage stores.

Both apps are lazy-loaded so neither bundle pulls the other in.

## Prototype domain layer

Pages and components are consumers; business rules live in `src/lib` and `src/domain`:

- `src/lib/pricingEngine.ts` — `resolveRateCard` / `calculatePricing` produce an immutable `PricingSnapshot` with `ChargeLine`s. Every order (including mocks) carries one. `PRICING_ENGINE_VERSION` is stamped into snapshots; bump it when output semantics change.
- `src/lib/orderPricing.ts` — the façade the UI calls: `loadPricingContext()` assembles billing + catalogue + rate cards + customers from storage; `priceOrder`, `finalizeOrderPrice`, `createDefaultOrderInput`, `loadSavedOrders`/`saveOrders`. The Order form and every price preview must go through here, not call the engine ad hoc.
- `src/lib/billingEngine.ts`, `destinationTax.ts`, `destinationTaxRates.ts`, `taxAddress.ts` — rounding, distance rules, fuel surcharge and versioned GST/HST-by-delivery-province rules. Tax rate defaults are dated constants, not fetched.
- `src/lib/organizationWorkflows.ts` — `validateBooking`, `validateAssignment`, `createInvoicePreview`.
- `src/lib/units.ts` — storage is always km / kg / cm; convert only at display boundaries with `toDisplay*` / `fromDisplay*`.
- `src/domain/operations.ts` — the `OrderLifecycle` enum and audit/operational interfaces that mirror the API schema. Don't add client-only statuses.
- Storage modules (`pricingStorage`, `billingStorage`, `simplePricingStorage`, `customerStorage`, `driverStorage`, `vehicleStorage`, `profileStorage`) each own a versioned key, `INITIAL_*` defaults and `load`/`save`/`reset`. Schema changes are handled by in-loader migration; persisted quote snapshots are never rewritten.

Settings UI (`src/components/settings/`) has exactly four destinations — Company, Services & Dispatch, Pricing, Billing — defined once in `SETTINGS_AREAS` (`SettingsLayout.tsx`), which also drives the sidebar submenu. `BillingSettingsForm` renders one `section` of the billing config (`company` / `dispatch` / `extras` / `costs` / `billing`) with its own Save; per-vehicle running cost is edited on the vehicle type form but stored in `billing.operatingCost.costPerKmByVehicleId`. Tab groups live in `PricingTabs.tsx` / `BillingTabs.tsx`. Rate cards are one flat form; every card applies to every service/customer, one is the Default (`scope: 'ORGANIZATION'`), archived cards are `ARCHIVED` (never deleted). Background contract terms and their fixed V1 values live in `RATE_CARD_BACKGROUND_DEFAULTS` (`src/lib/pricingStorage.ts`) and are normalised on load. Resolution is chosen-on-order → customer's card → Default (`resolveRateCard`). `useSettingsGuard` dispatches `SETTINGS_NAVIGATION_EVENT` so unsaved drafts can cancel tab changes from `App.tsx`.

## Testing conventions

- Component tests bootstrap jsdom manually at the top of the file (see `tests/entityForms.test.ts`) and `await import` React components *after* the globals are defined. Copy that preamble for new component tests.
- Pure engine tests build a `PricingContext` from `INITIAL_*` constants with `structuredClone` and assert on `PricingSnapshot` fields.
- `tests/portal.e2e.mjs` is not in `npm test`; it needs a running API and browser.

## Conventions worth knowing

- The `@/` alias resolves to the **repo root**, not `src/` (see `vite.config.ts` / `tsconfig.json`); in practice imports are relative.
- Code style is dense: single-line JSX, compact object literals, minimal comments. Match it rather than reformatting.
- `dist/` is gitignored build output; don't edit or read it for source truth.
