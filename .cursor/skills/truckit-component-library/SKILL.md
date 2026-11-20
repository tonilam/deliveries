---
name: truckit-component-library
description: >-
  Reuse Truckit Angular UI from truckit-component-library (Storybook at
  component.truckitmetro.com/storybook) instead of building custom UI.
  Use when developing Angular features, screens, forms, layouts, or any UI
  in loadplanner — buttons, inputs, tables, modals, badges, navigation, and
  design tokens.
---

# Truckit Component Library

Prefer **existing** library components over new custom UI. Source of truth:

| Resource | URL |
| --- | --- |
| Storybook | https://component.truckitmetro.com/storybook |
| Getting started | https://component.truckitmetro.com/getting-started |
| Demo / tokens | https://component.truckitmetro.com/demo |
| Showcase | https://component.truckitmetro.com/showcase |

Before inventing markup or styles, check Storybook for a matching component and variants.

## Setup (once per app)

1. **Install** from AWS CodeArtifact:

```bash
aws codeartifact login --tool npm \
  --domain truckit --domain-owner 349139559071 \
  --repository component-library --region ap-southeast-2

npm install truckit-component-library
```

Auth token lasts ~12h; re-run `aws codeartifact login` when install fails with 401.

2. **Tokens** in `angular.json` `styles` (order matters — tokens first):

```json
"styles": [
  "node_modules/truckit-component-library/styles/tokens.css",
  "src/styles.scss"
]
```

If using tooltips, also add `node_modules/truckit-component-library/styles/tooltip.styles.css`.

3. **Fonts** in global styles (library does not ship fonts):

```scss
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400&display=swap');

body {
  font-family: var(--ui-font-family);
  font-size: var(--ui-font-size-body-md);
  line-height: var(--ui-line-height-body-md);
  color: var(--ui-color-text-primary);
  background-color: var(--ui-color-background);
  margin: 0;
}
```

**Peer note:** library `0.0.1` targets Angular `^22.1.0`. Align the app before forcing install.

## Usage rules

1. **Reuse first** — map UI needs to Storybook components; do not recreate buttons, inputs, cards, tables, etc.
2. **Standalone imports** — every component is standalone; import the class into the consuming component’s `imports`.
3. **Naming** — selector prefix `ui-`, class prefix `Ui` (e.g. `<ui-button>` / `UiButtonComponent`).
4. **Inputs** — signal inputs; bind normally: `[loading]="isSaving()"`.
5. **Forms** — `ui-input`, `ui-textarea`, `ui-select`, `ui-checkbox`, `ui-radio`, `ui-toggle` work with `ngModel` and reactive forms.
6. **Slots** — content projection via attributes (e.g. `leading` / `trailing` on icons inside a button).
7. **Styling** — use `--ui-*` design tokens; avoid one-off colors/spacing that fight the token system. Brand primary is `#F05A28`; structural navy `#1E3A8A`.
8. **Lookup** — when unsure of props/variants, open the component’s Docs story in Storybook (`?path=/docs/components-<name>--docs`).

### Minimal example

```ts
import { Component } from '@angular/core';
import { UiButtonComponent, UiInputComponent } from 'truckit-component-library';

@Component({
  selector: 'app-example',
  imports: [UiButtonComponent, UiInputComponent],
  template: `
    <ui-input label="Email" placeholder="you@example.com" />
    <ui-button variant="primary" size="md">Save</ui-button>
  `,
})
export class ExampleComponent {}
```

## Workflow when building UI

```
Task Progress:
- [ ] Identify needed UI pieces from the feature
- [ ] Match each to a Storybook component (see catalog)
- [ ] Confirm variants/props from Docs story
- [ ] Import Ui* classes; use ui-* selectors
- [ ] Style with --ui-* tokens only
- [ ] Skip custom components unless nothing in the library fits
```

If nothing fits: prefer composing library primitives + tokens. Only create a local component after confirming Storybook has no equivalent; name it clearly as app-specific.

## Component catalog

Full list and Storybook IDs: [reference.md](reference.md).

Common picks:

| Need | Component | Import (typical) |
| --- | --- | --- |
| CTA / actions | Button, Icon Button | `UiButtonComponent` |
| Text / forms | Input, Textarea, Select, Checkbox, Radio, Toggle | `UiInputComponent`, … |
| Feedback | Alert, Badge, Toast patterns via Alert, Spinner, Progress Bar, Skeleton | `UiAlertComponent`, … |
| Layout / surfaces | Card, Empty State, Modal, Tabs, Accordion | `UiCardComponent`, … |
| Navigation | Breadcrumbs, Navigation Bar, Pagination, Step Progress | … |
| Data | Table, Data Grid (AG Grid), Stat Card | … |
| Dates | Date Picker, Date Range Picker | … |
| Misc | Tooltip, File Upload, Carousel, Chat Bubble, Rating Stars, Dropdown Menu | … |

## Logos

Wordmarks are not always packaged for consumer apps. Prefer app-local copies under something like `public/images/logo-brand/` rather than assuming Storybook’s `/logos/...` path.
