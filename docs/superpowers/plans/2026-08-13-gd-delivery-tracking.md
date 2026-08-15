# Delivery Tracking Implementation Plan

> Spec: [../specs/2026-08-13-gd-delivery-tracking-design.md](../specs/2026-08-13-gd-delivery-tracking-design.md)

## Goal

Thêm milestone, deadline, assignee và blocker vào card Game Design mà không phá bố cục dock 275px.

- [x] Task 1: Data contract and export

  - [x] Normalize/default delivery data and include it in Markdown.
  - [x] Validate delivery data server-side and retain it on PUT/realtime.
  - [x] Add client/server unit tests.

- [x] Task 2: Card editor and canvas feedback

  - [x] Add a compact Delivery section to GameDesignPanel.
  - [x] Show concise delivery/blocker feedback on the card without overlap.
  - [x] Preserve viewer read-only behavior.

- [ ] Task 3: Verification and documentation

  - [x] Run client tests, build, smoke and server tests.
  - [x] Add test-guide steps; browser verification queued for Claude's logged-in Playwright profile.
  - [ ] Tick checklist/plan and write summary after verification.

## Kết quả

Sau thực thi: [../summaries/2026-08-13-gd-delivery-tracking-summary.md](../summaries/2026-08-13-gd-delivery-tracking-summary.md)
