# Changelist: View scrolls to top on every day switch / re-render

**Status:** Shipped in v0.3.0
**Severity:** UX annoyance, timer tab

## Symptom

Switching days with the ‹ › nav (or any re-render) scrolls the panel back to the
top. Flicking through several days quickly is jarring because scroll position is
lost each time. Same jump happens once a second while a timer is running.

## Root cause

The whole view is torn down and rebuilt on every render. The scroll container is
`.timer-view` (`styles.css:72`, `overflow-y: auto`), which is created fresh each
render:

```ts
// src/ui/sidebar-view.ts:53
private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();                       // <-- destroys .timer-view + its scrollTop
    this.renderTabs(container);
    if (this.activeTab === 'timer') {
        const view = container.createDiv('timer-view');   // <-- new node, scrollTop = 0
        this.timerSection.render(view, this.viewDate);
        this.sessionsSection.render(view, this.viewDate, this.isViewingToday());
    } else { /* ... */ }
}
```

Day nav triggers a full re-render:

```ts
// src/ui/sessions-section.ts:63 / :77
prevBtn.onClickEvent(() => { viewDate.setDate(viewDate.getDate() - 1); this.timer.trigger('change'); });
nextBtn.onClickEvent(() => { viewDate.setDate(viewDate.getDate() + 1); this.timer.trigger('change'); });
```

`timer.trigger('change')` is wired to `render()` (`sidebar-view.ts:42`), so the
scroll node is replaced and `scrollTop` resets to 0.

## Fix

Preserve and restore the `.timer-view` scroll offset across the rebuild. Minimal
change, in `SidebarView.render()`:

```ts
private render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    const prevScroll = (container.querySelector('.timer-view') as HTMLElement | null)?.scrollTop ?? 0;

    container.empty();
    container.addClass('time-tracker-sidebar');
    this.renderTabs(container);

    if (this.activeTab === 'timer') {
        const view = container.createDiv('timer-view');
        this.timerSection.render(view, this.viewDate);
        this.sessionsSection.render(view, this.viewDate, this.isViewingToday());
        view.scrollTop = prevScroll;   // restore after content is built; browser clamps to max
    } else {
        this.analyticsSection.render(container, this.analyticsMode, (m) => {
            this.analyticsMode = m;
            this.render();
        });
    }
}
```

Notes:
- Restore **after** children are appended so layout height exists; the browser
  clamps an over-large value to the new `scrollHeight` automatically.
- Also fixes the once-per-second scroll reset while a timer is running (same
  code path).
- Day content height varies between days, but the fixed header/nav/progress
  block is constant, so restoring the raw offset keeps position stable for
  rapid day-flicking.

## Alternative (larger, not proposed now)

Diff/patch only the changed subtree (nav label, totals, session list) instead of
`container.empty()` on every render. Eliminates all rebuild churn but is a
meaningful refactor of the render pipeline. The scrollTop restore above is the
low-risk fix and can ship immediately.

## Test plan

1. Scroll down in a day with many sessions, click ‹ to previous day → scroll
   position retained (not jumped to top).
2. Flick ‹ ‹ ‹ through several days quickly → no top-jump between clicks.
3. Start a timer, scroll, wait through several 1s re-renders → position holds.
4. Switch to Analytics tab and back → no errors (analytics tab has no
   `.timer-view`; `prevScroll` falls back to 0).

## Scope

- Single-function change in `src/ui/sidebar-view.ts`. No CSS, no data changes.
- Batch into the next rebuild; rebuild regenerates `main.js`.
