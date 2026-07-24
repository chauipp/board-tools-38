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

============================================================
# SDD Progress — Idea-map frames + card colors (feature/idea-map-frames-card-colors)
Plan: docs/superpowers/plans/2026-07-24-idea-map-frames-card-colors.md
Spec: docs/superpowers/specs/2026-07-24-idea-map-frames-card-colors-design.md

## Pre-flight rulings (do NOT re-ask)
- NO test framework installed; human-ratified project-wide (see badges feature
  above). This plan uses Node's BUILT-IN `node --test` runner for the pure
  geometry helpers ONLY (Task 1) — zero new dependencies, consistent with the
  ruling. Interactive code = manual browser verification per plan.
- Dev servers already running from this checkout (server :3001 node --watch,
  client :5173 vite). Working IN PLACE on the feature branch (no worktree) so
  hot reload serves manual verification. Server schema change (Task 2)
  auto-applies on save — safe, groups defaults to [], no migration.
- Plan self-review already resolved: frames must NOT use pointer-events:none
  (DOM order handles stacking); dropTargetId carries {id,kind} from Task 7.

## Tasks
Base before Task 1: fccfde6
Task 1: complete (commit 696e53c, review clean — spec ✅, Approved, no Critical/Important).
  Minors noted for final review: ||-vs-?? on fromKind default (theoretical only);
  edgeEndpoint group-not-found branch not directly asserted.
Base before Task 2: 696e53c
Task 2: complete (commit 8ef2650, review clean — spec ✅, Approved, no Critical/Important).
  Verified against LIVE server (:3001, node --watch auto-reload): GET has groups/nextGroupId,
  PUT round-trip persisted a test frame, board restored to clean state after.
Base before Task 3: 8ef2650
Task 3: complete (commit 037f68a, review clean — spec ✅, Approved, no issues).
  Byte-equivalent extraction confirmed by reviewer; build pass. Browser check of
  BadgeEditor close behavior deferred to end-to-end manual pass (behavior identical by construction).
Base before Task 4: 037f68a
Task 4: complete (commits 4e635e4 + fix 316cb13, review APPROVED after fix — spec ✅).
  IMPORTANT found & fixed: right-drag-pan starting on a card re-opened the color popover on
  release (contextmenu fires after mouseup). Fix: suppressContextMenuRef set in startPan onUp
  (only when dragging) + next-tick reset + consume-guard in openColorMenu. Reviewer confirmed
  event-ordering sound, no staleness, plain right-click unaffected, native-menu block intact.
  Minors for final review: brief Step-5 prose said popover stays open after pick but normative
  code closes it (code correct, prose stale); openBadgeMenu safety is by guard scoping not
  geometry. Build pass, lingui extract clean (new string 'Không màu').
Base before Task 5: 316cb13
Task 5: complete (commits ad8ce1c + CSS fix a937cfc, review APPROVED after fix — spec ✅).
  IMPORTANT (plan-mandated, brief CSS incomplete) FIXED: .frame-delete now self-styled
  (color/cursor/font/flex-centering + hover) — .icon-btn rule is scoped .idea-card only.
  Reviewer verified: member-capture-once drag, no-drift delta math, resize floors 160x120,
  delete-frame-keeps-cards, z-order frames<edges<cards, pan-guard covers frames, import backfill.
  Minors for final review: 4th copy of drag-session boilerplate (pre-existing pattern);
  frameCardSize duplicates size-fallback pattern; MIN_W/H local consts; title double-click
  arms a no-op drag session (harmless, brief-mandated code).
  USER ADDITION mid-run: Task 8 added to plan + spec (multi-select right-click -> Gom nhóm
  button in card ColorMenu -> create frame around selection bbox). Dispatch after Task 7.
Base before Task 6: a937cfc
Task 6: complete (commit 615f4b4, review clean — spec ✅, Approved, no issues).
  Specificity check confirmed no competing connector rules; .idea-card.dim scoping preserved.
Base before Task 7: 615f4b4
Task 7: complete (commit 6044bb3, review clean — spec ✅, Approved, no Critical/Important).
  All 3 named-risk checks pass: toggleEdge 4-arg everywhere, dropTargetId {id,kind} at all
  producer/consumer sites, linkMode path updated. deleteGroup kind-guard correct. Task 1
  tests re-run 5/5. Minors (brief-inherited): toCanvas/targetAt duplication between the two
  connector handlers; group connector has no 5px drag threshold.
Base before Task 8: 6044bb3
Task 8 (user addition): complete (commit 8a89eb1, review clean — spec ✅, Approved).
  Gom nhóm button: card popover only, selectedIds.size>=2 && has(node.id); bbox PAD 28 +
  TITLE_ROOM 20; single undo step; group popover confirmed untouched; en msgstr 'Group'.
  Minor: bbox accumulation duplicates fitToView pattern (brief-mandated, different inputs).
ALL 8 TASKS COMPLETE. Final whole-branch review next.
FINAL whole-branch review (opus, a812f1a..317febb): feature well-architected, 1 CRITICAL
  found & FIXED (58e505a): deleteNode edge filter was kind-blind — deleting a card could drop
  a same-numbered frame's edges (reachable on seeded board: first frame gets id 1 = node 1).
  Now mirrors deleteGroup's kind-aware filter. Minor also FIXED (df6bef5): FrameBox title
  doneRef guard — Escape no longer persists via blur, Enter no longer double-commits.
  Re-verify: reviewer confirmed both fixes correct, no regressions — Ready to merge YES.
  Ship-acceptable minors (documented, not fixed): frame connector z-index over cards,
  dblclick-inside-frame no longer creates card, redundant PUT on plain frame click,
  import nextGroupId=1 backfill for hand-crafted JSON, kind-less edges from createLinkedNode.
ALL TASKS + FINAL REVIEW COMPLETE. Branch feature/idea-map-frames-card-colors ready.
  Full feature = a812f1a..df6bef5 (14 commits). Manual browser pass by user still pending
  (dev servers :3001/:5173 running hot — feature is live now).

============================================================
# SDD Progress — Wave 1 canvas feel (feature/idea-map-wave-features)
Plan: docs/superpowers/plans/2026-07-24-idea-map-wave1-canvas-feel.md
Spec: docs/superpowers/specs/2026-07-24-idea-map-wave1-canvas-feel-design.md
Research: docs/research/2026-07-24-canvas-apps-feature-research.md
Base: main @ 1886574 (frames+card-colors merged & pushed). User approved ALL 3 waves;
waves 2-3 get their own spec/plan after wave 1 ships.

## Pre-flight rulings (do NOT re-ask)
- Same standing rules as prior features: no test framework (node --test for pure libs only),
  lingui for all strings, dev servers running from this checkout (hot reload), browser
  click-testing is controller/user job.
- Task order: 2 before 3 (duplicateNodes) and before 6/7 (Escape chain, deleteSelection).
  1, 4, 5 independent.

## Tasks
Base before W1-Task 1: 5a99d70
W1-Task 1: complete (commit c1f8afb, review clean — spec ✅, Approved, no issues).
  clipToRect math hand-traced all 4 cases; marker orientation correct; degenerate rects safe.
  10/10 tests, build pass.
Base before W1-Task 2: c1f8afb
W1-Task 2: complete (commits 957b509 + fixes 8215565, 4417990, review APPROVED after fixes).
  IMPORTANT (plan-bug in brief Step 3) FOUND & FIXED in 2 rounds: nudge-burst deferred
  recordHistory could push stale base after an interleaved action's entry (non-chronological
  undo stack). Fix: recordHistory wraps flushNudgeBurst (covers every caller); undo() handles
  pending burst directly (jump to base, past untouched, board->future); redo() flush+no-op.
  Re-review traced all paths: no bypass, idempotent, symmetric redo. APPROVED.
  Minor for final review (PRE-EXISTING app-wide): saveNow doesn't cancel saveTimerRef, so a
  pending debounced save can overwrite a just-undone state server-side. 1-line fix candidate:
  clear saveTimerRef in saveNow.
Base before W1-Task 3: 4417990
W1-Task 3: complete (commits f2974b7 + fix 7729a65, review APPROVED after fix).
  IMPORTANT (implementer's own deviation, imprecise) FIXED: alt-click-no-drag rollback now
  restores the exact pre-drag selectedIds snapshot instead of collapsing to the clicked card.
  All named-risk checks pass: non-alt path byte-identical, alt-drag = 1 undo step covering
  clone+move, boardRef synced synchronously, group popover excluded, button order correct.
  Note: 5 pre-existing missing en translations in .po (unrelated) — check at final review.
Base before W1-Task 4: 7729a65
W1-Task 4: complete (commits dfd66d9 + 2413a29 + 7b8e4b0, review APPROVED after 2 fix rounds).
  PLAN BUGS (mine, both in test authoring): (1) brief test 2's second scenario encoded a wrong
  expectation (bottom-bottom d=+1 legitimately beats center d=-3); implementer first resolved
  by DROPPING end anchors (spec violation) — controller ruled spec governs, restored 3 anchors,
  replaced fixture with unambiguous one. (2) controller's own pinning fixture had an algebraic
  tie (other.w/2 === moving.w) — reviewer PROVED via mutation testing it passed without end
  anchors; replaced with hand-verified unique-candidate fixture + guide-pos assertion; both
  implementer and reviewer independently reproduced the mutation check (fails 0 !== 4).
  Production code verified correct throughout: exclusion logic (clones excluded, originals
  snappable), canvas-space guides, per-event altKey compose, d===0 no-guide rule.
  Minors for final review: frameCardSize DOM query per node per mousemove (pre-existing
  pattern, perf note); first-frame clone size fallback (pre-existing).
Base before W1-Task 5: 7b8e4b0
W1-Task 5: complete (commits 39b2f54 + fix cc75c3e, review APPROVED after fix).
  CRITICAL (plan-bug in brief: two literal setBoard in one React 18 batch) FOUND & FIXED:
  saveNodeEdit+createLinkedNode composition lost the just-typed edit (stale closure overwrite).
  Fix: createLinkedNode(sourceId, direction, base = board) — all internal reads renamed;
  saveNodeEditAndNext builds edited board and passes it as base; ONE commitAndSave.
  SEMANTICS CHANGE (disclosed): one atomic history entry (edit+card) instead of brief's two.
  Reviewer verified rename complete (awk-scoped grep), trace holds, 2-arg callers unaffected.
  Minor: setEditingId(null) in saveNodeEditAndNext is dead code (superseded in batch).
Base before W1-Task 6: cc75c3e
W1-Task 6: complete (commit 6728373, review clean — spec ✅, Approved, no issues).
  BFS traced correct (<=2 hops), no interaction trap (Escape via window listener, banner
  outside .canvas), no render-loop hazard, .po hygiene clean.
Base before W1-Task 7: 6728373
W1-Task 7: complete (commit 03a92fb, review clean — spec ✅, Approved, no issues).
  All 4 named-risk checks pass; dot-empty specificity concern investigated = pre-existing
  pattern shared with ColorMenu, not a regression.
ALL 7 WAVE-1 TASKS COMPLETE. Final whole-branch review next.
FINAL W1 whole-branch review (opus, 1886574..03a92fb): 3 IMPORTANT found, ALL FIXED +
  2 minors fixed + spec reconciled (5 commits 38d7c69/d19c5bb/fb7ab0e/20b8762/8ce7490):
  (1) edit form never got DOM focus -> bare-key shortcuts fired while 'typing' (Backspace
  could delete the edited card; T5's continuous-typing broken). Fix: autoFocus + shared
  handleEditKeyDown with Escape-cancels-edit. (2) card created under focus mode rendered
  dimmed+pointer-events:none IN EDIT MODE. Fix: && editingId !== node.id. (3) saveNow didn't
  cancel saveTimerRef -> stale debounced PUT overwrote undo server-side. Fix: clear first.
  Plus: all en .po gaps filled (zero empty msgstrs), spec Escape order aligned.
  Re-verify by same reviewer: all fixes correct, no new issues — READY TO MERGE YES.
  Ship-acceptable minors documented: redundant button-0 check, frameCardSize per-move DOM
  query, first-frame clone size, dead setEditingId(null), edge-layer fixed-size (overflow
  visible so non-issue).
WAVE 1 COMPLETE.

============================================================
# SDD Progress — Wave 2 organize & content (feature/idea-map-wave-2)
Plan: docs/superpowers/plans/2026-07-25-idea-map-wave2-organize.md
Spec: docs/superpowers/specs/2026-07-25-idea-map-wave2-organize-design.md
Base: main @ 81303aa (wave 1 merged & pushed). Same standing rules as wave 1
(node --test pure libs only, lingui, dev servers hot, browser testing = controller/user).
Task order: T1->T2, T3->T5, T4 independent.

## Tasks
Base before W2-Task 1: 0ac98f4
W2-Task 1: complete (commit 43017cf, review clean — spec ✅, Approved, no issues).
  Both tests hand-traced; overlap no-dedupe structural; byStatus deterministic.
Base before W2-Task 2: 43017cf
W2-Task 2: complete (commit b0b0012, review clean — spec ✅, Approved).
  zoomToNodes refactor byte-identical math, F-shortcut parity proven; jumpToCard avoids
  stale-closure; historical:false on jumpToGroup; .po exactly 4 new pairs; bottom:60px.
  Minors: ids.includes O(n·m); buildOutline unmemoized per-render while open (fine at scale).
Base before W2-Task 3: b0b0012
W2-Task 3: complete (commit edfd151, review clean — spec ✅, Approved, no issues).
Base before W2-Task 4: edfd151
W2-Task 4: complete (commit e92729f, review clean — spec ✅, Approved, no issues).
  XSS surface checked (https?:// prefix only, no dangerouslySetInnerHTML anywhere);
  edge cases traced (empty desc, trailing URL); dim-card link inertness = consistent.
Base before W2-Task 5: e92729f
W2-Task 5: complete (commit 8f0f6e8, review clean — spec ✅, Approved, no issues).
  Id math cross-checked vs duplicateNodes/createNode; z-index audit (95 highest); .po parsed
  with lingui's own parser (104/104, multiline placeholder valid).
ALL 5 WAVE-2 TASKS COMPLETE. Final whole-branch review next.
FINAL W2 whole-branch review (opus, 81303aa..8f0f6e8): 1 IMPORTANT + 2 minors, ALL FIXED
  (7db341a wheel-scroll guard .outline-panel/.io-drawer — panel now scrollable, latent
  io-drawer hijack also cured; 7f34a64 exit focus on quick capture; 156437c container-level
  Escape in capture modal). Re-verified by same reviewer: correct, no new holes — READY YES.
  Remaining manual visual check (controller/user): line-clamp of MdLite block children in
  .desc (-webkit-box + block divs — cross-engine reliability).
  Ship minors: ids.includes O(n·m); buildOutline unmemoized (watch for jank on big boards);
  a&&b empty-title edge lines; estH=90 capture overlap; search matches raw ** markers.
WAVE 2 COMPLETE.

============================================================
# SDD Progress — Wave 3 extras (feature/idea-map-wave-3)
Plan: docs/superpowers/plans/2026-07-25-idea-map-wave3-extras.md
Spec: docs/superpowers/specs/2026-07-25-idea-map-wave3-extras-design.md
Base: main @ 740c97e (waves 1-2 merged & pushed). Standing rules unchanged.
8 tasks: lock, favorites, deep link, edge style/label, comments, images, PNG, present.
Server change: ONE line in Task 6 (json limit 2mb->10mb). Edge click behavior changes
delete->menu in Task 4 (deliberate, note for final review).

## Tasks
Base before W3-Task 1: daee925
W3-Task 1: complete (commits 0971581 + fix 56f3d7c, review APPROVED after fix).
  CRITICAL FOUND & FIXED: duplicateNodes spread copied locked:true onto clones (alt-drag /
  Nhân bản of locked card gave locked clone). Fix: destructure-drop locked key. All guard
  placements verified (right-pan over locked works, alt-clone works, frame drag skips locked
  members which become snap targets, tidy re-checks post-filter length).
  Minors (disclosed, accepted): no-op nudge burst on all-locked selection; frame lock badge
  during title edit.
Base before W3-Task 2: 56f3d7c
W3-Task 2: complete (commit cbefd41, review clean — spec ✅, Approved, no blocking issues).
  3 lib tests traced; immutability ok; null-currentUser safe; .po 2 pairs.
  Minors: fav-btn title reuses Yêu thích msgid; hover ties gold tint (brief CSS).
Base before W3-Task 3: cbefd41
W3-Task 3: complete (commits 54c5f9d + cd7b759 + fca89b3, review APPROVED after 2 fixes).
  IMPORTANT #1 FIXED (cd7b759): replaceState per marquee mousemove -> Safari 100/30s throttle
  crash risk (no ErrorBoundary). Guard: compare want/have before writing.
  CRITICAL #2 (deterministic, missed in round 1, caught in re-review) FIXED (fca89b3):
  mount-time URL-sync effect stripped ?card= BEFORE fetch resolved -> deep link never jumped.
  Fix: lazy useState captures the param at render phase; fetch reads frozen value; URL
  self-heals after the jump. Reviewer traced end-to-end + StrictMode-safe.
  Residual minors: hairline-marquee across distinct single cards writes per card (bounded);
  brief empty-param window during load spinner (cosmetic).
Base before W3-Task 4: fca89b3
W3-Task 4: complete (commits e44994b + polish 356d203, review APPROVED).
  All named-risk checks pass: delete-on-click fully removed (behavior change deliberate),
  label commit guard = 1 history entry per real change, label text non-interactive w/ halo.
  Minor confirmed & fixed post-approval (356d203): edgeMenu added to global Escape chain
  (parity with colorMenu/badgeUI; final review re-covers). Extra string 'Xoá cạnh' accepted.
Base before W3-Task 5: 356d203
W3-Task 5: complete (commits 6f999c3 + fix c71e358, review APPROVED after fix).
  IMPORTANT (undisclosed deviation) FIXED: ColorMenu onComments was gated to zero-comment
  cards; brief says always available — gate dropped (fix = reviewer's exact prescription,
  controller-verified, +1/-3). Self-caught bug during impl: draft preserved when name prompt
  cancelled. timeAgo clamps future timestamps (clock skew safe). Escape chain + deps correct.
  Minors: stale-board closure pattern (matches file convention); comments-pop outer overflow.
Base before W3-Task 6: c71e358
W3-Task 6: complete (commits 55334f2 + polish 21fa01a, review APPROVED, no blocking).
  Stale-closure discipline verified fully (full transitive closure traced incl. nudge-burst
  chronology); undo-of-paste correct; compressImage revokes both paths; server exactly 1 line;
  JPEG transparency -> black FIXED with white-fill (21fa01a, reviewer-prescribed).
Base before W3-Task 7: 21fa01a
W3-Task 7: IN FLIGHT — implementer DONE (commit bd65f39, png-export.js + exportPng +
  Xuất PNG button, build pass, haiku transcription). REVIEW NOT YET RUN. Next: review-package
  21fa01a..bd65f39 + dispatch reviewer. Then Task 8 (presentation), then final wave review.
Base before W3-Task 7 was: 21fa01a
W3-Task 7: complete (commit bd65f39, review clean — spec ✅, Approved, no issues).
  Byte-exact transcription (diff-verified); theme vars resolve; no drawImage (taint-free by
  construction); font set before measureText (no mismatch).
  USER DIRECTIVE: use Fable 5 for ALL remaining subagents, no economizing.
Base before W3-Task 8: bd65f39
W3-Task 8: complete (commits bfa042f + fix 4ebe30f, review APPROVED after fix).
  IMPORTANT (plan-gap, mine) FIXED: presenting now hides ALL chrome (6-selector rule) and
  startPresentation closes every popover/modal/edit first. All 4 named-risk checks passed:
  no updater side effects, key priority + edit-form interleaving acceptable, view snapshot
  mutation-safe, .po clean. Minors: Ctrl+Arrow also steps; save-per-step (inherited);
  bottom-center vs 'góc dưới' (brief wins).
ALL 8 WAVE-3 TASKS COMPLETE. Final whole-branch review next (Fable 5 per user directive).
FINAL W3 whole-branch review (fable, 740c97e..4ebe30f): 1 IMPORTANT (multi-select drag
  moved locked cards — the only movement path missing the lock filter) + 4 cheap minors,
  ALL FIXED in 5 commits (9cdeca3 lock filter, c6b306e locked-card click-select, 00c5150
  sibling-popover close, 5b856d9 phantom-history guard, fe67be6 empty-hint hide).
  Verification pass: all correct, no regressions — READY TO MERGE YES. Bonus catch during
  verification: PRE-EXISTING latent crash (deleteNode left stale id in selectedIds ->
  multi-drag TypeError) FIXED in f4f59da + drag filter hardened to require existence.
  Ship-accepted minors: edge-label blur-commit unreliable on click-outside; duplicate copies
  comments/favorites (2-user trust app); no 8MB payload warning; edge labels absent from MD
  export; locked-card-in-multiselection click collapses selection; badgeUI outside
  sibling-close set (self-healing).
WAVE 3 COMPLETE. ALL 3 WAVES DONE.
