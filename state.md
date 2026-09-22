# Dispatra Web Client Implementation State

### September 22: Layered arrival and morning brief after the intro

When the Monitor intro flight lands, the map now assembles in sequence instead of appearing at once: stop markers drop in (staggered), then driver markers slide on, then the route lines fade in through a MapLibre paint transition, and a brief card settles below the metrics — "Good morning/afternoon/evening, <first name>" with today's order count, drivers on duty and items needing attention (`MonitorBrief`, auto-dismisses after 9 s or via ×). `useMonitorIntro` drives the phases (`arrival.ts`: stops 0 ms, drivers 500 ms, routes 950 ms, brief 1500 ms, done 2300 ms) and exposes them through `ArrivalContext`; markers carry `data-arrival-item` with a stagger index and `mapIntro.css` animates them only while the stage carries `data-arrival`; `TorontoMap` scales route `line-opacity` by the reveal phase. Skipped intros and repeat visits open on the live map with no sequence; reduced motion skips the animation but still shows the brief. Fixed during verification: the sequence timers were cleared on each phase change, which stalled at "routes" — the effect is now keyed on a one-shot landed flag. spec.md updated.

Validation: monitor intro 10/10 (new test drives the phases with a timer stub that honours clearTimeout, confirms the brief and its dismissal, and that a skipped intro runs no sequence; the reduced-motion test now asserts the brief still shows), navigation 6/6, appearance 10/10, login 3/3. TypeScript and production build pass. Chrome check shows the brief card with live numbers after the intro; the marker/route animation could not be observed in the preview pane because it has no WebGL.

### September 22: Dispatcher sign-in gate

Added a Sign in page for the local dispatch workspace (`src/pages/LoginPage.tsx`, styled like the app: brand mark, title, email and password, one primary action, inline error) and a local session store (`src/lib/sessionStorage.ts`, `dispatra_session_v1`). `Root` now gates every prototype URL: without a session the URL is replaced with `/login` and the Sign in page renders; signing in stores the session and lands on the Monitor (`/`); a signed-in dispatcher opening `/login` is redirected to `/`; Logout in the account menu (`onLogout` threaded App → Sidebar) clears the session and returns to `/login`. Sign-in accepts the prototype's single dispatcher login — `dispatcher@dispatra.com` / `123456` (`DISPATCHER_CREDENTIALS`, email case-insensitive) — with an "Incorrect email or password." error otherwise; real credentials belong to the API's auth, which the portal already uses. The default profile email is now dispatcher@dispatra.com. Portal routes are untouched. spec.md updated.

Validation: new `tests/login.test.ts` (3 tests: session rules and persistence; login page errors/success; Root gate, redirect and signed-in `/login` redirect) registered in `npm test`; navigation 6/6, appearance 10/10, monitor intro 9/9, list pages 5/5. TypeScript and production build pass. Chrome check: `/orders` → `/login`, wrong email error, sign-in → Monitor as Sarah Kowalski, Logout → `/login` with the session cleared.

### September 22: Six order statuses with attention flags

Collapsed the order lifecycle to NEW → ASSIGNED → IN_PROGRESS → COMPLETED → INVOICED plus CANCELLED (`OrderLifecycle`, `ORDER_LIFECYCLE_LABELS`). Exceptions are no longer statuses: `orderAttention` derives flags — Pricing needs review (price not produced), At risk, Late start, Failed attempt — that overlay the status, appear as amber notes beside the status pill in the Orders list, back a "Needs attention" filter option, and are exported in the manifest column. Retired values on older saved orders (DRAFT, SUBMITTED, PRICED, READY_FOR_DISPATCH, NEEDS_ATTENTION → NEW; IN_EXECUTION → IN_PROGRESS; BILLING_FINALIZATION → COMPLETED; FAILED → CANCELLED) normalise on load via `normalizeLifecycle`. New orders start NEW (or ASSIGNED with a driver); assignment, editing and invoicing checks use `orderClosed`. spec.md §2 updated.

Validation: entities 16/16 (legacy mapping and flag derivation), entity forms 12/15 (documented failures only), order vehicle 4/4, list pages 5/5, monitor intro 9/9, quotation 5/5, navigation 6/6. TypeScript and production build pass. Chrome check: seeded IN_EXECUTION and READY_FOR_DISPATCH orders show In progress and New, flags render beside statuses, the status filter lists the six statuses plus Needs attention, and that filter returns only flagged orders.

### September 22: Invoice action for completed orders

Orders that are completed but not yet invoiced show an Invoice action in the list's Actions column. `src/lib/invoicing.ts` owns the step: `invoiceState` (NOT_READY / READY / INVOICED) and `invoiceOrder`, which finalises the frozen quote (`finalizeOrderPrice`, locking the snapshot as FINAL), records the invoice preview (due date from the shipper's payment terms, the shipper's single email) and marks the order INVOICED with `invoicedAt`; the list then shows Invoiced and the action disappears. Issuing and emailing the invoice remain for the billing API; a notification states the total and recipient. Open dialogs for the order refresh.

Validation: entity forms 12/15 (new test covers readiness, finalisation, the invoice record, the list action and the Invoiced label; the three documented failures remain). TypeScript passes. Chrome check on a completed order: Invoice → Invoiced, price stage FINAL, invoice preview stored, action gone.

### September 22: Delete actions for drivers and vehicles

Drivers and Vehicles tables gained the same trash action Shippers already had, with the shared confirmation dialog. Deleting a driver is refused while active (non-completed) orders are assigned to them; otherwise it removes the profile and releases their attached vehicle (`onDeleteDriver` in App via `bindDriverVehicle`). Deleting a vehicle is refused while it is attached to a driver; otherwise it removes the fleet record. Completed orders keep their history in both cases. Open details dialogs for the deleted record close.

Validation: entity forms 11/14 (new test covers both refusals and both deletions; the three documented failures remain), list pages 5/5, settings 67/68 (documented), entities 16/16, navigation 6/6. TypeScript passes.

### September 22: Confirmation dialog restyled

`ConfirmDialog` now follows the shared dialog language: the same surface and 24px padding as other popups, an 18px title with the message beneath it (no icon badge or two-column layout), and the shared `Button` outline Cancel and primary/destructive confirm in a right-aligned row. Roles, ids, initial focus, Escape/Tab handling and the confirm/cancel labels are unchanged.

Validation: settings 67/68 (documented), entities 16/16, list pages 5/5; TypeScript passes. Chrome check on Delete shipper.

### September 22: Owner-operator payout terms

Choosing Owner-operator on the driver form reveals two fields under Employment: Driver share of order price (% of the freight and service price, before fuel and tax; default 70) and Driver share of fuel surcharge (default 100, since the driver buys the fuel). They are stored as `revenueSharePercent` / `fuelSurchargeSharePercent` on the driver record, validated to 0–100 for owner-operators, hidden for employees, and never affect the shipper price. spec.md updated.

Validation: entity forms 10/13 (new test: fields appear only for owner-operators, defaults, invalid range blocked, saved values), entities 16/16. TypeScript passes. Chrome check shows the fields appearing on switching to Owner-operator.

### September 22: Shipper form restyled

The Shippers add/edit dialog is titled New Shipper / Edit Shipper and uses the shared form-section pattern: Shipper (name, type, contact name, phone, email, status when editing), Location (Warehouse Address, Service Area — renamed from Delivery / Warehouse Address and City / Service Area), Billing (rate card and payment terms with short hints; the former grey Pricing Relationship box is gone). A shipper now has a single email and phone: the Billing email field and the details-dialog row are removed, quotations, invoice previews and order snapshots use the shipper's email, and the legacy `billingEmail` field is kept on stored records only for compatibility, Discount and Instructions, with Create Shipper / Save Changes in the dialog footer. Accessible names, placeholders, generated codes and saved data are unchanged. spec.md updated.

Validation: settings 67/68 (documented shipper-wording expectation only), entities 16/16, entity forms 9/12 (documented). TypeScript passes. Chrome check shows the grouped form and footer action.

### September 22: Vehicle Types tab on the Vehicles page

Vehicles now has two local tabs, Vehicles (fleet summary, filters and table, selected initially) and Vehicle Types (the shared catalogue section with add/edit, surcharge, type limits, running cost and the status toggle), so types are managed where the fleet lives; type edits refresh the fleet tab's type filter and columns. The Vehicle Type form drops the quick-preset row, labels the notes field "Description", and no longer shows the active checkbox — new types start active and existing ones keep their status (the list's Active/Inactive action still toggles it). `useEntityDialog` now binds to the topmost stacked dialog and only handles Escape/Tab while it is topmost, so a form opened over another dialog closes on its own. spec.md updated.

Validation: settings 67/68 (new coverage for the tab, opening the type editor from it and Escape scoping; the remaining failure is the documented shipper-wording expectation), entity forms 9/12 (documented), entities 16/16, unitDefaults 7/7, appearance 10/10. TypeScript passes. Chrome check shows both tabs, the catalogue table, and the Add form without presets or the active checkbox.

### September 22: Register Vehicle relies on the vehicle type

The Vehicles add dialog is titled "Register Vehicle". The shared `VehicleEditor` is grouped into Vehicle (unit number, required type with its limits shown beneath, make/model, year, plate, province), Status (record status, availability and unavailability details — editing only) and Equipment (equipment tags, description). Payload, pallet capacity, cargo volume and cargo dimensions are no longer entered per asset: on save the asset takes payload, pallets and volume from its vehicle type, so assignment feasibility checks keep working and the type remains the single place these limits live; stored cargo dimensions are kept untouched. spec.md records the rule.

Validation: entity forms 9/12 (rewritten coverage: registration hides status and capacity inputs and inherits type capacity; editing exposes status and re-derives capacity; details dialog opens the editor — the three documented failures remain), unitDefaults 7/7 (type limits shown in company units, stored dimensions survive an edit), entities 16/16, settings 66/67 (documented). TypeScript passes. Chrome check shows the Register Vehicle form with type limits appearing after choosing a type, and the edit form with the Status group.

### September 22: Add Driver form reorganised

The Drivers add dialog is titled simply "Add Driver" and the shared `DriverEditor` is now grouped into titled sections — Contact (name, phone, email; the driver number is assigned in the background as the next D-number via `nextDriverNumber`, becomes the record id, and is never entered — the API will own this later), Status when editing (account, duty) and Assignment (employment full-width, attached vehicle beside maximum active orders, service areas full-width) — with placeholders and one-line hints in place of the previous paragraphs. The shared field primitives in `entities/Fields.tsx` (`TextField`, `NumberField`, `Choice`, `TagsField`, plus a new `FormSection`) use the app label style with optional placeholder and hint, so the Vehicle editor picks up the same look. Save sits in the dialog footer for both Add Driver and Register Vehicle. Accessible names, validation, the per-driver order limit and saved data are unchanged.

Validation: entities 16/16, settings 66/67 (the documented shipper-wording expectation), entity forms 9/12 (new test covers the generated number and the absence of a number field; the three documented failures remain). TypeScript passes. Chrome check shows the two sections aligned in the form dialog with the footer Save, and creating a driver assigns D32 after the seeded D31.

### September 22: One dialog shell for every popup

Added a shared modal shell (`src/components/ui/Dialog.tsx`: `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`, backed by `app-dialog-header/body/footer/close` classes in `controls.css`) and moved every popup onto it: Orders (details, New/Edit Order), Drivers (profile, Add Fleet Driver), Vehicles (dossier, Register Vehicle Asset), Shippers (details, Add/Edit Shipper), and the Pricing catalogue modals (Service, Vehicle Type, Accessorial). All now share the same surface, width per role (`form` / `md` / `lg` / `xl`), gutters (header 24px sides with 20/16px vertical, body 24px sides and bottom, footer 24×16px), one close control (top-right X, `Close dialog`), one entrance animation, and `Button` primary/outline in footers. The Monitor dossier dialog keeps its own views but uses the same header/footer gutters, close control and secondary button style, and its tinted header/footer bands are gone. Per the user, dialogs no longer carry Cancel or Close footer buttons — the X closes them; the confirm prompt keeps Cancel because it has no X. Shipper details body sections use the same bordered-section / borderless-grey-tile language as Order details.

Validation: appearance 10/10, monitorIntro 9/9, navigation 6/6, entities 16/16, listPages 5/5, orderVehicle 4/4, quotation 5/5, datePickers 7/7, unitDefaults 7/7, fuel 8/8; settings 66/67 (the remaining failure expects "No customers are attached" while the workspace's uncommitted RateCardsPage now says "No shippers", unrelated to this change); entity forms retain the three documented obsolete expectations. TypeScript and production build pass. Chrome checks cover Order details, New Order, Shipper details, Add Shipper and the Monitor roster dialog.

### September 22: Order details mirror the Order form

Rebuilt the Orders page details dialog so it shows only what the New Order form collects, in the same section order as bordered section cards on the white dialog body, with borderless grey inner groups for stops, packages and accessorials: Customer & Service (customer with phone, service, priority); Stops as plain groups with address, zone when priced by zone, contact name, phone, Ready at / Deliver by and a Residential marker; Packages as the divider-free grid (qty, weight, L × W × H in company units, fragile); Accessorials with their rates; Dispatch (driver selector, handling instructions); and Price (the frozen PricingSnapshot breakdown). Removed the at-risk banner, the read-only field list (status, type, references, commodity, bill-to, skills, equipment, tags, notes, version, source, tracking), per-stop operational fields, the Cargo & Handling card, the invoice preview, the standalone-route note, and the Re-price and Finalize actions with their handlers; Edit order and Locate on Monitor Map remain. Stored order data, pricing snapshots and the driver assignment validation are unchanged.

Validation: orderVehicle 4/4, entities 16/16, quotation 5/5; entity forms retain the three documented obsolete expectations. TypeScript passes. Chrome check confirms the dialog sections, aligned label/value pairs, the packages grid in lb/in and the driver selector on an existing order.

### September 22: Send as quote is a menu; the quotation is a PDF

Replaced the quotation preview popup with a compact menu anchored to the Send as quote button (shared `FloatingPanel`): it shows the customer's name and the email the quote goes to (billing email, falling back to the main email), and two actions. **Download** saves `Quotation-<number>.pdf`. **Email** saves the same PDF and opens the mail client with the templated message (greeting to the contact, reference to the attached file, booking instruction) — `mailto:` cannot carry attachments, so the dispatcher attaches the saved file; the menu says so. A customer with no email sees an inline note and a disabled Email action. The menu closes after either action and a notification confirms it. The PDF is produced in-app by a small writer (`src/lib/pdf.ts`: Letter pages, Helvetica/Helvetica-Bold with AFM widths for right-aligned amounts, rules, JPEG images, pagination, valid xref) with no new dependency; `quotationPdf` lays out company block and logo (any logo data URL is re-encoded to JPEG on a canvas in the browser), quote identity, Prepared for / Service, stops, items in company units, charge lines with details, subtotal, tax and total, and terms. Engine details that fall back to raw stop ids are shown to the customer as Stop 1 / Stop 2. The earlier HTML download and `QuotationDialog` are removed.

Validation: 5 quotation tests (builder/text/mailto with stop-id substitution, menu contents and Escape scoping over the order form, Email hand-off and Download payload, PDF structure incl. xref offsets/pagination/width table, no-email state); TypeScript and production build pass. poppler validates PDFs generated both in Node and from the live browser (with an embedded logo) and rasterises them correctly; Chrome check confirms the menu, a 3.7 KB `application/pdf` download starting `%PDF-1.4` with the quote total, and the mail hand-off with the app staying in place.

### September 21: Starter zones and prices on the Zone to zone card

Per the user's request, new pricing configurations start with three zones — Zone 1 (V5Y 1V4), Zone 2 (V5G 1M2), Zone 3 (V3T 1V8) — and the pickup → delivery matrix in CAD with one 500 kg band per cell (1→1 $30, 1→2 $45, 1→3 $65, 2→1 $45, 2→2 $30, 2→3 $50, 3→1 $65, 3→2 $50, 3→3 $35). The matrix is the standard zone prices and the seeded Zone to zone card's own rates, so new zone cards pre-fill from it. Pricing schema version 11 merges the starters once into any saved configuration missing them: the three zones are added, starter prices are added only for pairs not already priced (standard prices and every active zone card), and an older zone that merely shares a starter's name — such as a user-created "Zone 1" — is replaced by the starter together with its prices (user decision). Other zones, prices, archived cards and frozen quotes are untouched. (Version 9 only filled configurations with no zones at all; version 10 matched starters by id and could leave two zones named Zone 1.) spec.md updated accordingly.

Validation: settings 67/67 (updated starter-zone test covers fresh defaults, one-time fill and a custom-zone config left alone), pricing 63/64 (only the documented Special handling minutes expectation), entityForms 8/11 (documented), unitDefaults 7/7. TypeScript passes. Chrome checks confirm the Zone to zone card shows the three zones, postal codes and nine prices from a fresh config and from a saved schema-8 config with an empty card, and a New Order for Pacific Fresh Logistics prices Zone 1 → Zone 2 at $45 + fuel + GST = $60.72 CAD.

### September 21: Saved metric units migrate to pounds and inches

Company settings saved before the pound/inch defaults still loaded as kg/cm because the loader preserved explicitly stored units. `loadBillingConfig` now replaces stored `kg` → `lb` and `cm` → `in` once when no `unitsDefaultVersion` marker exists; `saveBillingConfig` records the marker so a later deliberately chosen kg/cm remains an explicit choice. Distance, stored rate cards, canonical order measurements and frozen quotes are untouched. The seeded Heavy Item Handling accessorial description also reads "over 150 lb", with a migration for the earlier "70 kg" wording.

Validation: unitDefaults 7/7 (new coverage for the one-time migration and marker), settings 67/67, fuel 8/8; TypeScript passes. Chrome check with an old kg/cm record seeded in localStorage confirms the Order form packages grid, Vehicles page and Company → Regional Preferences all show lb/in after reload.

### September 21: Cleaner Packages grid and Accessorials on the Order form

Packages keeps one row per package but now renders, inside a bordered card matching the stop cards, as a divider-free editable grid: a new `app-table-plain` modifier on the shared table hides row separators and hover bands, tightens header/cell padding, and hides number spinners inside the grid so quantities, weight and L × W × H stay legible at fixed column widths (Qty 4rem, Weight 6rem, dimensions 4rem each, Fragile centred, Remove right-aligned). The grid fits the panel at desktop width and scrolls inside its own container on narrow screens. Accessorials remains the spec's collapsed section but is now styled like the other numbered panels: a Tag icon and `{n}. Accessorials` title, a summary line naming the selected charges (or "No extra charges added."), the selected total beside the chevron, and inside a bordered card (matching the stop cards) a two-column `app-choice-row` checklist with the name on the left and price right-aligned. Accessorial data, per-order fixed charges and existing accessible names are unchanged.

Validation: orderVehicle 4/4, entities 16/16, quotation 3/3, unitDefaults 6/6, appearance 10/10; entity forms and pricing retain only the four documented obsolete expectations. TypeScript passes. Chrome checks confirm no horizontal overflow of the dialog at 1440×1000, no clipped digits in any package input, the selected accessorial appearing in the summary with its total and in the live estimate, and at 375×812 the checklist stacking to one column with the package grid scrolling inside its container only.

### September 21: Aligned stop cards on the Order form

Redesigned each stop card in the New/Edit Order dialog as a labelled two-column grid: the stop badge, Residential checkbox and Remove action form the card header; the address spans the full width (sharing the row with Zone on zone-priced customers); Contact name and Phone are equal columns; Ready at / Deliver by sits on its own full-width row with the date picker and a fixed-width time group so HH:mm no longer collapses. Placeholder-only fields gained visible labels (`app-label`) while retaining their existing accessible names, so tests and assistive technology are unchanged. The shared `DateTimePicker` now reserves an 11rem time column for all its users.

Validation: orderVehicle 4/4, entities 16/16, quotation 3/3, datePickers 7/7, appearance 10/10; entity forms and pricing retain only the four documented obsolete expectations. TypeScript passes. Chrome checks at 1440×1000 confirm the address, contact and date controls share one left edge, address/phone/time share one right edge, contact and phone columns are equal and every control is 40px; at 375×812 all fields stack to one width with no horizontal overflow.

### September 21: Send as quote from New Order

Added a **Send as quote** action to the New/Edit Order dialog's live estimate header, shown only once the estimate is PRICED and a customer is selected. It opens a quotation popup layered above the order form: company details and logo, quote number (Q-yymmdd-nnnn), issue date and validity (from the snapshot's `quoteExpiresAt`), Prepared for, service/vehicle/schedule/distance, stops, items in company units, the engine's charge lines, subtotal, tax lines and total. The popup pre-fills To with the customer's billing email (falling back to email) and an editable message; Send email validates the address and hands a `mailto:` link with subject and plain-text body to the mail client, with a confirmation notice; Copy text copies the same body. `src/lib/quotation.ts` builds the quotation from `PricingOrderInput` + `PricingSnapshot` + `PricingContext` only, so the quote mirrors the engine's numbers. The dialog owns capture-phase Escape/Tab handling so closing it never closes the order form. No server-side email exists; this is a local mail-client hand-off.

Validation: 3 new quotation tests (builder/text/mailto in lb/in units, button visibility and popup open/close over the order form, invalid-address guard and mailto hand-off) pass; orderVehicle 4/4, entities 16/16, unitDefaults 6/6, appearance 10/10. TypeScript and production build pass with the existing bundle-size advisory. Chrome checks at 1440×1000 and 375×812 confirm the button, popup layout, pre-filled recipient, validation error, Send notification and Escape scoping; mobile has no horizontal overflow. Routing is not connected, so a Fixed-price Default card was seeded in the browser to reach a priced state.

### September 21: Distance pricing uses distance only

Removed Included Weight, Weight Rate and Dimensional Weight from the Distance card. New Distance base freight uses Base Fee plus distance beyond Included Distance at Distance Rate. Current calculations explicitly ignore stored legacy weight rates and divisors, including invalid divisors, while preserving those stored values and all original quote amounts. New snapshots freeze distanceWeightMode NONE; historical settlement retains legacy terms. Package weights and dimensions remain available for operational capacity; Zone per-movement actual/dimensional weight band selection is unchanged. Formula and order summaries now show actual package weight without suggesting it affects Distance pricing. Service charges, fuel, Accessorials, discounts, minimums and tax retain their existing rules.

Validation: all 67 settings tests and 8 fuel tests pass; pricing passes 63/64, including new coverage for heavy/bulky packages, invalid retired divisors, frozen historical weight charges and explicit repricing. The single pre-existing pricing failure still expects the removed Special handling time minutes control. TypeScript and production build pass with the existing bundle-size advisory. Browser visual verification was unavailable in this task. Changes apply to the local pricing prototype; backend pricing integration remains outstanding.

### September 21: New Orders derive vehicles from drivers

Removed the Vehicle selector from New Order, leaving Customer and Service in two aligned columns. Selecting a driver derives the pricing vehicle type from that driver's current fleet asset through a shared adapter, updating the unsaved estimate and saved initial quote. Changing/clearing the driver replaces/clears the derived type. New unassigned orders store null rather than an arbitrary first catalogue vehicle, so they carry no vehicle surcharge. Existing order editing retains its stored type and explicit pricing control.

Later assignment retains the existing rule that saved quotes do not silently change. For orders without a requested pricing vehicle, assignment now uses the driver's attached vehicle type for the existing active/type-capacity/liftgate checks. Physical asset availability, ownership, qualification and load checks remain intact. Missing attached assets still block assignment. No pricing formulas or historical snapshots changed. The optional pricing-policy question received no response; the existing explicit-repricing policy was preserved.

Validation: all 4 new order-vehicle tests and all 16 entity tests pass. Coverage includes unassigned creation with no guessed surcharge, driver changes and the saved vehicle surcharge, clearing selection, rejection of a driver without an asset, and later assignment checks without quote mutation. TypeScript and production build pass, with the existing bundle-size advisory. Broader suites retain the four documented obsolete expectations: entity forms pass 8/11 (old estimate, Route distance and Priced on labels), pricing passes 61/62 (Special handling time minutes). Desktop and mobile Chrome checks confirm the selector is absent, Customer/Service align or stack correctly, driver selection works and Escape closes the dialog; screenshots were inspected. Tests used isolated local data, preserving existing workspace edits and saved user records.

### September 21: Smaller, flatter summary cards

Refined the existing summary cards across Orders, Drivers, Shippers, Vehicles and Analytics following feedback that they were oversized. Removed icon background boxes and shadows, placed 16px line icons directly beside labels, reduced totals from 28px to 22px, tightened padding to 12px vertically/14px horizontally and reduced gaps to 8px. Cards retain their subtle outlines and table alignment. CSS subgrid aligns labels, values and optional notes within each row when text wraps. Saved data, counts and interactions are unchanged.

Validation: 5 list/Analytics interaction tests and 10 appearance tests pass; TypeScript, production build and diff checks pass. Final Chrome checks cover all five pages at 1440×1000 and 390×844 with no page overflow and preserved search/clear behavior. List cards measure 79px on desktop (previously about 120px); Analytics headline cards measure 104.5px (previously about 151px). Inspected desktop and narrow card layouts, including wrapped labels after alignment changes. The existing bundle-size advisory remains. Remote driver portraits were excluded from local visual checks. The public ChatGPT page did not expose a comparable signed-in card view, so no exact visual match is claimed.

### September 21: Summary icons and Analytics card consistency

Added contextual Lucide icons to summary cards on Orders, Drivers, Shippers and Vehicles. The shared card component renders consistent 18px neutral line icons on soft 32px backgrounds beside each label; icons are decorative for assistive technology. Numeric values retain their existing formatting, and formatted strings plus optional comparison notes support Analytics without changing its data.

Analytics now uses these cards for its five headline KPIs and four accessorial summaries, preserving every existing figure and comparison. Aligned its page spacing, wrapped date/filter controls and chart legends, exposed the date selection with aria-pressed, and contained hourly-chart scrolling so labels remain readable on narrow screens. Removed the nested accessorial panel surface. Report calculations, CSV export, printing and audit data remain unchanged. Analytics continues to use existing static prototype figures; date-range controls do not recalculate those figures.

Validation: all 5 list/Analytics interaction tests and 10 appearance tests pass, including preserved KPI values, audit search/SLA filtering and date-selection state. TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Temporary Chrome checks cover all five pages at 1440×1000 and 390×844, equal desktop card widths, icon presence, table alignment, contained page width and search/clear. Inspected desktop/mobile card screenshots and Analytics charts/accessorials, then rechecked final chart-label spacing. External requests were blocked during visual checks; remote driver portraits were not verified. Existing uncommitted changes are preserved.

### September 21: Apply 28.5% to the old saved Fuel Charge default

The user still saw 8% because the percentage-only update deliberately preserved saved rates. At the user's correction, live billing now upgrades the old unversioned, enabled fixed 8% default to 28.5%. Other percentages, disabled fuel and indexed effective percentages are preserved. Saves record a fuel-default version marker outside the billing domain model, so deliberately entering and saving 8% afterward keeps it. Frozen quote contexts never pass through this migration. Reloading the Pricing page reads the updated default.

Validation: all 8 fuel tests pass, including a rendered form showing 28.5% from an old 8% record, a later explicit 8% save/reload, preserved disabled/custom/indexed values and unchanged historical fuel calculation. TypeScript and production build pass; the existing bundle-size advisory remains.


### September 21: Summary cards above operational tables

Replaced the rejected inline summary strip with individual white cards across Orders, Drivers, Shippers and Vehicles. Equal-width desktop cards fill the table's content width, using its 12px corner radius, subtle divider color and aligned 16px content padding. Muted labels sit above prominent neutral totals, with a minimal shadow and 24px separation from the search/filter toolbar. Mobile uses two columns, with an odd final card spanning the row. Existing counts, filtering, tables and saved data are unchanged. This supersedes the earlier compact-inline-summary presentation.

Validation: all 4 list interaction tests and 10 shared appearance tests pass; TypeScript, production build and diff checks pass. The build retains its existing large-chunk advisory. Inspected all four pages in temporary Chrome at 1440×1000 and 390×844. Desktop cards have equal widths and 112px height, aligned with the table; mobile cards wrap without page overflow. Browser checks verified card surfaces, toolbar visibility and search/clear behavior with stable totals. Checks used isolated local data with external requests blocked, so remote driver portraits were not verified.

### September 21: Percentage-only Fuel Charge

Simplified Fuel Charge to one labelled percentage input and Save Fuel Charge. Removed mode selection, pump/baseline fuel prices, the conversion factor, Enabled and Taxable controls. Zero disables fuel charging; positive decimal percentages enable it. Blank, negative and non-finite rates are rejected rather than saved as zero. The centralized pricing engine rejects invalid active fuel settings. Existing taxability, eligible-charge rules, fuel-before-discount order and imported final-total behavior remain intact.

New billing settings now default to 28.5%. This is a researched local courier starting benchmark: [Novex publishes 28.5% for September 1–30, 2026](https://www.novex.ca/fuel-surcharge/), applied by that operator to base shipping and weight charges. It is not an industry standard, a guaranteed cost-recovery figure or an automatically refreshed feed. The UI advises monthly review. Existing explicitly saved percentages, including the old 8% value, remain unchanged. Disabled settings become 0%; stored fuel-price-based settings normalize to their previous effective percentage. Repeated load/save is stable and preserves other billing fields. Historical frozen quote contexts bypass normalization; hourly settlement uses their original indexed or percentage rule. New quotes freeze the normalized percentage.

Validation: all 7 new fuel tests and all 67 settings tests pass. Fuel coverage includes default/preserved rates, indexed/disabled migration, one-field UI, blank/negative rejection, decimal saving/reload, zero disable/re-enable, concurrent edits, all four pricing methods, tax totals and historical/current hourly settlement. Pricing tests pass 61/62 with the existing obsolete Special handling time minutes form assertion still failing. TypeScript and production build pass; the existing large-bundle advisory remains. Browser visual verification was not performed. These changes apply to the local operational prototype; no API deployment occurred.


### September 21: Compact operational list summaries and toolbars

Orders, Drivers, Shippers and Vehicles now share a compact ListSummary: neutral numbers beside concise labels, without dispersed icons, colored totals or repeated captions. Shippers' active-order total remains visible as its own metric. Existing calculations, saved data, table columns and actions are preserved. Shared styles reduce desktop top whitespace and align wrapping search/filter controls; mobile search uses a full row. Existing table scrolling and semantic row statuses remain intact.

Validation: 4 new list interaction tests, 10 appearance tests and all 67 settings tests pass. TypeScript and production build pass, with the existing bundle-size advisory. Visually inspected all four pages in temporary Chrome at 1440×1000 and 390×844; summaries measured 38px on desktop and 80px on mobile, toolbar controls stayed inside the viewport, and there was no page-level horizontal overflow. Search/clear restored rows and left totals stable at both sizes, with no page JavaScript errors. Browser checks used isolated local prototype data; external requests were blocked, so remote driver portraits were not verified. No operational persistence or API behavior changed.

### September 21: Fixed additional charges for Service Level

Replaced Service Level multipliers with a company-currency Additional charge field, added once per order through the centralized pricing engine across Distance, Fixed, Hourly and Zone cards. List values, modal guidance, worked formulas, shipper discount guidance and quote breakdowns now use dollar charges. New forms start at zero and reject blank, negative, non-finite and fractional-cent values. Service metadata and unrelated catalogue changes are preserved.

The user requested practical starting amounts: Standard 0, Rush 20, Direct Hotshot 35, Economy 0, editable in company currency (researched as CAD local-delivery starting points). Built-in legacy records receive these only when an additional charge is absent; explicit amounts including zero remain unchanged. Custom neutral legacy services migrate to zero; custom nonneutral services show Set charge and cannot price new orders until an amount is supplied. These are starting premiums, not verified margin guarantees; Economy no longer automatically discounts freight. Research: [MPM Courier local rates](https://www.mpmcourierservices.ca/pricing) supports a local rush premium; Direct 35 is an implementation recommendation rather than a quoted market standard.

Engine v9 records FIXED service pricing in new frozen contexts. The charge retains existing taxable-transport, fuel-eligible and transport-discount behavior. Multi-stop/multi-movement orders add it only once. Historical frozen contexts without this mode retain their original multiplier during hourly settlement; explicit repricing uses fixed charges and completed snapshots remain immutable. Imported freight adds the fixed charge; final agreed totals remain untouched. This is the local operational prototype; no API-authoritative pricing integration or deployment was performed.

Validation: all 67 settings tests pass. Pricing tests pass 61/62, including all new checks for four methods, zero and invalid charges, fuel/discount/tax/minimum order, historical/current hourly settlement and imported totals. The sole failure is the previously documented obsolete Special handling time minutes form expectation. TypeScript and production build pass; the existing large-bundle advisory remains. Concurrent navigation and company-logo changes were merged and preserved. Browser visual verification remains unavailable in this session.


### September 21: PNG/JPEG company logo uploads

Restricted new company logo uploads to PNG and JPEG (.png, .jpg, .jpeg) in both the file picker and upload validation. Updated the format guidance. Unsupported formats and files over the existing 200 KB limit show a concise error and preserve the current logo. A valid selection clears the error. Existing saved logos, clickable preview, Remove and Save Settings behavior remain unchanged.

All 65 settings tests and 10 appearance tests pass, including PNG/JPEG replacement and reload, rejected SVG/GIF/WebP/non-image files, oversize rejection, preserved logo data and recovery after a valid selection. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No browser visual verification was performed.

### September 21: Company logo is the upload control

Replaced the separate Upload/Change logo button with a clickable logo preview in Company → General. The existing image or empty placeholder is a shared, keyboard-accessible button with upload/change labels and hover/focus feedback. It opens the existing file input; Remove, the 200 KB limit and Save Settings behavior remain unchanged. The preview retains its compact rounded shape.

Validation: all 64 settings tests and 10 appearance tests pass, including clicking the preview, Enter/Space activation, upload, replacement, Save Settings, reload and removal. TypeScript, production build and diff checks pass. The existing build-size advisory remains. No browser visual verification was performed.

### September 21: Removed Services & Dispatch page

Removed the obsolete Services & Dispatch page, its Settings menu entry, application rendering branch, route and legacy navigation alias. Settings now contains Company and Pricing. Neither /settings/services nor its /prototype variant resolves to an operational page. Service levels remain under Pricing and individual order limits remain in driver details. Updated the pricing formula’s service-settings reference and navigation documentation. Saved service, driver and company data is unchanged.

Validation: all 63 settings tests, 6 navigation tests, TypeScript, production build and diff checks pass. The existing build-size advisory remains. Browser visual verification was not performed.

### September 21: Individual driver order limits

Moved Maximum Active Orders per Driver into the driver detail/create form, saved by Save driver as the optional driver maxActiveOrders field. New forms and existing drivers without an explicit value use the retained company dispatch default. Saved limits apply only to that driver; the company record and other drivers are unchanged. Required positive whole-number validation runs in the form and shared driver validator. Loading legacy records does not invent a saved override.

The shared assignment validator resolves the selected driver’s limit for both manual assignments and the local recommendation action. Lowering a limit only prevents additional assignments; existing work and frozen customer prices are unchanged. Removed the old shared dispatch input and Save Dispatch Rule form. The former Services & Dispatch page retains its URL and directs users to driver details.

Validation: all 63 settings tests and 16 entity tests pass, including default inheritance, invalid/blank limits, individual save/reload, unchanged company/other-driver data, and driver-detail access. Pricing tests pass 56/57; the new assignment test covers exact limits, higher/lower individual limits, inherited defaults, independent drivers and unchanged snapshots. The existing Special handling time minutes assertion still fails. Entity-form tests pass 8/11 with the same three previously documented obsolete assertions. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No browser visual verification was performed. Driver limits are implemented in the existing local client; operational API integration remains outstanding.

### September 21: Pricing tab order

Moved Service Level immediately after Fuel Charge. Pricing now orders tabs as Rate Cards, Fuel Charge, Service Level and Accessorials. Updated keyboard-navigation expectations and the specification. All 63 settings tests, TypeScript, production build and diff checks pass; the existing bundle-size advisory remains.

### September 21: Service Level moved into Pricing

Moved the existing Services catalogue from Services & Dispatch to a Service Level tab in Pricing, immediately after Rate Cards. Add/edit/status controls, multiplier validation, shared service IDs and catalogue saving are retained. Service changes refresh the pricing catalogue while mounted rate-card drafts survive tab switches. Services & Dispatch retains its existing dispatch rule; page descriptions reflect the new content. No pricing calculations or saved service data changed.

Validation: all 63 settings tests pass, including service creation/editing, preserved hidden values and unrelated catalogue changes, keyboard access to Service Level, saved-service reload, retained rate drafts and dispatch-rule saving. TypeScript, production build and diff checks pass; the existing build-size advisory remains. Browser visual verification was not performed.

### September 21: Consistent shared UI across the client

Applied the existing Dispatra shared design baseline across operational pages, pricing/settings forms, analytics, map detail views and authenticated portal forms. Replaced divergent field/action classes, heavy labels, tiny text and ordinary outlined white cards with common inputs, labels, section titles, actions and panels. Main controls/actions share 40px height, compact actions and zone fields 36px, ordinary control/value text 14px and secondary text 13px. Existing Inter, neutral colors, page/sidebar layouts, status colors and the two-table zone matrix remain. Zone sections now use the shared panel padding/corners and field typography, retaining the 70px numeric minimum and scrolling.

Shared styles cover field hover/focus/invalid states, native checkboxes, selected rate-card rows, disclosures, dialog scrims/surfaces/drawers and primary/secondary/destructive actions. Search fields in rate-card selection and detail dialogs use SearchInput. The Orders driver-assignment list now uses the shared portalled DropdownMenu, with keyboard selection, Escape dismissal and focus return; driver eligibility and assignment callbacks stay in the existing caller. Newer vehicle-screen changes were merged and preserved. No pricing, persistence, API or dispatch rules were changed.

Validation: all 62 settings tests, 10 appearance/interaction tests and 7 date-picker tests pass. The new assignment-menu regression covers keyboard selection, portal placement, Escape, callback delivery and focus restoration. Entity-form tests pass 8/11; the same previously documented expectations for old estimate text, Route distance and Priced on still fail. TypeScript and production build pass, with the existing large-chunk advisory. Changes were validated in an isolated copy and applied with checks against concurrent edits and file backups. Browser visual verification remains unavailable because the browser security policy check could not be completed; no exact match to chatgpt.com is claimed.

### September 21: Vehicle type columns in the main fleet table

Removed the Fleet/Vehicle Types tab switcher so Vehicles opens directly on the fleet. Each asset row now shows its assigned type’s Surcharge, Type limits and Cost / company distance unit alongside the asset’s own Capacity. Company weight/distance units apply to limits and costs. Explicit zero costs stay zero; absent overrides retain the default label and missing type references show unavailable values. Existing assets, shared type records, operating costs and pricing calculations are unchanged. This change removes the separate type-management view from Vehicles; the new columns are read-only.

Validation: focused settings checks pass for direct table visibility, values from the assigned type, search/filter/registration, pounds/miles conversions, zero/default costs, missing references and unchanged catalogue data. TypeScript, production build and diff checks pass. All 62 settings tests pass. The existing build-size advisory remains; no browser visual verification was performed.

### September 21: Company settings are the sole unit selector

Removed the per-field kg/lb dropdowns. Company → General → Regional Preferences controls weight entry and display throughout pricing, package entry, vehicle payloads, lists and order/calculation details. New companies still default to kg; choosing lb in Company settings converts entered pounds to canonical kilograms, including currency/lb rates to currency/kg. Vehicle dimensions also follow the company cm/in preference. Matrix inputs are back to equal flexible widths with the requested 70px minimum; their common description identifies the company weight unit. New calculation descriptions use the company units without changing the charge amounts or canonical quantities. Existing prices, physical facts, dimensional rules and historical snapshots are preserved.

Validation: all 61 settings tests pass, including changing the actual Company setting, pounds entry, Save Card and reload, kg display after changing back, and unchanged saved rates. All new package, payload/dimension, list/detail display and calculation-invariance checks pass. Entity-form tests pass 8/11, with the same three previously documented obsolete expectations (estimate text, Route distance field, Priced on label). Pricing tests pass 55/56, with the same pre-existing Special handling time minutes assertion. TypeScript and production build pass; the existing bundle-size advisory remains. Browser visual verification is blocked because the browser tool reports no connected browsers. These changes apply to the existing local operational client; API integration remains as documented below.

### September 21: Dimensional weight by pricing method

Fixed and Hourly no longer show dimensional settings or validate unused divisors when saved/priced. Their worked examples and order guidance describe weight-independent base prices. Stored legacy fields remain intact. Distance retains its divisor and maximum actual/dimensional excess-weight calculation; the worked formula now clamps included distance/weight at zero, uses the selected units consistently and updates as the divisor changes.

Zone bands now select the smallest inclusive limit covering the greater of total actual and dimensional weight separately for each linked pickup-to-delivery movement, including package quantities. Directional prices remain independent. Unknown/zero actual movement weight, ambiguous package links and above-maximum weights still require review, without falling back to a legacy amount. Band matching never rounds weight down into a cheaper band. Existing flat prices remain flat. The two-table matrix has concise automatic-weight guidance and follows the company unit preference.

New snapshots record METHOD_SPECIFIC (engine v8). Historical MAX and legacy contexts retain their original dimensional rules, including actual-only zone band selection and hourly settlement. Existing frozen non-hourly quotes stay unchanged. This is the local prototype; API pricing integration remains outstanding.

Validation in an isolated copy of the current client, including the concurrent kg/lb updates: all 61 settings tests pass; 54/55 pricing tests pass, with only the previously documented obsolete Special handling time minutes assertion failing. New checks cover Fixed/Hourly save and pricing without valid divisors, current/historical hourly settlement, Distance actual/dimensional comparisons and included allowances, live formula updates and imperial units, directional Zone movement weights/quantities, exact and above-limit dimensional boundaries, and preserved flat prices. TypeScript and production build pass; the existing bundle-size advisory remains. No browser visual verification was performed.

### September 21: Per-field kg/lb entry (superseded by company-only units)

Added a shared WeightInput using the existing accessible Select and centralized unit converters. Rate-card zone limits, included weight, weight rates, package weights, vehicle payloads and vehicle-type payloads can choose kg or lb independently. New company defaults remain kg; existing saved company preferences are respected initially. Switching a selector converts only its displayed value and does not write a draft or change a price. Editing pounds saves the corresponding canonical kg value (and per-pound prices convert to currency/kg). Blank band limits and zero prices retain their existing behavior. Numeric fields keep their 70px minimum beside compact unit selectors; matrix scrolling and responsive payload layouts contain the added controls.

Unit selection is local display state while the field is mounted. Reopening a form returns to the company preference, showing the converted saved physical weight. No unit metadata was added to pricing/order schemas, and historical snapshots or calculations were not changed.

Validation: 57/57 settings tests pass, including per-field pounds entry, keyboard switching without writes, mixed default/unit selections, rate conversion, save/reload and existing 100-combination matrix behavior. Both new package/payload integration tests pass. Entity-form tests pass 7/10: the three older failures expect missing estimate text, a Route distance input and a Priced on label; all three reproduce in an isolated copy with the previous weight controls restored (5/8 original tests). Pricing tests pass 51/52 with the previously recorded unrelated Special handling time minutes assertion. TypeScript, final production build and diff checks pass; the existing bundle-size advisory remains. Desktop/narrow browser review remains unavailable: the browser tool reports no connected browsers.

### September 21: Matrix heading capitalization

Capitalized the heading as Zone-to-Zone Matrix. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains.

### September 21: Borderless zone-table sections

Removed the outer borders from both Zones and Zone-to-zone matrix sections. Existing white surfaces, subtle shadows, input borders and validation states remain. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No pricing or interaction logic changed.

### September 21: Maximum chargeable weight is mandatory

Removed the Use higher of actual or dimensional weight checkbox from every rate card. The divisor stays editable, with a short explanation that chargeable weight always uses the greater value. New pricing and live previews always use maximum actual/dimensional weight, including legacy disabled flags; card saving and the engine require a finite positive divisor. New cards enable the rule, and existing active opt-outs normalize once with the existing version-bump flow while retaining divisors. Archived opt-outs remain unchanged.

New frozen contexts record the MAX dimensional-weight mode (engine v7). Finalizing old hourly quotes without that marker honors their original card/company opt-out; new hourly quotes retain their quoted maximum-weight rule and divisor. Existing priced non-hourly/final snapshots are preserved by the existing settlement flow. Zone-band selection rules and other method-specific charges were not changed.

Validation: 55/55 settings tests pass for checkbox removal, editable per-card divisors, save/reload, invalid divisor rejection and stable migration of inherited/disabled settings with archived preservation. Pricing tests pass 51/52, including new maximum-weight comparisons, quantities, disabled flags, finite-divisor validation, and legacy/current hourly settlement regressions. The previously documented unrelated Special handling time minutes assertion still fails. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Browser visual verification remains unavailable in this session.

### September 21: Rate editor heading capitalization

Renamed the editor headings to Rate Card and Distance Based Rates. Other method labels and pricing behavior are unchanged. All 55 settings tests, TypeScript, production build and diff checks pass; the existing bundle-size advisory remains.

### September 21: Short zone action label

Renamed the Zones table’s Add Zone button to Add. Zone creation and focus behavior are unchanged. All 55 settings tests, TypeScript, production build and diff checks pass; the existing bundle-size advisory remains.

### September 21: Left-aligned matrix inputs

Weight and price values/placeholders in the Zone-to-zone matrix now align left. This CSS-only change preserves flexible sizing, validation and pricing behavior. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains.

### September 21: Validation marks fields without expanding rows

Both zone tables now use red borders for invalid fields instead of visible text beneath cells. Missing zone names/postal lists and invalid weight/price values expose aria-invalid and linked screen-reader-only descriptions. Per-band validation marks only affected fields; duplicate limits mark both weight fields while valid prices and untouched unpriced routes remain unmarked. Correcting a value clears the red state, including zero-price acceptance. The red border persists on hover/focus without adding a second border. Existing shared save, Save Card blocking, pricing rules and historical behavior are unchanged; field feedback reuses centralized validation rules.

Validation: all 55 settings tests pass, including field-specific errors, hidden accessible messages, duplicate-limit recovery, zero prices and shared-zone required fields. TypeScript, production build and diff checks pass. Pricing tests pass 49/50 with the already documented unrelated Special handling time minutes assertion still failing. Existing bundle-size advisory remains. Browser visual verification remains unavailable in this session.

### September 21: 70px minimum matrix fields

Set the matrix input minimum to 70px, following the user’s adjustment from 60px. Inputs still share available space flexibly, and destination minimum widths follow the same token. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No runtime logic changed.

### September 21: Flexible matrix input widths

Weight and price inputs now have an 8rem (128px at the default root size) minimum and share available cell width equally. Removed the fixed 20rem destination widths/maximums and switched the matrix to a full-width automatic table layout so columns expand with the container. Large matrices retain contained scrolling instead of shrinking the fields below their minimum. Pickup-label sizing and sticky headers remain.

Validation: 9 appearance tests, TypeScript, production build and diff checks pass. Existing bundle-size advisory remains; desktop/narrow visual verification remains unavailable in this session.

### September 21: Simple placeholders and shared matrix guidance

Matrix inputs now use exactly Weight and Price as placeholders. One description immediately beneath Zone-to-zone matrix explains the maximum weight and delivery price using the selected company unit and currency. The table references that description for assistive technology; existing flat-price markers and pricing behavior remain unchanged.

Validation: 55 settings tests, TypeScript, production build and diff checks pass. Existing bundle-size advisory remains; browser visual verification remains unavailable in this session.

### September 21: Single focus border in zone tables

Removed the extra offset outline from focused zone-table inputs. A darker single border still indicates focus, without an outer ring or shadow. This is scoped to both zone tables and does not change editing behavior.

Validation: 9 appearance tests, TypeScript, production build and diff checks pass. Existing bundle-size advisory remains. Browser visual verification remains unavailable in this session.

### September 21: Simplified matrix cells

Removed matrix delete icons, Add band buttons and the visible Weight/Price subheadings at the user's request. Each intersection now has two aligned fields with unit/currency placeholders; pickup/delivery headings and accessible input names remain. Existing multiple-band rows remain visible/editable, and no saved bands were removed. Cleared rates, validation, sorting, directional independence and Save Card behavior remain. Zone deletion stays in the first table. New band creation is no longer exposed in the matrix.

Validation: all 55 settings tests pass, including absence of matrix buttons/visible field labels, placeholders, existing multiple-band editing/validation/sorting/reload, clearing rates and ten-zone data preservation. TypeScript, production build and diff checks pass. The existing build size advisory remains; browser visual verification remains unavailable in this session.

### September 21: Inline postal-code editing

Removed the location icon and postal-code popup from the Zones table. Postal codes now edit directly in its existing bordered text field. Each change uses the existing parser and shared automatic saving; raw separators remain while typing, and the displayed list normalizes on blur. Multiline clipboard lists retain their separators in the single-line field. Leading zeros, internal spaces, deduplication, missing-code guidance and accessible zone-specific labels remain. Matrix rates and Save Card behavior are unchanged.

Validation: all 55 settings tests pass, including direct keyboard editing, retained commas, multiline paste, formatting/reload, unchanged directional prices, zone deletion and weight bands. TypeScript, production build and diff checks pass; the existing build size advisory remains. Browser visual verification remains unavailable in this session.

### September 21: Zone tables styled to the supplied reference

Scoped both zone-editor tables to compact reference-style fields and sections: faint outlined white panels, 12px table text, rounded bordered inputs, plain unruled rows, centered destination headings, right-aligned numeric values, and muted compact actions. The Zones directory uses a narrower name column and wide postal-code preview that opens the same shared popup. Its column headings remain available to screen readers but are visually hidden to match the reference. The Add Zone button sits beside the heading and supporting text. Weight/price labels, every matrix combination, visible multiple bands and sticky scroll headers remain. Styling is scoped to these two tables; pricing, storage and other rate-card methods were not changed.

Validation: 55 settings tests and 9 appearance tests pass; TypeScript, production build and diff checks pass. Existing production bundle-size advisory remains. No new tests were added for this presentation-only refinement. Browser visual verification remains unavailable because no browsers are connected.

### September 21: Two-table Zone-to-Zone editor (current)

Supersedes the earlier flat and selected-pickup layouts below. Zone cards now show two separate shared-style white sections: a Zones management table and the card-owned Zone-to-zone matrix. Zones has Add Zone, an editable name, the existing postal-code popup and confirmed deletion. The matrix puts pickups down the left and deliveries across the top, with Weight up to (company unit) and Price (company currency) labels beneath each destination. Every intersection has separate editable fields, including same-zone pairs; additional bands stay visibly aligned inside that cell. Compact add/remove controls, subtle separators, contained scrolling and sticky pickup/delivery headers support larger grids without hiding combinations.

Adding a zone adds both axes and focuses its name; new cells remain blank. Stable IDs preserve references and directional drafts through renames. Shared names/codes still save automatically, while prices remain under Save Card. Postal parsing, leading zeros/internal spaces, deduplication, initial focus, Escape/outside dismissal, Done and focus restoration remain. Confirmed zone removal cleans affected active-card and compatibility rates, retains other draft edits, increments affected saved card versions and leaves archived records unchanged. Removing a final band only clears its matrix cell. Existing flat prices, paired band sorting, validation, units, pricing calculations, other methods and historical snapshots are preserved. No live zones were seeded or deleted by this implementation.

Validation: 55/55 settings tests and 9/9 appearance tests pass. Coverage includes two-zone matrix axes/four cells, adding a third zone/nine cells, ten-zone axes/all 100 cells with existing multiple bands, independent directional prices, rename/add focus, confirmed/cancelled deletion and cleanup, archived-card preservation, postal updates/reload, band validation/sorting/deletion, keyboard interaction and Save Card/reload. TypeScript, production build and diff checks pass. Pricing tests pass 49/50; the previously documented unrelated assertion for the obsolete Special handling time minutes input still fails. The production build retains its existing large-chunk warning. Desktop/narrow visual inspection remains blocked: the browser tool reports no connected browsers. Updated the isolated preview fixture to use the same two tables.

### September 21: Complete flat Zone-to-Zone matrix correction

Replaced the selected-pickup view with one always-visible, editable table: Pickup, Drop-off, Weight up to (company unit), Price (company currency), and Actions. Every directional pair is shown in pickup order, including same-zone pairs. Two zones show four combinations, adding a third produces nine, and ten zones show 100. Extra bands occupy adjacent rows with both names repeated, subtle row separators and contained horizontal scrolling. No pickup selector, route cards, route accordions, pagination or hidden combinations remain.

Each row's ZIP icon opens the shared anchored popup identifying both zones, with separate pickup/drop-off postal-code textareas or one for a same-zone pair. Parsing, automatic shared saving, initial textarea focus, Escape, outside dismissal and focus restoration remain. The popup edits postal codes only. Inline name edits update stable shared zone IDs everywhere. Add zone focuses its name and shows all newly required pairs with blank fields without changing existing rates.

Delete removes only the selected rate/band from the card draft and retains a blank row for its combination when the last band is removed. Shared zones, opposite directions, other cards and historical records are preserved. Existing flat-price editing, weight-band validation/sorting, units/currency and Save Card behavior remain; pricing calculations and data models were not changed.

Validation: all 54 settings tests and 9 appearance tests pass, including exact two/three-zone row ordering, all 100 ten-zone combinations, repeated labels on extra bands, shared postal updates in both directions, same-zone popup behavior, deletion/save/reload, legacy values, validation and keyboard focus. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Pricing tests pass 49/50 with the previously recorded unrelated Special handling time minutes assertion still failing. Desktop/narrow visual inspection was unavailable because the browser tool returned no connected browsers.

### September 21: Single-table Zone-to-Zone pricing

Replaced the separate zone form and route cards with one table for the selected Pickup zone. Every destination, including the pickup itself, appears once as a row group; ten zones show ten groups. Names, weights and prices edit inline, with compact band actions and contained horizontal scrolling. Add zone appends a shared zone and focuses its name. Zone IDs and directional price drafts survive renaming and pickup changes.

Postal-code icons open the shared anchored popup with initial textarea focus, Done, Escape/outside dismissal and focus restoration. The existing parser preserves leading zeros/internal spaces and normalizes/deduplicates codes. Missing codes have an explicit text cue. Remove zone uses the existing confirmation and active-card safeguards; cancelling restores icon focus and successful removal focuses Add zone. Names/codes retain automatic shared saving; prices still use Save Card.

Retained existing flat prices without assigning weight limits, including clear/retype edits and pickup switches. Weight bands retain their paired prices through sorting; positive/unique limits, nonnegative prices and blank-versus-zero validation still use the existing pricing helpers. No pricing-engine, backend, historical-snapshot or other-method behavior was changed. The existing dev preview now uses the same table.

Validation: all 53 settings interaction tests and 9 appearance tests pass. Coverage includes ten destinations, hidden directional drafts, unchanged saved routes, stable zone IDs, add/rename/remove, postal formatting/reload, popup keyboard/outside dismissal, real confirmation focus, band focus/validation/sorting/save/reload and company units/currency. TypeScript, production build and diff checks pass; the existing large-bundle advisory remains. Pricing tests pass 49 of 50; the previously documented unrelated Special handling time minutes form-render assertion still fails. Desktop/narrow visual inspection was blocked because the browser tool returned no connected browsers.

### September 21: Neutral rate card icons

Rate-card method icons use the existing muted-gray foreground, light neutral-gray tile and shared gray hover token, replacing the blue styling to match the app's established palette. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No new tests for this color-only change.

### September 21: Compact rate card list rows

Replaced the boxed Rate Cards list with compact rows inspired by the supplied reference: a method icon, card name and Default badge, and muted method text below. Rows have transparent backgrounds and no shadows; only the selected row shows a border. Version information remains in the editor header. Detail-panel shadows, search, Add card and selection behavior remain intact.

Validation: all 50 settings interaction tests, TypeScript, production build and diff checks pass. The existing bundle-size advisory remains. Visual browser review was unavailable because the browser tool reported no available browser.

### September 21: Zone-to-zone weight-band UI

Replaced the flat price matrix with directional route sections grouped by pickup zone. Retained inline shared-zone management and Save Card semantics. Routes show weight limits in company units, prices, add/remove actions, incomplete status and inline validation. Bands sort on leaving the route and on save, preserve their price pairing, and retain keyboard focus when adding/removing rows. Existing flat rates remain marked No limit until explicitly converted; no old amount receives an invented threshold.

Optional nested weight bands survive existing storage normalization. The centralized local engine selects the smallest inclusive limit for actual package weight on each commercial movement, including quantities; missing/ambiguous weights, invalid bands and excess weight cannot fall back to the legacy flat amount. Formula examples now link a package to each example movement. Open-ended final bands and further rate-card pricing rules remain for discussion; authenticated/backend pricing was not integrated by this change.

Validation: all 50 settings tests and 9 appearance tests pass. Pricing tests pass 49 of 50, including new band boundaries, quantity, independent directions, ambiguous links and overflow checks. The existing unrelated Special handling time minutes form-render test still fails, as previously recorded. TypeScript and production build pass, with the existing bundle-size advisory. Browser visual QA could not run: Codex Browser reported that its admin-enforced security policy could not be verified. No bypass was attempted. A dev-only interactive fixture uses the real components at `/tests/fixtures/zone-weight-preview.html` with clearly labelled sample prices; its edits do not touch saved cards.

### September 21: Compact zone action

The Add button inside the Zone to zone card uses the shared small button size (32px high instead of 40px). TypeScript and production build checks pass; the existing bundle-size advisory remains. No new tests for this sizing-only change.

### September 21: Shorter add-card label

The Rate Cards list action now reads “Add card.” Existing test selectors and markup expectations use the new label. All 48 settings tests, TypeScript and production build checks pass; the existing bundle-size advisory remains.

### September 21: Rate card detail surfaces

White panels in Rate Card Details now have an extra-small shadow and no outer border, including pricing terms, zone rates and the pricing formula disclosure. Styling is scoped to the editor's top-level panels, preserving input borders and other settings surfaces. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No new tests for this styling-only change.

### September 21: Rate card selection borders

Rate cards show a visible border only when selected and retain their original white background when selected. Unselected cards use a transparent border to preserve spacing when selection changes. All cards use the shared subtle small shadow. TypeScript and production build checks pass; the existing bundle-size advisory remains. No new tests for this styling-only change.

### September 20: Horizontal-only Earth rotation

Locked the intro camera latitude to Vancouver’s latitude and removed the changing bearing. Only longitude changes during the opening rotation; latitude, north-up bearing and pitch remain fixed throughout the flight. The descent keeps its center fixed, eliminating vertical globe rotation or a later latitude correction. The initial view now shows the Asia/Australia side from the same latitude as the destination. Existing immediate zoom, slowdown, duration and operational map handoff remain unchanged.

Validation: all 9 focused intro tests pass. The camera-path regression now checks constant latitude, zero bearing/pitch throughout rotation and a fixed center throughout descent, alongside immediate zoom, eastward date-line crossing and exact Vancouver arrival. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Browser scenarios were not rerun for this camera-path-only correction.

### September 20: Immediate Australia-to-Vancouver globe flight

The opening camera now moves from its first animation frame, starting over Australia and rotating east across the Pacific while zooming. The 1.5-second approach has no opening hold or ease-in; rotation decelerates to a stop over Canada. An eight-second progressively slowing descent, 350ms settling interval and 700ms reveal make the complete sequence approximately 10.5 seconds. Vancouver's label and subtle geographic destination dot appear as Canada turns into view; the dot fades before the handoff.

Playback begins on the local style event rather than waiting for remote imagery. A bundled 14.4KB low-resolution tile from the existing attributed Esri source is inlined into the intro style, avoiding a separate startup image request. Detailed satellite tiles continue loading above it. The intro map's background is transparent so the existing star field remains visible. A single elapsed-time camera path keeps rotation, zoom and phase timing together; cleanup cancels its animation frame. The underlying operational map and thirteen-second fallback remain unchanged.

Validation: all 9 focused intro tests pass, including immediate movement, eastward date-line crossing, exact Vancouver arrival and decreasing descent speed. All 7 Chrome intro scenarios pass, including progression with stalled satellite requests, handoff and live controls/markers, Skip/focus, session behavior, locate bypass, reduced motion, mobile navigation and imagery failure. Operational navigation browser checks pass for URLs, refresh, Back/Forward, guarded drafts and prototype paths. Globe frames and desktop screenshots reviewed. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Previously recorded unrelated full-suite pricing/form failures remain outside this animation change.

### September 20: Slower cinematic descent

Replaced the single fly-to with a 700ms approach to a frame-filling Earth and a separate six-second descent. The descent starts slower than the approach and progressively decelerates to zero at Vancouver, followed by a 350ms settling pause and the existing 700ms reveal. Including the opening orbit, playback is about nine seconds after imagery loads. Shared timing constants also drive the progress bar and a thirteen-second fallback timeout, allowing the slower sequence to finish while retaining bounded dismissal.

Validation: all 8 focused intro tests pass, including a speed-curve regression verifying that descent speed decreases at every interval. All six Chrome intro scenarios pass, covering the handoff, live controls/markers, session behavior, Skip/focus, locate bypass, reduced motion, mobile navigation and imagery failure. Screenshot reviewed. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. The operational map's camera and behavior are unchanged.

### September 20: Earth-to-Vancouver Monitor introduction

Added a temporary satellite globe with a dark star field, an orbital camera move and a zoom into Vancouver, followed by a 700ms fade into the existing Monitor. The flight takes about five seconds after its imagery loads. The operational map stays mounted at its original camera; only a readiness callback and shared camera/style constants were added to it. The intro uses the existing Esri imagery source and MapLibre's [globe/atmosphere support](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-globe-with-an-atmosphere/), with no new dependencies. Its renderer, observers and timers are disposed after playback, dismissal or navigation away.

Session storage records the first Monitor visit, with a memory fallback for blocked storage. Skip, Escape, reduced-motion preference changes, backgrounding and imagery/WebGL errors dismiss the intro; a nine-second timeout prevents indefinite blocking. Locate-on-map entries bypass it, and normal return visits/reloads do not replay it. The real map's controls are inert only during playback, mobile navigation stays available, and keyboard dismissal restores focus.

Validation: 7 focused intro tests, 9 appearance tests and 5 navigation tests pass (21 total). Six Chrome intro scenarios pass: globe flight and handoff, live zoom/layer controls and marker selection, session replay prevention, keyboard Skip/focus, direct Locate on Map, reduced motion, mobile navigation and imagery failure. The existing navigation browser journey also passes, including direct loads, refresh, Back/Forward, guarded settings and prototype URLs. Desktop Earth/Monitor and mobile globe/Monitor screenshots reviewed. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Previously recorded unrelated pricing/order-form test failures were outside this slice. Animation timing and imagery detail depend on tile delivery; errors or excessive delay reveal the normal workspace.

### September 20: Transparent active items in the collapsed rail

Removed the active destination background from collapsed operational and portal sidebars. The expanded sidebar's selection background and accessible current-page state remain. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No new tests for this styling-only change.

### September 20: Gray collapse icon

The shared sidebar collapse icon now uses the neutral muted-gray token (#6b6b6b), retaining that color on hover in operational and portal navigation. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No new tests for this color-only change.

### September 20: Expand minimized navigation from the logo

Removed the separate expand icon from the desktop rail in both shells. Clicking or keyboard-activating the minimized logo expands the sidebar while keeping the current page and unsaved draft. The rail header is now 64px tall, aligning the destination icons with expanded navigation. The expanded brand retains its home action and the expanded sidebar retains its collapse button.

Validation: all 9 appearance and 48 settings tests pass, including logo activation without home navigation. Chrome sidebar checks pass for both shells, confirming the logo image replaces the expand icon, URLs/drafts remain intact, and mobile drawer behavior still works. Desktop screenshot reviewed. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains.

### September 20: Collapsed sidebar icon rail

Desktop operational and portal sidebars now collapse from 260px to a 64px rail, retaining the brand mark, expand control and destination icons with accessible names, hover titles and selected states. The operational rail retains the account avatar and Auto dispatch switch; the account menu opens beside it at the shared normal menu width, including its Settings flyout. Shared SidebarHeader provides the brand/toggle arrangement. Mobile retains the modal drawer, focus handling and page-level open control. Sidebar toggles preserve page/form state, and collapsed navigation continues to update URLs.

Validation: all 9 appearance and 48 settings tests pass. Chrome passes `E2E_ORIGIN=http://127.0.0.1:3001 node tests/sidebar.e2e.mjs`, checking both shells' 64px rails, visible logo and icons, control bounds, operational URLs, account/settings menus, draft retention, desktop/mobile resizing and mobile dismissal, with no page errors. Desktop and mobile screenshots reviewed. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Portal browser coverage uses the presentational shell fixture; authentication behavior is unchanged.

### September 20: Operational page URLs and browser history

Replaced state-only page switching with a shared browser-history navigation hook and explicit route map. Orders, Drivers, Vehicles, Shippers, Analytics, settings, Profile and Help now update the URL and resolve correctly on direct load or refresh. Back/Forward restores the selected page. The existing settings discard dialog protects both sidebar and history navigation, restoring the current URL and retaining drafts on cancellation. `/prototype` navigation preserves its prefix. Root routing uses the same explicit map to keep authenticated company/customer surfaces separate from local prototype stores.

Validation: five focused navigation tests pass, including StrictMode, remount/history continuity, route boundaries and cancellation/confirmation. Chrome passes `E2E_ORIGIN=http://127.0.0.1:3001 node tests/navigation.e2e.mjs` for all operational destinations, direct loads, reloads, Back/Forward, settings drafts and prototype-prefixed navigation, with no page errors. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. The broader regression run passes appearance, company-tax, date-picker, destination-tax, entity and settings suites. Full `npm test` stops at an unrelated pricing test expecting the retired special-handling minute field; the separately exercised entity-form suite also has existing expectations failing for retired estimate copy, the Route distance label and Priced on copy. No pricing/form implementation was changed for this navigation fix.

### September 20: Monitor zoom alignment

Fixed extra right-side space caused by 40px zoom buttons inside a 44px container. Both buttons now fill the container as 44px squares with zero padding and centered icons, aligned with the map settings control above.

Validation: TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome confirmed the original width mismatch, then verified equal button/container widths and centered icons at 1440px and 390px, with both zoom actions clickable. Desktop screenshot reviewed.

### September 20: Accessorial description label

Renamed Description / conditions to Description in the shared Accessorial add/edit form, matching the documented field name. No behavior or layout changes.

Validation: TypeScript, production build and diff checks pass. The existing bundle-size advisory remains; no new tests for this label-only change.

### September 20: Accessorial form alignment

Name and Rate now share equal columns with aligned labels and controls on desktop, stacking at equal full widths on mobile. Description spans the same form edges; the dollar prefix is vertically centered. Reduced excess header/form and action spacing, with the close button aligned to the heading and protected from shrinking.

Validation: TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome verifies equal desktop widths/baselines, matching mobile field edges, add/edit saving and dialog bounds at 1440px, 390px and 320px without page errors. Desktop/mobile screenshots reviewed. No pricing or storage behavior changed.

### September 20: Fixed selected Accessorial charges

Accessorial add/edit now contains Name, dollar Rate (cent precision), Description and only the Taxable checkbox. Removed calculation type, Applies, automatic rule, allowances/increments, minimum/maximum, fuel eligibility and Active form controls. The catalogue retains its existing status action; editing preserves status and new entries start active. Order selection shows fixed dollar charges per order without quantity controls or automatic labels, including Waiting. Updated the catalogue and worked-example copy.

Current catalogue load/save normalizes all Accessorials to fixed charges once per order, selected only, with no limits or fuel eligibility. Existing numeric rates become dollar amounts; names, custom descriptions, taxability and status are preserved. Untouched seed descriptions are updated to match the new behavior. Frozen quote catalogues bypass normalization and retain their previous percentage, per-stop and automatic calculations; a separate legacy fixture keeps those regressions covered.

Validation: 48 settings, 48 pricing, 15 entity and 8 company-tax tests pass (119 total), covering simplified creation/editing, cents/tax persistence, concurrent catalogue edits, legacy normalization, duplicate/high-quantity selection charged once, absence of automatic charges and historical rules. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome verifies create/edit saving, the single checkbox, no selectors, and desktop/390px/320px dialog bounds without page errors. Desktop/mobile screenshots reviewed. No API or deployment changes.

### September 20: Compact left-aligned fuel form

Fuel Charge now uses a left-aligned form capped at 42rem, keeping its two desktop field columns compact while preserving the shared Pricing page width. Save Fuel Charge aligns with the left edge below the fields. Mobile fields continue to stack.

Validation: TypeScript, production build and diff checks pass. Chrome confirms the width cap, left-aligned fields and save action, both fuel modes, saving and mobile bounds at 1440px, 390px and 320px without page errors. Desktop screenshot reviewed; the existing build bundle-size advisory remains.

### September 20: Clean Fuel Charge layout

Removed the Fuel Charge card background, border and extra content padding. The heading, fields and save action align with the page content. Desktop fields use equal columns, with baseline/current prices paired; narrow screens stack the fields. The calculation is plain text, and checkbox labels match the form text size. Fuel settings and saving behavior are unchanged.

Validation: TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome verifies both fuel modes, zero section padding, transparent background, aligned heading/fields/save action, equal desktop columns and saving at 1440px, 390px and 320px without page overflow or errors. Desktop/mobile screenshots reviewed.

### September 20: Fuel Charge tab and per-card dimensional settings

Pricing now has Rate Cards, Fuel Charge and Accessorials, in that order. Fuel Charge replaces Extras and contains only fuel controls with Save Fuel Charge. Removed Service Fee, Extra Stops and the Vehicle & Labour Costs tab, along with their unused form components. Active billing/cards disable service fees and extra-stop charges, including empty $0 stop lines; historical frozen quotes retain their original charges. Stored internal costs remain available to estimates.

Every rate card has a shared Dimensional Weight section with the divisor and actual-versus-dimensional setting. Existing inherited values copy onto each card once; explicit values, false and card independence are preserved. Save Card validates positive finite divisors when enabled. The existing engine uses each card's settings, and the worked example now describes its resolved divisor and omits retired fee rows. Updated short helper text and removed links to retired tabs.

Validation: all 47 settings, 47 pricing, 15 entity and 8 company-tax tests pass (117 total). Added coverage for per-card saves/draft retention, independent values, disabled settings, divisor validation, one-time migration, chargeable weight, retired fees and frozen quote preservation. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome verifies tab order/removals, all four cards, independent divisor changes, fuel saving, reload and the dimensional toggle at 1440px, 390px and 320px without page overflow or errors. Desktop/mobile screenshots reviewed. No API or deployment changes.

### September 20: Shorter zone action label

Renamed the zone creation button from Add Zone to Add and updated existing test selectors. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No new tests or browser run for this label-only change.

### September 20: Concise Rate Cards guidance

Shortened the rate-card introduction, method descriptions, field hints, hourly/imported terms, zone guidance and worked-example explanations. Removed the repeated rates introduction. The collapsed pricing example now shows distance, stops and total; its full scenario remains inside. Essential tax/minimum rules, weight settings, shared-zone saving and unpriced-pair guidance remain clear. Pricing calculations and saved values are unchanged.

Validation: all 45 settings and 45 pricing tests, TypeScript, production build and diff checks pass. Updated existing copy assertions for the shorter labels and summaries. The existing bundle-size advisory remains. No new tests or browser run for this text-only change.

### September 20: Equal rate-card name and minimum widths

Name and Minimum Charge now share equal 50:50 columns in existing and new rate-card forms, stacking on narrow screens. New-card Pricing method sits on the following row. Historical imported final-total cards retain a full-width Name with no Minimum Charge.

Validation: TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome confirms equal widths and aligned desktop fields for all four cards and creation, mobile stacking without overflow, Pricing method below the shared row and no page errors. Desktop screenshot reviewed. No new unit tests for this layout-only change.

### September 20: Single-line zone postal-code input

Replaced the zone ZIP / postal-code textarea with a normal text input using the same field styling and height as the zone name. The helper now asks for comma-separated codes; existing parsing, normalization and automatic saving remain.

Validation: the existing postal-list persistence test, TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome confirms equal field heights and desktop alignment, saved code values and viewport bounds at 1440px, 390px and 320px without page errors. Desktop screenshot reviewed.

### September 20: Shipper discounts and custom postal-code zones

Removed Discount from every rate-card editor and added the shared None / Percentage / Fixed controls to Shipper creation and editing. New shippers start with no discount; saved discounts persist and apply across rate cards to the existing freight/vehicle charge groups. Customer schema 3 migrates the previously effective attached-card or Default discount once. Retained card discount fields serve migration/history only. Current pricing contexts identify the shipper as the discount source; frozen older contexts retain card rules, and quoted hourly settlement preserves its original discount values.

New pricing configurations contain no zones or seeded zone prices. Pricing schema 8 removes untouched preset zones and their active-card prices once, preserving renamed/custom zones, archived records and frozen quotes. Zone descriptions are replaced with a freely named zone and a ZIP / postal-code list. Commas, semicolons and new lines separate codes; normalization preserves leading zeros/internal spaces and deduplicates case/spacing variants. Zone names and lists save automatically, and saving card prices requires a name and at least one code per zone. Existing explicit Order zone selection and per-card price grids remain.

Validation: 45 settings, 45 pricing, 15 entity and 8 company-tax tests pass (113 total). Coverage includes shipper create/edit/reload, discount migration, cross-card application without stacking, historical hourly settlement, empty zones, preset retirement, postal-list persistence and required codes. Invoice fixtures now supply explicit distance pricing rather than relying on retired demo zones. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome verifies no discount controls on all four cards, zone name/code/price persistence, shipper percentage creation and fixed-discount editing after reload, and viewport bounds at 1440px, 390px and 320px without page errors. Desktop/mobile screenshots reviewed and zone field alignment corrected. No API or deployment changes.

### September 20: Simple rate-card names and inline zones

The four preset cards and method labels now read Distance based, Zone to zone, Fixed per delivery and Hourly. Previously untouched preset names migrate once by ID and old name, retaining rates and custom names. Removed the standalone Zones tab. Zone to zone cards open their zone section by default, with shared zone name/description editing and Add Zone/remove controls above the card's price grid. Zone changes save automatically; card prices use Save Card. Confirmed removal cleans matching prices from active cards with version increments, preserves unrelated unsaved card edits and archived records, and cannot revive removed prices on a later save. Frozen quotes remain unchanged.

Validation: all 42 settings and 43 pricing tests pass, including preset migration/idempotence, inline zone management, confirmation cancellation, shared price cleanup, archived-record preservation and draft retention. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome verifies the four names, absence of the Zones tab, add/rename/remove, price editing/saving and tab draft retention at 1440px, 390px and 320px without page overflow or errors. Desktop and mobile screenshots reviewed. No API or deployment changes.

### September 20: Retire Medical & Pharma Group rate card

The seeded `rc_medical_group` card now starts archived. Loading or saving older active copies archives that exact ID once and increments its version, removing it from active lists and selectors while retaining its historical record/rates. Existing default normalization chooses another active card if the retired card was Default. User-created cards with the same name are untouched; frozen quote records are not migrated.

Validation: all 40 settings and 43 pricing tests pass. New coverage checks fresh defaults, saved Group-name copies, one-time archiving, persistence/idempotence, preserved rates, default reassignment and unrelated same-name cards. Updated one stale Company-heading assertion in the pricing render test to the already implemented Regional Preferences label. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains and settings emitted an existing timestamp-based fixture key warning without failures. No browser run was needed for this storage/list change, which is covered by the rendered-list test. No API or deployment changes.

### September 20: Consistent Pricing tab width

Removed reading-width overrides from Zones, Accessorials, Extras and Vehicle & Labour Costs. All five Pricing tabs now use the same wide workspace canvas as Rate Cards, keeping the page heading, tab row and content aligned without width changes when switching tabs. Shared mounted-tab draft behavior remains intact.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Chrome verifies identical tab-panel widths and left edges at 1920px, 1440px, 1024px and 390px, heading alignment, retained unsaved rate-card edits, no horizontal page overflow and no page errors. Reviewed `/tmp/dispatra-pricing-Accessorials.png`. No new unit tests for this layout-only change.

### September 20: Inset table separators

Shared table separators now stop 16px before both outer row edges, including the header line, so the lines stay inside rounded hover corners. Cell pseudo-elements keep each separator continuous across columns and do not intercept clicks; square cells, row dimensions, editable grids and existing hover/focus behavior remain.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Chrome verifies 16px first/last-cell separator insets across all table variants, rounded hover row ends, package editing, dispatch save, desktop service fit and mobile bounds, without page errors. Reviewed `/tmp/dispatra-rounded-dispatch.png`. No new unit tests for this CSS-only adjustment.

### September 20: Straight table cells and separators

Removed individual cell and column-header rounding, including the per-cell focus surface. Idle rows now have straight continuous separators. Rounded outer corners remain on table containers and the ends of whole-row hover highlights. This corrects the segmented curved dividers from the previous iteration while preserving shared typography, spacing, editable controls and the nearby Dispatch save action.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Chrome checks every table variant (Orders, Drivers, Fleet, Vehicle Types, Shippers, Analytics, Services, Accessorials, Zones and Packages) for square idle cells/headers and rounded hover row ends. Desktop/mobile bounds, dispatch saving and package input editing pass with no page errors. Reviewed `/tmp/dispatra-rounded-dispatch.png`; no new unit tests for this CSS-only adjustment.

### September 20: Simplified service add/edit form

Service forms now show only Service Name, Default Price Multiplier and Description in one aligned column using shared fields and buttons. Removed Booking Cut-off, Delivery Promise, both checkboxes, manual Code and the related explanatory block. New codes are generated from the name; new services start active/non-exclusive without an implicit booking cutoff or promise. Editing preserves existing codes, booking/promise values, exclusivity and active status. The list status action remains available. Added a named close control and removed conflicting modal overflow styles.

Validation: all 39 settings tests pass, including absent controls, preserved legacy rules/status/code, default creation values, generated codes and multiplier validation. TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Chrome verifies exactly three aligned fields, viewport bounds and no horizontal overflow at 1440px, 390px and 320px; add, cancel, edit and save pass with no page errors. Reviewed `/tmp/dispatra-service-form-320.png`. No API or existing-record migration changes.

### September 20: Nearby Dispatch save and rounded tables

Renamed the action to Save Dispatch Rule and placed it directly below the compact dispatch field, aligned to its left edge; saved feedback stays beside it. Other settings save actions retain their existing alignment.

Tables now use separate zero-spaced borders with shared 12px table/row corners and 8px header/cell corners. Hover backgrounds paint the cells as one continuous row with rounded ends; cell focus uses a rounded surface without removing the keyboard focus indicator. Light separators moved to cells so rounding renders across every table, including editable grids. Table wrappers share the radius while preserving contained horizontal scrolling.

Validation: all 39 settings tests, TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Chrome verifies table/header/hover corner styles across Orders, Drivers, Fleet, Vehicle Types, Shippers, Analytics, Services, Accessorials, Zones and Packages, along with dispatch button left alignment/proximity, saving, editable numeric input readability and mobile bounds. Reviewed `/tmp/dispatra-rounded-dispatch.png` and desktop/mobile table screenshots; no page errors. No data or API changes.

### September 20: Remove Dispatch Hub and unify tables with the Library reference

Removed Dispatch Hub and its routing claim from Services & Dispatch; the remaining active-order limit uses a compact field width. Fresh settings no longer seed a hub address. The optional legacy property remains inert so saving dispatch rules preserves older browser data without assigning it routing behavior.

Shared table tokens/styles now follow the supplied ChatGPT Library screenshot: transparent table and wrapper surfaces, muted regular 13px headers, regular 14px body text, 60px minimum rows, 16px cell gutters, light #ececec horizontal separators and neutral hover. Removed header fills, heavy text and outer table chrome across every existing table. Action icons use 16px and avatars cannot shrink. Editable package/zone grids share the styling with 8px gutters and minimum numeric-input widths; this fixes a quantity-field squeeze found in visual review. Semantic status colors, fields, actions and existing contained scrolling remain.

Validation: all 39 settings and 9 appearance tests pass, including removal of the hub input and preservation of an older saved address when dispatch rules change. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Production Chrome audits cover Orders, Drivers, Fleet, Vehicle Types, Shippers, Analytics, Services, Accessorials, zone prices and package inputs. Verified dispatch save, type-modal dismissal, package quantity editing/readability, desktop service-table fit, mobile page bounds and no page errors. Reviewed screenshots in `/tmp/dispatra-table-*.png`, including the corrected package input. No routing, pricing, API or deployment changes.

### September 20: Services & Dispatch width and padding

Services & Dispatch now uses the shared wide workspace canvas instead of the 48rem reading width. Dispatch uses the plain panel variant, removing its white card and inner padding so its heading and fields align with Services and the page heading. Service table text can wrap in its first four columns, avoiding horizontal scrolling at desktop widths without changing other catalogue tables. Narrow screens retain contained table scrolling.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Production Chrome verifies aligned unpadded sections and no table scrolling at 1440px, 1280px and 1024px; 768px and 390px retain contained table overflow without page overflow. Service modal opening/dismissal and dispatch saving pass with no page errors. Reviewed screenshots in `/tmp/dispatra-services-*.png`. No new unit tests for this layout-only change.

### September 20: Vehicle Types moved to Vehicles

Removed the vehicle type catalogue from Services & Dispatch and added shared Fleet / Vehicle Types tabs to Vehicles, with Fleet selected initially. Reused the existing catalogue and its type creation, editing, activation and internal running cost storage. Type changes refresh fleet labels, category options and name searches immediately; fleet search/filter state survives tab switches and subsequent registration forms load the updated types. Updated Services & Dispatch description and pricing/cost guidance to point to Vehicles → Vehicle Types.

Validation: all 39 settings tests pass, including relocated running-cost coverage and new create/rename/deactivate, fleet refresh, registration-choice and retained-search coverage. The focused vehicle-details test, TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Production Chrome verifies removal from Services & Dispatch, both Vehicles tabs, keyboard navigation, modal dismissal and no page overflow/errors at 1440px, 390px and 320px. Desktop/mobile screenshots reviewed in `/tmp/dispatra-vehicle-types-*.png`. No API or data migration changes.

### September 20: Company General alignment

Reorganized General into Company Details and Regional Preferences, using shared plain sections and section spacing. The compact logo preview and shared upload/remove buttons sit above full-width name/address fields and equal-width phone/email fields. Currency and timezone share a row, with three equal unit selectors beneath; all grids stack on narrow screens. Added contact hint associations and kept cross-tab drafts, logo validation and shared saving intact.

Validation: all 38 settings tests, TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Production Chrome checks at 1440px, 768px, 390px and 320px confirm aligned transparent sections, consistent 40px field heights, responsive grids, bounded timezone dropdowns and no horizontal overflow. Logo upload/removal, cross-tab draft retention and saving pass with no page errors. Reviewed desktop/mobile screenshots in `/tmp/dispatra-general-*.png`. No API or stored-data migration changes.

### September 20: Save Settings label

Renamed the Company save action to Save Settings and updated its test expectations and specification. Its save behavior and other settings-page action labels remain unchanged.

Validation: all 38 settings tests, TypeScript, production build and diff checks pass, with the existing bundle-size advisory. No browser run was needed for this label-only change.

### September 20: Transparent Company sections

Company General and Taxes now use the shared app-panel-plain variant, removing white card backgrounds while retaining the existing unpadded alignment. Removed the redundant Company-tabs padding override wrapper. Fields and controls keep their own surfaces.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Confirmed all five Company section containers use the existing shared plain variant. No new tests or browser run were needed for this presentation-only change.

### September 20: Plain Help layout and topic dropdown

Removed Help section card backgrounds and inner padding using app-panel-plain, removed nested shortcut cards, and aligned FAQ questions/answers with the page content. Replaced the horizontally scrolling topic buttons with the shared Select to the right of SearchInput. Search and topic filtering still combine, with All Topics, clear-search and empty-result behavior preserved. Added expanded state/control relationships to FAQ buttons. The compact search placeholder fits narrow screens.

Validation: all 9 appearance tests pass, including the new Help filter, empty-result, clear-search, accordion and keyboard-selection coverage. TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Production-build Chrome checks at 1440px, 390px and 320px verify plain aligned sections, equal-height search/dropdown controls in one row, dropdown viewport bounds, combined filtering, no topic strip, no horizontal overflow and no page errors. Reviewed desktop Help and mobile dropdown screenshots in `/tmp/dispatra-help-*.png`. No support ticket was submitted and no backend behavior changed.

### September 20: Personal Details and security content cleanup

Renamed the first Profile tab to Personal Details. Removed the Active Dispatcher Session section, workstation/device label and static session metadata from the second tab, along with its unused Laptop icon import. Account credentials and 2FA content remain.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Verified the retired label/session content is absent from Profile source. No new tests or browser run were needed for this label and section removal.

### September 20: Plain Profile tab content

Removed the card backgrounds, rounded containers and inner panel padding from both Profile tabs using a reusable app-panel-plain variant. Removed the nested session card and redundant heading/form padding. Content aligns with the page heading while section gaps and form-control styling remain intact.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Production-build Chrome checks verify both tabs at 1440px and 390px: all sections are transparent, unpadded, unrounded and aligned with the page heading, with no horizontal overflow or page errors. Reviewed desktop details and mobile security screenshots in `/tmp/dispatra-profile-plain-*.png`. No new unit tests were needed for this presentation-only change.

### September 20: Profile label

Renamed My Profile to Profile in the account menu, page heading and company contact hint. Updated the menu test expectations and specification; navigation callbacks remain unchanged.

Validation: all 38 settings tests, TypeScript, production build and diff checks pass. The existing bundle-size advisory remains; the test run also emitted a duplicate rate-card fixture key warning without failures. No browser run was needed for this text-only change.

### September 20: White account card

Changed the sidebar account card's resting background to the shared white surface token. Existing hover, keyboard-focus and expanded states retain their neutral feedback colors.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. No new tests or browser run were needed for this color-only change.

### September 20: Uniform Logout menu spacing

Removed the account-menu separator gap above Logout. All four commands now use identical row spacing and the same shared menu typography (14px, normal weight) and icon dimensions (18px).

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Verified that all rows use the shared menu component/styles; no new tests or browser run were needed for this spacing-only change.

### September 20: Account popup fits the sidebar

The account popup now uses the shared DropdownMenu trigger-width option instead of a fixed 256px width. It aligns with the account card at 8px inset from the sidebar edge; the card is explicitly constrained to its parent width. Existing Settings side-flyout behavior is retained.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Production-build Chrome checks at 1440px, 390px and 320px confirm a 260px sidebar, matching 243px account card/popup widths and matching left/right edges (8px/251px), plus submenu viewport bounds and Escape dismissal. No page errors. Reviewed `/tmp/dispatra-account-width-390.png`; desktop and 320px screenshots are alongside it. No new unit tests were needed for this sizing change.

### September 20: Sidebar matches the page canvas

Changed the shared sidebar token to #fcfcfc, matching the body/page canvas in operational and authenticated workspaces. The right border and interaction states remain intact.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. No new tests or browser run were needed for this shared color-token change.

### September 20: Profile status removal and off-white page canvas

Removed the static On Duty badge and matching green avatar status dot from Profile. Added the shared app-canvas color (#fcfcfc) for html/body, page backgrounds, headers, the Profile tab strip, operational/authenticated shells and login canvas. Sidebar, control, card and floating surface tokens remain white.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Production-build Chrome verified the exact computed #fcfcfc document/page/header color, white sidebar, absent badge/status dot and no page errors. Reviewed `/tmp/dispatra-profile-canvas.png`. No new interaction tests were needed for these presentation changes.

### September 20: Remove Profile dispatch preferences tab

Removed the Dispatch & Monitor Preferences tab and its map, auto-center, sound-alert and telemetry controls from My Profile. Removed its section state and unused control imports, and updated the page description to personal details and account security. Personal details and Security & Sessions remain available; stored preference fields retain compatibility.

Validation: all 38 settings tests, TypeScript, production build and diff checks pass. The existing bundle-size advisory remains. No new tests or browser run were needed for this UI removal.

### September 20: Sidebar right border

Added a subtle 1px right border using the shared app-border color to operational and authenticated sidebars. The existing 260px border-box width and white background remain unchanged.

Validation: TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. No new tests or browser run were needed for this border-only change.

### September 20: Compact account menu and Settings flyout

Renamed the sidebar account commands to Settings and Help. Replaced the inline settings expansion with a separate flyout using shared Radix DropdownMenu components. The account menu is 256px wide; its Settings submenu is 224px and starts closed, with the current destination highlighted when opened. Hover, click/touch, Arrow Right/Left, typeahead, selection dismissal and focus restoration come from Radix. Existing shared menu rows, colors and animation timings are reused. On narrow screens, a shared overflow offset overlaps the parent as needed so every destination remains inside the viewport. The mobile sidebar yields keyboard control to open command menus. No decorative separator lines were added.

Validation: all 38 settings and 8 appearance tests pass, including portalled submenu semantics, shortened labels, keyboard navigation, active destination, outside/Escape dismissal and navigation callbacks. TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Production-build Chrome checks at 1440×1000 and 390×844 verify the menu widths, side placement, hover transfer, parent height stability, keyboard selection, outside/Escape dismissal, focus restoration, mobile viewport bounds and navigation, with no page errors. Reviewed `/tmp/dispatra-account-flyout-desktop.png` and `/tmp/dispatra-account-flyout-mobile.png`. Exact ChatGPT signed-in menu measurements were unavailable; widths are local design choices, not verified pixel parity. Added `@radix-ui/react-dropdown-menu`; no API change or deployment.

### September 20: Company tab content alignment

Removed nested panel padding within Company General and Taxes by scoping the shared panel-padding token to zero. Section headings and fields now align with the page heading and content margins; existing section gaps and other settings pages retain their spacing.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Local production-build Chrome checks confirm zero nested padding, aligned section/page headings and no horizontal overflow in both tabs at 1440px and 390px widths, with no page errors. Reviewed the updated Taxes screenshot in `/tmp/dispatra-company-padding-1440-Taxes.png`.

### September 20: White sidebar background

Changed the shared sidebar background token to white (#ffffff), covering operational and authenticated workspace sidebars on desktop and mobile. Existing neutral hover, selection and account-card backgrounds remain intact.

Validation: TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Confirmed both sidebar implementations use the shared token. No new tests or browser run were needed for this color-only change.

### September 20: One company-wide Tax / GST rate

Company → Taxes now shows one Tax / GST percentage and the optional company GST registration number, with no province table or provincial review copy. The shared settings editor validates 0–100%, including decimals and zero, and retains drafts across tabs. New orders and explicit order edits/repricing use the company rate across all provinces. The pricing example displays the actual configured rate. Province-based tax prompts are absent from new order forms; address parsing remains available for routing data.

Saved quotes and finalized prices retain their frozen tax decisions, including hourly settlement. Historical province/profile calculations remain for compatibility. New settings start at 5%; older settings preserve a valid BC override from the previous Vancouver default. Imports, claimed exemptions and explicitly flagged special tax treatment still require review. No API contract or authenticated booking behavior changed.

Validation: 8 company-tax, 20 historical-tax, 43 pricing and 38 settings tests pass. The Order-form suite passes the updated company-rate address-entry test and has the same 3 previously documented failures (old empty-estimate copy, Route distance control and Priced on copy). TypeScript, production build and diff checks pass; the existing bundle-size advisory remains. Production-build Chrome checks and screenshot review at 1440×1000 and 390×844 verify one percentage field, no table, draft retention, save/reload, mobile bounds and no page errors. Screenshots: `/tmp/dispatra-single-tax/desktop.png` and `/tmp/dispatra-single-tax/mobile.png`. No deployment performed.

### September 20: Remove duplicate page-header Monitor navigation

Removed the Back to Monitor button and arrow from the shared PageHeader across all operational/settings pages. Headers render an action container only when page-specific actions exist. Removed unused navigation props from page components, settings layout and App wiring; the Dispatra brand retains the existing guarded Monitor navigation. The shipper detail drawer's contextual map action remains functional.

Validation: all 8 appearance, 38 settings and 43 pricing tests pass, including the updated header assertion and existing brand navigation coverage. TypeScript, production build and diff checks pass, with the existing bundle-size advisory. No new browser run was needed for the shared header removal.

### September 20: Shippers, Analytics and centered page structure

Renamed Customers to Shippers and Reports to Analytics in the operational sidebar and corresponding page headings. Shipper summaries, search, creation/edit fields, dialogs, notifications and actions use the new terminology; the Analytics table/export heading uses Shipper. Authenticated dispatcher navigation and account management also display Shippers. Existing navigation IDs, customer models, storage, API endpoints and customer portal URLs remain unchanged.

Matched the supplied Scheduled-page reference with centered reading columns, responsive space above headings, 28px desktop / 24px mobile titles, 16px descriptions and aligned actions. Headings and content scroll together on one page canvas. Company, Services & Dispatch, Profile, Help, portal account settings and short Pricing sections use 48rem; operational tables, Analytics and the two-column Rate Cards editor retain the wide canvas. Tabs can declare a reading width without unmounting drafts. No decorative section dividers were added.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. All 38 settings and 8 appearance tests pass. Updated the sidebar test for the supplied PNG mark and verified Shippers/Analytics retain their existing navigation callbacks. Updated portal journey labels for the rename; the API-backed portal journey was not rerun. Final production-build Chrome checks at 1854×928 and 390×844 verify the renamed navigation/pages/create form, centered 768px reading columns with equal gutters, heading scale/top position, pricing draft preservation across width changes, full-page scrolling and mobile bounds with no page errors. Reviewed screenshots in `/tmp/dispatra-centered-layout/`, including Shippers, Analytics, Profile, Company, pricing costs and mobile views. No API change or deployment was performed.

### September 20: Supplied Dispatra branding assets

Replaced the placeholder SVG in shared `BrandMark` with `public/dispatra.png`, covering the operational sidebar, authenticated portal sidebar and login page. The mark keeps its 28px layout and uses multiply blending so the supplied image's white background blends into the light sidebar. Existing accessible brand labels and home navigation are retained. Added the explicit `/favicon.ico` browser-icon link in `index.html`.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. Verified the built logo/favicon are byte-identical to the supplied assets and the built HTML includes the favicon link. No new interaction tests or live browser checks were needed for this asset substitution.

### September 20: Consistent sizing and spacing without section dividers

Removed decorative horizontal dividers from sections, summary strips, menu groups, popup headers/footers, profile/preferences, pricing forms and authenticated portal lists. Table separators remain table-owned. Company, Profile and Help now use the shared 48rem reading canvas; authenticated account settings use the same width. Settings/Profile/Help panels share borderless surfaces and padding. Page gutters, section spacing, panel/dialog radii, field/action heights and menu/dialog widths have explicit shared tokens.

Replaced arbitrary 9–12px application text with the 13px secondary scale. Shared controls/options and form labels use 14px; section headings use 16px, standard dialog titles 18px and page titles 20px. Text fields and selects share a 40px height. FloatingPanel now has menu (280px), compact (224px), rich (384px) and automatic/trigger width presets, bounded by the viewport; standard form dialogs use 512px. Remaining Profile/Help/Orders/Drivers filter buttons use the shared neutral tab treatment and expose their pressed state. Removed outlined filter-bar containers and corrected the obsolete Billing → Taxes hint to Company → Taxes. Shared UI documentation records the sizing scale and no-decorative-divider rule.

Validation: TypeScript, production build and diff checks pass, with the existing bundle-size advisory. All 8 appearance and 38 settings tests pass. Final production-build Chrome checks pass at 1440px and 390px with no page errors: shared menu/dialog widths, 14px option text, 16px section/18px dialog headings, 40px fields, borderless summaries/panels, neutral filter selection and mobile viewport bounds. Reviewed screenshots for Company, Taxes, Profile, Help, driver creation, account menus, Monitor menus and Orders in `/tmp/dispatra-sizing-visual/`. Full domain suites were not rerun for this appearance-only change; their previously documented baseline Order-form failures remain unresolved. Exact pixel parity with ChatGPT is not verified because the reference browser previously received HTTP 403. No deployment or API change was performed.

### September 20: Shared menu and navigation components

Consolidated menu behavior into `FloatingPanel`, built on the existing Radix popover primitives. Account, Monitor summaries, search, notifications, map settings, driver actions and all `Select` fields now share portalled placement, viewport collision handling, bounded scrolling, outside/Escape dismissal, focus handling and animation. Removed duplicate account/select positioning and document listeners. The mobile account menu uses a nested modal focus scope; the sidebar yields keyboard handling to the active popover. Entity dialogs ignore closing/hidden popovers when handling Escape.

Added reusable `MenuItem`, `MenuList`, `MenuSeparator`, `MetricTrigger` and `Tabs`. Company and Pricing share linked, keyboard-operated tabs with their existing draft lifetimes. Menu arrows/Home/End skip disabled commands. Selects support typeahead, long labels and an empty state while retaining focus on their combobox. Monitor search fields reuse `SearchInput`; 23 primary actions now use `Button`. Order-filter labels use sentence case without changing stored values. `src/components/ui/README.md` and `spec.md` document the required shared patterns for future screens.

Validation: all 8 appearance, 38 settings and 7 date-picker tests pass. Five entity-form scenarios pass; the same three previously verified baseline Order-form assertions still fail. TypeScript and production build pass, with the existing bundle-size advisory. Desktop/mobile headless Chrome checks have no page errors and verify menu placement, borderless metric states, font loading and navigation; screenshots are in `/tmp/dispatra-shared-visual/`. A separate production-build mobile check passes focus trapping, Escape, focus return after the closing animation, and preservation of the open sidebar. Exact visual parity with ChatGPT remains unverified; the prior reference request returned HTTP 403. No API change or deployment was performed.

### September 20: Complete control styling and motion refinement

Added shared control styles for table headings/rows, actions, tabs, fields, dropdowns, icons, floating surfaces and keyboard focus. The account card now has a compact avatar and neutral hover/open states; its wider menu animates both opening and closing without an arrow or destructive-looking Logout item. Hidden account/select menus are inert and excluded from accessibility navigation. Dispatch, map-layer and profile toggles use one `Switch` component with matching dimensions and motion. Map metric controls have no border or ring in idle, expanded or keyboard-focused states; focus uses a neutral background and underlined label. Remaining detail-view tabs, assignment selectors and actions use neutral colors while operational status colors remain.

All floating map/detail surfaces share restrained motion with reduced-motion support. Added real CSS animations for previously undefined animation utility names. Narrow-screen map controls use a second row and menus stay within the viewport; returning to Monitor from the mobile brand closes the drawer. Tables use sentence-case headings, horizontal separators and non-wrapping cells. Inter 4.1 is now bundled with its OFL license and preloaded; the prior theme named Inter without loading it, resulting in fallback typography.

Validation: TypeScript, production build and diff checks pass (existing bundle-size advisory). 113 tests passed across pricing, dates, entities, settings, appearance and the passing entity-form scenarios. The same three previously verified baseline Order form assertions still fail. New switch/select interaction tests cover keyboard operation, disabled state, selected-option announcements and hidden menus. Fixed an Escape/focus regression exposed by the entity-form tests: their dialog hook now ignores hidden, mounted listboxes.

Temporary headless Chrome checks passed at 1440px and 390px with no page errors, including loaded Inter, borderless metric focus/expanded states, navigation, dropdown rendering and mobile menu bounds. Reviewed screenshots for account, Monitor, Orders, dropdowns, Taxes and mobile Monitor/menus in `/tmp/dispatra-controls-visual/`. ChatGPT's reference page returned HTTP 403 in the comparison browser, so exact visual parity remains unverified. No deployment or API change was performed.

### September 20: Shared ChatGPT-style light appearance

Applied one neutral theme across operations, settings, login and authenticated company/customer/platform workspaces: pale-grey 260px sidebars, white page canvases, grey hover and selected states, compact borderless headers, black pill actions, rounded fields and quieter cards, menus and summary rows. Shared theme tokens replace the former blue-tinted slate palette; meaningful dispatch status colors remain. The Dispatra brand and Monitor behavior are retained. Account-card hover/focus now follows the neutral navigation palette, superseding the earlier blue states.

Authenticated workspaces use the new presentational `PortalShell`, shared brand and controls without importing prototype data or changing API authorization. Both shells support narrow-screen overlay navigation with keyboard focus trapping, Escape dismissal and focus restoration. Portal navigation preserves form drafts when the sidebar is toggled. Pointer cursors and the PanelLeft toggle remain shared throughout the client.

Validation: TypeScript and production build pass, with the existing bundle-size advisory. Across the individual suites, 131 tests pass and three Order form assertions fail; all three failures were reproduced against an isolated archive of original HEAD. They expect an estimate message, Route distance control and Priced on text absent from the original form. The stale pricing assertion now checks the existing ready-at accessible label. Three new appearance tests cover headers, portal navigation, draft preservation and mobile keyboard behavior. No connected browser was available for visual verification, so pixel-perfect matching to chatgpt.com is unverified. No deployment was performed.

### September 20: Sidebar width, toggle icon and pointer cursors

Widened the sidebar and its layout slot from 224px to 260px. Both the sidebar Hide menu and viewport Open menu controls now use the same thin outlined PanelLeft icon, matching the supplied reference's simple panel shape. Shared base CSS applies `cursor: pointer` to enabled links, buttons, tabs, menus, selection controls and associated labels throughout the client, including portal pages. Disabled controls retain a non-interactive cursor; text fields and map dragging are not overridden.

Validation: TypeScript, production build and diff checks pass. The compiled stylesheet contains the 260px width and cursor rules. The existing bundle-size advisory remains; no live browser verification was performed.

### September 20: Brand returns to the default Monitor page

Monitor remains the application's initial page. Removed its separate sidebar navigation item, so the list starts with Orders. The sidebar logo and Dispatra wordmark now form one accessible button that returns to Monitor and closes the account menu. It uses the existing navigation callback, retaining unsaved-settings protection; Enter and Space also activate it. The adjacent Hide menu control remains separate.

Validation: all 38 settings interaction tests, TypeScript, production build and diff checks pass. New coverage verifies the remaining sidebar items, logo and wordmark clicks, keyboard activation and the separate collapse control. The existing bundle-size advisory remains.

### September 20: Account-card focus colors and border

Removed the account card's resting border. Its idle fill is slate-50, matching the other sidebar items' hover background. Open and keyboard-focused states use blue-50, matching active sidebar items. An inset blue focus ring appears only for keyboard focus. Account menu behavior is unchanged.

Validation: TypeScript, production build and diff checks pass. The existing bundle-size advisory remains.

### September 20: Persistent account-card background

The sidebar account card now has a visible light slate background and subtle inset border even when closed. Hover and open states use a stronger slate fill. Previously the background appeared only while the menu was open or the card was hovered. The menu position and dismissal behavior are unchanged.

Validation: TypeScript, production build and diff checks pass. The existing bundle-size advisory remains.

### September 20: Account Notifications item removed

Removed the duplicate Notifications action and count badge from the sidebar account menu, along with its unused Bell icon import. The Monitor notification control over the map remains in `DateControl`. Account menu positioning, active-card styling and dismissal behavior are unchanged.

Validation: TypeScript, production build and diff checks pass. The existing build bundle-size advisory remains.

### September 20: Account menu position and dismissal

The sidebar account card uses a subtle slate background and inset border while open. Its menu is anchored above the card with a 12px gap instead of a fixed offset from the full footer, keeping it clear of the card and dispatch switch. Pointer presses outside the card/menu close it, including clicks elsewhere in the sidebar. Internal submenu clicks stay open; the account card toggles it. Escape closes it and restores focus to the card. The trigger exposes its expanded state and associated menu to assistive technology.

Validation: all 37 settings interaction tests, TypeScript and production build pass (existing bundle-size advisory). The new interaction test covers opening, internal submenu clicks, outside dismissal, trigger toggling, dispatch-switch dismissal and Escape focus return. No connected browser was available for visual verification; no deployment was performed.

### September 20: Customer payment terms; Billing page removed

Default Payment Terms now appears in the Customer/Shipper create and edit form alongside the rate card and billing email. COD, Net 15, Net 30 and Net 45 save on the individual customer; existing Net 7/60 terms remain selectable when editing those customers. New forms use the stored organization default, and older inherited terms resolve to that saved value when editing. Invoice previews use the shared payment-term resolver and retain terms from frozen pricing context.

Removed the Billing page, its form section and its Organization Settings destination. The submenu now contains Company, Services & Dispatch and Pricing. Existing quote-validity values remain in background configuration; saved billing configuration and historical quotes are preserved. Company General/Taxes tabs are unchanged.

Validation: 36 settings tests, 15 entity/workflow tests, TypeScript and production build pass (existing bundle-size advisory). Coverage includes customer creation/edit/reload, legacy terms, removed Billing navigation, due dates for each supported term and frozen invoice behavior. The previously recorded unrelated pricing-suite assertion was not rerun. No browser verification, API change or deployment was performed.

### September 20: Company General and Taxes tabs

Company now opens on General, containing Company Details, logo, Currency & Units and the organization time zone. Taxes contains Tax Registration followed by the province tax-rate table moved from Billing. Both tabs share the existing draft and Save company settings action, with keyboard navigation and cross-tab rate validation. Billing now contains only Invoicing, without a tab row. Existing storage keys, saved rates and pricing calculations are unchanged. Settings descriptions, `spec.md` and `automatic-tax.md` reflect the new locations.

Validation: all 35 settings interaction tests, TypeScript and production build pass (existing bundle-size advisory). Settings coverage includes tab ownership, keyboard navigation, shared draft saving, persisted rates, cross-tab invalid-rate rejection and invoicing save isolation. The full test command stops in the pricing suite on the unrelated Order form `/Ready at/` assertion; the unchanged form uses lowercase `ready at` in its accessible label. No browser verification or deployment was performed.

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
