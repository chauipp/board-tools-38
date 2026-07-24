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
