# SDD Progress — Lingui i18n

Plan: docs/superpowers/plans/2026-07-24-lingui-i18n.md
Branch: feature/lingui-i18n
Base before Task 1: (recorded below per task)

## Pre-flight rulings (human decided, do NOT re-ask)
- NO test framework. Spec + plan + human ruled this three times. If a task
  reviewer flags "no tests" as plan-mandated Important, record it here and
  move on. Verification is: lingui extract 0 missing + build + manual check.
- LoadError block: extracted to components/LoadError.jsx (human chose to
  de-duplicate rather than keep the copy-paste the plan originally had).

## Tasks
- Vite 5 -> 6 upgrade: APPROVED by human during Task 1.
  Reason: @lingui/vite-plugin@6.5.0 has a REQUIRED peer on vite ^6.3.0||^7||^8.
  No Lingui v6 vite-plugin supports Vite 5 (verified on npm). Human chose to
  take Vite 6 rather than drop to Lingui 5.9.5 or hand-run `lingui compile`.
  Plan/spec updated to match. Do NOT flag package.json's vite bump as scope creep.
  STILL UNVERIFIED: `npm run dev` has never started successfully (EMFILE /
  inotify exhaustion on this shared machine). `npm run build` passes.

## Tasks
Task 1: complete (commits 6a61446..c874a31, review clean, no Critical/Important)
  Minor noted: Home.jsx has two separate imports from @lingui/react/macro
  (brief-mandated); new Lingui pkgs declare engines.node >=22.19.0.
  OUTSTANDING: browser check never ran. Controller verifying now.
  RESOLVED: controller ran the browser check via headless Chrome on the built
  output (vite preview :4174). Default -> Vietnamese + "VI" button; with
  locale-pref=en -> English + "EN" button; DOM ~2.9KB (not a blank page).
  Residual gap: the click path (activateLocale write) is still unclicked.
Task 2: complete (commits cca3d84..7562d65, review clean, no Critical/Important)
  Verified hunk-by-hunk: no WIP leaked into the commit. Browser check via
  headless Chrome (both locales, both pages show load-error screen).
  Minor: saveError is null|true not strict boolean (brief-mandated shape).
WIP commit 8fb20d2 "Redesign idea map interactions and filter bar" — the
  pre-existing uncommitted idea-map work (context-menu removal, right-drag
  pan, filter-bar redesign), committed on its own so Task 4 starts clean.
  Build passes with it. NOT part of the i18n feature per se.
Task 3: complete (commits 69498f6..d2b8c29, review clean, no Critical/Important)
  Freeze-fix verified structurally: DuelMessage is a pure <Trans> consumer,
  no setDuelResult writes a string. stat.name left as data. Placeholder/tag
  integrity clean across all 26 new msgid/msgstr pairs. Live toggle-click
  after simulate still unverified (environment), low risk.
Task 4: complete (commits 568e9e7..62d78b1, review clean, no Critical/Important)
  PLAN BUG FOUND & FIXED: tagLabel(tag, t) — passing macro t as a param — is
  broken with Lingui (compiles to ""). Implementer fixed with module-scope
  import { t } from "@lingui/core/macro"; call sites back to tagLabel(tag).
  Reviewer + controller both confirmed correct & reactive; "Chưa gắn nhãn"
  -> "No tag" is in the catalog and compiled into the bundle ("e1gXUn").
  Plan Step 2 + call sites updated to match. Commit message accurately
  documents the deviation (no stale template text).
  Controller headless EN dump: topbar/filters English, all 5 status chips +
  card titles stay Vietnamese, no leak. Non-regression PASS.
  Minor (for final review): (1) TAG_SUGGESTIONS.map((t)=>...) at IdeaMap ~786
  shadows the macro t — harmless now (no t`` inside), rename later.
  (2) English "{matchCount}/{0} match" reads awkwardly for plurals.
Task 5: complete (no source change — Step 1/2 sweep clean, no commit made).
  Step 1 grep: 6 lines printed, all classified (STATUS labels, TAG_SUGGESTIONS,
  and one multi-line <Trans> body in LoadError.jsx that grep's Trans> filter
  didn't catch because the opening tag is on the prior line). Home.jsx checked
  by hand too (not just relying on empty grep) — fully wrapped already.
  Step 2 grep: zero hits, confirmed by reading every setSaveError/setDuelResult
  call site — only null/true/{kind,...} ever passed, never a sentence.
  Step 3: extract Missing=0/0, --clean produced no .po diff; build succeeded.
  Step 4: substituted headless Chrome dump-DOM (dev server EMFILE on this box)
  against `vite preview --port 4190` (proxied /api to live :3001). Verified
  both halves (EN chrome / VI-stays-data) on all 3 routes via grep on the DOM
  dump; VI is default, EN via a temporary dist/__seed-en.html writing
  locale-pref then redirecting (deleted after use). 6 of 10 checklist rows
  (F5 persistence, cross-page persistence, live duel-then-switch, live
  save-error-then-switch, click-drag tag suggestions) are structural-only —
  explicitly flagged as NOT click-verified, not claimed as tested.
  Full evidence: .superpowers/sdd/task-5-report.md.
Task 5: complete (commit 23da7b9 checkbox/ledger; sweep clean, no source change
  needed). extract 0/0, build pass, headless all 3 routes both locales.
FINAL whole-branch review (opus, a8bff06..23da7b9): i18n feature CORRECT, no
  issues. 1 Important in the BUNDLED UX refactor (not i18n):
  handleViewportContextMenu preventDefault was unconditional, killing native
  right-click Copy/Paste in JSON textarea + card edit inputs. Fixed in 4adf7fa
  (guard skips INPUT/TEXTAREA/contentEditable). Also Minor: passesFilter now
  trims search to match the counter. Build pass; final headless smoke all
  3 routes/2 locales PASS (chrome EN, status labels + stat names stay VN).
ALL TASKS COMPLETE. Branch ready to finish.

============================================================
# SDD Progress — User-managed badges (feature/user-managed-badges)
Plan: docs/superpowers/plans/2026-07-24-user-managed-badges.md
Base: 81addd0 (branched from main after i18n merge)

## Pre-flight rulings (do NOT re-ask)
- NO test framework. Human-ratified for this whole project. Reviewer may
  flag as plan-mandated; record and move on. Verify = extract + build +
  manual/headless.
- Task 2 uses transitional EMPTY STUBS openBadgeCreate/openBadgeMenu that
  the filterbar JSX calls; they get real bodies in Task 3/4. Correct for
  Task 2's deliverable (invisible data refactor). Not a defect.
- LIVE DATA: server :3001 is the user's running instance on OLD code.
  Migration mutates the real board on first GET. Subagents verify code +
  `node --check` + build ONLY — they must NOT restart :3001 or run the new
  server against the live DB. Controller/user does the runtime migration
  verify with a backup, under control.

## Tasks
Task 1: complete (commits 5e3476b..49272b5, review clean, no Critical/Important)
  Server schema+migration+seed+PUT-fix verified vs brief line-for-line.
  node --check only (live DB untouched by design). Idempotent guards correct.
  Minor (for final review): (1) defaultIdeas.statuses aliases DEFAULT_STATUSES
  (seed-time only; client mutates+PUTs, server never mutates in place — low
  risk). (2) GET inlines toObject+delete instead of stripMongoMeta (forced,
  migrateBoard needs plain obj pre-strip).
  RUNTIME MIGRATION not yet run against live DB — controller does with backup.
Task 2: complete (commits a1b1823..d43f5f2, review clean on LOGIC — no
  Critical/Important that are implementer errors). Sonnet reviewer verified
  via TWO independent greps (diff + full committed file) that ZERO stray refs
  to node.status/node.tag/STATUS[/STATUS_ORDER/hashTag(/DOT_PALETTE/
  TAG_SUGGESTIONS/tagLabel(/tagOptions remain. Null/orphaned-id handling
  defensive everywhere (statusById/tagById → no pill on unresolved id, no
  crash). Removed module-level `import {t}` safe (component calls useLingui at
  line 25). No protected files touched. Empty stubs match brief line 225.
  PLAN-MANDATED findings (from brief Step 7 template, NOT implementer error;
  brief line 5 "app trông y hệt" contradicts its own Step 7 UI). HUMAN DECISION
  (asked, answered): "Chấp nhận, đi tiếp Task 3." So:
    (1) .fb-add "+" / .dot-empty unstyled → Task 3 adds CSS (self-heals).
    (2) tooltip "chuột phải để sửa" advertises non-functional right-click →
        Task 4 wires openBadgeMenu (self-heals).
    (3) "no tag/no status" filter chip lost drag-to-clear that old "—" chip
        had (still reachable via edit-form dropdown) → RIDER ON TASK 3:
        restore drag-to-clear on the "none" chips so no capability regresses.
  "Trông y hệt" milestone deferred from Task 2 commit → verified at end of
  Task 4 instead. Build passes, extract 0/0 (en 77/77).
  DEFERRED (controller+user, needs live-DB migration with backup): runtime
  non-regression of Task 2 + all click testing for Tasks 3-4. The :3001
  server must be restarted on new code (migrates real board once) before
  the app renders — do this WITH a JSON backup, confirm with user first.
Task 3: complete (commit fa1a64b, review APPROVED — spec ✅, no Critical/
  Important). Added BadgeEditor.jsx (generic popover: name field + swatch
  palette from BADGE_PALETTE, closes on outside-click/Escape, rejects empty
  name), badgeUI state, real openBadgeCreate + createBadge (immutable via
  commitAndSave, id from nextStatusId/nextTagId, color kept as token),
  render wiring, CSS (.fb-add/.dot-empty/.badge-editor). openBadgeMenu left
  as untouched empty stub for Task 4. RIDER DONE: drag-to-clear restored on
  both "none" chips via onMouseDown handleChipMouseDown(e,kind,"none")
  (machinery already maps "none"→null); no onContextMenu on none chips.
  extract vi 79/0 en 79/0, build pass. So findings 1&2 from Task 2 review
  are now CLOSED (.fb-add CSS added; right-click still stub → Task 4).
  Minor (for final review): (1) BadgeEditor has no viewport-edge clamping —
  popover from a "+" near window edge may overflow; brief specifies the exact
  positioning, so left as-is — verify in live click test. (2) Pre-existing
  Task-2 en tooltip wording ("...assign the tag/status...") differs from the
  generic table wording; out of Task 3 scope, untouched.
  DEFERRED: live click test of "+" create (controller/user, needs migration).
Task 4: complete (commits 20beab3 + fix 9ef22b3, review APPROVED after fix).
  Right-click chip → edit popover (openBadgeMenu real body at cursor).
  updateBadge (rename/recolor) touches ONLY the def array, never nodes —
  reviewer-confirmed. deleteBadge filters the def AND sets statusId/tagId→null
  on every referencing node, atomic in one commitAndSave (one undo step).
  Trash button gated on onDelete (create passes none → no trash; edit → trash).
  (t)→(tg) rename applied in updateBadge (controller-directed) + deleteBadge
  (fix commit). "Xoá badge"→"Delete badge" in en .po. openBadgeCreate/
  createBadge (Task 3) unchanged. extract vi/en 0/0, build pass.
  IMPORTANT finding FIXED (9ef22b3): brief Step 5 CSS was a plan bug — trash
  button's `flex:0 0 auto` was defeated by `.be-actions button {flex:1}`
  specificity (0,2,1 > 0,2,0); scoped .be-delete under .be-actions (0,3,0)
  so intent realized. Fix = clear plan-bug repair (realizes stated intent),
  applied directly, not a human-decision case. Fix diff verified by controller
  hunk-by-hunk (2 selectors + 1 param rename, nothing else), extract 0/0,
  build pass. So Task-2 finding (2) right-click tooltip now TRUE (openBadgeMenu
  functional). Minor for final review: BadgeEditor still no viewport-edge
  clamp (shared with Task 3 minor #1).
  DEFERRED: live right-click test — rename propagates to all cards, recolor
  updates pill+chip, delete → card back to no-status/no-tag (needs migration).
Task 5: complete (sweep — no source change from sweep itself). Step 1 grep
  (STATUS[/STATUS_ORDER/DOT_PALETTE/hashTag/TAG_SUGGESTIONS/node.status/
  node.tag/tagOptions/tagLabel): ZERO hits — refactor fully complete. Step 2
  (unwrapped VN): only LoadError.jsx:7 which is inside a multi-line <Trans>
  (opening tag on line 6) — properly wrapped, grep false-positive. Step 3:
  extract vi 80 / en 80 Missing 0, --clean produced NO .po diff, build ✓ 2.61s.
  Step 4 (manual visual w/ Mongo) DEFERRED to controlled live-migration session.
FINAL whole-branch review (opus, 81addd0..a3be003): "Ready to merge — With
  fixes." NO Critical. Migration idempotent+non-destructive, every old key/tag
  maps (unknown→null), nextIds can't collide, PUT round-trips all 9 fields,
  id-refs degrade safely (no pill on missing id, no crash), delete is atomic
  for undo, i18n boundary clean (badge names raw, UI wrapped, en 80/80). All
  13 palette tokens exist in index.css. defaultIdeas alias confirmed NOT a
  hazard. Trash-button CSS fix (9ef22b3) confirmed correct.
  1 IMPORTANT FIXED (commit 56bf0fa): deleteBadge left a dangling active
  filter key → filter-by-badge then delete-it dimmed the whole canvas
  (matchCount 0/N, no chip). Fix drops the key from filterStatus/filterTags.
  Same commit added 2 free robustness fixes from the review: key= on both
  <BadgeEditor> (clean remount between opens) + (node.statusId ?? null) guard
  in applyChipToNode status branch (mirrors tag branch). Fix diff verified by
  controller hunk-by-hunk (exactly those 4 edits), extract 0/0, build ✓ 2.40s.
  SHIP-ACCEPTABLE minors (documented, not fixed): BadgeEditor no viewport-edge
  clamp (brief-specified positioning); en tooltip "assign the tag/status" is
  natural English (reviewer: correct as-is).
ALL TASKS COMPLETE + final review clean after fix. Branch code-ready.
OUTSTANDING (needs USER + live DB, NOT a code gate): runtime migration verify.
  The new server migrates the real board on first GET (node.status→statusId,
  node.tag→tagId). Idempotent + non-destructive by review, but MUST run WITH a
  JSON backup ("Xuất JSON") first, confirmed with user. Until then the whole
  feature is code-verified but not runtime-verified. Do this before merge/deploy.

## FINISHING (user chose: "Giữ nhánh, test trước" — Option 3 Keep as-is)
Branch feature/user-managed-badges kept, NOT merged/pushed. Normal repo (no
worktree). Base main @ 81addd0. Tree clean of feature changes; untracked
.playwright-mcp/ + game-tools/docs/pvp-ideas.md (user's PvP notes, NOT mine —
left alone). Extra hygiene commits after final review: c7297dd (.po #: line-ref
resync), 97370f5 (Task 5 + final-review ledger). Full feature = 81addd0..c7297dd.

## RUNTIME MIGRATION VERIFY — progress
- Backup captured (read-only GET :3001): scratchpad/board-backup-pre-migration.json
  — 5 nodes (ids 1,2,3,4,10), OLD schema (node.status/node.tag, no statuses[]).
- OFFLINE DRY-RUN (scratchpad/migrate-dryrun.mjs, migrateBoard copied verbatim
  from index.js, NO DB write) → ALL CHECKS PASS on real data:
  chosen→3, rejected→5, parked→4, parked→4, idea→1; tags Cơ chế→1(dot-1),
  Nội dung→2(dot-5), Kỹ thuật→3(dot-7), empty→null; title/desc/x/y preserved;
  idempotent (2nd run changed=false, deep-equal). Preview: board-migrated-preview.json.
- LIVE MIGRATION DONE + VERIFIED (user chose Path A). Stopped old server
  (pid 1462668), started NEW server (feature code) on :3001 (bg task ba843q6pa,
  still running). First GET migrated real Atlas board. Verified vs dry-run
  preview: nodes/statuses/tags ALL MATCH; 0 nodes keep old status/tag; IDEMPOTENT
  on real DB (GET#1==GET#2). statuses=5 defaults, tags Cơ chế/Nội dung/Kỹ thuật
  (dot-1/5/7), nextStatusId 6 nextTagId 4. Backup safe at board-backup-pre-
  migration.json if rollback ever needed. Live snapshots: board-live-migrated-{1,2}.json.
- STILL TODO (user, browser): rebuild+serve new client (cd game-tools/client &&
  npm run build && npm run preview), open URL, eyeball all cards correct, then
  click-test create "+" / right-click rename+recolor+delete / drag chip assign /
  filter "none" / VI-EN toggle. New server already running for it.
