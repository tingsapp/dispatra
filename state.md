# Dispatra Web Client Implementation State

### September 18: New Order form flattened

`OrderPricingForm` was rewritten: Customer (required, no walk-in), Service, Vehicle with the resolved card named; stops with inline contact name and phone, Ready at (pickup) / Deliver by (drop-off) pickers that feed `scheduledAt`/`scheduledEndAt`, waiting minutes, Residential, zone selects shown only when the customer's (or Default) card is zone-to-zone and validated as required on submit, "Picked up at" only with several pickups, and an inline one-line tax-location warning instead of the confirm expandable; a Route line explaining that routing will supply distance/duration with a fallback distance field (new orders start with `routeKm: null`); Packages as a table (qty, weight, L × W × H, Fragile, From/To only for multi-stop); Accessorials collapsed with a summary. Removed: order source/type, external references, Freight tax treatment, Route & Schedule, package handling references, the Pricing Adjustments section, `showOverrides`. The JobsPage dialog dropped Order Number (assigned as one past the highest existing), Shipper Name/Contact Phone, `OrderFields` (reference/PO, commodity, bill-to, communications) keeping only Priority; `OrderFields`, `StopFields`, `ItemFields`, `StopTaxLocation` were deleted.

Validation: 43 pricing, 34 settings, 20 destination-tax, 14 entities, 8 entity-form and 7 date-picker tests pass, plus TypeScript. Browser check confirmed the form. `spec.md` updated.

### September 18: Driver form — employee or owner-operator, attached vehicle

The driver form is flat: name, number, phone, email, Account, Duty, Employment (Employee — company vehicle / Owner-operator — own vehicle), Attached vehicle (the former Current vehicle) and service areas (Skills removed too), with a note that an owner-operator's truck stays a Vehicles record and that pricing never depends on the driver. Work status, shift start/end and the whole "Qualifications, availability & notes" group (licence, qualified vehicle types, work minutes, depot, start location, external reference, notes, availability schedule) are gone from the form; the fields remain in the model and `normalizeDriver` maps legacy TEMPORARY to EMPLOYEE. No pricing or cost change.

The vehicle form dropped Service areas and the "Depot & notes" collapsible (home depot, external reference) in favour of a plain Description textarea bound to `notes`; no collapsible remains on either fleet form.

Validation: 43 pricing, 34 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. Browser check confirmed the form. `spec.md` updated.

### September 18: Customer list and detail follow the trimmed form

The Customers table now has Customer (name + Business/Individual), Contact, Address, Rate Card (the attached card or "Standard (Default)"), Active Orders, Status and Actions; the code, account tier and default-accessorial chips are gone, as is the account-type filter and the "Preferred accounts" tile (three stat tiles remain). The detail drawer shows the customer type badge instead of the tier, drops the legacy details block (legal name, payment terms, windows, saved locations), the tax-exemption row and the Required Accessorials section; `CustomerFields.tsx` was deleted. The page description now reads "Customer accounts, contacts and the rate card each one is priced on."

Validation: 43 pricing, 34 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript.

### September 18: Custom confirm dialog; customer rate card pre-selected

`src/components/ui/ConfirmDialog.tsx` adds `confirmDialog(options)` (promise-based) and `ConfirmDialogHost`, mounted once in `App.tsx`: an accessible alert dialog (title, consequence text, Cancel focused first, Escape/backdrop cancel, Tab trap, red confirm for `tone: 'danger'`). It falls back to `window.confirm` only when no host is mounted (portal, tests without the host). Every native confirm in the prototype now uses it: archive rate card, delete zone, delete customer (with the linked-order count), and the unsaved-settings guard — `SETTINGS_NAVIGATION_EVENT` became a `CustomEvent` carrying `proceed`, the guard cancels immediately and calls `proceed` after confirmation, and the rate card page's select/add/close handlers are async.

The customer form's Customer Rate Card selector lists only real cards, pre-selects the Default card (labelled "(Default)") and stores the choice explicitly; the blank "Default (…)" option is gone. Pricing Relationship copy now explains what the card and billing email are for.

Validation: 43 pricing, 34 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. Browser check confirmed the archive dialog. `spec.md` and `AGENTS.md` updated.

### September 18: Customer form trimmed to one flat form

The customer create/edit dialog dropped both collapsible groups (saved locations & delivery defaults, communication preferences), the Account / Code field (code assigned in the background at save, validated after assignment), Account Tier (one tier in V1; new customers store `Standard Freight`), the tax-exemption checkbox and the Default Accessorials / Requirements picker. Customer Type moved out of the collapsible to sit beside the name; Contact Name stays (a company still needs a person); Status shows on edit only; Dispatch & Receiving Instructions stays as customer details. Stored fields remain in the `Customer` model for the list, detail view and engine.

Validation: 43 pricing, 33 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. `spec.md` updated.

### September 18: Weight pricing restored on Base + Distance cards

Base + Distance cards again expose Included Weight and Weight Rate (per kg beyond the included weight, applied to chargeable weight = max(actual, dimensional) when the Extras rule is on; 0 = not charged). `includedWeightKg` and `weightRatePerKg` left `RATE_CARD_BACKGROUND_DEFAULTS`; the engine's Load Charge line was already in place. The Pricing formula example now ships two 20 kg boxes of 60 × 50 × 40 cm and lists a Packages line (actual, dimensional and chargeable weight with the divisor) and a Weight charge line, and the formula reads Freight = (base + weight charge + extra stops) × multiplier. Every value carries a one-line description of what it is and where it is set.

The organization's Standard zone prices grid now ships empty (`INITIAL_PRICING_CONFIG.zoneRates = []`); the demo Pacific Fresh zone card keeps its own seeded prices. Missing stored grids load as empty rather than seeded.

Validation: 43 pricing, 32 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. `spec.md` and `AGENTS.md` updated.

### September 18: Pricing formula on every rate card

Every rate card ends with a collapsible read-only Pricing formula (`RateCardFormula`, collapsed by default with the example total in its summary): a fixed example order (12 km, 3 stops, Rush service, first surcharged vehicle type, Stair Carry ×2 plus two more accessorials, BC delivery) is priced through `calculatePricing` with the draft card, and the section lists each value with its numbers and a one-line description of what it is and where it is set, then one formula with the actual amounts and the example total. Extra stops are applied before the service multiplier, matching the engine. Cards that cannot price the example show the engine's message. Zone cards lost the Pricing terms section (`ContractRulesEditor` now covers hourly and imported cards only). The editor receives the catalogue for the formula.

Validation: 43 pricing, 31 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. `spec.md` updated.

### September 18: Rate card = base price; zone cards own their grid

Decision recorded after exploring per-contract pricing: a rate card is the customer's base delivery price only. Accessorial rates, vehicle surcharges, service fee, fuel, extra stops and dimensional weight stay organization-wide and identical on every card; customer deals are expressed through the card's rates and Discount. Catalogue items (service, vehicle type, accessorials, zones) are chosen per order. A briefly started per-contract model (contract service fee, per-card accessorial list) was rolled back before release.

Zone cards always carry their own price grid: the "Organization zone prices / this card's own" selector is gone, new zone cards are pre-filled from the Zones tab's Standard zone prices, and pricing schema 7 copies the organization matrix onto stored cards that inherited it (one version bump). The Zones tab grid is now labelled Standard zone prices and described as the starting point for new cards. On the card the grid sits in a collapsible Zone prices section (collapsed on existing cards, open on new ones) whose summary shows how many pairs are priced, so a large zone list does not dominate the form. The "When no zone rate matches" selector and the fallback base/distance fields were removed from zone cards (`zoneNoMatchFallback` pinned to NEEDS_ATTENTION on load; the engine keeps the legacy branch for frozen quotes): an unpriced pair flags the order and dispatch adds the zone and its price first. The section is titled Zone to zone rates and replaces the method rates card for zone cards.

Validation: 43 pricing, 30 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. `spec.md` and `AGENTS.md` updated.

### September 18: Company page holds company identity

Company now holds Company Details (name, address, phone, email, invoice logo as a data URL capped at 200 KB — `BillingConfig.company`), Tax Registration (the GST/HST number, moved from Billing → Taxes; storage unchanged at `invoicing.taxRegistrationNumber`), Currency & Units and the time zone on one form. Billing → Taxes keeps only the province rate table. Rationale: organization settings stay off the personal My Profile page and land on the future organization record.

My Profile lost its organization-level fields (Organization, Organization ID, Timezone, Active Operating Origin / Dispatch Hub, Organization & Hub Logo) and their handlers; `UserProfile` no longer carries them and the loader drops stale copies. The hub became `dispatch.hubAddress`, edited as Dispatch Hub under Services & Dispatch → Dispatch. The profile section is titled Contact Information.

Validation: 42 pricing, 30 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. `spec.md`, `automatic-tax.md`, `AGENTS.md` updated.

### September 18: One discount source, flat accessorial form, wording cleanups

Contract discounts now live only on the rate card. The Discount editor offers No discount / Percentage / Fixed amount and always applies to freight, service multiplier, minimum and vehicle surcharge (scope fixed to `TRANSPORT_ONLY`, no selector); `resolveDiscount` reads the card only, legacy `INHERIT` becomes `NONE` on load, and customer-level discounts are removed from the Customer form and view and reset to the empty relationship on load. Historical snapshots keep their frozen discounts.

The Accessorial editor lost its Code field (generated from the name), shows the unit label only for per-unit charges, and renders Minimum/Maximum charge inline instead of inside the last collapsible in Pricing. The stale "View rate cards & accessorials →" link is gone from Services & Dispatch. The order form section "Overrides & Adjustments — Order-level only — never changes a Rate Card" is now "Pricing Adjustments — This order only — rate cards are unchanged".

Validation: 42 pricing, 30 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. Coverage: card-only discount resolution and normalisation, the three-option discount editor, absence of the customer discount field, and the inline accessorial limits. `spec.md` updated.

### September 18: Settings content regrouped by concern

Company now holds only Currency & Units and the organization time zone. Services & Dispatch holds the Services catalogue, the Vehicle types catalogue (moved from Pricing → Vehicle Pricing) and the dispatch rule. The vehicle type form gained an internal "Running cost / km" field; the value is stored in `billing.operatingCost.costPerKmByVehicleId` (blank removes the entry and the default applies; loading no longer resurrects seed values for cleared entries) and the catalogue table shows a Cost / km column. Pricing tabs are Rate Cards, Zones, Accessorials, Extras and Vehicle & Labour Costs. Extras (later merged from the interim Surcharges and Stops & Weight tabs, one Save) holds Service Fee, Fuel Surcharge, Extra Stops and Dimensional Weight; "Extra Stop Rate" became "Extra Stop Charge" and the cost field "Handling Time per Stop" became "Driver Time per Stop" so nothing on the Costs tab reads as a price. Surcharges notes (fuel surcharge and service charge; the two "Label Shown to Customer" inputs were removed and the labels are fixed to "Service Fee" / "Fuel Surcharge", stored labels normalised on load; the service fee "Calculated On" selector was also removed and the basis is fixed to freight + vehicle surcharge + Accessorials, the "greater of percentage or flat" method was dropped (stored values normalise to percentage), only the amount field for the chosen method is shown, and the service fee now defaults to enabled at 5% for new organizations — saved settings are unchanged; pricing tests disable both surcharges in their shared setup), Stops & Weight (renamed from Defaults: dimensional divisor and on-by-default greater-of rule, included stops, extra-stop rate; the organization waiting allowance/increment fields were removed — the Waiting accessorial owns them, seeded at 15 free / 5-minute steps and back-filled on load for older records) and Vehicle & Labour Costs (moved from Company: default cost per km, driver cost per hour, handling time per stop and overhead share, each with a plain-language description and example; Fixed Cost per Stop was removed and `fixedCostPerStop` is pinned to 0 on load so demo estimates drop the $2.40/stop line; the per-vehicle list is gone). Billing keeps Invoicing (Quote Validity retained — it drives quote expiry and the assignment check) and Taxes, whose province table is now flat in its section instead of a nested card. `BillingSettingsForm` gained `surcharges` and `costs` sections with their own Save labels.

Validation: 42 pricing, 24 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript. New coverage: vehicle running cost round-trip through the form and storage, Costs tab save isolation, and the six Pricing tabs. Browser verification at 1280×720 confirmed Services & Dispatch with vehicle types and the flattened Taxes table. Docs updated: `spec.md`, `AGENTS.md`, `CLAUDE.md`.

### September 18: Rate cards apply to everyone; Default card and simple assignment

Rate cards no longer carry Applies to, Customer, Service or Status controls. Every card applies to every service, vehicle and customer. Exactly one active card is the Default (`scope: 'ORGANIZATION'`), badged in the list, with Set as default in the editor header; other cards are `ORDER` scope. Archive (confirmed, beside Save Card at the bottom of the editor) hides the card from the list and selectors while historical snapshots keep their reference, and states how many attached customers move to the Default; the Default cannot be archived. Cards are never deleted. New cards save as active, and the first card an organization saves becomes its Default.

Assignment: the Customer form's Customer rate card lists every active card (blank = Default). The order form's "Rate Card override (authorized)" and required reason became a plain Rate Card selector pre-selected with the customer's attached card or the Default; `overrideReason` is retained on historical orders only. `resolveRateCard` is chosen-on-order → customer's card → Default with no effective dates, specificity, priority or conflict handling; an archived chosen card is an error, an archived attached card falls back to the Default, and no Default makes pricing unavailable. `PRICING_ENGINE_VERSION` is `client-static-v5-simple-cards`.

Minimum Charge sits in the first block beside Name and Pricing method. Hourly Pricing terms are read-only checked boxes (clock start/stop, loading, waiting, actual settlement) fixed on every hourly card. Imported price is hidden from the new-card method select and the method filter. The Zones tab and a card's own zone prices use one grid (`ZoneMatrixEditor`): pickup zones down, delivery zones across, a price input per cell, blank = no price, saved on change; the origin/destination dropdown rows and Add/Remove buttons are gone and the zone code field is generated from the name. Zone cards choose Organization zone prices or the card's own prices with the shared Select control; the "allow missing contract entries to use organization rates" checkbox was removed and `zoneFallbackToOrganization` is fixed false, so a pair missing from a card's own prices is a no-match handled by the card's existing no-match setting. Background terms are fixed values on every card (`RATE_CARD_BACKGROUND_DEFAULTS` in `pricingStorage.ts`), now including the hourly terms and `applyServiceMultiplier: true` on every method so the Services catalogue multiplier is the one way a service changes price. Pricing schema 6 normalises stored cards on load with one version bump (draft → active, customer/service scopes cleared, background terms reset, organization currency) and collapses zone prices to one amount per origin → destination on the organization matrix and card matrices; the service column was removed from both editors. Demo cards were rewritten to plain values and the advanced-overrides notice was removed. Frozen quotes are untouched.

Validation: 42 pricing, 23 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript and the production build. Resolution tests cover attached, chosen, deleted and missing cards; settings tests cover Default/Archive, hidden fields, migration and zone-row collapse. Docs updated: `spec.md`, `pricing-rules.md`, `AGENTS.md`, `CLAUDE.md`. Browser verification at 1280×720 confirmed the Default badge, Set as default/Archive actions, the flat editor and the order form Rate Card selector listing only active cards.

### September 18: Organization Settings restructured; rate cards flattened

The account menu keeps Organization Settings with an inline submenu rendered once from `SETTINGS_AREAS`, in this order: Company, Services & Dispatch, Pricing, Billing. The submenu opens expanded with the current destination highlighted while a settings page is on screen, and collapsed otherwise; the desktop flyout and its duplicated buttons were removed. The sidebar takes one `onNavigateSettings` callback; the unused `onOpenPricingServices`/`onOpenBillingSettings`/`onOpenRateCards` props are gone.

Company & Billing was split. Company holds Currency & Units, Organization timezone and Operating Costs on one form saved by Save company settings. Billing holds the Invoicing and Taxes tabs saved by Save billing. Pricing tabs are now Rate Cards (initial), Zones, Accessorials, Vehicle Pricing and Defaults (formerly General). No settings fields were added or removed.

Rate cards are one flat form with no collapsible sections: scope, service, status, method rates, method terms (hourly/zone/imported), Minimum Charge and Discount. The Additional settings disclosure, its summary, and the Minimum Freight field were removed from the editor. Code, vehicle restriction, priority, effective dates, currency, notes, weight/piece/stop rates, per-service rates, charge toggles, fuel/wait/dimensional overrides, vehicle and Accessorial overrides, service charge and minimum freight remain in `RateCard` and the engine. New cards take V1 defaults (`RATE_CARD_BACKGROUND_DEFAULTS`): code generated from the name on save, organization currency, no weight charges, minimum freight 0. Cards saved with non-default background terms show a notice listing them with a Reset to defaults action; seeded demo cards show it. Nothing is migrated silently, and frozen quotes are untouched.

Validation: 43 pricing, 22 settings, 20 destination-tax, 14 entities, 7 entity-form and 7 date-picker tests pass, plus TypeScript and the production build (existing bundle-size advisory). New coverage: four destinations and Company/Billing saves, the flat rate-card form with reset and generated codes, and the account submenu's inline list, highlight and pre-expansion. Browser verification at 1280×720 confirmed the submenu, Pricing, Company and Billing pages. `AGENTS.md`, `spec.md`, `pricing-rules.md`, `automatic-tax.md` and `CLAUDE.md` were updated to the four destinations.

### September 17: Minimum charge belongs to rate cards

Removed the Minimums section from General. Rate cards now expose Minimum Charge outside Additional settings, applied after discounts/adjustments and before tax; 0 disables it. New cards default to 0. Removed the duplicate inherited-minimum field and enforcement checkbox from Contract rules. Imported final agreed totals retain their bypass and omit this field. Existing freight and hourly minimum terms remain intact.

Pricing schema 5 migrates inherited organization charges onto existing cards, preserving explicit values and disabled minimums. The retired minimum-distance floor loads as 0 for new quotes. Legacy billing fields remain for migration and frozen quote compatibility; saved quote contexts are not rewritten.

Validation: 43 pricing, 19 settings and 20 destination-tax tests pass, plus TypeScript and production build. Coverage includes saving/zeroing card minimums, migration persistence and removed General controls. Existing Vite bundle-size advisory remains; browser verification was not rerun.

### September 17: Sidebar dispatch label simplified

The sidebar footer now shows only Auto dispatch beside its switch, with the same accessible name. Removed the separate Dispatch and changing Auto/Manual labels. Toggle behavior and notifications are unchanged. TypeScript and production build pass; the existing bundle-size advisory remains. No browser verification was rerun.

### September 17: Automatic rounding

Removed money and distance rounding controls from Pricing → General and renamed the minimums section. Pricing automatically rounds monetary totals to cents and billable distance to 0.01 km. Removed configurable rounding from active billing types/defaults and discard legacy preferences when loading settings. Minimum charges, minimum distance, waiting/hourly billing increments and unit-conversion precision remain intact; persisted quote snapshots are not rewritten.

Validation: 43 pricing, 17 settings and 20 destination-tax tests pass, as do TypeScript and the production build. Regression coverage checks automatic precision, ignored legacy preferences, retained minimums and absent controls. Existing Vite bundle-size advisory remains; no browser verification was rerun.

### September 17: Pricing tab order and General label

Renamed Pricing Defaults to General and made it the initial tab. Pricing tabs now appear in this order: General, Accessorials, Vehicle Pricing, Zones, Rate Cards. Draft preservation and keyboard navigation remain intact.

Validation: all 16 settings tests, TypeScript and production build pass. Updated interaction coverage verifies the order, initial selection and Home/End behavior. The existing Vite bundle-size advisory remains. Browser verification was not rerun.

### September 17: Vehicle Pricing placement reverted

Restored Vehicle Pricing as a Pricing tab and removed its catalogue from Services & Dispatch at the user's request. Service multipliers remain in the service forms. Vehicle settings and saved rates are unchanged. All 16 settings tests, TypeScript and production build pass; the existing Vite bundle-size advisory remains.

### September 17: Vehicle pricing moved to Services & Dispatch

Moved the existing Vehicle Type Pricing catalogue and editor below Services in Services & Dispatch. Removed the Vehicle Pricing tab from Pricing, which now contains Rate Cards, Accessorials, Pricing Defaults and Zones. Existing vehicle surcharges, type limits and saved values are unchanged. Updated the Services & Dispatch description and pricing link.

Validation: all 16 settings tests, TypeScript and production build pass. Existing ownership and tab tests now verify vehicle pricing in Services & Dispatch and its absence from Pricing. The existing Vite bundle-size advisory remains. No browser verification was rerun.

### September 17: Service multipliers moved to Services & Dispatch

Removed the Service Multipliers tab and standalone bulk editor from Pricing. Each Add/Edit Service form now edits its default price multiplier with the service's booking and delivery details; the services table shows the saved multiplier. New services default to 1×. Existing values, including zero, remain intact, and blank/negative/non-finite inputs cannot be saved. Existing rate-card multiplier applicability and overrides still use the same saved service value.

Validation: all 16 settings tests, TypeScript and production build pass. Interaction coverage verifies service editing, zero/decimal persistence, new-service defaults, invalid inputs, catalogue-section isolation and the reduced Pricing tab list. The existing Vite bundle-size advisory remains. Browser verification was not rerun.

### September 17: Customer Groups removed

Removed the Customer Groups Pricing tab, group management, customer-profile group fields/badges, group scope choices and group-based matching/discount inheritance for new quotes. Customer and rate-card discounts remain. Pricing storage schema 4 clears active group configuration and migrates existing group cards to Selected on order, retaining their IDs and rates without making them organization defaults. Customer loading drops retired group memberships. Order-level rate-card selection remains available.

Historical saved quotes remain intact. Hourly settlement retains compatibility with frozen group-selected cards and inherited discounts; legacy types exist only for this compatibility and migration, not active group management. No API schema or authenticated portal changes were made.

Validation: all 105 tests, TypeScript and production build pass. Tests cover group-control removal in Pricing/customer forms, migration stability, manual selection of migrated cards, removed group discount inheritance and preservation of frozen hourly terms. The final 42 pricing tests were rerun after migration adjustments. The existing Vite bundle-size advisory remains. Browser verification was not rerun.

### September 17: Pricing section tabs

Pricing now uses Rate Cards, Accessorials, Pricing Defaults, Service Multipliers, Vehicle Pricing, Zones and Customer Groups tabs instead of one long page with disclosures. Only the active section is visible. Panels stay mounted to retain drafts and unsaved-navigation guards. Tabs support arrow keys, Home/End and horizontal scrolling on narrow screens. Rate Cards retains its adjacent list/editor and pricing-method filter.

Validation: all 14 settings tests, TypeScript and production build pass. The new interaction test covers tab ownership, single-panel visibility, keyboard navigation, independent rate-card/default drafts and saving after tab switches. The existing Vite bundle-size advisory remains. Browser verification was not rerun.

### September 17: Pricing toolbar simplified

Removed the Duplicate and Archive/Restore toolbar buttons and their unused handlers. Moved the All pricing methods filter from the rate-card list to the editor toolbar beside Save Card; it also remains accessible when no card is selected. The new-card method selector and existing status field retain their behavior.

Validation: all 13 settings tests, TypeScript and production build pass. Coverage verifies the removed actions and that the relocated filter still filters and resets the card list. The existing Vite bundle-size advisory remains. No browser verification was rerun.

### September 17: Company tax section title

Renamed Automatic tax to Company tax details to match the company GST/HST information in the card. Updated its accessible section label and existing settings assertion. All 12 settings tests, TypeScript and production build pass; the existing Vite bundle-size advisory remains.

### September 17: Margin Target removed

Removed Margin Target from Operating Costs, billing defaults/types, pricing comparisons, snapshot result types and Order preview/detail props. Order cost displays now use neutral styling without target warnings; estimated cost, profit and actual estimated margin remain informational. Billing configuration loading drops the retired target from older stored settings. Historical snapshot flags are ignored without recalculating saved prices.

Validation: all 100 tests, TypeScript and production build pass. Regressions verify removal from settings, legacy-settings cleanup, unchanged cost/price calculations and neutral Order displays for older snapshots. The existing Vite bundle-size advisory remains. No browser verification was rerun.

### September 17: Editable province tax rates

The province-rate card now has editable percentage fields for supported destinations, saved with Save company & billing. Rates accept decimals and zero within 0–100%; blank or invalid values are rejected even after changing tabs. Saved company overrides persist across reloads and drive new quotes and explicit repricing. Missing overrides retain the supplied defaults. Frozen quotes and hourly settlements retain their quoted rates. Quebec remains marked Review required because GST/QST calculation is not implemented.

Validation: all 98 tests, TypeScript and production build pass. Added coverage verifies draft isolation, persistence, cross-tab validation, zero/decimal overrides, fallback rates, invalid stored rates and frozen hourly/invoice tax. The existing Vite bundle-size advisory remains. Browser verification was not rerun.

### September 17: Separate province-rate section

The Taxes tab now has two separate cards: Automatic tax with the company GST/HST number, and Tax rates by province with the reference table and rate notes. Validation: all 10 settings tests, TypeScript and production build pass. No calculation changes; the existing Vite bundle-size advisory remains.

### September 17: Always add tax to new quotes

Removed the tax-inclusive checkbox. New order previews, quotes, explicit repricing and unquoted finalization now treat entered rates as before tax, ignoring any legacy inclusive-price preference. The shared quote path stores that treatment in the snapshot without mutating billing settings. Saved inclusive quotes retain their frozen calculation during hourly settlement. Renamed the optional invoice field to Company GST/HST number and clarified that it belongs to the delivery company.

Validation: all 94 tests, TypeScript and production build pass. Coverage verifies tax added despite a saved inclusive setting, preservation of historical inclusive hourly quotes, unquoted finalization and removal of the checkbox. The existing Vite bundle-size advisory remains. No browser check was rerun.

### September 17: Automatic tax without registration setup

Removed the Registered / Not registered selector. New supported destination-based quotes always calculate GST/HST, including when legacy settings say Not registered or Unconfirmed. The GST/HST number is optional invoice information and no longer blocks pricing. Province rates and the tax-inclusive price preference remain available. Existing saved quotes, including historical no-tax hourly quotes, retain their frozen treatment. Unsupported destinations and special tax cases retain their review handling.

Validation: all 93 tests, TypeScript and production build pass. Regression coverage checks every legacy registration choice with blank, invalid and populated numbers, removal of the selector, and preservation of historical no-tax hourly settlement. The existing Vite bundle-size advisory remains. Browser verification was not rerun because Chrome launch was blocked by the sandbox in the preceding layout check.

### September 17: Shared page content width

Operational pages, Profile, Help and all Organization Settings pages now use a shared centered 80rem (1,280px) content limit with 24px minimum side gutters. Headers and Profile tabs use the same alignment; backgrounds and scroll areas retain their full width. Monitor remains uncapped, and account portals retain their existing narrower limits.

Validation: `npm test`, TypeScript and production build pass; the existing Vite bundle-size advisory remains. Interactive width checks could not run because the installed Chrome process failed to launch under the sandbox (`setsockopt: Operation not permitted`).

Last updated: **2026-09-14**

Read [spec.md](spec.md) for target behavior and [AGENTS.md](AGENTS.md) for working rules. This file distinguishes observed prototype behavior from planned functionality.

## Current stage

Mixed implementation: the company/customer account milestone uses the FastAPI/PostgreSQL API; the existing Monitor and operational/pricing surfaces remain a local-data prototype. Company/customer routes never mount the prototype or import its browser stores.

## Fixed decisions

React/TypeScript, shadcn/ui direction, `react-map-gl`/`maplibre-gl`, light Clean/Calm/Precise UI, Vancouver map center, FastAPI/PostgreSQL authority, Order/Route/RouteStop vocabulary, AUTO/MANUAL dispatch, centralized API-authoritative pricing, multiple pickups/drop-offs, automatic optimization, POD, and Invoice workflow are target contracts. Existing prototype behavior is not production evidence.

## Implemented

- September 12 pricing revision: shared engine v2 removes routine time billing and automatically retires obsolete saved Base + Distance/Zone minute-rate fields; normal price is independent of travel duration. Hourly contracts define clock boundaries, handling/wait inclusion and actual settlement.
- Waiting uses an explicit `WAITING_RECORDED` trigger, per-stop allowance/rounding/limits by default, and card → accessorial → organization inheritance. Duplicate automatic waiting rules are configuration errors; hourly included waiting is suppressed.
- Fuel uses eligible charge lines; the unused basis selector is removed. Admin / Dispatch Fee has contract applicability. Minimum freight follows the multiplier; the net order minimum follows discounts/adjustments and supports override/waiver. Discount `INHERIT` and `NONE` are distinct, with legacy stored NONE migrated to preserve former inheritance.
- Monetary bases normalize inclusive tax before percentage charges/discounts/minimums; estimated revenue excludes tax. Cost estimates respect zero overrides, distinguish total-service versus driving-only duration, identify handling defaults, and flag incomplete estimates. Unit editors preserve canonical km/kg/cm, including dimensional divisors and distance/weight rates. Currency is read-only pending an explicit monetary-rate migration.
- Organization zone directory/default rates and contract-specific matrices support service-specific prices, explicit organization fallback, and unique supplying-pickup → delivery movements. Missing movement links or rates require attention or the card's explicit Base + Distance fallback.
- Imported freight permits selected modifiers; final agreed totals require tax treatment and bypass modifiers/rounding. Snapshots retain original imports, input facts, rate-card versions, expiry and frozen pricing context. Local order persistence and completion use quoted terms; non-hourly agreed prices and already-final snapshots remain unchanged.
- Booking cutoffs use organization wall time. Shared static assignment validation covers quote expiry, driver availability, maximum active orders, exclusive work, requested vehicle-type weight/volume and liftgate checks. It is used by Orders and the existing recommendation action. Finalization provides a local invoice preview using finalized lines, due dates, billing email and tax registration.

- The default fuel surcharge percentage is edited only in Billing, Tax & Cost → Company & Fuel Charges → Fuel Surcharge; General no longer repeats the field. Rate Card overrides remain available.
- `src/App.tsx` and `src/data/mockData.ts` provide local drivers/jobs/exceptions, Monitor counters, selected entities, on-demand overlays, and simulated recommendation interactions.
- `src/components/TorontoMap.tsx` renders a MapLibre map through `react-map-gl/maplibre`, route/marker layers, and local simulated telemetry. The filename is legacy; the center is Vancouver.
- Monitor chrome exists through Sidebar, TopMetrics, DateControl, MapControls, DriverPopover, JobDetailPopover, and DetailModalDialog.
- Pricing module (static, localStorage-backed): `src/types/pricing.ts` (RateCard, Zone/ZoneRate, CustomerGroup, PricingOrderInput, ChargeLine, PricingSnapshot) and `src/lib/pricingEngine.ts` (`resolveRateCard`, `calculatePricing`, `estimateInternalCost`) implement the five pricing methods (Base + Distance, Fixed, Zone, Hourly, Imported), customer → group → org-service → org-default resolution with conflict/no-match/missing-distance Needs Attention errors, dimensional weight, load/piece/stop charges (routine time pricing removed), service multiplier, vehicle surcharge, fuel-eligible base, accessorial calc types with allowances/increments/min/max/auto rules, contractual and one-off discounts, tax profiles with customer exemption, and an internal-cost/margin estimate. `RateCardsPage` (Rate Cards, Zones, Customer Groups), `PricingServicesPage` (Services with default multipliers, Vehicles with fuel eligibility, Accessorials), `BillingSettingsPage` (org defaults, tax profiles, fuel, operating cost), and Order entry use the shared pricing configuration and engine. `billingEngine.ts` holds only shared helpers.
- `CustomersPage`/`customerStorage.ts` provide local customer directory CRUD-like flows. Profile, Help/Support, and local profile storage also exist.
- `package.json` provides Vite dev/build and TypeScript lint scripts; declared React, TypeScript, MapLibre, `react-map-gl`, Lucide, Tailwind, and Motion dependencies are observed, not proof of production readiness.

## Partially implemented

The static prototype has Monitor/settings/pricing/customer interactions. Orders (`JobsPage`, still typed as the legacy `Job`) now carry `pricingInput` + a frozen `pricing` PricingSnapshot: creation uses the shared `OrderPricingForm` + `calculatePricing`, details show the snapshot via `PriceBreakdown` with Re-price (estimate only) and Finalize (settles permitted hourly clock actuals and locks), mock orders are enriched at load (`lib/orderPricing.ts`), and unpriced orders surface in Needs Attention. Job/Route/Invoice models remain unnormalized (no Order entity, local invoice preview only, no authoritative Invoice issuance). Mock assignment/recommendation actions validate the available static constraints and persist local order state; no backend assignment is issued.

## Specified but not implemented

API integration and tenant authorization for the existing operational dispatcher modules; a normalized Order/Route/RouteStop model (orders are still the legacy `Job` shape with pricing attached); customer-portal Order creation; automatic assignment/optimization and complete route hard constraints; multi-order route optimization/load progression; full Routes, Drivers, Vehicles, Reports, Needs Attention, POD, billing/invoice and tracking workflows; server state/realtime/resync; browser end-to-end tests; and complete operational scenario coverage.

## Known gaps / blockers

The account portal now uses TanStack Query and an OpenAPI-generated typed transport. No operational websocket or general React Router integration is established; the small account route set is explicitly matched. Map rendering is static/demo and does not prove production routing, GPS, traffic, or satellite capability. Existing filenames and legacy terminology must not define the domain. No API runtime or browser end-to-end checks were run for this revision.

## Immediate next priorities

1. Finish Organization Settings and pricing configuration using centralized static state.
2. Finish Order create/edit/details with the shared static pricing engine.
3. Finish Customer details required by Orders/pricing/billing.
4. Finish Monitor AUTO/MANUAL behavior and pricing/dispatch Needs Attention.
5. Finish multi-order Routes and optimized route presentation.
6. Finish Driver/Vehicle operational screens.
7. Finish Billing/Invoice preview and sent states.
8. Exercise all required static end-to-end scenarios.
9. Continue API integration after the company/customer account milestone, with explicit organization mapping and preservation of existing operational data.

## Testing status

The client package declares `npm run lint` and `npm run build`; TypeScript, production build, and the pricing acceptance suite are the required checks for the September 12 revision. `npm test` runs the Node/tsx acceptance suite. No browser end-to-end suite is established. Existing prototype validation must be extended with pricing, dispatch, route, settings, form, Needs Attention, and invoice scenarios.

## September 12 validation and remaining limits

`npm test` passes 39 acceptance and rendering tests. `npm run lint` and `npm run build` pass (Vite retains its bundle-size advisory). The pricing acceptance suite covers zero overrides, unit roundtrips, inclusive tax/margin, waiting inheritance and duplicate protection, hourly settlement, minimum/discount ordering, contract zone matrices and multiple pickups, imports, fuel, duration independence, incomplete costs, shared engine output, frozen terms/final snapshots, timezone cutoff, assignment constraints, invoice preview, and server rendering of edited components. See `tests/pricing.test.ts`.

Follow-up review fixes: tax-inclusive accessorial unit rates and per-stop limits preserve precision until the charge is rounded; eligible customer/group profile card selections win within their level, with normal fallback for missing/ineligible selections; and manual per-minute accessorials appear with a minute input in the Order form while automatic waiting stays separate. Eight added regression tests cover these corrections, exclusive/exempt pricing, contract overrides, selection eligibility/precedence/conflicts, and rendered manual-minute entry. Five of the new tests failed before the fixes; all 35 pass afterward. The production build was verified in an isolated copy of the updated source. Interactive browser QA remains unavailable because the browser could not verify its administrator-enforced access policy.

No connected browser was available for interactive/visual QA. Automatic dispatch/optimization, execution-aware route locking, actual assigned-vehicle/equipment binding and intermediate route capacity, machine-evaluated delivery promises, POD, authoritative invoice issuance/email, late-fee assessment and API integration remain unimplemented. Adjacent UI copy identifies these limits; these are not claims of a production-complete dispatch or invoicing workflow. Currency migration is deliberately disabled, rather than relabeling stored amounts.

## Saved legacy time-charge recovery

Following the user report, pricing storage schema 3 retires obsolete routine minute rates/included minutes from saved Base + Distance and Zone cards, increments affected card versions once, and preserves all other rates, overrides, discounts and hourly contracts. The pricing engine ignores historical routine-time fields instead of emitting the migration blocker. Order loading retries unfinished estimate failures carrying LEGACY_TIME_PRICING; successful quotes, final snapshots, completed orders and invoice-bearing records remain untouched. Recovery is persisted by the existing Order save workflow. Refreshing the app loads the migration and repaired estimates without clearing browser data.

Validation: 39 tests pass, including four new migration/recovery/rendering tests and two updated time-pricing tests that failed before the fix. TypeScript and an isolated production build pass; the existing bundle-size advisory remains. Browser-local data migration is covered with serialized storage fixtures; interactive browser verification remains blocked by the administrator-policy check described above.

## September 14: Pricing Simulator removed

Removed the standalone Pricing Simulator page, its components, desktop/mobile navigation entries, and links from Rate Cards, Services and Billing settings. Order entry retains its live estimate and shared pricing engine. Removed simulator-only stage controls and updated help text and project documentation. Validation: all 39 pricing/rendering tests pass, TypeScript passes, and the production build succeeds in an isolated copy (existing bundle-size advisory remains).

September 14 sidebar copy update: removed the automatic-assignment/route-feasibility prototype notice from the side menu at the user’s request. TypeScript and production build checks pass.

September 14 organization-menu update: swapped Billing, Tax & Cost with Rate Cards & Zones in the desktop and mobile account submenus. Order is Services & Accessorials, Billing, Tax & Cost, then Rate Cards & Zones. TypeScript and production build checks pass.

September 14 contract dropdown update: Admin / Dispatch Fee uses the same shared Select component and label styling as Dimensional Pricing. Inherit, apply and waive values retain their existing behavior. All 39 tests, TypeScript and production build checks pass.

## September 14: Shared shadcn/ui date pickers

Replaced native rate-card effective-date inputs and the Order service-window datetime input with the shared shadcn/ui Calendar + Radix Popover picker. Monitor now uses the same calendar with real month navigation and current Today/Tomorrow shortcuts instead of a fixed December 2024 grid. Monitor date selection remains local UI state. Date-only serialization avoids UTC conversion; service windows preserve organization wall time, including existing ISO instant values. Time controls use custom hour/minute dropdowns, including the service booking cutoff. Optional values can be cleared. Calendar popovers are portalled above drawers and support keyboard navigation, Escape/outside dismissal and focus return.

Added shared Calendar, Button, Popover, DatePicker, DateTimePicker and TimePicker components, date-value helpers, dependency lockfile and upstream source notice. The new components use Dispatra’s existing slate/white styling. Seven interaction/date regression tests cover selection, month navigation, clearing, keyboard/focus, form submission protection, timezone/date roundtrips, service times, shortcuts and Monitor integration. All 46 tests, TypeScript and the production build pass in an isolated copy. The existing bundle-size advisory remains. Visual browser QA could not run because no connected browser was available.

September 14 Route & Schedule layout fix: shortened the duration label to “Estimated duration” so its input aligns with adjacent fields. The cost/planning explanation remains in the section helper text. TypeScript and production build checks pass.

## September 14: Orders, Drivers, Customers and Vehicles property fixes

Implemented the frontend audit against the current Desktop client. Shared `domain/operations.ts` extends the existing local models; `Order` is now the commercial interface and `Job` its Monitor compatibility alias. Audit, branch-ready and future integration fields are typed but branch management remains hidden. No backend contract/runtime was generated or replaced.

- Orders: create/edit/save, lifecycle display/filter separate from risk, searchable references/recipients/tags, CSV with all stops and safe escaping; stable stop reorder/removal, contact/window/service/access/POD/reference fields, item description/unit/handling and pickup/delivery relationships; booking/billing snapshots, payer selection, priority/type, commodity, requirements, communications and internal notes. Existing central pricing and frozen snapshots are preserved; manual card overrides require reasons. Locked/final/executing orders cannot be edited, and versions protect an open edit from stale local records. Monitor popover/details now show the full saved stop list rather than hard-coded two-stop details.
- Drivers: create/edit, number/contact/licence, independent account/duty/work states, skills/areas, qualifications, shifts/availability periods, depot/start point, maximum minutes and notes. Browser persistence now survives reload. Connectivity is derived separately from GPS timestamps; missing timestamps are shown as unknown. Duty toggles no longer fabricate on-route progress. Driver-to-vehicle selection updates the fleet owner and prevents duplicate/in-use asset release.
- Customers: saved locations/contacts, business/person/legal name, payment terms, default service/window/instructions, communication preferences, tags/reference and existing pricing relationship; linked order history/counts. Snapshot contacts remain historical; frozen invoice preview uses the selected payer's email/terms. Save failures are surfaced.
- Vehicles: create/edit, normalized type, plate province/year, separate status/availability, volume and dimensions alongside payload/pallet constraints, equipment/areas/depot and unavailable period/reason. Removed decorative fuel/odometer/maintenance controls from these workflows; legacy data remains intact. Empty saved fleets stay empty.
- Shared validation checks IDs, duplicates, numeric values, contacts, windows, movement dependencies, overrides and entered dispatch requirements. Single-order intermediate weight/volume/pallet load and upright item fit are checked. Multi-order route optimization remains unimplemented.

Validation: TypeScript, production build and 64 tests pass (39 pricing, 7 date, 14 entity/domain/storage and 4 form interaction tests). Browser review covered Orders, new order layout, independent lifecycle/risk badges, driver editor layout and keyboard dismissal, vehicle capacity/editor layout, and customer saved-location/defaults layout. Legacy Preferred customers migrate to Active with a Preferred classification tag. Vite retains its existing large-bundle advisory. Saved data migration is tested with serialized fixtures; no customer browser storage was cleared.

Limits: This remains a local-data frontend. Stop planned/actual timestamps, normalized address/coordinates, metadata and audit fields are model-ready; telemetry/execution providers supply them later. Temperature/qualification-expiry/branch management remain deferred. No real notifications, POD collection, authoritative invoices, API integration or combined-route feasibility is claimed. Unknown legacy values and ambiguous multi-stop allocations are left unset for review, rather than guessed.

September 14 Order Details border fix: the Order Details box now uses the same light slate border as adjacent sections, and horizontal item dividers use the matching subtle slate separator color. TypeScript and production build checks pass.

September 14 Order Details dismissal: clicking the backdrop closes the details drawer. Clicks within the drawer keep it open; existing close controls and Escape handling remain available. TypeScript, entity-form interaction tests and the production build pass.


## September 14: Company/customer account milestone

Added `/platform`, `/{company}/dispatch`, and `/{company}/customer` account surfaces, with optional `/login` and company `/settings` routes. Platform owners provision companies and initial dispatcher credentials. Dispatchers create customer records and access credentials, copy transient login details, and reset passwords. Customer login has no signup or forced password-change gate; customers complete contact name/email/phone/address and optionally change their password in Account settings.

The account UI uses shadcn Button, shared accessible form controls, loading/error/empty states, TanStack Query, generated OpenAPI schema types and centralized transport. Authenticated responses are never persisted to browser storage. Profile updates use versions and stable retry keys; customer identity/role/company are server-controlled. Logout clears the account cache. Initial/reset credentials are only in component/mutation memory, with no persisted plaintext. The dispatcher list reads back profile changes made by the customer.

The existing local dispatch prototype remains at `/` and `/prototype`. It is not mounted on authenticated tenant/customer routes. Its full customer editor and saved browser data are preserved. The new company dispatch route currently covers account management only; integrating the existing operational screens and full customer field set is future work. Customer order viewing/booking, tracking, POD/invoices and native driver changes are not part of this milestone.

Added React type definitions and corrected the existing map attribution option/test event type that they exposed. Compatible Express/body-parser/qs dependency patches resolve the three reported npm advisories. The portal is split from the large map/prototype bundle.

Verification: actual PostgreSQL API isolation/account tests and a real Chromium owner → dispatcher → customer journey. Desktop/mobile customer screenshots were reviewed. TypeScript, the existing 64 tests and production build pass; the existing large prototype-bundle advisory remains. The 16 API tests and deployment limitations are recorded in [milestone verification](../api/MILESTONE.md). No production deployment or external email sending occurred.

## September 17: Organization Settings simplification

Replaced the previous settings navigation with three destinations: **Services & Dispatch**, **Pricing**, and **Company & Billing**. Each uses clear sections rather than nested tabs. Services and the existing maximum-active-orders policy live together. Pricing owns named rate cards, Accessorials, zones, service multipliers and vehicle pricing. Regional preferences, invoice terms, taxes and optional internal costs live under Company & Billing. The Auto/Manual control remains on the Monitor sidebar.

Rate cards now open in a focused editor with one pricing method per card. Creation offers Base + Distance, Fixed per delivery, Zone to zone, and Hourly / dedicated. Existing imported cards remain editable and duplicable; their stored contract semantics are preserved. Relevant primary rates and method-essential terms are visible immediately. Additional settings are collapsed and summarize configured exceptions. New cards are persisted only on Save; navigation protects unsaved changes. Existing card versions, historical quote/invoice snapshots and shared pricing calculations are retained.

Services, Accessorials and vehicle types use compact editable tables. Service price multipliers are managed under Pricing. Optional tax profiles, charge limits, pricing defaults and costs use disclosures. Saving a settings section merges its edited fields with the latest browser configuration, avoiding overwrites of unrelated settings. Explicit zero multipliers and waived contract overrides are preserved. Organization-menu click behavior and narrow-screen settings layout were corrected.

Validation: all 73 tests pass, including nine new settings interaction regressions covering ownership/navigation, card creation and cancellation, hidden exceptions, method-specific fields, unsaved changes, independent settings saves, Accessorial limits, zero multipliers and imported contracts. TypeScript and production build pass in an isolated copy; Vite retains the existing large-bundle advisory. Browser review covered all three pages, the rate-card editor, account navigation, and Pricing at desktop and 390px width.

This changes the existing operational prototype at `/` and `/prototype`. Authenticated company/customer account surfaces and API contracts are unchanged. Real automated dispatch, combined-route optimization, tracking integrations, POD collection and authoritative invoice sending retain the previously recorded implementation gaps. No browser data was cleared and no production deployment occurred.

### September 17: Settings layout correction

Removed the duplicated Organization Settings navigation from every page header. The three destinations now appear only in the account submenu. Restored the original Rate Cards presentation: selectable card tiles on the left and the selected editor alongside on desktop, stacked on narrow screens. Cards retain their method/scope/status/version badges, and the first available card opens immediately. One pricing method per card, Accessorials under Pricing, and existing saved settings remain intact. Switching cards protects unsaved card edits without discarding other open settings sections.

Verification: 73 tests passed, with the settings tests updated to reject duplicated header navigation and cover adjacent card selection, cancellation and unsaved switching. The nine settings interaction tests, TypeScript and production build passed after the final adjustments. Browser review confirmed card tiles and the adjacent editor, and the absence of duplicate header tabs.

### September 17: Company & Billing tabs

Company & Billing now uses General, Invoicing, Taxes, and Operating Costs tabs instead of one long page. General contains units and timezone; Invoicing contains payment terms and quote validity; Taxes contains registration, inclusive-tax treatment and tax profiles; Operating Costs contains internal cost estimates and margin targets. Only the active section is displayed. The shared draft survives tab switches, and Save company & billing saves edited fields across all tabs. Account submenus are not repeated as page tabs.

Validation: 74 tests, TypeScript and production build pass. A new interaction regression verifies tab ownership, keyboard navigation, draft retention and saving changes across all four tabs. Browser review verified General and Invoicing layouts. Existing calculations and stored values are preserved; the existing Vite bundle-size advisory remains.

### September 17: Automatic destination tax and simplified Taxes

New orders now enable destination-based GST/HST in the shared pricing engine. Recognizable province/postal details are extracted from typed addresses; explicit country/province confirmation handles incomplete locations. Address changes clear stale jurisdiction and coordinates. The estimate shows the resolved destination/treatment. Ordinary supported domestic freight uses the current versioned rates; unsaved tax/profile controls do not participate. Registered companies must supply a correctly formatted GST/HST number, and registration status must be confirmed. Not registered means no GST/HST collection, distinct from customer exemption.

Tax review errors leave orders in Needs Attention, prevent assignment and invoice preview, and display an unavailable total instead of a misleading zero. Review cases include conflicting/missing locations, Quebec, cross-border/special freight, imported pricing, claimed exemptions, mixed-province charge allocations, and unsupported historical dates. See [scope and sources](automatic-tax.md). This is local jurisdiction extraction, not third-party geocoding/address validation. Rates are versioned in code rather than fetched live.

Taxes is now one card with registration status/number and inclusive-price preference. Removed profile management and the misleading customer tax-profile selector; stored legacy profile values are retained. Historical orders without destination mode keep their profile behavior. Saved quote context includes the destination decision/rules and registration; hourly finalization reuses it and rejects changed quoted destinations. Existing finalized prices remain intact.

Verification: 90 tests covered across the regression suites, including 15 destination-tax tests and an order-form address-change interaction test. Creation/save verifies a BC order reaches Ready for dispatch with its tax decision persisted. Tests cover supported province rates, inclusivity, country/province conflicts, mixed stops, exceptions, registration, unchanged historical quotes/invoices and hourly settlement. TypeScript and production build pass after the final display fix; the existing Vite large-bundle advisory remains. Browser review covered the simplified Taxes tab and new-order review messages. No browser data was cleared, API schema changed or production deployment performed.

### September 17: Consistent page headers and fleet tables

Orders, Drivers, Vehicles, Customers, Reports, Profile, Help and all Organization Settings pages now share one PageHeader with consistent title size, spacing and Back to Monitor placement. Headers and content align at the same left edge. Non-Monitor mobile pages collapse the sidebar and place the menu control at the top right; obsolete hidden-sidebar header padding was removed. Company & Billing and Profile tab rows no longer have a horizontal divider. Removed the redundant Unsaved changes label and No tax profiles to select sentence; Save availability, saved confirmation and unsaved-navigation protection remain.

Drivers now use the existing table exclusively. Vehicles use a compact table with unit/model, plate, type, status, capacity, assigned driver and equipment. Both expose a visible Details button and row click to open the existing full record panel, retaining editing and related operations.

Verification: all 92 tests pass, including two new interaction tests for default table views, Details panels, Escape and focus return. TypeScript and production build pass; the existing bundle-size advisory remains. Browser review covered desktop Drivers and Vehicles, Taxes without the divider/redundant labels, and 390px mobile layout. No data migration, API change or deployment was performed.

### September 17: Visible province tax defaults

Company & Billing → Taxes now shows one row for each of the 13 provinces and territories, with its tax type and default rate. The table and destination-based order pricing share one central rate list, replacing the inline rate selection. Rates remain automatic and read-only; registration and inclusive-price controls remain editable. Quebec is explicitly marked GST + QST / Review required because automatic QST remains unsupported. The page links to the CRA rate source.

Validation: all 92 tests, TypeScript and production build pass. Existing destination tests verify rates for all 12 supported provinces/territories and retain Quebec review behavior. The billing-tab test verifies all 13 rows and representative rates/review labels. Desktop and 390px browser checks confirmed the table layout. The existing bundle-size advisory remains. No persisted data or historical quotes were changed.
