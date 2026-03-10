# JavaScript Implementation

## Scope

This directory contains the native JavaScript model, the stress runner, and the
helpers used by the repo-level documentation renderers.

## Layout

| Path                                        | Verified purpose                                              |
| ------------------------------------------- | ------------------------------------------------------------- |
| `src/EpochPermutation.js`                   | `EpochPermutation` class implementation.                      |
| `src/config.js`                             | Default configuration constants and validation.               |
| `scripts/rngStress.cjs`                     | Stress runner used by `js:stress` and `js:test`.              |
| `scripts/lib/`                              | Module loader, stress helpers, and scatter-rendering helpers. |
| `scripts/docs/renderPermutationScatter.cjs` | Repo-level scatter renderer that imports the JS helpers.      |

## Requirements

| Requirement     | Notes                                                |
| --------------- | ---------------------------------------------------- |
| Node.js and npm | Required for the root `npm run js:*` commands.       |
| `npm install`   | Installs the local runtime and tooling dependencies. |

## Commands

Run these commands from the repository root.

| Command                    | Verified behavior                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `npm run js:test`          | Runs `rngStress.cjs` with the preset `--runs 5 --max-range 25000 --progress-every 1`. |
| `npm run js:stress`        | Runs `rngStress.cjs` with its default stress config.                                  |
| `npm run js:chart:scatter` | Runs the repo-level scatter renderer.                                                 |

## Outputs

| Producer                                  | Output                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run js:test` and `npm run js:stress` | Write a timestamped JSON summary under `results/` by default.                                                                    |
| `npm run js:chart:scatter`                | Writes `assets/permutation-scatter.svg`, `assets/permutation-scatter-details.svg`, and `assets/permutation-scatter-epochs.json`. |

## Implementation Notes

| Topic                | Verified detail                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public surface       | The public class methods are `getNext()`, `view()`, and `getAllPermutations()`.                                                                                                |
| Default mode         | Default seed mode is `deterministic`.                                                                                                                                          |
| Alternate mode       | `runtime` seed mode is also supported and changes how deployment entropy and epoch-rotation entropy are derived.                                                               |
| `view()` behavior    | In deterministic mode, `view(sequenceIndex)` reconstructs values from the seed-derived state. In runtime mode, it only uses the current epoch seed.                            |
| Stress configuration | The stress runner accepts CLI flags or environment variables for runs, range, epoch bounds, rounds, seed mode, seed base, progress interval, stop-on-failure, and output path. |
