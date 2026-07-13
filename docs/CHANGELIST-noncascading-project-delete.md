# Changelist: Non-cascading project deletion (archive projects)

**Status:** Shipped in v0.3.0
**Author:** Rahul Marchand
**Goal:** Removing a project from the active list must never delete its sessions.
Historical data stays fully intact and renders with its original name/colour/icon.

## Problem

`Store.deleteProject` cascade-deletes every session belonging to the project:

```ts
// src/store.ts:58
async deleteProject(id: string): Promise<void> {
    this.data.projects = this.data.projects.filter(p => p.id !== id);
    this.data.sessions = this.data.sessions.filter(s => s.project !== id); // <-- destroys history
    await this.save();
}
```

The settings trash button (`src/ui/settings-tab.ts:100-108`) calls this with **no
confirmation and no undo**, then re-renders. Deleting a project silently and
permanently erases all its logged time. For the live data, deleting "Revision"
(`id: "work"`) would drop 379 of 686 sessions.

## Design decision: archive, don't hard-delete

The UI already tolerates a session whose project is absent — every read-side
lookup falls back gracefully:

| Site | Line | Fallback if `getProject` returns undefined |
|------|------|--------------------------------------------|
| `sessions-section.ts` | 108 | `session.project` (raw id string) |
| `analytics-section.ts` | 195 | colour `#888` (grey) |
| `stats-modal.ts` | 52 | (uses result, tolerates undefined) |
| `timer-section.ts` | 59 | `'Unknown'` |

So a *hard* delete of only the project record (keeping sessions) would keep the
numbers correct but history would show up as grey "Unknown" / raw ids — not
"all fine". To keep old data rendering with its real name and colour we must
**retain the Project record** and merely hide it from the active pickers.

**Chosen approach: soft-delete via an `archived` flag.**
- Sessions are never touched by archiving.
- The archived project record is retained, so all history renders correctly.
- Active pickers (start timer, add-time modal, switch-project menu) exclude
  archived projects.
- Settings shows archived projects in a separate collapsed group with
  **Restore** and **Delete permanently** actions.

## Changes

### 1. `src/types.ts` — add the flag
- Add optional field to `Project`:
  ```ts
  export interface Project {
      id: string;
      name: string;
      color: string;
      icon: string;
      archived?: boolean; // absent/false = active
  }
  ```
- Optional field keeps existing `time-data.json` valid with no migration.

### 2. `src/store.ts` — split active vs. all, replace cascade
- Rename the raw accessor and add filtered variants:
  ```ts
  get projects(): Project[] { return this.data.projects.filter(p => !p.archived); } // active only
  get allProjects(): Project[] { return this.data.projects; }
  get archivedProjects(): Project[] { return this.data.projects.filter(p => p.archived); }
  ```
  Making the existing `projects` getter return active-only means every current
  picker call site (timer-section, add-time-modal, settings list) auto-excludes
  archived projects with no further edits.
- `getProject(id)` must still search **all** projects (so history resolves):
  ```ts
  getProject(id: string): Project | undefined {
      return this.data.projects.find(p => p.id === id); // unchanged — searches all
  }
  ```
- Replace `deleteProject` cascade with archive + explicit hard-delete:
  ```ts
  async archiveProject(id: string): Promise<void> {
      await this.updateProject(id, { archived: true });
  }
  async restoreProject(id: string): Promise<void> {
      await this.updateProject(id, { archived: false });
  }
  // Permanent removal: caller must decide what happens to sessions.
  // Default keeps sessions (they render via getProject fallbacks); pass
  // deleteSessions=true only for an explicit "delete everything" action.
  async deleteProject(id: string, deleteSessions = false): Promise<void> {
      this.data.projects = this.data.projects.filter(p => p.id !== id);
      if (deleteSessions) {
          this.data.sessions = this.data.sessions.filter(s => s.project !== id);
      }
      await this.save();
  }
  ```

### 3. `src/ui/settings-tab.ts` — archive by default, manage archived group
- Iterate active projects (unchanged: `this.plugin.store.projects` now returns
  active only, line 41).
- Change the trash button (lines 100-108) to **archive**, not delete:
  ```ts
  btn.setIcon('archive');
  btn.setTooltip('Archive (keeps history)');
  btn.onClick(async () => {
      await this.plugin.store.archiveProject(project.id);
      this.display();
  });
  ```
- Guard: only offer archive when `store.projects.length > 1` (keep at least one
  active project — required by add-time modal default at add-time-modal.ts:45).
- Add an "Archived" section below "Projects", rendered from
  `store.archivedProjects`, each row with:
  - **Restore** button → `store.restoreProject(id)`.
  - **Delete permanently** button → confirm modal (see item 4), then
    `store.deleteProject(id, /* deleteSessions */ false)`. Sessions are kept;
    history still renders name+colour because the record... is gone.
    *Note:* once permanently deleted, that project's history reverts to grey
    "Unknown". State this in the confirm dialog. Offer a second, clearly
    labelled "Delete project AND its N sessions" only if desired.

### 4. Confirmation modal (new, small)
- Add a minimal `ConfirmModal` (extend `obsidian.Modal`) used by the permanent
  delete action. Must state session count and that history styling is lost.
- Archiving needs no confirmation (non-destructive, reversible).

### 5. `styles.css`
- Style for the archived group (muted heading, dimmed rows). Reuse existing
  project-row classes.

## Explicitly NOT changing
- `getProject` stays a full-list lookup — do not restrict it to active, or
  history breaks.
- Read-side fallbacks in analytics/sessions/stats stay as-is; they are the
  safety net for permanently-deleted projects.
- No data migration script needed (optional field, backward compatible).

## Test plan
1. Archive "Revision" → it disappears from timer picker + add-time modal;
   all 379 sessions still present in sessions list, analytics, and stats with
   correct name/colour.
2. Restore → reappears in pickers, unchanged.
3. Archive down to one active project → archive button hidden on the last one.
4. Permanent delete (keep sessions) → project row gone; its sessions still
   listed but shown as grey/raw-id (documents the tradeoff).
5. Load an old `time-data.json` with no `archived` field → all projects active,
   no errors.
6. Backdated add-time still defaults to a valid active project.

## Rollout
- Bump `manifest.json` / `package.json` version (2.1.0 → 2.2.0).
- `npm run build` to regenerate `main.js`, copy build artifacts
  (`main.js`, `manifest.json`, `styles.css`) into the vault plugin dir:
  `~/Documents/Obsidian Vault/.obsidian/plugins/time-tracker/`.
- **Back up `time-data.json` before first run of the new build.**
```
