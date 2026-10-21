# User workspace state Implementation Plan

**Goal:** Giao diện riêng theo user/board/profile được tự lưu và khôi phục qua server, không đổi board chung.

**Architecture:** Collection/router riêng; helper thuần camera/state và sync controller độc lập; hook React cung cấp các state cho IdeaMap. Inspector duy nhất, responsive anchors và reset.

**Tech Stack:** React18, Vite6, Express, Mongoose, node:test, Playwright.

## Global Constraints

- Không sửa CSS chưa commit của user; worktree riêng, không push.
- Session xác định email; viewer được sửa state riêng, người ngoài404.
- Profile desktop>=768px và mobile<768px độc lập; chỉ lưu ý định người dùng, không lưu clamp do resize.
- Không khôi phục qua thao tác thay board/history. Không thêm kéo/resize UI mới.
- Protocol GET/PATCH/DELETE `/api/boards/:id/workspace/:profile`, PATCH `{changes}`, response `{version:1,state,updatedAt}`.

[Spec](../specs/2026-10-21-user-workspace-state-design.md)

- [x] Task 1: Server workspace persistence
  - [x] `server/models.js`: collection/email-board-profile unique index; `server/workspace.js` router factory, schema validation và atomic patches; mount tại index.
  - [x] `server/workspace.test.js`: real HTTP owner/viewer/isolation/invalid/outsider/reset and independent patch scenarios; test trước implement, chạy `npm test --prefix server`.
  - [x] Rà diff/API contract và ghi bằng chứng HTTP + Mongo thật, chuẩn bị commit riêng server.
- [x] Task 2: Client state/sync
  - [x] `client/src/lib/workspace-state.js` và tests: defaults, safe normalize, profile, camera center/restore; cache email-board-profile; queue field patches, preserve pending on fetch, retry online, dispose flush.
  - [x] `client/src/lib/useWorkspaceState.js`: hook lifecycle/profile and status; test controller độc lập bằng node:test.
  - [x] Chạy focused tests red→green, client suite/build.
- [x] Task 3: Stable UI integration
  - [x] `IdeaMap.jsx`: hook replaces stable UI flags/inspector, camera restore after viewport measurement, remove legacy board-only camera cache; restore tree without arranging; reset from appearance menu.
  - [x] `idea-map.css`: giới hạn panel vào viewport; trên mobile không shift cây ra ngoài màn hình.
  - [x] Smoke kịch bản riêng chứng minh restore tree không ghi board/undo và kiểm camera transform; viewer điều khiển cây disabled; chạy build/client suite và targeted smoke.
- [x] Task 4: Real surface QA and integration
  - [x] Browser1440×900: tắt minimap, mở cây, zoom rồi reload/context mới; exact camera center and flags restored, no board PUT during restore. HTTP API captured.
  - [x] Browser375×667 rồi1440×900: profiles độc lập, mobile panel in bounds; offline edits→online persisted; reset removes only current user/profile settings.
  - [x] Invalid target ignored; suites/build/full smoke; independent scoped reviewer, fix findings.
  - [x] Summary4sections, identity+staged diff before commits, local merge and merged checks, preserve dirtyCSS.
  - [x] QA process/browser/test data và symlinks đã dọn; worktree/runroot chỉ còn chờ lưu docs cuối rồi archive/remove, được theo dõi trong notepad. Main app7155/3345 giữ để người dùng dùng thử.

## Kết quả

[Summary](../summaries/2026-10-21-user-workspace-state-summary.md)
