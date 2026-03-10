# Starknet Implementation

## Scope

This directory contains the Cairo/Starknet contract implementation of Epoch
Permutation.

## Layout

| Path            | Verified purpose                                    |
| --------------- | --------------------------------------------------- |
| `Scarb.toml`    | Package manifest and contract target configuration. |
| `Scarb.lock`    | Resolved Scarb dependencies.                        |
| `src/lib.cairo` | Contract, helper functions, and inline unit tests.  |

## Requirements

| Requirement     | Notes                                                |
| --------------- | ---------------------------------------------------- |
| Node.js and npm | Required for the root `npm run starknet:*` commands. |
| `npm install`   | Installs the repo dependencies and wrappers.         |
| `scarb`         | Required for the build command.                      |
| `snforge`       | Required for the test command.                       |

## Public Surface

| Surface     | Entry points                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------- |
| Constructor | `constructor`                                                                                |
| ABI methods | `get_next_permuted_value`, `view_permutation`, `get_current_epoch_info`, `get_configuration` |
| Events      | `EpochSeedRotated`, `PermutationExecuted`                                                    |

## Commands

Run these commands from the repository root.

| Command                  | Verified behavior                                                      |
| ------------------------ | ---------------------------------------------------------------------- |
| `npm run starknet:build` | Runs `scarb build` through `implementations/tooling/runExternal.cjs`.  |
| `npm run starknet:test`  | Runs `snforge test` through `implementations/tooling/runExternal.cjs`. |

## Implementation Notes

| Topic            | Verified detail                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Entropy handling | Deployment-time entropy and generation-time entropy are assembled from separate Starknet runtime helpers in the same file. |
| Test location    | Tests are inline `#[cfg(test)]` unit tests in `src/lib.cairo`.                                                             |
| Build outputs    | `Scarb.toml` enables both Sierra and CASM outputs under `[[target.starknet-contract]]`.                                    |
