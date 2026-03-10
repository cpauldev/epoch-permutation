# Aptos Implementation

## Scope

This directory contains the Aptos Move package for Epoch Permutation. The Move
module stores state in a resource and receives deployment and generation context
through explicit function parameters.

## Layout

| Path                             | Verified purpose                  |
| -------------------------------- | --------------------------------- |
| `Move.toml`                      | Package manifest.                 |
| `sources/epoch_permutation.move` | Implementation and inline tests.  |
| `build/`                         | Generated Aptos CLI build output. |

## Requirements

| Requirement     | Notes                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js and npm | Required for the root `npm run aptos:*` commands.                                                                                             |
| `npm install`   | Installs the repo dependencies, including the npm Aptos CLI package.                                                                          |
| Aptos CLI       | The root commands use the npm-installed `@aptos-labs/aptos-cli` binary when it is present and otherwise fall back to a system `aptos` binary. |

## Public Surface

| Entry point          | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `initialize`         | Creates the resource state and derives the initial configuration. |
| `next_value`         | Advances state and returns the next permuted value.               |
| `view_value`         | Returns the current view-only permutation for a sequence index.   |
| `current_epoch_info` | Returns the current epoch number, seed, position, and size.       |

## Commands

Run these commands from the repository root.

| Command                 | Verified behavior                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `npm run aptos:compile` | Runs `aptos move compile --package-dir .` through `implementations/tooling/runExternal.cjs`. |
| `npm run aptos:test`    | Runs `aptos move test --package-dir .` through `implementations/tooling/runExternal.cjs`.    |

## Implementation Notes

| Topic          | Verified detail                                                                                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Address alias  | `Move.toml` binds the package address alias `epoch_permutation = "0x42"`.                                                                                                                                            |
| Test location  | Tests are inline `#[test]` functions in `sources/epoch_permutation.move`.                                                                                                                                            |
| Runtime inputs | The module takes `chain_context`, `deployment_height`, `deployment_timestamp`, `randomness_beacon`, `caller`, and `timestamp` as explicit inputs; it does not derive them from Aptos runtime APIs inside the module. |
