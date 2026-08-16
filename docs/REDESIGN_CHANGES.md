# Ralli Wolf Redesign — Changes Summary

The application shell, dashboard and sign-in experience now follow the Ralli
Wolf identity and the supplied TailAdmin-style references.

## Brand and theme

- The product name and metadata use **Ralli Wolf Operations**.
- `ralli-wolf-logo.png` is the active sidebar and sign-in logo.
- The primary brand color is the logo red, `#ED1C24`; charcoal and neutral
  grays provide contrast. Green, amber and blue remain limited to semantic
  success, warning and in-progress states.
- The sidebar is a light surface with dark text, a pale-red selected row and a
  red active icon/text treatment. It is not a solid red rail.

## Responsive application shell

- Desktop navigation expands to 288px and collapses to a compact icon rail.
- Tablet and mobile navigation becomes an off-canvas drawer with a backdrop,
  explicit close control and automatic close after route changes.
- The header, inputs, buttons, panels, table rows and page gutters use a common
  size and spacing rhythm.
- Dense tables remain readable on small screens through contained horizontal
  scrolling instead of forcing the entire page wider than the viewport.

## Dashboard

The dashboard uses the supplied card-based visual language, but every number
comes from the live application APIs. It now combines:

- inventory value, available stock and stock alerts;
- warehouse workload and bin occupancy;
- material shortages by warehouse;
- BOM status and component counts; and
- posted purchasing spend, outstanding PO commitments and pending QC.

The former hardcoded activity and campaign examples were removed.

## Sign-in

- The page uses a responsive split layout with a Ralli Wolf operations panel
  and a focused sign-in form.
- Unsupported Google/Microsoft buttons and the misleading demo link were
  removed.
- **Keep me signed in** now controls whether the authentication cookie persists
  for seven days; an unchecked session ends with the browser session.

## Functional corrections found during the redesign

- Material shortage calculations no longer mix incoming quantities between
  different destination warehouses.
- Aggregate material safety stock is summed from configured warehouse rules
  rather than taking an arbitrary rule.
- Inventory expiry counts respect the selected warehouse and exclude already
  expired lots from the “expiring soon” figure.
- Purchasing spend is derived from completed posted receipts, and open
  commitment is prorated from outstanding PO line quantity rather than the full
  value of partially received orders.
- Invalid optional IDs and boolean query values now return validation errors
  instead of silently broadening a query.
- External sidebar links now pass their target through correctly, and User
  Management is shown only to system administrators.
