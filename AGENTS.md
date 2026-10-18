# Workspace guide

## Project

- Main application: repository root
- Client: React + Vite in `client/`
- Server: Express + Socket.IO + MongoDB in `server/`

## Common commands

Run these from the indicated directory:

```bash
# client
npm test
npm run build
npm run test:smoke
npm run dev

# server
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

## Conversation persistence

- Each independent conversation gets its own folder at `conversation/<conversation-slug>/` from this worktree's root.
- Use a short lowercase, kebab-case slug. Reuse the same folder when the user continues that conversation; do not create a new folder.
- For every user message and its corresponding agent answer, create one file at `conversation/<conversation-slug>/<YY-MM-DD_HH-mm-ss>.md`.
- Each file must contain only two parts: the user's complete, verbatim question/request and the agent's complete, verbatim answer. Never summarize, shorten, paraphrase, or combine multiple chat pairs in one file.
- Do not include metadata, file/check lists, tool logs, chain-of-thought/internal reasoning, separate greetings, or content outside the question and answer. Do not record secrets, tokens, API keys, passwords, cookies, or sensitive data; replace unavoidable sensitive values with `[REDACTED]`.
- Use the timestamp when the pair is saved. If two pairs have the same second, add a short suffix to avoid overwriting a file.
- Save the file after every agent answer. If context was compacted or incomplete, record only what is actually visible and never invent missing content.
- Honor an explicit request not to save a conversation. Do not add `conversation/` to `.gitignore`.
