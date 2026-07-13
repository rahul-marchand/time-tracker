# Time Tracker — Changelist

All three items shipped in **v0.3.0**. Rebuild `main.js`, and
copy `main.js` / `manifest.json` / `styles.css` into the vault plugin dir
(`~/Documents/Obsidian Vault/.obsidian/plugins/time-tracker/`).
**Back up `time-data.json` before the first run of the new build.**

| # | Item | Type | Files touched | Doc |
|---|------|------|---------------|-----|
| 1 | Non-cascading project deletion (archive instead of cascade-delete sessions) | Data-safety / feature | `types.ts`, `store.ts`, `settings-tab.ts`, new confirm modal, `styles.css` | [CHANGELIST-noncascading-project-delete.md](CHANGELIST-noncascading-project-delete.md) |
| 2 | Monthly bars unequal width (days 1–9 half-width) | CSS bug | `styles.css` (1 line) | [CHANGELIST-monthly-bar-width.md](CHANGELIST-monthly-bar-width.md) |
| 3 | View jumps to top on day switch / re-render | UX bug | `sidebar-view.ts` (1 function) | [CHANGELIST-day-switch-scroll-jump.md](CHANGELIST-day-switch-scroll-jump.md) |

Items 2 and 3 are small, low-risk, and independent — safe to ship on their own.
Item 1 is the larger change and the one with data-loss stakes; it carries its own
test plan and version note.
