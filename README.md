# Board Tools

Board Tools is a collaborative idea-mapping and game-design workspace. The repository is intentionally split into two application workspaces:

- `client/` - React + Vite frontend
- `server/` - Express + Socket.IO + MongoDB backend
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

```powershell
cd client
npm test
npm run build
npm run test:smoke
cd ..\server
npm test
```

Render deploys from the repository root using `render.yaml`; the server serves the built frontend from `client/dist`.
