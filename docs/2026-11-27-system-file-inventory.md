# Danh mục file hệ thống

Ảnh chụp worktree khi bắt đầu rà soát. 352 file, gồm 337 file Git theo dõi và 15 file đang làm trong client, server hoặc docs.

Cột import liệt kê đường dẫn nội bộ được khai báo trong module. Danh mục lịch sử chỉ ghi đường dẫn.

[Bản đồ kiến trúc](2026-11-27-system-map.md)

## Cấu hình và điểm vào (16)

| File | Dong | Import noi bo |
|---|---:|---|
| `.gitignore` |  |  |
| `AGENTS.md` |  |  |
| `README.md` |  |  |
| `client/.env.example` |  |  |
| `client/.gitignore` |  |  |
| `client/index.html` |  |  |
| `client/lingui.config.js` | 12 |  |
| `client/package-lock.json` |  |  |
| `client/package.json` |  |  |
| `client/vite.config.js` | 26 |  |
| `package.json` |  |  |
| `render.yaml` |  |  |
| `server/.env.example` |  |  |
| `server/.gitignore` |  |  |
| `server/package-lock.json` |  |  |
| `server/package.json` |  |  |

## Smoke test (4)

| File | Dong | Import noi bo |
|---|---:|---|
| `client/smoke-run.mjs` | 251 | `client/smoke-dist/smoke.js` |
| `client/smoke.vite.config.js` | 15 |  |
| `client/src/__smoke__/entry.jsx` | 4063 | `client/src/components/GameDesignFlowPanel.jsx`, `client/src/components/GameDesignPanel.jsx`, `client/src/context/AuthContext.jsx`, `client/src/lib/board-theme.js`, `client/src/lib/i18n.js`, `client/src/lib/laser.js`, `client/src/lib/multi-click.js`, `client/src/lib/pen.js`, `client/src/lib/recognize.js`, `client/src/lib/shape.js`, `client/src/lib/useInk.js`, `client/src/pages/IdeaMap.jsx` |
| `client/src/__smoke__/socket-stub.js` | 11 |  |

## Component client (35)

| File | Dong | Import noi bo |
|---|---:|---|
| `client/src/components/BadgeEditor.jsx` | 50 | `client/src/lib/badges.js`, `client/src/lib/useCloseOnOutside.js`, `client/src/lib/usePopoverPosition.js` |
| `client/src/components/BoardOutlinePanel.jsx` | 49 | `client/src/lib/badges.js`, `client/src/lib/outline.js` |
| `client/src/components/BoardPopovers.jsx` | 192 | `client/src/lib/badges.js`, `client/src/lib/useCloseOnOutside.js`, `client/src/lib/usePopoverPosition.js` |
| `client/src/components/BoardSnapshotsPanel.jsx` | 52 |  |
| `client/src/components/CardLevelIcon.jsx` | 38 |  |
| `client/src/components/ColorMenu.jsx` | 163 | `client/src/lib/badges.js`, `client/src/lib/card-levels.js`, `client/src/lib/useCloseOnOutside.js`, `client/src/lib/usePopoverPosition.js`, `client/src/components/CardLevelIcon.jsx` |
| `client/src/components/DecisionTimelinePanel.jsx` | 26 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/DevHandoffPanel.jsx` | 56 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/EdgeLayer.jsx` | 77 | `client/src/lib/badges.js`, `client/src/lib/board-geometry.js`, `client/src/lib/game-design.js`, `client/src/lib/sketchy.js` |
| `client/src/components/FilterPanel.jsx` | 20 |  |
| `client/src/components/FollowBanner.jsx` | 62 | `client/src/lib/usePresence.js` |
| `client/src/components/FrameBox.jsx` | 73 | `client/src/lib/badges.js` |
| `client/src/components/GameDesignBalancePanel.jsx` | 42 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/GameDesignBriefPanel.jsx` | 45 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/GameDesignFlowPanel.jsx` | 63 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/GameDesignImpactPanel.jsx` | 31 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/GameDesignInsightsPanel.jsx` | 44 | `client/src/lib/game-design.js` |
| `client/src/components/GameDesignPanel.jsx` | 272 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/GameDesignReportsPanel.jsx` | 42 | `client/src/lib/game-design.js`, `client/src/lib/useCloseOnOutside.js` |
| `client/src/components/GameDesignToolbar.jsx` | 41 |  |
| `client/src/components/IdeaCard.jsx` | 278 | `client/src/lib/badges.js`, `client/src/lib/card-levels.js`, `client/src/lib/game-design.js`, `client/src/lib/mdlite.js` |
| `client/src/components/InkLayer.jsx` | 155 | `client/src/lib/pen.js`, `client/src/lib/shape.js`, `client/src/lib/sketchy.js`, `client/src/lib/stroke.js`, `client/src/lib/text-el.js` |
| `client/src/components/InviteModal.jsx` | 124 | `client/src/lib/api.js` |
| `client/src/components/LaserLayer.jsx` | 98 | `client/src/lib/laser.js`, `client/src/lib/pen.js` |
| `client/src/components/LoadError.jsx` | 29 |  |
| `client/src/components/LocaleToggle.jsx` | 18 | `client/src/lib/i18n.js` |
| `client/src/components/LoginGate.jsx` | 175 | `client/src/context/AuthContext.jsx`, `client/src/lib/auth.js` |
| `client/src/components/MiniMap.jsx` | 70 | `client/src/lib/badges.js`, `client/src/lib/minimap.js` |
| `client/src/components/PdfUsage.jsx` | 56 |  |
| `client/src/components/PeerLayer.jsx` | 81 | `client/src/lib/board-geometry.js`, `client/src/lib/usePresence.js` |
| `client/src/components/PlaytestComparisonPanel.jsx` | 8 | `client/src/lib/game-design.js` |
| `client/src/components/PresenceBar.jsx` | 157 | `client/src/lib/useCloseOnOutside.js`, `client/src/lib/usePresence.js` |
| `client/src/components/ToolOptions.jsx` | 375 | `client/src/lib/card-levels.js`, `client/src/lib/erase.js`, `client/src/lib/laser.js`, `client/src/lib/pen.js`, `client/src/lib/shape.js`, `client/src/lib/text-el.js`, `client/src/components/CardLevelIcon.jsx` |
| `client/src/components/ToolRail.jsx` | 181 | `client/src/lib/game-design.js` |
| `client/src/components/TreePanel.jsx` | 134 | `client/src/lib/tree-layout.js`, `client/src/lib/useCloseOnOutside.js` |

## Route và khởi động client (6)

| File | Dong | Import noi bo |
|---|---:|---|
| `client/src/context/AuthContext.jsx` | 38 | `client/src/lib/auth.js` |
| `client/src/main.jsx` | 92 | `client/src/components/LoginGate.jsx`, `client/src/context/AuthContext.jsx`, `client/src/index.css`, `client/src/lib/i18n.js`, `client/src/pages/BoardList.jsx`, `client/src/pages/Calculator.jsx`, `client/src/pages/Home.jsx`, `client/src/pages/IdeaMap.jsx` |
| `client/src/pages/BoardList.jsx` | 159 | `client/src/components/LocaleToggle.jsx`, `client/src/lib/api.js`, `client/src/lib/useTheme.js` |
| `client/src/pages/Calculator.jsx` | 301 | `client/src/components/LoadError.jsx`, `client/src/components/LocaleToggle.jsx`, `client/src/lib/api.js`, `client/src/lib/useTheme.js`, `client/src/styles/calculator.css` |
| `client/src/pages/Home.jsx` | 69 | `client/src/components/LocaleToggle.jsx`, `client/src/lib/useTheme.js` |
| `client/src/pages/IdeaMap.jsx` | 5432 | `client/src/components/BadgeEditor.jsx`, `client/src/components/BoardOutlinePanel.jsx`, `client/src/components/BoardPopovers.jsx`, `client/src/components/BoardSnapshotsPanel.jsx`, `client/src/components/ColorMenu.jsx`, `client/src/components/DecisionTimelinePanel.jsx`, `client/src/components/DevHandoffPanel.jsx`, `client/src/components/EdgeLayer.jsx`, `client/src/components/FilterPanel.jsx`, `client/src/components/FollowBanner.jsx`, `client/src/components/FrameBox.jsx`, `client/src/components/GameDesignBalancePanel.jsx`, `client/src/components/GameDesignBriefPanel.jsx`, `client/src/components/GameDesignFlowPanel.jsx`, `client/src/components/GameDesignImpactPanel.jsx`, `client/src/components/GameDesignInsightsPanel.jsx`, `client/src/components/GameDesignPanel.jsx`, `client/src/components/GameDesignReportsPanel.jsx`, `client/src/components/GameDesignToolbar.jsx`, `client/src/components/IdeaCard.jsx`, `client/src/components/InkLayer.jsx`, `client/src/components/InviteModal.jsx`, `client/src/components/LaserLayer.jsx`, `client/src/components/LoadError.jsx`, `client/src/components/LocaleToggle.jsx`, `client/src/components/MiniMap.jsx`, `client/src/components/PdfUsage.jsx`, `client/src/components/PeerLayer.jsx`, `client/src/components/PlaytestComparisonPanel.jsx`, `client/src/components/PresenceBar.jsx`, `client/src/components/ToolOptions.jsx`, `client/src/components/ToolRail.jsx`, `client/src/components/TreePanel.jsx`, `client/src/context/AuthContext.jsx`, `client/src/lib/api.js`, `client/src/lib/badges.js`, `client/src/lib/board-geometry.js`, `client/src/lib/board-theme.js`, `client/src/lib/card-levels.js`, `client/src/lib/card-sizes.js`, `client/src/lib/edge-routing.js`, `client/src/lib/erase.js`, `client/src/lib/game-design.js`, `client/src/lib/image-budget.js`, `client/src/lib/image-utils.js`, `client/src/lib/ink-live.js`, `client/src/lib/laser.js`, `client/src/lib/layout.js`, `client/src/lib/locked-tree.js`, `client/src/lib/minimap.js`, `client/src/lib/multi-click.js`, `client/src/lib/outline.js`, `client/src/lib/palette.js`, `client/src/lib/pen.js`, `client/src/lib/place-node.js`, `client/src/lib/png-export.js`, `client/src/lib/pointer-input.js`, `client/src/lib/raf-throttle.js`, `client/src/lib/selection-box.js`, `client/src/lib/selection.js`, `client/src/lib/shape.js`, `client/src/lib/snap.js`, `client/src/lib/text-el.js`, `client/src/lib/tree-layout.js`, `client/src/lib/useBoardHistory.js`, `client/src/lib/useBoardPersistence.js`, `client/src/lib/useCloseOnOutside.js`, `client/src/lib/useFollow.js`, `client/src/lib/useInk.js`, `client/src/lib/useInkLive.js`, `client/src/lib/useLaser.js`, `client/src/lib/useLiveSync.js`, `client/src/lib/usePresence.js`, `client/src/lib/useSkin.js`, `client/src/lib/useTheme.js`, `client/src/lib/useWorkspaceState.js`, `client/src/lib/workspace-state.js`, `client/src/styles/idea-map.css` |

## Giao diện, bản dịch và tài nguyên (6)

| File | Dong | Import noi bo |
|---|---:|---|
| `client/src/index.css` |  |  |
| `client/src/locales/en/messages.po` |  |  |
| `client/src/locales/vi/messages.po` |  |  |
| `client/src/styles/calculator.css` |  |  |
| `client/src/styles/idea-map.css` |  |  |
| `client/src/styles/sketch-fonts.js` | 20 |  |

## Logic và hooks client (56)

| File | Dong | Import noi bo |
|---|---:|---|
| `client/src/lib/api.js` | 174 |  |
| `client/src/lib/auth.js` | 42 |  |
| `client/src/lib/badges.js` | 36 |  |
| `client/src/lib/board-geometry.js` | 84 |  |
| `client/src/lib/board-theme.js` | 40 |  |
| `client/src/lib/camera.js` | 23 |  |
| `client/src/lib/card-levels.js` | 63 |  |
| `client/src/lib/card-sizes.js` | 99 |  |
| `client/src/lib/edge-routing.js` | 177 |  |
| `client/src/lib/erase.js` | 273 | `client/src/lib/shape.js` |
| `client/src/lib/follow.js` | 95 |  |
| `client/src/lib/game-design.js` | 913 |  |
| `client/src/lib/i18n.js` | 26 | `client/src/locales/en/messages.po`, `client/src/locales/vi/messages.po` |
| `client/src/lib/image-budget.js` | 34 |  |
| `client/src/lib/image-utils.js` | 15 |  |
| `client/src/lib/ink-live.js` | 202 |  |
| `client/src/lib/laser.js` | 163 | `client/src/lib/pen.js` |
| `client/src/lib/layout.js` | 62 |  |
| `client/src/lib/locked-tree.js` | 236 | `client/src/lib/board-geometry.js`, `client/src/lib/tree-layout.js` |
| `client/src/lib/mdlite.js` | 23 |  |
| `client/src/lib/minimap.js` | 87 |  |
| `client/src/lib/multi-click.js` | 69 |  |
| `client/src/lib/outline.js` | 53 | `client/src/lib/board-geometry.js` |
| `client/src/lib/palette.js` | 58 | `client/src/lib/badges.js` |
| `client/src/lib/pen.js` | 115 | `client/src/lib/erase.js`, `client/src/lib/shape.js`, `client/src/lib/text-el.js` |
| `client/src/lib/place-node.js` | 89 |  |
| `client/src/lib/png-export.js` | 95 | `client/src/lib/edge-routing.js` |
| `client/src/lib/pointer-input.js` | 206 |  |
| `client/src/lib/polygon-snap.js` | 306 |  |
| `client/src/lib/popover.js` | 27 |  |
| `client/src/lib/raf-throttle.js` | 79 |  |
| `client/src/lib/rebase.js` | 289 |  |
| `client/src/lib/recognize.js` | 495 | `client/src/lib/shape.js`, `client/src/lib/stroke.js` |
| `client/src/lib/scribble.js` | 203 | `client/src/lib/shape.js`, `client/src/lib/stroke.js` |
| `client/src/lib/selection-box.js` | 183 | `client/src/lib/card-levels.js`, `client/src/lib/shape.js` |
| `client/src/lib/selection.js` | 28 |  |
| `client/src/lib/shape.js` | 551 | `client/src/lib/stroke.js`, `client/src/lib/text-el.js` |
| `client/src/lib/sketchy.js` | 184 | `client/src/lib/shape.js` |
| `client/src/lib/snap.js` | 44 |  |
| `client/src/lib/stroke.js` | 109 |  |
| `client/src/lib/text-el.js` | 57 |  |
| `client/src/lib/tree-layout.js` | 271 | `client/src/lib/board-geometry.js` |
| `client/src/lib/useBoardHistory.js` | 80 |  |
| `client/src/lib/useBoardPersistence.js` | 170 | `client/src/lib/api.js`, `client/src/lib/game-design.js`, `client/src/lib/locked-tree.js`, `client/src/lib/rebase.js`, `client/src/lib/useLiveSync.js` |
| `client/src/lib/useCloseOnOutside.js` | 18 |  |
| `client/src/lib/useFollow.js` | 262 | `client/src/lib/follow.js` |
| `client/src/lib/useInk.js` | 1060 | `client/src/lib/erase.js`, `client/src/lib/pointer-input.js`, `client/src/lib/polygon-snap.js`, `client/src/lib/raf-throttle.js`, `client/src/lib/recognize.js`, `client/src/lib/scribble.js`, `client/src/lib/shape.js`, `client/src/lib/stroke.js` |
| `client/src/lib/useInkLive.js` | 341 | `client/src/lib/ink-live.js`, `client/src/lib/raf-throttle.js`, `client/src/lib/useLiveSync.js` |
| `client/src/lib/useLaser.js` | 145 | `client/src/lib/laser.js`, `client/src/lib/raf-throttle.js` |
| `client/src/lib/useLiveSync.js` | 287 | `client/src/lib/raf-throttle.js` |
| `client/src/lib/usePopoverPosition.js` | 34 | `client/src/lib/popover.js` |
| `client/src/lib/usePresence.js` | 206 | `client/src/lib/raf-throttle.js` |
| `client/src/lib/useSkin.js` | 45 | `client/src/styles/sketch-fonts.js` |
| `client/src/lib/useTheme.js` | 31 |  |
| `client/src/lib/useWorkspaceState.js` | 26 | `client/src/lib/workspace-state.js` |
| `client/src/lib/workspace-state.js` | 106 |  |

## Kiểm thử client (39)

| File | Dong | Import noi bo |
|---|---:|---|
| `client/src/lib/badges.test.js` | 16 | `client/src/lib/badges.js` |
| `client/src/lib/board-geometry.test.js` | 117 | `client/src/lib/board-geometry.js` |
| `client/src/lib/board-theme.test.js` | 103 | `client/src/lib/board-theme.js` |
| `client/src/lib/camera.test.js` | 41 | `client/src/lib/camera.js` |
| `client/src/lib/card-levels.test.js` | 94 | `client/src/lib/card-levels.js` |
| `client/src/lib/edge-routing.test.js` | 111 | `client/src/lib/edge-routing.js` |
| `client/src/lib/erase.test.js` | 222 | `client/src/lib/erase.js` |
| `client/src/lib/follow.test.js` | 119 | `client/src/lib/follow.js` |
| `client/src/lib/game-design.test.js` | 383 | `client/src/lib/game-design.js` |
| `client/src/lib/image-budget.test.js` | 58 | `client/src/lib/image-budget.js` |
| `client/src/lib/ink-live.test.js` | 380 | `client/src/lib/ink-live.js` |
| `client/src/lib/laser.test.js` | 188 | `client/src/lib/laser.js`, `client/src/lib/pen.js` |
| `client/src/lib/layout.test.js` | 72 | `client/src/lib/layout.js` |
| `client/src/lib/locked-tree.test.js` | 418 | `client/src/lib/locked-tree.js` |
| `client/src/lib/mdlite.test.js` | 24 | `client/src/lib/mdlite.js` |
| `client/src/lib/minimap.test.js` | 100 | `client/src/lib/minimap.js`, `client/src/lib/shape.js` |
| `client/src/lib/multi-click.test.js` | 116 | `client/src/lib/multi-click.js` |
| `client/src/lib/outline.test.js` | 39 | `client/src/lib/outline.js` |
| `client/src/lib/palette.test.js` | 122 | `client/src/lib/palette.js` |
| `client/src/lib/pen.test.js` | 164 | `client/src/lib/pen.js`, `client/src/lib/shape.js`, `client/src/lib/text-el.js` |
| `client/src/lib/place-node.test.js` | 177 | `client/src/lib/place-node.js` |
| `client/src/lib/pointer-input.test.js` | 260 | `client/src/lib/pointer-input.js` |
| `client/src/lib/polygon-snap.test.js` | 179 | `client/src/lib/polygon-snap.js` |
| `client/src/lib/popover.test.js` | 67 | `client/src/lib/popover.js` |
| `client/src/lib/raf-throttle.test.js` | 107 | `client/src/lib/raf-throttle.js` |
| `client/src/lib/rebase.test.js` | 290 | `client/src/lib/rebase.js` |
| `client/src/lib/recognize.test.js` | 448 | `client/src/lib/recognize.js` |
| `client/src/lib/scribble.test.js` | 190 | `client/src/lib/scribble.js` |
| `client/src/lib/selection-box.test.js` | 161 | `client/src/lib/selection-box.js` |
| `client/src/lib/selection.test.js` | 83 | `client/src/lib/selection.js` |
| `client/src/lib/shape.test.js` | 555 | `client/src/lib/shape.js` |
| `client/src/lib/sketchy.test.js` | 116 | `client/src/lib/sketchy.js` |
| `client/src/lib/snap.test.js` | 49 | `client/src/lib/snap.js` |
| `client/src/lib/stroke.test.js` | 86 | `client/src/lib/stroke.js` |
| `client/src/lib/text-el.test.js` | 59 | `client/src/lib/text-el.js` |
| `client/src/lib/tree-layout.test.js` | 524 | `client/src/lib/tree-layout.js` |
| `client/src/lib/useLiveSync.test.js` | 234 | `client/src/lib/useLiveSync.js` |
| `client/src/lib/usePresence.test.js` | 42 | `client/src/lib/usePresence.js` |
| `client/src/lib/workspace-state.test.js` | 122 | `client/src/lib/workspace-state.js` |

## Lịch sử trao đổi được Git theo dõi (9)

| File | Dong | Import noi bo |
|---|---:|---|
| `conversation/invite-gmail/26-11-26_15-26-24.md` |  |  |
| `conversation/invite-gmail/26-11-26_16-33-53.md` |  |  |
| `conversation/invite-gmail/26-11-26_16-33-54.md` |  |  |
| `conversation/invite-gmail/26-11-26_16-33-55.md` |  |  |
| `conversation/invite-gmail/26-11-26_16-33-56.md` |  |  |
| `conversation/password-login/26-11-26_14-57-16.md` |  |  |
| `conversation/password-login/26-11-26_15-05-37.md` |  |  |
| `conversation/password-login/26-11-26_15-06-53.md` |  |  |
| `conversation/password-login/26-11-26_15-08-04.md` |  |  |

## Tài liệu và lịch sử thiết kế (152)

| File | Dong | Import noi bo |
|---|---:|---|
| `docs/backlog.md` |  |  |
| `docs/claude-test-dependency-guard.md` |  |  |
| `docs/design/pvp-combat-ideas.md` |  |  |
| `docs/game-design-board-checklist.md` |  |  |
| `docs/game-design-board-test-guide.md` |  |  |
| `docs/recipes/dock-wheel-scroll.md` |  |  |
| `docs/recipes/google-oauth-local-playwright.md` |  |  |
| `docs/research/2026-07-24-canvas-apps-feature-research.md` |  |  |
| `docs/superpowers/plans/2026-07-24-idea-map-frames-card-colors.md` |  |  |
| `docs/superpowers/plans/2026-07-24-idea-map-wave1-canvas-feel.md` |  |  |
| `docs/superpowers/plans/2026-07-24-lingui-i18n.md` |  |  |
| `docs/superpowers/plans/2026-07-24-user-managed-badges.md` |  |  |
| `docs/superpowers/plans/2026-07-25-idea-map-board-ownership.md` |  |  |
| `docs/superpowers/plans/2026-07-25-idea-map-color-palette.md` |  |  |
| `docs/superpowers/plans/2026-07-25-idea-map-oauth-presence.md` |  |  |
| `docs/superpowers/plans/2026-07-25-idea-map-wave2-organize.md` |  |  |
| `docs/superpowers/plans/2026-07-25-idea-map-wave3-extras.md` |  |  |
| `docs/superpowers/plans/2026-07-26-idea-map-realtime-sync.md` |  |  |
| `docs/superpowers/plans/2026-07-26-idea-map-tree-layout.md` |  |  |
| `docs/superpowers/plans/2026-07-27-idea-map-left-toolbar-ink.md` |  |  |
| `docs/superpowers/plans/2026-07-28-idea-map-hud-islands.md` |  |  |
| `docs/superpowers/plans/2026-07-28-idea-map-laser-pointer.md` |  |  |
| `docs/superpowers/plans/2026-07-28-idea-map-shape-tool.md` |  |  |
| `docs/superpowers/plans/2026-07-28-idea-map-text-tool.md` |  |  |
| `docs/superpowers/plans/2026-07-28-idea-map-theme-sketch.md` |  |  |
| `docs/superpowers/plans/2026-08-10-split-repo-branches.md` |  |  |
| `docs/superpowers/plans/2026-08-11-game-design-board.md` |  |  |
| `docs/superpowers/plans/2026-08-11-gd-dev-handoff.md` |  |  |
| `docs/superpowers/plans/2026-08-11-gd-game-context-brief.md` |  |  |
| `docs/superpowers/plans/2026-08-11-gd-game-flow.md` |  |  |
| `docs/superpowers/plans/2026-08-11-gd-ready-for-dev.md` |  |  |
| `docs/superpowers/plans/2026-08-11-gd-spec-details.md` |  |  |
| `docs/superpowers/plans/2026-08-12-gd-balance-sheet.md` |  |  |
| `docs/superpowers/plans/2026-08-12-gd-balance-templates.md` |  |  |
| `docs/superpowers/plans/2026-08-12-gd-dependency-guard.md` |  |  |
| `docs/superpowers/plans/2026-08-12-gd-gui-playwright-verification.md` |  |  |
| `docs/superpowers/plans/2026-08-12-gd-playtest-decision-log.md` |  |  |
| `docs/superpowers/plans/2026-08-12-gd-review-workflow.md` |  |  |
| `docs/superpowers/plans/2026-08-12-gd-team-handoff.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-ab-test-hypothesis.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-analytics-events.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-archived-status.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-balance-card-links.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-decision-timeline.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-delivery-tracking.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-duplicate-card.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-follow-up-tasks.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-handoff-type-filter.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-live-ops-rollout.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-player-experience.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-post-launch-review.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-quick-related-card.md` |  |  |
| `docs/superpowers/plans/2026-08-13-gd-versioned-export.md` |  |  |
| `docs/superpowers/plans/2026-10-19-board-tools-repository-layout.md` |  |  |
| `docs/superpowers/plans/2026-10-19-locked-sibling-swap.md` |  |  |
| `docs/superpowers/plans/2026-10-19-same-level-spacing.md` |  |  |
| `docs/superpowers/plans/2026-10-19-smooth-connectors.md` |  |  |
| `docs/superpowers/plans/2026-10-19-tree-layout-lock.md` |  |  |
| `docs/superpowers/plans/2026-10-20-exclusive-tree-panel.md` |  |  |
| `docs/superpowers/plans/2026-10-21-collapse-design-toolbar.md` |  |  |
| `docs/superpowers/plans/2026-10-21-design-toolbar-second-row.md` |  |  |
| `docs/superpowers/plans/2026-10-21-user-workspace-state.md` |  |  |
| `docs/superpowers/plans/2026-11-27-board-save-revision.md` |  |  |
| `docs/superpowers/plans/2026-11-27-project-refactor.md` |  |  |
| `docs/superpowers/specs/2026-07-24-idea-map-frames-card-colors-design.md` |  |  |
| `docs/superpowers/specs/2026-07-24-idea-map-groups-wires-colors-design.md` |  |  |
| `docs/superpowers/specs/2026-07-24-idea-map-wave1-canvas-feel-design.md` |  |  |
| `docs/superpowers/specs/2026-07-24-lingui-i18n-design.md` |  |  |
| `docs/superpowers/specs/2026-07-24-user-managed-badges-design.md` |  |  |
| `docs/superpowers/specs/2026-07-25-idea-map-board-ownership-design.md` |  |  |
| `docs/superpowers/specs/2026-07-25-idea-map-color-palette-design.md` |  |  |
| `docs/superpowers/specs/2026-07-25-idea-map-dockable-panels-design.md` |  |  |
| `docs/superpowers/specs/2026-07-25-idea-map-oauth-presence-design.md` |  |  |
| `docs/superpowers/specs/2026-07-25-idea-map-wave2-organize-design.md` |  |  |
| `docs/superpowers/specs/2026-07-25-idea-map-wave3-extras-design.md` |  |  |
| `docs/superpowers/specs/2026-07-26-hidden-king-core-loop-design.md` |  |  |
| `docs/superpowers/specs/2026-07-26-idea-map-realtime-sync-design.md` |  |  |
| `docs/superpowers/specs/2026-07-26-idea-map-tree-layout-design.md` |  |  |
| `docs/superpowers/specs/2026-07-27-idea-map-left-toolbar-ink-design.md` |  |  |
| `docs/superpowers/specs/2026-07-27-idea-map-ui-shell-design.md` |  |  |
| `docs/superpowers/specs/2026-07-28-idea-map-hud-islands-design.md` |  |  |
| `docs/superpowers/specs/2026-07-28-idea-map-laser-pointer-design.md` |  |  |
| `docs/superpowers/specs/2026-07-28-idea-map-shape-tool-design.md` |  |  |
| `docs/superpowers/specs/2026-07-28-idea-map-text-tool-design.md` |  |  |
| `docs/superpowers/specs/2026-07-28-idea-map-theme-sketch-design.md` |  |  |
| `docs/superpowers/specs/2026-08-10-split-repo-branches-design.md` |  |  |
| `docs/superpowers/specs/2026-08-11-game-design-board-design.md` |  |  |
| `docs/superpowers/specs/2026-08-11-gd-dev-handoff-design.md` |  |  |
| `docs/superpowers/specs/2026-08-11-gd-game-context-brief-design.md` |  |  |
| `docs/superpowers/specs/2026-08-11-gd-game-flow-design.md` |  |  |
| `docs/superpowers/specs/2026-08-11-gd-ready-for-dev-design.md` |  |  |
| `docs/superpowers/specs/2026-08-11-gd-spec-details-design.md` |  |  |
| `docs/superpowers/specs/2026-08-12-gd-balance-sheet-design.md` |  |  |
| `docs/superpowers/specs/2026-08-12-gd-balance-templates-design.md` |  |  |
| `docs/superpowers/specs/2026-08-12-gd-dependency-guard-design.md` |  |  |
| `docs/superpowers/specs/2026-08-12-gd-playtest-decision-log-design.md` |  |  |
| `docs/superpowers/specs/2026-08-12-gd-review-workflow-design.md` |  |  |
| `docs/superpowers/specs/2026-08-12-gd-team-handoff-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-ab-test-hypothesis-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-analytics-events-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-archived-status-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-balance-card-links-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-decision-timeline-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-delivery-tracking-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-duplicate-card-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-follow-up-tasks-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-handoff-type-filter-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-live-ops-rollout-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-player-experience-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-post-launch-review-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-quick-related-card-design.md` |  |  |
| `docs/superpowers/specs/2026-08-13-gd-versioned-export-design.md` |  |  |
| `docs/superpowers/specs/2026-10-19-board-tools-repository-layout-design.md` |  |  |
| `docs/superpowers/specs/2026-10-19-locked-sibling-swap-design.md` |  |  |
| `docs/superpowers/specs/2026-10-19-same-level-spacing-design.md` |  |  |
| `docs/superpowers/specs/2026-10-19-smooth-connectors-design.md` |  |  |
| `docs/superpowers/specs/2026-10-19-tree-layout-lock-design.md` |  |  |
| `docs/superpowers/specs/2026-10-20-exclusive-tree-panel-design.md` |  |  |
| `docs/superpowers/specs/2026-10-21-collapse-design-toolbar-design.md` |  |  |
| `docs/superpowers/specs/2026-10-21-design-toolbar-second-row-design.md` |  |  |
| `docs/superpowers/specs/2026-10-21-user-workspace-state-design.md` |  |  |
| `docs/superpowers/specs/2026-11-27-board-save-revision-design.md` |  |  |
| `docs/superpowers/specs/2026-11-27-project-refactor-design.md` |  |  |
| `docs/superpowers/summaries/2026-07-27-idea-map-left-toolbar-ink-summary.md` |  |  |
| `docs/superpowers/summaries/2026-07-28-idea-map-hud-islands-summary.md` |  |  |
| `docs/superpowers/summaries/2026-07-28-idea-map-laser-pointer-summary.md` |  |  |
| `docs/superpowers/summaries/2026-07-28-idea-map-shape-tool-summary.md` |  |  |
| `docs/superpowers/summaries/2026-07-28-idea-map-text-tool-summary.md` |  |  |
| `docs/superpowers/summaries/2026-07-28-idea-map-theme-sketch-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-11-game-design-board-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-11-gd-game-context-brief-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-11-gd-ready-for-dev-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-12-gd-balance-sheet-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-12-gd-balance-templates-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-12-gd-gui-playwright-verification-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-12-gd-playtest-decision-log-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-12-gd-review-workflow-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-12-gd-team-handoff-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-13-gd-analytics-events-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-13-gd-balance-card-links-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-13-gd-follow-up-tasks-summary.md` |  |  |
| `docs/superpowers/summaries/2026-08-13-gd-handoff-type-filter-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-19-locked-sibling-swap-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-19-same-level-spacing-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-19-smooth-connectors-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-19-tree-layout-lock-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-20-exclusive-tree-panel-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-21-collapse-design-toolbar-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-21-design-toolbar-second-row-summary.md` |  |  |
| `docs/superpowers/summaries/2026-10-21-user-workspace-state-summary.md` |  |  |
| `docs/superpowers/summaries/2026-11-27-board-save-revision-summary.md` |  |  |
| `docs/superpowers/summaries/2026-11-27-project-refactor-summary.md` |  |  |

## Backend (16)

| File | Dong | Import noi bo |
|---|---:|---|
| `server/auth.js` | 238 | `server/models.js` |
| `server/board-payload.js` | 459 |  |
| `server/board-realtime.js` | 442 | `server/auth.js`, `server/follow.js`, `server/live-text.js`, `server/models.js` |
| `server/board-write.js` | 9 |  |
| `server/boards.js` | 636 | `server/auth.js`, `server/board-payload.js`, `server/board-write.js`, `server/models.js`, `server/pdf-quota.js`, `server/pdf-storage.js`, `server/rate-limit.js` |
| `server/calculator-routes.js` | 103 | `server/calculator.js` |
| `server/calculator.js` | 63 |  |
| `server/follow.js` | 80 |  |
| `server/index.js` | 252 | `server/auth.js`, `server/board-realtime.js`, `server/boards.js`, `server/calculator-routes.js`, `server/models.js`, `server/pdf-quota.js`, `server/rate-limit.js`, `server/workspace.js` |
| `server/live-text.js` | 109 |  |
| `server/models.js` | 157 |  |
| `server/notify.js` | 37 |  |
| `server/pdf-quota.js` | 441 | `server/models.js`, `server/notify.js`, `server/pdf-storage.js` |
| `server/pdf-storage.js` | 120 |  |
| `server/rate-limit.js` | 63 |  |
| `server/workspace.js` | 104 | `server/auth.js`, `server/models.js` |

## Kiểm thử server (9)

| File | Dong | Import noi bo |
|---|---:|---|
| `server/auth.test.js` | 251 | `server/auth.js` |
| `server/board-payload.test.js` | 417 | `server/board-payload.js` |
| `server/board-write.test.js` | 23 | `server/board-write.js` |
| `server/calculator.test.js` | 113 | `server/calculator.js` |
| `server/follow.test.js` | 79 | `server/follow.js` |
| `server/live-text.test.js` | 145 | `server/live-text.js` |
| `server/pdf-quota.test.js` | 202 | `server/pdf-quota.js` |
| `server/rate-limit.test.js` | 66 | `server/rate-limit.js` |
| `server/workspace.test.js` | 282 | `server/auth.js`, `server/models.js`, `server/workspace.js` |

## Script vận hành và migration (4)

| File | Dong | Import noi bo |
|---|---:|---|
| `server/scripts/hash-password.mjs` | 34 | `server/auth.js` |
| `server/scripts/migrate-pdf-to-r2.mjs` | 79 | `server/models.js`, `server/pdf-quota.js`, `server/pdf-storage.js` |
| `server/scripts/migrate-to-boards.mjs` | 126 | `server/models.js` |
| `server/scripts/pdf-usage.mjs` | 70 | `server/models.js`, `server/pdf-quota.js` |
