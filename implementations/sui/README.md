# Sui Implementation

## Scope

This directory contains the Sui Move package for Epoch Permutation. The package
stores state as a `UID`-backed object and receives deployment and generation
context through explicit function parameters.

## Layout

| Path                             | Verified purpose                   |
| -------------------------------- | ---------------------------------- |
| `Move.toml`                      | Package manifest.                  |
| `Move.lock`                      | Pinned Sui framework dependencies. |
| `sources/epoch_permutation.move` | Implementation and inline tests.   |
| `build/`                         | Generated Sui build output.        |

## Requirements

| Requirement     | Notes                                           |
| --------------- | ----------------------------------------------- |
| Node.js and npm | Required for the root `npm run sui:*` commands. |
| `npm install`   | Installs the repo dependencies and wrappers.    |
| `sui` CLI       | Required for the build and test commands.       |

## Public Surface

| Entry point          | Purpose                                                         |
| -------------------- | --------------------------------------------------------------- |
| `new`                | Creates a `UID`-backed `State` object.                          |
| `next_value`         | Advances state and returns the next permuted value.             |
| `view_value`         | Returns the current view-only permutation for a sequence index. |
| `current_epoch_info` | Returns the current epoch number, seed, position, and size.     |
| `destroy_zero`       | Deletes the `State` object in cleanup paths.                    |

## Commands

Run these commands from the repository root.

| Command             | Verified behavior                                                        |
| ------------------- | ------------------------------------------------------------------------ |
| `npm run sui:build` | Runs `sui move build` through `implementations/tooling/runExternal.cjs`. |
| `npm run sui:test`  | Runs `sui move test` through `implementations/tooling/runExternal.cjs`.  |

## Implementation Notes

| Topic              | Verified detail                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Storage model      | `State` is a `UID`-backed Sui object.                                                                                                      |
| Address alias      | `Move.toml` binds the package address alias `epoch_permutation = "0x42"`.                                                                  |
| Runtime inputs     | `next_value` takes `randomness_beacon`, `caller`, and `timestamp` as explicit inputs; it does not derive them internally from `TxContext`. |
| Test behavior      | Tests are inline in `sources/epoch_permutation.move` and clean up state with `destroy_zero`.                                               |
| Dependency pinning | `Move.lock` pins framework dependencies for the `testnet` environment.                                                                     |
