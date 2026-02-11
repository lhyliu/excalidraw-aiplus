# AGENTS.md

This file defines practical rules for coding agents working in this repository.

## Scope

- Applies to the whole repository unless a deeper `AGENTS.md` overrides it.
- Do not invent product behavior that is not present in code.

## Repository Facts

- Monorepo with Yarn workspaces (`yarn@1.22.22`).
- Node.js required: `>=18`.
- Main app: `excalidraw-app/` (Vite dev server).
- Core editor package: `packages/excalidraw/`.

## Setup and Run

```bash
yarn install
yarn start
```

- Dev URL defaults to `http://localhost:3001` from `.env.development` (`VITE_APP_PORT`).
- To change port, update `VITE_APP_PORT`.

## Validation Commands

Use the smallest sufficient check first, then expand when needed.

- Fast check:
```bash
yarn test
```
- Full local gate:
```bash
yarn test:all
```
- Architecture-assistant related changes:
```bash
yarn test:architecture
```
- Auto-fix formatting/lint where possible:
```bash
yarn fix
```

## Editing Rules

- Keep changes minimal and focused on the user request.
- Do not refactor unrelated code.
- Do not modify lockfiles unless dependency changes are required.
- Preserve existing code style in touched files.
- Update docs when behavior or commands change.

## AI Feature Notes

- AI settings UI path: Main Menu -> AI Settings.
- Stored in browser localStorage key: `excalidraw_ai_settings`.
- Expected fields: `apiUrl`, `apiKey`, `model`.
- Default model fallback in code: `gpt-4o-mini`.
- API URL may be base URL or full endpoint; service normalizes to chat/responses endpoints.

## Safety and Secrets

- Never commit real API keys or credentials.
- Treat `.env*` values as sensitive unless clearly public/test-only.
- Prefer configuration via existing env variables instead of hardcoding.

## Commit and PR Guidance

- Branch naming recommendation: `feat/*`, `fix/*`, `refactor/*`, `docs/*`, `test/*`.
- Commit message recommendation:
  - `feat(area): ...`
  - `fix(area): ...`
  - `docs(area): ...`
- PR should include:
  - What changed and why
  - Affected paths/packages
  - Test commands run and results
  - Screenshots for UI changes

## When Unsure

- Prefer reading current code and scripts over assumptions.
- Ask for clarification only when a decision cannot be derived from repository context.
