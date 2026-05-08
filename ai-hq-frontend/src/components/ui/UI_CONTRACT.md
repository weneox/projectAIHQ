# AIHQ UI Contract

This file defines the working UI contract for app pages.

## Source of truth

App pages must use these primitives instead of inventing new visual systems:

- `Button.jsx`
- `Card.jsx`
- `Input.jsx`
- `Badge.jsx`
- `AppIcon.jsx`
- `AppStatCard.jsx`
- `AppStatusText.jsx`
- `AppIconButton.jsx`
- `AppCompactActionButton.jsx`
- `AppTableFilters.jsx`
- `AppPaginationFooter.jsx`
- `AppShellPrimitives.jsx`

## Icon rule

Default icons are naked line icons.

Do not wrap normal page/table/action icons inside gray pills.

Icon containers are only allowed in:
- stat cards
- empty states
- avatar or identity placeholders

## Page rule

Pages should own data and composition, not visual language.

Allowed:
- grid/flex/gap/layout classes
- page-specific column widths
- data mapping

Avoid in pages:
- new raw button designs
- new raw input designs
- new raw card/panel designs
- new table filter designs
- new badge/status designs
- arbitrary rounded/shadow visual systems

## Table rule

If a page needs filters, status text, row actions, or pagination, it should use the app table primitives.
