# Truckit Storybook catalog

Index: `https://component.truckitmetro.com/storybook/index.json`  
Docs URL pattern: `https://component.truckitmetro.com/storybook/?path=/docs/<story-id>`

Library package: `truckit-component-library`  
Source layout (for mental model): `projects/truckit-component-library/src/lib/components/<name>/`

## Components

| Storybook title | Docs story id | Example stories |
| --- | --- | --- |
| Components/Accordion | `components-accordion--docs` | Chevron, Plus Minus, Multi Open |
| Components/Alert | `components-alert--docs` | Info, Success, Warning, Error, Dismissible, All Variants |
| Components/Badge | `components-badge--docs` | Filled, Transparent, Outline, With Dot, All Colors, Priority |
| Components/Breadcrumbs | `components-breadcrumbs--docs` | Default, Two Levels, Deep Path |
| Components/Button | `components-button--docs` | Primary, Secondary, Outline, Ghost, Navy, Success, Danger, Loading, Disabled, All Variants, All Sizes |
| Components/Card | `components-card--docs` | Default, Elevated, Selectable, Body Only |
| Components/Carousel | `components-carousel--docs` | Default, Looping |
| Components/Chat Bubble | `components-chat-bubble--docs` | Incoming, Outgoing, Conversation |
| Components/Checkbox | `components-checkbox--docs` | Default, Disabled, Group |
| Components/Date Picker | `components-date-picker--docs` | Default, Disabled |
| Components/Date Range Picker | `components-date-range-picker--docs` | Default, Disabled |
| Components/Dropdown Menu | `components-dropdown-menu--docs` | Default, With Disabled Item |
| Components/Empty State | `components-empty-state--docs` | Default, No Results |
| Components/File Upload | `components-file-upload--docs` | Empty, With Files |
| Components/Icon Button | `components-icon-button--docs` | Ghost, Primary, Danger, All Variants |
| Components/Input | `components-input--docs` | Default, With Helper Text, Error, Success, Small, Disabled |
| Components/Modal | `components-modal--docs` | Confirm, Destructive, Form Modal |
| Components/Navigation Bar | `components-navigation-bar--docs` | Logged Out, Logged In |
| Components/Notification List | `components-notification-list--docs` | Default, All Read, Empty |
| Components/Pagination | `components-pagination--docs` | Default, Middle Page, Many Pages, Few Pages |
| Components/Progress Bar | `components-progress-bar--docs` | Default, With Label, All Colors |
| Components/Radio | `components-radio--docs` | Default, Disabled, Group |
| Components/Rating Stars | `components-rating-stars--docs` | Interactive, Readonly Half, Sizes |
| Components/Select | `components-select--docs` | Default, Error, Disabled |
| Components/Skeleton | `components-skeleton--docs` | Text, Circle, Rectangle, Card Placeholder |
| Components/Spinner | `components-spinner--docs` | Default, All Sizes |
| Components/Stat Card | `components-stat-card--docs` | Light, Dark, Down Trend |
| Components/Step Progress | `components-step-progress--docs` | Horizontal, With Error, Vertical |
| Components/Table | `components-table--docs` | Default, Empty |
| Components/Tabs | `components-tabs--docs` | Default, With Disabled Tab |
| Components/Textarea | `components-textarea--docs` | Default, With Helper Text, Error, Disabled |
| Components/Toggle | `components-toggle--docs` | Default, Disabled, Group |
| Components/Tooltip | `components-tooltip--docs` | Top, Bottom, Left, Right |

## Advanced

| Storybook title | Docs story id | Notes |
| --- | --- | --- |
| Advanced/Data Grid (AG Grid) | `advanced-data-grid-ag-grid--docs` | Basic, pagination, selection, grouping, export, sidebar, pivot, master-detail, dark theme |

## Naming cheat sheet

| UI name | Likely selector | Likely class |
| --- | --- | --- |
| Button | `ui-button` | `UiButtonComponent` |
| Input | `ui-input` | `UiInputComponent` |
| Textarea | `ui-textarea` | `UiTextareaComponent` |
| Select | `ui-select` | `UiSelectComponent` |
| Checkbox | `ui-checkbox` | `UiCheckboxComponent` |
| Radio | `ui-radio` | `UiRadioComponent` |
| Toggle | `ui-toggle` | `UiToggleComponent` |
| Alert | `ui-alert` | `UiAlertComponent` |
| Badge | `ui-badge` | `UiBadgeComponent` |
| Card | `ui-card` | `UiCardComponent` |
| Modal | `ui-modal` | `UiModalComponent` |
| Accordion | `ui-accordion` | `UiAccordionComponent` |

Confirm exact exports from `truckit-component-library` or the Docs story if a name differs.

## Design tokens (quick)

- Spacing: 4px base (`--ui-*` space scale)
- Fonts: Open Sans (UI), JetBrains Mono (code)
- Brand primary: `#F05A28`
- Navy: `#1E3A8A`
- Semantic: success `#22C55E`, error `#EF4444`, warning `#F59E0B`, info `#3B82F6`

Prefer CSS variables from `tokens.css` over hard-coded hex in app styles.

## Refreshing this catalog

When Storybook adds components, re-fetch:

```bash
curl -s https://component.truckitmetro.com/storybook/index.json
```

Group `entries` by `title`; Docs entries have `"type": "docs"`.
