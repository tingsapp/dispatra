# Company GST/HST and Provincial Tax — September 24, 2026

Taxes & Preferences has separate optional GST/HST and provincial tax percentages. The optional GST/HST registration number is edited in Profile → Taxes & Preferences. GST/HST retains the existing company rate and starts enabled; provincial tax starts disabled at 0%. Each enabled tax appears as its own line. There is no province table or province-based selection for new quotes. Each enabled rate applies to taxable lines regardless of pickup or delivery province; the registration number is printed on invoice previews and does not enable or disable either tax.

## Configuration and pricing

Each enabled rate accepts 0–100%, including decimals. Blank, negative, non-finite and greater-than-100 enabled values cannot be saved; invalid persisted enabled rates produce Needs Attention instead of an invoice. Disabled rates are ignored. New settings start with GST/HST at 5% enabled and provincial tax at 0% disabled. Upgrading older settings preserves a valid BC override for GST/HST from the previous Vancouver defaults, otherwise uses 5%. Once present, the saved GST/HST rate takes precedence, including zero. Legacy destination-based provincial overrides remain stored only for historical compatibility.

New orders, explicit order edits and Re-price use company tax through the central pricing engine. Entered rates are before tax. Existing taxable-line selection, discount allocation and cent rounding remain unchanged. The rate-card worked example uses the same decision and displays the enabled percentages. Imports, claimed customer exemptions and explicitly flagged special freight retain their review requirement.

## Saved quotes and addresses

Quotes freeze both company tax rates, their enabled states, registration details and the `company-tax-v2` decision in their pricing context. Existing `company-tax-v1` quotes retain their original decision. Later settings changes affect new pricing only. Hourly settlement uses the frozen rates. Historical destination-based and profile-based quotes retain their original tax until explicitly edited or repriced; their legacy calculation remains available for settlement. Finalized snapshots and invoice previews are not rewritten.

Province information is still parsed for address/routing data, and changed address text clears stale jurisdiction and map coordinates. Province details, Quebec locations and mixed-province deliveries do not select or block the configured company rates. Route-stop reordering does not change tax. Changed quoted destinations still require explicit repricing before hourly settlement.

This behavior applies to the local dispatch prototype at `/` and `/prototype`. Authenticated booking, backend invoice issuance and a live tax-service integration are outside this slice. The configured rates are organization settings, not a jurisdictional tax determination.
