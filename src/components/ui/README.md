# Shared UI patterns

Use these components for operational pages and authenticated portals. Keep business logic and API/store access in their callers.

| Need | Component | Behavior |
| --- | --- | --- |
| Page startup | `PageLoading` | Full-viewport centered loading status for app, session and workspace startup |
| Fixed prefix input | `PrefixedInput` | One standard field surface with a fixed prefix; shared native-input styling and focus/invalid/disabled states |
| Action | `Button` | Shared primary, secondary, outline and destructive variants, disabled and focus states |
| Menu or rich dropdown | `FloatingPanel` | Portalled placement, viewport collision handling, scroll limits, outside dismissal, Escape, focus return and reduced-motion animation |
| Command menu with flyouts | `DropdownMenu` | Radix menu semantics, hover intent, pointer transition protection, typeahead, keyboard navigation, touch, portalled submenus and collision handling |
| Commands within a menu | `MenuList`, `MenuItem`, `MenuSeparator` | Consistent rows and icons; Arrow Up/Down and Home/End navigation skip disabled commands |
| Choose one value | `Select` | Combobox/listbox semantics, typeahead, arrow navigation, disabled options, selected checkmark and empty state |
| Switch local sections | `Tabs` | Linked panels, one tab stop, arrow/Home/End navigation and optional mounted draft preservation |
| Filter a list | `SearchInput` | Search icon, accessible label and clear action |
| Boolean preference | `Switch` | Shared dimensions and checked, disabled and keyboard states |
| Monitor summary trigger | `MetricTrigger` | Consistent count/icon/label layout and borderless expanded/focus states |
| Date/time input | `DatePicker`, `TimePicker`, `DateTimePicker` | Shared calendar and popover primitives |
| Confirmation | `confirmDialog` | Accessible app dialog; do not use browser confirmation prompts |

Use `DropdownMenu` for command menus with side-opening submenus, and `FloatingPanel` for mixed controls or rich content, rather than positioning menus inside overflow containers or adding page-specific document event listeners. Leave `focusOnOpen` enabled for command menus; searchable panels may set `autoFocusSelector="input"`. `Select` intentionally retains focus on its combobox for active-option announcements. Triggers must forward their props and ref to a native button.

Use `DropdownMenuItem` inside command menus, `MenuItem` for actions in rich panels and `Select` for value selection; do not apply fake menu roles to forms. A menu may contain native switches or a search field. Close a command menu after completing its action; keep preference menus open while changing several settings.

Use `Tabs` with `keepMounted` for sections that own unsaved drafts. Company intentionally mounts only its visible section because its editor owns the shared draft outside the tabs. Filters use pressed buttons rather than tab semantics unless they control linked panels.

Tables use `app-table` and `app-table-shell`: transparent backgrounds, regular 13px muted headers and 14px body text, 60px minimum rows, 16px horizontal padding, and subtle horizontal separators, following the supplied ChatGPT Library screenshot. Use 12px outer corners only for table containers and row hover highlights, with separate zero-spaced borders. Individual cells and headers stay square. Separators form straight continuous lines inset 16px at both row ends, including headers, so they remain inside rounded hover corners. Cell pseudo-elements draw the line without intercepting input; only the first and last cell apply the inset. Hover paints one continuous row with rounded outer ends. Controls retain their own keyboard focus indicators; do not add rounded per-cell surfaces. Keep outer borders, shadows and filled header bands off tables. Editable package and zone-price grids add `app-table-editable` for 8px cell gutters and minimum input widths while sharing the same typography, rows and separators. Fields and semantic status indicators retain their control surfaces. Fields use `app-input`; panels use `app-panel`. Tokens live in `src/styles/theme.css`, and control states/motion in `src/styles/controls.css`. Change these shared definitions instead of introducing per-page colors, shadows, focus rings or animation timings. Use sentence-case option labels while retaining canonical values in data. Keep semantic warning/status colors and accessible keyboard focus.

Operational lists (Orders, Drivers, Shippers and Vehicles) use `ListSummary` for equal-sized white summary cards with muted labels above compact 22px neutral totals. Cards use the table divider/radius tokens, no shadow, 12px vertical/14px horizontal padding and 8px gaps; the grid aligns with the table edges and wraps into two columns on mobile. Keep explanatory captions out of these cards. Cards include simple 16px Lucide line icons beside labels, without background boxes, hidden from assistive technology because the adjacent label identifies each metric. Analytics uses four of the same cards for Total, In progress, Completed and Canceled counts, with exactly three Recharts panels: a Delivery performance donut at 4/12 width beside the Orders, drivers & shippers multi-line chart at 8/12 width, then a full-width black Order sources chart. The panels stack on mobile. Analytics has one description below its page title; chart subtitles and explanatory captions are omitted. The date menu updates all charts and summary cards; no order table or CSV action appears in Analytics. Use `app-list-page` for compact desktop top spacing and `app-list-toolbar`, `app-list-search`, `app-list-filters` and `app-list-status` for wrapping search/filter controls. Mobile search occupies its own row; tables retain contained horizontal scrolling.

Use spacing to separate sections, popup headers/footers and menu groups. Do not add `border-t`, `border-b`, `divide-y` or horizontal rules outside data tables. `MenuSeparator` is a spacing gap. Use `app-panel app-panel-plain` for form sections that should sit directly on the page canvas, without a card background, rounded container or inner padding. Settings panels have no outline; field borders and semantic status treatments remain available.

Use `text-sm` (14px) for controls and menu options and `text-xs` (13px) for secondary information; avoid arbitrary 9–12px text. Section headings are 16px, dialog titles 18px and page titles 28px on desktop / 24px on mobile. `app-page-reading` sets the shared 48rem canvas for reading/form pages; `page-content` keeps titles and content aligned with responsive gutters. Use `app-form-dialog` for standard forms. `FloatingPanel` accepts `size="menu"` (default, 280px), `compact` (224px), `rich` (384px) and `auto` (selects that follow their trigger). All floating sizes remain bounded by the viewport. These are Dispatra's shared design choices; they are not a verified measurement of ChatGPT's current UI.

Map-anchored entity detail cards retain their geographic positioning and use `useOverlayMotion`; menus opened from those cards use `FloatingPanel`.

Run `tests/appearance.test.ts` and affected interaction suites for behavioral changes. Verify portalled menus at desktop/mobile widths and near viewport edges in a browser; DOM-only tests cannot verify clipping or positioning.

Page headings and content share the scrolling `.app-page` canvas and its responsive top spacing. Keep `.page-content` as the direct body/header gutter so both align. Keep all Pricing tabs on the same wide canvas as Rate Cards; do not assign per-tab reading widths. The shared `TabItem.pageWidth` option remains available for other layouts, and width changes must not remount forms. Reading columns use 48rem, while dense operational tables and two-column editors use the wider workspace. This layout follows the supplied Scheduled-page screenshot.

`PortalShell.headerActions` holds persistent workspace controls above the scrolling page canvas, aligned with its content width and responsive gutters. The header reserves the same scrollbar space as the canvas so wide and reading columns align. The Shipper order search and notification bell belong there; `actions` remains for page commands such as New order. Mobile menu access moves to that shared header when it is present.

`NotificationBell.surface` adds the neutral `app-icon-button-surface` background for the Shipper header. Shipper Tracking uses `PortalShell.map` for a full workspace canvas with floating header controls, the shared search input and reusable `TrackingSummary` / `TrackingDetails` in one white overlay card; order details provide a real Track link. Keep links in the dialog's keyboard focus sequence.

`PageHeader` contains the title, description and optional page actions. Do not add a Back to Monitor button; use the shared Dispatra brand navigation. Headers without actions do not reserve an action container.

The account command menu uses `DropdownMenuContent size="trigger"` to match its account card width and edges within the sidebar, with 8px collision padding and direct Profile, Pricing, Help and Logout rows using the shared menu surface, typography and animation tokens. These widths are local design choices; exact ChatGPT account-menu measurements have not been verified.

Desktop sidebars collapse to the shared 64px rail token. Use `SidebarHeader` for the brand and expanded-state collapse control. The collapsed logo itself expands the sidebar without navigating; there is no separate expand icon. Retain visually hidden navigation labels, accessible names and hover titles. In the operational rail, the account menu uses the normal `menu` width and opens to the right with room beyond the rail edge; it must not shrink to the avatar trigger width. Mobile keeps the existing modal drawer and page-level open control.

Use `app-canvas` (#fcfcfc) for the document background, page canvas and page headers. Keep `app-surface` white for cards, fields and floating surfaces, and `app-sidebar` #fcfcfc to match the page canvas. Avoid hardcoded white strips in page-level layouts.


## Consistent component styling

Use the existing Dispatra components as the visual baseline. Ordinary fields and primary actions are 40px high; compact actions and editable zone fields use the shared 36px variant. Keep controls and table values at 14px, secondary labels at 13px, section headings at 16px/medium and dialog titles at 18px/medium. Preserve larger page titles and meaningful status colors.

Use `app-input` for native inputs/textareas, `app-label` for standalone field labels, `app-checkbox` for native checkboxes, `SearchInput` for search, and the existing `Select`/date components for choices. Use `Button` or `app-action` with `app-primary`, `app-secondary` or `app-danger`; `app-action-compact` is the small action variant. Date triggers use `app-field-trigger` to retain field-shaped corners. Keep positioning and icon gutters in callers, but avoid repeating colors, borders, font sizes or focus rings.

Use `app-section-title` for section headings, `app-panel` for borderless white content cards and `app-panel-plain` for sections directly on the canvas. Selected card rows use `app-choice-row` with `aria-pressed`; disclosures use `app-disclosure` with its trigger/content classes. Zone tables retain their compact layout and 70px numeric minimum, using the same typography, field corners and panel padding.

Dialog scrims and surfaces use `app-dialog-backdrop` and `app-dialog-surface`. Side drawers add `app-drawer` for corners on the exposed side. Their widths, scrolling and focus behavior remain in the existing components. Ordinary menus use the shared portalled `DropdownMenu`, including driver assignment; rich popovers retain `FloatingPanel`. Do not replace a menu with an absolutely positioned list inside a scrolling table.

`ShipperTrackingMap` uses the Monitor Google Maps stack and shared `StopMarkerCircle`. Its camera resolves the saved warehouse before a one-time device fallback. Use one `useOrderTracking` query for the selected order's card and authorized driver location, and road-path queries for every own New, Assigned or In progress order. Search uses the same session-scoped orders feed. Completed/Cancelled history stays searchable without map markers or road queries. The single card sits at the left and scrolls internally on mobile to leave the map accessible.
