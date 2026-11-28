# Board Tools

Board Tools is a collaborative idea-mapping and game-design workspace. The repository is split into two application workspaces plus shared code:

- `client/` - React + Vite frontend
- `server/` - Express + Socket.IO + MongoDB backend
- `shared/` - plain ESM constants used by both client and server (no dependencies, no DOM or Node APIs)
- `docs/` - product design, research, recipes, and implementation history

## Local setup

Install dependencies once in each workspace:

```powershell
cd client
npm install
cd ..\server
npm install
```

Copy `client/.env.example` and `server/.env.example` to local env files, then fill in the required OAuth, MongoDB, session, and storage settings. Never commit `.env` files.

## Development

Run the backend and frontend in separate terminals:

```powershell
cd server
npm run dev
```

```powershell
cd client
npm run dev
```

The normal development ports are client `7155` and server `3345`.

## Verification

Run everything CI runs, from the repository root:

```powershell
npm run verify
```

`verify` runs, in order: client lint (ESLint, react-hooks rules only), client unit tests, client build, every smoke scenario, and server tests. GitHub Actions (`.github/workflows/ci.yml`) runs it on Node 22 for every pull request and push to `main`.

Individual steps:

```powershell
cd client
npm run lint
npm test
npm run build
npm run test:smoke
cd ..\server
npm test
```

### Smoke scenarios

`npm run test:smoke` builds `client/src/__smoke__/` and runs every scenario, each in its own process with a fresh JSDOM. To run one scenario (after the smoke build has run at least once):

```powershell
cd client
$env:SMOKE_ONLY="tree-panel"; node smoke-run.mjs
```

Scenarios: `source-checks`, `board`, `concurrent-nudge`, `game-design-panels`, `tree-panel`, `workspace`. Add a new one as `client/src/__smoke__/scenarios/<name>.jsx` exporting `async function run(log)`, then register it in `client/src/__smoke__/entry.jsx` and in `SCENARIOS` in `client/smoke-run.mjs`.

## Code map

### Client (`client/src`)

- `pages/IdeaMap.jsx` - composes the board: calls the hooks below and renders the board components. Loaded lazily, like `pages/Calculator.jsx`.
- `lib/useBoardStore.js` - the single write path for a board: load, `preview`/`commit`, save queue (`lib/save-queue.js`), undo history (`lib/history.js`), remote updates, snapshots.
- `lib/useCamera.js` - pan/zoom state, kept outside the board; `lib/useCameraControls.js` holds the camera actions and the follow (screen pinning) loop.
- `lib/use<Domain>.js` - one hook per area: `useBoardSelection`, `useBoardFilters`, `useBadgesAndPalette`, `useEdgeInteractions`, `useGroupInteractions`, `useNodeInteractions`, `useNodeMedia`, `useDrawingSelection` (owns `useInk`), `useTextTool`, `useTreeLayout`, `usePresentation`, `useGameDesignBoard`, `useBoardKeyboard`, `useSelectionActions`, `useViewportInput`, `useEdgeLayerHandlers`, `useBoardItemHandlers`, `useBoardImportExport`.
- Board plumbing hooks: `useWorkspaceInspectors` (panel/inspector flags from the per-user workspace state), `useBoardUiState` (plain UI state), `useBoardRefs` (shared refs), `useBoardDerived` (render-only derived values), `useBoardSync` (workspace camera/inspector sync, snapshots list, `?card=` jump), `usePresenceSync` (selection/edge-draft/camera broadcasts), `useViewportGestures` (page-level DOM listeners).
- `lib/bind-all.js` - gives every domain hook the IdeaMap functions/refs it needs but that exist only after it is called.
- `lib/drag-session.js` - `startDrag()` for every mouse drag; `lib/useStableHandlers.js` - fixed-identity handler objects for memoized cards and frames.
- `lib/board-context.js` - read-only `{ store, selection, camera }` context for the board components.
- `lib/game-design/` - game-design logic by domain; `lib/game-design.js` re-exports it.
- `lib/api.js` - HTTP calls go through `request()` (exceptions: `logout`, which only needs the network round trip, and the PDF upload in `lib/useNodeMedia.js`).
- `components/board/` - board UI pieces (top bar, canvas, docks, popovers, …).
- `components/game-design/` - game-design panels (loaded lazily from the edit dock).
- `styles/board/` - board CSS split by area; `styles/board/index.css` imports them in an order that matters.
- `__smoke__/` - smoke harness and scenarios (see above).

### Server (`server`)

- `index.js` - bootstrap only: config → MongoDB → app → Socket.IO → listen.
- `config.js` - loads `.env` once and checks required environment variables.
- `app.js` - builds the Express app; API routers are mounted before static files.
- `routes/` - `auth`, `calculator`, `boards`, `board-files`, `board-snapshots`, `board-members` (plus `workspace.js` at the root).
- `realtime/` - Socket.IO handshake, presence, broadcasts, and the live ink / geometry / laser sanitizers.
- `validation/` - board payload and game-design validation (`board-payload.js` re-exports them).
- `board-fields.js`, `board-templates.js`, `board-access.js`, `http.js` (`asyncRoute`) - shared server helpers.
- `jobs/quota-cron.js` - PDF quota job.

### Shared (`shared`)

- `ink-kinds.js` - stroke/shape kinds; `board-fields.js` - board content fields; `game-design-limits.js` - game-design limits, relation ids and status lists. Edit these once; client and server both import them.

## Deployment

Render deploys from the repository root using `render.yaml` (so `shared/` is available to both builds); the server serves the built frontend from `client/dist`.
