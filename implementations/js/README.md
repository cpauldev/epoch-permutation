# JavaScript Implementation

This directory contains the native JavaScript implementation plus the verification and visualization tooling built around it.

## Requirements

- Node.js and npm
- `npm install`

## Layout

- `src/`: JS reference model and shared configuration defaults
- `scripts/`: stress verification entrypoints
- `scripts/lib/`: internal runner and scatter-rendering helpers
- root `scripts/docs/`: repo-level docs asset renderers, including `js:chart:scatter`

## Commands

- `npm run js:test`
- `npm run js:stress`
- `npm run js:chart:scatter`

## Notes

- Run the commands in this guide from the repository root.
- By default, this implementation is the deterministic reference model.
- Pass `seedMode: "runtime"` in code, or `--seed-mode runtime` to `js:stress`, to mirror the EVM-style seed lifecycle with JS-native runtime context.
- `js:chart:scatter` runs the repo-level docs entrypoint and rewrites the tracked README assets under `assets/`.
- Stress-test summaries write to `results/` by default.
