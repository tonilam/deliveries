# AG Grid click

## Problem

Edit and Delete inside an AG Grid cell did not receive clicks, and the pointer cursor never appeared on them. In the element inspector, `comp-id` on the row and cell kept changing. Buttons outside the grid, using the same button classes, worked.

## Problem-solving mind-map

```mermaid
mindmap
  root((Grid button dead and comp-id changes))
    What it looked like
      Click never reaches the button
      Cursor stays the arrow
      comp-id replaced while the pointer is still
    Paths that were not the cause
      Row hover overlay
        Its pseudo-element already has pointer-events none
      Scrollbars
        Turning scroll off did not stop comp-id
        Turn scroll back on
    What the evidence showed
      Change detection ran continuously while the pointer was still
      Each pass built a new row array per category
      rowBuildCount stayed a multiple of the check count
    Why that recreates the DOM
      AG Grid treats a new rowData reference as new data
      Without getRowId it destroys rows and cells
      New cells get a new comp-id
      Creating the Angular cell renderer schedules another check
      The loop never stops so the button under the cursor is replaced
    Fix
      Cache one row array per category until the catalogue changes
      Use one stable empty array when a category has no rows or columns
      Pass a stable getRowId from the row id
      Keep column defs and the cell renderer class on a stable reference
      Do not allocate column or row arrays in the template
```

## Apply this

- Do not call a method from the template that returns a fresh `rowData` or `columnDefs` array on every check.
- Set `[getRowId]` to a stable function that returns the same id for the same row.
- Do not update parent state from `onRowDataUpdated`, `onModelUpdated`, `onGridSizeChanged`, or a cell renderer.
- Do not call `redrawRows()` or `refreshHeader()` on a timer or from those events.
- Define the cell renderer class and `cellRendererParams` once on the cached column definition, not inline in the template.
