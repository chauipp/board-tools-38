# Workspace guide

## Project

- Main application: `board-tools/`
- Client: React + Vite in `board-tools/client/`
- Server: Express + Socket.IO + MongoDB in `board-tools/server/`

## Common commands

Run these from the indicated directory:

```bash
# board-tools/client
npm test
npm run build
npm run test:smoke
npm run dev

# board-tools/server
npm test
npm run dev
```

The normal development ports are client `7155` and server `3345`.

## Working rules

- Preserve unrelated user changes in a dirty worktree.
- Use `apply_patch` for source edits.
- Run focused checks after a change; run build/smoke tests for cross-cutting UI work.
- Do not print secrets from `.env` files.
- For files attached to boards, do not store large binary data directly in MongoDB board documents; use file storage and retain only metadata/URLs in the board.
