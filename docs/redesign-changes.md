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

## Design tokens and theming

- The whole product runs on one grayscale: Tailwind **Neutral**. `gray`,
  `slate` and `zinc` are aliased onto it in `@theme`, so any utility still
  spelled the old way resolves to the same ramp.
- Colour is reserved for meaning — success, warning, error, info, destructive
  intent, and charts. The decorative brand hues (purple, sky, lime, mint,
  lavender, coral…) were removed, and the badges that used them are neutral.
- Surfaces layer in four steps in both themes. Light layers _downward_ from
  white onto a tinted page; dark layers _upward_ from a near-black page. Dark
  mode is re-picked per token rather than inverted, and avoids pure black.
- Components consume semantic tokens (`bg-surface`, `text-muted-foreground`,
  `border-subtle`) rather than scale steps. Retheming means editing
  `packages/ui/src/styles/globals.css` and nothing else.
- `ThemeProvider` + `ThemeToggle` provide light / dark / system. A blocking
  inline script stamps `.dark` before first paint so there is no flash.

## Layout scaling

- Card and stat grids use `.grid-auto-fit*` — `repeat(auto-fit, minmax(min(100%,
Nrem), 1fr))` — so the column count follows the space a card needs rather
  than a viewport breakpoint. Raising the browser font size reflows the grid
  instead of clipping the labels.
- Typography and layout dimensions use rem; px is kept only for hairlines,
  focus rings, scrollbar chrome and small icon detail.
- Verified with no horizontal overflow from 375px to 2560px, at 125/150/200%
  zoom, and at 20px and 24px root font sizes, in both themes.

## Sign-in

- The page uses a responsive split layout with a Ralli Wolf operations panel
  and a focused sign-in form.
- Unsupported Google/Microsoft buttons and the misleading demo link were
  removed.
- **Keep me signed in** was removed; the authentication cookie is now always
  session-scoped and ends with the browser session.
- Sign-in is two steps. A correct password no longer creates a session: it
  emails a single-use 6-digit code, which the second step exchanges for one.
  The old password-or-email-code chooser, and the passwordless
  `POST /auth/login/otp/request` endpoint behind it, are gone.
- Sign-in failures are reported by toast, and name the actual problem
  (unknown email, wrong password, deactivated account, expired code) rather
  than a single "invalid email or password".

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
