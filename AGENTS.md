# AGENTS.md

This file provides guidance for agentic coding tools working in the Excalidraw monorepo.

## Development Commands

### Type Checking & Linting

- `yarn test:typecheck` - Run TypeScript type checking (strict mode)
- `yarn test:code` - Run ESLint (max-warnings=0)
- `yarn test:other` - Run Prettier checks
- `yarn test:all` - Run all checks: typecheck, eslint, prettier, tests

### Running Tests

- `yarn test:app` - Run Vitest tests (default: watch mode)
- `yarn test:app --run` - Run tests once without watch
- `yarn test:app packages/math/tests/point.test.ts` - Run single test file
- `yarn test:app packages/math/tests/point.test.ts -t "rotate"` - Run matching tests
- `yarn test:update` - Update snapshots and run tests once

### Auto-fixing

- `yarn fix` - Fix all formatting and linting issues
- `yarn fix:code` - Fix ESLint issues
- `yarn fix:other` - Fix Prettier issues

### Building

- `yarn build:packages` - Build all packages
- `yarn build:common` - Build common package
- `yarn build:element` - Build element package
- `yarn build:math` - Build math package
- `yarn build:excalidraw` - Build main library

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Prefer implementations without allocation (trade RAM for CPU)
- Use `const` and `readonly` for immutability
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Prefer `import type` for type-only imports

### Imports

Import order (enforced by ESLint):

1. Built-in Node modules
2. External packages (including `@excalidraw/*`)
3. Internal imports
4. Parent/relative imports
5. Index imports

```typescript
import fs from "fs";
import lodash from "lodash";

import { something } from "@excalidraw/common";

import { helper } from "./helper";
import type { Type } from "./types";
```

### Naming Conventions

- **PascalCase**: Components, interfaces, type aliases, classes
- **camelCase**: Variables, functions, methods, object properties
- **UPPER_SNAKE_CASE**: Constants, enum values

### React

- Use functional components with hooks
- Follow React hooks rules (no conditional hooks)
- Keep components small and focused
- Use inline styles or CSS variables (not CSS modules in core library)

### Types

- **Always use branded types** from `@excalidraw/math/types` for math operations
- Use `Point` (tuple `[x: number, y: number]`) instead of `{x, y}` objects
- Example: `GlobalPoint`, `LocalPoint`, `Vector`, `Line`, `Curve`

### Error Handling

- Use try/catch for async operations
- Log errors with contextual information
- Return early on error conditions where appropriate
- Use `invariant()` for runtime assertions

### Testing

- Always fix test failures after modifications
- Run `yarn test:app` after code changes
- Tests use Vitest with jsdom environment
- Use `describe`, `it`, `expect` from global test context

### Performance

- Prefer `pointDistanceSq` over `pointDistance` when comparing distances
- Use Map instead of objects for large collections
- Use `readonly` arrays where possible
- Prefer `toIterable()` and `toArrow()` to avoid entry allocations

### Constants

- Use constants from `@excalidraw/common/constants` (e.g., `FONT_FAMILY`, `COLOR_PALETTE`)
- Use type-safe enums via `as const` objects
- Never hardcode magic numbers

### Math Operations

- Import from `@excalidraw/math` for geometry operations
- Use proper typed functions: `pointFrom`, `vectorScale`, `pointRotateRads`, etc.
- Angles: use `Radians` type with type assertion: `angle as Radians`

### Element Creation

- Use factory functions from `@excalidraw/element/newElement`:
  - `newElement()` - Generic elements
  - `newTextElement()` - Text elements
  - `newLinearElement()` - Lines/arrows
  - `newImageElement()` - Images
  - `newFrameElement()` - Frames

## Project Structure

```
packages/
  common/      - Shared utilities, constants, types
  element/     - Element types, rendering, manipulation
  math/        - Geometry, vector math, branded types
  utils/       - Export/import utilities
  excalidraw/  - Main React component library

excalidraw-app/ - Full web application

examples/       - Integration examples
```

## Type Safety Notes

- Strict TypeScript mode enabled
- Path aliases configured for `@excalidraw/*` imports
- Use branded types for type safety (e.g., `Point`, `Vector`, `Radians`)
- Global types defined in `packages/*/global.d.ts`

## Common Patterns

### Element Iteration

```typescript
import { toIterable } from "@excalidraw/common/utils";

for (const element of toIterable(elements)) {
  // element is properly typed
}
```

### Type Guards

```typescript
import { isTextElement } from "@excalidraw/element/typeChecks";

if (isTextElement(element)) {
  // TypeScript knows element is ExcalidrawTextElement
}
```

### Math with Branded Types

```typescript
import { pointFrom, pointRotateRads } from "@excalidraw/math/point";
import type { Radians, GlobalPoint } from "@excalidraw/math/types";

const point: GlobalPoint = pointFrom(10, 20);
const angle: Radians = (Math.PI / 2) as Radians;
const rotated = pointRotateRads(point, center, angle);
```
