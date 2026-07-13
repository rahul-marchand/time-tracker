# Changelist: Monthly view bar columns unequal width (days 1–9 half-width)

**Status:** Shipped in v0.3.0
**Severity:** Visual bug, month analytics view

## Symptom

In the month analytics chart, bars for days 1–9 are about half the width of
bars for days 10–31. Column width tracks the day-number label width instead of
being uniform.

## Root cause

`.week-col` is the flex item for each day and uses `flex: 1` (= `flex: 1 1 0`),
which is intended to make every column equal width:

```css
/* styles.css:406 */
.week-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 96px;
}
```

But a flex item's default `min-width` is `auto`, so it **cannot shrink below its
own min-content width**. Each column contains the day-number label
(`analytics-section.ts:186`, `label: i.toString()`), rendered by:

```css
/* styles.css:420 */
.week-label { font-size: 0.7em; text-align: center; /* ... */ }
```

In month mode the chart holds ~28–31 columns in the narrow sidebar
(`.week-chart--month` only shrinks the gap to 2px, `styles.css:402`). The equal
`flex-basis: 0` share is narrower than a rendered label, so `min-width: auto`
takes over and each column is held to at least its label's width:

- Days `1`–`9`  → 1-digit min-content → narrow column
- Days `10`–`31` → 2-digit min-content → ~2× wider column

Hence the uneven bars. Week view is unaffected because its 7 columns are wide
enough that the equal share already exceeds a single-letter label.

## Fix

Allow the columns to shrink below content so `flex: 1` distributes evenly:

```css
.week-col {
    flex: 1;
    min-width: 0;   /* <-- add: overrides default min-width:auto */
    display: flex;
    flex-direction: column;
    height: 96px;
}
```

The day label then centres within its equal-width column.

**Follow-up (shipped with the fix):** with uniform columns (~8px in a narrow
sidebar) two-digit labels overlapped their neighbours. Solved by tick thinning
in `getMonthDailyData` — only days 1, 5, 10, 15, 20, 25, 30 and today are
labelled (a tick adjacent to today is suppressed), with `white-space: nowrap`
on month labels so a label bleeds into its unlabeled neighbours instead of
wrapping. Text size is unchanged.

## Test plan

1. Open the month view on a 30/31-day month → all day columns are equal width;
   days 1–9 match days 10–31.
2. Bars still stack colours and scale height correctly (unchanged — only the
   column min-width is touched).
3. Week view unchanged (7 equal columns).
4. Check narrow (<160px) and wide (>300px) sidebar widths via the container
   queries — columns stay uniform at both.

## Scope

- Single CSS line (`min-width: 0` on `.week-col`). No TS changes.
- Ships in the same rebuild as other pending fixes; bump version once when
  batching. Copy `main.js` (unchanged here), `manifest.json`, `styles.css`
  into the vault plugin dir on release.
