# AGENTS.md

This file defines practical rules for coding agents working in this repository.

## Scope

- Applies to the whole repository unless a deeper `AGENTS.md` overrides it.
- Do not invent product behavior that is not present in code.

## Domain Doc Entry

- Product/domain behavior for AI architecture assistant lives in `AI_ARCHITECTURE_ASSISTANT.md`.
- `AGENTS.md` defines agent execution rules; do not treat `AI_ARCHITECTURE_ASSISTANT.md` as agent policy.

## Agent Communication Guidelines

- Be succinct; expansive generative AI answers are costly and slow
- Avoid providing explanations or teaching unless asked
- Stop apologizing if corrected; just provide correct information or code
- Prefer code unless asked for explanation
- Stop summarizing what you've changed after modifications unless asked

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

## Build/Lint/Test Commands

Use the smallest sufficient check first, then expand when needed.

### Running Tests

- Run all tests:

```bash
yarn test:app --watch=false
```

- Run a single test file:

```bash
yarn test:app --watch=false src/path/to/test.test.ts
```

- Run tests matching a pattern:

```bash
yarn test:app --watch=false --grep "pattern"
```

- Run tests with coverage:

```bash
yarn test:coverage
```

### Validation

- Fast check:

```bash
yarn test
```

- Full local gate:

```bash
yarn test:all
```

- Type checking:

```bash
yarn test:typecheck
```

- Linting:

```bash
yarn test:code
```

- Architecture tests:

```bash
yarn test:architecture
```

- Auto-fix formatting/lint:

```bash
yarn fix
```

### Build Commands

- Build packages:

```bash
yarn build:packages
```

- Build app:

```bash
yarn build:app
```

- Clean build artifacts:

```bash
yarn rm:build
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Prefer immutable data (const, readonly)
- Use optional chaining (?.) and nullish coalescing (??) operators
- Import using `type` keyword for type-only imports (enforced by ESLint)
- Prefer allocations-free implementations where possible
- Trade RAM usage for fewer CPU cycles when choosing implementations
- Always include `packages/math/src/types.ts` in the context when writing math-related code and always use the Point type instead of `{ x, y }`

### React

- Use functional components with hooks
- Follow React hooks rules (no conditional hooks)
- Keep components small and focused
- Use CSS modules for component styling

### Naming Conventions

- PascalCase: component names, interfaces, type aliases
- camelCase: variables, functions, methods
- ALL_CAPS: constants
- Use descriptive names that convey intent

### Imports (ESLint enforced)

- Group order: builtin → external → @excalidraw/\*\* → internal → parent → sibling → index → object → type
- Always separate groups with newlines
- Use @excalidraw/\* path aliases over relative paths for cross-package imports
- Do not import from "jotai" directly; use "editor-jotai" or "app-jotai"

### Error Handling

- Use try/catch for async operations
- Implement React error boundaries
- Log errors with contextual information
- Do not swallow errors silently

## Editing Rules

- Keep changes minimal and focused on the user request
- Do not refactor unrelated code
- Do not modify lockfiles unless dependency changes are required
- Preserve existing code style in touched files
- Update docs when behavior or commands change
- Always run `yarn test:app` after modifications and fix any issues

## AI Feature Notes

- AI settings UI path: Main Menu -> AI Settings
- Stored in browser localStorage key: `excalidraw_ai_settings`
- Expected fields: `apiUrl`, `apiKey`, `model`
- Default model fallback in code: `gpt-4o-mini`
- API URL may be base URL or full endpoint; service normalizes to chat/responses endpoints

## Safety and Secrets

- Never commit real API keys or credentials
- Treat `.env*` values as sensitive unless clearly public/test-only
- Prefer configuration via existing env variables instead of hardcoding

## Commit and PR Guidance

- Branch naming: `feat/*`, `fix/*`, `refactor/*`, `docs/*`, `test/*`
- Commit messages:
  - `feat(area): ...`
  - `fix(area): ...`
  - `docs(area): ...`
- PR should include:
  - What changed and why
  - Affected paths/packages
  - Test commands run and results
  - Screenshots for UI changes

## When Unsure

- Prefer reading current code and scripts over assumptions
- Ask for clarification only when a decision cannot be derived from repository context
