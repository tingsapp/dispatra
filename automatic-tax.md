# Automatic destination tax — September 17, 2026

New orders at `/` and `/prototype` use the shared pricing engine for destination tax. This does not add authenticated customer booking, backend invoice issuance, or a tax-service integration.

## Supported calculation

The product assumes tax applies to all new supported domestic freight quotes, per the user-approved simplification. Legacy registration choices no longer disable tax or block pricing; the GST/HST number is optional invoice information. Ordinary domestic carrier freight with pickups in Canada and all deliveries in one supported province receives GST/HST based on the delivery province: ON 13%; NS 14%; NB, NL and PE 15%; AB, BC, SK, MB, NT, NU and YT 5%. All stops must have consistent country/province evidence. Same-province multi-stop orders use one treatment. New quotes treat entered rates as before tax and add GST/HST to the subtotal, ignoring the retired inclusive-price setting. Existing line taxability, discount allocation and rounding stay in the shared engine. Frozen historical quotes retain their original inclusive treatment during settlement. This assumes Accessorials and surcharges are part of the freight supply; standalone goods/rentals or other special treatment require review.

The versioned rules apply to pricing dates from April 1, 2025 onward. The supplied rate defaults were checked September 17, 2026; they do not update online. Billing → Taxes allows company overrides from 0–100%, including decimals, saved through Save billing. New quotes use saved overrides; missing overrides use the supplied defaults. Quebec remains unsupported. Quotes save the resolved profile and rule version in their context. Hourly settlement uses that saved decision. Older dates are unsupported rather than assigned current rates. Transition-period invoices require separate review.

## Address and exception handling

Address entry extracts a recognizable province suffix and/or Canadian postal code. Country/province can be confirmed explicitly; evidence that disagrees produces an error. Postal prefixes shared by NT/NU need a province. Street/city existence is not verified, and no geocoding or address-autocomplete provider was added. Changing address text clears old jurisdiction and map coordinates. Route stop reordering does not change tax.

Incomplete/conflicting locations, international movements, Quebec GST/QST, multiple destination provinces needing charge allocation, imported prices, claimed customer exemptions, and explicitly flagged special freight generate Needs Attention. No final invoice or assignment is allowed from unresolved pricing. The UI supports recording these orders for review; it does not yet provide a tax allocation/exception approval workflow.

The Taxes tab shows editable province rates; the optional company GST/HST number is entered under Company. There is no tax-inclusive price checkbox. Legacy profiles remain stored for historical records, but profile management and the customer profile selector are removed. Existing quotes/final snapshots are not recalculated. Existing orders without destination mode retain their legacy profile behavior; no silent migration occurs.

## Primary references

- [CRA freight-carrier guidance](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-specific-situations/freight-carriers.html): domestic freight, international/continuous movements, interlining and incidental supplies.
- [CRA transportation place-of-supply rules](https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/3-3-7/plc-spply-prvnc-trnsprttn.html): delivery destination and reasonable charge allocation for destinations in multiple provinces.
- [CRA GST/HST rates](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html): current rates and Nova Scotia transition.
- [Revenu Québec freight services](https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/special-cases-gsthst-and-qst/transportation-applying-the-gst-and-qst/freight-carriers/freight-transportation-services/): separate Quebec treatment; not automated here.
- [Canada Post postal-code guidance](https://www.canadapost-postescanada.ca/cpc/en/support/articles/addressing-guidelines/postal-codes.page): province/territory prefix mapping.
- [BC PST exemptions](https://www2.gov.bc.ca/gov/content/taxes/sales-taxes/pst/exemptions/exemptions-documentation): courier/freight services, distinct from taxable goods or rentals.
