# Company Tax / GST — September 20, 2026

Company → Taxes has one company-wide Tax / GST percentage and an optional GST registration number. There is no province table or province-based selection for new quotes. The configured rate applies to taxable lines regardless of pickup or delivery province; the number is printed on invoice previews and does not enable or disable tax.

## Configuration and pricing

The rate accepts 0–100%, including decimals. Blank, negative, non-finite and greater-than-100 values cannot be saved; invalid persisted rates produce Needs Attention instead of an invoice. New settings default to 5%. Upgrading older settings preserves a valid BC override from the previous Vancouver defaults, otherwise uses 5%. Once present, the company rate takes precedence, including zero. Other provincial overrides remain stored only for historical compatibility.

New orders, explicit order edits and Re-price use company tax through the central pricing engine. Entered rates are before tax. Existing taxable-line selection, discount allocation and cent rounding remain unchanged. The rate-card worked example uses the same decision and displays the configured percentage. Imports, claimed customer exemptions and explicitly flagged special freight retain their review requirement.

## Saved quotes and addresses

Quotes freeze the company rate, registration details and `company-tax-v1` decision in their pricing context. Later settings changes affect new pricing only. Hourly settlement uses the frozen rate. Historical destination-based and profile-based quotes retain their original tax until explicitly edited or repriced; their legacy calculation remains available for settlement. Finalized snapshots and invoice previews are not rewritten.

Province information is still parsed for address/routing data, and changed address text clears stale jurisdiction and map coordinates. Province details, Quebec locations and mixed-province deliveries do not select or block the company rate. Route-stop reordering does not change tax. Changed quoted destinations still require explicit repricing before hourly settlement.

This behavior applies to the local dispatch prototype at `/` and `/prototype`. Authenticated booking, backend invoice issuance and a live tax-service integration are outside this slice. The configured rate is an organization setting, not a jurisdictional tax determination.
