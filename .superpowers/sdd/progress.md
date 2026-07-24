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
