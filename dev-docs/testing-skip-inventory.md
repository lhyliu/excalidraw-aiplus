# Test Skip Inventory

Last updated: 2026-02-08

## Scope

- `packages/excalidraw`
- `packages/element`
- `packages/utils`

## Current skipped tests

Run:

`yarn test:skips`

This prints the latest skip inventory with file path and line number.

## Cleanup policy

- Prefer re-enabling skips tied to already fixed behavior.
- Keep long-running perf probes skipped unless explicitly opted-in.
- When a skip is retained, include a short reason and issue id (if available).
