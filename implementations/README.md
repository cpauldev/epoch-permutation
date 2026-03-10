# Implementation Matrix

## Scope

This directory contains the target-specific implementations and the tooling
wrappers used by the root `npm run <scope>:<action>` commands.

## Repository Policy

| Policy           | Verified rule                                                                       |
| ---------------- | ----------------------------------------------------------------------------------- |
| Local docs       | Each target keeps a local `README.md`.                                              |
| Source layout    | Source files stay in the layout expected by the target toolchain.                   |
| Test layout      | Tests stay in the location expected by the target toolchain.                        |
| Helper runners   | Target-specific helper runners live under local `scripts/` directories when needed. |
| Docs renderers   | Repo-level documentation renderers live under `scripts/docs/`.                      |
| Generated output | Generated output is not treated as source.                                          |

## Target Map

| Target     | Primary source path              | Test location                                                                                  | Local README                         |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| EVM        | `implementations/evm/contracts/` | `implementations/evm/test/` plus `implementations/evm/scripts/localPermutationVerification.ts` | `implementations/evm/README.md`      |
| JavaScript | `implementations/js/src/`        | `implementations/js/scripts/rngStress.cjs`                                                     | `implementations/js/README.md`       |
| Rust       | `implementations/rust/*/src/`    | inline `#[cfg(test)]` modules in each crate                                                    | `implementations/rust/README.md`     |
| Aptos      | `implementations/aptos/sources/` | inline `#[test]` functions in `epoch_permutation.move`                                         | `implementations/aptos/README.md`    |
| Starknet   | `implementations/starknet/src/`  | inline `#[cfg(test)]` unit tests in `lib.cairo`                                                | `implementations/starknet/README.md` |
| Sui        | `implementations/sui/sources/`   | inline `#[test]` functions in `epoch_permutation.move`                                         | `implementations/sui/README.md`      |

## Tooling Notes

`implementations/tooling/runExternal.cjs` is the shared wrapper for the root
Aptos, Starknet, and Sui commands. `implementations/rust/scripts/runCargo.cjs`
is the Rust wrapper. Hardhat path configuration for the EVM implementation is
defined at the repository root in `hardhat.config.ts`.

## Choosing Where to Work

| Area                       | Start here when                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `implementations/evm/`     | You are changing the Solidity implementation, harnesses, or benchmark contracts.                                                  |
| `implementations/js/`      | You are verifying off-chain behavior or updating the JS-backed documentation assets.                                              |
| `implementations/rust/`    | You are changing the shared Rust core or the Solana and CosmWasm adapters.                                                        |
| Chain-specific directories | You are changing Aptos, Starknet, or Sui behavior and need to preserve the host-toolchain layout from that target's local README. |
