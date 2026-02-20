# Code Smells & Cleanup Notes

## Existing issues (pre-existing, not introduced by this PR)

1. **Duplicated time formatting** — `formatTimeHM`, `formatTime`, `formatHHMM` exist in sidebar-view; `formatDuration` in add-time-modal. Could be a shared utility.

2. **`getContrastColor` in sidebar** — General-purpose helper living inside a view class. Should be a utility.

3. **Magic number `8 * 60 * 60 * 1000`** — The 8h daily goal is hardcoded in the progress bar. Should come from settings (like `streakTargetMins` does for streaks).

4. **`groupByProject` duplicated** — Used in sidebar for both timer view and analytics. Fine for now but could be on `Store` if more consumers appear.

5. **No confirmation on session delete** — The `[x]` button deletes immediately. Low-risk since it's one click, but a brief undo notice would be safer.

6. **`stop()` return type** — `Timer.stop()` returns `Session | null` but no caller uses the return value. Could simplify to `Promise<void>`.
