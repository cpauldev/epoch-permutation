# Implementation Matrix

This directory is the canonical source/test/command map for every target in the repository.

The repository standardizes at the implementation-directory level, not by forcing identical internal layouts. Each target keeps the structure expected by its native toolchain.

## Repository Policy

- Every implementation keeps its own local `README.md`.
- Source files stay in the native toolchain layout.
- Tests stay where the native toolchain expects them.
- Helper runners live under local `scripts/` directories when needed.
- Repo-level documentation asset entrypoints live under `scripts/docs/`.
- Generated output is not treated as source.
- Repo-wide orchestration commands use `repo:*`; implementation commands use `<scope>:<action>[:<variant>]`.

## Source and Test Map

| Target     | Primary source path              | Test location                                          | Test style                                                                   | Main commands                                                                                      |
| ---------- | -------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| EVM        | `implementations/evm/contracts/` | `implementations/evm/test/`                            | Hardhat unit tests plus a local harness verification runner                  | `npm run evm:test`, `npm run evm:test:unit`, `npm run evm:test:local`, `npm run evm:benchmark:gas` |
| JavaScript | `implementations/js/src/`        | `implementations/js/scripts/rngStress.cjs`             | stress-based test runner plus repo-level docs renderers backed by JS helpers | `npm run js:test`, `npm run js:chart:scatter`                                                      |
| Rust       | `implementations/rust/*/src/`    | inline `#[cfg(test)]` modules in each crate            | crate-local unit tests                                                       | `npm run rust:test`, `npm run rust:check`                                                          |
| Aptos      | `implementations/aptos/sources/` | inline `#[test]` functions in `epoch_permutation.move` | Move unit tests                                                              | `npm run aptos:compile`, `npm run aptos:test`                                                      |
| Starknet   | `implementations/starknet/src/`  | inline `mod tests` in `lib.cairo`                      | Cairo `snforge` tests                                                        | `npm run starknet:build`, `npm run starknet:test`                                                  |
| Sui        | `implementations/sui/sources/`   | inline `#[test]` functions in `epoch_permutation.move` | Move unit tests                                                              | `npm run sui:build`, `npm run sui:test`                                                            |

## Choosing Where to Work

- If you are changing the Solidity reference or its benchmarking surface, start in `implementations/evm/`.
- If you are verifying algorithm behavior off-chain, start in `implementations/js/`. If you are regenerating README assets, start in `scripts/docs/` and follow the implementation-specific helpers from there.
- If you are porting shared logic into Rust-based runtimes, start in `implementations/rust/`.
- If you are touching a chain-specific port, use that implementation's local README and preserve the host-toolchain layout.

The root README explains repo-wide behavior, command orchestration, and generated-artifact policy. Local READMEs should only carry the runtime-specific deltas.
